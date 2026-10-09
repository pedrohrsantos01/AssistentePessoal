import {test} from 'node:test';
import assert from 'node:assert/strict';
import SQLite from 'better-sqlite3';
import {Journey} from '../src/features/journey/journey.ts';
import {SyncScheduler} from '../src/core/sync/scheduler.ts';
import {fixture,id,Clock,settle,credentials} from './support/scheduler.ts';
import {getDayKey,nextLogicalDayAt} from '../src/features/gamification/domain/day-key.ts';
import {pt} from '../src/i18n/pt-BR.ts';
function setup() {
 const f=fixture(),clock=new Clock(),scheduler=new SyncScheduler(f.session,'http://fixture.invalid',clock);
 let sequence=200;
 const make=()=>new Journey({session:f.session,sync:scheduler,recovery:()=>f.session.databaseRecovery(),retryDatabase:()=>f.session.retryDatabase(),close:()=>{}},()=>id(++sequence),clock);
 return {f,clock,scheduler,make,close(){scheduler.dispose();f.close();}};
}
test('public journey resumes the local onboarding step, skip gives useful data, and another account cannot read it',async()=>{
 const s=setup();let journey=s.make();
 try {
  await s.f.session.login('a','password');journey.refresh();assert.equal(journey.state().local?.step,'time_context');
  assert.equal(journey.confirmTime({timezone:'America/Sao_Paulo',dayStartHour:4}),true);
  assert.equal(journey.state().local?.step,'first_habit');journey.dispose();await s.f.restart();journey=s.make();
  assert.equal(journey.state().local?.step,'first_habit');assert.equal(journey.state().local?.profile.timeContext.timezone,'America/Sao_Paulo');
  assert.equal(journey.skip(),true);assert.equal(journey.state().local?.step,'complete');assert.equal(journey.state().local?.habits.length,0);
  assert.equal(journey.create('Meditar','meditation','accent',false),true);journey.toggle(journey.state().local!.habits[0]!.habitId,false);
  assert.equal(journey.state().local?.totalXp,10);await s.f.session.logout();assert.equal(journey.state().local,null);
  await s.f.session.login('b','password');assert.equal(journey.state().local?.habits.length,0);assert.equal(journey.state().local?.totalXp,0);
  await s.f.session.logout();await s.f.session.login('a','password');assert.equal(journey.state().local?.totalXp,10);
 } finally {journey.dispose();s.close();}
});
test('offline mark, rapid duplicate tap, undo and remark use the original occurrence and survive process reopening',async()=>{
 const s=setup();let journey=s.make();
 try {
  await s.f.session.login('a','password');journey.confirmTime({timezone:'UTC',dayStartHour:4});journey.create('Ler','reading','blue',true);
  const habit=journey.state().local!.habits[0]!,store=s.f.session.account();
  journey.toggle(habit.habitId,false);const count=store.operations().length;journey.toggle(habit.habitId,false);
  assert.equal(store.operations().length,count);assert.equal(journey.state().local?.totalXp,10);
  journey.toggle(habit.habitId,true);assert.equal(journey.state().local?.totalXp,0);journey.toggle(habit.habitId,false);
  const remark=store.operations().at(-1)!.command;assert.equal(remark.type,'habit.mark');
  assert.deepEqual(remark.type==='habit.mark'?remark.observedUndoIds:[],[store.operations().at(-2)!.operationId]);
  const original=store.operations();journey.dispose();await s.f.restart();journey=s.make();
  assert.deepEqual(s.f.session.account().operations(),original);assert.equal(journey.state().local?.totalXp,10);assert.equal(journey.state().local?.habits[0]?.done,true);
 } finally {journey.dispose();s.close();}
});
test('a failed transaction cannot advance onboarding or announce a habit, XP, or successful write',async()=>{
 const s=setup(),journey=s.make();let fault:SQLite.Database|undefined;
 try {
  await s.f.session.login('a','password');journey.confirmTime({timezone:'UTC',dayStartHour:4});
  // An independent connection injects the failure in the durable projection, not in the UI.
  const store=s.f.session.account();
  fault=new SQLite(s.f.accountPath(id(1)));fault.exec("CREATE TRIGGER fail_ui BEFORE INSERT ON projected_views BEGIN SELECT RAISE(ABORT,'test_failure'); END");
  let published=0;store.subscribe(()=>published++);
  const before=store.operations();assert.equal(journey.create('Caminhar','walking','green',true),false);
  assert.deepEqual(store.operations(),before);assert.equal(published,0);assert.equal(journey.state().local?.step,'first_habit');assert.equal(journey.state().local?.habits.length,0);assert.equal(journey.state().error,pt.localFailure);
  fault.exec('DROP TRIGGER fail_ui');assert.equal(journey.create('Caminhar','walking','green',true),true);assert.equal(published,1);
 } finally {fault?.close();journey.dispose();s.close();}
});
test('local projection subscriptions deliver committed changes and a pull, but never a rolled-back intention',async()=>{
 const s=setup(),journey=s.make();try {
  await s.f.session.login('a','password');let notices=0;const unsubscribe=journey.subscribe(()=>notices++);
  journey.confirmTime({timezone:'UTC',dayStartHour:4});journey.skip();assert.ok(notices>0);
  s.f.session.account().applyPull({changes:[{revision:'2',operationResults:[],entities:[{kind:'profile',value:{...s.f.session.account().profile(),displayName:'Nome remoto',revision:'2'}}]}],nextCursor:'cursor',hasMore:false,highWaterRevision:'2',serverTime:new Date(s.clock.now()).toISOString()});
  assert.equal(journey.state().local?.profile.displayName,'Nome remoto');unsubscribe();
 } finally {journey.dispose();s.close();}
});
test('open Briefing changes at the configured boundary and the next tap uses the new logical day',async()=>{
 const s=setup(),journey=s.make();try {
  s.clock.time=Date.parse('2026-09-25T03:59:59Z');await s.f.session.login('a','password');journey.confirmTime({timezone:'UTC',dayStartHour:4});journey.create('Ler','reading','blue',true);
  const habit=journey.state().local!.habits[0]!;journey.toggle(habit.habitId,false);assert.equal(journey.state().day,'2026-09-24');
  await s.clock.advance(1000);assert.equal(journey.state().day,'2026-09-25');assert.equal(journey.state().local?.habits[0]?.done,false);
  journey.toggle(habit.habitId,false);assert.equal(journey.state().local?.totalXp,20);assert.equal(journey.state().local?.todayXp,10);
 } finally {journey.dispose();s.close();}
});
test('authentication validation and offline failures do not activate a local account',async()=>{
 const s=setup(),journey=s.make();try {
  await journey.authenticate('register','wrong','123','');assert.equal(journey.state().error,pt.invalidEmail);
  await journey.authenticate('register','a@example.test','password','Pessoa');assert.equal(journey.state().error,pt.offlineAuth);assert.equal(journey.state().local,null);await settle();
 } finally {journey.dispose();s.close();}
});
for(const [instant,timezone,hour,expected] of [
 ['2026-03-08T06:59:59Z','America/New_York',2,'2026-03-08T07:00:00Z'],
 ['2026-11-01T04:59:59Z','America/New_York',1,'2026-11-01T05:00:00Z'],
 ['2026-09-25T21:59:59Z','Asia/Kathmandu',4,'2026-09-25T22:15:00Z'],
] as const) test('next logical boundary '+timezone+' '+instant,()=>{
 const boundary=nextLogicalDayAt(new Date(instant),timezone,hour);assert.equal(boundary,Date.parse(expected));
 assert.notEqual(getDayKey(new Date(boundary-1),timezone,hour),getDayKey(new Date(boundary),timezone,hour));
});


test('a failed remote pull with no pending changes is never presented as synchronized',async()=>{
 const s=setup(),journey=s.make();try {
  await s.f.session.login('a','password');const store=s.f.session.account();
  store.applyPull({changes:[{revision:'1',operationResults:[],entities:[{kind:'profile',value:{...store.profile(),onboardedAt:'2026-09-25T13:00:00Z',revision:'1'}}]}],nextCursor:'cursor',hasMore:false,highWaterRevision:'1',serverTime:'2026-09-25T13:00:00Z'});
  s.f.session.synchronize=async()=>{throw new TypeError('fixture_network_failure');};
  s.scheduler.update({active:true,online:true});await settle();
  assert.equal(journey.state().local?.pendingCount,0);assert.equal(journey.state().remote,pt.serviceUnavailable);
 } finally {journey.dispose();s.close();}
});


test('account validation counts Unicode code points, normalizes only the name and preserves the password',async()=>{
 const s=setup(),journey=s.make();let sent:{password:string;name:string}|null=null;try {
  s.f.identity.register=async(_email,password,name)=>{sent={password,name};return credentials(id(1));};
  s.f.session.synchronize=async()=>undefined;s.scheduler.update({active:true,online:true});
  await journey.authenticate('register','a@example.test','😀'.repeat(7),'Pessoa');assert.equal(journey.state().error,pt.invalidPassword);assert.equal(sent,null);
  await journey.authenticate('register','a@example.test','\ud800abcdefgh','Pessoa');assert.equal(journey.state().error,pt.invalidPassword);assert.equal(sent,null);
  await journey.authenticate('register','a@example.test','😀'.repeat(8),'e\u0301'.repeat(80));
  assert.deepEqual(sent,{password:'😀'.repeat(8),name:'é'.repeat(80)});assert.equal(journey.state().gate,'account');
 } finally {journey.dispose();s.close();}
});
