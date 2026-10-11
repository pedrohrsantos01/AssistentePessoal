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
import {habitGlyph} from '../../src/features/habits/catalog.ts';
import {failureKind,retryDelay} from '../../src/core/sync/retry.ts';
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,origin=process.env.RITMO_TEST_API,pkg='dev.ritmo.journeytest',devicePort='tcp:18766';
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
// UIAutomator serializes supplementary Unicode as decimal XML entities.
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
 {skip:!serial,timeout:900000},async()=>{
 assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));assert.match(serial!,/^emulator-[0-9]+$/);assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');
 assert.equal(adb('reverse','--list').includes(devicePort),false,'reserved test port already owned');
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
 const targets:{label:string;widthPixels:number;heightPixels:number;density:number;scale:string;boundsPixels:number[];visibleBottomPixels?:number}[]=[];let targetScale='100%';
 // Android exposes integer pixel rectangles; floor is the native lower rounding bound.
 const assertTarget=async(label:string,scroll=false,visibleBottom=Infinity)=>{const bounds=(await find(label,scroll,Math.floor(44*density),visibleBottom)).bounds!.match(/-?\d+/g)!.map(Number),width=bounds[2]!-bounds[0]!,height=bounds[3]!-bounds[1]!;targets.push({label,widthPixels:width,heightPixels:height,density,scale:targetScale,boundsPixels:bounds,...(Number.isFinite(visibleBottom)?{visibleBottomPixels:visibleBottom}:{})});assert.ok(width>=Math.floor(44*density)&&height>=Math.floor(44*density),'native_target_smaller_than_44_'+label+' '+width+'x'+height+' density='+density);};
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data'),font=adb('shell','settings','get','system','font_scale');
 const night=adb('shell','cmd','uimode','night').split(':').pop()!.trim(),animations=['animator_duration_scale','transition_animation_scale','window_animation_scale'].map(key=>[key,adb('shell','settings','get','global',key)] as const);
 assert.equal(wifi,'1');const run=randomUUID(),email=run+'@example.test',password='journey-fixture-password';
 let succeeded=false,reversed=false,other:ReturnType<typeof openTestStore>|undefined;
 const connect=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin!).port);reversed=true;};
 const disconnect=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}};
 const restore=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 try {
  adb('wait-for-device');adb('shell','settings','put','system','font_scale','1.0');adb('shell','cmd','uimode','night','no');connect();launch();
  // Previous synthetic runs may retain a session; leave it through the same public UI.
  let initial=nodes();const entryDeadline=Date.now()+45000;while(!initial.some(n=>n.package===pkg&&[pt.settings,pt.register,pt.onboarding,pt.firstHabit].some(label=>(n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails))||n.text===label))&&Date.now()<entryDeadline) {await pause(300);initial=nodes();}
  if(initial.some(n=>n.text===pt.onboarding||n.text===pt.firstHabit)) {await tap(pt.logout,true);await tap(pt.logout);await find(pt.register);}
  else if(initial.some(n=>n['content-desc']===pt.settings)) {
   await tap(pt.settings);await tap(pt.logout,true);await tap(pt.logout);await find(pt.register);
  }
  await find(pt.register);await assertTarget(pt.register);capture('01-entrada');await tap(pt.hasAccount);await find(pt.login);capture('01-login');await tap(pt.back);await tap(pt.register);capture('02-cadastro-vazio');await assertTarget(pt.registrationNoticeLabel,true);await tap(pt.registrationNoticeLabel,true);await find(pt.privacyTitle);await assertTarget(pt.close,true);capture('01-privacidade');await tap(pt.close,true);
  adb('shell','settings','put','system','font_scale','2.0');targetScale='200%';launch();await find(pt.register);await tap(pt.register);await find(pt.name);capture('02-cadastro-200-topo');await assertTarget(pt.registrationNoticeLabel,true);capture('02-cadastro-200-rodape');await tap(pt.registrationNoticeLabel,true);await find(pt.privacyTitle);await assertTarget(pt.close,true);await tap(pt.close,true);const largeImeTop=await showKeyboard(pt.password);await assertTarget(pt.hasAccount,true,largeImeTop);await assertTarget(pt.hasAccount,false,keyboardTop());capture('02-cadastro-teclado-200-rodape');adb('shell','input','keyevent','KEYCODE_BACK');
  adb('shell','settings','put','system','font_scale','1.0');targetScale='100%';launch();await find(pt.register);await tap(pt.register);await find(pt.name);await fill(pt.name,'Pedro');await fill(pt.email,email);await fill(pt.password,password);const imeTop=await showKeyboard(pt.password);capture('02-cadastro-teclado');await assertTarget(pt.hasAccount,true,imeTop);await assertTarget(pt.hasAccount,false,keyboardTop());capture('02-cadastro-teclado-rodape');adb('shell','input','keyevent','KEYCODE_BACK');await tap(pt.register,true);
  await find(pt.onboarding);capture('02-fuso');await fill(pt.timezone,'UTC');capture('02-fuso-editavel');await tap(pt.continue,true);await find(pt.firstHabit);
  launch();await find(pt.firstHabit);report('onboarding_resumed');capture('03-primeiro-habito');adb('shell','settings','put','system','font_scale','2.0');targetScale='200%';launch();await find(pt.firstHabit);capture('03-primeiro-habito-200-topo');await assertTarget(pt.skip,true);capture('03-primeiro-habito-200');adb('shell','settings','put','system','font_scale','1.0');targetScale='100%';launch();await find(pt.firstHabit);await assertTarget(pt.skip,true);await assertTarget(pt.suggestionLabel(pt.suggestions[0].title,habitGlyph(pt.suggestions[0].icon)),true);await tap(pt.skip,true);await find(pt.emptyTitle);await find(pt.synced);capture('04-briefing-vazio');report('empty_briefing');
  const credentials=await new HttpIdentity(origin!).login(email,password,uuid());
  const day=getDayKey(new Date(),credentials.profile.timeContext.timezone,credentials.profile.timeContext.dayStartHour);
  other=openTestStore(':memory:',credentials.accountId,uuid());
  const transport=new HttpSync(origin!,credentials.accountId,()=>credentials.accessToken,()=>uuid());
  const independent=async<T>(work:()=>Promise<T>):Promise<T>=>{for(let attempt=1;;attempt++) try {return await work();} catch(error) {if(attempt>=3||failureKind(error)!=='retry') throw error;console.log(JSON.stringify({diagnostic:'independent_http_transport_retry',attempt}));await pause(retryDelay(attempt,error,Date.now()));}};
  const syncOther=()=>independent(()=>synchronize(other!,transport));
  disconnect();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');await find(pt.offline);
  await tap(pt.firstHabitCreate,true);await fill(pt.habitName,'Leitura offline');await tap(pt.icons.reading,true);await tap(pt.colors.blue,true);await tap(pt.createHabit,true);await find(pt.habitLabel('Leitura offline',false));await tap(pt.habitLabel('Leitura offline',false));await find(pt.habitLabel('Leitura offline',true));await assertTarget(pt.habitLabel('Leitura offline',true));await assertTarget(pt.settings);await assertTarget(pt.habits);await assertTarget(pt.briefing);await find(pt.totalXp(10),true);capture('05-briefing-offline');report('offline_product');
  launch();await find(pt.habitLabel('Leitura offline',true));await find(pt.totalXp(10),true);report('product_reopened');
  await tap(pt.habitLabel('Leitura offline',true),true);await find(pt.habitLabel('Leitura offline',false));await find(pt.totalXp(0),true);
  await tap(pt.habitLabel('Leitura offline',false),true);await find(pt.habitLabel('Leitura offline',true));await find(pt.totalXp(10),true);report('undo_remark');
  connect();restore();await find(pt.synced);await syncOther();assert.equal(other.view(day).habits.length,1);assert.equal(other.view(day).habits[0]?.done,true);assert.equal(other.view(day).totalXp,10);assert.equal(other.presentation(day).habits[0]?.iconKey,'reading');assert.equal(other.presentation(day).habits[0]?.colorToken,'blue');report('product_converged');capture('06-briefing-sincronizado');
  // An independent device marks the same occurrence; the UI total must remain ten.
  other.enqueue({type:'habit.mark',habitId:other.view(day).habits[0]!.habitId,dayKey:day,timeContext:credentials.profile.timeContext,observedUndoIds:other.observedUndoIds(other.view(day).habits[0]!.habitId,day)},uuid(),new Date().toISOString());
  await syncOther();assert.equal(other.view(day).totalXp,10);
  adb('shell','cmd','uimode','night','yes');adb('wait-for-device');launch();await find(pt.habitLabel('Leitura offline',true));capture('07-briefing-escuro');report('system_dark');
  for(const [key] of animations) adb('shell','settings','put','global',key,'0');
  adb('shell','settings','put','system','font_scale','2.0');targetScale='200%';launch();await find(pt.habitLabel('Leitura offline',true));await find(pt.totalXp(10),true);capture('08-texto-200');
  const privacy=await find(pt.settings);const bounds=privacy.bounds!.match(/\d+/g)!.map(Number);assert.ok(bounds[3]!>bounds[1]!);await assertTarget(pt.settings);await assertTarget(pt.habits);await assertTarget(pt.briefing);report('font_200');
  await tap(pt.settings);await find(pt.logout,true);capture('09-ajustes-texto-200');await tap(pt.privacy,true);await find(pt.privacyTitle);await assertTarget(pt.close,true);capture('09-privacidade-texto-200');await tap(pt.close,true);await tap(pt.briefing);await find(pt.habitLabel('Leitura offline',true));
  await tap(pt.habitLabel('Leitura offline',true));await find(pt.habitLabel('Leitura offline',false));await tap(pt.habitLabel('Leitura offline',false));await find(pt.habitLabel('Leitura offline',true));report('reduced_motion_action');
  adb('shell','settings','put','system','font_scale','1.0');targetScale='100%';launch();await find(pt.habitLabel('Leitura offline',true));adb('shell','cmd','uimode','night','no');adb('wait-for-device');launch();await find(pt.habitLabel('Leitura offline',true));capture('10-briefing-claro');report('system_light');await tap(pt.settings);await find(pt.logout,true);capture('10-ajustes-claro');await tap(pt.logout,true);await find(pt.logoutTitle);await assertTarget(pt.cancel,true);capture('10-saida-claro');await tap(pt.cancel,true);await tap(pt.briefing);report('product_verified');
  const firstId=other.view(day).habits[0]!.habitId;
  disconnect();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');await find(pt.offline);
  await tap(pt.habits);await tap(pt.editLabel('Leitura offline'),true);await fill(pt.habitName,'Leitura revisada');await tap(pt.saveHabit,true);
  await tap(pt.newHabit,true);capture('11-novo-habito');await fill(pt.habitName,'Caminhada');await tap(pt.icons.running,true);await tap(pt.colors.accent,true);await tap(pt.createHabit,true);
  await tap(pt.moveLabel('Caminhada',-1),true);const order=nodes().filter(n=>[pt.editLabel('Caminhada'),pt.editLabel('Leitura revisada')].includes(n['content-desc']??'')).map(n=>n['content-desc']);assert.deepEqual(order,[pt.editLabel('Caminhada'),pt.editLabel('Leitura revisada')]);capture('11-gestao-offline');report('management_offline');
  launch();await find(pt.habitLabel('Leitura revisada',true));await tap(pt.habits);await find(pt.editLabel('Caminhada'));report('management_reopened');
  other.enqueue({type:'habit.patchMetadata',habitId:firstId,patch:{iconKey:'writing',colorToken:'amber'}},uuid(),new Date().toISOString());await syncOther();
  connect();restore();await tap(pt.briefing);await find(pt.synced);await syncOther();assert.deepEqual(other.view(day).habits.map(h=>h.title),['Caminhada','Leitura revisada']);assert.equal(other.presentation(day).habits[1]!.iconKey,'writing');assert.equal(other.presentation(day).habits[1]!.colorToken,'amber');assert.equal(other.view(day).totalXp,10);assert.equal(other.presentation(day).habits[0]!.iconKey,'running');assert.equal(other.presentation(day).habits[0]!.colorToken,'accent');report('independent_metadata_merged');await tap(pt.habits);capture('12-gestao-sincronizada');
  disconnect();adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');await tap(pt.briefing);await find(pt.offline);await tap(pt.habits);await tap(pt.editLabel('Leitura revisada'),true);await tap(pt.icons.plant,true);await tap(pt.colors.violet,true);capture('13-preview-edicao');await assertTarget(pt.icons.plant,true);await assertTarget(pt.colors.violet,true);await tap(pt.saveHabit,true);
  launch();await find(pt.habitLabel('Leitura revisada',true));await tap(pt.habits);await tap(pt.editLabel('Leitura revisada'),true);assert.equal((await find(pt.icons.plant,true)).checked,'true');assert.equal((await find(pt.colors.violet,true)).checked,'true');await tap(pt.deleteHabit,true);await find(pt.deleteBody);await tap(pt.cancel,true);await find(pt.habitName);await tap(pt.deleteHabit,true);await find(pt.deleteTitle);await assertTarget(pt.deleteHabit,true);await assertTarget(pt.cancel,true);capture('14-confirmacao-exclusao');report('deletion_cancelled');await tap(pt.deleteHabit,true);await find(pt.editLabel('Caminhada'));launch();await find(pt.habitLabel('Caminhada',false));await find(pt.totalXp(0),true);assert.ok(!nodes().some(n=>n['content-desc']===pt.habitLabel('Leitura revisada',true)));report('deletion_reopened_offline');
  connect();restore();await find(pt.synced);await syncOther();assert.deepEqual(other.view(day).habits.map(h=>h.title),['Caminhada']);assert.equal(other.view(day).totalXp,0);capture('15-exclusao-sincronizada');report('deletion_converged');
  adb('shell','settings','put','system','font_scale','2.0');targetScale='200%';launch();await find(pt.habitLabel('Caminhada',false));await tap(pt.habits);await assertTarget(pt.editLabel('Caminhada'),true);await assertTarget(pt.moveLabel('Caminhada',-1),true);await assertTarget(pt.moveLabel('Caminhada',1),true);capture('16-gestao-texto-200');await tap(pt.editLabel('Caminhada'),true);await tap(pt.deleteHabit,true);await find(pt.deleteBody,true);await assertTarget(pt.deleteHabit,true);await assertTarget(pt.cancel,true);capture('17-exclusao-texto-200');await tap(pt.cancel,true);report('management_200_and_delete_targets');
  const reference=await independent(()=>transport.pull(other!.cursor()));const futureInstant=new Date(Date.parse(reference.serverTime)+86400000),futureDay=getDayKey(futureInstant,credentials.profile.timeContext.timezone,credentials.profile.timeContext.dayStartHour),futureId=uuid();
  const futureOperation=other.enqueue({type:'habit.create',habitId:futureId,title:'Amanha',habitType:'binary',scheduleKind:'daily',startDayKey:futureDay,timeContext:credentials.profile.timeContext,iconKey:'reading',colorToken:'blue',sortOrder:1},uuid(),futureInstant.toISOString());await syncOther();assert.equal(other.recovery().find(r=>r.operation.operationId===futureOperation.operationId)?.error.code,undefined,'future fixture rejected');assert.ok(!other.operations().some(op=>op.operationId===futureOperation.operationId));assert.ok(other.presentation(day).managementHabits.some(h=>h.habitId===futureId));
  // A tolerated clock skew on another device can already produce this canonical case.
  launch();await find(pt.habitLabel('Caminhada',false));assert.ok(!nodes().some(n=>n['content-desc']===pt.habitLabel('Amanha',false)));await tap(pt.habits);await find(pt.editLabel('Amanha'),true);capture('18-gestao-inicio-futuro');
  launch();await find(pt.habitLabel('Caminhada',false));await tap(pt.habits);await tap(pt.editLabel('Caminhada'),true);await tap(pt.deleteHabit,true);await find(pt.deleteTitle);await tap(pt.deleteHabit,true);await find(pt.editLabel('Amanha'),true);await tap(pt.briefing);await find(pt.noDueTitle,true);capture('19-briefing-sem-devidos');
  launch();await find(pt.noDueTitle,true);await tap(pt.habits);await tap(pt.editLabel('Amanha'),true);await fill(pt.habitName,'Inicio futuro');await tap(pt.saveHabit,true);await find(pt.editLabel('Inicio futuro'),true);launch();await find(pt.synced);await tap(pt.habits);await find(pt.editLabel('Inicio futuro'),true);await syncOther();assert.equal(other.view(day).habits.length,0);assert.deepEqual(other.presentation(day).managementHabits.map(h=>h.title),['Inicio futuro']);assert.equal(other.view(day).totalXp,0);report('future_start_managed_without_early_completion');report('management_verified');if(process.env.RITMO_JOURNEY_EVIDENCE) writeFileSync(join(resolve(process.env.RITMO_JOURNEY_EVIDENCE),'native-targets.json'),JSON.stringify({minimumLogicalUnits:44,pixelRounding:'floor',measurements:targets,passed:true},null,2)+'\n');succeeded=true;
 } catch(error) {console.error(error instanceof Error?error.message:'native_journey_failed');try {capture('debug-failure');const folder=resolve('../.scratch/runtime/ritmo-app');mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'failure-ui.json'),JSON.stringify(nodes().filter(n=>n.package===pkg),null,2));writeFileSync(join(folder,'failure-window.txt'),adb('shell','dumpsys','window'));} catch { /* Preserve the original failure if the device is disconnected. */ }throw error;} finally {
  other?.close();const cleanupErrors:unknown[]=[];
  const cleanup=[()=>adb('wait-for-device'),()=>adb('shell','am','force-stop',pkg),disconnect,restore,()=>adb('shell','settings','put','system','font_scale',font),()=>adb('shell','cmd','uimode','night',night),...animations.map(([key,value])=>()=>adb('shell','settings','put','global',key,value)),()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')];
  for(const work of cleanup) try {work();} catch(error) {cleanupErrors.push(error);}
  if(cleanupErrors.length) {if(succeeded) throw new AggregateError(cleanupErrors,'native_cleanup_failed');console.error('native_cleanup_incomplete');}
 }
});
