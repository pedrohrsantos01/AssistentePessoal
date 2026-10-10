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

const remoteHabit=(n:number,title:string,sortOrder=0,iconKey:string|null='reading',colorToken:string|null='blue'):import('../src/core/sync/protocol.ts').Entity=>({kind:'habit',value:{habitId:id(n),title,sortOrder,iconKey,colorToken,habitType:'binary',scheduleKind:'daily',startDayKey:'2026-09-25',creationTimeContext:{timezone:'UTC',dayStartHour:4},createdAt:'2026-09-25T13:00:00Z',updatedAt:'2026-09-25T13:00:00Z',deletedAt:null,revision:'1'}});
function remoteHabits(store:import('../src/core/db/account-store.ts').AccountStore,entities:import('../src/core/sync/protocol.ts').Entity[],revision='1') {
 store.applyPull({changes:[{revision,operationResults:[],entities}],nextCursor:'cursor-'+revision,hasMore:false,highWaterRevision:revision,serverTime:'2026-09-25T13:00:00Z'});
}
test('editing sends only changed fields, preserves unknown metadata and independent remote fields, and survives reopening',async()=>{
 const s=setup();let journey=s.make();try {
  await s.f.session.login('a','password');journey.skip();const store=s.f.session.account();remoteHabits(store,[remoteHabit(301,'Original',7,'future-icon','future-color')]);
  const initial=journey.state().local!.habits[0]!,baseline={title:initial.title,iconKey:initial.iconKey!,colorToken:initial.colorToken!};
  const newer=remoteHabit(301,'Original',7,'future-icon','green');if(newer.kind==='habit') newer.value.revision='2';remoteHabits(store,[newer],'2');
  assert.equal(journey.edit(initial.habitId,baseline,{...baseline,title:'  Café e leitura  '}),true);
  assert.deepEqual(store.operations().at(-1)!.command,{type:'habit.patchMetadata',habitId:initial.habitId,patch:{title:'Café e leitura'}});
  assert.equal(journey.state().local?.habits[0]?.colorToken,'green');assert.equal(journey.state().local?.habits[0]?.iconKey,'future-icon');
  journey.dispose();await s.f.restart();journey=s.make();assert.equal(journey.state().local?.habits[0]?.title,'Café e leitura');assert.equal(journey.state().local?.habits[0]?.sortOrder,7);
  const current=journey.state().local!.habits[0]!,draft={title:current.title,iconKey:current.iconKey!,colorToken:current.colorToken!},before=s.f.session.account().operations().length;
  assert.equal(journey.edit(current.habitId,draft,draft),true);assert.equal(s.f.session.account().operations().length,before);
  // A canonical title from Java strip() may retain NBSP/FEFF. Metadata-only edits preserve it byte for byte.
  const spaced=remoteHabit(303,'\uFEFFNome\u00A0');if(spaced.kind==='habit') spaced.value.revision='3';remoteHabits(s.f.session.account(),[spaced],'3');
  const canonical={title:'\uFEFFNome\u00A0',iconKey:'reading',colorToken:'blue'};assert.equal(journey.edit(id(303),canonical,{...canonical,colorToken:'amber'}),true);
  assert.deepEqual(s.f.session.account().operations().at(-1)!.command,{type:'habit.patchMetadata',habitId:id(303),patch:{colorToken:'amber'}});assert.equal(journey.state().local!.managementHabits.find(h=>h.habitId===id(303))?.title,canonical.title);

 } finally {journey.dispose();s.close();}
});
test('canonical Unicode title collisions are blocked before creating or editing an offline intention',async()=>{
 const s=setup(),journey=s.make();try {
  await s.f.session.login('a','password');journey.skip();remoteHabits(s.f.session.account(),[remoteHabit(301,'Straße'),remoteHabit(302,'Outro',1)]);
  const before=s.f.session.account().operations().length;
  assert.equal(journey.create('ＳＴＲＡＳＳＥ','reading','blue',false),false);assert.equal(journey.state().error,pt.duplicateHabit);
  const baseline={title:'Outro',iconKey:'reading',colorToken:'blue'};
  assert.equal(journey.edit(id(302),baseline,{...baseline,title:'STRASSE'}),false);assert.equal(journey.state().error,pt.duplicateHabit);
  assert.equal(journey.edit(id(302),baseline,{...baseline,title:'  '}),false);assert.equal(journey.state().error,pt.invalidHabit);
  assert.equal(s.f.session.account().operations().length,before);
 } finally {journey.dispose();s.close();}
});
test('reordering tied positions is durable and atomic when a later write fails',async()=>{
 const s=setup();let journey=s.make();let fault:SQLite.Database|undefined;try {
  await s.f.session.login('a','password');journey.skip();const store=s.f.session.account();remoteHabits(store,[remoteHabit(301,'A'),remoteHabit(302,'B'),remoteHabit(303,'C')]);
  const before=store.operations();let publications=0;store.subscribe(()=>publications++);
  fault=new SQLite(s.f.accountPath(id(1)));fault.exec(`CREATE TRIGGER fail_reorder BEFORE INSERT ON sync_mutations WHEN json_extract(NEW.envelope,'$.command.type')='habit.patchMetadata' AND json_extract(NEW.envelope,'$.command.habitId')='${id(303)}' BEGIN SELECT RAISE(ABORT,'fixture'); END`);
  assert.equal(journey.move(id(301),1),false);assert.deepEqual(store.operations(),before);assert.deepEqual(journey.state().local?.habits.map(h=>h.title),['A','B','C']);assert.equal(publications,0);
  fault.exec('DROP TRIGGER fail_reorder');assert.equal(journey.move(id(301),1),true);assert.equal(publications,1);assert.deepEqual(journey.state().local?.habits.map(h=>h.title),['B','A','C']);
  const patches=store.operations().slice(before.length);assert.equal(patches.length,2);assert.deepEqual(patches[0]!.command,{type:'habit.patchMetadata',habitId:id(301),patch:{sortOrder:1}});
  fault.close();fault=undefined;journey.dispose();await s.f.restart();journey=s.make();assert.deepEqual(journey.state().local?.habits.map(h=>h.title),['B','A','C']);
 } finally {fault?.close();journey.dispose();s.close();}
});
test('deletion removes local habit and XP, survives restart and cannot target another account',async()=>{
 const s=setup();let journey=s.make();try {
  await s.f.session.login('a','password');journey.confirmTime({timezone:'UTC',dayStartHour:4});journey.create('Excluir','reading','blue',true);const habit=journey.state().local!.habits[0]!;
  journey.toggle(habit.habitId,false);assert.equal(journey.state().local?.totalXp,10);assert.equal(journey.delete(habit.habitId),true);assert.equal(journey.state().local?.totalXp,0);assert.deepEqual(journey.state().local?.habits,[]);
  journey.dispose();await s.f.restart();journey=s.make();assert.equal(journey.state().local?.totalXp,0);assert.deepEqual(journey.state().local?.habits,[]);
  await s.f.session.logout();await s.f.session.login('b','password');const before=s.f.session.account().operations();assert.equal(journey.delete(habit.habitId),false);assert.equal(journey.edit(habit.habitId,{title:'Excluir',iconKey:'reading',colorToken:'blue'},{title:'Vazamento',iconKey:'reading',colorToken:'blue'}),false);assert.deepEqual(s.f.session.account().operations(),before);
 } finally {journey.dispose();s.close();}
});


test('management includes a not-started habit; Briefing and marking remain limited to due habits',async()=>{
 const s=setup(),journey=s.make();try {
  await s.f.session.login('a','password');journey.skip();const store=s.f.session.account(),future=remoteHabit(301,'Amanhã');
  if(future.kind==='habit') future.value.startDayKey='2026-09-26';remoteHabits(store,[future]);
  assert.equal(journey.state().local?.habits.length,0);assert.equal(journey.state().local?.managementHabits[0]?.title,'Amanhã');
  const before=store.operations();journey.toggle(id(301),false);assert.deepEqual(store.operations(),before);
  assert.equal(journey.create('AMANHÃ','reading','blue',false),false);assert.equal(journey.state().error,pt.duplicateHabit);
  const baseline={title:'Amanhã',iconKey:'reading',colorToken:'blue'};assert.equal(journey.edit(id(301),baseline,{...baseline,title:'Próximo dia'}),true);
  assert.equal(journey.state().local?.managementHabits[0]?.title,'Próximo dia');assert.equal(journey.state().local?.habits.length,0);
  assert.equal(journey.delete(id(301)),true);assert.equal(journey.state().local?.managementHabits.length,0);
 } finally {journey.dispose();s.close();}
});


test('local writes continue while vault recovery is pending and keep the same queue',async()=>{
 const s=setup(),journey=s.make();let resume=()=>{};try {
  await s.f.session.login('a','password');journey.skip();
  const read=s.f.vault.get;s.f.vault.get=async()=>{throw new Error('private_platform_message');};await s.f.session.retryVault();
  assert.equal(s.f.session.vaultRecovery().unavailable,true);
  let entered=()=>{};const started=new Promise<void>(resolve=>{entered=resolve;});const wait=new Promise<void>(resolve=>{resume=resolve;});
  s.f.vault.get=async key=>{entered();await wait;return read(key);};const retry=journey.retry();await started;
  assert.equal(journey.create('Durante retomada','reading','blue',false),true);
  const queue=s.f.session.account().operations();assert.ok(queue.some(op=>op.command.type==='habit.create'&&op.command.title==='Durante retomada'));
  resume();await retry;assert.equal(s.f.session.vaultRecovery().unavailable,false);assert.deepEqual(s.f.session.account().operations(),queue);
 } finally {resume();journey.dispose();s.close();}
});


test('a late authentication failure from A cannot publish an error into B',async()=>{
 const s=setup(),journey=s.make();let resume=()=>{},resumeB=()=>{};try {
  await s.f.session.login('a','password');journey.skip();
  s.scheduler.update({active:false,online:true});
  const login=s.f.identity.login;let entered=()=>{};const started=new Promise<void>(resolve=>{entered=resolve;});const wait=new Promise<void>(resolve=>{resume=resolve;});
  s.f.identity.login=async()=>{entered();await wait;throw new Error('private_result_for_A');};
  const pending=journey.authenticate('login','a@example.test','password','');await started;
  await journey.logout();assert.equal(journey.state().local,null,'logout must fence an outstanding authentication');
  let enteredB=()=>{};const startedB=new Promise<void>(resolve=>{enteredB=resolve;});const waitB=new Promise<void>(resolve=>{resumeB=resolve;});
  s.f.identity.login=async(...args)=>{enteredB();await waitB;return login(...args);};const pendingB=journey.authenticate('login','b@example.test','password','');await startedB;
  resume();await pending;assert.equal(journey.state().busy,true,'the old action cannot unlock the new login');assert.equal(journey.state().error,null);
  resumeB();await pendingB;assert.ok(journey.state().key?.startsWith(id(99)+':'));
  assert.equal(journey.state().local?.profile.accountId,id(99));assert.equal(journey.state().error,null);
 } finally {resume();resumeB();journey.dispose();s.close();}
});
