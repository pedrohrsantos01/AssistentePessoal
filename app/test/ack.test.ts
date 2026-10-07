import {operationHash} from '../src/core/sync/operation-hash.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTestStore} from './support/store.ts';
import type {CreateHabit, Entity} from '../src/core/sync/protocol.ts';
const id=(n:number)=>'01996300-0000-7000-8000-'+String(n).padStart(12,'0');
const context={timezone:'America/Sao_Paulo',dayStartHour:4};
const command:CreateHabit={type:'habit.create',habitId:id(3),title:'Original',habitType:'binary',scheduleKind:'daily',
  startDayKey:'2026-09-25',timeContext:context,iconKey:null,colorToken:null,sortOrder:0};
function habit(title:string,revision:string):Entity {
  return {kind:'habit',value:{habitId:id(3),title,habitType:'binary',scheduleKind:'daily',startDayKey:'2026-09-25',
    creationTimeContext:context,iconKey:null,colorToken:null,sortOrder:0,createdAt:'2026-09-25T13:00:00Z',
    updatedAt:'2026-09-25T13:00:00Z',deletedAt:null,revision}};
}
test('a lost acknowledgement is recognized before pending edits are rebased over a later device edit',()=>{
  const store=openTestStore(':memory:',id(1),id(2));
  try {
    const creation=store.enqueue(command,id(4),'2026-09-25T13:00:00Z');
    store.applyAck([{receipt:{operationId:id(4),operationHash:operationHash(creation),status:'accepted',acceptedRevision:'1'},replayed:false,projections:[habit('Original','1')]}]);
    const edit=store.enqueue({type:'habit.patchMetadata',habitId:id(3),patch:{title:'Antigo A'}},id(5),'2026-09-25T13:01:00Z');
    store.applyPull({changes:[
      {revision:'2',operationResults:[{operationId:id(5),operationHash:operationHash(edit),status:'accepted',acceptedRevision:'2'}],entities:[habit('Antigo A','2')]},
      {revision:'3',operationResults:[{operationId:id(6),status:'accepted',acceptedRevision:'3'}],entities:[habit('Novo B','3')]},
    ],nextCursor:'cursor-after-0003',hasMore:false,highWaterRevision:'3',serverTime:'2026-09-25T13:05:00Z'});
    assert.deepEqual(store.view('2026-09-25'),{habits:[{habitId:id(3),title:'Novo B',done:false}],totalXp:0,pendingCount:0,rejectedCount:0});
    assert.equal(store.cursor(),'cursor-after-0003');
    store.applyAck([{receipt:{operationId:id(5),operationHash:operationHash(edit),status:'accepted',acceptedRevision:'2'},replayed:true,projections:[habit('Antigo A','2')]}]);
    assert.equal(store.view('2026-09-25').habits[0]?.title,'Novo B');
    assert.equal(store.cursor(),'cursor-after-0003');
  } finally {store.close();}
});

test('a transaction failure preserves both pending work and the previous projection',()=>{
  const store=openTestStore(':memory:',id(1),id(2));
  try {
    const creation=store.enqueue(command,id(4),'2026-09-25T13:00:00Z');
    assert.throws(()=>store.applyPull({changes:[{revision:'1',operationResults:[{operationId:id(4),operationHash:operationHash(creation),status:'accepted',acceptedRevision:'1'}],entities:[habit('Servidor','1'),habit('Inválido','9223372036854775808')]}],nextCursor:'must-not-commit',hasMore:false,highWaterRevision:'1',serverTime:'2026-09-25T13:00:00Z'}),/invalid_revision/);
    assert.equal(store.cursor(),null);
    assert.equal(store.view('2026-09-25').pendingCount,1);
    assert.equal(store.view('2026-09-25').habits[0]?.title,'Original');
  } finally {store.close();}
});
