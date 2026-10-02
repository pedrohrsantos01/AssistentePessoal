import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {fixture,id} from '../support/scheduler.ts';
import {openTestStore} from '../support/store.ts';

const source=process.env.RITMO_TEST_API,directory=process.env.RITMO_RECOVERY_DIRECTORY;
assert.ok(source&&directory,'Run through RestoreTests with disposable PostgreSQL/API');
const marker=(name:string)=>directory+'/'+name;
async function until(condition:()=>boolean) {
  const deadline=Date.now()+90000;
  while(!condition()) {if(Date.now()>deadline) throw new Error('operational_recovery_timeout');await new Promise(resolve=>setTimeout(resolve,20));}
}
async function phase(name:string) {
  await until(()=>existsSync(marker('release'))&&readFileSync(marker('release'),'utf8').startsWith(name+'\n'));
  const origin=readFileSync(marker('release'),'utf8').split('\n')[1];assert.ok(origin);return origin;
}

test('quarantined historical copy preserves confirmed and offline SQLite work until integral recovery and fresh login',async()=>{
  let origin=source;
  let batchSequence=900;const nextBatchId=()=>id(++batchSequence);
  const f=fixture(compatibility=>new HttpIdentity(origin,compatibility));
  const identity=new HttpIdentity(source),email=randomUUID()+'@example.test',otherEmail=randomUUID()+'@example.test';
  const at=new Date().toISOString(),day=at.slice(0,10),timeContext={timezone:'UTC',dayStartHour:0};
  const create=(habitId:string,title:string)=>({type:'habit.create' as const,habitId,title,habitType:'binary' as const,scheduleKind:'daily' as const,
    startDayKey:day,timeContext,iconKey:null,colorToken:null,sortOrder:0});
  const mark=(habitId:string)=>({type:'habit.mark' as const,habitId,dayKey:day,timeContext,observedUndoIds:[]});
  try {
    const previous=await identity.register(email,'fixture-password','Recovered account',id(2));
    const stranger=await identity.register(otherEmail,'fixture-password','Other account',id(90));
    await f.session.login(email,'fixture-password');const accountId=f.session.account().accountId;
    f.session.account().enqueue(create(id(3),'Old habit deleted after cut'),id(10),at);
    f.session.account().enqueue(mark(id(3)),id(11),at);
    await f.session.synchronize(source);
    writeFileSync(marker('cut-ready'),'ready');await until(()=>existsSync(marker('advance')));
    const confirmed=f.session.account().enqueue(create(id(4),'Confirmed after historical cut'),id(12),at);
    f.session.account().enqueue(mark(id(4)),id(13),at);
    f.session.account().enqueue({type:'habit.delete',habitId:id(3)},id(14),at);
    await f.session.synchronize(source);
    assert.equal(f.session.account().view(day).totalXp,10);
    assert.equal(f.session.account().view(day).habits.some(habit=>habit.habitId===id(3)),false);
    f.session.account().enqueue(create(id(5),'Offline before disaster'),id(15),at);
    f.session.account().enqueue(mark(id(5)),id(16),at);
    const pending=f.session.account().operations();
    await f.restart();assert.deepEqual(f.session.account().operations(),pending);
    writeFileSync(marker('complete-ready'),'ready');

    origin=await phase('quarantine');await f.restart();
    const before=f.session.account().view(day),cursor=f.session.account().cursor();
    await assert.rejects(f.session.synchronize(origin),(error:unknown)=>error instanceof Error&&'status' in error&&error.status===503);
    const api=new HttpSync(origin,accountId,()=>previous.accessToken,nextBatchId);
    await assert.rejects(api.snapshot(),(error:unknown)=>error instanceof Error&&'status' in error&&error.status===503);
    await assert.rejects(f.session.accessToken(true),(error:unknown)=>error instanceof Error&&'status' in error&&error.status===503);
    assert.deepEqual(f.session.account().view(day),before);assert.equal(f.session.account().cursor(),cursor);
    assert.deepEqual(f.session.account().operations(),pending);assert.equal(f.session.access().mode,'read_write');
    f.session.account().enqueue(create(id(6),'Offline during quarantine'),id(17),at);
    f.session.account().enqueue(mark(id(6)),id(18),at);
    const retained=f.session.account().operations();
    await f.restart();assert.deepEqual(f.session.account().operations(),retained);
    assert.equal(f.session.account().view(day).habits.some(habit=>habit.habitId===id(3)),false);
    assert.equal(f.session.account().view(day).habits.some(habit=>habit.habitId===id(4)),true);
    writeFileSync(marker('quarantine-checked'),'ready');

    origin=await phase('active');await f.restart();
    await assert.rejects(f.session.accessToken(),/authentication_required/);
    assert.deepEqual(f.session.account().operations(),retained);
    const renewedIdentity=new HttpIdentity(origin);
    await assert.rejects(renewedIdentity.refresh(previous.refreshToken),(error:unknown)=>error instanceof Error&&'status' in error&&error.status===401);
    const denied=await fetch(origin+'/api/v1/sync/pull',{headers:{Authorization:'Bearer '+previous.accessToken,'X-App-Version':'0.1.0','X-Ritmo-Protocol':'m1.1'}});
    assert.equal(denied.status,401);
    await f.session.login(email,'fixture-password');
    assert.deepEqual(f.session.account().operations(),retained);
    await f.session.synchronize(origin);
    assert.equal(f.session.account().view(day).pendingCount,0);assert.equal(f.session.account().view(day).totalXp,30);
    assert.equal(f.session.account().view(day).habits.length,3);
    assert.equal(f.session.account().view(day).habits.some(habit=>habit.habitId===id(3)),false);
    const current=new HttpSync(origin,accountId,()=>f.session.accessToken(),nextBatchId);
    const replay=await current.push([confirmed]);assert.ok(replay.results.every(result=>'receipt' in result&&result.replayed));
    assert.equal((await current.snapshot()).highWaterRevision,'9');
    const peer=openTestStore(':memory:',accountId,id(80));
    try {await synchronize(peer,current);assert.equal(peer.view(day).totalXp,30);assert.equal(peer.view(day).habits.length,3);}
    finally {peer.close();}
    await f.restart();assert.equal(f.session.account().view(day).totalXp,30);
    const isolated=f.session.account().enqueue(create(id(7),'Private offline intention'),id(19),at);
    await f.session.logout();await f.session.login(otherEmail,'fixture-password');
    assert.equal(f.session.account().accountId,stranger.accountId);
    await f.session.synchronize(origin);
    assert.equal(f.session.account().view(day).habits.length,0);assert.equal(f.session.account().view(day).totalXp,0);
    assert.equal(f.session.account().operations().length,0);
    await f.session.logout();await f.session.login(email,'fixture-password');
    assert.deepEqual(f.session.account().operations(),[isolated]);
    await f.session.synchronize(origin);assert.equal(f.session.account().view(day).totalXp,30);
  } finally {f.close();}
});
