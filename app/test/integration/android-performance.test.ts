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
import {frameSample,summarizePerformance,correlateColdStartup,pidIsAbsent,type ColdProof,type FrameSample} from '../support/performance-samples.ts';
import {failureKind,retryDelay} from '../../src/core/sync/retry.ts';
// API fixture starts before the emulator. Accept only the launcher's verified discovery path.
if(process.env.RITMO_READER_BOOTSTRAP){
 const directory=resolve(process.env.RITMO_READER_BOOTSTRAP),ready=join(directory,'device.json'),deadline=Date.now()+240000;
 while(!existsSync(ready)&&Date.now()<deadline){if(existsSync(join(directory,'cancel')))throw new Error('reader_launch_canceled');await new Promise<void>(resolve=>setTimeout(resolve,200));}
 const data:unknown=JSON.parse(readFileSync(ready,'utf8'));
 assert.ok(data&&typeof data==='object'&&'discovery' in data&&typeof data.discovery==='string'&&'port' in data&&typeof data.port==='number'&&Number.isInteger(data.port));
 process.env.RITMO_EMULATOR_DISCOVERY=data.discovery;process.env.RITMO_EMULATOR_GRPC_PORT=String(data.port);
}
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,pkg='dev.ritmo.readonlytest',devicePort='tcp:18766';
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024}).trim();
const rect=(n:Node)=>n.bounds!.match(/-?\d+/g)!.map(Number);
const point=(n:Node)=>{const b=rect(n);return [Math.floor((b[0]!+b[2]!)/2),Math.floor((b[1]!+b[3]!)/2)] as const;};
const described=(n:Node,label:string)=>n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails);
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};

test('Android native frames: cold launch, local cards and durable visual toggle latency',
 {skip:!serial||process.env.RITMO_READER_PERFORMANCE!=='1',timeout:1800000},async()=>{
 const origin=process.env.RITMO_TEST_API;assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));
 assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');assert.equal(adb('reverse','--list').includes(devicePort),false);
 // Observer target rejection is verified independently before this functional replay.
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE!);mkdirSync(folder,{recursive:true});
 const capture=(name:string)=>writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000,maxBuffer:16*1024*1024}));
 const observingFocus=process.env.RITMO_READER_OBSERVE_FOCUS==='1';assert.equal(observingFocus,false,'performance_requires_no_focus_override');
 const phases:string[]=[],targets:Record<string,unknown>[]=[],imeReadiness:Record<string,unknown>[]=[],rawFrames:FrameSample[]=[],launches:Record<string,unknown>[]=[],jsMarks:unknown[]=[];

 const report=(phase:string,fontScale=1)=>{phases.push(phase);const line=JSON.stringify({phase,passed:true,fontScale});console.log(line);if(process.env.RITMO_READER_PROGRESS)appendFileSync(process.env.RITMO_READER_PROGRESS,line+'\n');};
 const read=()=>{
  const result=adb('shell','am','instrument','-e','targetPackage',pkg,'-w','dev.ritmo.readerobserver/.ReaderObserver'),xml=result.match(/^INSTRUMENTATION_RESULT: hierarchy=(.*)$/m)?.[1];
  writeFileSync(join(folder,'latest-observer-status.json'),JSON.stringify({hierarchyAvailable:!!xml,error:result.match(/^INSTRUMENTATION_RESULT: observer_error=(.*)$/m)?.[1]??null},null,2)+'\n');
  if(!xml)return {nodes:[] as Node[],allNodes:[] as Node[],windows:[] as Node[],meta:{} as Node};
  writeFileSync(join(folder,'latest-hierarchy.xml'),xml+'\n');
  return parseReaderHierarchy(xml);
 };
 const animationKeys=['animator_duration_scale','transition_animation_scale','window_animation_scale'],animations=animationKeys.map(key=>[key,adb('shell','settings','get','global',key)] as const);
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data');
 const keys=['enabled_accessibility_services','accessibility_enabled','touch_exploration_enabled','stylus_handwriting_enabled'],saved=keys.map(key=>[key,adb('shell','settings','get','secure',key)] as const),font=adb('shell','settings','get','system','font_scale'),screenTimeout=adb('shell','settings','get','system','screen_off_timeout');
 writeFileSync(join(folder,'reader-environment.json'),JSON.stringify({serial,pkg,secureSettings:Object.fromEntries(saved),fontScale:font,screenTimeout,wifi,data,animations:Object.fromEntries(animations)},null,2)+'\n');
 const touch=await openEmulatorTouch();let reversed=false,success=false;
 const launch=(fault?:string)=>{adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-n',pkg+'/.MainActivity',...(fault?['-a','android.intent.action.VIEW','-d','ritmo:///?ritmoTestFault='+fault]:[]));};
 const scroll=async(down=true)=>{
  const tree=read(),n=tree.nodes.find(n=>n.scrollable==='true'&&n['visible-to-user']==='true');if(!n)return;
  const b=rect(n),ime=tree.meta['ime-visible']==='true'?tree.meta['ime-bounds']!.match(/-?\d+/g)!.map(Number)[1]!:Infinity;
  const top=Math.max(b[1]!,80),bottom=Math.min(b[3]!,ime)-40,x=Math.floor((b[0]!+b[2]!)/2)-40;
  if(bottom-top<120)return;
  const from=Math.floor(top+(bottom-top)*(down?0.8:0.3)),to=Math.floor(top+(bottom-top)*(down?0.3:0.8));
  await touch.scroll([x,from],[x,to]);
 };
 const top=async()=>{for(let i=0;i<3;i++)await scroll(false);};
 const find=async(label:string,allowScroll=true,minimumHeight=1):Promise<Node>=>{
  const deadline=Date.now()+75000;let swipes=0;
  while(Date.now()<deadline){const tree=read(),visible=tree.nodes.filter(n=>n['visible-to-user']==='true'&&rect(n)[3]!-rect(n)[1]!>=minimumHeight),n=visible.find(n=>described(n,label))??visible.find(n=>n.text===label);if(n)return n;
   if(allowScroll&&swipes++<14)await scroll(swipes<7);else await pause(300);
  }try{capture('failure-missing-target');}catch{}throw new Error('reader_target_missing_'+label);
 };
 const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
 const press=async(label:string)=>{
  const n=await find(label,true,Math.floor(44*density)),b=rect(n);assert.ok(Math.min(b[2]!-b[0]!,b[3]!-b[1]!)>=Math.floor(44*density));const p=point(n);
  await touch.down(p);await pause(60);await touch.up();await pause(300);targets.push({label,bounds:b,density});
 };
 const enter=async(label:string,value:string)=>{
  await top();const before=await find(label);await press(label);
  const deadline=Date.now()+12000,samples:Record<string,unknown>[]=[];let previous='',stable=0;
  let tree=read(),field=tree.nodes.find(n=>described(n,label)),imeTop=Infinity;
  while(Date.now()<deadline){
   tree=read();field=tree.nodes.find(n=>described(n,label));
   imeTop=tree.meta['ime-visible']==='true'?tree.meta['ime-bounds']!.match(/-?\d+/g)!.map(Number)[1]!:Infinity;
   const visible=!!field&&field.focused==='true'&&tree.meta['ime-visible']==='true'&&rect(field)[3]!<=imeTop;
   const geometry=visible?field!.bounds+'|'+tree.meta['ime-bounds']:'';
   samples.push({focused:field?.focused,imeVisible:tree.meta['ime-visible'],fieldBounds:field?.bounds,imeBounds:tree.meta['ime-bounds']});
   // An unavailable hierarchy is not evidence of a hidden keyboard. Preserve only
   // the previous valid observation; an observed blur/hidden IME still resets it.
   if(!tree.meta['application-window-count']){await pause(300);continue;}
   stable=visible&&geometry===previous?stable+1:visible?1:0;previous=geometry;
   if(stable>=2)break;await pause(300);
  }
  imeReadiness.push({label,stableObservations:stable,samples});writeFileSync(join(folder,'ime-readiness.json'),JSON.stringify(imeReadiness,null,2)+'\n');
  assert.ok(field&&stable>=2,'focused_field_and_visible_stable_keyboard_required_'+label);
  assert.equal(field.focused,'true','input_not_focused_'+label);assert.equal(tree.meta['ime-visible'],'true','keyboard_not_visible');
  assert.ok(rect(field)[3]!<=imeTop,'field_hidden_by_keyboard_'+label);
  targets.push({label,inputBounds:rect(field),imeTop,focused:true});
  // Fixture text uses hardware key events; this is not proof of TalkBack character/cursor editing.
  adb('shell','input','keyevent','KEYCODE_MOVE_END');const length=field.password==='true'?128:Array.from(before.text??'').length;
  if(length)adb('shell','input','keyevent',...Array.from({length},()=>'KEYCODE_DEL'));
  adb('shell','input','text',value.replace(/ /g,'%s'));adb('shell','input','keyevent','KEYCODE_BACK');await pause(500);
  if(field.password!=='true')assert.equal((await find(label)).text,value);
 };

 const snapshot=async(name:string)=>{
  const deadline=Date.now()+12000,observations:Record<string,unknown>[]=[];
  do {
   const tree=read(),count=Number(tree.meta['application-window-count']??0);
   observations.push({applicationWindows:count,...JSON.parse(readFileSync(join(folder,'latest-observer-status.json'),'utf8')) as Record<string,unknown>});
   writeFileSync(join(folder,name+'-observations.json'),JSON.stringify(observations,null,2)+'\n');
   if(count>0){writeFileSync(join(folder,name+'.xml'),readFileSync(join(folder,'latest-hierarchy.xml')));capture(name);return;}
   await pause(250);
  }while(Date.now()<deadline);
  capture(name);throw new Error('reader_snapshot_has_no_current_hierarchy');
 };
 const offline=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');};
 const restoreNetwork=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 const online=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;restoreNetwork();};
 const repeat=async<T,>(work:()=>Promise<T>):Promise<T>=>{for(let attempt=1;;attempt++)try{return await work();}catch(error){if(attempt>=3||failureKind(error)!=='retry')throw error;await pause(retryDelay(attempt,error,Date.now()));}};
 const run=randomUUID(),email='perf'+run+'@example.test',password='performance-fixture-password',title='Amostra local';
 let other:ReturnType<typeof openTestStore>|undefined;
 const logs=(pid:string)=>adb('logcat','-d','--pid='+pid,'-v','raw','-s','RitmoPerf:I','ReactNativeJS:I','*:S').split('\n');
 const frames=(pid:string)=>logs(pid).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l) as unknown);
 const waitFrame=async(pid:string,sample:number,kind:'startup'|'toggle',sequence?:number,proof?:ColdProof)=>{
  const deadline=Date.now()+45000;
  while(Date.now()<deadline){
   const values=frames(pid);writeFileSync(join(folder,'native-events-'+sample+'.json'),JSON.stringify(values,null,2)+'\n');const invalid=values.find(v=>v&&typeof v==='object'&&'kind' in v&&v.kind==='invalid');assert.equal(invalid,undefined,'native_measurement_invalid_'+JSON.stringify(invalid));
   for(const value of values){
    if(!value||typeof value!=='object')continue;
    const candidate=value as Record<string,unknown>;
    if(candidate.sample!==sample||candidate.kind!==kind||sequence!==undefined&&candidate.sequence!==sequence)continue;
    if(kind==='startup'){assert.ok(proof);return correlateColdStartup(value,proof);}
    return frameSample(value);
   }
   await pause(250);
  }
  throw new Error('native_frame_missing_'+sample+'_'+kind+'_'+sequence);
 };
 const assertNoPid=()=>{try{assert.equal(adb('shell','pidof',pkg),'');}catch(error){if(!pidIsAbsent(error))throw error;}};
 try {
  assert.ok(Number(adb('shell','getprop','ro.build.version.sdk'))>=35);
  adb('shell','settings','put','secure','enabled_accessibility_services','null');adb('shell','settings','put','secure','accessibility_enabled','0');adb('shell','settings','put','secure','touch_exploration_enabled','0');
  // Isolate keyboard preparation from the system's first-use handwriting tutorial.
  adb('shell','settings','put','secure','stylus_handwriting_enabled','0');assert.equal(adb('shell','settings','get','secure','stylus_handwriting_enabled'),'0');
  for(const key of animationKeys)adb('shell','settings','put','global',key,'0');
  adb('shell','settings','put','system','font_scale','1.0');adb('shell','settings','put','system','screen_off_timeout','1800000');
  adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;launch();await find(pt.register);await press(pt.register);
  await enter(pt.name,'Pessoa de medidas');await enter(pt.email,email);await enter(pt.password,password);await press(pt.register);await find(pt.timezone);await enter(pt.timezone,'UTC');await press(pt.continue);await enter(pt.habitName,title);await press(pt.firstHabitAction);await find(pt.synced);
  const identity=new HttpIdentity(origin),credentials=await identity.login(email,password,uuid());other=openTestStore(':memory:',credentials.accountId,uuid());
  const transport=new HttpSync(origin,credentials.accountId,()=>credentials.accessToken,uuid);await repeat(()=>synchronize(other!,transport));
  const instant=(await transport.pull(other.cursor())).serverTime,day=getDayKey(new Date(instant),credentials.profile.timeContext.timezone,credentials.profile.timeContext.dayStartHour);
  report('real_account_and_local_habit_prepared');offline();await find(pt.offline);await snapshot('01-offline-before-cohort');
  const rejected=adb('shell','am','instrument','-e','targetPackage','dev.ritmo.journeytest','-e','sample','1','-w','dev.ritmo.readerobserver/.PerformanceLauncher');
  assert.match(rejected,/launcher_error=isolated_performance_target_required/);writeFileSync(join(folder,'launcher-target-guard.json'),JSON.stringify({normalPackageRejected:true},null,2)+'\n');
  const pids=new Set<string>();
  for(let sample=1;sample<=10;sample++){
   adb('shell','am','force-stop',pkg);assertNoPid();
   const output=adb('shell','am','instrument','-e','targetPackage',pkg,'-e','sample',String(sample),'-w','dev.ritmo.readerobserver/.PerformanceLauncher');
   writeFileSync(join(folder,'device-launch-'+sample+'.txt'),output+'\n');
   assert.match(output,/INSTRUMENTATION_CODE: 0/);assert.match(output,/clock=device_intent_request/);
   const launchNs=Number(output.match(/^INSTRUMENTATION_RESULT: launchNs=([0-9]+)\r?$/m)?.[1]),launcherPid=Number(output.match(/^INSTRUMENTATION_RESULT: launcherPid=([0-9]+)\r?$/m)?.[1]);
   assert.ok(Number.isSafeInteger(launchNs)&&launchNs>0);assert.ok(Number.isSafeInteger(launcherPid)&&launcherPid>0);
   let pid='';const pidDeadline=Date.now()+10000;
   while(!pid&&Date.now()<pidDeadline){try{pid=adb('shell','pidof',pkg);}catch(error){if(!pidIsAbsent(error))throw error;}if(!pid)await pause(100);}
   assert.match(pid,/^[0-9]+$/);assert.ok(!pids.has(pid));pids.add(pid);
   const proof:ColdProof={pidAbsentBeforeLaunch:true,pidAfterLaunch:Number(pid),launcherPid,launchNs,sample};
   const startup=await waitFrame(pid,sample,'startup',undefined,proof);rawFrames.push(startup);launches.push({sample,pid,launchState:'PROCESS_COLD',expectedPendingChangesAtStart:2*(sample-1),proof,deviceLauncher:output});
   await find(pt.habitLabel(title,false));await find(pt.totalXp(0));if(sample===1||sample===10)await snapshot('02-cold-'+sample);
   for(let sequence=1;sequence<=2;sequence++){
    await press(pt.habitLabel(title,sequence===2));const measured=await waitFrame(pid,sample,'toggle',sequence);rawFrames.push(measured);
    await find(pt.habitLabel(title,sequence===1));await find(pt.totalXp(sequence===1?10:0));
    if(sample===1&&sequence===1||sample===10&&sequence===2)await snapshot('03-toggle-'+sample+'-'+sequence);
   }
   jsMarks.push(...logs(pid).filter(l=>l.includes('RITMO_PERF_JS ')).map(l=>{const at=l.indexOf('RITMO_PERF_JS ');try{return {sample,...JSON.parse(l.slice(at+14)) as Record<string,unknown>};}catch{return {sample,unparsed:true};}}));
   writeFileSync(join(folder,'native-frames.json'),JSON.stringify(rawFrames,null,2)+'\n');writeFileSync(join(folder,'cold-launches.json'),JSON.stringify(launches,null,2)+'\n');
   report('cold_'+sample+'_and_two_visual_changes_measured');
  }
  const summary=summarizePerformance(rawFrames);writeFileSync(join(folder,'performance-summary.json'),JSON.stringify(summary,null,2)+'\n');writeFileSync(join(folder,'javascript-milestones.json'),JSON.stringify(jsMarks,null,2)+'\n');
  launch();await find(pt.offline);await find(pt.habitLabel(title,false));await find(pt.totalXp(0));await snapshot('04-cohort-survives-restart');await press(pt.habitLabel(title,false));await find(pt.totalXp(10));online();await find(pt.synced);
  await repeat(()=>synchronize(other!,transport));assert.equal(other.view(day).habits.filter(h=>h.title===title).length,1);assert.equal(other.view(day).habits.find(h=>h.title===title)?.done,true);assert.equal(other.view(day).totalXp,10);await snapshot('05-confirmed-once');
  writeFileSync(join(folder,'remote-result.json'),JSON.stringify({habitCount:1,done:true,totalXp:10,coldStarts:10,timedVisualChanges:20,persistedAfterRestart:true},null,2)+'\n');report('durable_final_mark_converges_once');success=true;
 }catch(error){try{await snapshot('failure-performance');}catch{}throw error;}finally{
  other?.close();const failedSteps:string[]=[];
  const work=[{name:'bridge',run:()=>touch.close()},...saved.map(([k,v])=>({name:k,run:()=>v==='null'?adb('shell','settings','delete','secure',k):adb('shell','settings','put','secure',k,v)})),...animations.map(([k,v])=>({name:k,run:()=>v==='null'?adb('shell','settings','delete','global',k):adb('shell','settings','put','global',k,v)})),{name:'network',run:restoreNetwork},{name:'font',run:()=>adb('shell','settings','put','system','font_scale',font)},{name:'screen_timeout',run:()=>adb('shell','settings','put','system','screen_off_timeout',screenTimeout)},{name:'stop_fixture',run:()=>adb('shell','am','force-stop',pkg)},...(reversed?[{name:'reverse',run:()=>adb('reverse','--remove',devicePort)}]:[])];
  for(const step of work)try{await step.run();}catch{failedSteps.push(step.name);}
  const readback:Record<string,string>={};
  for(const [namespace,key,expected] of [...saved.map(([key,value])=>['secure',key,value] as const),...animations.map(([key,value])=>['global',key,value] as const),['system','font_scale',font] as const,['system','screen_off_timeout',screenTimeout] as const,['global','wifi_on',wifi] as const,['global','mobile_data',data] as const])try{readback[key]=adb('shell','settings','get',namespace,key);if(readback[key]!==expected)failedSteps.push('readback_'+key);}catch{failedSteps.push('readback_'+key);}
  try{if(adb('reverse','--list').includes(devicePort))failedSteps.push('readback_reverse');}catch{failedSteps.push('readback_reverse');}
  writeFileSync(join(folder,'reader-cleanup.json'),JSON.stringify({restored:!failedSteps.length,failedSteps,readback},null,2)+'\n');
  const apkSha256=createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../../../.scratch/runtime/interface/readonly-journey/current.apk'))).digest('hex');
  writeFileSync(join(folder,'matrix-summary.json'),JSON.stringify({measurementPassed:success&&!failedSteps.length,apkSha256,fontScale:1,talkBack:false,stylusHandwriting:false,animations:0,imeReadiness,phases,targets,coldFrames:rawFrames.filter(f=>f.kind==='startup').length,toggleFrames:rawFrames.filter(f=>f.kind==='toggle').length,authentication:{touch:[touch.unauthenticatedCode,touch.wrongAudienceCode,touch.wrongIssuerCode]},physicalInput:'grpc.sendTouch',observer:'FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES_between_intervals',scope:'native frame rendering and issue to display subsystem from device-side Intent launch request and ACTION_UP; cold process established by absence and new PID; AVD baseline only, not physical-device acceptance, screen photon time, TalkBack or full M1',restored:!failedSteps.length},null,2)+'\n');
  if(failedSteps.length&&success)throw new Error('performance_cleanup_incomplete');
 }
});
