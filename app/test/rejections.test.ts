import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id,command,at,day,pull,acceptedCreate} from './support/scheduler.ts';
import type {Receipt} from '../src/core/sync/protocol.ts';
const rejection=(operationId:string,code='title_unavailable'):Receipt=>({operationId,status:'rejected',error:{code,fields:[],dependencyIds:[]}});

test('a rejected creation keeps its content and blocks dependent intentions across restart',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account(),created=store.enqueue(command,id(10),at);
    const marked=store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    store.applyAck([{receipt:rejection(id(10)),replayed:false}]);
    await f.restart();const reopened=f.session.account();
    assert.deepEqual(reopened.readyOperations(Date.parse(at)),[]);
    assert.equal(reopened.view(day).totalXp,0);assert.deepEqual(reopened.view(day).habits,[]);
    assert.deepEqual(reopened.recovery().map(item=>({operation:item.operation,code:item.error.code,dependencies:item.error.dependencyIds,resolution:item.resolution})),[
      {operation:created,code:'title_unavailable',dependencies:[],resolution:null},
      {operation:marked,code:'dependency_rejected',dependencies:[id(10)],resolution:null},
    ]);
  } finally {f.close();}
});


test('correcting a rejected chain remaps dependencies and undo context atomically without rewriting old envelopes',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account();
    const mark={type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]} as const;
    const originals=[store.enqueue(command,id(10),at),store.enqueue({...mark,observedUndoIds:[]},id(11),at),
      store.enqueue({type:'habit.unmark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext},id(12),at),
      store.enqueue({...mark,observedUndoIds:[id(12)]},id(13),at)];
    store.applyAck([{receipt:rejection(id(10)),replayed:false}]);
    const replacements=store.correct([
      {operationId:id(10),replacementId:id(20),command:{...command,title:'Caminhar cedo'}},
      {operationId:id(11),replacementId:id(21)}, {operationId:id(12),replacementId:id(22)}, {operationId:id(13),replacementId:id(23)},
    ]);
    assert.deepEqual(replacements.map(op=>[op.operationId,op.supersedesOperationId,op.clientSequence,op.occurredAt]),[
      [id(20),id(10),5,at],[id(21),id(11),6,at],[id(22),id(12),7,at],[id(23),id(13),8,at],
    ]);
    assert.deepEqual(replacements[3]?.dependsOn,[id(20),id(21),id(22)]);
    assert.deepEqual(replacements[3]?.command,{...mark,observedUndoIds:[id(22)]});
    assert.deepEqual(store.recovery().map(item=>item.operation),originals);
    assert.deepEqual(store.recovery().map(item=>item.resolution),[20,21,22,23].map(n=>({kind:'corrected',replacementOperationId:id(n)})));
    await f.restart();assert.deepEqual(f.session.account().operations(),replacements);
    assert.equal(f.session.account().view(day).rejectedCount,0);
    assert.equal(f.session.account().view(day).habits[0]?.title,'Caminhar cedo');assert.equal(f.session.account().view(day).totalXp,10);
  } finally {f.close();}
});


test('discarding only the parent preserves its blocked children and a replayed rejection cannot reopen it',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account();store.enqueue(command,id(10),at);
    const marked=store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    store.applyAck([{receipt:rejection(id(10)),replayed:false}]);store.discard([id(10)]);
    store.applyAck([{receipt:rejection(id(10)),replayed:true}]);await f.restart();
    const items=f.session.account().recovery();assert.equal(items.length,2);
    assert.deepEqual(items[0]?.resolution,{kind:'discarded'});assert.equal(items[1]?.resolution,null);
    assert.deepEqual(items[1]?.operation,marked);assert.deepEqual(f.session.account().readyOperations(Date.parse(at)),[]);
    f.session.account().discard([id(11)]);assert.ok(f.session.account().recovery().every(item=>item.resolution?.kind==='discarded'));
  } finally {f.close();}
});


test('excessive undo context is recoverable locally with every reference intact and never sent',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account();store.enqueue(command,id(10),at);
    const observedUndoIds=Array.from({length:4097},(_,i)=>id(10000+i));
    const operation=store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds},id(11),at);
    assert.deepEqual(store.readyOperations(Date.parse(at)).map(op=>op.operationId),[id(10)]);
    assert.equal(store.view(day).totalXp,0);
    const item=store.recovery()[0];assert.equal(item?.error.code,'context_limit_reached');assert.deepEqual(item?.operation,operation);
    await f.restart();assert.deepEqual(f.session.account().recovery()[0]?.operation.command,operation.command);
    const replacement=f.session.account().correct([{operationId:id(11),replacementId:id(21)}])[0];
    assert.deepEqual(replacement?.command,operation.command);
    assert.equal(f.session.account().recovery().find(item=>item.operation.operationId===id(21))?.error.code,'context_limit_reached');
  } finally {f.close();}
});


test('a child corrected later follows the replacement habit and a failed correction leaves no partial chain',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account();store.enqueue(command,id(10),at);
    store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    store.applyAck([{receipt:rejection(id(10)),replayed:false}]);
    assert.throws(()=>store.correct([{operationId:id(10),replacementId:id(20),command:{...command,habitId:id(30)}},
      {operationId:id(11),replacementId:id(21),command}]),/correction_type_mismatch/);
    assert.ok(store.recovery().every(item=>item.resolution===null));assert.deepEqual(store.operations(),[]);
    const parent=store.correct([{operationId:id(10),replacementId:id(20),command:{...command,habitId:id(30)}}])[0];
    assert.equal(parent?.clientSequence,3);assert.equal(store.recovery()[1]?.resolution,null);
    await f.restart();const child=f.session.account().correct([{operationId:id(11),replacementId:id(21)}])[0];
    assert.deepEqual(child?.dependsOn,[id(20)]);
    assert.equal(child?.command.type==='habit.mark'?child.command.habitId:null,id(30));
    assert.deepEqual(f.session.account().view(day).habits,[{habitId:id(30),title:'Caminhar',done:true}]);
    assert.equal(f.session.account().view(day).totalXp,10);
  } finally {f.close();}
});


test('a rejection in the first batch prevents later blocked children from being sent',async t=>{
  const f=fixture();await f.session.login('a','fixture-password');const sent:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{
    if(!String(url).endsWith('/push')) return pull('cursor-rejection-batch');
    const body=JSON.parse(String(init?.body)) as {operations:{operationId:string}[]};
    sent.push(...body.operations.map(op=>op.operationId));
    return Response.json({results:body.operations.map(op=>({receipt:rejection(op.operationId,op.operationId===id(10)?'title_unavailable':'dependency_rejected'),replayed:false})),serverTime:at});
  });
  try {
    const store=f.session.account();store.enqueue(command,id(10),at);
    for(let n=11;n<=60;n++) store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(n),at);
    await f.session.synchronize('https://api.example.test');
    assert.equal(sent.length,50);assert.equal(sent.includes(id(60)),false);
    assert.equal(store.recovery().find(item=>item.operation.operationId===id(60))?.source,'local');
    assert.equal(store.view(day).totalXp,0);
  } finally {f.close();}
});


test('correction cannot truncate an oversized context to bypass the protocol limit',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account(),observedUndoIds=Array.from({length:4097},(_,i)=>id(10000+i));
    const mark={type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds} as const;
    store.enqueue(mark,id(11),at);
    assert.throws(()=>store.correct([{operationId:id(11),replacementId:id(21),command:{...mark,observedUndoIds:observedUndoIds.slice(0,4096)}}]),/context_truncation_forbidden/);
    assert.equal(store.recovery()[0]?.resolution,null);assert.deepEqual(store.recovery()[0]?.operation.command,mark);
  } finally {f.close();}
});


test('recovery refuses uncertain outcomes and another account cannot read or change a rejected intention',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const a=f.session.account(),pending=a.enqueue(command,id(10),at);
    assert.throws(()=>a.correct([{operationId:id(10),replacementId:id(20)}]),/operation_not_recoverable/);
    assert.throws(()=>a.discard([id(10)]),/operation_not_recoverable/);
    assert.deepEqual(a.operations(),[pending]);a.applyAck([{receipt:rejection(id(10)),replayed:false}]);
    await f.session.logout();await f.session.login('b','fixture-password');
    assert.throws(()=>a.recovery(),/session_locked/);assert.throws(()=>a.discard([id(10)]),/session_locked/);
    assert.throws(()=>a.correct([{operationId:id(10),replacementId:id(20)}]),/session_locked/);
    assert.deepEqual(f.session.account().recovery(),[]);
    assert.throws(()=>f.session.account().correct([{operationId:id(10),replacementId:id(20)}]),/operation_not_recoverable/);
    await f.session.logout();await f.session.login('a','fixture-password');
    assert.deepEqual(f.session.account().recovery()[0]?.operation,pending);
    assert.equal(f.session.account().recovery()[0]?.resolution,null);
  } finally {f.close();}
});


test('a correction that observes a new local undo must wait for that undo before sending',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account();store.enqueue(command,id(10),at);
    const accepted=await acceptedCreate(id(10)).json() as {results:import('../src/core/sync/protocol.ts').PushResult[]};store.applyAck(accepted.results);
    const mark={type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]} as const;
    store.enqueue({...mark,observedUndoIds:[]},id(11),at);store.applyAck([{receipt:rejection(id(11),'day_invalid'),replayed:false}]);
    const undo=store.enqueue({type:'habit.unmark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext},id(12),at);
    store.beginAttempt([undo],Date.parse(at));store.retryLater([undo],new TypeError('offline'),Date.parse(at));
    const corrected=store.correct([{operationId:id(11),replacementId:id(21),command:{...mark,observedUndoIds:[id(12)]}}])[0];
    assert.deepEqual(corrected?.dependsOn,[id(12)]);assert.deepEqual(store.readyOperations(Date.parse(at)),[]);
  } finally {f.close();}
});


test('a proposed correction cannot create a cycle between a marking and its dependent undo',async()=>{
  const f=fixture();await f.session.login('a','fixture-password');
  try {
    const store=f.session.account(),mark={type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]} as const;
    store.enqueue(command,id(10),at);store.enqueue({...mark,observedUndoIds:[]},id(11),at);
    store.enqueue({type:'habit.unmark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext},id(12),at);
    store.applyAck([{receipt:rejection(id(10)),replayed:false}]);
    assert.throws(()=>store.correct([{operationId:id(10),replacementId:id(20)},
      {operationId:id(11),replacementId:id(21),command:{...mark,observedUndoIds:[id(12)]}},
      {operationId:id(12),replacementId:id(22)}]),/dependency_cycle/);
    await f.restart();assert.ok(f.session.account().recovery().every(item=>item.resolution===null));
    assert.deepEqual(f.session.account().operations(),[]);
  } finally {f.close();}
});
