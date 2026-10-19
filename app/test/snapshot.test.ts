import {operationHash} from '../src/core/sync/operation-hash.ts';
import SQLite from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestStore} from './support/store.ts';
import {failureKind} from '../src/core/sync/retry.ts';
import {HttpSync,synchronize} from '../src/core/sync/synchronize.ts';
import {id,day,at,command} from './support/scheduler.ts';
import type {Entity} from '../src/core/sync/protocol.ts';

const habit=(title:string,revision='1',habitId=id(30)):Entity=>({kind:'habit',value:{habitId,title,revision,
  habitType:'binary',scheduleKind:'daily',startDayKey:day,creationTimeContext:command.timeContext,
  iconKey:null,colorToken:null,sortOrder:0,createdAt:at,updatedAt:at,deletedAt:null}});
const manifest=(snapshotId=id(20),entityCount=1)=>({snapshotId,entityCount,highWaterRevision:'2',expiresAt:'2099-01-01T00:00:00Z',firstPageCursor:'first-page-cursor'});
const page=(snapshotId=id(20),entities=[habit('Servidor')])=>({snapshotId,highWaterRevision:'2',entities,complete:true,nextPageCursor:null,pullCursor:'snapshot-pull-cursor'});
const expired=()=>Response.json({error:{code:'snapshot_expired'}},{status:410});
const resync=()=>Response.json({error:{code:'resync_required'}},{status:409});
const idle=()=>Response.json({changes:[],nextCursor:'snapshot-pull-cursor',hasMore:false,highWaterRevision:'2',serverTime:at});
const api=()=>new HttpSync('https://sync.test',id(1),()=> 'fixture-token',()=>id(99));

// Network responses are the external fault boundary; storage and synchronization are real.
test('an expired copy restarts without losing the old base or pending intent',async t=>{
  const store=openTestStore(':memory:',id(1),id(2));let snapshots=0;
  const pending=store.enqueue(command,id(4),at);
  store.applyPull({changes:[{revision:'1',operationResults:[],entities:[habit('Anterior')]}],nextCursor:'old-pull-cursor',hasMore:false,highWaterRevision:'1',serverTime:at});
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(input.endsWith('/snapshots')) {snapshots++;return Response.json(manifest(id(20+snapshots)));}
    if(input.includes('/snapshots/')) {
      assert.equal(store.view(day).habits.some(h=>h.title==='Anterior'),true);
      assert.deepEqual(store.operations(),[pending]);
      return snapshots===1?expired():Response.json(page(id(22)));
    }
    if(input.endsWith('/receipts')) return Response.json({snapshotId:id(22),highWaterRevision:'2',results:[{operationId:id(4),status:'notProcessedAtH'}]});
    if(input.endsWith('/push')) throw new TypeError('offline_after_swap');
    assert.equal(init.method,'GET');return snapshots===0?resync():idle();
  });
  try {
    await assert.rejects(synchronize(store,api()),/offline_after_swap/);
    assert.equal(snapshots,2);
    assert.deepEqual(store.operations(),[pending]);
    assert.deepEqual(store.view(day).habits.map(h=>h.title).sort(),['Caminhar','Servidor']);
    assert.equal(store.cursor(),'snapshot-pull-cursor');
  } finally {store.close();}
});

for(const [name,results] of [
  ['missing',[{operationId:id(4),status:'notProcessedAtH'}]],
  ['duplicated',[{operationId:id(4),status:'notProcessedAtH'},{operationId:id(4),status:'notProcessedAtH'}]],
  ['foreign',[{operationId:id(4),status:'notProcessedAtH'},{operationId:id(88),status:'notProcessedAtH'}]],
  ['after H',[{operationId:id(4),status:'accepted',acceptedRevision:'3'}]],
] as const) test('invalid receipt coverage ('+name+') cannot swap the base or confirm pending work',async t=>{
  const store=openTestStore(':memory:',id(1),id(2));let queries=0;
  const pending=[store.enqueue(command,id(4),at),store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(5),at)];
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    if(input.endsWith('/snapshots')) return Response.json(manifest());
    if(input.includes('/snapshots/')) return Response.json(page());
    if(input.endsWith('/receipts')) {
      if(++queries>1) throw new Error('unexpected_repeated_query');
      return Response.json({snapshotId:id(20),highWaterRevision:'2',results:name==='missing'?results:[...results,{operationId:id(5),status:'notProcessedAtH'}]});
    }
    if(input.includes('/pull')) return resync();
    throw new Error('unexpected_push');
  });
  try {
    await assert.rejects(synchronize(store,api()),/receipt_mismatch/);
    assert.deepEqual(store.operations(),pending);
    assert.equal(store.cursor(),null);
    assert.deepEqual(store.view(day).habits.map(h=>h.title),['Caminhar']);
  } finally {store.close();}
});

test('receipts include writes during the copy and the feed after H is read before any resend',async t=>{
  const store=openTestStore(':memory:',id(1),id(2));let copied=false,readAfterH=false,added=false;
  store.applyPull({changes:[{revision:'1',operationResults:[],entities:[habit('Anterior')]}],nextCursor:'old-pull-cursor',hasMore:false,highWaterRevision:'1',serverTime:at});
  const editing=store.enqueue({type:'habit.patchMetadata',habitId:id(30),patch:{title:'A com ack perdido'}},id(4),at);
  const queried:string[][]=[];
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(input.endsWith('/snapshots')) return Response.json(manifest());
    if(input.includes('/snapshots/')) {copied=true;return Response.json(page());}
    if(input.endsWith('/receipts')) {
      const request=JSON.parse(String(init.body)) as {operationIds:string[]};queried.push(request.operationIds);
      if(!added) {store.enqueue(command,id(5),at);added=true;}
      return Response.json({snapshotId:id(20),highWaterRevision:'2',results:request.operationIds.map(operationId=>({operationId,status:'notProcessedAtH'}))});
    }
    if(input.endsWith('/push')) {
      assert.equal(readAfterH,true,'must pull after H before resending');
      assert.deepEqual(store.operations().map(op=>op.operationId),[id(5)]);
      assert.equal(store.view(day).habits.find(h=>h.habitId===id(30))?.title,'B posterior');
      throw new TypeError('offline_after_feed');
    }
    if(!copied) return resync();
    readAfterH=true;
    return Response.json({changes:[
      {revision:'3',operationResults:[{operationId:id(4),operationHash:operationHash(editing),status:'accepted',acceptedRevision:'3'}],entities:[habit('A com ack perdido','3')]},
      {revision:'4',operationResults:[{operationId:id(88),status:'accepted',acceptedRevision:'4'}],entities:[habit('B posterior','4')]},
    ],nextCursor:'after-H-pull-cursor',hasMore:false,highWaterRevision:'4',serverTime:at});
  });
  try {
    await assert.rejects(synchronize(store,api()),/offline_after_feed/);
    assert.deepEqual(queried,[[id(4)],[id(5)]]);
    assert.equal(store.cursor(),'after-H-pull-cursor');
  } finally {store.close();}
});

test('a staging write failure stops the copy before fetching more and leaves the previous base usable',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-snapshot-')),path=join(directory,'account.db');
  const store=openTestStore(path,id(1),id(2)),fault=new SQLite(path);
  const pending=store.enqueue(command,id(4),at);
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    if(input.endsWith('/snapshots')) return Response.json(manifest(id(20),2));
    if(input.includes('first-page-cursor')) return Response.json({...page(),complete:false,nextPageCursor:'second-page-cursor',pullCursor:null});
    if(input.includes('/snapshots/')) throw new Error('fetched_before_staging');
    return resync();
  });
  try {
    fault.exec("CREATE TRIGGER fail_staging BEFORE INSERT ON snapshot_staging BEGIN SELECT RAISE(ABORT,'test_staging_failure'); END");
    await assert.rejects(synchronize(store,api()),(error:unknown)=>error instanceof Error&&(error.message.includes('test_staging_failure')||error.cause instanceof Error&&error.cause.message.includes('test_staging_failure')));
    assert.deepEqual(store.operations(),[pending]);
    assert.equal(store.cursor(),null);
    assert.deepEqual(store.view(day).habits.map(h=>h.title),['Caminhar']);
  } finally {fault.close();store.close();rmSync(directory,{recursive:true,force:true});}
});

test('repeated expiration yields to bounded backoff with the pending intent preserved',async t=>{
  const store=openTestStore(':memory:',id(1),id(2));const pending=store.enqueue(command,id(4),at);let copies=0;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    if(input.endsWith('/snapshots')) {copies++;assert.ok(copies<=2);return Response.json(manifest());}
    if(input.includes('/snapshots/')) return expired();
    return resync();
  });
  try {
    await assert.rejects(synchronize(store,api()),(error:unknown)=>{assert.equal(failureKind(error),'retry');return true;});
    assert.equal(copies,2);assert.deepEqual(store.operations(),[pending]);assert.equal(store.cursor(),null);
  } finally {store.close();}
});

for(const malformed of ['cursor cycle','future revision'] as const) test('snapshot rejects '+malformed+' without replacing the base',async t=>{
  const store=openTestStore(':memory:',id(1),id(2));const pending=store.enqueue(command,id(4),at);let requests=0;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    if(input.endsWith('/snapshots')) return Response.json(manifest());
    if(input.includes('/snapshots/')) {
      if(++requests>2) throw new Error('unbounded_pagination');
      return Response.json(malformed==='cursor cycle'?{...page(),complete:false,nextPageCursor:'first-page-cursor',pullCursor:null}:page(id(20),[habit('Future','3')]));
    }
    if(input.endsWith('/receipts')) throw new Error('invalid_copy_used');
    return resync();
  });
  try {
    await assert.rejects(synchronize(store,api()),/snapshot_mismatch/);
    assert.deepEqual(store.operations(),[pending]);assert.equal(store.cursor(),null);
    assert.deepEqual(store.view(day).habits.map(h=>h.title),['Caminhar']);
  } finally {store.close();}
});

test('a failed snapshot swap rolls back canonical data, confirmations and cursor together, preserving rejected history',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-swap-')),path=join(directory,'account.db');
  let store=openTestStore(path,id(1),id(2));const fault=new SQLite(path);
  store.applyPull({changes:[{revision:'1',operationResults:[],entities:[habit('Anterior')]}],nextCursor:'old-pull-cursor',hasMore:false,highWaterRevision:'1',serverTime:at});
  const pending=store.enqueue(command,id(4),at);
  const rejected=store.enqueue({...command,habitId:id(31),title:'Rejeitado'},id(6),at);
  store.applyAck([{receipt:{operationId:id(6),operationHash:operationHash(rejected),status:'rejected',error:{code:'habit_not_found',fields:[],dependencyIds:[]}},replayed:false}]);
  store.discard([id(6)]);
  const previous=store.view(day),history=store.recovery();
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    if(input.endsWith('/snapshots')) return Response.json(manifest(id(20),2));
    if(input.includes('/snapshots/')) return Response.json(page(id(20),[habit('Servidor'),habit('Canônico','2',command.habitId)]));
    if(input.endsWith('/receipts')) return Response.json({snapshotId:id(20),highWaterRevision:'2',results:[{operationId:id(4),operationHash:operationHash(pending),status:'accepted',acceptedRevision:'2'}]});
    return store.cursor()==='old-pull-cursor'?resync():idle();
  });
  try {
    fault.exec("CREATE TRIGGER fail_swap BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'test_swap_failure'); END");
    await assert.rejects(synchronize(store,api()),(error:unknown)=>error instanceof Error&&error.cause instanceof Error&&error.cause.message.includes('test_swap_failure'));
    assert.deepEqual(store.view(day),previous);assert.deepEqual(store.operations(),[pending]);assert.equal(store.cursor(),'old-pull-cursor');
    fault.exec('DROP TRIGGER fail_swap');
    store.close();store=openTestStore(path,id(1),id(2));
    assert.deepEqual(store.view(day),previous);assert.deepEqual(store.operations(),[pending]);assert.deepEqual(store.recovery(),history);
    await synchronize(store,api());
    assert.equal(store.view(day).pendingCount,0);assert.deepEqual(store.view(day).habits.map(h=>h.title).sort(),['Canônico','Servidor']);
    assert.equal(store.cursor(),'snapshot-pull-cursor');assert.deepEqual(store.recovery(),history);
    store.close();store=openTestStore(path,id(1),id(2));
    assert.equal(store.view(day).pendingCount,0);assert.equal(store.cursor(),'snapshot-pull-cursor');assert.deepEqual(store.recovery(),history);
  } finally {fault.close();store.close();rmSync(directory,{recursive:true,force:true});}
});

test('an onboarded account without a local copy starts an atomic snapshot and never exposes partial habits after failure',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'ritmo-initial-copy-')),path=join(directory,'account.db');let store=openTestStore(path,id(1),id(2)),failed=false;
 const profile:Entity={kind:'profile',value:{accountId:id(1),displayName:'Pessoa',timeContext:command.timeContext,plan:'free',onboardedAt:at,analyticsConsentAt:null,revision:'1'}};
 store.seedProfile(profile.value);
 let snapshots=0;
 t.mock.method(globalThis,'fetch',async(input:string)=>{
  if(input.endsWith('/snapshots')) {snapshots++;return Response.json(manifest(id(20),2));}
  if(input.includes('/snapshots/')) {
   if(input.endsWith('first-page-cursor')) return Response.json({...page(id(20),[habit('Cópia completa')]),complete:false,nextPageCursor:'second-page-cursor',pullCursor:null});
   assert.equal(store.snapshotProgress()?.staged,1);assert.equal(store.view(day).habits.length,0);
   if(!failed) {failed=true;throw new TypeError('interrupted');}
   return Response.json(page(id(20),[profile]));
  }
  assert.ok(snapshots>0,'initial copy must precede incremental pull');return idle();
 });
 try {
  await assert.rejects(synchronize(store,api()),/interrupted/);assert.equal(store.cursor(),null);assert.equal(store.view(day).habits.length,0);
  store.close();store=openTestStore(path,id(1),id(2));assert.equal(store.snapshotProgress()?.staged,1);
  await synchronize(store,api());assert.equal(store.view(day).habits[0]?.title,'Cópia completa');assert.equal(store.snapshotProgress(),null);
 } finally {store.close();rmSync(directory,{recursive:true,force:true});}
});


test('a nonempty interrupted copy preserves the old base and dependent XP across restart and a fresh manifest',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'ritmo-partial-chain-')),path=join(directory,'account.db');let store=openTestStore(path,id(1),id(2));
 store.applyPull({changes:[{revision:'1',operationResults:[],entities:[habit('Base anterior')]}],nextCursor:'old-pull-cursor',hasMore:false,highWaterRevision:'1',serverTime:at});
 const chain=[store.enqueue(command,id(4),at),store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(5),at)];
 assert.deepEqual(chain[1]!.dependsOn,[chain[0]!.operationId]);const previous=store.view(day);assert.equal(previous.totalXp,10);
 let copies=0,interrupted=true;const queried:string[][]=[];
 t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
  if(input.endsWith('/snapshots')) {copies++;return Response.json(manifest(id(20+copies),2));}
  if(input.includes('/snapshots/')) {
   if(input.endsWith('first-page-cursor')) {
    assert.equal(store.snapshotProgress()?.staged,0,'fresh manifest must replace old staging');
    return Response.json({...page(id(20+copies),[habit('Base nova')]),complete:false,nextPageCursor:'second-page-cursor',pullCursor:null});
   }
   assert.equal(store.snapshotProgress()?.staged,1);assert.deepEqual(store.operations(),chain);assert.deepEqual(store.view(day),previous);
   if(interrupted)throw new TypeError('page_two_interrupted');
   return Response.json(page(id(20+copies),[habit('Outro remoto','2',id(32))]));
  }
  if(input.endsWith('/receipts')) {
   const ids=(JSON.parse(String(init.body)) as {operationIds:string[]}).operationIds;queried.push(ids);
   return Response.json({snapshotId:id(20+copies),highWaterRevision:'2',results:ids.map(operationId=>({operationId,status:'notProcessedAtH'}))});
  }
  if(input.endsWith('/push')) {assert.equal(store.cursor(),'snapshot-pull-cursor');throw new TypeError('push_still_offline');}
  return store.cursor()==='old-pull-cursor'?resync():idle();
 });
 try {
  await assert.rejects(synchronize(store,api()),/page_two_interrupted/);assert.equal(store.snapshotProgress()?.staged,1);
  store.close();store=openTestStore(path,id(1),id(2));assert.equal(store.snapshotProgress()?.staged,1);assert.equal(store.cursor(),'old-pull-cursor');assert.deepEqual(store.operations(),chain);assert.deepEqual(store.view(day),previous);
  interrupted=false;await assert.rejects(synchronize(store,api()),/push_still_offline/);
  assert.equal(copies,2);assert.deepEqual(queried,[chain.map(op=>op.operationId)]);assert.equal(store.snapshotProgress(),null);assert.deepEqual(store.operations(),chain);
  assert.deepEqual(store.view(day).habits.map(h=>h.title).sort(),['Base nova','Caminhar','Outro remoto']);assert.equal(store.view(day).totalXp,10);
 } finally {store.close();rmSync(directory,{recursive:true,force:true});}
});
