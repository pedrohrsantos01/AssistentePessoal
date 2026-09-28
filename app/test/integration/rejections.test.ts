import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import {fixture,id,command,at,day} from '../support/scheduler.ts';
const origin=process.env.RITMO_TEST_API;
assert.ok(origin,'RITMO_TEST_API must point to the disposable integration server');

test('a rejected offline chain is corrected after restart and converges through real HTTP without duplicate XP',async()=>{
  const f=fixture(),identity=new HttpIdentity(origin),email=randomUUID()+'@example.test';
  await identity.register(email,'fixture-password','Recovery',id(2));
  f.identity.login=(email,password,device)=>identity.login(email,password,device);
  f.identity.refresh=token=>identity.refresh(token);f.identity.revoke=token=>identity.revoke(token);
  await f.session.login(email,'fixture-password');
  const other=openTestStore(':memory:',f.session.account().accountId,id(99));let sequence=1000;
  const api=new HttpSync(origin,f.session.account().accountId,()=>f.session.accessToken(),()=>id(sequence++));
  try {
    f.session.account().enqueue(command,id(10),at);await f.session.synchronize(origin);
    const duplicate={...command,habitId:id(30)};
    const rejected=f.session.account().enqueue(duplicate,id(11),at);
    f.session.account().enqueue({type:'habit.mark',habitId:id(30),dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(12),at);
    await f.session.synchronize(origin);await f.restart();
    const errors=f.session.account().recovery();assert.equal(errors.length,2);
    assert.equal(errors[0]?.error.code,'title_unavailable');assert.deepEqual(errors[1]?.error.dependencyIds,[id(11)]);
    assert.equal(f.session.account().view(day).totalXp,0);
    f.session.account().correct([{operationId:id(11),replacementId:id(21),command:{...duplicate,title:'Caminhar cedo'}},
      {operationId:id(12),replacementId:id(22)}]);
    await f.restart();await f.session.synchronize(origin);await synchronize(other,api);
    assert.deepEqual(f.session.account().view(day),other.view(day));
    assert.equal(other.view(day).totalXp,10);assert.equal(other.view(day).habits.find(h=>h.habitId===id(30))?.done,true);
    const old=await api.push([rejected]);f.session.account().applyAck(old.results);
    assert.equal(old.results[0]&&'receipt' in old.results[0]?old.results[0].receipt.status:null,'rejected');
    assert.equal(f.session.account().view(day).rejectedCount,0);assert.equal(f.session.account().view(day).pendingCount,0);
    assert.ok(f.session.account().recovery().every(item=>item.resolution?.kind==='corrected'));
  } finally {other.close();f.close();}
});
