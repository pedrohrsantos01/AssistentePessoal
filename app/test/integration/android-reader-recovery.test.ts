import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseReaderHierarchy,type ReaderNode as Node} from '../support/reader-hierarchy.ts';
import {openEmulatorTouch} from '../support/emulator-touch.ts';
import {HttpIdentity,IdentityHttpError} from '../../src/core/identity/http-identity.ts';
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
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,pkg='dev.ritmo.journeytest',service='com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService',devicePort='tcp:18766';
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const rect=(n:Node)=>n.bounds!.match(/-?\d+/g)!.map(Number);
const point=(n:Node)=>{const b=rect(n);return [Math.floor((b[0]!+b[2]!)/2),Math.floor((b[1]!+b[3]!)/2)] as const;};
const described=(n:Node,label:string)=>n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails);
const matches=(n:Node,label:string)=>described(n,label)||n.text===label;
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};

test('TalkBack at200%: recovery SMTP links preempt dialogs and preserve pending work',
 {skip:!serial||process.env.RITMO_READER_RECOVERY!=='1',timeout:1200000},async()=>{
 const origin=process.env.RITMO_TEST_API;assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));
 assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');assert.equal(adb('reverse','--list').includes(devicePort),false);
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE!);mkdirSync(folder,{recursive:true});
 const protectedValues=new Set<string>(['fixture-reader-password','changed-reader-password','another-reader-password']);let passwordVisible=false;
 const sanitize=(value:string)=>{for(const secret of protectedValues)value=value.replaceAll(secret,'[redacted]');return value;};
 const capture=(name:string)=>{if(passwordVisible)return;writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000}));};
 const observingFocus=process.env.RITMO_READER_OBSERVE_FOCUS==='1';
 const phases:string[]=[],targets:Record<string,unknown>[]=[],dialogFocus:Record<string,unknown>[]=[];
 if(observingFocus){const line=JSON.stringify({phase:'focus_observation_only',fullAcceptance:false});console.log(line);if(process.env.RITMO_READER_PROGRESS)appendFileSync(process.env.RITMO_READER_PROGRESS,line+'\n');}
 const report=(phase:string,fontScale=2)=>{phases.push(phase);const line=JSON.stringify({phase,passed:true,fontScale});console.log(line);if(process.env.RITMO_READER_PROGRESS)appendFileSync(process.env.RITMO_READER_PROGRESS,line+'\n');};
 const read=()=>{
  const result=adb('shell','am','instrument','-w','dev.ritmo.readerobserver/.ReaderObserver'),xml=result.match(/^INSTRUMENTATION_RESULT: hierarchy=(.*)$/m)?.[1];
  if(!xml)return {nodes:[] as Node[],meta:{} as Node};
  writeFileSync(join(folder,'latest-hierarchy.xml'),sanitize(xml)+'\n');
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
  adb('shell','input','keyevent','KEYCODE_MOVE_END');const length=before.password==='true'?128:Array.from(before.text??'').length;
  if(length)adb('shell','input','keyevent',...Array.from({length},()=>'KEYCODE_DEL'));
  try{adb('shell','input','text',value.replace(/ /g,'%s'));}catch{throw new Error('fixture_text_input_failed');}adb('shell','input','keyevent','KEYCODE_BACK');await pause(500);
  if(field.password!=='true')assert.equal((await find(label)).text,value);
 };
 const focusedLabel=()=>{const n=read().nodes.find(n=>n['accessibility-focused']==='true');return n?.['content-desc']||n?.text;};
 const snapshot=(name:string)=>{read();writeFileSync(join(folder,name+'.xml'),readFileSync(join(folder,'latest-hierarchy.xml')));capture(name);};
 const offline=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');};
 const restoreNetwork=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 const online=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;restoreNetwork();};
 const repeat=async<T,>(work:()=>Promise<T>):Promise<T>=>{for(let attempt=1;;attempt++)try{return await work();}catch(error){if(attempt>=3||failureKind(error)!=='retry')throw error;await pause(retryDelay(attempt,error,Date.now()));}};
 const mailbox=process.env.RITMO_RESET_MAILBOX;assert.ok(mailbox&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(mailbox));
 const mail=async(path:string)=>{const response=await fetch(mailbox+path,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,'mailbox_control_failed');return await response.json() as {link?:string;count?:number};};
 const link=async(email:string,index=0)=>{const value=(await mail('/link?email='+encodeURIComponent(email)+'&index='+index)).link;assert.ok(value&&/^https:\/\/api[.]example[.]test\/password-reset#token=[A-Za-z0-9_-]{43}$/.test(value),'smtp_link_missing');protectedValues.add(value);protectedValues.add(value.split('#token=')[1]!);return value;};
 const deliver=(url:string,cold=false)=>{try{if(cold)adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',url,'-n',pkg+'/.MainActivity');}catch{throw new Error('native_reset_delivery_failed');}};
 const preempt=async(opener:string,title:string,url:string,name:string)=>{
  await press(opener);await find(title,false);assert.equal(focusedLabel(),title,'dialog_entry_'+name);snapshot(name+'-dialog');
  deliver(url);await find(pt.newPassword,false);const tree=read(),focused=tree.nodes.find(n=>n['accessibility-focused']==='true');
  assert.equal(tree.nodes.some(n=>matches(n,title)),false,'old_dialog_covers_recovery');assert.notEqual(focused?.text,title,'old_dialog_kept_focus');
  assert.notEqual(focused?.['content-desc'],opener,'old_opener_regained_focus');dialogFocus.push({name,interrupted:title,entry:focused?.['content-desc']||focused?.text||null});snapshot(name+'-recovery');
 };
 const run=randomUUID(),email='a'+run+'@example.test',emailB='b'+run+'@example.test',unknown='unknown'+run+'@example.test',password='fixture-reader-password',newPassword='changed-reader-password',title='Antes de recuperar com leitor';
 let observer:ReturnType<typeof openTestStore>|undefined;
 try {
  if(!notificationGranted&&temporaryPermissionFlags.length)adb('shell','pm','set-permission-flags',readerPackage,permission,...temporaryPermissionFlags);
  online();adb('shell','settings','put','system','font_scale','1.0');launch();
  const initialDeadline=Date.now()+45000;let initial=read().nodes;while(!initial.some(n=>matches(n,pt.settings)||matches(n,pt.hasAccount))&&Date.now()<initialDeadline){await pause(300);initial=read().nodes;}
  if(initial.some(n=>matches(n,pt.settings))){await press(pt.settings);await find(pt.profile,false);await press(pt.logout);await find(pt.logoutTitle);await press(pt.logout);}
  await find(pt.hasAccount);report('previous_session_preserved_and_deliberately_closed',1);
  const identity=new HttpIdentity(origin),a=await identity.register(email,password,'Pessoa leitora',uuid());await identity.register(emailB,password,'Outra conta',uuid());
  observer=openTestStore(':memory:',a.accountId,uuid());observer.seedProfile({...a.profile,plan:'free'});const instant=new Date().toISOString(),day=getDayKey(new Date(instant),'UTC',4);
  observer.enqueue({type:'profile.setOnboarding',timeContext:{timezone:'UTC',dayStartHour:4},completed:true,analyticsConsent:false},uuid(),instant);await repeat(()=>synchronize(observer!,new HttpSync(origin,a.accountId,()=>a.accessToken,uuid)));
  adb('shell','settings','put','system','font_scale','2.0');launch();await find(pt.hasAccount);
  const preflight=point(await find(pt.hasAccount));await touch.down(preflight);await pause(60);await touch.up();await find(pt.email);report('physical_input_enters_login');
  const services=saved[0]![1]==='null'||!saved[0]![1]?service:saved[0]![1].split(':').includes(service)?saved[0]![1]:saved[0]![1]+':'+service;
  adb('shell','settings','put','secure','enabled_accessibility_services',services);adb('shell','settings','put','secure','accessibility_enabled','1');adb('shell','settings','put','secure','touch_exploration_enabled','1');
  const deadline=Date.now()+20000;let ready=false;while(Date.now()<deadline){try{assertReader();ready=true;break;}catch{await pause(300);}}assert.ok(ready,'reader_not_ready');reader=true;adb('shell','am','start','-W','-n',pkg+'/.MainActivity');await find(pt.email);report('reader_ready_at200');
  await press(pt.forgotPassword);await find(pt.recoverPassword);await enter(pt.email,'invalid');await press(pt.sendResetLink);await find(pt.invalidEmail);snapshot('01-invalid-email');report('request_validation_keeps_accessible_form');
  await enter(pt.email,email);offline();await find(pt.recoveryOffline);await press(pt.sendResetLink);assert.equal((await find(pt.email)).text,email);assert.equal((await mail('/count?email='+encodeURIComponent(email))).count,0);snapshot('02-offline-request');report('offline_request_preserves_email_without_smtp');
  online();await pause(1000);await press(pt.sendResetLink);await find(pt.recoverySent(email));const first=await link(email);snapshot('03-smtp-request');report('uniform_request_received_through_real_smtp');
  await press(pt.backToLogin);await enter(pt.email,email);await enter(pt.password,password);await press(pt.login);await find(pt.synced);
  offline();await press(pt.habits);await press(pt.newHabit);await enter(pt.habitName,title);await press(pt.createHabit);await press(pt.briefing);await press(pt.habitLabel(title,false));await find(pt.totalXp(10));
  launch('recovery-isolation');await find(pt.totalXp(10));await press(pt.settings);await preempt(pt.privacy,pt.privacyTitle,first,'04-privacy-preempted');
  await enter(pt.newPassword,'short');await press(pt.saveNewPassword);await find(pt.invalidPassword);await enter(pt.newPassword,newPassword);await press(pt.saveNewPassword);await find(pt.recoveryOffline);snapshot('05-offline-confirmation');report('privacy_preemption_and_offline_confirmation_preserve_work');
  deliver(first,true);await find(pt.resetPasswordTitle);await enter(pt.newPassword,newPassword);passwordVisible=true;await press(pt.show);assert.ok((await find(pt.newPassword)).text===newPassword,'revealed_fixture_value_mismatch');await press(pt.hide);passwordVisible=false;snapshot('06-cold-link-password-hidden');
  online();await pause(1000);const before=await identity.login(email,password,uuid());assert.equal(before.accountId,a.accountId);assert.equal(observer.view(day).habits.length,0);await press(pt.saveNewPassword);await find(pt.resetCompleteTitle);snapshot('07-reset-complete');report('warm_cold_link_not_consumed_until_online_confirmation');
  await assert.rejects(identity.login(email,password,uuid()),e=>e instanceof IdentityHttpError&&e.status===401);await press(pt.backToLogin);await find(pt.reauth);assert.equal(read().nodes.some(n=>matches(n,pt.privacyTitle)),false);snapshot('08-explicit-return-clears-privacy');report('reset_does_not_authenticate_or_restore_old_dialog');
  launch('access-expired');await find(pt.remoteLogin);await find(pt.totalXp(10));await press(pt.reauth);await enter(pt.email,email);await enter(pt.password,newPassword);await press(pt.login);await find(pt.synced);await find(pt.totalXp(10));
  const renewed=await identity.login(email,newPassword,uuid());await repeat(()=>synchronize(observer!,new HttpSync(origin,a.accountId,()=>renewed.accessToken,uuid)));assert.equal(observer.view(day).totalXp,10);assert.equal(observer.view(day).habits.filter(h=>h.title===title&&h.done).length,1);
  const b=await identity.login(emailB,password,uuid()),other=openTestStore(':memory:',b.accountId,uuid());try{await repeat(()=>synchronize(other,new HttpSync(origin,b.accountId,()=>b.accessToken,uuid)));assert.equal(other.view(day).habits.length,0);assert.equal(other.view(day).totalXp,0);}finally{other.close();}snapshot('09-converged-once');report('pending_habit_and10xp_converge_once_and_other_account_is_empty');
  await identity.requestPasswordReset(email);const second=await link(email,1);await press(pt.settings);await preempt(pt.logout,pt.logoutTitle,second,'10-logout-preempted');
  const foreign='https://foreign.example.test/password-reset#token='+'A'.repeat(43);protectedValues.add(foreign);protectedValues.add('A'.repeat(43));deliver(foreign);await find(pt.resetInvalidBody);snapshot('11-foreign-origin');
  deliver(first);await find(pt.resetPasswordTitle);await enter(pt.newPassword,'another-reader-password');await press(pt.saveNewPassword);await find(pt.resetInvalidBody);snapshot('12-used-link');report('logout_preempted_and_foreign_or_used_links_are_unavailable');
  await press(pt.anotherResetLink);await enter(pt.email,email);await press(pt.sendResetLink);await find(pt.recoverySent(email));const expired=await link(email,2);const advanced=await fetch(mailbox+'/advance?seconds=3600',{method:'POST',signal:AbortSignal.timeout(20000)});assert.equal(advanced.status,200);
  deliver(expired,true);await find(pt.resetPasswordTitle);await enter(pt.newPassword,'another-reader-password');await press(pt.saveNewPassword);await find(pt.resetInvalidBody);snapshot('13-expired-link');
  await press(pt.anotherResetLink);await enter(pt.email,unknown);await press(pt.sendResetLink);await find(pt.recoverySent(unknown));assert.equal((await mail('/count?email='+encodeURIComponent(unknown))).count,0);await press(pt.backToLogin);await find(pt.reauth);assert.equal(read().nodes.some(n=>matches(n,pt.logoutTitle)),false);snapshot('14-uniform-unknown-return');report('expired_link_and_unknown_email_preserve_uniform_response_and_close_old_logout');
  success=true;
 }catch(error){try{snapshot('failure-recovery');}catch{}throw error;}finally{
  observer?.close();const failedSteps:string[]=[];const work=[{name:'bridge',run:()=>touch.close()},...saved.map(([k,v])=>({name:k,run:()=>v==='null'?adb('shell','settings','delete','secure',k):adb('shell','settings','put','secure',k,v)})),{name:'network',run:restoreNetwork},{name:'font',run:()=>adb('shell','settings','put','system','font_scale',font)},...(!notificationGranted&&temporaryPermissionFlags.length?[{name:'notifications',run:()=>adb('shell','pm','clear-permission-flags',readerPackage,permission,...temporaryPermissionFlags)}]:[]),{name:'stop_fixture',run:()=>adb('shell','am','force-stop',pkg)},...(reversed?[{name:'reverse',run:()=>adb('reverse','--remove',devicePort)}]:[])];
  for(const step of work)try{await step.run();}catch{failedSteps.push(step.name);}
  writeFileSync(join(folder,'reader-cleanup.json'),JSON.stringify({restored:!failedSteps.length,failedSteps},null,2)+'\n');
  const apkSha256=createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../../android/app/build/outputs/apk/release/app-release.apk'))).digest('hex');
  writeFileSync(join(folder,'matrix-summary.json'),JSON.stringify({passed:success&&!failedSteps.length&&!observingFocus,focusObservationOnly:observingFocus,apkSha256,fontScale:2,phases,dialogFocus,targets,restored:!failedSteps.length,authentication:{touch:[touch.unauthenticatedCode,touch.wrongAudienceCode,touch.wrongIssuerCode]},scope:'password recovery UI/SMTP, privacy/logout preemption, reauthentication and preserved sync; no public links/VoiceOver/performance or complete inter-window/spoken editing',physicalInput:'grpc.sendTouch',scroll:'two_contacts',observer:'FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES',fixtureText:'adb.hardware_keys_not_spoken_character_editing'},null,2)+'\n');
  if(failedSteps.length&&success)throw new Error('reader_cleanup_incomplete');
 }
});
