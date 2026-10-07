import SQLite from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {HttpSync,synchronize} from '../src/core/sync/synchronize.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestStore} from './support/store.ts';
import {operationHash} from '../src/core/sync/operation-hash.ts';
import {id,command,at,day} from './support/scheduler.ts';
test('missing proof blocks related work but matching later proof releases the same identities',()=>{
  const store=openTestStore(':memory:',id(1),id(2));
  try {
    const parent=store.enqueue(command,id(10),at);
    const child=store.enqueue({type:'habit.patchMetadata',habitId:command.habitId,patch:{title:'Depois'}},id(11),at);
    store.applyAck([{receipt:{operationId:parent.operationId,status:'accepted',acceptedRevision:'1'},replayed:false}]);
    assert.equal(store.recovery()[0]?.error.identity?.reason,'missing_proof');
    assert.throws(()=>store.discard([child.operationId]),/operation_not_recoverable/);
    assert.throws(()=>store.correct([{operationId:child.operationId,replacementId:id(20)}]),/operation_not_recoverable/);
    const related=store.enqueue({type:'habit.delete',habitId:command.habitId},id(12),at);
    assert.ok(related.dependsOn.includes(parent.operationId));
    const independent=store.enqueue({...command,habitId:id(30),title:'Independente'},id(13),at);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[independent]);
    store.applyAck([{receipt:{operationId:parent.operationId,operationHash:operationHash(parent),status:'accepted',acceptedRevision:'1'},replayed:true}]);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[child,related,independent]);
    assert.deepEqual(store.recovery(),[]);
    assert.equal(store.view(day).totalXp,0);
  } finally {store.close();}
});

test('an unproven delayed response cannot replace an already proven receipt or reopen its dependents',()=>{
  const store=openTestStore(':memory:',id(1),id(2));
  try {
    const parent=store.enqueue(command,id(10),at);
    const receipt={operationId:parent.operationId,operationHash:operationHash(parent),status:'accepted' as const,acceptedRevision:'1'};
    store.applyAck([{receipt,replayed:false}]);
    const child=store.enqueue({type:'habit.delete',habitId:command.habitId},id(11),at);
    store.applyAck([{receipt:{operationId:parent.operationId,status:'accepted',acceptedRevision:'1'},replayed:true}]);
    assert.deepEqual(store.recovery(),[]);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[child]);
  } finally {store.close();}
});

test('synchronization consults the original receipt after a newly discovered identity collision',async t=>{
  const store=openTestStore(':memory:',id(1),id(2));
  let pushed=false,consulted=false;
  const local=store.enqueue(command,id(10),at),original={...local,operationId:id(20),command:{...command,title:'Original'}};
  const receipt={operationId:original.operationId,operationHash:operationHash(original),status:'accepted' as const,acceptedRevision:'1'};
  const api=new HttpSync('https://sync.test',id(1),()=> 'fixture-token',()=>id(99));
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(input.endsWith('/push')) {
      pushed=true;
      return Response.json({results:[{replayed:false,receipt:{operationId:local.operationId,operationHash:operationHash(local),status:'rejected',
        error:{code:'id_content_conflict',fields:[],dependencyIds:[],identityConflict:{kind:'sequence',originalOperationId:original.operationId,originalOperationHash:receipt.operationHash}}}}],serverTime:at});
    }
    if(input.endsWith('/snapshots')) return Response.json({snapshotId:id(50),highWaterRevision:'1',expiresAt:'2099-01-01T00:00:00Z',entityCount:0,firstPageCursor:'first-page-cursor'});
    if(input.includes('/snapshots/')) return Response.json({snapshotId:id(50),highWaterRevision:'1',entities:[],complete:true,nextPageCursor:null,pullCursor:'after-snapshot-cursor'});
    if(input.endsWith('/receipts')) {
      const request=JSON.parse(String(init.body)) as {operationIds:string[]};
      assert.equal(pushed,true);assert.ok(request.operationIds.includes(original.operationId));consulted=true;
      return Response.json({snapshotId:id(50),highWaterRevision:'1',results:request.operationIds.map(operationId=>operationId===original.operationId?receipt:{operationId,status:'notProcessedAtH'})});
    }
    return Response.json({changes:[],nextCursor:'initial-pull-cursor',hasMore:false,highWaterRevision:'1',serverTime:at});
  });
  try {
    await synchronize(store,api);
    assert.equal(consulted,true);
    assert.deepEqual(store.recovery()[0]?.error.identity?.originalReceipt,receipt);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[]);
  } finally {store.close();}
});

test('opening history written by the previous client preserves unproven receipts and blocks their dependents',()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-legacy-proof-')),path=join(directory,'account.db');
  let store=openTestStore(path,id(1),id(2));
  try {
    const parent=store.enqueue(command,id(10),at);
    const child=store.enqueue({type:'habit.delete',habitId:command.habitId},id(11),at);
    store.close();
    const legacy=new SQLite(path);
    try {
      legacy.prepare("update sync_mutations set status='acknowledged',result=? where operation_id=?").run(
        JSON.stringify({operationId:parent.operationId,status:'accepted',acceptedRevision:'1'}),parent.operationId);
    } finally {legacy.close();}
    store=openTestStore(path,id(1),id(2));
    assert.equal(store.recovery()[0]?.error.identity?.reason,'missing_proof');
    assert.deepEqual(store.recovery().map(r=>r.operation),[parent,child]);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[]);
    assert.throws(()=>store.discard([parent.operationId]),/operation_not_recoverable/);
    store.applyAck([{receipt:{operationId:parent.operationId,operationHash:operationHash(parent),status:'accepted',acceptedRevision:'1'},replayed:true}]);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[child]);
  } finally {store.close();rmSync(directory,{recursive:true,force:true});}
});

test('a preserved retry deadline survives identity recovery',()=>{
  const store=openTestStore(':memory:',id(1),id(2));
  try {
    const parent=store.enqueue(command,id(10),at);
    const child=store.enqueue({type:'habit.delete',habitId:command.habitId},id(11),at);
    store.beginAttempt([child],Date.parse(at));store.retryLater([child],new TypeError('offline'),Date.parse(at));
    const deadline=store.retryState().nextAttemptAt!;
    store.applyAck([{receipt:{operationId:parent.operationId,status:'accepted',acceptedRevision:'1'},replayed:false}]);
    store.applyAck([{receipt:{operationId:parent.operationId,operationHash:operationHash(parent),status:'accepted',acceptedRevision:'1'},replayed:true}]);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[]);
    assert.deepEqual(store.readyOperations(deadline),[child]);
  } finally {store.close();}
});

test('the original receipt after an operation conflict preserves both pieces of evidence and the conflict classification',()=>{
  const store=openTestStore(':memory:',id(1),id(2));
  try {
    const local=store.enqueue(command,id(10),at),original={...local,command:{...command,title:'Servidor'}};
    const receipt={operationId:original.operationId,operationHash:operationHash(original),status:'accepted' as const,acceptedRevision:'1'};
    const conflict={operationId:local.operationId,operationHash:operationHash(local),status:'rejected' as const,
      error:{code:'id_content_conflict',fields:[],dependencyIds:[],identityConflict:{kind:'operation' as const,originalOperationId:original.operationId,originalOperationHash:receipt.operationHash}}};
    store.applyAck([{receipt:conflict,replayed:false}]);
    store.applyPull({changes:[{revision:'1',operationResults:[receipt],entities:[]}],nextCursor:'after-original-cursor',hasMore:false,highWaterRevision:'1',serverTime:at});
    const identity=store.recovery()[0]?.error.identity;
    assert.equal(identity?.reason,'operation');
    assert.deepEqual(identity?.originalReceipt,receipt);
    assert.deepEqual(identity?.conflictReceipt,conflict);
    assert.deepEqual(store.readyOperations(Date.parse(at)),[]);
  } finally {store.close();}
});
