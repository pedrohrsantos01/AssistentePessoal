import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import {fixture,id} from '../support/scheduler.ts';

const origin=process.env.RITMO_TEST_API,ready=process.env.RITMO_RESTORE_READY,release=process.env.RITMO_RESTORE_RELEASE;
assert.ok(origin&&ready&&release,'Run through the disposable Java backup/restore test');
async function until(condition:()=>boolean) {
  const deadline=Date.now()+90000;
  while(!condition()) {if(Date.now()>deadline) throw new Error('restore_integration_timeout');await new Promise(resolve=>setTimeout(resolve,20));}
}

test('restored PostgreSQL preserves tombstones and original XP while reopened SQLite sends offline intentions',async()=>{
  const f=fixture(),email=randomUUID()+'@example.test',at=new Date().toISOString(),day=at.slice(0,10);
  const timeContext={timezone:'UTC',dayStartHour:0};
  let identity=new HttpIdentity(origin);
  const create=(habitId:string,title:string)=>({type:'habit.create' as const,habitId,title,habitType:'binary' as const,scheduleKind:'daily' as const,
    startDayKey:day,timeContext,iconKey:null,colorToken:null,sortOrder:0});
  const mark=(habitId:string)=>({type:'habit.mark' as const,habitId,dayKey:day,timeContext,observedUndoIds:[]});
  try {
    await identity.register(email,'fixture-password','Restored account',id(2));
    const stranger=await identity.register(randomUUID()+'@example.test','fixture-password','Other account',id(90));
    f.identity.login=(email,password,device)=>identity.login(email,password,device);
    f.identity.refresh=token=>identity.refresh(token);f.identity.revoke=token=>identity.revoke(token);
    await f.session.login(email,'fixture-password');const accountId=f.session.account().accountId;
    f.session.account().enqueue(create(id(3),'Preserved habit'),id(10),at);
    f.session.account().enqueue(mark(id(3)),id(11),at);
    f.session.account().enqueue(create(id(4),'Deleted habit'),id(12),at);
    f.session.account().enqueue(mark(id(4)),id(13),at);
    const oldCreation=f.session.account().operations().find(op=>op.operationId===id(12));assert.ok(oldCreation);
    await f.session.synchronize(origin);
    f.session.account().enqueue({type:'habit.delete',habitId:id(4)},id(14),at);
    await f.session.synchronize(origin);
    assert.equal(f.session.account().view(day).totalXp,10);
    f.session.account().enqueue(create(id(5),'Offline after backup'),id(15),at);
    f.session.account().enqueue(mark(id(5)),id(16),at);
    const pending=f.session.account().operations();
    await f.restart();assert.deepEqual(f.session.account().operations(),pending);
    writeFileSync(ready,'source_ready');await until(()=>existsSync(release));
    const restored=readFileSync(release,'utf8');identity=new HttpIdentity(restored);
    await f.session.accessToken(true); // The original refresh family and credential hashes survived the dump.
    assert.deepEqual(f.session.account().operations(),pending);
    await f.session.synchronize(restored);
    assert.equal(f.session.account().view(day).pendingCount,0);
    assert.equal(f.session.account().view(day).totalXp,20);
    assert.equal(f.session.account().view(day).habits.length,2);
    let batchSequence=800;
    const transport=new HttpSync(restored,accountId,()=>f.session.accessToken(),()=>id(++batchSequence));
    const replay=await transport.push([oldCreation]);
    assert.ok(replay.results.every(result=>'receipt' in result&&result.replayed));
    const resurrect={...oldCreation,operationId:id(17),clientSequence:8};
    const conflict=await transport.push([resurrect]);
    assert.ok(conflict.results.every(result=>'receipt' in result&&result.receipt.status==='rejected'&&result.receipt.error.code==='id_content_conflict'));
    const other=openTestStore(':memory:',accountId,id(80));
    const foreign=openTestStore(':memory:',stranger.accountId,id(90));
    try {
      await synchronize(other,transport);
      assert.equal(other.view(day).totalXp,20);assert.equal(other.view(day).habits.length,2);
      assert.equal(other.view(day).habits.some(habit=>habit.habitId===id(4)),false);
      const foreignApi=new HttpSync(restored,stranger.accountId,()=>stranger.accessToken,()=>id(900));
      await synchronize(foreign,foreignApi);
      assert.equal(foreign.view(day).habits.length,0);assert.equal(foreign.view(day).totalXp,0);
    } finally {other.close();foreign.close();}
    await f.restart();assert.equal(f.session.account().view(day).totalXp,20);assert.equal(f.session.account().view(day).pendingCount,0);
  } finally {f.close();}
});
