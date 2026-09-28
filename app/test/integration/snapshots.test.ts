import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,SyncHttpError,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import type {Command,Operation} from '../../src/core/sync/protocol.ts';
import {day,at,command} from '../support/scheduler.ts';
const root=process.env.RITMO_TEST_API;
assert.ok(root,'RITMO_TEST_API must point to the disposable integration server');
const id=()=>{const parts=randomUUID().split('-');parts[2]='7'+parts[2]!.slice(1);return parts.join('-');};

test('501 changes and 502 snapshot entities keep a stable cut; interrupted copy restarts with all local work',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-snapshot-http-')),path=join(directory,'a.db');
  const deviceA=id(),deviceB=id(),identity=new HttpIdentity(root);
  const session=await identity.register(id()+'@example.test','fixture-password','Pessoa',deviceA);
  const api=new HttpSync(root,session.accountId,()=>session.accessToken,id);
  const outsider=await identity.register(id()+'@example.test','fixture-password','Outra',id());
  const otherApi=new HttpSync(root,outsider.accountId,()=>outsider.accessToken,id);
  let a=openTestStore(path,session.accountId,deviceA);
  const b=openTestStore(join(directory,'b.db'),session.accountId,id());
  let remoteSequence=0;
  const remote=(command:Command):Operation=>({operationId:id(),deviceId:deviceB,clientSequence:++remoteSequence,occurredAt:at,dependsOn:[],command});
  try {
    const empty=await api.snapshot(),initial=await api.page(empty.snapshotId,empty.firstPageCursor);
    assert.ok(initial.pullCursor);
    const operations:Operation[]=[],habits:string[]=[];
    for(let index=0;index<501;index++) {
      const habitId=id();habits.push(habitId);
      const create={...command,habitId,title:'Hábito '+index};
      operations.push(index<52?a.enqueue(create,id(),at):remote(create));
    }
    for(let offset=0;offset<operations.length;offset+=50) {
      const ack=await api.push(operations.slice(offset,offset+50));
      assert.ok(ack.results.every(result=>'receipt' in result&&result.receipt.status==='accepted'));
    }
    const first=await api.pull(initial.pullCursor);
    assert.equal(first.changes.length,500);assert.equal(first.hasMore,true);assert.equal(first.highWaterRevision,'501');
    const patch=(title:string):Command=>({type:'habit.patchMetadata',habitId:habits[0]!,patch:{title}});
    await api.push([remote(patch('Primeira edição'))]);
    const second=await api.pull(first.nextCursor);
    assert.equal(second.changes.length,1);assert.equal(second.changes[0]?.revision,'501');
    assert.equal(second.highWaterRevision,'501');assert.equal(second.hasMore,false);
    const following=await api.pull(second.nextCursor);
    assert.deepEqual(following.changes.map(change=>change.revision),['502']);

    const cut=await api.snapshot(),page1=await api.page(cut.snapshotId,cut.firstPageCursor);
    assert.equal(cut.entityCount,502);assert.equal(cut.highWaterRevision,'502');
    assert.equal(page1.entities.length,500);assert.equal(page1.complete,false);assert.ok(page1.nextPageCursor);
    assert.deepEqual(await api.page(cut.snapshotId,cut.firstPageCursor),page1);
    const lost=a.enqueue(patch('A com ack perdido'),id(),at);await api.push([lost]);
    await api.push([remote(patch('B posterior'))]);
    const page2=await api.page(cut.snapshotId,page1.nextPageCursor);
    assert.equal(page2.entities.length,2);assert.equal(page2.complete,true);assert.equal(page2.highWaterRevision,'502');
    const snapshotHabit=[...page1.entities,...page2.entities].find(entity=>entity.kind==='habit'&&entity.value.habitId===habits[0]);
    assert.ok(snapshotHabit?.kind==='habit');assert.equal(snapshotHabit.value.title,'Primeira edição');
    const classification=await api.receipts(cut.snapshotId,[operations[0]!.operationId,lost.operationId]);
    assert.deepEqual(classification.results,[{operationId:operations[0]!.operationId,status:'accepted',acceptedRevision:'1'},
      {operationId:lost.operationId,status:'notProcessedAtH'}]);
    await assert.rejects(otherApi.page(cut.snapshotId,cut.firstPageCursor),(error:unknown)=>error instanceof SyncHttpError&&error.status===404);
    await assert.rejects(otherApi.receipts(cut.snapshotId,[lost.operationId]),(error:unknown)=>error instanceof SyncHttpError&&error.status===404);

    const fetchNetwork=globalThis.fetch,receiptSizes:number[]=[];let pages=0;const offlineId=id();
    t.mock.method(globalThis,'fetch',async(...args:Parameters<typeof fetch>)=>{
      const url=String(args[0]);
      if(url.endsWith('/receipts')) receiptSizes.push((JSON.parse(String(args[1]?.body)) as {operationIds:string[]}).operationIds.length);
      if(url.endsWith('/push')) assert.deepEqual(a.operations().map(op=>op.operationId),[offlineId]);
      const response=await fetchNetwork(...args);
      if(url.includes('/sync/snapshots/')) {
        pages++;
        if(pages===1) a.enqueue({...command,habitId:id(),title:'Offline durante cópia'},offlineId,at);
        if(pages===2) throw new TypeError('response_lost_during_copy');
      }
      return response;
    });
    await assert.rejects(synchronize(a,api),/response_lost_during_copy/);
    const pending=a.operations(),previous=a.view(day);assert.equal(pending.length,54);assert.equal(a.cursor(),null);
    a.close();a=openTestStore(path,session.accountId,deviceA);
    assert.deepEqual(a.operations(),pending);assert.deepEqual(a.view(day),previous);assert.equal(a.cursor(),null);
    await synchronize(a,api);
    assert.deepEqual(receiptSizes,[50,4]);assert.equal(a.view(day).pendingCount,0);
    assert.equal(a.view(day).habits.length,502);assert.equal(a.view(day).habits.find(h=>h.habitId===habits[0])?.title,'B posterior');
    // Stop fault interception before syncing the second real client.
    t.mock.restoreAll();await synchronize(b,api);
    assert.deepEqual(a.view(day),b.view(day));
  } finally {a.close();b.close();rmSync(directory,{recursive:true,force:true});}
});
