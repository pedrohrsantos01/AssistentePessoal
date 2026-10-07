import {SyncScheduler} from '../src/core/sync/scheduler.ts';
import {Clock,settle} from './support/scheduler.ts';
import {operationHash} from '../src/core/sync/operation-hash.ts';
import type {Operation} from '../src/core/sync/protocol.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import SQLite from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {fileURLToPath} from 'node:url';
import {Session} from '../src/core/identity/session.ts';
import {InstallationStore} from '../src/core/identity/installation-store.ts';
import type {Credentials,IdentityTransport,SecureVault} from '../src/core/identity/types.ts';
import {openTestStore} from './support/store.ts';

export const a='01996300-0000-7000-8000-000000000001',b='01996300-0000-7000-8000-000000000099';
const device='01996300-0000-7000-8000-000000000002';
export const command={type:'habit.create',habitId:'01996300-0000-7000-8000-000000000003',title:'Caminhar',habitType:'binary',scheduleKind:'daily',startDayKey:'2026-09-25',timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},iconKey:null,colorToken:null,sortOrder:0} as const;
export function credentials(accountId:string):Credentials {
  return {accountId,sessionId:'01996300-0000-7000-8000-000000000006',accessToken:'access-fixture-'+accountId,
    refreshToken:'refresh-fixture-'+accountId,revokeToken:'revoke-fixture-'+accountId,
    accessExpiresAt:'2099-10-25T13:00:00Z',refreshExpiresAt:'2099-11-25T13:00:00Z',
    profile:{accountId,displayName:'Pessoa',timeContext:{timezone:'UTC',dayStartHour:4},plan:'free',onboardedAt:null,analyticsConsentAt:null,revision:'0'}};
}
class Vault implements SecureVault {
  values=new Map<string,string>();
  failure:'get'|'set'|'remove'|null=null;
  async get(key:string) {if(this.failure==='get') throw new Error('vault_unavailable');return this.values.get(key)??null;}
  async set(key:string,value:string) {if(this.failure==='set') throw new Error('vault_unavailable');this.values.set(key,value);}
  async remove(key:string) {if(this.failure==='remove') throw new Error('vault_unavailable');this.values.delete(key);}
}
function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'ritmo-session-'));
  const db=new SQLite(join(directory,'installation.db'));
  const orm=drizzle(db);
  migrate(orm,{migrationsFolder:fileURLToPath(new URL('../drizzle-control',import.meta.url))});
  const control=new InstallationStore(orm,device);
  const vault=new Vault();
  let online=true;
  const transport:IdentityTransport={
    async login(email) {if(!online) throw new Error('offline');return credentials(email==='a'?a:b);},
    async register() {return credentials(a);},
    async refresh() {throw new Error('offline');},
    async revoke() {if(!online) throw new Error('offline');},
  };
  let id=0;
  const make=()=>new Session(control,vault,transport,(account,guard)=>Promise.resolve(openTestStore(join(directory,account+'.db'),account,device,guard)),()=>String(++id));
  let session=make();
  return {vault,transport,control,get session(){return session;},offline(){online=false;},online(){online=true;},
    async restart(){session.close();session=make();await session.restore();},
    close(){session.close();db.close();rmSync(directory,{recursive:true,force:true});}};
}
test('offline logout locks A, B sees its own database, and online reentry restores A pending work',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');
    const old=f.session.account();
    old.enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.offline();await f.session.logout();
    assert.throws(()=>old.view('2026-09-25'),/session_locked/);
    await f.restart();
    assert.throws(()=>f.session.account(),/session_locked/);
    await assert.rejects(f.session.login('a','fixture-password'),/offline/);
    f.online();await f.session.login('b','fixture-password');
    assert.equal(f.session.account().accountId,b);
    assert.equal(f.session.account().view('2026-09-25').pendingCount,0);
    await f.session.logout();await f.session.login('a','fixture-password');
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
    assert.equal(f.session.account().view('2026-09-25').habits[0]?.title,'Caminhar');
  } finally {f.close();}
});

test('failed credential removal keeps logout blocked across restart and preserves pending work',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');
    const old=f.session.account();
    old.enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.vault.failure='remove';
    await assert.rejects(f.session.logout(),/vault_unavailable/);
    assert.throws(()=>old.operations(),/session_locked/);
    await assert.rejects(f.restart(),/vault_unavailable/);
    assert.throws(()=>f.session.account(),/session_locked/);
    f.vault.failure=null;await f.restart();
    assert.throws(()=>f.session.account(),/session_locked/);
    // Only the revocation capability survives successful local logout.
    assert.ok([...f.vault.values.values()].every(value=>value.startsWith('revoke-fixture')));
    await f.session.login('a','fixture-password');
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
  } finally {f.close();}
});

test('a lost refresh response requires online login but keeps local work across restart',async()=>{
  const f=fixture();
  try {
    f.transport.login=async()=>({...credentials(a),accessExpiresAt:'2000-01-01T00:00:00Z'});
    await f.session.login('a','fixture-password');
    f.session.account().enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    await assert.rejects(f.session.accessToken(),/offline/);
    await f.restart();
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
    await assert.rejects(f.session.accessToken(),/authentication_required/);
    f.transport.login=async()=>credentials(a);
    await f.session.login('a','fixture-password');
    assert.equal(await f.session.accessToken(),credentials(a).accessToken);
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
  } finally {f.close();}
});

test('invalid protected credentials cannot authenticate a different account after restart',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');
    const key=[...f.vault.values.keys()].find(key=>key.includes('.credentials.'))!;
    f.vault.values.set(key,JSON.stringify(credentials(b)));
    await f.restart();
    assert.equal(f.session.account().accountId,a);
    await assert.rejects(f.session.accessToken(),/authentication_required/);
  } finally {f.close();}
});

test('a late refresh and pull from A cannot write into the session or database of B',async()=>{
  const f=fixture();
  try {
    f.transport.login=async email=>({...credentials(email==='a'?a:b),accessExpiresAt:email==='a'?'2000-01-01T00:00:00Z':'2099-10-25T13:00:00Z'});
    await f.session.login('a','fixture-password');const old=f.session.account();
    let release!:(value:Credentials)=>void;const response=new Promise<Credentials>(resolve=>{release=resolve;});f.transport.refresh=()=>response;
    const refresh=f.session.accessToken();const rejected=assert.rejects(refresh,/session_locked/);
    await f.session.logout();await f.session.login('b','fixture-password');
    release(credentials(a));await rejected;
    assert.throws(()=>old.applyPull({changes:[],hasMore:false,nextCursor:'late-A',highWaterRevision:'0',serverTime:'2026-09-26T13:00:00Z'}),/session_locked/);
    assert.equal(f.session.account().accountId,b);
    assert.equal(f.session.account().cursor(),null);
    assert.equal(await f.session.accessToken(),credentials(b).accessToken);
  } finally {f.close();}
});
test('offline revocations are retried without renewing or touching the active account',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');f.offline();await f.session.logout();
    await assert.rejects(f.session.flushRevocations(),/offline/);
    await f.restart();f.online();await f.session.login('b','fixture-password');
    await f.session.flushRevocations();
    assert.equal(f.session.account().accountId,b);
    assert.equal(f.control.keys().filter(key=>key.purpose==='revocation'&&key.account_id===a).length,0);
    assert.ok(f.control.keys().some(key=>key.purpose==='revocation'&&key.account_id===b));
  } finally {f.close();}
});

test('failure saving a rotated credential never reactivates the old refresh after restart',async()=>{
  const f=fixture();
  try {
    f.transport.login=async()=>({...credentials(a),accessExpiresAt:'2000-01-01T00:00:00Z'});
    f.transport.refresh=async()=>({...credentials(a),refreshToken:'new-fixture-refresh-0000000000000000000000'});
    await f.session.login('a','fixture-password');
    f.session.account().enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.vault.failure='set';await assert.rejects(f.session.accessToken(),/vault_unavailable/);
    f.vault.failure=null;await f.restart();
    await assert.rejects(f.session.accessToken(),/authentication_required/);
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
    await f.session.logout();
    assert.ok([...f.vault.values.values()].every(value=>value.startsWith('revoke-fixture')));
  } finally {f.close();}
});
test('logout fences a credential write already in flight and removes it before finishing',async()=>{
  const f=fixture();
  try {
    let started!:()=>void,release!:()=>void;
    const entered=new Promise<void>(resolve=>{started=resolve;}),resume=new Promise<void>(resolve=>{release=resolve;});
    const set=f.vault.set.bind(f.vault);
    f.vault.set=async(key,value)=>{if(key.includes('.credentials.')) {started();await resume;}await set(key,value);};
    const login=f.session.login('a','fixture-password');
    const refused=assert.rejects(login,/session_locked/);await entered;
    const logout=f.session.logout();
    assert.throws(()=>f.session.account(),/session_locked/);
    release();await refused;await logout;await f.restart();
    assert.throws(()=>f.session.account(),/session_locked/);
    assert.ok([...f.vault.values.values()].every(value=>value.startsWith('revoke-fixture')));
  } finally {f.close();}
});


test('an unavailable vault preserves the active local account and resumes only its current credential',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');
    f.session.account().enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    const keys=[...f.vault.values.keys()];f.vault.failure='get';
    await f.restart();
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:true,cleanupPending:false});
    f.session.account().enqueue({...command,habitId:b,title:'Outro'},'01996300-0000-7000-8000-000000000011','2026-09-25T13:00:00Z');
    assert.equal(f.session.account().operations().length,2);
    await assert.rejects(f.session.accessToken(),/vault_unavailable/);
    assert.deepEqual(await f.session.retryVault(),{unavailable:true,cleanupPending:false});
    assert.deepEqual([...f.vault.values.keys()],keys);
    f.vault.failure=null;
    assert.deepEqual(await f.session.retryVault(),{unavailable:false,cleanupPending:false});
    assert.equal(await f.session.accessToken(),credentials(a).accessToken);
    assert.equal(f.session.account().operations().length,2);
  } finally {f.close();}
});


test('failed cleanup after login keeps the new local session usable and retries only obsolete credentials',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');const old=f.session.account();
    const oldKey=[...f.vault.values.keys()].find(key=>key.includes('.credentials.'))!;
    old.enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.vault.failure='remove';await f.session.login('a','fixture-password');
    assert.throws(()=>old.operations(),/session_locked/);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:true,cleanupPending:true});
    assert.equal(f.session.account().operations().length,1);
    await assert.rejects(f.session.accessToken(),/vault_unavailable/);
    await f.restart();assert.equal(f.session.account().operations().length,1);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:true,cleanupPending:true});
    assert.ok(f.vault.values.has(oldKey));f.vault.failure=null;
    await f.session.retryVault();assert.equal(f.vault.values.has(oldKey),false);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:false,cleanupPending:false});
    assert.equal([...f.vault.values.keys()].filter(key=>key.includes('.credentials.')).length,1);
    assert.equal(await f.session.accessToken(),credentials(a).accessToken);
  } finally {f.close();}
});


test('failed login storage never activates a session and exposes only a bounded vault diagnostic',async()=>{
  const f=fixture();let logins=0;
  const login=f.transport.login;f.transport.login=async(...args)=>{logins++;return login(...args);};
  const set=f.vault.set.bind(f.vault);
  f.vault.set=async(key,value)=>{if(key.includes('.credentials.')) throw new Error('private platform fixture');await set(key,value);};
  try {
    await assert.rejects(f.session.login('a','fixture-password'),{message:'vault_unavailable'});
    assert.throws(()=>f.session.account(),/session_locked/);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:true,cleanupPending:true});
    await assert.rejects(f.session.login('a','fixture-password'),/vault_unavailable/);assert.equal(logins,1);
    f.vault.set=set;await f.session.retryVault();
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:false,cleanupPending:false});
    assert.throws(()=>f.session.account(),/session_locked/);
    await f.session.login('a','fixture-password');assert.equal(logins,2);
    assert.equal(f.session.account().accountId,a);
  } finally {f.close();}
});


test('a revocation read failure pauses remote access without mixing the active account with retired keys',async()=>{
  const f=fixture();let revokes=0;f.transport.revoke=async()=>{revokes++;};
  try {
    await f.session.login('a','fixture-password');await f.session.logout();await f.session.login('b','fixture-password');
    f.vault.failure='get';await assert.rejects(f.session.flushRevocations(),/vault_unavailable/);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:true,cleanupPending:false});assert.equal(revokes,0);
    await assert.rejects(f.session.accessToken(),/vault_unavailable/);
    f.session.account().enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    assert.equal(f.session.account().accountId,b);f.vault.failure=null;
    await f.session.retryVault();await f.session.flushRevocations();assert.equal(revokes,1);
    assert.equal(await f.session.accessToken(),credentials(b).accessToken);
    assert.equal(f.session.account().operations().length,1);
    await f.session.logout();await f.session.login('a','fixture-password');assert.equal(f.session.account().operations().length,0);
  } finally {f.close();}
});


test('the scheduler pauses for vault recovery without consuming intentions and resumes on the public retry action',async t=>{
  const f=fixture(),clock=new Clock();let requests=0;let scheduler:SyncScheduler|undefined;
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    requests++;
    if(input.endsWith('/push')) {
      const body=JSON.parse(String(init.body)) as {operations:Operation[]};
      return Response.json({results:body.operations.map(operation=>({receipt:{operationId:operation.operationId,operationHash:operationHash(operation),status:'accepted',acceptedRevision:'1'},replayed:false,projections:[]})),serverTime:'2026-09-25T13:00:00Z'});
    }
    return Response.json({changes:[],nextCursor:'vault-recovery-cursor',hasMore:false,highWaterRevision:'1',serverTime:'2026-09-25T13:00:00Z'});
  });
  try {
    await f.session.login('a','fixture-password');const operation=f.session.account().enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.vault.failure='get';await f.restart();
    scheduler=new SyncScheduler(f.session,'https://sync.test',clock);scheduler.update({active:true,online:true});await settle();
    assert.equal(scheduler.status().sync.phase,'paused');assert.equal(scheduler.status().sync.failures,0);
    assert.deepEqual(scheduler.status().revocations,{phase:'paused',failures:0,nextAttemptAt:null});
    await clock.advance(600000);assert.equal(requests,0);assert.deepEqual(f.session.account().operations(),[operation]);
    f.vault.failure=null;await f.session.retryVault();await settle();await settle();
    assert.ok(requests>0);assert.equal(f.session.account().operations().length,0);assert.equal(scheduler.status().sync.phase,'idle');
  } finally {scheduler?.dispose();f.close();}
});


test('retrying incomplete logout finishes the fence without reopening the account',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');const old=f.session.account();
    f.vault.failure='remove';await assert.rejects(f.session.logout(),/vault_unavailable/);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:true,cleanupPending:true});
    f.vault.failure=null;
    assert.deepEqual(await f.session.retryVault(),{unavailable:false,cleanupPending:false});
    assert.throws(()=>f.session.account(),/session_locked/);assert.throws(()=>old.operations(),/session_locked/);
    await f.session.login('b','fixture-password');assert.equal(f.session.account().accountId,b);
  } finally {f.close();}
});


test('a queued vault retry cannot restore credentials into a newer session generation',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');await f.session.logout();await f.session.login('b','fixture-password');
    const get=f.vault.get.bind(f.vault);let entered!:()=>void,release!:()=>void;
    const started=new Promise<void>(resolve=>{entered=resolve;}),resume=new Promise<void>(resolve=>{release=resolve;});
    let held=false;f.vault.get=async key=>{if(!held&&key.includes('.revocation.')) {held=true;entered();await resume;}return get(key);};
    const flush=f.session.flushRevocations();await started;
    const login=f.session.login('b','fixture-password');await settle();
    const retry=f.session.retryVault(),refused=assert.rejects(retry,/session_locked/);
    release();await flush;await login;await refused;
    assert.equal(f.session.account().accountId,b);assert.equal(await f.session.accessToken(),credentials(b).accessToken);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:false,cleanupPending:false});
  } finally {f.close();}
});


test('cleanup failure after a persisted refresh pauses token use and later resumes the new credential',async()=>{
  const f=fixture();let refreshes=0;
  try {
    f.transport.login=async()=>({...credentials(a),accessExpiresAt:'2000-01-01T00:00:00Z'});
    const renewed={...credentials(a),accessToken:'new-access-fixture-0000000000000000000000000',refreshToken:'new-refresh-fixture-0000000000000000000000000'};
    f.transport.refresh=async()=>{refreshes++;return renewed;};
    await f.session.login('a','fixture-password');f.vault.failure='remove';
    await assert.rejects(f.session.accessToken(),/vault_unavailable/);
    assert.deepEqual(f.session.vaultRecovery(),{unavailable:true,cleanupPending:true});
    f.vault.failure=null;await f.session.retryVault();
    assert.equal(await f.session.accessToken(),renewed.accessToken);assert.equal(refreshes,1);
    await f.restart();assert.equal(await f.session.accessToken(),renewed.accessToken);assert.equal(refreshes,1);
  } finally {f.close();}
});


test('vault recovery preserves an existing scheduler backoff instead of sending before its deadline',async t=>{
  const f=fixture(),clock=new Clock();let requests=0;let scheduler:SyncScheduler|undefined;
  t.mock.method(globalThis,'fetch',async()=>{requests++;throw new TypeError('offline fixture');});
  try {
    await f.session.login('a','fixture-password');scheduler=new SyncScheduler(f.session,'https://sync.test',clock);
    scheduler.update({active:true,online:true});await settle();
    assert.equal(requests,1);assert.equal(scheduler.status().sync.nextAttemptAt,clock.now()+1000);
    f.vault.failure='get';await f.session.retryVault();
    assert.equal(scheduler.status().sync.phase,'paused');f.vault.failure=null;await f.session.retryVault();await settle();
    assert.equal(requests,1);assert.equal(scheduler.status().sync.nextAttemptAt,clock.now()+1000);
    await clock.advance(999);assert.equal(requests,1);await clock.advance(1);assert.equal(requests,2);
  } finally {scheduler?.dispose();f.close();}
});
