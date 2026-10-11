import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
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
test('Android visible synchronization distinguishes rejection from uncertain identity and preserves initial-copy and update gates',{skip:!serial,timeout:900000},async()=>{
 assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));assert.match(serial!,/^emulator-[0-9]+$/);
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data'),font=adb('shell','settings','get','system','font_scale'),night=adb('shell','cmd','uimode','night').split(':').pop()!.trim();
 let reversed=false,succeeded=false,observer:ReturnType<typeof openTestStore>|undefined,b:ReturnType<typeof openTestStore>|undefined;const targets:{label:string;widthPixels:number;heightPixels:number;scale:string;boundsPixels:number[];visibleBottomPixels?:number}[]=[];let scale='100%';
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: (\d+)/g)?.pop()?.match(/\d+/)?.[0])/160;
 const target=async(label:string,scroll=false,visibleBottom=Infinity)=>{const n=await find(label,scroll,Math.floor(44*density),visibleBottom),box=n.bounds!.match(/-?\d+/g)!.map(Number);targets.push({label,widthPixels:box[2]!-box[0]!,heightPixels:box[3]!-box[1]!,scale,boundsPixels:box,...(Number.isFinite(visibleBottom)?{visibleBottomPixels:visibleBottom}:{})});};
 const run=randomUUID(),emailA='a'+run+'@example.test',emailB='b'+run+'@example.test',password='sync-fixture-password';
 const connect=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin!).port);reversed=true;};
 const disconnect=()=>{if(reversed) {adb('reverse','--remove',devicePort);reversed=false;}};
 const restore=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 const offline=()=>{disconnect();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');};const online=()=>{connect();restore();};
 const repeat=async<T>(work:()=>Promise<T>)=>{for(let attempt=1;;attempt++) try {return await work();} catch(error) {if(attempt>=3||failureKind(error)!=='retry') throw error;await pause(retryDelay(attempt,error,Date.now()));}};
 const create=async(title:string)=>{await tap(pt.habits);await tap(pt.newHabit);await fill(pt.habitName,title);await tap(pt.createHabit,true);};
 try {
  adb('wait-for-device');adb('shell','settings','put','system','font_scale','1.0');if(night!=='no') adb('shell','cmd','uimode','night','no');connect();launch();
  await tap(pt.register);await fill(pt.name,'Pessoa A');await fill(pt.email,emailA);await fill(pt.password,password);await tap(pt.register,true);await find(pt.onboarding);await fill(pt.timezone,'UTC');await tap(pt.continue,true);await tap(pt.skip,true);await find(pt.synced);
  const identity=new HttpIdentity(origin!),a=await identity.login(emailA,password,uuid());observer=openTestStore(':memory:',a.accountId,uuid());observer.seedProfile({...a.profile,plan:'free'});const transport=new HttpSync(origin!,a.accountId,()=>a.accessToken,uuid),syncObserver=()=>repeat(()=>synchronize(observer!,transport));await syncObserver();const instant=(await transport.pull(observer.cursor())).serverTime,day=getDayKey(new Date(instant),observer.profile().timeContext.timezone,observer.profile().timeContext.dayStartHour);
  offline();await create('Recusado');await tap(pt.briefing);await tap(pt.habitLabel('Recusado',false));
  observer.enqueue({type:'habit.create',habitId:uuid(),title:'Recusado',habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:observer.profile().timeContext,iconKey:'reading',colorToken:'blue',sortOrder:0},uuid(),instant);await syncObserver();online();await find(pt.attention);await target(pt.syncDetails);await tap(pt.syncDetails);await tap(pt.reviewChanges,true);await tap(pt.reviewOperation('Criar hábito · Recusado'),true);await find(pt.rejectionReasons.title_unavailable);capture('01-recusa-comprovada');await fill(pt.habitName,'Corrigido');const sheetImeTop=await showKeyboard(pt.habitName);await target(pt.correctOperation,true,sheetImeTop);await target(pt.correctOperation,false,keyboardTop());capture('01-correcao-teclado-rodape');adb('shell','input','keyevent','KEYCODE_BACK');await tap(pt.recoverDependent('Marcar hábito · '+day),true);await target(pt.correctOperation,true);await tap(pt.correctOperation,true);await find(pt.syncTitle);await tap(pt.close,true);await find(pt.habitLabel('Corrigido',true));await find(pt.synced);await syncObserver();assert.equal(observer.view(day).totalXp,10);capture('02-correcao-confirmada');report('proven_rejection_corrected_with_selected_dependent');
  offline();await create('Incerto');await tap(pt.briefing);await tap(pt.habitLabel('Incerto',false));launch('sync-identity');await find(pt.offline);online();await find(pt.attention);await tap(pt.syncDetails);await tap(pt.reviewChanges,true);await tap(pt.reviewOperation('Criar hábito · Incerto'),true);await find(pt.uncertainBody,true);capture('03-identidade-incerta');await target(pt.intentDetails,true);await tap(pt.intentDetails,true);await target(pt.close,true);assert.ok(!nodes().some(n=>[pt.discardOperation,pt.correctOperation].includes(n['content-desc']??'')));capture('04-diagnostico-preservado');await tap(pt.close,true);await find(pt.syncTitle);await tap(pt.close,true);await create('Independente');await tap(pt.briefing);await syncObserver();assert.ok(observer.view(day).habits.some(h=>h.title==='Independente'));assert.equal(observer.view(day).totalXp,10);adb('shell','settings','put','system','font_scale','2.0');scale='200%';launch('sync-identity');await find(pt.attention);await tap(pt.syncDetails);await tap(pt.reviewChanges,true);await tap(pt.reviewOperation('Criar hábito · Incerto'),true);await find(pt.uncertainBody,true);capture('05-identidade-200');await target(pt.close,true);await tap(pt.close,true);report('uncertain_identity_survives_restart_and_independent_work');
  adb('shell','settings','put','system','font_scale','1.0');scale='100%';launch('sync-429');await find(pt.syncRateLimited);await tap(pt.syncDetails);const retry=await find(pt.retry);assert.equal(retry.enabled,'false');await target(pt.retry);capture('06-limite-servidor');adb('shell','input','keyevent','KEYCODE_BACK');await pause(300);await create('Durante limite');await tap(pt.briefing);await find(pt.syncRateLimited);launch('sync-503');await find(pt.syncUnavailable);capture('07-servico-indisponivel');launch();await find(pt.attention);await syncObserver();assert.ok(observer.view(day).habits.some(h=>h.title==='Durante limite'));assert.equal(observer.view(day).totalXp,10);report('rate_limit_and_unavailable_preserve_local_work');
  const accountB=await identity.register(emailB,password,'Pessoa B',uuid());b=openTestStore(':memory:',accountB.accountId,uuid());b.seedProfile({...accountB.profile,plan:'free'});b.enqueue({type:'profile.setOnboarding',timeContext:{timezone:'UTC',dayStartHour:4},completed:true,analyticsConsent:false},uuid(),instant);b.enqueue({type:'habit.create',habitId:uuid(),title:'Conta B completa',habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:{timezone:'UTC',dayStartHour:4},iconKey:'water',colorToken:'green',sortOrder:0},uuid(),instant);await repeat(()=>synchronize(b!,new HttpSync(origin!,accountB.accountId,()=>accountB.accessToken,uuid)));
  await tap(pt.settings);await tap(pt.logout,true);await find(pt.logoutTitle);await tap(pt.logout,true);await find(pt.register);launch('sync-snapshot');await tap(pt.hasAccount);await fill(pt.email,emailB);await fill(pt.password,password);await tap(pt.login,true);await find(pt.initialLoading);await find(pt.snapshotTitle);capture('08-copia-inicial');assert.ok(!nodes().some(n=>n['content-desc']===pt.briefing||n['content-desc']===pt.habits));adb('shell','settings','put','system','font_scale','2.0');scale='200%';launch('sync-snapshot');await find(pt.initialLoading);await find(pt.serviceUnavailable,true);capture('09-copia-interrompida-200');launch();await find(pt.habitLabel('Conta B completa',false),true);assert.ok(!nodes().some(n=>n['content-desc']===pt.habitLabel('Corrigido',true)));capture('10-copia-completa-isolada');report('initial_snapshot_interrupted_and_resumed_without_partial_account');
  launch('sync-update');await find(pt.update,true);await tap(pt.habits);const newHabit=await find(pt.newHabit);assert.equal(newHabit.enabled,'false');await target(pt.newHabit);const readonlyEdit=await find(pt.editLabel('Conta B completa'),true);assert.equal(readonlyEdit.enabled,'false');capture('11-atualizacao-somente-leitura');launch();await find(pt.update,true);const readonlyCheck=await find(pt.habitLabel('Conta B completa',false),true);assert.equal(readonlyCheck.enabled,'false');capture('12-bloqueio-apos-reabertura');
  adb('shell','settings','put','system','font_scale','1.0');scale='100%';launch();await find(pt.update,true);await tap(pt.habitLabel('Conta B completa',false),true);assert.equal((await find(pt.habitLabel('Conta B completa',false))).enabled,'false');capture('13-briefing-somente-leitura-100');await tap(pt.habits);assert.equal((await find(pt.editLabel('Conta B completa'),true)).enabled,'false');capture('14-gestao-somente-leitura-100');assert.equal(b.view(day).totalXp,0);assert.deepEqual(b.view(day).habits.map(h=>h.title),['Conta B completa']);report('update_gate_persists_without_manual_bypass');
  if(process.env.RITMO_JOURNEY_EVIDENCE) writeFileSync(join(process.env.RITMO_JOURNEY_EVIDENCE,'native-targets.json'),JSON.stringify({density,targets,scales:['100%','200%'],passed:true},null,2)+'\n');succeeded=true;
 } catch(error) {
  try {const folder=resolve('..','.scratch','runtime','interface-sync');mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'native-failure-nodes.json'),JSON.stringify(nodes(),null,2));writeFileSync(join(folder,'native-failure.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000}));} catch {/* Keep the original test failure when diagnostics are unavailable. */}
  throw error;
 } finally {
  observer?.close();b?.close();const errors:string[]=[];for(const clean of [()=>adb('shell','am','force-stop',pkg),()=>disconnect(),()=>restore(),()=>adb('shell','settings','put','system','font_scale',font),()=>{if(night!=='no') adb('shell','cmd','uimode','night',night);},()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')]) try {clean();} catch {errors.push('cleanup_failed');}if(succeeded&&errors.length) throw new Error(errors.join(','));
 }
});
