import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {openTestStore} from '../support/store.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {entityKey,type Command,type Operation,type PushResult} from '../../src/core/sync/protocol.ts';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
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


const concurrencyDay='2026-09-25',concurrencyAt='2026-09-25T13:00:00Z';
const concurrencyContext={timezone:'America/Sao_Paulo',dayStartHour:4};
async function concurrentClients(t:TestContext) {
  const directory=mkdtempSync(join(tmpdir(),'ritmo-concurrency-http-'));
  const deviceA=id(),deviceB=id(),habitId=id(),email=id()+'@example.test';
  const identity=new HttpIdentity(root!);
  const first=await identity.register(email,'fixture-password','Pessoa',deviceA);
  const second=await identity.login(email,'fixture-password',deviceB);
  const apiA=new HttpSync(root!,first.accountId,()=>first.accessToken,id);
  const apiB=new HttpSync(root!,second.accountId,()=>second.accessToken,id);
  let a=openTestStore(join(directory,'a.db'),first.accountId,deviceA);
  let b=openTestStore(join(directory,'b.db'),second.accountId,deviceB);
  t.after(()=>{a.close();b.close();rmSync(directory,{recursive:true,force:true});});
  a.enqueue({type:'profile.setOnboarding',timeContext:concurrencyContext,completed:true,analyticsConsent:false},id(),concurrencyAt);
  a.enqueue({type:'habit.create',habitId,title:'Meditar',habitType:'binary',scheduleKind:'daily',startDayKey:concurrencyDay,
    timeContext:concurrencyContext,iconKey:null,colorToken:null,sortOrder:0},id(),concurrencyAt);
  const mark=(observedUndoIds:string[]):Command=>({type:'habit.mark',habitId,dayKey:concurrencyDay,timeContext:concurrencyContext,observedUndoIds});
  const unmark:Command={type:'habit.unmark',habitId,dayKey:concurrencyDay,timeContext:concurrencyContext};
  a.enqueue(mark([]),id(),concurrencyAt);
  await synchronize(a,apiA);await synchronize(b,apiB);
  async function canonical() {
    const snapshot=await apiA.snapshot(),page=await apiA.page(snapshot.snapshotId,snapshot.firstPageCursor);
    assert.equal(page.complete,true);
    return page.entities.sort((left,right)=>(left.kind+':'+entityKey(left)).localeCompare(right.kind+':'+entityKey(right)));
  }
  const initialGrant=(await canonical()).find(entity=>entity.kind==='xpGrant');
  assert.ok(initialGrant?.kind==='xpGrant');
  const originalGrantId=initialGrant.value.grantId;
  async function assertReward(active:boolean) {
    const entities=await canonical();
    assert.deepEqual(entities.flatMap(entity=>entity.kind==='xpGrant'?[{
      grantId:entity.value.grantId,amount:entity.value.amount,dayKey:entity.value.dayKey,
      budgetCost:entity.value.budgetCost,active:entity.value.active}]:[]),[{
      grantId:originalGrantId,amount:10,dayKey:concurrencyDay,budgetCost:10,active}]);
    assert.deepEqual(entities.flatMap(entity=>entity.kind==='xpBudget'?[entity.value.consumed]:[]),[10]);
  }
  async function assertTransitions(expected:('grant'|'reverse'|'restore')[]) {
    const transitions=(await canonical()).flatMap(entity=>entity.kind==='xpTransition'?[entity.value]:[])
      .sort((left,right)=>BigInt(left.revision)<BigInt(right.revision)?-1:1);
    assert.deepEqual(transitions.map(value=>({kind:value.kind,grantId:value.grantId})),
      expected.map(kind=>({kind,grantId:originalGrantId})));
  }
  async function converge(done:boolean) {
    await synchronize(a,apiA);await synchronize(b,apiB);await synchronize(a,apiA);
    const expected={habits:[{habitId,title:'Meditar',done}],totalXp:done?10:0,pendingCount:0,rejectedCount:0};
    assert.deepEqual(a.view(concurrencyDay),expected);assert.deepEqual(b.view(concurrencyDay),expected);
    await assertReward(done);
  }
  async function assertReplay(api:HttpSync,operation:Operation,original:PushResult[]) {
    const before=await canonical(),revision=(await apiA.snapshot()).highWaterRevision,result=original[0];
    assert.equal(original.length,1);
    assert.ok(result&&'receipt' in result);
    assert.equal(result.receipt.status,'accepted');
    const replay=await api.push([operation]),replayed=replay.results[0];
    assert.equal(replay.results.length,1);
    assert.ok(replayed&&'receipt' in replayed);
    assert.equal(replayed.replayed,true);
    assert.deepEqual(replayed.receipt,result.receipt);
    assert.deepEqual(await canonical(),before);
    assert.equal((await apiA.snapshot()).highWaterRevision,revision);
  }
  return {get a(){return a;},get b(){return b;},apiA,apiB,habitId,mark,unmark,canonical,converge,assertReward,assertTransitions,assertReplay,
    reopen(){a.close();b.close();a=openTestStore(join(directory,'a.db'),first.accountId,deviceA);
      b=openTestStore(join(directory,'b.db'),second.accountId,deviceB);}};
}

for(const arrival of ['undo-first','mark-first','simultaneous'] as const) {
  test('M1-04: an unobserved undo wins concurrent marking, arrival='+arrival,async t=>{
    const f=await concurrentClients(t);
    const undo=f.a.enqueue(f.unmark,id(),concurrencyAt);
    const marking=f.b.enqueue(f.mark([]),id(),concurrencyAt);
    const aPending=f.a.operations(),bPending=f.b.operations();
    f.reopen();assert.deepEqual(f.a.operations(),aPending);assert.deepEqual(f.b.operations(),bPending);
    let undoAck:Awaited<ReturnType<HttpSync['push']>>,markAck:Awaited<ReturnType<HttpSync['push']>>;
    if(arrival==='simultaneous') [undoAck,markAck]=await Promise.all([f.apiA.push([undo]),f.apiB.push([marking])]);
    else if(arrival==='undo-first') {undoAck=await f.apiA.push([undo]);markAck=await f.apiB.push([marking]);}
    else {markAck=await f.apiB.push([marking]);undoAck=await f.apiA.push([undo]);}
    f.a.applyAck(undoAck.results);f.b.applyAck(markAck.results);
    await f.converge(false);
    await f.assertTransitions(['grant','reverse']);
    await f.assertReplay(f.apiA,undo,undoAck.results);
    await f.assertReplay(f.apiB,marking,markAck.results);
    f.a.enqueue(f.mark([undo.operationId]),id(),concurrencyAt);
    await f.converge(true);
    await f.assertTransitions(['grant','reverse','restore']);
    const aView=f.a.view(concurrencyDay),bView=f.b.view(concurrencyDay);
    // Old acknowledgements must not revert the later conscious remark.
    f.a.applyAck(undoAck.results);f.b.applyAck(markAck.results);
    assert.deepEqual(f.a.view(concurrencyDay),aView);assert.deepEqual(f.b.view(concurrencyDay),bView);
    await f.assertReplay(f.apiA,undo,undoAck.results);
    await f.assertReplay(f.apiB,marking,markAck.results);
  });
}


for(const arrival of ['partial-before-second','partial-after-both','other-undo-first'] as const) {
  test('M1-06: two concurrent undos defeat a remark observing only one, arrival='+arrival,async t=>{
    const f=await concurrentClients(t);
    const undoA=f.a.enqueue(f.unmark,id(),concurrencyAt);
    const partial=f.a.enqueue(f.mark([undoA.operationId]),id(),concurrencyAt);
    const undoB=f.b.enqueue(f.unmark,id(),concurrencyAt);
    const aPending=f.a.operations(),bPending=f.b.operations();
    assert.equal(f.a.view(concurrencyDay).totalXp,10);
    f.reopen();assert.deepEqual(f.a.operations(),aPending);assert.deepEqual(f.b.operations(),bPending);
    const sendUndoA={client:'a' as const,api:f.apiA,operation:undoA};
    const sendPartial={client:'a' as const,api:f.apiA,operation:partial};
    const sendUndoB={client:'b' as const,api:f.apiB,operation:undoB};
    const deliveries={
      'partial-before-second':[sendUndoA,sendPartial,sendUndoB],
      'partial-after-both':[sendUndoA,sendUndoB,sendPartial],
      'other-undo-first':[sendUndoB,sendUndoA,sendPartial]
    }[arrival];
    const replies=[];
    for(const delivery of deliveries) {
      const ack=await delivery.api.push([delivery.operation]),result=ack.results[0];
      assert.equal(ack.results.length,1);assert.ok(result&&'receipt' in result);
      assert.equal(result.receipt.status,'accepted');
      // The partial remark commits, but its response is deliberately lost to A.
      if(delivery.operation.operationId!==partial.operationId) f[delivery.client].applyAck(ack.results);
      replies.push({...delivery,results:ack.results});
    }
    assert.deepEqual(f.a.operations(),[partial]);
    f.reopen();assert.deepEqual(f.a.operations(),[partial]);
    await f.converge(false);
    const history:('grant'|'reverse'|'restore')[]=arrival==='partial-before-second'
      ?['grant','reverse','restore','reverse']:['grant','reverse'];
    await f.assertTransitions(history);
    assert.deepEqual((await f.canonical()).flatMap(entity=>entity.kind==='habitDay'?[{
      habitId:entity.value.habitId,dayKey:entity.value.dayKey,done:entity.value.done,
      knownUndoIds:[...entity.value.knownUndoIds].sort()}]:[]),[{
      habitId:f.habitId,dayKey:concurrencyDay,done:false,knownUndoIds:[undoA.operationId,undoB.operationId].sort()}]);
    for(const reply of replies) await f.assertReplay(reply.api,reply.operation,reply.results);
    f.a.enqueue(f.mark([undoA.operationId,undoB.operationId]),id(),concurrencyAt);
    await f.converge(true);
    await f.assertTransitions([...history,'restore']);
    const aView=f.a.view(concurrencyDay),bView=f.b.view(concurrencyDay);
    for(const reply of replies) f[reply.client].applyAck(reply.results);
    assert.deepEqual(f.a.view(concurrencyDay),aView);assert.deepEqual(f.b.view(concurrencyDay),bView);
    for(const reply of replies) await f.assertReplay(reply.api,reply.operation,reply.results);
  });
}
