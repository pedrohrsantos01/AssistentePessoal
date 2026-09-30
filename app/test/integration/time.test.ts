import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {openTestStore} from '../support/store.ts';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import type {TimeContext} from '../../src/core/sync/protocol.ts';
import {logicalDays} from '../support/logical-days.ts';
import {getDayKey} from '../../src/features/gamification/domain/day-key.ts';

const id=()=>{const parts=randomUUID().split('-');parts[2]='7'+parts[2]!.slice(1);return parts.join('-');};
const root=process.env.RITMO_TEST_API;
assert.ok(root,'RITMO_TEST_API must point to the disposable integration server');
async function clients(t:TestContext) {
  const email=id()+'@example.test',deviceA=id(),deviceB=id(),habitId=id(),identity=new HttpIdentity(root!);
  const first=await identity.register(email,'fixture-password','Pessoa',deviceA);
  const second=await identity.login(email,'fixture-password',deviceB);
  const directory=mkdtempSync(join(tmpdir(),'ritmo-time-http-'));
  let a=openTestStore(join(directory,'a.db'),first.accountId,deviceA);
  let b=openTestStore(join(directory,'b.db'),second.accountId,deviceB);
  const apiA=new HttpSync(root!,first.accountId,()=>first.accessToken,id);
  const apiB=new HttpSync(root!,second.accountId,()=>second.accessToken,id);
  t.after(()=>{a.close();b.close();rmSync(directory,{recursive:true,force:true});});
  async function canonical() {
    const manifest=await apiA.snapshot(),page=await apiA.page(manifest.snapshotId,manifest.firstPageCursor);
    assert.equal(page.complete,true);return page.entities;
  }
  async function create(at:string,timeContext:TimeContext) {
    a.enqueue({type:'profile.setOnboarding',timeContext,completed:true,analyticsConsent:false},id(),at);
    a.enqueue({type:'habit.create',habitId,title:'Meditar',habitType:'binary',scheduleKind:'daily',
      startDayKey:getDayKey(new Date(at),timeContext.timezone,timeContext.dayStartHour),timeContext,
      iconKey:null,colorToken:null,sortOrder:0},id(),at);
    await synchronize(a,apiA);await synchronize(b,apiB);
    assert.equal(a.view('2026-11-03').rejectedCount,0);
  }
  return {get a(){return a;},get b(){return b;},apiA,apiB,habitId,canonical,create,
    reopen(){a.close();b.close();a=openTestStore(join(directory,'a.db'),first.accountId,deviceA);
      b=openTestStore(join(directory,'b.db'),second.accountId,deviceB);}};
}

test('M1-12: a missing Chatham boundary is the first valid instant in SQLite and the real API',async t=>{
  const f=await clients(t),timeContext={timezone:'Pacific/Chatham',dayStartHour:3},at='2026-09-26T14:05:00Z';
  assert.equal(getDayKey(new Date(at),timeContext.timezone,timeContext.dayStartHour),'2026-09-27');
  await f.create(at,timeContext);
  f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-09-27',timeContext,observedUndoIds:[]},id(),at);
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  assert.deepEqual(f.b.view('2026-09-27'),{habits:[{habitId:f.habitId,title:'Meditar',done:true}],
    totalXp:10,pendingCount:0,rejectedCount:0});
});


test('M1-12: exactly 24 hours ahead is accepted using the server clock boundary',async t=>{
  assert.equal(process.env.RITMO_TEST_SERVER_TIME,'2026-11-03T12:00:00Z');
  const f=await clients(t),timeContext={timezone:'UTC',dayStartHour:0};
  await f.create('2026-09-25T13:00:00Z',timeContext);
  f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-11-04',timeContext,observedUndoIds:[]},id(),'2026-11-04T12:00:00Z');
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  assert.deepEqual(f.b.view('2026-11-04'),{habits:[{habitId:f.habitId,title:'Meditar',done:true}],
    totalXp:10,pendingCount:0,rejectedCount:0});
  assert.equal(f.a.view('2026-11-04').rejectedCount,0);
});


test('M1-12: a context switch cannot grant XP two days ahead of the current server profile',async t=>{
  const f=await clients(t),profile={timezone:'UTC',dayStartHour:0};
  await f.create('2026-09-25T13:00:00Z',profile);
  const timeContext={timezone:'Pacific/Kiritimati',dayStartHour:0};
  const operation=f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-11-05',timeContext,observedUndoIds:[]},id(),'2026-11-04T12:00:00Z');
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  assert.equal(f.a.recovery()[0]?.error.code,'day_invalid');
  assert.deepEqual(f.a.recovery()[0]?.operation,operation);
  assert.equal(f.b.view('2026-11-05').totalXp,0);
  assert.equal((await f.canonical()).filter(entity=>entity.kind==='habitDay'||entity.kind==='xpGrant'||entity.kind==='xpBudget').length,0);
});


test('M1-12: two weeks offline and a timezone change preserve old and new action days',async t=>{
  const f=await clients(t),oldContext={timezone:'America/Sao_Paulo',dayStartHour:4};
  const nextContext={timezone:'UTC',dayStartHour:0},at='2026-10-20T06:30:00Z';
  assert.equal(process.env.RITMO_TEST_SERVER_TIME,'2026-11-03T12:00:00Z');
  await f.create('2026-10-19T13:00:00Z',oldContext);
  assert.equal(getDayKey(new Date(at),oldContext.timezone,oldContext.dayStartHour),'2026-10-19');
  const oldMark=f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-10-19',timeContext:oldContext,observedUndoIds:[]},id(),at);
  f.b.enqueue({type:'profile.setOnboarding',timeContext:nextContext,completed:true,analyticsConsent:false},id(),at);
  await synchronize(f.b,f.apiB); // A has not incorporated B's profile change.
  f.a.enqueue({type:'profile.setOnboarding',timeContext:nextContext,completed:true,analyticsConsent:false},id(),at);
  assert.equal(getDayKey(new Date(at),nextContext.timezone,nextContext.dayStartHour),'2026-10-20');
  const newMark=f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-10-20',timeContext:nextContext,observedUndoIds:[]},id(),at);
  const pending=f.a.operations();
  assert.equal(f.a.view('2026-10-19').totalXp,20);
  f.reopen();assert.deepEqual(f.a.operations(),pending);
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  for(const day of ['2026-10-19','2026-10-20']) {
    const expected={habits:[{habitId:f.habitId,title:'Meditar',done:true}],totalXp:20,pendingCount:0,rejectedCount:0};
    assert.deepEqual(f.a.view(day),expected);assert.deepEqual(f.b.view(day),expected);
  }
  const canonical=await f.canonical();
  assert.deepEqual(canonical.flatMap(entity=>entity.kind==='xpGrant'?[{day:entity.value.dayKey,amount:entity.value.amount,active:entity.value.active}]:[])
    .sort((a,b)=>a.day.localeCompare(b.day)),[{day:'2026-10-19',amount:10,active:true},{day:'2026-10-20',amount:10,active:true}]);
  assert.deepEqual(canonical.flatMap(entity=>entity.kind==='xpBudget'?[{day:entity.value.dayKey,consumed:entity.value.consumed}]:[])
    .sort((a,b)=>a.day.localeCompare(b.day)),[{day:'2026-10-19',consumed:10},{day:'2026-10-20',consumed:10}]);
  assert.deepEqual(canonical.flatMap(entity=>entity.kind==='profile'?[entity.value.timeContext]:[]),[nextContext]);
  const replay=await f.apiA.push([oldMark,newMark]);
  for(const result of replay.results) {assert.ok('receipt' in result);assert.equal(result.replayed,true);assert.equal(result.receipt.status,'accepted');}
  f.a.applyAck(replay.results);assert.equal(f.a.view('2026-10-19').totalXp,20);
});


for(const example of logicalDays) test('M1-12: client and API agree on '+example.name,async t=>{
  const f=await clients(t),timeContext={timezone:example.timezone,dayStartHour:example.hour};
  assert.equal(getDayKey(new Date(example.at),timeContext.timezone,timeContext.dayStartHour),example.expected);
  await f.create(example.at,timeContext);
  assert.equal(f.a.view(example.expected).habits[0]?.done,false);
  f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:example.expected,timeContext,observedUndoIds:[]},id(),example.at);
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  assert.deepEqual(f.b.view(example.expected),{habits:[{habitId:f.habitId,title:'Meditar',done:true}],totalXp:10,pendingCount:0,rejectedCount:0});
  assert.equal(f.a.view(example.expected).rejectedCount,0);
  const entities=await f.canonical();
  assert.deepEqual(entities.flatMap(entity=>entity.kind==='xpGrant'?[{day:entity.value.dayKey,amount:entity.value.amount}]:[]),[{day:example.expected,amount:10}]);
  assert.deepEqual(entities.flatMap(entity=>entity.kind==='xpBudget'?[{day:entity.value.dayKey,consumed:entity.value.consumed}]:[]),[{day:example.expected,consumed:10}]);
});

test('M1-12: an offline start-hour change preserves both captured days across reopening',async t=>{
  const f=await clients(t),oldContext={timezone:'UTC',dayStartHour:0},nextContext={timezone:'UTC',dayStartHour:12};
  const at='2026-10-20T06:30:00Z';
  await f.create('2026-10-18T13:00:00Z',oldContext);
  assert.equal(getDayKey(new Date(at),oldContext.timezone,oldContext.dayStartHour),'2026-10-20');
  f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-10-20',timeContext:oldContext,observedUndoIds:[]},id(),at);
  f.a.enqueue({type:'profile.setOnboarding',timeContext:nextContext,completed:true,analyticsConsent:false},id(),at);
  assert.equal(getDayKey(new Date(at),nextContext.timezone,nextContext.dayStartHour),'2026-10-19');
  f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-10-19',timeContext:nextContext,observedUndoIds:[]},id(),at);
  const original=f.a.operations();f.reopen();assert.deepEqual(f.a.operations(),original);
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  for(const day of ['2026-10-19','2026-10-20']) {
    assert.equal(f.b.view(day).habits[0]?.done,true);assert.equal(f.b.view(day).totalXp,20);
  }
  assert.equal(f.a.view('2026-10-20').rejectedCount,0);
  assert.deepEqual((await f.canonical()).flatMap(entity=>entity.kind==='profile'?[entity.value.timeContext]:[]),[nextContext]);
});

for(const example of [
  {name:'a new retroactive record eight days back',at:'2026-10-20T12:00:00Z',day:'2026-10-12'},
  {name:'a record before the habit start',at:'2026-09-25T13:00:00Z',day:'2026-09-24'},
  {name:'a target after the captured operation day',at:'2026-10-20T12:00:00Z',day:'2026-10-21'},
  {name:'a clock 24 hours and one millisecond ahead',at:'2026-11-04T12:00:00.001Z',day:'2026-11-04'}
]) test('M1-12: rejects '+example.name+' without losing the intention',async t=>{
  const f=await clients(t),timeContext={timezone:'UTC',dayStartHour:0};
  await f.create('2026-09-25T13:00:00Z',timeContext);
  const original=f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:example.day,timeContext,observedUndoIds:[]},id(),example.at);
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  assert.equal(f.a.recovery()[0]?.error.code,'day_invalid');
  f.reopen();assert.deepEqual(f.a.recovery()[0]?.operation,original);
  assert.equal(f.a.view(example.day).pendingCount,0);assert.equal(f.a.view(example.day).rejectedCount,1);
  assert.equal(f.a.view(example.day).totalXp,0);assert.equal(f.b.view(example.day).totalXp,0);
  assert.equal((await f.canonical()).filter(entity=>entity.kind==='habitDay'||entity.kind==='xpGrant'||entity.kind==='xpBudget').length,0);
  const before=await f.apiA.snapshot(),replay=await f.apiA.push([original]),result=replay.results[0];
  assert.ok(result&&'receipt' in result&&result.receipt.status==='rejected');
  assert.equal(result.replayed,true);assert.equal(result.receipt.error.code,'day_invalid');
  assert.equal((await f.apiA.snapshot()).highWaterRevision,before.highWaterRevision);
});

test('M1-12: a seven-day retroactive record sent two weeks later consumes the destination budget',async t=>{
  const f=await clients(t),timeContext={timezone:'UTC',dayStartHour:0};
  await f.create('2026-09-25T13:00:00Z',timeContext);
  const original=f.a.enqueue({type:'habit.mark',habitId:f.habitId,dayKey:'2026-10-13',timeContext,observedUndoIds:[]},id(),'2026-10-20T12:00:00Z');
  f.reopen();assert.deepEqual(f.a.operations(),[original]);
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  assert.equal(f.a.view('2026-10-13').rejectedCount,0);assert.equal(f.b.view('2026-10-13').habits[0]?.done,true);
  assert.equal(f.b.view('2026-10-13').totalXp,10);
  assert.deepEqual((await f.canonical()).flatMap(entity=>entity.kind==='xpBudget'?[{day:entity.value.dayKey,consumed:entity.value.consumed}]:[]),[{day:'2026-10-13',consumed:10}]);
});

test('M1-12: habit creation also rejects a start day beyond the server profile limit',async t=>{
  const f=await clients(t),profile={timezone:'UTC',dayStartHour:0};
  await f.create('2026-09-25T13:00:00Z',profile);
  const timeContext={timezone:'Pacific/Kiritimati',dayStartHour:0};
  const original=f.a.enqueue({type:'habit.create',habitId:id(),title:'Outra intenção',habitType:'binary',scheduleKind:'daily',startDayKey:'2026-11-05',
    timeContext,iconKey:null,colorToken:null,sortOrder:0},id(),'2026-11-04T12:00:00Z');
  await synchronize(f.a,f.apiA);await synchronize(f.b,f.apiB);
  assert.equal(f.a.recovery()[0]?.error.code,'day_invalid');assert.deepEqual(f.a.recovery()[0]?.operation,original);
  assert.deepEqual(f.b.view('2026-11-05').habits,[{habitId:f.habitId,title:'Meditar',done:false}]);
  assert.equal((await f.canonical()).filter(entity=>entity.kind==='habit').length,1);
});
