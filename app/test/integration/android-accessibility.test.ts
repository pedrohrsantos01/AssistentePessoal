import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pt} from '../../src/i18n/pt-BR.ts';
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,pkg='dev.ritmo.journeytest';
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
// UIAutomator serializes supplementary Unicode as decimal XML entities.
const decode=(s:string)=>s.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_match,hex:string|undefined,decimal:string|undefined)=>String.fromCodePoint(Number.parseInt(hex??decimal!,hex?16:10))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function nodes() {
 try {
 const dumped=adb('shell','uiautomator','dump','/sdcard/ritmo-journey.xml');if(!dumped.includes('dumped to:')){console.log(JSON.stringify({phase:'waiting_for_native_hierarchy'}));return [];}
 return [...adb('shell','cat','/sdcard/ritmo-journey.xml').matchAll(/<node\s+([^>]+)>?/g)].map(match=>Object.fromEntries([...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(pair=>[pair[1]!,decode(pair[2]!)])));
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
 const point=(node:Record<string,string>)=>{const box=node.bounds!.match(/-?\d+/g)!.map(Number);return [Math.floor((box[0]!+box[2]!)/2),Math.floor((box[1]!+box[3]!)/2)] as const;};
 const readerEnabled=saved[0]![1]==='null'||!saved[0]![1]?service:saved[0]![1].split(':').includes(service)?saved[0]![1]:saved[0]![1]+':'+service;
 const assertReader=()=>{const state=adb('shell','dumpsys','accessibility');assert.match(state,/Bound services:[^\n]*label=TalkBack[,}]/);assert.match(state,/Enabled services:[^\n]*com[.]google[.]android[.]marvin[.]talkback[\/].*TalkBackService/);assert.ok(state.includes('touchExplorationEnabled=true'));return state;};
 const enableReader=async()=>{adb('shell','settings','put','secure','enabled_accessibility_services',readerEnabled);adb('shell','settings','put','secure','accessibility_enabled','1');adb('shell','settings','put','secure','touch_exploration_enabled','1');await pause(2000);assertReader();};
 // UiAutomation suppresses other services by default. Never call nodes/find while the reader is active.
 const pauseReader=async()=>{const remaining=readerEnabled.split(':').filter(value=>value!==service).join(':');if(remaining)adb('shell','settings','put','secure','enabled_accessibility_services',remaining);else adb('shell','settings','delete','secure','enabled_accessibility_services');await pause(1000);};
 assert.equal(adb('shell','id','-u'),'0','physical_touch_requires_owned_debug_input');
 const inputDevices=adb('shell','getevent','-lp'),screenSize=adb('shell','wm','size').match(/(?:Override|Physical) size: (\d+)x(\d+)/g)!.at(-1)!.match(/(\d+)x(\d+)/)!.slice(1).map(Number);
 const touchBlock=inputDevices.split('add device ').find(block=>/name:\s*"virtio_input_multi_touch_1"/.test(block));assert.ok(touchBlock,'main_physical_touch_device_required');const touchDevice=touchBlock.match(/\/dev\/input\/event[0-9]+/)?.[0];assert.ok(touchDevice,'physical_touch_path_required');
 const range=(axis:string)=>{const match=touchBlock.match(new RegExp(axis+'[^\\n]*max ([0-9]+)'));assert.ok(match,'physical_touch_axis_'+axis);return Number(match[1]);};
 const maxX=range('ABS_MT_POSITION_X'),maxY=range('ABS_MT_POSITION_Y');let tracking=100;
 console.log(JSON.stringify({phase:'physical_input_capabilities',maxX,maxY,screenSize}));
 const send=(events:readonly (readonly [number,number,number])[])=>adb('shell',events.map(([type,code,value])=>'sendevent '+touchDevice+' '+type+' '+code+' '+value).join(' && '));
 const down=([x,y]:readonly[number,number])=>{send([[3,47,0],[3,57,tracking++],[3,53,Math.round(x/(screenSize[0]!-1)*maxX)],[3,54,Math.round(y/(screenSize[1]!-1)*maxY)],[3,48,1280],[3,49,1280],[3,58,1024],[1,325,1],[1,330,1],[0,0,0]]);};
 const up=()=>send([[3,47,0],[3,58,0],[3,57,-1],[1,325,0],[1,330,0],[0,0,0]]);
 const focus=async(point:readonly[number,number])=>{assertReader();down(point);await pause(700);up();await pause(700);assertReader();};
 const activate=async()=>{assertReader();down([540,1600]);await pause(60);up();await pause(60);down([540,1600]);await pause(60);up();await pause(700);assertReader();};
 try{
  // Keep the reader's notifications denied and suppress only its permission prompt during this test. Restore original flags in finally.
  if(!notificationGranted&&temporaryPermissionFlags.length)adb('shell','pm','set-permission-flags',readerPackage,permission,...temporaryPermissionFlags);
  adb('shell','settings','put','system','font_scale','1.0');launch();await find(pt.settings);await tap(pt.briefing);
  const habit=nodes().find(node=>node.package===pkg&&node.class==='android.widget.CheckBox');assert.ok(habit?.['content-desc'],'existing_local_habit_required');const original=habit['content-desc']!,wasDone=habit.checked==='true';
  const density=Number(adb('shell','wm','density').match(/(?:Override|Physical) density: ([0-9]+)/g)!.at(-1)!.split(':').pop()!.trim())/160;
  const top=()=>{for(let i=0;i<3;i++)adb('shell','input','swipe','500','550','500','1900','200');};
  if(process.env.RITMO_ANDROID_READER_ONLY==='1'){const folder=process.env.RITMO_JOURNEY_EVIDENCE;assert.ok(folder,'palette_evidence_required');const prior:unknown=JSON.parse(readFileSync(join(resolve(folder),'palette-summary.json'),'utf8'));assert.ok(prior&&typeof prior==='object');const proof=prior as Record<string,unknown>;assert.equal(proof.apkSha256,apkSha256);assert.equal(proof.passed,true);assert.equal(proof.targetAssertions,36);assert.ok(Array.isArray(proof.captures)&&proof.captures.length===12&&proof.captures.every(name=>typeof name==='string'&&/^final-(holo|cockpit|neo)-(light|dark)-(100|200)[.]png$/.test(name)&&existsSync(join(resolve(folder),name))));report('using_twelve_palettes_verified_on_the_same_apk');}
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
  down(checkboxPoint);await pause(60);up();await pause(500);const probeChanged=original.replace(wasDone?', feito':', não feito',wasDone?', não feito':', feito');await find(probeChanged);down(checkboxPoint);await pause(60);up();await pause(500);await find(original);report('physical_input_marks_and_restores_before_reader');
  await enableReader();
  // Bring the product above any first-run tutorial, using no UiAutomation while TalkBack is bound.
  adb('shell','am','start','-W','-n',pkg+'/.MainActivity');await pause(2000);await focus(checkboxPoint);capture('01-talkback-foco-habito');const focused=assertReader();assert.ok(!focused.includes('Accessibility Focused Window Id = -1'),'reader_focus_missing');
  await pauseReader();await find(original);await enableReader();await focus(checkboxPoint);await activate();assertReader();capture('02-talkback-habito-alterado');await pauseReader();const changed=original.replace(wasDone?', feito':', não feito',wasDone?', não feito':', feito');await find(changed);
  await enableReader();await focus(checkboxPoint);await activate();assertReader();await pauseReader();await find(original);report('real_reader_focus_activation_and_undo');
  await enableReader();await focus(settingsPoint);await activate();assertReader();await pause(1000);await focus(cockpitPoint);capture('03-talkback-foco-aparencia');await activate();assertReader();capture('04-talkback-aparencia-ativa');
  down([300,900]);await pause(30);for(let x=350;x<=800;x+=50){send([[3,53,Math.round(x/(screenSize[0]!-1)*maxX)],[0,0,0]]);await pause(10);}up();await pause(600);assertReader();capture('05-talkback-navegacao-linear');await pauseReader();assert.equal((await find(pt.appearanceNames.cockpit)).checked,'true');report('real_reader_settings_selection_and_navigation');
  const folder=process.env.RITMO_JOURNEY_EVIDENCE;if(folder)writeFileSync(join(resolve(folder),'talkback-summary.json'),JSON.stringify({apkSha256,service,version:adb('shell','dumpsys','package','com.google.android.marvin.talkback').match(/versionName=([^\s]+)/)?.[1],touchExplorationEnabled:true,bound:true,focusWindow:true,physicalInput:touchDevice,focusDidNotActivateHabit:true,habitActivatedAndRestored:true,appearanceSelected:'cockpit',nativeTargets:targets,paletteProof:process.env.RITMO_ANDROID_READER_ONLY==='1'?'palette-summary.json':'current_execution',linearGestureExecuted:true,scope:'Briefing checkbox and appearance settings, text100%; no VoiceOver or complete all-state spoken-reading acceptance',passed:true},null,2)+'\n');success=true;
 }catch(error){try{capture('debug-reader-failure');}catch{}throw error;}finally{
  const errors:unknown[]=[];for(const work of [up,...(!notificationGranted&&temporaryPermissionFlags.length?[()=>adb('shell','pm','clear-permission-flags',readerPackage,permission,...temporaryPermissionFlags)]:[]),...saved.map(([key,value])=>()=>value==='null'?adb('shell','settings','delete','secure',key):adb('shell','settings','put','secure',key,value)),()=>adb('shell','settings','put','system','font_scale',font),()=>adb('shell','cmd','uimode','night',night),()=>adb('shell','am','force-stop',pkg),()=>adb('shell','rm','-f','/sdcard/ritmo-journey.xml')])try{work();}catch(error){errors.push(error);}if(errors.length&&success)throw new AggregateError(errors,'reader_cleanup_failed');
 }
});
