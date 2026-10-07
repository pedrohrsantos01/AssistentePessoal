import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,writeFileSync} from 'node:fs';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {SyncScheduler} from '../../src/core/sync/scheduler.ts';
import {openTestStore} from '../support/store.ts';
import {Clock,fixture,id,command,at,day} from '../support/scheduler.ts';

const origin=process.env.RITMO_TEST_API,ready=process.env.RITMO_TEST_RATE_READY,release=process.env.RITMO_TEST_RATE_RELEASE;
assert.ok(origin&&ready&&release,'Run through the disposable HTTP server with its controlled monotonic clock');
async function until(condition:()=>boolean) {
  const deadline=Date.now()+20000;
  while(!condition()) {if(Date.now()>deadline) throw new Error('rate_limit_integration_timeout');await new Promise(resolve=>setTimeout(resolve,10));}
}

test('a real 429 preserves SQLite intentions and Retry-After across reopen, then converges exactly once',async t=>{
  const f=fixture(),clock=new Clock(),identity=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  let scheduler:SyncScheduler|null=null;
  const phase=(name:string)=>console.info('Rate-limit fixture: '+name);
  try {
    phase('starting identity');
    await identity.register(email,'fixture-password','Rate limits',id(2));
    f.identity.login=(email,password,device)=>identity.login(email,password,device);
    f.identity.refresh=token=>identity.refresh(token);f.identity.revoke=token=>identity.revoke(token);
    await f.session.login(email,'fixture-password');
    phase('session ready');
    const accountId=f.session.account().accountId;
    const transport=new HttpSync(origin,accountId,()=>f.session.accessToken(),()=>id(800));
    // Observe real HTTP calls only while filling the approved 120-request account quota.
    const realFetch=globalThis.fetch;let consumed=0;
    t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
      if(String(input).includes('/api/v1/sync/')) consumed++;
      return realFetch(input,init);
    });
    await f.session.synchronize(origin,clock.now);
    while(consumed<119) await transport.pull(f.session.account().cursor());
    phase('quota filled');
    t.mock.restoreAll();
    f.session.account().enqueue(command,id(10),at);
    f.session.account().enqueue({type:'habit.mark',habitId:id(3),dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    const original=f.session.account().operations();
    scheduler=new SyncScheduler(f.session,origin,clock);scheduler.update({active:true,online:true});
    await until(()=>scheduler?.status().sync.phase==='retry_wait');
    assert.equal(f.session.account().retryState().nextAttemptAt,clock.now()+1000);
    assert.equal(f.session.account().view(day).pendingCount,2);
    assert.deepEqual(f.session.account().operations(),original);
    scheduler.dispose();await f.restart();
    scheduler=new SyncScheduler(f.session,origin,clock);
    assert.equal(scheduler.status().sync.phase,'retry_wait');
    assert.equal(scheduler.status().sync.nextAttemptAt,clock.now()+1000);
    assert.deepEqual(f.session.account().operations(),original);
    scheduler.update({active:true,online:true});
    await clock.advance(999);assert.equal(f.session.account().view(day).pendingCount,2);
    // External test fixture releases server time; no test route or clock exists in the application API.
    phase('ready to release server clock');
    writeFileSync(ready,'ready');await until(()=>existsSync(release));
    await clock.advance(1);await until(()=>scheduler?.status().sync.phase==='idle');
    assert.equal(f.session.account().view(day).pendingCount,0);
    assert.equal(f.session.account().view(day).totalXp,10);
    phase('converged after real 429');
    const replay=await transport.push(original);
    assert.ok(replay.results.every(result=>'receipt' in result&&result.replayed));
    const other=openTestStore(':memory:',accountId,id(90));
    try {
      await synchronize(other,transport);
      assert.equal(other.view(day).totalXp,10);assert.equal(other.view(day).habits[0]?.done,true);
    } finally {other.close();}
  } finally {scheduler?.dispose();f.close();}
});
