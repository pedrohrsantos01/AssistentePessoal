import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ManualController } from '../src/iphone/controller.ts';
import { Coordinator } from '../src/local/coordinator.ts';
import { setup,login,id,at,day,timeContext } from './local-support.ts';
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
async function fixture(mode:'normal'|'unconfirmed'|'lost-login'='normal') {
  const f=await setup(),context=id(),account=id(),calls:string[]=[];
  const installation=(await f.repo.db.installation_control.get(1))!.installation_id;
  const session={contextId:context,installationId:installation,accountId:account,authenticatedAt:at,idleExpiresAt:at,absoluteExpiresAt:at,ownerEpoch:f.owner.epoch,ownerTabId:f.owner.tab,profile:{accountId:account,displayName:'Fixture',timeContext,plan:'free',onboardedAt:null,analyticsConsentAt:null,revision:'1'}};
  const request:typeof fetch=async(input,init)=>{
    const path=String(input);calls.push(path);const body=JSON.parse(String(init?.body)) as Record<string,unknown>;
    if(path.endsWith('/auth/challenge'))return json({attemptId:body.attemptId,installationId:installation,contextId:context,issuedAt:at,ticketExpiresAt:at,reservationExpiresAt:at,closeCookieExpiresAt:at,preparationTicket:'x'.repeat(48)});
    if(path.endsWith('/auth/prepare'))return json({contextId:context,installationId:installation,reservationExpiresAt:at,closeCookieExpiresAt:at});
    if(path.endsWith('/confirm-reservation'))return mode==='unconfirmed'?json({},401):json({contextId:context,installationId:installation,reservationExpiresAt:at,closeCookieExpiresAt:at});
    if(path.endsWith('/register')||path.endsWith('/login'))return mode==='lost-login'?new Response('{',{status:201}):json(session);
    if(path.endsWith('/inspect'))return json(session);
    throw new Error('fixture_unexpected_route');
  };
  const controller=new ManualController(f.repo,()=>{},request);await controller.take(false);
  return {...f,controller,calls};
}
test('manual auth requires close-cookie proof before password, preserving an uncertain dispatched preparation',async()=>{
  const f=await fixture('unconfirmed');try {
    await assert.rejects(f.controller.login('a@fixture.example.test','fixture-password',true));
    assert.equal(f.calls.some(p=>p.endsWith('/register')),false);
    const [j]=await f.controller.journals();assert.equal(j!.phase,'preparing');assert.equal(j!.prepare_dispatched,true);
    assert.equal(f.controller.lease,null);
    const stored=JSON.stringify(await f.repo.db.auth_journal.toArray());assert.ok(!stored.includes('fixture-password')&&!stored.includes('x'.repeat(48)));
  }finally {await f.close();}
});
test('manual inspection recovers a lost login body without replaying password or creating a context',async()=>{
  const f=await fixture('lost-login');try {
    await assert.rejects(f.controller.login('a@fixture.example.test','fixture-password',true));
    assert.equal(f.controller.lease,null);await f.controller.inspect();assert.ok(f.controller.lease);
    assert.equal(f.calls.filter(p=>p.endsWith('/register')).length,1);assert.equal(f.calls.filter(p=>p.endsWith('/auth/challenge')).length,1);
  }finally {await f.close();}
});
test('late challenge cannot dispatch preparation after another document owns the installation',async()=>{
  const f=await setup(),other=new Coordinator(id(),f.locks);await other.start();
  try {
    const request:typeof fetch=async()=>{await other.acquire(f.db,true);return json({});};
    const controller=new ManualController(f.repo,()=>{},request);await controller.take(false);
    await assert.rejects(controller.login('a@fixture.example.test','fixture-password',true),/owner_lost/);
    const [j]=await controller.journals();assert.equal(j!.phase,'challenging');assert.equal(j!.prepare_dispatched,false);assert.equal(j!.context_id,null);
  }finally {await other.stop();await f.close();}
});
test('manual quota abort preserves exact queue/sequence and removes its hook for a later valid command',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),controller=new ManualController(f.repo,()=>{});await controller.take(false);
    const before=await f.repo.read(lease,day);await assert.rejects(controller.create('unsaved',true),{name:'QuotaExceededError'});
    assert.deepEqual(await f.repo.read(lease,day),before);await controller.create('saved');assert.equal(controller.read!.view.habits.length,1);
  }finally {await f.close();}
});
test('an old secondary document never selects B after logout A and a new account login',async()=>{
  const f=await setup();try {
    await login(f.repo,f.owner);const reader=new ManualController(f.repo,()=>{});await reader.take(false);
    await f.repo.logout(reader.lease!);await login(f.repo,f.owner);
    await assert.rejects(reader.refresh(),/session_locked/);assert.equal(reader.read,null);assert.equal(reader.lease,null);
  }finally {await f.close();}
});
test('manual reopen preserves an upgrade_required flag instead of enabling a blocked build',async()=>{
  const f=await setup();try {
    await login(f.repo,f.owner);await f.repo.setCompatibility(f.owner,'upgrade_required',at);
    const controller=new ManualController(f.repo,()=>{});await controller.take(false);
    assert.equal((await f.repo.db.build_compatibility.get([f.repo.build,'m1.1',1]))!.state,'upgrade_required');
    await assert.rejects(controller.create('blocked'),/update_required/);
  }finally {await f.close();}
});

test('manual aborted migration restores exact V1 sequence/queue after mutating inside the upgrade transaction',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),controller=new ManualController(f.repo,()=>{});await controller.take(false);await controller.create('preserved');
    const before=await f.repo.read(lease,day);await controller.abortMigration();
    assert.equal(f.repo.db.backendDB().version,10);assert.deepEqual(await f.repo.read(lease,day),before);
  }finally {await f.close();}
});

test('an unreadable account state removes the previous visible view and blocks writes without repairing data',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),controller=new ManualController(f.repo,()=>{});await controller.take(false);await controller.create('old cached view');
    await f.repo.db.sync_state.update(lease.account,{next_sequence:-1});await assert.rejects(controller.refresh(),/storage_unreadable/);
    assert.equal(controller.read,null);assert.equal(controller.writable,false);assert.equal((await f.repo.db.sync_state.get(lease.account))!.next_sequence,-1);
  }finally {await f.close();}
});

test('manual mark observes canonical and pending undos in the same committed transaction',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),controller=new ManualController(f.repo,()=>{});await controller.take(false);await controller.create('remarked');
    const habit=controller.read!.view.habits[0]!.habitId;await controller.mark(habit);
    const first=controller.read!.operations.find(row=>row.envelope.command.type==='habit.mark')!.envelope.command;assert.equal(first.type,'habit.mark');if(first.type!=='habit.mark')throw new Error('fixture');
    const historical=id(),dayId=id(),value={habitDayId:dayId,habitId:habit,dayKey:first.dayKey,done:false,knownUndoIds:[historical],revision:'2'};
    await f.repo.db.canonical_entities.put({account_id:lease.account,kind:'habitDay',entity_key:dayId,revision:'2',payload:{kind:'habitDay',value}});
    const undo=await f.repo.enqueue(lease,{type:'habit.unmark',habitId:habit,dayKey:first.dayKey,timeContext},id(),at);
    await controller.refresh();assert.equal(controller.read!.view.habits[0]!.done,false);await controller.mark(habit);
    const last=controller.read!.operations.at(-1)!.envelope.command;assert.equal(last.type,'habit.mark');if(last.type!=='habit.mark')throw new Error('fixture');
    assert.deepEqual(new Set(last.observedUndoIds),new Set([historical,undo.operationId]));assert.equal(controller.read!.view.habits[0]!.done,true);
  }finally {await f.close();}
});

test('an explicit password retry reconfirms the close cookie and sends no password when that proof disappears',async()=>{
  const f=await setup(),context=id(),installation=(await f.repo.db.installation_control.get(1))!.installation_id;let confirms=0,passwords=0;
  try {
    const request:typeof fetch=async(input,init)=>{
      const path=String(input),body=JSON.parse(String(init?.body)) as Record<string,unknown>;
      if(path.endsWith('/auth/challenge'))return json({attemptId:body.attemptId,installationId:installation,contextId:context,issuedAt:at,ticketExpiresAt:at,reservationExpiresAt:at,closeCookieExpiresAt:at,preparationTicket:'x'.repeat(48)});
      if(path.endsWith('/auth/prepare'))return json({contextId:context,installationId:installation,reservationExpiresAt:at,closeCookieExpiresAt:at});
      if(path.endsWith('/confirm-reservation'))return ++confirms===1?json({contextId:context,installationId:installation,reservationExpiresAt:at,closeCookieExpiresAt:at}):json({},401);
      if(path.endsWith('/login')) {passwords++;return json({},401);}
      throw new Error('fixture_unexpected_route');
    };
    const controller=new ManualController(f.repo,()=>{},request);await controller.take(false);
    await assert.rejects(controller.login('a@fixture.example.test','fixture-password',false));await assert.rejects(controller.login('a@fixture.example.test','fixture-password',false));
    assert.equal(confirms,2);assert.equal(passwords,1);assert.equal((await controller.journals())[0]!.phase,'reserved');
  }finally {await f.close();}
});
