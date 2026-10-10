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
const decode=(s:string)=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function nodes() {
 adb('shell','uiautomator','dump','/sdcard/ritmo-journey.xml');
 return [...adb('shell','cat','/sdcard/ritmo-journey.xml').matchAll(/<node\s+([^>]+)>?/g)].map(match=>Object.fromEntries([...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(pair=>[pair[1]!,decode(pair[2]!)])));
}
async function find(label:string,scroll=false,minPixels=0) {
 const deadline=Date.now()+45000;let swipes=0;
 while(Date.now()<deadline) {
  const list=nodes(),node=list.find(n=>n.package===pkg&&(n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails)))??list.find(n=>n.package===pkg&&n.text===label);
  if(node) {const box=node.bounds?.match(/-?\d+/g)?.map(Number);if(box&&box[2]!>box[0]!&&box[3]!>box[1]!&&box[2]!-box[0]!>=minPixels&&box[3]!-box[1]!>=minPixels) return node;}
  if(scroll&&swipes++<8) {const viewport=list.find(n=>n.package===pkg&&n.bounds)?.bounds?.match(/\d+/g)?.map(Number);if(viewport) adb('shell','input','swipe',String(Math.floor(viewport[2]!/2)),String(Math.floor(viewport[3]!*0.8)),String(Math.floor(viewport[2]!/2)),String(Math.floor(viewport[3]!*0.35)),'400');}
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
test('visible Android session UI preserves offline writes across vault, opening, logout, A/B/A and reauthentication',
 {skip:!serial,timeout:900000},async()=>{
 assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));assert.match(serial!,/^emulator-[0-9]+$/);assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');
 assert.equal(adb('reverse','--list').includes(devicePort),false,'reserved test port already owned');
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
 const targets:{label:string;widthPixels:number;heightPixels:number;density:number;scale:string}[]=[];let scale='100%';
 const target=async(label:string,scroll=false)=>{const bounds=(await find(label,scroll,Math.floor(44*density))).bounds!.match(/-?\d+/g)!.map(Number),width=bounds[2]!-bounds[0]!,height=bounds[3]!-bounds[1]!;targets.push({label,widthPixels:width,heightPixels:height,density,scale});assert.ok(width>=Math.floor(44*density)&&height>=Math.floor(44*density));};
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data'),font=adb('shell','settings','get','system','font_scale'),night=adb('shell','cmd','uimode','night').split(':').pop()!.trim();
 assert.equal(wifi,'1');const run=randomUUID(),emailA='a'+run+'@example.test',emailB='b'+run+'@example.test',password='session-fixture-password';
 let reversed=false,succeeded=false,observer:ReturnType<typeof openTestStore>|undefined;
 const connect=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin!).port);reversed=true;};
 const disconnect=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}};
 const restore=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 const offline=()=>{disconnect();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');};
 const online=()=>{connect();restore();};
 const logIn=async(email:string)=>{await find(pt.email);await fill(pt.email,email);await fill(pt.password,password);await tap(pt.login,true);};
 const leave=async()=>{await tap(pt.settings);await tap(pt.logout,true);await find(pt.logoutTitle);await tap(pt.logout,true);};
 const noA=()=>assert.ok(!nodes().some(n=>[pt.habitLabel('Leitura A',true),pt.habitLabel('Leitura A revisada',true),pt.editLabel('Leitura A')].includes(n['content-desc']??'')),'A_data_exposed');
 const independent=async<T>(work:()=>Promise<T>):Promise<T>=>{for(let attempt=1;;attempt++) try {return await work();} catch(error) {if(attempt>=3||failureKind(error)!=='retry') throw error;await pause(retryDelay(attempt,error,Date.now()));}};
 try {
  adb('wait-for-device');adb('shell','settings','put','system','font_scale','1.0');adb('shell','cmd','uimode','night','no');connect();launch();
  await tap(pt.register);await fill(pt.name,'Pessoa A');await fill(pt.email,emailA);await fill(pt.password,password);await tap(pt.register,true);
  await find(pt.onboarding);await tap(pt.changeTimezone);await fill(pt.timezone,'UTC');await tap(pt.continue,true);await tap(pt.skip,true);await find(pt.emptyTitle);await find(pt.synced);
  const identity=new HttpIdentity(origin!),a=await identity.login(emailA,password,uuid());await identity.register(emailB,password,'Pessoa B',uuid());
  observer=openTestStore(':memory:',a.accountId,uuid());const transport=new HttpSync(origin!,a.accountId,()=>a.accessToken,()=>uuid());
  const syncObserver=()=>independent(()=>synchronize(observer!,transport));
  await syncObserver();const day=getDayKey(new Date(),a.profile.timeContext.timezone,a.profile.timeContext.dayStartHour);
  offline();await find(pt.offline);await tap(pt.createHabit,true);await fill(pt.habitName,'Leitura A');await tap(pt.createHabit,true);await tap(pt.habitLabel('Leitura A',false));await find(pt.habitLabel('Leitura A',true));await find('10',true);
  // A failed secure-store read pauses only remote work; the same local projection stays writable.
  launch('vault-read');await find(pt.vaultTitle);await target(pt.retryVault);capture('01-cofre-pausado');await tap(pt.habits);await find(pt.retryVault);await tap(pt.editLabel('Leitura A'),true);await fill(pt.habitName,'Leitura A revisada');await tap(pt.saveHabit,true);
  await tap(pt.briefing);await find(pt.habitLabel('Leitura A revisada',true));await find('10',true);await syncObserver();assert.equal(observer.view(day).habits.length,0,'paused local writes uploaded');
  adb('shell','settings','put','system','font_scale','2.0');scale='200%';launch('vault-read');await find(pt.vaultTitle);await target(pt.retryVault,true);capture('02-cofre-200');await tap(pt.retryVault,true);await tap(pt.habits);await find(pt.editLabel('Leitura A revisada'),true);assert.ok(!nodes().some(n=>n.text===pt.vaultTitle));report('vault_retry_keeps_local_writes');
  adb('shell','settings','put','system','font_scale','1.0');scale='100%';launch('vault-remove');await find(pt.habitLabel('Leitura A revisada',true));await leave();await find(pt.logoutIncomplete);await target(pt.finishLogout);capture('03-saida-incompleta');noA();assert.ok(!nodes().some(n=>n['content-desc']===pt.settings||n['content-desc']===pt.back));await tap(pt.finishLogout);await find(pt.register);noA();report('offline_logout_fences_routes');
  await tap(pt.hasAccount);await fill(pt.email,emailB);await fill(pt.password,password);await tap(pt.login,true);await find(pt.offlineAuth);assert.equal((await find(pt.email)).text,emailB);noA();
  online();await logIn(emailB);await find(pt.onboarding);await tap(pt.continue,true);await tap(pt.skip,true);await find(pt.emptyTitle);await find(pt.synced);noA();await syncObserver();assert.equal(observer.view(day).habits.length,0,'B uploaded A pending operations');capture('04-conta-b-isolada');report('account_B_isolated');
  await leave();await find(pt.register);await tap(pt.hasAccount);await logIn(emailA);await find(pt.habitLabel('Leitura A revisada',true));await find(pt.synced);await syncObserver();assert.equal(observer.view(day).habits.length,1);assert.equal(observer.view(day).habits[0]?.title,'Leitura A revisada');assert.equal(observer.view(day).totalXp,10);capture('05-retorno-a');report('account_A_reentry_converges_once');
  // Opening failures cannot replace a file or silently create an empty account.
  offline();await find(pt.offline);await tap(pt.habits);await tap(pt.editLabel('Leitura A revisada'),true);await fill(pt.habitName,'Leitura A preservada');await tap(pt.saveHabit,true);
  launch('account-open');await find(pt.databaseAccountTitle);noA();await target(pt.retryDatabase);await tap(pt.showDiagnosis);await find(pt.databaseScope.account);assert.ok(!nodes().some(n=>(n.text??'').includes('synthetic_private')));capture('06-base-conta-bloqueada');await tap(pt.retryDatabase);await find(pt.databaseAccountTitle);await tap(pt.retryDatabase);await find(pt.habitLabel('Leitura A preservada',true));await find('10',true);report('account_opening_retry_preserves_queue');
  adb('shell','settings','put','system','font_scale','2.0');scale='200%';launch('installation-open');await find(pt.databaseInstallationTitle);capture('07-instalacao-200-topo');assert.ok(!nodes().some(n=>n['content-desc']===pt.email||n['content-desc']===pt.settings));await target(pt.retryDatabase,true);await tap(pt.showDiagnosis,true);await find(pt.databaseScope.installation,true);await target(pt.hideDiagnosis,true);capture('07-instalacao-200-diagnostico');await tap(pt.retryDatabase,true);await find(pt.databaseInstallationTitle);await tap(pt.retryDatabase,true);await find(pt.habitLabel('Leitura A preservada',true),true);await find('10',true);report('installation_opening_retry_keeps_owner');
  adb('shell','settings','put','system','font_scale','1.0');scale='100%';launch();await find(pt.habitLabel('Leitura A preservada',true));online();await find(pt.synced);await syncObserver();assert.equal(observer.view(day).habits[0]?.title,'Leitura A preservada');assert.equal(observer.view(day).totalXp,10);
  // Absence of a secure-store value exercises the same public auth-required route.
  // Actual token-expiry/refresh rejection is covered with the real Session in component tests.
  launch('vault-absent');await find(pt.remoteLoginTitle);await target(pt.reauth);capture('08-autenticacao-remota');offline();await tap(pt.reauth);await fill(pt.email,emailA);await fill(pt.password,password);await tap(pt.login,true);await find(pt.offlineAuth);assert.equal((await find(pt.email)).text,emailA);await tap(pt.back);await find(pt.habitLabel('Leitura A preservada',true));await tap(pt.reauth);online();await logIn(emailB);await find(pt.sameAccountRequired);capture('09-mesma-conta');await logIn(emailA);await find(pt.habitLabel('Leitura A preservada',true));await find(pt.synced);await syncObserver();assert.equal(observer.view(day).totalXp,10);assert.equal(observer.view(day).habits.length,1);report('reauthentication_only_same_account');
  if(process.env.RITMO_JOURNEY_EVIDENCE) writeFileSync(join(resolve(process.env.RITMO_JOURNEY_EVIDENCE),'native-targets.json'),JSON.stringify({minimumLogicalUnits:44,pixelRounding:'floor',measurements:targets,passed:true},null,2)+'\n');succeeded=true;report('session_interface_verified');
 } catch(error) {console.error(error instanceof Error?error.message:'native_session_failed');try {capture('debug-failure');} catch { /* Keep the primary failure. */ }throw error;} finally {
  observer?.close();const errors:unknown[]=[];
  for(const work of [()=>adb('wait-for-device'),()=>adb('shell','am','force-stop',pkg),disconnect,restore,()=>adb('shell','settings','put','system','font_scale',font),()=>adb('shell','cmd','uimode','night',night),()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')]) try {work();} catch(error) {errors.push(error);}
  if(errors.length) {if(succeeded) throw new AggregateError(errors,'native_cleanup_failed');console.error('native_cleanup_incomplete');}
 }
});
