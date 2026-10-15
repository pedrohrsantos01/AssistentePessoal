import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {openEmulatorTouch} from '../support/emulator-touch.ts';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import {getDayKey} from '../../src/features/gamification/domain/day-key.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
// API fixture starts before the emulator. Accept only the launcher's verified discovery path.
if(process.env.RITMO_READER_BOOTSTRAP){
 const directory=resolve(process.env.RITMO_READER_BOOTSTRAP),ready=join(directory,'device.json'),deadline=Date.now()+240000;
 while(!existsSync(ready)&&Date.now()<deadline){if(existsSync(join(directory,'cancel')))throw new Error('reader_launch_canceled');await new Promise<void>(resolve=>setTimeout(resolve,200));}
 const data:unknown=JSON.parse(readFileSync(ready,'utf8'));
 assert.ok(data&&typeof data==='object'&&'discovery' in data&&typeof data.discovery==='string'&&'port' in data&&typeof data.port==='number'&&Number.isInteger(data.port));
 process.env.RITMO_EMULATOR_DISCOVERY=data.discovery;process.env.RITMO_EMULATOR_GRPC_PORT=String(data.port);
}
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,pkg='dev.ritmo.journeytest',service='com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService',devicePort='tcp:18766';
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
type Node=Record<string,string>;
const decode=(s:string)=>s.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_m,h:string|undefined,d:string|undefined)=>String.fromCodePoint(Number.parseInt(h??d!,h?16:10))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attributes=(s:string):Node=>Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1]!,decode(m[2]!)]));
const rect=(n:Node)=>n.bounds!.match(/-?\d+/g)!.map(Number);
const point=(n:Node)=>{const b=rect(n);return [Math.floor((b[0]!+b[2]!)/2),Math.floor((b[1]!+b[3]!)/2)] as const;};
const described=(n:Node,label:string)=>n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails);
const matches=(n:Node,label:string)=>described(n,label)||n.text===label;
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};

test('TalkBack at200%: real account/onboarding, forms/IME, sheets, validation and preserved local failures',
 {skip:!serial||process.env.RITMO_ANDROID_READER_MATRIX!=='1',timeout:1800000},async()=>{
 const origin=process.env.RITMO_TEST_API;assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));
 assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');assert.equal(adb('reverse','--list').includes(devicePort),false);
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE!);mkdirSync(folder,{recursive:true});
 const capture=(name:string)=>writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000}));
 const observingFocus=process.env.RITMO_READER_OBSERVE_FOCUS==='1';
 const phases:string[]=[],targets:Record<string,unknown>[]=[],dialogFocus:Record<string,unknown>[]=[];
 if(observingFocus){const line=JSON.stringify({phase:'focus_observation_only',fullAcceptance:false});console.log(line);if(process.env.RITMO_READER_PROGRESS)appendFileSync(process.env.RITMO_READER_PROGRESS,line+'\n');}
 const report=(phase:string,fontScale=2)=>{phases.push(phase);const line=JSON.stringify({phase,passed:true,fontScale});console.log(line);if(process.env.RITMO_READER_PROGRESS)appendFileSync(process.env.RITMO_READER_PROGRESS,line+'\n');};
 const read=()=>{
  const result=adb('shell','am','instrument','-w','dev.ritmo.readerobserver/.ReaderObserver'),xml=result.match(/^INSTRUMENTATION_RESULT: hierarchy=(.*)$/m)?.[1];
  if(!xml)return {nodes:[] as Node[],meta:{} as Node};
  writeFileSync(join(folder,'latest-hierarchy.xml'),xml+'\n');
  return {nodes:[...xml.matchAll(/<node\s+([^>]+)>?/g)].map(m=>attributes(m[1]!)),meta:attributes(xml.match(/<hierarchy\s+([^>]+)>/)?.[1]??'')};
 };
 const keys=['enabled_accessibility_services','accessibility_enabled','touch_exploration_enabled'],saved=keys.map(key=>[key,adb('shell','settings','get','secure',key)] as const),font=adb('shell','settings','get','system','font_scale');
 const permission='android.permission.POST_NOTIFICATIONS',readerPackage='com.google.android.marvin.talkback';
 const notificationState=adb('shell','dumpsys','package',readerPackage).split('\n').find(l=>l.includes(permission+': granted='));assert.ok(notificationState);
 const notificationGranted=notificationState.includes('granted=true'),temporaryPermissionFlags=['user-set','user-fixed'].filter(f=>!notificationState.includes(f.toUpperCase().replace('-','_')));
 writeFileSync(join(folder,'reader-environment.json'),JSON.stringify({serial,pkg,secureSettings:Object.fromEntries(saved),fontScale:font,notificationGranted,temporaryPermissionFlags},null,2)+'\n');
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
  }capture('failure-missing-target');throw new Error('reader_target_missing_'+label);
 };
 const focus=async(label:string):Promise<Node>=>{
  const n=await find(label,true,Math.floor(44*density)),p=point(n);assertReader();
  for(let i=0;i<3;i++){await touch.down(p);await pause(650);await touch.up();await pause(500);const focused=read().nodes.find(n=>matches(n,label)&&n['accessibility-focused']==='true');if(focused){assertReader();return focused;}}
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
  adb('shell','input','keyevent','KEYCODE_MOVE_END');const length=Array.from(before.text??'').length;
  if(length)adb('shell','input','keyevent',...Array.from({length},()=>'KEYCODE_DEL'));
  adb('shell','input','text',value.replace(/ /g,'%s'));adb('shell','input','keyevent','KEYCODE_BACK');await pause(500);
  if(field.password!=='true')assert.equal((await find(label)).text,value);
 };
 const focusedLabel=()=>{const n=read().nodes.find(n=>n['accessibility-focused']==='true');return n?.['content-desc']||n?.text;};
 const sheet=async(opener:string,title:string,close:string,name:string)=>{
  await press(opener);await find(title,false);assertReader();const entry=focusedLabel();assert.ok(entry,'sheet_has_no_reader_focus');if(!observingFocus)assert.equal(entry,title,'sheet_entry_focus_'+name);capture(name+'-entry');
  assert.equal(read().nodes.some(n=>matches(n,pt.settings)),false,'sheet_background_exposed');
  await press(close);await find(opener);const returned=focusedLabel();dialogFocus.push({name,opener,title,entry,returned:returned??null});if(!observingFocus)assert.equal(returned,opener,'sheet_return_focus_'+name);capture(name+'-return');report(name);
 };
 const email=randomUUID()+'@example.test',password='reader-fixture-password',title='Leitura de um capitulo com conteudo longo para testar o foco e a quebra de linha';
 try {
  if(!notificationGranted&&temporaryPermissionFlags.length)adb('shell','pm','set-permission-flags',readerPackage,permission,...temporaryPermissionFlags);
  adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;adb('shell','settings','put','system','font_scale','1.0');launch();
  const deadline=Date.now()+45000;let initial=read().nodes;
  while(!initial.some(n=>matches(n,pt.settings)||matches(n,pt.register))&&Date.now()<deadline){await pause(300);initial=read().nodes;}
  if(initial.some(n=>matches(n,pt.settings))){await press(pt.settings);await find(pt.profile,false);report('existing_session_settings_ready',1);await press(pt.logout);await find(pt.logoutTitle);await press(pt.logout);}
  await find(pt.register);adb('shell','settings','put','system','font_scale','2.0');launch();await find(pt.register);
  // Prove physical input before enabling touch exploration, then enter the unique form.
  const preflight=point(await find(pt.register));await touch.down(preflight);await pause(60);await touch.up();await find(pt.name);report('physical_input_enters_registration_before_reader');
  const services=saved[0]![1]==='null'||!saved[0]![1]?service:saved[0]![1].split(':').includes(service)?saved[0]![1]:saved[0]![1]+':'+service;
  adb('shell','settings','put','secure','enabled_accessibility_services',services);adb('shell','settings','put','secure','accessibility_enabled','1');adb('shell','settings','put','secure','touch_exploration_enabled','1');
  const readerDeadline=Date.now()+20000;let ready=false;
  while(Date.now()<readerDeadline){try{assertReader();ready=true;break;}catch{await pause(300);}}
  assert.ok(ready,'reader_touch_exploration_not_ready');adb('shell','am','start','-W','-n',pkg+'/.MainActivity');await pause(3000);reader=true;report('reader_service_and_touch_exploration_ready');
  await press(pt.register);await find(pt.invalidEmail);capture('01-register-email-error');report('registration_validation_preserves_form');
  await enter(pt.email,email);await enter(pt.password,password);await press(pt.register);await find(pt.invalidName);capture('01b-register-name-error');
  await enter(pt.name,'Leitor de teste');await enter(pt.email,'email-invalido');capture('02-register-keyboard');
  await sheet(pt.registrationNoticeLabel,pt.privacyTitle,pt.close,'03-privacy');
  await press(pt.register);await find(pt.invalidEmail);await top();assert.equal((await find(pt.name)).text,'Leitor de teste');report('registration_invalid_email_preserves_fields');
  await enter(pt.email,email);await press(pt.register);await find(pt.timezone);report('registered_through_real_http');
  await enter(pt.timezone,'Invalid/Timezone');await press(pt.continue);await find(pt.invalidTimezone);capture('04-timezone-error');report('onboarding_invalid_timezone');
  await enter(pt.timezone,'UTC');await press(pt.continue);await find(pt.habitName);await enter(pt.habitName,title);await press(pt.firstHabitAction);await find(pt.habitLabel(title,false));report('onboarding_and_first_habit');
  await press(pt.habitLabel(title,false));await find(pt.habitLabel(title,true));assert.equal(focusedLabel(),pt.habitLabel(title,true));capture('05-large-habit-focus');await press(pt.habitLabel(title,true));await find(pt.habitLabel(title,false));report('large_habit_focus_and_undo');
  await press(pt.habits);await press(pt.editLabel(title));await enter(pt.habitName,title);capture('06-edit-keyboard');
  await sheet(pt.deleteHabit,pt.deleteTitle,pt.cancel,'07-delete-cancel');await press(pt.back);await find(pt.editLabel(title));report('edit_and_delete_cancel_preserve_habit');
  await press(pt.settings);await sheet(pt.privacy,pt.privacyTitle,pt.close,'08-settings-privacy');
  await sheet(pt.logout,pt.logoutTitle,pt.cancel,'09-logout-cancel');await press(pt.syncDetails);await find(pt.syncTitle,false);capture('10-sync-panel');
  const syncEntry=focusedLabel();if(!observingFocus)assert.equal(syncEntry,pt.syncTitle,'sync_entry_focus');await press(pt.syncHistory);await find(pt.intentDetails);await press(pt.close);await find(pt.syncDetails);dialogFocus.push({name:'sync',entry:syncEntry??null,returned:focusedLabel()??null});if(!observingFocus)assert.ok(matches({'content-desc':focusedLabel()??''},pt.syncDetails),'sync_return_focus');report('sync_history_and_return');
  launch('vault-read');await find(pt.vaultTitle);await press(pt.briefing);await find(pt.habitLabel(title,false));assert.equal((await find(pt.habitLabel(title,false))).enabled,'true');capture('11-vault-preserved');report('vault_notice_and_local_control');
  launch('account-open');await find(pt.databaseAccountTitle);await press(pt.showDiagnosis);await find(pt.hideDiagnosis);capture('12-account-database-error');report('account_database_preserved_diagnosis');
  launch('installation-open');await find(pt.databaseInstallationTitle);capture('13-installation-error');assert.equal(read().nodes.some(n=>matches(n,pt.settings)),false);report('installation_blocks_journey');
  launch();await find(pt.habitLabel(title,false));await find(pt.synced);
  const identity=new HttpIdentity(origin),otherId=uuid(),credentials=await identity.login(email,password,otherId),other=openTestStore(':memory:',credentials.accountId,otherId);
  try {await synchronize(other,new HttpSync(origin,credentials.accountId,()=>credentials.accessToken,uuid));const day=getDayKey(new Date(),credentials.profile.timeContext.timezone,credentials.profile.timeContext.dayStartHour);assert.equal(other.view(day).habits.find(h=>h.title===title)?.done,false);assert.equal(other.view(day).totalXp,0);}finally{other.close();}
  report('server_confirms_habit_preserved_and_undo');success=true;
 }catch(error){try{capture('failure-reader-matrix');}catch{}throw error;}finally{
  const failedSteps:string[]=[];const work=[{name:'bridge',run:()=>touch.close()},...saved.map(([k,v])=>({name:k,run:()=>v==='null'?adb('shell','settings','delete','secure',k):adb('shell','settings','put','secure',k,v)})),{name:'font',run:()=>adb('shell','settings','put','system','font_scale',font)},...(!notificationGranted&&temporaryPermissionFlags.length?[{name:'notifications',run:()=>adb('shell','pm','clear-permission-flags',readerPackage,permission,...temporaryPermissionFlags)}]:[]),{name:'stop_fixture',run:()=>adb('shell','am','force-stop',pkg)},...(reversed?[{name:'reverse',run:()=>adb('reverse','--remove',devicePort)}]:[])];
  for(const step of work)try{await step.run();}catch{failedSteps.push(step.name);}
  writeFileSync(join(folder,'reader-cleanup.json'),JSON.stringify({restored:!failedSteps.length,failedSteps},null,2)+'\n');
  const apkSha256=createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../../android/app/build/outputs/apk/release/app-release.apk'))).digest('hex');
  writeFileSync(join(folder,'matrix-summary.json'),JSON.stringify({passed:success&&!failedSteps.length&&!observingFocus,functionalPassed:success&&!failedSteps.length,focusObservationOnly:observingFocus,dialogFocus,apkSha256,fontScale:2,authentication:{touch:[touch.unauthenticatedCode,touch.wrongAudienceCode,touch.wrongIssuerCode]},pixelRounding:'floor',minimumLogicalUnits:44,phases,targets,physicalInput:'grpc.sendTouch',scroll:'two_contacts',observer:'FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES',fixtureText:'adb.hardware_keys_not_spoken_character_editing',scope:'registration/onboarding/habits/sheets/sync/local failures; no VoiceOver/performance or complete password recovery',restored:!failedSteps.length},null,2)+'\n');
  if(failedSteps.length&&success)throw new Error('reader_cleanup_incomplete');
 }
});
