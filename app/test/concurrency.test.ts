import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openTestStore} from './support/store.ts';
import type {Entity} from '../src/core/sync/protocol.ts';

const id=(value:number)=>'01996300-0000-7000-8000-'+String(value).padStart(12,'0');
const day='2026-09-25',at='2026-09-25T13:00:00Z';
const timeContext={timezone:'America/Sao_Paulo',dayStartHour:4};
const habit:Entity={kind:'habit',value:{habitId:id(3),title:'Meditar',habitType:'binary',scheduleKind:'daily',
  startDayKey:day,creationTimeContext:timeContext,iconKey:null,colorToken:null,sortOrder:0,
  createdAt:at,updatedAt:at,deletedAt:null,revision:'1'}};
function canonical(done:boolean,knownUndoIds:string[],revision:string):Entity[] {
  return [{kind:'habitDay',value:{habitDayId:id(4),habitId:id(3),dayKey:day,done,knownUndoIds,revision}},
    {kind:'xpGrant',value:{grantId:id(5),habitDayId:id(4),amount:10,dayKey:day,module:'habits',budgetCost:10,active:done,revision}}];
}

test('M1-06: a local remark observing only one undo stays undone after a concurrent undo and restart',()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-concurrency-')),path=join(directory,'a.db');
  let a=openTestStore(path,id(1),id(2));
  try {
    a.applyPull({changes:[{revision:'1',operationResults:[],entities:[habit,...canonical(true,[],'1')]}],
      nextCursor:'fixture-cursor-0001',highWaterRevision:'1',hasMore:false,serverTime:at});
    a.enqueue({type:'habit.unmark',habitId:id(3),dayKey:day,timeContext},id(7),at);
    const remark=a.enqueue({type:'habit.mark',habitId:id(3),dayKey:day,timeContext,observedUndoIds:[id(7)]},id(9),at);
    assert.equal(a.view(day).habits[0]?.done,true);
    assert.equal(a.view(day).totalXp,10);

    // B's independent undo was not known when A created its immutable remark.
    const remote={changes:[{revision:'2',operationResults:[],entities:canonical(false,[id(8)],'2')}],
      nextCursor:'fixture-cursor-0002',highWaterRevision:'2',hasMore:false,serverTime:at};
    a.applyPull(remote);
    assert.deepEqual(a.view(day),{habits:[{habitId:id(3),title:'Meditar',done:false}],totalXp:0,pendingCount:2,rejectedCount:0});
    a.close();a=openTestStore(path,id(1),id(2));
    a.applyPull(remote);
    assert.deepEqual(a.operations()[1],remark);
    assert.equal(a.view(day).habits[0]?.done,false);
    assert.equal(a.view(day).totalXp,0);

    a.enqueue({type:'habit.mark',habitId:id(3),dayKey:day,timeContext,observedUndoIds:[id(7),id(8)]},id(10),at);
    assert.equal(a.view(day).habits[0]?.done,true);
    assert.equal(a.view(day).totalXp,10);
  } finally {a.close();rmSync(directory,{recursive:true,force:true});}
});
