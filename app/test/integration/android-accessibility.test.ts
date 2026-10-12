import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {openEmulatorTouch} from '../support/emulator-touch.ts';
import {pt} from '../../src/i18n/pt-BR.ts';
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,pkg='dev.ritmo.journeytest';
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
// UIAutomator serializes supplementary Unicode as decimal XML entities.
const decode=(s:string)=>s.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_match,hex:string|undefined,decimal:string|undefined)=>String.fromCodePoint(Number.parseInt(hex??decimal!,hex?16:10))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function nodes() {
 try {
 const observed=adb('shell','am','instrument','-w','dev.ritmo.readerobserver/.ReaderObserver');
 const xml=observed.match(/^INSTRUMENTATION_RESULT: hierarchy=(.*)$/m)?.[1];
 if(!xml){console.log(JSON.stringify({phase:'waiting_for_native_hierarchy',observerError:observed.match(/^INSTRUMENTATION_RESULT: observer_error=(.*)$/m)?.[1]??'no_result'}));return [];}
 if(process.env.RITMO_JOURNEY_EVIDENCE)writeFileSync(join(resolve(process.env.RITMO_JOURNEY_EVIDENCE),'latest-hierarchy.xml'),xml+'\n');
 return [...xml.matchAll(/<node\s+([^>]+)>?/g)].map(match=>Object.fromEntries([...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(pair=>[pair[1]!,decode(pair[2]!)])));
 }catch(error){if(error instanceof Error&&/device offline|device still authorizing|device 'emulator-[0-9]+' not found/.test(error.message)){console.log(JSON.stringify({phase:'waiting_for_adb_transport'}));return [];}throw error;}
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
function launch(fault?:string) {adb('shell','am','force-stop',pkg);adb('shell','am','start','-W','-n',pkg+'/.MainActivity',...(fault?['-a','android.intent.action.VIEW','-d','ritmo:///?ritmoTestFault='+fault]:[]));}
function report(phase:string) {console.log(JSON.stringify({phase,passed:true}));}
function capture(name:string) {
 if(!process.env.RITMO_JOURNEY_EVIDENCE) return;
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE);mkdirSync(folder,{recursive:true});
 writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000}));
}
test('visible real TalkBack: focus and activate a local habit, navigate settings and select appearance',
 {skip:!serial,timeout:900000},async()=>{
 assert.match(serial!,/^emulator-[0-9]+$/);assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');
 const readerPackage='com.google.android.marvin.talkback',service=readerPackage+'/.TalkBackService',readerPackageInfo=adb('shell','dumpsys','package',readerPackage);assert.ok(readerPackageInfo.includes(service));
 const permission='android.permission.POST_NOTIFICATIONS',permissionState=readerPackageInfo.split('\n').find(line=>line.includes(permission+': granted='));assert.ok(permissionState,'notification_permission_state_required');
 const notificationGranted=permissionState.includes('granted=true'),temporaryPermissionFlags=['user-set','user-fixed'].filter(flag=>!permissionState.includes(flag.toUpperCase().replace('-','_')));

 const keys=['enabled_accessibility_services','accessibility_enabled','touch_exploration_enabled'],saved=keys.map(key=>[key,adb('shell','settings','get','secure',key)] as const);
 const apkSha256=createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../../android/app/build/outputs/apk/release/app-release.apk'))).digest('hex');
 const font=adb('shell','settings','get','system','font_scale'),night=adb('shell','cmd','uimode','night').split(':').pop()!.trim();let success=false;const targets:Record<string,unknown>[]=[];
 const environmentFolder=process.env.RITMO_JOURNEY_EVIDENCE;
 if(environmentFolder)writeFileSync(join(resolve(environmentFolder),'reader-environment.json'),JSON.stringify({serial,pkg,secureSettings:Object.fromEntries(saved),fontScale:font,nightMode:night,notificationGranted,temporaryPermissionFlags},null,2)+'\n');
 const point=(node:Record<string,string>)=>{const box=node.bounds!.match(/-?\d+/g)!.map(Number);return [Math.floor((box[0]!+box[2]!)/2),Math.floor((box[1]!+box[3]!)/2)] as const;};
 const readerEnabled=saved[0]![1]==='null'||!saved[0]![1]?service:saved[0]![1].split(':').includes(service)?saved[0]![1]:saved[0]![1]+':'+service;
 const assertReader=()=>{const state=adb('shell','dumpsys','accessibility');assert.match(state,/Bound services:[^\n]*label=TalkBack[,}]/);assert.match(state,/Enabled services:[^\n]*com[.]google[.]android[.]marvin[.]talkback[\/].*TalkBackService/);assert.ok(state.includes('touchExplorationEnabled=true'));return state;};
 const enableReader=async()=>{adb('shell','settings','put','secure','enabled_accessibility_services',readerEnabled);adb('shell','settings','put','secure','accessibility_enabled','1');adb('shell','settings','put','secure','touch_exploration_enabled','1');await pause(2000);assertReader();};
 // The observer always uses FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES and never launches the journey.
 const touch=await openEmulatorTouch(),{down,up}=touch;
 console.log(JSON.stringify({phase:'authenticated_sdk_physical_input',protocol:'sendTouch',authentication:'ES256',unauthenticatedRejected:true,unauthenticatedCode:touch.unauthenticatedCode,wrongAudienceCode:touch.wrongAudienceCode,wrongIssuerCode:touch.wrongIssuerCode,protoSha256:touch.protoSha256}));
 const focus=async(point:readonly[number,number])=>{assertReader();await down(point);await pause(700);await up();await pause(700);assertReader();};
 const activate=async(location:readonly[number,number])=>{assertReader();await down(location);await pause(60);await up();await pause(60);await down(location);await pause(60);await up();await pause(700);assertReader();};
 try{
  // Keep the reader's notifications denied and suppress only its permission prompt during this test. Restore original flags in finally.
  if(!notificationGranted&&temporaryPermissionFlags.length)adb('shell','pm','set-permission-flags',readerPackage,permission,...temporaryPermissionFlags);
  adb('shell','settings','put','system','font_scale','1.0');launch();await find(pt.settings);await tap(pt.briefing);
  const habitDeadline=Date.now()+45000;let habit:Record<string,string>|undefined;
  do {habit=nodes().find(node=>node.package===pkg&&node.class==='android.widget.CheckBox');if(!habit)await pause(300);}while(!habit&&Date.now()<habitDeadline);
  assert.ok(habit?.['content-desc'],'existing_local_habit_required');const original=habit['content-desc']!,wasDone=habit.checked==='true';
  const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
  const top=()=>{for(let i=0;i<3;i++)adb('shell','input','swipe','500','550','500','1900','200');};
  if(process.env.RITMO_ANDROID_READER_ONLY==='1'){const folder=process.env.RITMO_PALETTE_EVIDENCE??process.env.RITMO_JOURNEY_EVIDENCE;assert.ok(folder,'palette_evidence_required');const prior:unknown=JSON.parse(readFileSync(join(resolve(folder),'palette-summary.json'),'utf8'));assert.ok(prior&&typeof prior==='object');const proof=prior as Record<string,unknown>;assert.equal(proof.apkSha256,apkSha256);assert.equal(proof.passed,true);assert.equal(proof.targetAssertions,36);assert.ok(Array.isArray(proof.captures)&&proof.captures.length===12&&proof.captures.every(name=>typeof name==='string'&&/^final-(holo|cockpit|neo)-(light|dark)-(100|200)[.]png$/.test(name)&&existsSync(join(resolve(folder),name))));report('using_twelve_palettes_verified_on_the_same_apk');}
  else {for(const factor of ['1.0','2.0']){
   adb('shell','settings','put','system','font_scale',factor);launch();await find(pt.settings);await tap(pt.settings);
   for(const skin of ['holo','cockpit','neo'] as const){top();await tap(pt.appearanceNames[skin],true);assert.equal((await find(pt.appearanceNames[skin],true)).checked,'true');
    for(const mode of ['light','dark'] as const){top();if(((await find(pt.darkMode,true)).checked==='true')!==(mode==='dark'))await tap(pt.darkMode,true);if((await find(pt.followSystem,true)).checked==='true')await tap(pt.followSystem,true);top();capture('final-'+skin+'-'+mode+'-'+(factor==='1.0'?'100':'200'));report('final_palette_'+skin+'_'+mode+'_font_'+factor);
     for(const label of [pt.appearanceNames[skin],pt.darkMode,pt.followSystem]){const node=await find(label,true,Math.floor(44*density)),b=node.bounds!.match(/-?\d+/g)!.map(Number);targets.push({label,skin,mode,fontScale:factor,widthPixels:b[2]!-b[0]!,heightPixels:b[3]!-b[1]!,density});}
    }
   }
  }
   const folder=process.env.RITMO_JOURNEY_EVIDENCE;if(folder)writeFileSync(join(resolve(folder),'palette-summary.json'),JSON.stringify({apkSha256,passed:true,palettes:6,fontScales:[1,2],captures:['holo','cockpit','neo'].flatMap(skin=>['light','dark'].flatMap(mode=>['100','200'].map(factor=>'final-'+skin+'-'+mode+'-'+factor+'.png'))),targetAssertions:targets.length,nativeTargets:targets,readerAcceptance:false},null,2)+'\n');
  }
  report('final_apk_twelve_palettes_and_native_targets');adb('shell','settings','put','system','font_scale','1.0');launch();await find(pt.settings);await tap(pt.briefing);
  const checkboxPoint=point(await find(original)),settingsPoint=point(await find(pt.settings));
  await tap(pt.settings);top();await tap(pt.appearanceNames.neo);assert.equal((await find(pt.appearanceNames.neo)).checked,'true');const cockpitPoint=point(await find(pt.appearanceNames.cockpit));await tap(pt.briefing);await find(original);
  console.log(JSON.stringify({phase:'reader_cached_targets',checkboxPoint,settingsPoint,cockpitPoint,wasDone}));capture('00-reader-before-enable');
  await down(checkboxPoint);await pause(60);await up();await pause(500);const probeChanged=original.replace(wasDone?', feito':', não feito',wasDone?', não feito':', feito');await find(probeChanged);await down(checkboxPoint);await pause(60);await up();await pause(500);await find(original);report('physical_input_marks_and_restores_before_reader');
  await enableReader();
  adb('shell','am','start','-W','-n',pkg+'/.MainActivity');await pause(3000);
  const focusNode=async(label:string,location:readonly[number,number],captureName:string)=>{
   for(let attempt=0;attempt<3;attempt++){
    await focus(location);const node=await find(label);assertReader();
    if(node['accessibility-focused']==='true'){capture(captureName);return node;}
   }
   capture('debug-focus-missing');throw new Error('reader_node_focus_missing_'+label);
  };
  const habitFocused=await focusNode(original,checkboxPoint,'01-talkback-foco-habito');
  assert.equal(habitFocused.checked,wasDone?'true':'false','exploration_must_not_activate');
  await activate(checkboxPoint);const changed=original.replace(wasDone?', feito':', não feito',wasDone?', não feito':', feito');
  const activated=await find(changed);assertReader();assert.equal(activated.checked,wasDone?'false':'true');assert.equal(activated['accessibility-focused'],'true','committed_update_must_preserve_reader_focus');capture('02-talkback-habito-alterado');
  await focusNode(changed,checkboxPoint,'02a-talkback-foco-desfazer');await activate(checkboxPoint);await find(original);assertReader();capture('02b-talkback-habito-restaurado');report('real_reader_focus_activation_and_undo');
  await focusNode(pt.settings,settingsPoint,'03a-talkback-foco-ajustes');await activate(settingsPoint);await find(pt.appearanceNames.cockpit);assertReader();
  const radioFocused=await focusNode(pt.appearanceNames.cockpit,cockpitPoint,'03-talkback-foco-aparencia');assert.equal(radioFocused.checked,'false','exploration_must_not_select');
  await activate(cockpitPoint);
  const selectionDeadline=Date.now()+15000;let selected=await find(pt.appearanceNames.cockpit);
  while(selected.checked!=='true'&&Date.now()<selectionDeadline){await pause(100);selected=await find(pt.appearanceNames.cockpit);}
  assert.equal(selected.checked,'true');assertReader();capture('04-talkback-aparencia-ativa');
  const beforeLinear=await find(pt.appearanceNames.cockpit);assert.equal(beforeLinear['accessibility-focused'],'true');
  const gestureStart=point(beforeLinear),gestureEnd=Math.min(gestureStart[0]+350,1000),gestureBegan=performance.now();
  await down(gestureStart);await pause(20);await touch.move([gestureStart[0]+150,gestureStart[1]]);await pause(20);await touch.move([gestureEnd,gestureStart[1]]);await pause(20);await up();await pause(700);
  console.log(JSON.stringify({phase:'linear_gesture_transport',durationMs:performance.now()-gestureBegan-700,appPerformanceAcceptance:false}));
  const afterLinear=nodes().find(node=>node['accessibility-focused']==='true');assertReader();
  assert.equal(afterLinear?.['content-desc'],pt.appearanceNames.neo,'linear_swipe_must_focus_next_radio');
  assert.equal((await find(pt.appearanceNames.cockpit)).checked,'true','navigation_must_not_change_selection');
  capture('05-talkback-navegacao-linear');report('real_reader_settings_selection_and_navigation');
  const folder=process.env.RITMO_JOURNEY_EVIDENCE;if(folder)writeFileSync(join(resolve(folder),'talkback-summary.json'),JSON.stringify({apkSha256,service,version:adb('shell','dumpsys','package','com.google.android.marvin.talkback').match(/versionName=([^\s]+)/)?.[1],touchExplorationEnabled:true,bound:true,focusWindow:true,physicalInput:'grpc.sendTouch',sdkProtoSha256:touch.protoSha256,authentication:'ES256',unauthenticatedRejected:true,unauthenticatedCode:touch.unauthenticatedCode,wrongAudienceCode:touch.wrongAudienceCode,wrongIssuerCode:touch.wrongIssuerCode,focusDidNotActivateHabit:true,habitActivatedAndRestored:true,focusRetainedAfterMark:true,appearanceSelected:'cockpit',nativeTargets:targets,paletteProof:process.env.RITMO_ANDROID_READER_ONLY==='1'?relative(resolve(import.meta.dirname,'../../..'),join(resolve(process.env.RITMO_PALETTE_EVIDENCE??process.env.RITMO_JOURNEY_EVIDENCE!),'palette-summary.json')).replaceAll('\\','/'):'current_execution',linearGestureExecuted:true,linearFocusBefore:beforeLinear['content-desc'],linearFocusAfter:afterLinear['content-desc'],observer:'FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES',scope:'Briefing checkbox and appearance settings, text100%; no VoiceOver or complete all-state spoken-reading acceptance',passed:true},null,2)+'\n');success=true;
 }catch(error){try{capture('debug-reader-failure');}catch{}throw error;}finally{
  const errors:unknown[]=[],failedSteps:string[]=[];
  const cleanup=[{name:'physical_bridge',work:()=>touch.close()},
   ...(!notificationGranted&&temporaryPermissionFlags.length?[{name:'notification_flags',work:()=>adb('shell','pm','clear-permission-flags',readerPackage,permission,...temporaryPermissionFlags)}]:[]),
   ...saved.map(([key,value])=>({name:key,work:()=>value==='null'?adb('shell','settings','delete','secure',key):adb('shell','settings','put','secure',key,value)})),
   {name:'font_scale',work:()=>adb('shell','settings','put','system','font_scale',font)},
   {name:'night_mode',work:()=>adb('shell','cmd','uimode','night',night)},
   {name:'stop_journey_fixture',work:()=>adb('shell','am','force-stop',pkg)},
   {name:'temporary_hierarchy',work:()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')}];
  for(const step of cleanup)try{await step.work();}catch(error){errors.push(error);failedSteps.push(step.name);}
  if(environmentFolder)writeFileSync(join(resolve(environmentFolder),'reader-cleanup.json'),JSON.stringify({restored:errors.length===0,failedSteps},null,2)+'\n');
  if(errors.length&&success)throw new AggregateError(errors,'reader_cleanup_failed');
 }
});
