import {failureKind,retryDelay} from '../../src/core/sync/retry.ts';
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
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,origin=process.env.RITMO_TEST_API,pkg='dev.ritmo.journeytest',devicePort='tcp:18766';
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const independent=async<T>(work:()=>Promise<T>):Promise<T>=>{for(let attempt=1;;attempt++)try{return await work();}catch(error){if(attempt>=3||failureKind(error)!=='retry')throw error;await pause(retryDelay(attempt,error,Date.now()));}};
// UIAutomator serializes supplementary Unicode as decimal XML entities.
const decode=(s:string)=>s.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_match,hex:string|undefined,decimal:string|undefined)=>String.fromCodePoint(Number.parseInt(hex??decimal!,hex?16:10))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function nodes() {
 adb('shell','uiautomator','dump','/sdcard/ritmo-journey.xml');
 return [...adb('shell','cat','/sdcard/ritmo-journey.xml').matchAll(/<node\s+([^>]+)>?/g)].map(match=>Object.fromEntries([...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(pair=>[pair[1]!,decode(pair[2]!)])));
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
 const node=await find(label,scroll),box=node.bounds!.match(/\d+/g)!.map(Number);
 adb('shell','input','tap',String(Math.floor((box[0]!+box[2]!)/2)),String(Math.floor((box[1]!+box[3]!)/2)));await pause(250);
}
async function fill(label:string,value:string) {
 const current=await find(label,true);await tap(label);
 adb('shell','input','keyevent','KEYCODE_MOVE_END');
 const length=Array.from(current.text??'').length;
 if(length) adb('shell','input','keyevent',...Array.from({length},()=>'KEYCODE_DEL'));
 adb('shell','input','text',value.replace(/ /g,'%s'));adb('shell','input','keyevent','KEYCODE_BACK');await pause(250);
}
function launch(fault?:string) {adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-n',pkg+'/.MainActivity',...(fault?['-a','android.intent.action.VIEW','-d','ritmo:///?ritmoTestFault='+fault]:[]));}
function report(phase:string) {console.log(JSON.stringify({phase,passed:true}));}
function capture(name:string) {
 if(!process.env.RITMO_JOURNEY_EVIDENCE) return;
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE);mkdirSync(folder,{recursive:true});
 writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000}));
}
test('visible Android appearance: six palettes, large text, system/manual mode, installation persistence and isolated failure',
 {skip:!serial,timeout:900000},async()=>{
 assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));assert.match(serial!,/^emulator-[0-9]+$/);assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');
 assert.equal(adb('reverse','--list').includes(devicePort),false,'reserved port already owned');
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
 const font=adb('shell','settings','get','system','font_scale'),night=adb('shell','cmd','uimode','night').split(':').pop()!.trim();
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data');
 const animationKeys=['animator_duration_scale','transition_animation_scale','window_animation_scale'],animations=animationKeys.map(key=>[key,adb('shell','settings','get','global',key)] as const);
 const email=randomUUID()+'@example.test',emailB=randomUUID()+'@example.test',password='appearance-test-password',title='Leitura de um capitulo com conteudo longo para verificar quebra de linha sem esconder o controle';
 let observer:ReturnType<typeof openTestStore>|undefined,succeeded=false,scale='100%';const targets:{label:string;scale:string;widthPixels:number;heightPixels:number;density:number}[]=[],observations:{metric:string;elapsedMilliseconds:number;meaning:string}[]=[];
 const target=async(label:string)=>{const node=await find(label,true,Math.floor(44*density)),box=node.bounds!.match(/-?\d+/g)!.map(Number);targets.push({label,scale,widthPixels:box[2]!-box[0]!,heightPixels:box[3]!-box[1]!,density});};
 const top=()=>{for(let i=0;i<3;i++)adb('shell','input','swipe','500','550','500','1900','200');};
 const checked=async(label:string)=>{const node=await find(label,true);assert.equal(node.checked,'true','selection_not_checked_'+label);};
 const leave=async()=>{await tap(pt.settings);await tap(pt.logout,true);await tap(pt.logout);await find(pt.register);};
 const login=async(value:string)=>{await tap(pt.hasAccount);await fill(pt.email,value);await fill(pt.password,password);await tap(pt.login,true);};
 try{
  adb('shell','settings','put','system','font_scale','1.0');adb('shell','cmd','uimode','night','no');adb('reverse',devicePort,'tcp:'+new URL(origin!).port);
  const identity=new HttpIdentity(origin!);const credentials=await identity.register(email,password,'Pedro',uuid());await identity.register(emailB,password,'Outra conta',uuid());
  launch();await find(pt.register);capture('01-primeira-abertura');await login(email);await find(pt.onboarding);await tap(pt.continue,true);await fill(pt.habitName,title);await tap(pt.firstHabitAction,true);await find(pt.habitLabel(title,false));await tap(pt.habitLabel(title,false));await find(pt.habitLabel(title,true));await find(pt.totalXp(10),true);await find(pt.synced);
  observer=openTestStore(':memory:',credentials.accountId,uuid());const transport=new HttpSync(origin!,credentials.accountId,async()=>credentials.accessToken,uuid);await independent(()=>synchronize(observer!,transport));
  const current=await independent(()=>identity.login(email,password,uuid()));const day=getDayKey(new Date(),current.profile.timeContext.timezone,current.profile.timeContext.dayStartHour);assert.equal(observer.view(day).totalXp,10);assert.equal(observer.view(day).habits.length,1);
  await tap(pt.settings);await checked(pt.appearanceNames.holo);await checked(pt.followSystem);capture('02-padrao-ajustes');report('default_and_real_habit_preserved');
  for(const factor of ['1.0','2.0']){
   adb('shell','settings','put','system','font_scale',factor);scale=factor==='1.0'?'100%':'200%';launch();await find(pt.settings);await tap(pt.settings);
   for(const skin of ['holo','cockpit','neo'] as const){
    top();await target(pt.appearanceNames[skin]);await tap(pt.appearanceNames[skin],true);await checked(pt.appearanceNames[skin]);
    for(const mode of ['light','dark'] as const){
     top();const toggle=await find(pt.darkMode,true);if((toggle.checked==='true')!==(mode==='dark'))await tap(pt.darkMode,true);
     // Ensure a manual choice even if the effective system value already matches.
     if((await find(pt.followSystem,true)).checked==='true')await tap(pt.followSystem,true);
     top();capture('03-'+skin+'-'+mode+'-'+scale.replace('%',''));await target(pt.darkMode);await target(pt.followSystem);
     await tap(pt.briefing);await find(pt.habitLabel(title,true),true);capture('04-briefing-'+skin+'-'+mode+'-'+scale.replace('%',''));await tap(pt.settings);
    }
   }
  }
  adb('shell','settings','put','system','font_scale','1.0');scale='100%';launch();await find(pt.settings);await tap(pt.settings);top();await checked(pt.appearanceNames.neo);
  await checked(pt.darkMode);if((await find(pt.followSystem,true)).checked!=='true')await tap(pt.followSystem,true);
  adb('shell','cmd','uimode','night','no');await pause(600);top();assert.equal((await find(pt.darkMode,true)).checked,'false');capture('05-sistema-claro');
  adb('shell','cmd','uimode','night','yes');await pause(600);top();await checked(pt.darkMode);capture('05-sistema-escuro');
  await tap(pt.darkMode,true);adb('shell','cmd','uimode','night','no');adb('shell','cmd','uimode','night','yes');await pause(600);assert.equal((await find(pt.darkMode,true)).checked,'false');assert.equal((await find(pt.followSystem,true)).checked,'false');report('six_palettes_100_200_system_and_manual');
  await leave();capture('06-logout-conserva-neo-claro');await login(emailB);await find(pt.onboarding);await tap(pt.continue,true);await tap(pt.skip,true);await find(pt.emptyTitle);await tap(pt.settings);top();await checked(pt.appearanceNames.neo);assert.equal((await find(pt.darkMode,true)).checked,'false');await leave();await login(email);await find(pt.habitLabel(title,true));report('appearance_installation_account_isolation');
  launch('preferences-read');await find(pt.preferenceReadFailure);await find(pt.habitLabel(title,true));await tap(pt.habitLabel(title,true));await tap(pt.settings);top();assert.equal((await find(pt.appearanceNames.neo,true))['enabled'],'false');capture('07-leitura-indisponivel-dominio-ativo');await target(pt.retryAppearanceRead);await tap(pt.retryAppearanceRead);top();await checked(pt.appearanceNames.neo);capture('07-leitura-recuperada');
  launch('preferences-write');await find(pt.settings);await tap(pt.settings);top();await tap(pt.appearanceNames.cockpit,true);await find(pt.preferenceWriteFailure,true);await checked(pt.appearanceNames.neo);capture('08-escrita-recusada');await target(pt.retryAppearance);await tap(pt.retryAppearance,true);top();await checked(pt.appearanceNames.cockpit);capture('08-escrita-retentada');report('preference_failures_do_not_block_session_or_local_work');
  // Real system reduction-of-motion settings; the app has only static feedback/decorations and press transitions.
  for(const key of animationKeys)adb('shell','settings','put','global',key,'0');launch();await find(pt.settings);await tap(pt.habitLabel(title,false));await find(pt.habitLabel(title,true));capture('09-movimento-reduzido');
  const cold=performance.now();launch();await find(pt.habitLabel(title,true));observations.push({metric:'cold_start_to_observed_habit',elapsedMilliseconds:performance.now()-cold,meaning:'Upper bound includes am -W and UIAutomator inspection; does not prove the 2s target.'});
  const feedback=performance.now();await tap(pt.habitLabel(title,true));await find(pt.habitLabel(title,false));observations.push({metric:'tap_to_observed_checkbox',elapsedMilliseconds:performance.now()-feedback,meaning:'Upper bound includes ADB/UIAutomator and settling; does not prove the 100ms target.'});
  await find(pt.synced);await independent(()=>synchronize(observer!,transport));assert.equal(observer.view(day).habits.length,1);assert.equal(observer.view(day).totalXp,0);
  adb('uninstall',pkg);adb('install','--no-streaming',resolve('android/app/build/outputs/apk/release/app-release.apk'));launch();await find(pt.register);capture('10-reinstalacao-padrao');await login(email);await find(pt.habitLabel(title,false));await tap(pt.settings);top();await checked(pt.appearanceNames.holo);await checked(pt.followSystem);capture('10-reinstalacao-ajustes');report('reinstall_defaults_without_restored_preferences');
  const services=adb('shell','pm','list','packages').split(/\r?\n/).filter(line=>/talkback|accessibilitysuite|marvin/i.test(line));
  const folder=process.env.RITMO_JOURNEY_EVIDENCE;if(folder){writeFileSync(join(resolve(folder),'native-targets.json'),JSON.stringify({minimumLogicalUnits:44,measurements:targets,passed:true},null,2)+'\n');writeFileSync(join(resolve(folder),'native-observations.json'),JSON.stringify({measurements:observations,screenReaderPackages:services,talkBackAcceptance:false,performanceAcceptance:false},null,2)+'\n');}
  succeeded=true;report('appearance_verified_reader_and_performance_gates_reported');
 }catch(error){console.error(error instanceof Error?error.message:'native_appearance_failed');try{capture('debug-failure');}catch{}throw error;}finally{
  observer?.close();const errors:unknown[]=[];for(const work of [()=>adb('shell','am','force-stop',pkg),()=>adb('reverse','--remove',devicePort),()=>adb('shell','settings','put','system','font_scale',font),()=>adb('shell','cmd','uimode','night',night),()=>adb('shell','svc','wifi',wifi==='1'?'enable':'disable'),()=>adb('shell','svc','data',data==='1'?'enable':'disable'),...animations.map(([key,value])=>()=>adb('shell','settings','put','global',key,value)),()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')])try{work();}catch(error){errors.push(error);}if(errors.length&&succeeded)throw new AggregateError(errors,'native_cleanup_failed');
 }
});
