import {operationHash} from '../../src/core/sync/operation-hash.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {fixture,id,command,at,day} from '../support/scheduler.ts';
const origin=process.env.RITMO_TEST_API;
assert.ok(origin,'RITMO_TEST_API must point to the disposable integration server');

test('snapshot before push preserves a divergent intent and its dependents across restart',async()=>{
  const f=fixture(),identity=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  await identity.register(email,'fixture-password','Identity',id(2));
  f.identity.login=(email,password,device)=>identity.login(email,password,device);
  f.identity.refresh=token=>identity.refresh(token);f.identity.revoke=token=>identity.revoke(token);
  await f.session.login(email,'fixture-password');
  let sequence=1000;
  const api=new HttpSync(origin,f.session.account().accountId,()=>f.session.accessToken(),()=>id(sequence++));
  try {
    const local=f.session.account().enqueue({...command,title:'Intenção local divergente'},id(10),at);
    await api.push([{...local,command}]);
    f.session.account().enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    await synchronize(f.session.account(),api);
    const recovery=f.session.account().recovery();
    assert.equal(recovery.length,2);
    assert.deepEqual(recovery[0]?.operation,local);
    assert.equal(recovery[0]?.error.code,'id_content_conflict');
    assert.equal(f.session.account().view(day).habits[0]?.title,command.title);
    assert.equal(f.session.account().view(day).totalXp,0);
    await f.restart();
    assert.deepEqual(f.session.account().recovery(),recovery);
  } finally {f.close();}
});

test('a sequence collision preserves the original receipt while independent work continues',async()=>{
  const f=fixture(),identity=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  await identity.register(email,'fixture-password','Sequence',id(2));
  f.identity.login=(email,password,device)=>identity.login(email,password,device);
  f.identity.refresh=token=>identity.refresh(token);f.identity.revoke=token=>identity.revoke(token);
  await f.session.login(email,'fixture-password');
  let sequence=2000;
  const api=new HttpSync(origin,f.session.account().accountId,()=>f.session.accessToken(),()=>id(sequence++));
  try {
    const local=f.session.account().enqueue({...command,title:'Local'},id(10),at);
    const original={...local,operationId:id(20),command};
    const accepted=await api.push([original]);
    const originalReceipt=accepted.results[0]&&'receipt' in accepted.results[0]?accepted.results[0].receipt:null;
    const attempted=await api.push([local]);f.session.account().applyAck(attempted.results);
    assert.equal(f.session.account().recovery()[0]?.error.identity?.reason,'sequence');
    const manifest=await api.snapshot(),page=await api.page(manifest.snapshotId,manifest.firstPageCursor);
    const receipts=await api.receipts(manifest.snapshotId,[original.operationId,local.operationId]);
    f.session.account().beginSnapshot(manifest.snapshotId,manifest.highWaterRevision,manifest.firstPageCursor,manifest.expiresAt);
    f.session.account().stageSnapshotPage(manifest.snapshotId,manifest.firstPageCursor,page.entities,page.nextPageCursor);
    f.session.account().installSnapshot(manifest.snapshotId,manifest.entityCount,receipts.results.filter((r):r is import('../../src/core/sync/protocol.ts').Receipt=>r.status!=='notProcessedAtH'),page.pullCursor!);
    assert.deepEqual(f.session.account().recovery()[0]?.error.identity?.originalReceipt,originalReceipt);
    assert.throws(()=>f.session.account().correct([{operationId:local.operationId,replacementId:id(30)}]),/operation_not_recoverable/);
    assert.throws(()=>f.session.account().discard([local.operationId]),/operation_not_recoverable/);
    f.session.account().enqueue({...command,habitId:id(40),title:'Independente'},id(41),at);
    await synchronize(f.session.account(),api);
    assert.equal(f.session.account().view(day).pendingCount,0);
    assert.ok(f.session.account().view(day).habits.some(h=>h.habitId===id(40)));
    const before=f.session.account().recovery();await f.restart();
    assert.deepEqual(f.session.account().recovery(),before);
    const replay=await api.push([original]);
    assert.deepEqual(replay.results[0]&&'receipt' in replay.results[0]?replay.results[0].receipt:null,originalReceipt);
  } finally {f.close();}
});

test('an operation collision in a batch blocks its entire dependent chain without spending XP',async()=>{
  const f=fixture(),identity=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  await identity.register(email,'fixture-password','Batch',id(2));
  f.identity.login=(email,password,device)=>identity.login(email,password,device);
  await f.session.login(email,'fixture-password');
  let sequence=3000;
  const api=new HttpSync(origin,f.session.account().accountId,()=>f.session.accessToken(),()=>id(sequence++));
  try {
    const parent=f.session.account().enqueue({...command,title:'Divergente'},id(10),at);
    const accepted=await api.push([{...parent,command}]);
    const child=f.session.account().enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    const grandchild=f.session.account().enqueue({type:'habit.unmark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext},id(12),at);
    const independent=f.session.account().enqueue({...command,habitId:id(40),title:'Independente'},id(13),at);
    const ack=await api.push([grandchild,independent,child,parent]);
    assert.equal(ack.results[0]&&'status' in ack.results[0]?ack.results[0].status:null,'deferred');
    assert.equal(ack.results[2]&&'status' in ack.results[2]?ack.results[2].status:null,'deferred');
    f.session.account().applyAck(ack.results);await synchronize(f.session.account(),api);
    const recovery=f.session.account().recovery();
    assert.deepEqual(recovery.map(r=>r.operation.operationId),[parent.operationId,child.operationId,grandchild.operationId]);
    assert.ok(recovery.slice(1).every(r=>r.error.code==='identity_dependency_unresolved'));
    assert.equal(f.session.account().view(day).totalXp,0);
    assert.throws(()=>f.session.account().discard([grandchild.operationId]),/operation_not_recoverable/);
    const manifest=await api.snapshot(),receipts=await api.receipts(manifest.snapshotId,[child.operationId,grandchild.operationId,parent.operationId]);
    assert.deepEqual(receipts.results.slice(0,2).map(r=>r.status),['notProcessedAtH','notProcessedAtH']);
    const replay=await api.push([{...parent,command}]);
    assert.deepEqual(replay.results[0]&&'receipt' in replay.results[0]?replay.results[0].receipt:null,
      accepted.results[0]&&'receipt' in accepted.results[0]?accepted.results[0].receipt:null);
  } finally {f.close();}
});

for(const deleted of [false,true]) test('a proven entity-id rejection remains correctable without resurrecting '+(deleted?'deleted':'existing')+' habits',async()=>{
  const f=fixture(),identity=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  await identity.register(email,'fixture-password','Entity',id(2));
  f.identity.login=(email,password,device)=>identity.login(email,password,device);
  await f.session.login(email,'fixture-password');
  let sequence=4000;
  const api=new HttpSync(origin,f.session.account().accountId,()=>f.session.accessToken(),()=>id(sequence++));
  try {
    const original={operationId:id(70),deviceId:id(99),clientSequence:1,occurredAt:at,dependsOn:[],command};
    await api.push([original]);
    if(deleted) await api.push([{...original,operationId:id(71),clientSequence:2,command:{type:'habit.delete',habitId:command.habitId}}]);
    const parent=f.session.account().enqueue({...command,title:'Nova intenção'},id(10),at);
    f.session.account().enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    await synchronize(f.session.account(),api);
    const rejected=f.session.account().recovery()[0];
    assert.equal(rejected?.source,'server');assert.equal(rejected?.error.code,'id_content_conflict');
    assert.equal(rejected?.error.identity,undefined);
    f.session.account().correct([{operationId:parent.operationId,replacementId:id(20),command:{...command,habitId:id(40),title:'Corrigido'}},
      {operationId:id(11),replacementId:id(21)}]);
    await synchronize(f.session.account(),api);
    assert.equal(f.session.account().view(day).totalXp,10);
    assert.equal(f.session.account().view(day).habits.some(h=>h.habitId===command.habitId),!deleted);
    assert.equal(f.session.account().view(day).habits.find(h=>h.habitId===id(40))?.done,true);
    const old=await api.push([parent]);f.session.account().applyAck(old.results);
    assert.equal(f.session.account().recovery()[0]?.resolution?.kind,'corrected');
    assert.equal(f.session.account().view(day).totalXp,10);
  } finally {f.close();}
});

test('pull before push compares the raw envelope hash even when business text is normalized',async()=>{
  const f=fixture(),identity=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  await identity.register(email,'fixture-password','Pull',id(2));
  f.identity.login=(email,password,device)=>identity.login(email,password,device);
  await f.session.login(email,'fixture-password');
  let sequence=5000;
  const api=new HttpSync(origin,f.session.account().accountId,()=>f.session.accessToken(),()=>id(sequence++));
  try {
    await synchronize(f.session.account(),api);
    const local=f.session.account().enqueue({...command,title:'  Café 😀  '},id(10),at);
    const original={...local,command:{...command,title:'  Cafe\u0301 😀  '}};
    const accepted=await api.push([original]);
    await synchronize(f.session.account(),api);
    assert.equal(f.session.account().recovery()[0]?.error.identity?.reason,'content_mismatch');
    assert.deepEqual(f.session.account().recovery()[0]?.operation,local);
    assert.equal(f.session.account().view(day).habits[0]?.title,'Café 😀');
    const originalReceipt=accepted.results[0]&&'receipt' in accepted.results[0]?accepted.results[0].receipt:null;
    assert.deepEqual(f.session.account().recovery()[0]?.error.identity?.originalReceipt,originalReceipt);
    // Equal normalized business text still means two different immutable wire envelopes.
    assert.notEqual(originalReceipt?.operationHash,operationHash(local));
    const exact=f.session.account().enqueue({...command,habitId:id(40),title:'  Água 😀  '},id(11),at);
    await synchronize(f.session.account(),api);
    assert.equal(f.session.account().view(day).habits.find(h=>h.habitId===id(40))?.title,'Água 😀');
    assert.equal(f.session.account().recovery().some(r=>r.operation.operationId===exact.operationId),false);
    const replay=await api.push([exact]);
    assert.equal(replay.results[0]&&'receipt' in replay.results[0]?replay.results[0].receipt.operationHash:null,operationHash(exact));
  } finally {f.close();}
});
