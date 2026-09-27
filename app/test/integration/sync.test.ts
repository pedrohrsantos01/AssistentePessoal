import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {openTestStore} from '../support/store.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import type {Command} from '../../src/core/sync/protocol.ts';
const id=()=>{const bytes=randomUUID().split('-');bytes[2]='7'+bytes[2]!.slice(1);return bytes.join('-');};
const root=process.env.RITMO_TEST_API;
assert.ok(root,'RITMO_TEST_API must point to the disposable integration server');
test('two real SQLite clients converge through HTTP and PostgreSQL, with duplicate marking, undo, redo and lost ack',async()=>{
  const deviceA=id(),deviceB=id(),habit=id(),directory=mkdtempSync(join(tmpdir(),'ritmo-e2e-'));
  const registration=await fetch(root+'/api/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-Ritmo-Protocol':'m1.1','X-App-Version':'0.1.0'},
    body:JSON.stringify({email:id()+'@example.test',password:'fixture-password',displayName:'Pessoa',deviceId:deviceA})});
  assert.equal(registration.status,201);
  const session=await registration.json() as {accountId:string;accessToken:string};
  const api=new HttpSync(root,session.accountId,()=>session.accessToken,id);
  let a=openTestStore(join(directory,'a.db'),session.accountId,deviceA);
  const b=openTestStore(join(directory,'b.db'),session.accountId,deviceB);
  const at='2026-09-25T13:00:00Z',day='2026-09-25',timeContext={timezone:'America/Sao_Paulo',dayStartHour:4};
  const mark:Command={type:'habit.mark',habitId:habit,dayKey:day,timeContext,observedUndoIds:[]};
  try {
    a.enqueue({type:'habit.create',habitId:habit,title:'Caminhar',habitType:'binary',scheduleKind:'daily',startDayKey:day,
      timeContext,iconKey:null,colorToken:null,sortOrder:0},id(),at);
    a.enqueue(mark,id(),at);
    a.close();a=openTestStore(join(directory,'a.db'),session.accountId,deviceA);
    assert.equal(a.view(day).totalXp,10);
    await synchronize(a,api);await synchronize(b,api);
    assert.deepEqual(a.view(day),b.view(day));
    b.enqueue(mark,id(),at);await synchronize(b,api);await synchronize(a,api);
    assert.equal(a.view(day).totalXp,10);
    const undo=id();
    a.enqueue({type:'habit.unmark',habitId:habit,dayKey:day,timeContext},undo,at);
    b.enqueue(mark,id(),at);
    await synchronize(a,api);await synchronize(b,api);await synchronize(a,api);
    assert.equal(a.view(day).totalXp,0);
    assert.equal(b.view(day).habits[0]?.done,false);
    a.enqueue({...mark,observedUndoIds:[undo]},id(),at);
    await synchronize(a,api);await synchronize(b,api);
    assert.equal(b.view(day).totalXp,10);
    const edit=a.enqueue({type:'habit.patchMetadata',habitId:habit,patch:{title:'Antigo A'}},id(),at);
    await api.push([edit]); // The server commits; deliberately discard the acknowledgement.
    b.enqueue({type:'habit.patchMetadata',habitId:habit,patch:{title:'Novo B'}},id(),at);
    await synchronize(b,api);await synchronize(a,api);
    assert.equal(a.view(day).habits[0]?.title,'Novo B');
    assert.equal(a.view(day).pendingCount,0);
    const other=openTestStore(':memory:',id(),id());
    try {await assert.rejects(synchronize(other,api),/account_mismatch/);}
    finally {other.close();}
  } finally {a.close();b.close();rmSync(directory,{recursive:true,force:true});}
});


test('session refresh, offline logout, account switching and reentry preserve and synchronize the original account',async()=>{
  const {HttpIdentity}=await import('../../src/core/identity/http-identity.ts');
  const {Session}=await import('../../src/core/identity/session.ts');
  const {InstallationStore}=await import('../../src/core/identity/installation-store.ts');
  const {default:SQLite}=await import('better-sqlite3');
  const {drizzle}=await import('drizzle-orm/better-sqlite3');
  const {migrate}=await import('drizzle-orm/better-sqlite3/migrator');
  const directory=mkdtempSync(join(tmpdir(),'ritmo-session-http-')),device=id();
  const sqlite=new SQLite(join(directory,'installation.db')),db=drizzle(sqlite);
  migrate(db,{migrationsFolder:'drizzle-control'});
  const control=new InstallationStore(db,device),values=new Map<string,string>();
  const vault={async get(key:string){return values.get(key)??null;},async set(key:string,value:string){values.set(key,value);},async remove(key:string){values.delete(key);}};
  const api=new HttpIdentity(root);
  const emailA=id()+'@example.test',emailB=id()+'@example.test';
  const accountA=await api.register(emailA,'fixture-password','Pessoa A',device);
  await api.register(emailB,'fixture-password','Pessoa B',device);
  let current=new Session(control,vault,api,(account,guard)=>Promise.resolve(openTestStore(join(directory,account+'.db'),account,device,guard)),id);
  const day='2026-09-25';
  try {
    await current.login(emailA,'fixture-password');
    current.account().enqueue({type:'habit.create',habitId:id(),title:'Pendência da conta A',habitType:'binary',scheduleKind:'daily',startDayKey:day,
      timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},iconKey:null,colorToken:null,sortOrder:0},id(),'2026-09-25T13:00:00Z');
    await Promise.all([current.accessToken(true),current.accessToken(true)]);
    // Logout itself makes no network call; the capability remains queued until explicitly flushed.
    await current.logout();await current.login(emailB,'fixture-password');
    await current.synchronize(root);
    assert.equal(current.account().view(day).habits.length,0);
    await current.logout();await current.login(emailA,'fixture-password');
    await current.flushRevocations();
    assert.equal(current.account().view(day).pendingCount,1);
    await current.synchronize(root);
    assert.equal(current.account().view(day).pendingCount,0);
    current.close();
    current=new Session(control,vault,api,(account,guard)=>Promise.resolve(openTestStore(join(directory,account+'.db'),account,device,guard)),id);
    await current.restore();
    assert.equal(current.account().accountId,accountA.accountId);
    assert.equal(current.account().view(day).habits[0]?.title,'Pendência da conta A');
  } finally {current.close();sqlite.close();rmSync(directory,{recursive:true,force:true});}
});
