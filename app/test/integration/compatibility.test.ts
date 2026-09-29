import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import {fixture,id,command,at,day} from '../support/scheduler.ts';
const origin=process.env.RITMO_TEST_API;
assert.ok(origin,'RITMO_TEST_API must point to the disposable integration server');

test('an obsolete build preserves offline SQLite work through HTTP 426 and an updated build converges without duplicating XP',async()=>{
  const f=fixture(compatibility=>new HttpIdentity(origin,compatibility)),email=randomUUID()+'@example.test';
  try {
    await f.session.register(email,'fixture-password','Compatibility');
    const account=f.session.account().accountId;
    const intentions=[f.session.account().enqueue(command,id(10),at),
      f.session.account().enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at)];
    const before=f.session.account().view(day);
    await f.restart({appVersion:'0.0.9',protocol:'m1.1'});
    await assert.rejects(f.session.synchronize(origin),(error:unknown)=>error instanceof Error&&'status' in error&&error.status===426);
    assert.deepEqual(f.session.account().view(day),before);assert.deepEqual(f.session.account().operations(),intentions);
    await f.restart();assert.equal(f.session.access().mode,'read_only');
    await assert.rejects(f.session.synchronize(origin),/update_required/);
    assert.throws(()=>f.session.account().enqueue({...command,habitId:id(20)},id(12),at),/update_required/);
    await f.restart({appVersion:'0.1.0',protocol:'m1.1'});assert.equal(f.session.access().mode,'read_only');
    await f.session.synchronize(origin);assert.equal(f.session.access().mode,'read_write');
    assert.equal(f.session.account().view(day).pendingCount,0);assert.equal(f.session.account().view(day).totalXp,10);
    const otherSession=await new HttpIdentity(origin).login(email,'fixture-password',id(99));
    const other=openTestStore(':memory:',account,id(99));
    try {
      await synchronize(other,new HttpSync(origin,account,()=>otherSession.accessToken,()=>id(800)));
      assert.equal(other.view(day).habits.length,1);assert.equal(other.view(day).totalXp,10);
      await f.session.synchronize(origin);assert.equal(f.session.account().view(day).totalXp,10);
    } finally {other.close();}
  } finally {f.close();}
});
