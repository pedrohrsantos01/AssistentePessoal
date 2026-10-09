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
async function find(label:string,scroll=false) {
 const deadline=Date.now()+45000;let swipes=0;
 while(Date.now()<deadline) {
  const list=nodes(),node=list.find(n=>n.package===pkg&&n['content-desc']===label)??list.find(n=>n.package===pkg&&n.text===label);
  if(node) return node;
  if(scroll&&swipes++<5) {const viewport=list.find(n=>n.package===pkg&&n.bounds)?.bounds?.match(/\d+/g)?.map(Number);if(viewport) adb('shell','input','swipe',String(Math.floor(viewport[2]!/2)),String(Math.floor(viewport[3]!*0.8)),String(Math.floor(viewport[2]!/2)),String(Math.floor(viewport[3]!*0.35)),'400');}
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
function launch() {adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-n',pkg+'/.MainActivity');}
function report(phase:string) {console.log(JSON.stringify({phase,passed:true}));}
function capture(name:string) {
 if(!process.env.RITMO_JOURNEY_EVIDENCE) return;
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE);mkdirSync(folder,{recursive:true});
 writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000}));
}
test('visible Android product journey: registration, interrupted onboarding, empty Briefing, offline habit/XP, restart, undo/remark and HTTP convergence',
 {skip:!serial,timeout:390000},async()=>{
 assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));assert.match(serial!,/^emulator-[0-9]+$/);assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');
 assert.equal(adb('reverse','--list').includes(devicePort),false,'reserved test port already owned');
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
 const targets:{label:string;widthPixels:number;heightPixels:number;density:number;scale:string}[]=[];let targetScale='100%';
 // Android exposes integer pixel rectangles; floor is the native lower rounding bound.
 const assertTarget=async(label:string,scroll=false)=>{const bounds=(await find(label,scroll)).bounds!.match(/\d+/g)!.map(Number),width=bounds[2]!-bounds[0]!,height=bounds[3]!-bounds[1]!;targets.push({label,widthPixels:width,heightPixels:height,density,scale:targetScale});assert.ok(width>=Math.floor(44*density)&&height>=Math.floor(44*density),'native_target_smaller_than_44_'+label+' '+width+'x'+height+' density='+density);};
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data'),font=adb('shell','settings','get','system','font_scale');
 const night=adb('shell','cmd','uimode','night').split(':').pop()!.trim(),animations=['animator_duration_scale','transition_animation_scale','window_animation_scale'].map(key=>[key,adb('shell','settings','get','global',key)] as const);
 assert.equal(wifi,'1');const run=randomUUID(),email=run+'@example.test',password='journey-fixture-password';
 let succeeded=false,reversed=false,other:ReturnType<typeof openTestStore>|undefined;
 const connect=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin!).port);reversed=true;};
 const disconnect=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}};
 const restore=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 try {
  adb('wait-for-device');connect();launch();
  // Previous synthetic runs may retain a session; leave it through the same public UI.
  let initial=nodes();const entryDeadline=Date.now()+45000;while(!initial.some(n=>n.package===pkg&&[pt.settings,pt.register,pt.onboarding,pt.firstHabit].some(label=>n['content-desc']===label||n.text===label))&&Date.now()<entryDeadline) {await pause(300);initial=nodes();}
  if(initial.some(n=>n.text===pt.onboarding||n.text===pt.firstHabit)) {await tap(pt.logout,true);await tap(pt.logout);await find(pt.register);}
  else if(initial.some(n=>n['content-desc']===pt.settings)) {
   await tap(pt.settings);await tap(pt.logout,true);await tap(pt.logout);await find(pt.register);
  }
  await find(pt.register);await assertTarget(pt.register);await assertTarget(pt.privacy);capture('01-entrada');await tap(pt.register);await fill(pt.name,'Pessoa Journey');await fill(pt.email,email);await fill(pt.password,password);await tap(pt.password);capture('02-cadastro-teclado');adb('shell','input','keyevent','KEYCODE_BACK');await tap(pt.register,true);
  await find(pt.onboarding);capture('02-fuso');await fill(pt.timezone,'UTC');await tap(pt.continue,true);await find(pt.firstHabit);
  launch();await find(pt.firstHabit);report('onboarding_resumed');capture('03-primeiro-habito');await assertTarget(pt.skip,true);await tap(pt.skip,true);await find(pt.emptyTitle);await find(pt.synced);capture('04-briefing-vazio');report('empty_briefing');
  const credentials=await new HttpIdentity(origin!).login(email,password,uuid());
  const day=getDayKey(new Date(),credentials.profile.timeContext.timezone,credentials.profile.timeContext.dayStartHour);
  other=openTestStore(':memory:',credentials.accountId,uuid());
  const transport=new HttpSync(origin!,credentials.accountId,()=>credentials.accessToken,()=>uuid());
  const syncOther=async()=>{for(let attempt=1;;attempt++) try {await synchronize(other!,transport);return;} catch(error) {if(attempt>=3||failureKind(error)!=='retry') throw error;console.log(JSON.stringify({diagnostic:'independent_http_transport_retry',attempt}));await pause(retryDelay(attempt,error,Date.now()));}};
  disconnect();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');await find(pt.offline);
  await tap(pt.createHabit,true);await fill(pt.habitName,'Leitura offline');await tap(pt.icons.reading,true);await tap(pt.colors.blue,true);await tap(pt.createHabit,true);await find(pt.habitLabel('Leitura offline',false));await tap(pt.habitLabel('Leitura offline',false));await find(pt.habitLabel('Leitura offline',true));await assertTarget(pt.habitLabel('Leitura offline',true));await assertTarget(pt.settings);await assertTarget(pt.habits);await assertTarget(pt.briefing);await find('10',true);capture('05-briefing-offline');report('offline_product');
  launch();await find(pt.habitLabel('Leitura offline',true));await find('10',true);report('product_reopened');
  await tap(pt.habitLabel('Leitura offline',true),true);await find(pt.habitLabel('Leitura offline',false));await find('0',true);
  await tap(pt.habitLabel('Leitura offline',false),true);await find(pt.habitLabel('Leitura offline',true));await find('10',true);report('undo_remark');
  connect();restore();await find(pt.synced);await syncOther();assert.equal(other.view(day).habits.length,1);assert.equal(other.view(day).habits[0]?.done,true);assert.equal(other.view(day).totalXp,10);assert.equal(other.presentation(day).habits[0]?.iconKey,'reading');assert.equal(other.presentation(day).habits[0]?.colorToken,'blue');report('product_converged');capture('06-briefing-sincronizado');
  // An independent device marks the same occurrence; the UI total must remain ten.
  other.enqueue({type:'habit.mark',habitId:other.view(day).habits[0]!.habitId,dayKey:day,timeContext:credentials.profile.timeContext,observedUndoIds:other.observedUndoIds(other.view(day).habits[0]!.habitId,day)},uuid(),new Date().toISOString());
  await syncOther();assert.equal(other.view(day).totalXp,10);
  adb('shell','cmd','uimode','night','yes');adb('wait-for-device');launch();await find(pt.habitLabel('Leitura offline',true));capture('07-briefing-escuro');report('system_dark');
  for(const [key] of animations) adb('shell','settings','put','global',key,'0');
  adb('shell','settings','put','system','font_scale','2.0');targetScale='200%';launch();await find(pt.habitLabel('Leitura offline',true));await find('10',true);capture('08-texto-200');
  const privacy=await find(pt.settings);const bounds=privacy.bounds!.match(/\d+/g)!.map(Number);assert.ok(bounds[3]!>bounds[1]!);await assertTarget(pt.settings);await assertTarget(pt.habits);await assertTarget(pt.briefing);report('font_200');
  await tap(pt.settings);await find(pt.logout,true);capture('09-ajustes-texto-200');await tap(pt.briefing);await find(pt.habitLabel('Leitura offline',true));
  await tap(pt.habitLabel('Leitura offline',true));await find(pt.habitLabel('Leitura offline',false));await tap(pt.habitLabel('Leitura offline',false));await find(pt.habitLabel('Leitura offline',true));report('reduced_motion_action');
  adb('shell','settings','put','system','font_scale',font);launch();await find(pt.habitLabel('Leitura offline',true));adb('shell','cmd','uimode','night','no');adb('wait-for-device');launch();await find(pt.habitLabel('Leitura offline',true));capture('10-briefing-claro');report('system_light');report('product_verified');if(process.env.RITMO_JOURNEY_EVIDENCE) writeFileSync(join(resolve(process.env.RITMO_JOURNEY_EVIDENCE),'native-targets.json'),JSON.stringify({minimumLogicalUnits:44,pixelRounding:'floor',measurements:targets,passed:true},null,2)+'\n');succeeded=true;
 } catch(error) {console.error(error instanceof Error?error.message:'native_journey_failed');try {capture('debug-failure');} catch { /* Preserve the original failure if the device is disconnected. */ }throw error;} finally {
  other?.close();const cleanupErrors:unknown[]=[];
  const cleanup=[()=>adb('wait-for-device'),()=>adb('shell','am','force-stop',pkg),disconnect,restore,()=>adb('shell','settings','put','system','font_scale',font),()=>adb('shell','cmd','uimode','night',night),...animations.map(([key,value])=>()=>adb('shell','settings','put','global',key,value)),()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')];
  for(const work of cleanup) try {work();} catch(error) {cleanupErrors.push(error);}
  if(cleanupErrors.length) {if(succeeded) throw new AggregateError(cleanupErrors,'native_cleanup_failed');console.error('native_cleanup_incomplete');}
 }
});
