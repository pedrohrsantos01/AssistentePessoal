import {openLocalDatabase} from '../src/core/db/local-opening.ts';
import {LocalRecoveryRequired} from '../src/core/db/local-migrations.ts';
import {InstallationStore} from '../src/core/identity/installation-store.ts';
import SQLite from 'better-sqlite3';
import {join} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,rmdirSync,writeFileSync} from 'node:fs';
import {openLocalSession} from '../src/core/identity/session-opening.ts';
import {openingFixture} from './support/opening.ts';
import {id,command,at,day} from './support/scheduler.ts';

test('an unavailable account file stays blocked, then public retry preserves its intentions',async()=>{
  const f=openingFixture();let owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    await owner.session.login('a','fixture-password');
    const pending=owner.session.account().enqueue(command,id(10),at);
    owner.close();
    const path=f.path(id(1)),bytes=readFileSync(path);
    // External filesystem fault: a directory occupies the database path; keep its original bytes aside.
    f.hide(id(1));mkdirSync(path);
    owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
    assert.equal(owner.recovery()?.scope,'account');assert.equal(owner.recovery()?.stage,'open');
    assert.equal(owner.recovery()?.reason,'storage');
    assert.throws(()=>owner.session.account(),/session_locked/);
    await owner.retryDatabase();assert.equal(owner.recovery()?.stage,'open');
    rmdirSync(path);f.unhide(id(1));assert.deepEqual(readFileSync(path),bytes);
    await owner.retryDatabase();assert.equal(owner.recovery(),null);
    assert.deepEqual(owner.session.account().operations(),[pending]);
    assert.equal(owner.session.account().view(day).habits[0]?.title,'Caminhar');
  } finally {owner.close();f.close();}
});

for(const affected of ['installation','account'] as const) test(affected+' corruption is preserved without discovering another account or disclosing raw errors',async()=>{
  const f=openingFixture();let owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    await owner.session.login('a','fixture-password');owner.session.account().enqueue(command,id(10),at);
    await owner.session.logout();await owner.session.login('b','fixture-password');
    const other=owner.session.account().enqueue({...command,title:'Conta B'},id(11),at);
    await owner.session.logout();await owner.session.login('a','fixture-password');owner.close();
    const bBytes=readFileSync(f.path(id(99))),path=f.path(affected==='account'?id(1):undefined);
    const original=readFileSync(path),damaged=Buffer.from(original);damaged.fill(0,0,16);writeFileSync(path,damaged);
    owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
    const recovery=owner.recovery();assert.equal(recovery?.scope,affected);assert.equal(recovery?.reason,'unreadable');
    assert.equal(recovery?.sqliteCode,'SQLITE_NOTADB');
    assert.throws(()=>affected==='installation'?owner.session:owner.session.account(),/locked/);
    await owner.retryDatabase();assert.deepEqual(owner.recovery(),recovery);
    assert.deepEqual(readFileSync(path),damaged);assert.deepEqual(readFileSync(f.path(id(99))),bBytes);
    assert.ok(f.handles.every(handle=>!handle.open||affected==='account'&&handle.name===f.path()));
    // Restore bytes only in this disposable fault fixture; application recovery never repairs/replaces a file.
    writeFileSync(path,original);await owner.retryDatabase();
    assert.equal(owner.recovery(),null);assert.equal(owner.session.account().operations()[0]?.operationId,id(10));
    await owner.session.logout();await owner.session.login('b','fixture-password');
    assert.deepEqual(owner.session.account().operations(),[other]);
  } finally {owner.close();f.close();}
});

test('a generic PRAGMA failure stays unknown, closes acquired handles and exposes no SQL or secrets',async()=>{
  const f=openingFixture();const secret='synthetic-secret-do-not-log';
  f.pragmaFailure(new Error('SELECT confidential_value '+secret));
  const owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    assert.equal(owner.recovery()?.stage,'pragma');assert.equal(owner.recovery()?.reason,'unknown');
    assert.equal(owner.recovery()?.sqliteCode,null);assert.ok(!JSON.stringify(owner.recovery()).includes(secret));
    assert.ok(f.handles.every(handle=>!handle.open));
    f.pragmaFailure(null);await owner.retryDatabase();assert.equal(owner.recovery(),null);
    await owner.session.login('a','fixture-password');assert.equal(owner.session.account().view(day).pendingCount,0);
  } finally {owner.close();f.close();}
});

test('an unknown account schema blocks access until a compatible retry preserves the original operation',async()=>{
  const f=openingFixture();let owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    await owner.session.login('a','fixture-password');const pending=owner.session.account().enqueue(command,id(10),at);owner.close();
    const fault=new SQLite(f.path(id(1)));fault.prepare('insert into __drizzle_migrations(hash,created_at) values (?,?)').run('future',9999999999999);fault.close();
    owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
    assert.equal(owner.recovery()?.reason,'schema');assert.throws(()=>owner.session.account(),/session_locked/);
    await owner.retryDatabase();assert.equal(owner.recovery()?.code,'local_schema_not_supported');
    const repair=new SQLite(f.path(id(1)));repair.prepare('delete from __drizzle_migrations where created_at=?').run(9999999999999);repair.close();
    await owner.retryDatabase();assert.deepEqual(owner.session.account().operations(),[pending]);
  } finally {owner.close();f.close();}
});

function extraMigration(folder:string,body:string) {
  const path=join(folder,'meta/_journal.json');
  const journal=JSON.parse(readFileSync(path,'utf8')) as {entries:{idx:number;version:string;when:number;tag:string;breakpoints:boolean}[]};
  const tag=String(journal.entries.length).padStart(4,'0')+'_opening_fixture';
  journal.entries.push({idx:journal.entries.length,version:'6',when:Math.max(...journal.entries.map(entry=>entry.when))+1,tag,breakpoints:true});
  writeFileSync(path,JSON.stringify(journal));const sqlPath=join(folder,tag+'.sql');writeFileSync(sqlPath,body);return sqlPath;
}
test('public migration recovery rolls back changed intentions and preserves an inactive account',async()=>{
  const f=openingFixture();let owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    await owner.session.login('a','fixture-password');const a=owner.session.account().enqueue(command,id(10),at);
    await owner.session.logout();await owner.session.login('b','fixture-password');
    const b=owner.session.account().enqueue({...command,title:'Conta B'},id(11),at);owner.close();
    const broken=extraMigration(f.migration('account'),"UPDATE sync_mutations SET envelope='{}';\n--> statement-breakpoint\nSELECT * FROM missing_fixture_table;");
    owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
    assert.equal(owner.recovery()?.stage,'migration');assert.equal(owner.recovery()?.reason,'migration');
    assert.throws(()=>owner.session.account(),/session_locked/);await owner.retryDatabase();assert.ok(owner.recovery());
    writeFileSync(broken,'CREATE INDEX fixture_pending ON sync_mutations(account_id,client_sequence);');
    await owner.retryDatabase();assert.deepEqual(owner.session.account().operations(),[b]);
    await owner.session.logout();await owner.session.login('a','fixture-password');
    assert.deepEqual(owner.session.account().operations(),[a]);
    const next=owner.session.account().enqueue({type:'habit.patchMetadata',habitId:command.habitId,patch:{title:'Depois'}},id(12),at);
    assert.equal(next.clientSequence,2);assert.deepEqual(next.dependsOn,[id(10)]);
  } finally {owner.close();f.close();}
});

test('installation migration recovery respects a persisted incomplete logout before opening any account',async()=>{
  const f=openingFixture();let owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    await owner.session.login('a','fixture-password');const pending=owner.session.account().enqueue(command,id(10),at);
    const remove=f.vault.remove;f.vault.remove=async()=>{throw new Error('unavailable fixture');};
    await assert.rejects(owner.session.logout(),/vault_unavailable/);owner.close();
    const broken=extraMigration(f.migration('installation'),"UPDATE installation_control SET session_state='active';\n--> statement-breakpoint\nSELECT * FROM missing_fixture_table;");
    owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);assert.equal(owner.recovery()?.scope,'installation');
    writeFileSync(broken,'CREATE INDEX fixture_keys ON protected_keys(purpose);');f.vault.remove=remove;
    await owner.retryDatabase();assert.equal(owner.recovery(),null);assert.throws(()=>owner.session.account(),/session_locked/);
    assert.ok([...f.values.values()].every(value=>value.startsWith('revoke-fixture')));
    await owner.session.login('a','fixture-password');assert.deepEqual(owner.session.account().operations(),[pending]);
  } finally {owner.close();f.close();}
});

test('logout during account retry invalidates the handle and never publishes A in the next generation B',async()=>{
  const f=openingFixture();const owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    await owner.session.login('a','fixture-password');const pending=owner.session.account().enqueue(command,id(10),at);
    owner.session.close();const paused=f.pause('account'),retry=owner.retryDatabase();await paused.started;
    const logout=owner.session.logout();paused.resume();await assert.rejects(retry,/session_locked/);await logout;
    await owner.session.login('b','fixture-password');assert.equal(owner.session.account().view(day).pendingCount,0);
    assert.equal(owner.recovery(),null);
    await owner.session.logout();await owner.session.login('a','fixture-password');assert.deepEqual(owner.session.account().operations(),[pending]);
  } finally {owner.close();f.close();}
});

test('closing during installation opening prevents a late session and releases all acquired SQLite handles',async()=>{
  const f=openingFixture();f.pragmaFailure(new Error('fixture'));
  const owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    f.pragmaFailure(null);const paused=f.pause('installation'),retry=owner.retryDatabase();await paused.started;
    owner.close();paused.resume();await assert.rejects(retry,/session_locked/);
    assert.throws(()=>owner.session,/installation_locked/);assert.ok(f.handles.every(handle=>!handle.open));
    await assert.rejects(owner.retryDatabase(),/session_locked/);
  } finally {owner.close();f.close();}
});

test('a failed cleanup preserves the original opening cause without putting either message into recovery',async()=>{
  const f=openingFixture(),cause=new Error('private SQLite statement fixture'),cleanup=new Error('private cleanup fixture');
  f.pragmaFailure(cause);const storage={...f.storage,open(name:string,kind:'installation'|'account'){
    const connection=f.storage.open(name,kind);return {...connection,close(){connection.close();throw cleanup;}};
  }};
  try {
    await assert.rejects(openLocalDatabase(storage,'installation','installation.db',db=>new InstallationStore(db,id(2))),error=>{
      assert.ok(error instanceof LocalRecoveryRequired);assert.equal(error.cause,cause);assert.equal(error.cleanupCause,cleanup);
      assert.deepEqual(error.diagnostic('installation'),{database:'installation.db',scope:'installation',stage:'pragma',
        code:'local_pragma_failed',sqliteCode:null,reason:'unknown'});return true;
    });
    assert.ok(f.handles.every(handle=>!handle.open));
  } finally {f.close();}
});

test('an account ownership mismatch stays blocked and never exposes the other account intentions',async()=>{
  const f=openingFixture();let owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {
    await owner.session.login('b','fixture-password');owner.session.account().enqueue({...command,title:'Privado B'},id(10),at);
    await owner.session.logout();await owner.session.login('a','fixture-password');owner.close();
    // Disposable misaddressed file fixture, outside the application storage API.
    const b=readFileSync(f.path(id(99)));f.hide(id(1));writeFileSync(f.path(id(1)),b);
    owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
    assert.equal(owner.recovery()?.stage,'initialize');assert.equal(owner.recovery()?.reason,'unknown');
    assert.throws(()=>owner.session.account(),/session_locked/);await owner.retryDatabase();assert.ok(owner.recovery());
    assert.deepEqual(readFileSync(f.path(id(99))),b);
    await owner.session.logout();await owner.session.login('b','fixture-password');
    assert.equal(owner.session.account().view(day).habits[0]?.title,'Privado B');assert.equal(owner.recovery(),null);
  } finally {owner.close();f.close();}
});

test('an unrecognized structured driver code is not copied into the public diagnostic',async()=>{
  const f=openingFixture();f.pragmaFailure(Object.assign(new Error('fixture'),{code:'SQLITE_PRIVATE_FIXTURE_VALUE'}));
  const owner=await openLocalSession(f.storage,f.vault,f.identity,f.nextId);
  try {assert.equal(owner.recovery()?.sqliteCode,null);assert.equal(owner.recovery()?.reason,'unknown');}
  finally {owner.close();f.close();}
});
