import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseReaderHierarchy,type ReaderNode as Node} from '../support/reader-hierarchy.ts';
import {openEmulatorTouch} from '../support/emulator-touch.ts';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import {getDayKey} from '../../src/features/gamification/domain/day-key.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
import {failureKind,retryDelay} from '../../src/core/sync/retry.ts';
// API fixture starts before the emulator. Accept only the launcher's verified discovery path.
if(process.env.RITMO_READER_BOOTSTRAP){
 const directory=resolve(process.env.RITMO_READER_BOOTSTRAP),ready=join(directory,'device.json'),deadline=Date.now()+240000;
 while(!existsSync(ready)&&Date.now()<deadline){if(existsSync(join(directory,'cancel')))throw new Error('reader_launch_canceled');await new Promise<void>(resolve=>setTimeout(resolve,200));}
 const data:unknown=JSON.parse(readFileSync(ready,'utf8'));
 assert.ok(data&&typeof data==='object'&&'discovery' in data&&typeof data.discovery==='string'&&'port' in data&&typeof data.port==='number'&&Number.isInteger(data.port));
 process.env.RITMO_EMULATOR_DISCOVERY=data.discovery;process.env.RITMO_EMULATOR_GRPC_PORT=String(data.port);
}
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,pkg='dev.ritmo.readonlytest',service='com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService',devicePort='tcp:18766';
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const rect=(n:Node)=>n.bounds!.match(/-?\d+/g)!.map(Number);
const point=(n:Node)=>{const b=rect(n);return [Math.floor((b[0]!+b[2]!)/2),Math.floor((b[1]!+b[3]!)/2)] as const;};
const described=(n:Node,label:string)=>n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails);
const matches=(n:Node,label:string)=>described(n,label)||n.text===label;
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};

test('TalkBack at200%: durable read-only gate, logout and compatible synthetic update',
 {skip:!serial||process.env.RITMO_READER_READONLY!=='1',timeout:1800000},async()=>{
 const origin=process.env.RITMO_TEST_API;assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));
 assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');assert.equal(adb('reverse','--list').includes(devicePort),false);
 // Observer target rejection is verified independently before this functional replay.
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE!);mkdirSync(folder,{recursive:true});
 const capture=(name:string)=>writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000,maxBuffer:16*1024*1024}));
 const observingFocus=process.env.RITMO_READER_OBSERVE_FOCUS==='1';assert.equal(observingFocus,false,'readonly_requires_strict_focus');
 const phases:string[]=[],targets:Record<string,unknown>[]=[],dialogFocus:Record<string,unknown>[]=[],builds:Record<string,unknown>[]=[],readOnlyFields:Record<string,unknown>[]=[];

 const report=(phase:string,fontScale=2)=>{phases.push(phase);const line=JSON.stringify({phase,passed:true,fontScale});console.log(line);if(process.env.RITMO_READER_PROGRESS)appendFileSync(process.env.RITMO_READER_PROGRESS,line+'\n');};
 const read=()=>{
  const result=adb('shell','am','instrument','-e','targetPackage',pkg,'-w','dev.ritmo.readerobserver/.ReaderObserver'),xml=result.match(/^INSTRUMENTATION_RESULT: hierarchy=(.*)$/m)?.[1];
  writeFileSync(join(folder,'latest-observer-status.json'),JSON.stringify({hierarchyAvailable:!!xml,error:result.match(/^INSTRUMENTATION_RESULT: observer_error=(.*)$/m)?.[1]??null},null,2)+'\n');
  if(!xml)return {nodes:[] as Node[],allNodes:[] as Node[],windows:[] as Node[],meta:{} as Node};
  writeFileSync(join(folder,'latest-hierarchy.xml'),xml+'\n');
  return parseReaderHierarchy(xml);
 };
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data');
 const keys=['enabled_accessibility_services','accessibility_enabled','touch_exploration_enabled'],saved=keys.map(key=>[key,adb('shell','settings','get','secure',key)] as const),font=adb('shell','settings','get','system','font_scale');
 const permission='android.permission.POST_NOTIFICATIONS',readerPackage='com.google.android.marvin.talkback';
 const notificationState=adb('shell','dumpsys','package',readerPackage).split('\n').find(l=>l.includes(permission+': granted='));assert.ok(notificationState);
 const notificationGranted=notificationState.includes('granted=true'),temporaryPermissionFlags=['user-set','user-fixed'].filter(f=>!notificationState.includes(f.toUpperCase().replace('-','_')));
 writeFileSync(join(folder,'reader-environment.json'),JSON.stringify({serial,pkg,secureSettings:Object.fromEntries(saved),fontScale:font,wifi,data,notificationGranted,temporaryPermissionFlags},null,2)+'\n');
 const touch=await openEmulatorTouch();let reversed=false,reader=false,success=false;
 const assertReader=()=>{const d=adb('shell','dumpsys','accessibility');assert.match(d,/Bound services:[^\n]*label=TalkBack[,}]/);assert.ok(d.includes('touchExplorationEnabled=true'));};
 const launch=(fault?:string)=>{adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-n',pkg+'/.MainActivity',...(fault?['-a','android.intent.action.VIEW','-d','ritmo:///?ritmoTestFault='+fault]:[]));};
 const scroll=async(down=true)=>{
  const tree=read(),n=tree.nodes.find(n=>n.scrollable==='true'&&n['visible-to-user']==='true');if(!n)return;
  const b=rect(n),ime=tree.meta['ime-visible']==='true'?tree.meta['ime-bounds']!.match(/-?\d+/g)!.map(Number)[1]!:Infinity;
  const top=Math.max(b[1]!,80),bottom=Math.min(b[3]!,ime)-40,x=Math.floor((b[0]!+b[2]!)/2)-40;
  if(bottom-top<120)return;
  const from=Math.floor(top+(bottom-top)*(down?0.8:0.3)),to=Math.floor(top+(bottom-top)*(down?0.3:0.8));
  if(reader){assertReader();await touch.scroll([x,from],[x,to]);assertReader();}else adb('shell','input','swipe',String(x),String(from),String(x),String(to),'300');
 };
 const top=async()=>{for(let i=0;i<3;i++)await scroll(false);};
 const find=async(label:string,allowScroll=true,minimumHeight=1):Promise<Node>=>{
  const deadline=Date.now()+75000;let swipes=0;
  while(Date.now()<deadline){const tree=read(),visible=tree.nodes.filter(n=>n['visible-to-user']==='true'&&rect(n)[3]!-rect(n)[1]!>=minimumHeight),n=visible.find(n=>described(n,label))??visible.find(n=>n.text===label);if(n)return n;
   if(allowScroll&&swipes++<14)await scroll(swipes<7);else await pause(300);
  }try{capture('failure-missing-target');}catch{}throw new Error('reader_target_missing_'+label);
 };
 const focus=async(label:string,minimumHeight=Math.floor(44*density)):Promise<Node>=>{
  assertReader();
  for(let i=0;i<3;i++){const n=await find(label,true,minimumHeight),p=point(n);await touch.down(p);await pause(650);await touch.up();await pause(500);const focused=read().nodes.find(n=>matches(n,label)&&n['accessibility-focused']==='true');if(focused){assertReader();return focused;}}
  throw new Error('reader_focus_missing_'+label);
 };
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
 const press=async(label:string)=>{
  const n=reader?await focus(label):await find(label,true,Math.floor(44*density));const b=rect(n);
  assert.ok(Math.min(b[2]!-b[0]!,b[3]!-b[1]!)>=Math.floor(44*density),'target_under_44_'+label);
  if(reader){const p=point(n);await touch.down(p);await pause(60);await touch.up();await pause(60);await touch.down(p);await pause(60);await touch.up();await pause(700);assertReader();targets.push({label,bounds:b,density});}
  else {const p=point(n);adb('shell','input','tap',String(p[0]),String(p[1]));await pause(300);}
 };
 const enter=async(label:string,value:string)=>{
  await top();const before=await find(label);await press(label);await pause(700);const field=await find(label),tree=read();
  assert.equal(field.focused,'true','input_not_focused_'+label);assert.equal(tree.meta['ime-visible'],'true','keyboard_not_visible');
  const imeTop=tree.meta['ime-bounds']!.match(/-?\d+/g)!.map(Number)[1]!;
  assert.ok(rect(field)[3]!<=imeTop,'field_hidden_by_keyboard_'+label);
  targets.push({label,inputBounds:rect(field),imeTop,focused:true});
  // Fixture text uses hardware key events; this is not proof of TalkBack character/cursor editing.
  adb('shell','input','keyevent','KEYCODE_MOVE_END');const length=field.password==='true'?128:Array.from(before.text??'').length;
  if(length)adb('shell','input','keyevent',...Array.from({length},()=>'KEYCODE_DEL'));
  adb('shell','input','text',value.replace(/ /g,'%s'));adb('shell','input','keyevent','KEYCODE_BACK');await pause(500);
  if(field.password!=='true')assert.equal((await find(label)).text,value);
 };

 const snapshot=(name:string)=>{const tree=read();if(!tree.meta['application-window-count']){capture(name);throw new Error('reader_snapshot_has_no_current_hierarchy');}writeFileSync(join(folder,name+'.xml'),readFileSync(join(folder,'latest-hierarchy.xml')));capture(name);};
 const focusedLabel=()=>{const n=read().nodes.find(n=>n['accessibility-focused']==='true');return n?.['content-desc']||n?.text;};
 const selected=async(label:string,control=true)=>{
  const n=await focus(label,control?Math.floor(44*density):1),tree=read(),focused=tree.allNodes.filter(n=>n['accessibility-focused']==='true');
  assert.equal(focused.length,1);assert.equal(tree.meta['focused-window-id'],n['window-id']);assert.equal(focused[0]!['window-id'],n['window-id']);
  return n;
 };
 const offline=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');};
 const restoreNetwork=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 const online=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;restoreNetwork();};
 const repeat=async<T,>(work:()=>Promise<T>):Promise<T>=>{for(let attempt=1;;attempt++)try{return await work();}catch(error){if(attempt>=3||failureKind(error)!=='retry')throw error;await pause(retryDelay(attempt,error,Date.now()));}};
 const create=async(name:string)=>{await press(pt.habits);await press(pt.newHabit);await enter(pt.habitName,name);await press(pt.createHabit);await press(pt.briefing);await find(pt.habitLabel(name,false));};
 const openSync=async()=>{await press(pt.syncDetails);await find(pt.syncTitle,false);assert.equal(focusedLabel(),pt.syncTitle);};
 const openReview=async(label:string,heading:string)=>{await press(label);await find(heading,false);assert.equal(focusedLabel(),heading);};
 const closeSync=async()=>{await press(pt.close);await find(pt.syncDetails);assert.ok(matches({'content-desc':focusedLabel()??''},pt.syncDetails),'sync_must_return_to_opener');};
 const diagnosis=async(name:string)=>{
  await press(pt.intentDetails);await find(pt.intentDetailsHide);const node=read().nodes.find(n=>n.text?.startsWith('{')&&n.text.includes('"intention"'));
  assert.ok(node?.text);const value:unknown=JSON.parse(node.text);assert.ok(value&&typeof value==='object'&&'intention' in value&&'diagnosis' in value);
  snapshot(name);await press(pt.intentDetailsHide);return value as {intention:Record<string,unknown>;diagnosis:unknown};
 };
 const originalAfterHistory=(original:Record<string,unknown>)=>{const values=read().nodes.filter(n=>n.text?.startsWith('{')).map(n=>JSON.parse(n.text!) as Record<string,unknown>);const value=values.find(v=>v.operationId===original.operationId);assert.ok(value,'history_original_not_found');assert.deepEqual(value,original);};
 const run=randomUUID(),email='readonly'+run+'@example.test',password='sync-reader-fixture-password';
 let other:ReturnType<typeof openTestStore>|undefined;
 try {
  if(!notificationGranted&&temporaryPermissionFlags.length)adb('shell','pm','set-permission-flags',readerPackage,permission,...temporaryPermissionFlags);
  adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;adb('shell','settings','put','system','font_scale','1.0');launch();
  const deadline=Date.now()+45000;let initial=read().nodes;
  while(!initial.some(n=>matches(n,pt.settings)||matches(n,pt.register)||matches(n,pt.initialLoading))&&Date.now()<deadline){await pause(300);initial=read().nodes;}
  if(initial.some(n=>matches(n,pt.initialLoading))){await press(pt.logout);await find(pt.register);}
  if(initial.some(n=>matches(n,pt.settings))){await press(pt.settings);await find(pt.profile,false);await press(pt.logout);await find(pt.logoutTitle);await press(pt.logout);}
  await find(pt.register);assert.match(adb('shell','dumpsys','package',pkg),/versionName=0[.]1[.]0/);adb('shell','settings','put','system','font_scale','2.0');launch();await find(pt.register);
  const preflight=point(await find(pt.register));await touch.down(preflight);await pause(60);await touch.up();await find(pt.name);
  const services=saved[0]![1]==='null'||!saved[0]![1]?service:saved[0]![1].split(':').includes(service)?saved[0]![1]:saved[0]![1]+':'+service;
  adb('shell','settings','put','secure','enabled_accessibility_services',services);adb('shell','settings','put','secure','accessibility_enabled','1');adb('shell','settings','put','secure','touch_exploration_enabled','1');
  const readerDeadline=Date.now()+20000;let ready=false;while(Date.now()<readerDeadline){try{assertReader();ready=true;break;}catch{await pause(300);}}
  assert.ok(ready);adb('shell','am','start','-W','-n',pkg+'/.MainActivity');await pause(3000);reader=true;report('reader_200_and_physical_input_ready');
  await enter(pt.name,'Pessoa de sincronizacao');await enter(pt.email,email);await enter(pt.password,password);await press(pt.register);await find(pt.timezone);
  await enter(pt.timezone,'UTC');await press(pt.continue);await find(pt.habitName);await enter(pt.habitName,'Base preservada');await press(pt.firstHabitAction);await find(pt.synced);report('real_account_onboarding_and_base_habit');
  const identity=new HttpIdentity(origin),credentials=await identity.login(email,password,uuid());other=openTestStore(':memory:',credentials.accountId,uuid());
  const transport=new HttpSync(origin,credentials.accountId,()=>credentials.accessToken,uuid),syncOther=()=>repeat(()=>synchronize(other!,transport));await syncOther();
  const instant=(await transport.pull(other.cursor())).serverTime,day=getDayKey(new Date(instant),credentials.profile.timeContext.timezone,credentials.profile.timeContext.dayStartHour);
  offline();await create('Recusa conservada');await press(pt.habitLabel('Recusa conservada',false));
  other.enqueue({type:'habit.create',habitId:uuid(),title:'Recusa conservada',habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:other.profile().timeContext,iconKey:'reading',colorToken:'blue',sortOrder:0},uuid(),instant);await syncOther();
  online();await find(pt.attention);await openSync();await press(pt.reviewChanges);
  const rejected=pt.reviewOperation('Criar hábito · Recusa conservada');await openReview(rejected,pt.rejectedTitle);const before=await diagnosis('01-rejected-before-gate');await press(pt.close);await closeSync();
  report('proven_rejection_prepared_without_resolving_it');
  offline();await create('Pendente preservado');await press(pt.habitLabel('Pendente preservado',false));await find(pt.totalXp(10));
  const historyOriginal=()=>{const node=read().nodes.find(n=>n.text?.startsWith('{')&&n.text.includes('"operationId"'));assert.ok(node?.text);const value:unknown=JSON.parse(node.text);assert.ok(value&&typeof value==='object'&&'operationId' in value);return value as Record<string,unknown>;};
  await openSync();await press(pt.syncHistory);await press(pt.intentDetails);const mark=historyOriginal();assert.equal((mark.command as {type:string}).type,'habit.mark');snapshot('02-offline-mark-original');
  await press(pt.intentDetails);const creation=historyOriginal();assert.equal((creation.command as {title:string}).title,'Pendente preservado');snapshot('02-offline-original');await press(pt.intentDetailsHide);await closeSync();
  launch('sync-update');await find(pt.habitLabel('Pendente preservado',true));assert.equal(adb('shell','settings','get','global','wifi_on'),'0');assert.equal(adb('shell','settings','get','global','mobile_data'),'0');assert.equal(adb('reverse','--list').includes(devicePort),false);online();await find(pt.update);await selected(pt.update,false);snapshot('03-required-update-readable');
  const checked=pt.habitLabel('Pendente preservado',true);assert.equal((await find(checked)).enabled,'false');await press(checked);assert.equal((await find(checked)).checked,'true');await find(pt.totalXp(10));
  report('426_preserves_reading_pending_original_and_provisional_xp');
  await press(pt.habits);for(const label of [pt.newHabit,pt.editLabel('Pendente preservado'),pt.moveLabel('Pendente preservado',-1)]){assert.equal((await find(label)).enabled,'false');await press(label);}
  assert.equal(read().nodes.some(n=>matches(n,pt.habitName)),false);snapshot('04-management-disabled-content-readable');await press(pt.briefing);
  await openSync();assert.equal((await find(pt.retry)).enabled,'false');await press(pt.retry);await selected(pt.update,false);await press(pt.reviewChanges);await openReview(rejected,pt.rejectedTitle);
  for(const label of [pt.habitName,pt.correctionStart,pt.timezone,pt.dayStart,pt.correctionOrder]){const field=await find(label);assert.equal(field.enabled,'false','readonly_input_enabled_'+label);assert.equal(field.focused,'false');readOnlyFields.push({label,bounds:rect(field),enabled:field.enabled,editableCapability:field.editable,inputFocused:field.focused});}
  for(const label of [pt.correctOperation,pt.discardOperation]){assert.equal((await find(label)).enabled,'false');await press(label);}
  assert.equal(read().meta['ime-visible'],'false');assert.equal(read().nodes.some(n=>matches(n,pt.discardConfirm)),false);assert.deepEqual(await diagnosis('05-readonly-diagnosis-original'),before);
  await press(pt.close);assert.equal(focusedLabel(),rejected);snapshot('05-readonly-return-to-opener');dialogFocus.push({name:'readonly_review_return',returned:focusedLabel(),expected:rejected});await closeSync();report('management_retry_correction_discard_disabled_but_diagnosis_readable');
  launch();await find(pt.update);assert.equal((await find(checked)).enabled,'false');snapshot('06-same-build-without-fault-still-blocked');
  offline();launch();await find(pt.update);await selected(pt.update,false);assert.equal((await find(checked)).checked,'true');snapshot('07-offline-restart-still-blocked');online();
  await syncOther();assert.equal(other.view(day).habits.some(h=>h.title==='Pendente preservado'),false);assert.equal(other.view(day).totalXp,0);report('same_build_restart_and_connectivity_do_not_release_durable_gate');
  await press(pt.settings);await press(pt.logout);await find(pt.logoutTitle);assert.equal(focusedLabel(),pt.logoutTitle);await selected(pt.logoutBody,false);await press(pt.cancel);assert.equal(focusedLabel(),pt.logout);
  snapshot('08-logout-cancel-preserves-session');dialogFocus.push({name:'logout_cancel_readonly',returned:focusedLabel(),expected:pt.logout});
  offline();await press(pt.logout);await find(pt.logoutTitle);await press(pt.logout);await find(pt.register);assert.equal(read().allNodes.some(n=>matches(n,checked)),false);snapshot('09-logout-hides-local-account');report('cancel_logout_preserves_focus_and_explicit_logout_hides_account');
  online();launch();await find(pt.register);await press(pt.hasAccount);await enter(pt.email,email);await enter(pt.password,password);await press(pt.login);await find(pt.update);await selected(pt.update,false);assert.equal(read().allNodes.some(n=>matches(n,checked)),false);snapshot('10-old-build-login-cannot-bypass-gate');report('login_on_same_build_explains_upgrade_without_exposing_closed_account');
  offline();adb('shell','am','force-stop',pkg);
  const updatedApk=resolve(import.meta.dirname,'../../../.scratch/runtime/interface/readonly-journey/updated.apk');
  const installed=execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'install','--no-incremental','-r',updatedApk],{encoding:'utf8',windowsHide:true,timeout:180000});assert.match(installed,/Success/);
  assert.match(adb('shell','dumpsys','package',pkg),/versionName=0[.]1[.]1/);
  const installedPath=adb('shell','pm','path',pkg).replace(/^package:/,'');assert.match(installedPath,/^\/data\/app\/[A-Za-z0-9._~+/=-]+\/base[.]apk$/);
  const updatedHash=createHash('sha256').update(readFileSync(updatedApk)).digest('hex');assert.equal(adb('shell','sha256sum',installedPath).split(/\s+/)[0],updatedHash);builds.push({build:'synthetic_updated',version:'0.1.1',apkSha256:updatedHash,installedWithoutReset:true});
  launch();await find(pt.register);await press(pt.hasAccount);await enter(pt.email,email);await enter(pt.password,password);await press(pt.login);await find(pt.offlineAuth);await selected(pt.offlineAuth,false);assert.equal(read().allNodes.some(n=>matches(n,checked)),false);snapshot('11-updated-build-offline-does-not-open-account');report('synthetic_update_preserves_installation_and_offline_authentication_gate');
  online();await press(pt.login);await find(checked);await find(pt.attention);await find(pt.totalXp(10));assert.equal((await find(checked)).enabled,'true');
  const convergenceDeadline=Date.now()+45000;do {await syncOther();if(other.view(day).habits.find(h=>h.title==='Pendente preservado')?.done&&other.view(day).totalXp===10) break;await pause(300);} while(Date.now()<convergenceDeadline);
  assert.equal(other.view(day).habits.filter(h=>h.title==='Pendente preservado').length,1);assert.equal(other.view(day).habits.find(h=>h.title==='Pendente preservado')?.done,true);assert.equal(other.view(day).totalXp,10);snapshot('12-compatible-response-releases-without-duplicate-xp');report('compatible_updated_login_restores_original_account_and_pending_result_once');
  await openSync();await press(pt.syncHistory);await press(pt.intentDetails);originalAfterHistory(mark);snapshot('13-mark-identity-survives-update');await press(pt.intentDetails);originalAfterHistory(creation);snapshot('13-original-identities-survive-update');await press(pt.intentDetailsHide);await closeSync();
  await openSync();await press(pt.reviewChanges);await openReview(rejected,pt.rejectedTitle);assert.deepEqual(await diagnosis('14-rejection-preserved-after-update'),before);assert.equal((await find(pt.correctOperation)).enabled,'true');assert.equal((await find(pt.discardOperation)).enabled,'true');await press(pt.close);await closeSync();
  await syncOther();assert.equal(other.view(day).totalXp,10);assert.equal(other.view(day).habits.filter(h=>h.title==='Recusa conservada').length,1);report('original_ids_rejection_and_remote_state_survive_the_upgrade');
  success=true;
 }catch(error){
  const diagnostic:Record<string,unknown>={};
  try{diagnostic.processPresent=!!adb('shell','pidof',pkg);}catch(problem){diagnostic.processQuery=problem instanceof Error?problem.message:'unknown';}
  try{diagnostic.foreground=adb('shell','dumpsys','window').split('\n').filter(line=>/mCurrentFocus=|mFocusedApp=/.test(line));}catch{diagnostic.foregroundQueryFailed=true;}
  writeFileSync(join(folder,'failure-app-state.json'),JSON.stringify(diagnostic,null,2)+'\n');
  try{snapshot('failure-reader-readonly');}catch{}throw error;
 }finally{
  other?.close();const failedSteps:string[]=[];
  const work=[{name:'bridge',run:()=>touch.close()},...saved.map(([k,v])=>({name:k,run:()=>v==='null'?adb('shell','settings','delete','secure',k):adb('shell','settings','put','secure',k,v)})),{name:'network',run:restoreNetwork},{name:'font',run:()=>adb('shell','settings','put','system','font_scale',font)},...(!notificationGranted&&temporaryPermissionFlags.length?[{name:'notifications',run:()=>adb('shell','pm','clear-permission-flags',readerPackage,permission,...temporaryPermissionFlags)}]:[]),{name:'stop_fixture',run:()=>adb('shell','am','force-stop',pkg)},...(reversed?[{name:'reverse',run:()=>adb('reverse','--remove',devicePort)}]:[])];
  for(const step of work)try{await step.run();}catch{failedSteps.push(step.name);}
  writeFileSync(join(folder,'reader-cleanup.json'),JSON.stringify({restored:!failedSteps.length,failedSteps},null,2)+'\n');
  const apkSha256=createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../../../.scratch/runtime/interface/readonly-journey/current.apk'))).digest('hex');
  writeFileSync(join(folder,'matrix-summary.json'),JSON.stringify({passed:success&&!failedSteps.length,apkSha256,fontScale:2,dialogFocus,builds,readOnlyFields,phases,targets,minimumLogicalUnits:44,pixelRounding:'floor',authentication:{touch:[touch.unauthenticatedCode,touch.wrongAudienceCode,touch.wrongIssuerCode]},physicalInput:'grpc.sendTouch',observer:'FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES',fixtureText:'adb.hardware_keys_not_spoken_character_editing',scope:'durable read-only gate and preserved work, diagnostic reading, same-build restart/logout/login, synthetic compatible update after closed-account offline gate; no active-account offline update, exhausted retry, nonzero staging, VoiceOver, spoken character editing, performance or full M1 acceptance',restored:!failedSteps.length},null,2)+'\n');
  if(failedSteps.length&&success)throw new Error('reader_cleanup_incomplete');
 }
});
