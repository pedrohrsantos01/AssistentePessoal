import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SyncScheduler} from '../../src/core/sync/scheduler.ts';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import {Clock,fixture,id,command,at,day} from '../support/scheduler.ts';
const origin=process.env.RITMO_TEST_API;
assert.ok(origin,'RITMO_TEST_API must point to the disposable integration server');
async function until(condition:()=>boolean) {
  const deadline=Date.now()+15000;
  while(!condition()) {if(Date.now()>deadline) throw new Error('scheduler_integration_timeout');await new Promise(resolve=>setTimeout(resolve,10));}
}

test('automatic reconnection converges after a lost HTTP acknowledgement and flushes an offline logout',async t=>{
  const f=fixture(),clock=new Clock(),api=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  await api.register(email,'fixture-password','Scheduler',id(2));
  f.identity.login=(email,password,device)=>api.login(email,password,device);
  f.identity.refresh=token=>api.refresh(token);f.identity.revoke=token=>api.revoke(token);
  await f.session.login(email,'fixture-password');
  const account=f.session.account().accountId;
  f.session.account().enqueue(command,id(10),at);
  f.session.account().enqueue({type:'habit.mark',habitId:id(3),dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
  await f.restart();
  const scheduler=new SyncScheduler(f.session,origin,clock),other=openTestStore(':memory:',account,id(90));
  const realFetch=globalThis.fetch;let loseAck=true;
  t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
    const response=await realFetch(input,init);
    if(loseAck&&String(input).endsWith('/sync/push')&&response.ok) {loseAck=false;await response.arrayBuffer();throw new TypeError('simulated_lost_ack');}
    return response;
  });
  try {
    scheduler.update({active:true,online:false});assert.equal(f.session.account().view(day).pendingCount,2);
    scheduler.update({active:true,online:true});await until(()=>scheduler.status().sync.phase==='retry_wait');
    assert.equal(f.session.account().view(day).pendingCount,2);
    await clock.advance(1000);await until(()=>scheduler.status().sync.phase==='idle');
    assert.equal(f.session.account().view(day).pendingCount,0);
    const transport=new HttpSync(origin,account,()=>f.session.accessToken(),()=>id(800));
    await synchronize(other,transport);
    assert.equal(other.view(day).totalXp,10);assert.equal(other.view(day).habits[0]?.done,true);
    scheduler.update({active:true,online:false});await f.session.logout();
    assert.equal(f.session.networkState().revocations,true);
    scheduler.update({active:true,online:true});await until(()=>!f.session.networkState().revocations);
    assert.equal(scheduler.status().revocations.phase,'idle');
  } finally {scheduler.dispose();other.close();f.close();}
});
