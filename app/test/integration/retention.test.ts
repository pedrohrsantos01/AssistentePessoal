import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdtempSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import type {CreateHabit,Entity} from '../../src/core/sync/protocol.ts';

const root=process.env.RITMO_TEST_API,control=process.env.RITMO_RETENTION_CONTROL;
assert.ok(root);assert.ok(control);
const id=()=>{const parts=randomUUID().split('-');parts[2]='7'+parts[2]!.slice(1);return parts.join('-');};
const day='2026-10-04',at=day+'T12:00:00Z',context={timezone:'UTC',dayStartHour:0};
const create=(habitId:string,title:string):CreateHabit=>({type:'habit.create',habitId,title,habitType:'binary',
  scheduleKind:'daily',startDayKey:day,timeContext:context,iconKey:null,colorToken:null,sortOrder:0});
async function boundary(stage:string,user:string) {
  // External test-clock coordination only; no credentials/payloads and no test-only API route.
  writeFileSync(join(control!,stage+'.ready.tmp'),JSON.stringify({user}));
  renameSync(join(control!,stage+'.ready.tmp'),join(control!,stage+'.ready'));
  const deadline=Date.now()+30000;
  while(!existsSync(join(control!,stage+'.go'))) {assert.ok(Date.now()<deadline,'clock coordinator did not finish '+stage);await delay(25);}
}
async function entities(api:HttpSync) {
  const manifest=await api.snapshot();let cursor:string|null=manifest.firstPageCursor;const all:Entity[]=[];
  while(cursor) {const page=await api.page(manifest.snapshotId,cursor);all.push(...page.entities);cursor=page.nextPageCursor;}
  return all;
}

test('a reopened SQLite client recovers after real retention without losing intentions, old receipts or tombstones',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-retention-')),deviceA=id(),deviceB=id(),path=join(directory,'b.db');
  const session=await new HttpIdentity(root).register(id()+'@example.test','fixture-password','Pessoa',deviceA);
  let lastBatch='' ;
  const api=new HttpSync(root,session.accountId,()=>session.accessToken,()=>{lastBatch=id();return lastBatch;});
  const a=openTestStore(join(directory,'a.db'),session.accountId,deviceA);
  let b=openTestStore(path,session.accountId,deviceB);
  const deleted=id(),kept=id(),independent=id();
  try {
    const originalCreation=a.enqueue(create(deleted,'Caminhar'),id(),at);
    const secondCreation=a.enqueue(create(kept,'Ler'),id(),at);await synchronize(a,api);
    const creationBatch=lastBatch;
    a.enqueue({type:'habit.mark',habitId:deleted,dayKey:day,timeContext:context,observedUndoIds:[]},id(),at);
    await synchronize(a,api);await synchronize(b,api);assert.equal(b.view(day).totalXp,10);
    const rejected=b.enqueue(create(deleted,'Outra intenção'),id(),at);
    b.applyAck((await api.push([rejected])).results);
    assert.equal(b.recovery()[0]?.operation.operationId,rejected.operationId);
    const lost=b.enqueue({type:'habit.mark',habitId:kept,dayKey:day,timeContext:context,observedUndoIds:[]},id(),at);
    const lostAck=await api.push([lost]);assert.ok(lostAck.results.every(r=>'receipt' in r&&r.receipt.status==='accepted'));
    const oldEdit=b.enqueue({type:'habit.patchMetadata',habitId:deleted,patch:{title:'Edição offline'}},id(),at);
    const localCreation=b.enqueue(create(independent,'Intenção preservada'),id(),at);
    const deletion=a.enqueue({type:'habit.delete',habitId:deleted},id(),at);await synchronize(a,api);
    const pending=b.operations(),recovery=b.recovery(),before=b.view(day);
    b.close();b=openTestStore(path,session.accountId,deviceB);
    assert.deepEqual(b.operations(),pending);assert.deepEqual(b.recovery(),recovery);assert.deepEqual(b.view(day),before);
    await boundary('feed',session.accountId);
    b.close();b=openTestStore(path,session.accountId,deviceB);
    assert.deepEqual(b.operations(),pending);assert.deepEqual(b.recovery(),recovery);assert.deepEqual(b.view(day),before);
    const network=globalThis.fetch;let stalePulls=0,missingPages=0,copies=0;const classified:string[]=[];
    t.mock.method(globalThis,'fetch',async(...args:Parameters<typeof fetch>)=>{
      const url=String(args[0]);
      if(url.endsWith('/push')) {
        assert.deepEqual(b.operations().map(op=>op.operationId),[oldEdit.operationId,localCreation.operationId]);
        assert.ok(!b.view(day).habits.some(h=>h.habitId===deleted));assert.equal(b.view(day).totalXp,10);
      }
      if(url.endsWith('/receipts')) classified.push(...(JSON.parse(String(args[1]?.body)) as {operationIds:string[]}).operationIds);
      const response=await network(...args);
      if(url.includes('/pull?')&&response.status===409) stalePulls++;
      if(url.includes('/snapshots/')&&response.status===404) missingPages++;
      if(url.endsWith('/snapshots')) {copies++;if(copies===1) await boundary('copy',session.accountId);}
      return response;
    });
    await synchronize(b,api);t.mock.restoreAll();
    assert.equal(stalePulls,1);assert.equal(missingPages,1);assert.equal(copies,2);
    assert.ok(classified.includes(lost.operationId));assert.deepEqual(b.operations(),[]);
    assert.ok(b.recovery().some(r=>r.operation.operationId===rejected.operationId));
    assert.ok(b.recovery().some(r=>r.operation.operationId===oldEdit.operationId&&r.error.code==='resource_inaccessible'));
    assert.equal(b.view(day).totalXp,10);assert.ok(!b.view(day).habits.some(h=>h.habitId===deleted));
    const final=b.view(day),failures=b.recovery();b.close();b=openTestStore(path,session.accountId,deviceB);
    assert.deepEqual(b.view(day),final);assert.deepEqual(b.recovery(),failures);
    await synchronize(a,api);assert.deepEqual(a.view(day).habits,b.view(day).habits);assert.equal(a.view(day).totalXp,10);
    const replay=await api.push([lost,deletion,originalCreation]);assert.ok(replay.results.every(r=>'receipt' in r&&r.replayed));
    const requestBatch=async(body:unknown)=>fetch(root+'/api/v1/sync/push',{
      method:'POST',headers:{'Content-Type':'application/json','X-Ritmo-Protocol':'m1.1','X-App-Version':'0.1.0',
        Authorization:'Bearer '+session.accessToken,'Idempotency-Key':creationBatch},body:JSON.stringify(body)});
    const originalBatch={operations:[originalCreation,secondCreation]};
    const same=await requestBatch(originalBatch);assert.equal(same.status,200);
    const sameResult=await same.json() as {results:{replayed:boolean}[]};assert.ok(sameResult.results.every(r=>r.replayed));
    const changed=await requestBatch({operations:[originalCreation]});assert.equal(changed.status,409);
    const conflict=await changed.json() as {error:{code:string}};assert.equal(conflict.error.code,'idempotency_key_conflict');
    b.applyAck(lostAck.results);await synchronize(b,api);
    assert.equal(b.view(day).totalXp,10);assert.ok(!b.view(day).habits.some(h=>h.habitId===deleted));
    const all=await entities(api);
    assert.equal(all.filter(e=>e.kind==='xpGrant').length,2);
    assert.equal(all.filter(e=>e.kind==='xpTransition'&&e.value.kind==='reverse').length,1);
    assert.equal(all.filter(e=>e.kind==='tombstone').length,1);
    const budget=all.find(e=>e.kind==='xpBudget');assert.ok(budget?.kind==='xpBudget');assert.equal(budget.value.consumed,20);
  } finally {t.mock.restoreAll();a.close();b.close();rmSync(directory,{recursive:true,force:true});}
});
