import {operationHash} from '../src/core/sync/operation-hash.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openTestStore} from './support/store.ts';
import type {CreateHabit,Entity,Pull} from '../src/core/sync/protocol.ts';
const id=(n:number)=>'01996300-0000-7000-8000-'+String(n).padStart(12,'0');
const at='2026-09-30T12:00:00Z',day='2026-09-30';
const context={timezone:'America/Sao_Paulo',dayStartHour:4};
const create:CreateHabit={type:'habit.create',habitId:id(3),title:'Caminhar',habitType:'binary',scheduleKind:'daily',
  startDayKey:day,timeContext:context,iconKey:null,colorToken:null,sortOrder:0};
const habit:Entity={kind:'habit',value:{habitId:id(3),title:'Caminhar',habitType:'binary',scheduleKind:'daily',
  startDayKey:day,creationTimeContext:context,iconKey:null,colorToken:null,sortOrder:0,createdAt:at,updatedAt:at,deletedAt:null,revision:'1'}};
const tombstone:Entity={kind:'tombstone',value:{entityKind:'habit',entityId:id(3),deletedAt:at,revision:'3'}};
const page=(entities:Entity[],revision='3'):Pull=>({changes:[{revision,operationResults:[],entities}],nextCursor:'cursor-'+revision,
  hasMore:false,highWaterRevision:revision,serverTime:at});

test('a remote tombstone wins over a pending old creation and survives restart and delayed acknowledgements',()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-tombstone-')),path=join(directory,'account.db');
  let store=openTestStore(path,id(1),id(2));
  try {
    const pending=store.enqueue(create,id(4),at);
    store.applyPull(page([habit,tombstone]));
    assert.deepEqual(store.view(day).habits,[]);
    assert.deepEqual(store.operations(),[pending]);
    store.close();store=openTestStore(path,id(1),id(2));
    assert.deepEqual(store.view(day).habits,[]);
    assert.deepEqual(store.operations(),[pending]);
    store.applyAck([{receipt:{operationId:pending.operationId,operationHash:operationHash(pending),status:'accepted',acceptedRevision:'1'},replayed:true,projections:[habit]}]);
    store.applyPull(page([habit],'1'));
    assert.deepEqual(store.view(day).habits,[]);
    assert.equal(store.view(day).totalXp,0);
  } finally {store.close();rmSync(directory,{recursive:true,force:true});}
});

const earned:Entity[]=[
  {kind:'habitDay',value:{habitDayId:id(8),habitId:id(3),dayKey:day,done:true,knownUndoIds:[],revision:'2'}},
  {kind:'xpGrant',value:{grantId:id(9),habitDayId:id(8),amount:10,dayKey:day,module:'habits',budgetCost:10,active:true,revision:'2'}},
];
test('the tombstone invalidates earned and pending XP even before the large deletion snapshot arrives',()=>{
  const store=openTestStore(':memory:',id(1),id(2));
  try {
    store.applyPull(page([habit,...earned],'2'));
    assert.equal(store.view(day).totalXp,10);
    const pending=store.enqueue({type:'habit.mark',habitId:id(3),dayKey:day,timeContext:context,observedUndoIds:[]},id(5),at);
    store.applyPull(page([tombstone]));
    assert.equal(store.view(day).totalXp,0);
    assert.deepEqual(store.operations(),[pending]);
    store.applyAck([{receipt:{operationId:id(10),status:'accepted',acceptedRevision:'2'},replayed:true,projections:earned}]);
    assert.equal(store.view(day).totalXp,0);
  } finally {store.close();}
});

test('an offline deletion hides habit and XP durably; a definitive rejection restores the canonical view',()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-delete-')),path=join(directory,'account.db');
  let store=openTestStore(path,id(1),id(2));
  try {
    store.applyPull(page([habit,...earned],'2'));
    const deletion=store.enqueue({type:'habit.delete',habitId:id(3)},id(11),at);
    assert.deepEqual(store.view(day),{habits:[],totalXp:0,pendingCount:1,rejectedCount:0});
    store.close();store=openTestStore(path,id(1),id(2));
    assert.deepEqual(store.operations(),[deletion]);
    assert.equal(store.view(day).totalXp,0);
    store.applyAck([{receipt:{operationId:deletion.operationId,operationHash:operationHash(deletion),status:'rejected',error:{code:'validation_failed',fields:[],dependencyIds:[]}},replayed:false}]);
    assert.deepEqual(store.view(day),{habits:[{habitId:id(3),title:'Caminhar',done:true}],totalXp:10,pendingCount:0,rejectedCount:1});
    assert.deepEqual(store.recovery()[0]?.operation,deletion);
  } finally {store.close();rmSync(directory,{recursive:true,force:true});}
});
