import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import type {CreateHabit,Entity,PushResult} from '../../src/core/sync/protocol.ts';
const root=process.env.RITMO_TEST_API;
assert.ok(root,'RITMO_TEST_API must point to the disposable integration server');
const id=()=>{const parts=randomUUID().split('-');parts[2]='7'+parts[2]!.slice(1);return parts.join('-');};
const at='2026-09-30T12:00:00Z',day='2026-09-30',context={timezone:'UTC',dayStartHour:0};
const create=(habitId:string,title='Caminhar'):CreateHabit=>({type:'habit.create',habitId,title,habitType:'binary',scheduleKind:'daily',
  startDayKey:day,timeContext:context,iconKey:null,colorToken:null,sortOrder:0});
async function entities(api:HttpSync) {
  const manifest=await api.snapshot();let cursor:string|null=manifest.firstPageCursor;const all:Entity[]=[];
  while(cursor) {const page=await api.page(manifest.snapshotId,cursor);all.push(...page.entities);cursor=page.nextPageCursor;}
  return all;
}

test('offline deletion survives restart and lost ack, reverses XP once and rejects an old device edit',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-deletion-http-')),path=join(directory,'a.db');
  const deviceA=id(),deviceB=id(),identity=new HttpIdentity(root);
  const session=await identity.register(id()+'@example.test','fixture-password','Pessoa',deviceA);
  const api=new HttpSync(root,session.accountId,()=>session.accessToken,id),habitId=id();
  let a=openTestStore(path,session.accountId,deviceA);
  const b=openTestStore(join(directory,'b.db'),session.accountId,deviceB);
  try {
    const creation=a.enqueue(create(habitId),id(),at);await synchronize(a,api);
    const marking=a.enqueue({type:'habit.mark',habitId,dayKey:day,timeContext:context,observedUndoIds:[]},id(),at);
    const originalAck=await api.push([marking]);a.applyAck(originalAck.results);await synchronize(a,api);await synchronize(b,api);
    assert.equal(a.view(day).totalXp,10);assert.equal(b.view(day).totalXp,10);
    const oldEdit=b.enqueue({type:'habit.patchMetadata',habitId,patch:{title:'Edição offline antiga'}},id(),at);
    const deletion=a.enqueue({type:'habit.delete',habitId},id(),at);
    assert.deepEqual(a.view(day).habits,[]);assert.equal(a.view(day).totalXp,0);
    a.close();a=openTestStore(path,session.accountId,deviceA);assert.deepEqual(a.operations(),[deletion]);
    const lost=await api.push([deletion]);
    assert.ok(lost.results.every(r=>'receipt' in r&&r.receipt.status==='accepted'));
    await synchronize(a,api);await synchronize(b,api);
    for(const store of [a,b]) {assert.deepEqual(store.view(day).habits,[]);assert.equal(store.view(day).totalXp,0);assert.equal(store.operations().length,0);}
    assert.equal(b.recovery()[0]?.error.code,'resource_inaccessible');assert.deepEqual(b.recovery()[0]?.operation,oldEdit);
    const all=await entities(api);
    const budget=all.find(e=>e.kind==='xpBudget');assert.ok(budget?.kind==='xpBudget');assert.equal(budget.value.consumed,10);assert.equal(budget.value.dueHabitCount,0);
    const grants=all.filter(e=>e.kind==='xpGrant');assert.equal(grants.length,1);assert.ok(grants[0]?.kind==='xpGrant');assert.equal(grants[0].value.active,false);
    assert.equal(all.filter(e=>e.kind==='xpTransition'&&e.value.kind==='reverse').length,1);
    assert.equal(all.filter(e=>e.kind==='habit').length,0);assert.equal(all.filter(e=>e.kind==='tombstone').length,1);
    const before=a.cursor(),replay=await api.push([deletion]);a.applyAck(replay.results);await synchronize(a,api);
    assert.ok(replay.results.every(r=>'receipt' in r&&r.replayed));assert.equal((await api.pull(before)).changes.length,0);
    assert.equal((await entities(api)).filter(e=>e.kind==='xpTransition'&&e.value.kind==='reverse').length,1);
    a.applyAck(originalAck.results);assert.equal(a.view(day).totalXp,0);assert.deepEqual(a.view(day).habits,[]);
    const oldCreate=await api.push([creation]);assert.ok(oldCreate.results.every(r=>'receipt' in r&&r.replayed&&r.receipt.status==='accepted'));
    const newId=id();a.enqueue(create(newId),id(),at);await synchronize(a,api);
    assert.deepEqual(a.view(day).habits,[{habitId:newId,title:'Caminhar',done:false}]);assert.equal(a.view(day).totalXp,0);
  } finally {a.close();b.close();rmSync(directory,{recursive:true,force:true});}
});

test('a deletion with twenty reward days recovers atomically through snapshot without oversized transport or resurrecting pending IDs',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-deletion-history-')),deviceA=id();
  const session=await new HttpIdentity(root).register(id()+'@example.test','fixture-password','Pessoa',deviceA);
  const api=new HttpSync(root,session.accountId,()=>session.accessToken,id),habitId=id();
  const a=openTestStore(join(directory,'a.db'),session.accountId,deviceA),b=openTestStore(join(directory,'b.db'),session.accountId,id());
  try {
    a.enqueue({...create(habitId),startDayKey:'2026-09-01'},id(),'2026-09-01T12:00:00Z');await synchronize(a,api);
    for(let n=1;n<=20;n++) {
      const destination='2026-09-'+String(n).padStart(2,'0');
      a.enqueue({type:'habit.mark',habitId,dayKey:destination,timeContext:context,observedUndoIds:[]},id(),destination+'T12:00:00Z');
    }
    await synchronize(a,api);await synchronize(b,api);assert.equal(a.view(day).totalXp,200);
    const oldCreation=b.enqueue(create(habitId,'Tentativa antiga'),id(),at),otherId=id();
    const independent=b.enqueue(create(otherId,'Intenção independente'),id(),at);
    const deletion=a.enqueue({type:'habit.delete',habitId},id(),at);
    assert.equal(a.view(day).totalXp,0);
    const fetchNetwork=globalThis.fetch;let copies=0;
    t.mock.method(globalThis,'fetch',async(...args:Parameters<typeof fetch>)=>{
      const url=String(args[0]);if(url.endsWith('/sync/snapshots')) copies++;
      if(url.endsWith('/sync/push')&&String(args[1]?.body).includes(oldCreation.operationId)) {
        assert.deepEqual(b.view(day).habits.map(h=>h.habitId),[otherId]);
        assert.deepEqual(b.operations(),[oldCreation,independent]);
      }
      const response=await fetchNetwork(...args);
      if(url.endsWith('/sync/push')&&String(args[1]?.body).includes(deletion.operationId)) {
        const ack=await response.clone().json() as {results:PushResult[]};
        assert.ok(ack.results.every(r=>'receipt' in r&&r.receipt.status==='accepted'&&r.projections&&r.projections.length<=32));
      }
      return response;
    });
    await synchronize(a,api);await synchronize(b,api);
    assert.equal(copies,2);assert.equal(a.view(day).totalXp,0);assert.deepEqual(a.view(day).habits,[]);
    assert.deepEqual(b.view(day).habits.map(h=>h.habitId),[otherId]);assert.equal(b.recovery()[0]?.error.code,'id_content_conflict');
    const all=await entities(api);
    assert.equal(all.filter(e=>e.kind==='xpGrant'&&e.value.active).length,0);
    assert.equal(all.filter(e=>e.kind==='xpTransition'&&e.value.kind==='reverse').length,20);
    assert.equal(all.filter(e=>e.kind==='xpBudget').reduce((sum,e)=>sum+(e.kind==='xpBudget'?e.value.consumed:0),0),200);
    const replay=await api.push([deletion]);assert.ok(replay.results.every(r=>'receipt' in r&&r.replayed&&r.projections&&r.projections.length<=32));
  } finally {a.close();b.close();rmSync(directory,{recursive:true,force:true});}
});

test('five XP of headroom confirms the habit without a partial prize and the denial survives a later larger cap',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-deletion-cap-')),device=id();
  const session=await new HttpIdentity(root).register(id()+'@example.test','fixture-password','Pessoa',device);
  const api=new HttpSync(root,session.accountId,()=>session.accessToken,id),store=openTestStore(join(directory,'a.db'),session.accountId,device);
  const habits=Array.from({length:23},()=>id());
  try {
    for(const [index,habitId] of habits.entries()) store.enqueue(create(habitId,'Rotina '+index),id(),at);
    await synchronize(store,api);
    for(const habitId of habits.slice(0,22)) store.enqueue({type:'habit.mark',habitId,dayKey:day,timeContext:context,observedUndoIds:[]},id(),at);
    await synchronize(store,api);assert.equal(store.view(day).totalXp,220);
    for(const habitId of habits.slice(0,8)) store.enqueue({type:'habit.delete',habitId},id(),at);
    await synchronize(store,api);assert.equal(store.view(day).totalXp,140);
    const all=await entities(api),budget=all.find(e=>e.kind==='xpBudget');
    assert.ok(budget?.kind==='xpBudget');assert.equal(budget.value.consumed,220);assert.equal(budget.value.limit,225);assert.equal(budget.value.dueHabitCount,15);
    const last=habits[22]!;
    store.enqueue({type:'habit.mark',habitId:last,dayKey:day,timeContext:context,observedUndoIds:[]},id(),at);await synchronize(store,api);
    assert.equal(store.view(day).habits.find(h=>h.habitId===last)?.done,true);assert.equal(store.view(day).totalXp,140);
    const denied=(await entities(api)).find(e=>e.kind==='habitDay'&&e.value.habitId===last);assert.ok(denied?.kind==='habitDay');
    assert.ok((await entities(api)).some(e=>e.kind==='xpDecision'&&e.value.habitDayId===denied.value.habitDayId&&e.value.outcome==='limit_reached'));
    store.enqueue(create(id(),'Novo hábito'),id(),at);await synchronize(store,api);
    const undo=store.enqueue({type:'habit.unmark',habitId:last,dayKey:day,timeContext:context},id(),at);await synchronize(store,api);
    store.enqueue({type:'habit.mark',habitId:last,dayKey:day,timeContext:context,observedUndoIds:[undo.operationId]},id(),at);await synchronize(store,api);
    assert.equal(store.view(day).totalXp,140);
    const current=(await entities(api)).find(e=>e.kind==='xpBudget');assert.ok(current?.kind==='xpBudget');assert.equal(current.value.limit,240);assert.equal(current.value.consumed,220);
    assert.equal((await entities(api)).filter(e=>e.kind==='xpGrant'&&e.value.habitDayId===denied.value.habitDayId).length,0);
  } finally {store.close();rmSync(directory,{recursive:true,force:true});}
});

for(const action of ['habit.patchMetadata','habit.mark'] as const) for(const order of ['delete-first','action-first','simultaneous'] as const) {
  test('deletion wins against '+action+' in '+order+' delivery',async()=>{
    const directory=mkdtempSync(join(tmpdir(),'ritmo-delete-race-')),device=id();
    const session=await new HttpIdentity(root).register(id()+'@example.test','fixture-password','Pessoa',device);
    const api=new HttpSync(root,session.accountId,()=>session.accessToken,id),habitId=id();
    const a=openTestStore(join(directory,'a.db'),session.accountId,device),b=openTestStore(join(directory,'b.db'),session.accountId,id());
    try {
      a.enqueue(create(habitId),id(),at);await synchronize(a,api);await synchronize(b,api);
      const deletion=a.enqueue({type:'habit.delete',habitId},id(),at);
      const old=b.enqueue(action==='habit.mark'?{type:action,habitId,dayKey:day,timeContext:context,observedUndoIds:[]}:
        {type:action,habitId,patch:{title:'Edição anterior no aparelho'}},id(),'2026-09-30T11:59:00Z');
      if(order==='delete-first') {await api.push([deletion]);await api.push([old]);}
      else if(order==='action-first') {await api.push([old]);await api.push([deletion]);}
      else await Promise.all([api.push([deletion]),api.push([old])]);
      await synchronize(a,api);await synchronize(b,api);
      for(const store of [a,b]) {assert.deepEqual(store.view(day).habits,[]);assert.equal(store.view(day).totalXp,0);assert.equal(store.operations().length,0);}
      const stable=await api.pull(a.cursor());
      await api.push([old]);await api.push([deletion]);assert.equal((await api.pull(stable.nextCursor)).changes.length,0);
      const all=await entities(api);assert.equal(all.filter(e=>e.kind==='tombstone').length,1);assert.equal(all.filter(e=>e.kind==='xpGrant'&&e.value.active).length,0);
    } finally {a.close();b.close();rmSync(directory,{recursive:true,force:true});}
  });
}

test('another account cannot delete or see the victim habit, XP or tombstone',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-delete-isolation-')),identity=new HttpIdentity(root),device=id();
  const victim=await identity.register(id()+'@example.test','fixture-password','Pessoa',device);
  const outsider=await identity.register(id()+'@example.test','fixture-password','Outra',id());
  const api=new HttpSync(root,victim.accountId,()=>victim.accessToken,id),otherApi=new HttpSync(root,outsider.accountId,()=>outsider.accessToken,id),habitId=id();
  const a=openTestStore(join(directory,'a.db'),victim.accountId,device),b=openTestStore(join(directory,'b.db'),outsider.accountId,id());
  try {
    a.enqueue(create(habitId),id(),at);await synchronize(a,api);
    a.enqueue({type:'habit.mark',habitId,dayKey:day,timeContext:context,observedUndoIds:[]},id(),at);await synchronize(a,api);
    const attempt=b.enqueue({type:'habit.delete',habitId},id(),at);await synchronize(b,otherApi);
    assert.deepEqual(b.recovery()[0]?.operation,attempt);assert.equal(b.recovery()[0]?.error.code,'resource_inaccessible');
    await synchronize(a,api);assert.equal(a.view(day).totalXp,10);assert.equal(a.view(day).habits.length,1);
    a.enqueue({type:'habit.delete',habitId},id(),at);await synchronize(a,api);
    assert.ok((await entities(otherApi)).every(e=>e.kind==='profile'));
    assert.equal(b.view(day).totalXp,0);assert.deepEqual(b.view(day).habits,[]);
  } finally {a.close();b.close();rmSync(directory,{recursive:true,force:true});}
});
