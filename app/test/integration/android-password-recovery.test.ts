import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {HttpIdentity,IdentityHttpError} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {openTestStore} from '../support/store.ts';
import {getDayKey} from '../../src/features/gamification/domain/day-key.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
import {failureKind,retryDelay} from '../../src/core/sync/retry.ts';
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,origin=process.env.RITMO_TEST_API,pkg='dev.ritmo.journeytest',devicePort='tcp:18766';
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const decode=(s:string)=>s.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_match,hex:string|undefined,decimal:string|undefined)=>String.fromCodePoint(Number.parseInt(hex??decimal!,hex?16:10))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function nodes() {
 adb('shell','uiautomator','dump','/sdcard/ritmo-journey.xml');
 return [...adb('shell','cat','/sdcard/ritmo-journey.xml').matchAll(/<node\s+([^>]+)>?/g)].map(match=>Object.fromEntries([...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(pair=>[pair[1]!,decode(pair[2]!)])));
}
function keyboardTop() {
 const lines=adb('shell','dumpsys','window').split(/\n/);
 const sources=lines.filter(line=>line.includes('InsetsSource id=')&&line.includes('type=ime')&&line.includes('visible=true'));
 // Ignore the transient navigation strip while Gboard is still opening.
 const tops=sources.map(line=>line.match(/type=ime frame=\[-?[0-9]+,(-?[0-9]+)\]\[-?[0-9]+,(-?[0-9]+)\]/)).filter((frame):frame is RegExpMatchArray=>frame!==null&&Number(frame[2])-Number(frame[1])>=Number(frame[2])*0.2).map(frame=>Number(frame[1]));
 assert.ok(tops.length,'keyboard_must_remain_open_with_visible_insets');
 return Math.min(...tops);
}
async function showKeyboard(label:string) {
 // Modal teardown and IME startup are asynchronous; require real visibility.
 const deadline=Date.now()+12000;let retryAt=Date.now()+2500,last:unknown;
 await tap(label,true);
 while(Date.now()<deadline) {
  try {const first=keyboardTop();await pause(750);const second=keyboardTop();if(first===second) return second;} catch(error) {last=error;}
  if(Date.now()>=retryAt) {await tap(label,true);retryAt=Date.now()+2500;}
  await pause(200);
 }
 throw last;
}
async function find(label:string,scroll=false,minPixels=0,visibleBottom=Infinity) {
 const deadline=Date.now()+45000;let swipes=0;
 while(Date.now()<deadline) {
  const list=nodes(),node=list.find(n=>n.package===pkg&&(n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails)))??list.find(n=>n.package===pkg&&n.text===label);
  if(node) {const box=node.bounds?.match(/-?\d+/g)?.map(Number);if(box&&box[2]!>box[0]!&&box[3]!>box[1]!&&box[2]!-box[0]!>=minPixels&&box[3]!-box[1]!>=minPixels&&box[3]!<=visibleBottom) return node;}
  if(scroll&&swipes++<8) {const viewport=(list.find(n=>n.package===pkg&&n.scrollable==='true'&&n.bounds)??list.find(n=>n.package===pkg&&n.bounds))?.bounds?.match(/\d+/g)?.map(Number);if(viewport) {const top=viewport[1]!,bottom=Math.min(viewport[3]!,visibleBottom);adb('shell','input','swipe',String(Math.floor(viewport[2]!/2)),String(Math.floor(top+(bottom-top)*0.8)),String(Math.floor(viewport[2]!/2)),String(Math.floor(top+(bottom-top)*0.35)),'400');}}
  await pause(300);
 }
 throw new Error('native_ui_missing_'+label);
}
async function tap(label:string,scroll=false) {
 const node=await find(label,scroll),box=node.bounds!.match(/-?\d+/g)!.map(Number);
 adb('shell','input','tap',String(Math.floor((box[0]!+box[2]!)/2)),String(Math.floor((box[1]!+box[3]!)/2)));await pause(250);
}
async function fill(label:string,value:string) {
 const current=await find(label,true);await tap(label);
 adb('shell','input','keyevent','KEYCODE_MOVE_END');
 const length=Array.from(current.text??'').length;
 if(length) adb('shell','input','keyevent',...Array.from({length},()=>'KEYCODE_DEL'));
 adb('shell','input','text',value.replace(/ /g,'%s'));adb('shell','input','keyevent','KEYCODE_BACK');await pause(250);
}
function launch(fault?:string) {adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','ritmo:///?'+(fault?'ritmoTestFault='+fault:''),'-n',pkg+'/.MainActivity');}
function report(phase:string) {console.log(JSON.stringify({phase,passed:true}));}
function capture(name:string) {
 if(!process.env.RITMO_JOURNEY_EVIDENCE) return;
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE);mkdirSync(folder,{recursive:true});
 writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000}));
}
test('Android visible password recovery consumes an SMTP link only on confirmation and preserves offline work',{skip:!serial,timeout:900000},async()=>{
 assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));assert.match(serial!,/^emulator-[0-9]+$/);const mailbox=process.env.RITMO_RESET_MAILBOX;assert.ok(mailbox&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(mailbox));
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data'),font=adb('shell','settings','get','system','font_scale'),night=adb('shell','cmd','uimode','night').split(':').pop()!.trim();
 let reversed=false,succeeded=false,observer:ReturnType<typeof openTestStore>|undefined;const targets:{label:string;widthPixels:number;heightPixels:number;scale:string;boundsPixels:number[];visibleBottomPixels?:number}[]=[];let scale='100%';
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: (\d+)/g)?.pop()?.match(/\d+/)?.[0])/160;
 const target=async(label:string,scroll=false,visibleBottom=Infinity)=>{const n=await find(label,scroll,Math.floor(44*density),visibleBottom),box=n.bounds!.match(/-?\d+/g)!.map(Number);targets.push({label,widthPixels:box[2]!-box[0]!,heightPixels:box[3]!-box[1]!,scale,boundsPixels:box,...(Number.isFinite(visibleBottom)?{visibleBottomPixels:visibleBottom}:{})});};
 const connect=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin!).port);reversed=true;};const disconnect=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}};
 const restore=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};const offline=()=>{disconnect();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');};const online=()=>{connect();restore();};
 const mail=async(path:string)=>{const result=await fetch(mailbox+path,{signal:AbortSignal.timeout(20000)});assert.equal(result.status,200,'local_mailbox_control_failed');return await result.json() as {link?:string;count?:number;advanced?:boolean};};
 const link=async(email:string,index=0)=>{const value=(await mail('/link?email='+encodeURIComponent(email)+'&index='+index)).link;assert.ok(value&&/^https:\/\/api[.]example[.]test\/password-reset#token=[A-Za-z0-9_-]{43}$/.test(value),'link_must_come_from_smtp');return value;};
 const advance=async(seconds:number)=>{const response=await fetch(mailbox+'/advance?seconds='+seconds,{method:'POST',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);};
 const deliver=(url:string,cold=false)=>{if(cold)adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',url,'-n',pkg+'/.MainActivity');};
 const repeat=async<T>(work:()=>Promise<T>)=>{for(let attempt=1;;attempt++)try{return await work();}catch(error){if(attempt>=3||failureKind(error)!=='retry')throw error;await pause(retryDelay(attempt,error,Date.now()));}};
 const run=randomUUID(),email='a'+run+'@example.test',emailB='b'+run+'@example.test',unknown='unknown'+run+'@example.test',password='fixture-password',newPassword='changed-fixture-password',title='Antes de recuperar';
 try {
  adb('wait-for-device');adb('shell','settings','put','system','font_scale','1.0');if(night!=='no')adb('shell','cmd','uimode','night','no');connect();
  const identity=new HttpIdentity(origin!),a=await identity.register(email,password,'Pessoa A',uuid());await identity.register(emailB,password,'Pessoa B',uuid());observer=openTestStore(':memory:',a.accountId,uuid());observer.seedProfile({...a.profile,plan:'free'});const transport=new HttpSync(origin!,a.accountId,()=>a.accessToken,uuid),instant=new Date().toISOString(),day=getDayKey(new Date(instant),'UTC',4);
  observer.enqueue({type:'profile.setOnboarding',timeContext:{timezone:'UTC',dayStartHour:4},completed:true,analyticsConsent:false},uuid(),instant);await repeat(()=>synchronize(observer!,transport));launch();await tap(pt.hasAccount);await target(pt.forgotPassword);await tap(pt.forgotPassword);await find(pt.recoverPassword);capture('01-solicitar-link');await fill(pt.email,'invalid');await tap(pt.sendResetLink);await find(pt.invalidEmail);capture('02-email-invalido');
  offline();await fill(pt.email,email);await tap(pt.sendResetLink);await find(pt.recoveryOffline);assert.equal((await find(pt.email)).text,email);capture('03-pedido-offline-preservado');assert.equal((await mail('/count?email='+encodeURIComponent(email))).count,0);online();await tap(pt.sendResetLink);await find(pt.recoverySent(email));capture('04-resposta-uniforme');const first=await link(email);report('request_ui_receives_real_smtp_without_authenticating');
  await tap(pt.backToLogin);await fill(pt.email,email);await fill(pt.password,password);await tap(pt.login,true);await find(pt.synced);offline();await tap(pt.habits);await tap(pt.newHabit);await fill(pt.habitName,title);await tap(pt.createHabit,true);await tap(pt.briefing);await tap(pt.habitLabel(title,false));await find(pt.totalXp(10));launch('recovery-isolation');await find(pt.totalXp(10));deliver(first);await find(pt.resetPasswordTitle);await fill(pt.newPassword,newPassword);await tap(pt.saveNewPassword,true);await find(pt.recoveryOffline,true);capture('05-link-aberto-offline');
  // Cold entry proves the fragment reaches the transient mailbox, not a router parameter.
  adb('shell','settings','put','system','font_scale','2.0');scale='200%';deliver(first,true);await find(pt.resetPasswordTitle);await fill(pt.newPassword,newPassword);await tap(pt.show,true);assert.equal((await find(pt.newPassword,true)).text,newPassword);await tap(pt.hide,true);const ime=await showKeyboard(pt.newPassword);await target(pt.saveNewPassword,true,ime);await target(pt.saveNewPassword,false,keyboardTop());capture('06-nova-senha-teclado-200');adb('shell','input','keyevent','KEYCODE_BACK');online();
  const before=await identity.login(email,password,uuid());assert.equal(before.accountId,a.accountId);assert.equal(observer.view(day).habits.length,0);await target(pt.saveNewPassword,true);await tap(pt.saveNewPassword,true);await find(pt.resetCompleteTitle);capture('07-senha-alterada-sem-login-200');await target(pt.backToLogin,true);report('warm_and_cold_links_confirm_online_without_consumption_on_open');
  await assert.rejects(identity.login(email,password,uuid()),error=>error instanceof IdentityHttpError&&error.status===401);launch('access-expired');await find(pt.remoteLogin,true);await find(pt.totalXp(10),true);capture('08-pendencia-apos-reabrir');await tap(pt.reauth,true);await fill(pt.email,email);await fill(pt.password,password);await tap(pt.login,true);await find(pt.credentialsError,true);await fill(pt.password,newPassword);await tap(pt.login,true);await find(pt.synced);await find(pt.totalXp(10));capture('09-nova-sessao-sincronizada');
  const renewed=await identity.login(email,newPassword,uuid());await repeat(()=>synchronize(observer!,new HttpSync(origin!,a.accountId,()=>renewed.accessToken,uuid)));assert.equal(observer.view(day).totalXp,10);assert.equal(observer.view(day).habits.filter(h=>h.title===title).length,1);const other=await identity.login(emailB,password,uuid()),otherStore=openTestStore(':memory:',other.accountId,uuid());try{otherStore.seedProfile({...other.profile,plan:'free'});await repeat(()=>synchronize(otherStore,new HttpSync(origin!,other.accountId,()=>other.accessToken,uuid)));assert.equal(otherStore.view(day).habits.length,0);}finally{otherStore.close();}report('pending_work_survives_restart_reauthentication_and_converges_once');
  adb('shell','settings','put','system','font_scale','1.0');scale='100%';deliver('https://foreign.example.test/password-reset#token='+'A'.repeat(43),true);await find(pt.resetInvalidBody);capture('10-origem-invalida');await target(pt.anotherResetLink);deliver(first);await find(pt.resetPasswordTitle);await fill(pt.newPassword,'another-fixture-password');await tap(pt.saveNewPassword,true);await find(pt.resetInvalidBody);capture('11-link-usado');report('foreign_origin_and_used_link_are_unavailable_without_new_session');
  await tap(pt.anotherResetLink);await fill(pt.email,email);await tap(pt.sendResetLink);await find(pt.recoverySent(email));const expired=await link(email,1);await advance(3600);deliver(expired);await find(pt.resetPasswordTitle);await fill(pt.newPassword,'another-fixture-password');await tap(pt.saveNewPassword,true);await find(pt.resetInvalidBody);capture('12-link-expirado');await tap(pt.anotherResetLink);await fill(pt.email,unknown);await tap(pt.sendResetLink);await find(pt.recoverySent(unknown));assert.equal((await mail('/count?email='+encodeURIComponent(unknown))).count,0);capture('13-endereco-desconhecido-uniforme');report('expired_link_can_request_another_and_unknown_email_is_uniform');
  if(process.env.RITMO_JOURNEY_EVIDENCE)writeFileSync(join(process.env.RITMO_JOURNEY_EVIDENCE,'native-targets.json'),JSON.stringify({density,targets,scales:['100%','200%'],passed:true},null,2)+'\n');succeeded=true;
 }catch(error){try{capture('failure');}catch{/* Keep original failure. */}throw error;}
 finally {
  observer?.close();const errors:string[]=[];for(const clean of [()=>adb('shell','am','force-stop',pkg),()=>disconnect(),()=>restore(),()=>adb('shell','settings','put','system','font_scale',font),()=>{if(night!=='no')adb('shell','cmd','uimode','night',night);},()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')])try{clean();}catch{errors.push('cleanup_failed');}if(succeeded&&errors.length)throw new Error(errors.join(','));
 }
});
