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
import {failureKind,retryDelay} from '../../src/core/sync/retry.ts';
// API fixture starts before the emulator. Accept only the launcher's verified discovery path.
if(process.env.RITMO_READER_BOOTSTRAP){
 const directory=resolve(process.env.RITMO_READER_BOOTSTRAP),ready=join(directory,'device.json'),deadline=Date.now()+240000;
 while(!existsSync(ready)&&Date.now()<deadline){if(existsSync(join(directory,'cancel')))throw new Error('reader_launch_canceled');await new Promise<void>(resolve=>setTimeout(resolve,200));}
 const data:unknown=JSON.parse(readFileSync(ready,'utf8'));
 assert.ok(data&&typeof data==='object'&&'discovery' in data&&typeof data.discovery==='string'&&'port' in data&&typeof data.port==='number'&&Number.isInteger(data.port));
 process.env.RITMO_EMULATOR_DISCOVERY=data.discovery;process.env.RITMO_EMULATOR_GRPC_PORT=String(data.port);
}
const serial=process.env.RITMO_ANDROID_JOURNEY_SERIAL,pkg='dev.ritmo.readonlytest',service='com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService',devicePort='tcp:18766';
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const adb=(...args:string[])=>execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024}).trim();
const rect=(n:Node)=>n.bounds!.match(/-?\d+/g)!.map(Number);
const point=(n:Node)=>{const b=rect(n);return [Math.floor((b[0]!+b[2]!)/2),Math.floor((b[1]!+b[3]!)/2)] as const;};
const described=(n:Node,label:string)=>n['content-desc']===label||n['content-desc']===pt.syncPillLabel(label)||label===pt.syncDetails&&n['content-desc']?.endsWith('. '+pt.syncDetails);
const matches=(n:Node,label:string)=>described(n,label)||n.text===label;
const uuid=()=>{const value=randomUUID();return value.slice(0,14)+'7'+value.slice(15);};

test('TalkBack at200%: nonempty interrupted snapshots preserve gates, previous base and dependent local work',
 {skip:!serial||process.env.RITMO_READER_PARTIAL_COPY!=='1',timeout:1800000},async()=>{
 const origin=process.env.RITMO_TEST_API;assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin));
 assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1');assert.equal(adb('reverse','--list').includes(devicePort),false);
 // Observer target rejection is verified independently before this functional replay.
 const folder=resolve(process.env.RITMO_JOURNEY_EVIDENCE!);mkdirSync(folder,{recursive:true});
 const capture=(name:string)=>writeFileSync(join(folder,name+'.png'),execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,'exec-out','screencap','-p'],{windowsHide:true,timeout:30000,maxBuffer:16*1024*1024}));
 const observingFocus=process.env.RITMO_READER_OBSERVE_FOCUS==='1';assert.equal(observingFocus,false,'partial_copy_requires_strict_focus');
 const phases:string[]=[],targets:Record<string,unknown>[]=[],dialogFocus:Record<string,unknown>[]=[],imeReadiness:Record<string,unknown>[]=[],originals:Record<string,unknown>[][]=[];

 const report=(phase:string,fontScale=2)=>{phases.push(phase);const line=JSON.stringify({phase,passed:true,fontScale});console.log(line);if(process.env.RITMO_READER_PROGRESS)appendFileSync(process.env.RITMO_READER_PROGRESS,line+'\n');};
 const read=()=>{
  const result=adb('shell','am','instrument','-e','targetPackage',pkg,'-w','dev.ritmo.readerobserver/.ReaderObserver'),xml=result.match(/^INSTRUMENTATION_RESULT: hierarchy=(.*)$/m)?.[1];
  writeFileSync(join(folder,'latest-observer-status.json'),JSON.stringify({hierarchyAvailable:!!xml,error:result.match(/^INSTRUMENTATION_RESULT: observer_error=(.*)$/m)?.[1]??null},null,2)+'\n');
  if(!xml)return {nodes:[] as Node[],allNodes:[] as Node[],windows:[] as Node[],meta:{} as Node};
  writeFileSync(join(folder,'latest-hierarchy.xml'),xml+'\n');
  return parseReaderHierarchy(xml);
 };
 const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data');
 const keys=['enabled_accessibility_services','accessibility_enabled','touch_exploration_enabled'],saved=keys.map(key=>[key,adb('shell','settings','get','secure',key)] as const),font=adb('shell','settings','get','system','font_scale'),screenTimeout=adb('shell','settings','get','system','screen_off_timeout');
 const permission='android.permission.POST_NOTIFICATIONS',readerPackage='com.google.android.marvin.talkback';
 const notificationState=adb('shell','dumpsys','package',readerPackage).split('\n').find(l=>l.includes(permission+': granted='));assert.ok(notificationState);
 const notificationGranted=notificationState.includes('granted=true'),temporaryPermissionFlags=['user-set','user-fixed'].filter(f=>!notificationState.includes(f.toUpperCase().replace('-','_')));
 writeFileSync(join(folder,'reader-environment.json'),JSON.stringify({serial,pkg,secureSettings:Object.fromEntries(saved),fontScale:font,screenTimeout,wifi,data,notificationGranted,temporaryPermissionFlags},null,2)+'\n');
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
  }try{capture('failure-missing-target');}catch{}throw new Error('reader_target_missing_'+label);
 };
 const focus=async(label:string,minimumHeight=Math.floor(44*density)):Promise<Node>=>{
  assertReader();
  for(let i=0;i<3;i++){const n=await find(label,true,minimumHeight),p=point(n);await touch.down(p);await pause(650);await touch.up();await pause(500);const focused=read().nodes.find(n=>matches(n,label)&&n['accessibility-focused']==='true');if(focused){assertReader();return focused;}}
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
  await top();const before=await find(label);await press(label);
  const deadline=Date.now()+12000,samples:Record<string,unknown>[]=[];let previous='',stable=0;
  let tree=read(),field=tree.nodes.find(n=>described(n,label)),imeTop=Infinity;
  while(Date.now()<deadline){
   tree=read();field=tree.nodes.find(n=>described(n,label));
   imeTop=tree.meta['ime-visible']==='true'?tree.meta['ime-bounds']!.match(/-?\d+/g)!.map(Number)[1]!:Infinity;
   const visible=!!field&&field.focused==='true'&&tree.meta['ime-visible']==='true'&&rect(field)[3]!<=imeTop;
   const geometry=visible?field!.bounds+'|'+tree.meta['ime-bounds']:'';
   samples.push({focused:field?.focused,imeVisible:tree.meta['ime-visible'],fieldBounds:field?.bounds,imeBounds:tree.meta['ime-bounds']});
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

 const snapshot=(name:string)=>{const tree=read();if(!tree.meta['application-window-count']){capture(name);throw new Error('reader_snapshot_has_no_current_hierarchy');}writeFileSync(join(folder,name+'.xml'),readFileSync(join(folder,'latest-hierarchy.xml')));capture(name);};
 const focusedLabel=()=>{const n=read().nodes.find(n=>n['accessibility-focused']==='true');return n?.['content-desc']||n?.text;};
 const selected=async(label:string,control=true)=>{
  const n=await focus(label,control?Math.floor(44*density):1),tree=read(),focused=tree.allNodes.filter(n=>n['accessibility-focused']==='true');
  assert.equal(focused.length,1);assert.equal(tree.meta['focused-window-id'],n['window-id']);assert.equal(focused[0]!['window-id'],n['window-id']);
  return n;
 };
 const offline=()=>{if(reversed){adb('reverse','--remove',devicePort);reversed=false;}adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');};
 const restoreNetwork=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
 const online=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;restoreNetwork();};
 const repeat=async<T,>(work:()=>Promise<T>):Promise<T>=>{for(let attempt=1;;attempt++)try{return await work();}catch(error){if(attempt>=3||failureKind(error)!=='retry')throw error;await pause(retryDelay(attempt,error,Date.now()));}};
 const create=async(name:string)=>{await press(pt.habits);await press(pt.newHabit);await enter(pt.habitName,name);await press(pt.createHabit);await press(pt.briefing);await find(pt.habitLabel(name,false));};
 const openSync=async()=>{await press(pt.syncDetails);await find(pt.syncTitle,false);assert.equal(focusedLabel(),pt.syncTitle);};
 const closeSync=async()=>{await press(pt.close);await find(pt.syncDetails);assert.ok(matches({'content-desc':focusedLabel()??''},pt.syncDetails),'sync_must_return_to_opener');dialogFocus.push({returned:focusedLabel(),matchesOpener:true});};
 const history=async(name:string)=>{
  await openSync();await press(pt.syncHistory);const values:Record<string,unknown>[]=[];
  for(let i=0;i<2;i++){
   await press(pt.intentDetails);const node=read().nodes.find(n=>n.text?.startsWith('{')&&n.text.includes('"operationId"'));
   assert.ok(node?.text);values.push(JSON.parse(node.text) as Record<string,unknown>);snapshot(name+'-'+i);
  }
  await press(pt.intentDetailsHide);await closeSync();originals.push(values);return values;
 };
 const run=randomUUID(),email='copy'+run+'@example.test',emailB='copyb'+run+'@example.test',password='sync-reader-fixture-password',title='Intencao preservada';
 const seedProof:Record<string,unknown>[]=[],gates:Record<string,unknown>[]=[];
 let other:ReturnType<typeof openTestStore>|undefined,b:ReturnType<typeof openTestStore>|undefined;
 try {
  if(!notificationGranted&&temporaryPermissionFlags.length)adb('shell','pm','set-permission-flags',readerPackage,permission,...temporaryPermissionFlags);
  adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;adb('shell','settings','put','system','font_scale','2.0');adb('shell','settings','put','system','screen_off_timeout','1800000');launch();
  await find(pt.register);const preflight=point(await find(pt.register));await touch.down(preflight);await pause(60);await touch.up();await find(pt.name);
  const services=saved[0]![1]==='null'||!saved[0]![1]?service:saved[0]![1].split(':').includes(service)?saved[0]![1]:saved[0]![1]+':'+service;
  adb('shell','settings','put','secure','enabled_accessibility_services',services);adb('shell','settings','put','secure','accessibility_enabled','1');adb('shell','settings','put','secure','touch_exploration_enabled','1');
  const readerDeadline=Date.now()+20000;let ready=false;while(Date.now()<readerDeadline){try{assertReader();ready=true;break;}catch{await pause(300);}}
  assert.ok(ready);adb('shell','am','start','-W','-n',pkg+'/.MainActivity');await pause(3000);reader=true;report('reader_200_and_physical_input_ready');
  await enter(pt.name,'Pessoa de copia');await enter(pt.email,email);await enter(pt.password,password);await press(pt.register);await find(pt.timezone);
  await enter(pt.timezone,'UTC');await press(pt.continue);await find(pt.habitName);await enter(pt.habitName,'Base preservada');await press(pt.firstHabitAction);await find(pt.synced);
  const identity=new HttpIdentity(origin),credentials=await identity.login(email,password,uuid());other=openTestStore(':memory:',credentials.accountId,uuid());
  const transport=new HttpSync(origin,credentials.accountId,()=>credentials.accessToken,uuid),syncOther=()=>repeat(()=>synchronize(other!,transport));await syncOther();
  const instant=(await transport.pull(other.cursor())).serverTime,day=getDayKey(new Date(instant),credentials.profile.timeContext.timezone,credentials.profile.timeContext.dayStartHour),context=credentials.profile.timeContext;
  const seed=async(api:HttpSync,count:number,visible:string,onboard=false)=>{
   let sequence=0;const device=uuid();const operation=(command:import('../../src/core/sync/protocol.ts').Command,dependsOn:string[]=[]):import('../../src/core/sync/protocol.ts').Operation=>({operationId:uuid(),deviceId:device,clientSequence:++sequence,occurredAt:instant,dependsOn,command});
   const tombstones=Array.from({length:count},(_,index)=>operation({type:'habit.create',habitId:uuid(),title:'Arquivo '+index,habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:context,iconKey:'reading',colorToken:'blue',sortOrder:index+100}));
   const sentinel=operation({type:'habit.create',habitId:uuid(),title:visible,habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:context,iconKey:'water',colorToken:'green',sortOrder:1});
   const commands=[...(onboard?[operation({type:'profile.setOnboarding',timeContext:context,completed:true,analyticsConsent:false})]:[]),sentinel,...tombstones,...tombstones.map(op=>{assert.equal(op.command.type,'habit.create');return operation({type:'habit.delete',habitId:(op.command as Extract<typeof op.command,{type:'habit.create'}>).habitId},[op.operationId]);})];
   for(let offset=0;offset<commands.length;offset+=50){const result=await repeat(()=>api.push(commands.slice(offset,offset+50)));assert.equal(result.results.length,commands.slice(offset,offset+50).length);assert.ok(result.results.every(r=>'receipt' in r&&r.receipt.status==='accepted'));}
   const manifest=await api.snapshot(),first=await api.page(manifest.snapshotId,manifest.firstPageCursor);assert.equal(manifest.entityCount,501);assert.equal(first.entities.length,500);assert.equal(first.complete,false);assert.ok(first.nextPageCursor);assert.ok(first.entities.some(e=>e.kind==='habit'&&e.value.title===visible));
   seedProof.push({account:api.accountId,snapshotId:manifest.snapshotId,entityCount:manifest.entityCount,firstPageEntities:first.entities.length,firstPageComplete:false,visibleHabitInFirstPage:true,tombstones:count,commands:commands.length});writeFileSync(join(folder,'remote-snapshots.json'),JSON.stringify(seedProof,null,2)+'\n');
   return sentinel;
  };
  offline();await create(title);await press(pt.habitLabel(title,false));await find(pt.totalXp(10));const before=await history('01-original-offline');
  assert.ok(Array.isArray(before[0]!.dependsOn)&&before[0]!.dependsOn.includes(before[1]!.operationId));
  const sentinel=await seed(transport,498,'Remoto A antes do corte');report('original_dependency_and_xp_before_partial_copy');
  launch('sync-staged-copy');await find(pt.offline);online();await find(pt.snapshotProgress(500));await find(pt.serviceUnavailable);await selected(pt.snapshotProgress(500),false);await selected(pt.snapshotActiveHelp,false);snapshot('02-active-copy-500-items');
  assert.equal(read().allNodes.some(n=>matches(n,pt.habitLabel('Remoto A antes do corte',false))),false);await find(pt.habitLabel('Base preservada',false));await find(pt.habitLabel(title,true));await find(pt.totalXp(10));
  offline();launch('sync-staged-copy');await find(pt.offline);await find(pt.snapshotProgress(500));snapshot('03-active-restart-offline');assert.deepEqual(await history('04-active-originals-after-restart'),before);await find(pt.habitLabel(title,true));await find(pt.totalXp(10));
  gates.push({account:'A',staged:500,reopenedOffline:true,oldBaseVisible:true,partialHabitHidden:true,sameOriginals:true,provisionalXp:10});report('nonzero_active_copy_and_restart_preserve_previous_base_and_intentions');
  await syncOther();assert.equal(other.view(day).habits.some(h=>h.title===title),false);assert.equal(other.view(day).totalXp,0);
  assert.equal(sentinel.command.type,'habit.create');other.enqueue({type:'habit.patchMetadata',habitId:(sentinel.command as Extract<typeof sentinel.command,{type:'habit.create'}>).habitId,patch:{title:'Remoto A depois do corte'}},uuid(),instant);await syncOther();
  launch('sync-staged-complete');await find(pt.offline);online();await find(pt.synced);await find(pt.habitLabel('Remoto A depois do corte',false));await find(pt.habitLabel(title,true));await find(pt.totalXp(10));assert.equal(read().allNodes.some(n=>matches(n,pt.snapshotProgress(500))),false);
  assert.deepEqual(await history('05-confirmed-originals'),before);await syncOther();assert.equal(other.view(day).habits.filter(h=>h.title===title).length,1);assert.equal(other.view(day).habits.find(h=>h.title===title)?.done,true);assert.equal(other.view(day).totalXp,10);snapshot('06-active-complete-once');report('fresh_complete_snapshot_and_original_chain_converge_once');
  const accountB=await identity.register(emailB,password,'Conta B da copia',uuid()),transportB=new HttpSync(origin,accountB.accountId,()=>accountB.accessToken,uuid);
  b=openTestStore(':memory:',accountB.accountId,uuid());await seed(transportB,499,'Copia completa B',true);await repeat(()=>synchronize(b!,transportB));assert.equal(b.view(day).totalXp,0);
  await press(pt.settings);await press(pt.logout);await find(pt.logoutTitle);await press(pt.logout);await find(pt.register);launch('sync-staged-copy');await press(pt.hasAccount);await enter(pt.email,emailB);await enter(pt.password,password);await press(pt.login);
  await find(pt.initialLoading);await find(pt.snapshotProgress(500));await find(pt.serviceUnavailable);await selected(pt.snapshotHelp,false);await selected(pt.snapshotProgress(500),false);await selected(pt.snapshotTitle,false);snapshot('07-initial-copy-500-items');
  const assertInitialGate=()=>{assert.equal(read().allNodes.some(n=>[pt.briefing,pt.habits,pt.habitLabel('Copia completa B',false),pt.habitLabel('Base preservada',false),pt.habitLabel(title,true)].some(label=>matches(n,label))),false);};assertInitialGate();
  offline();launch('sync-staged-copy');await find(pt.initialLoading);await find(pt.offline);await find(pt.snapshotProgress(500));assertInitialGate();snapshot('08-initial-restart-offline');gates.push({account:'B',staged:500,reopenedOffline:true,initialGate:true,partialHabitHidden:true,originAccountHidden:true});report('initial_copy_with_real_first_page_stays_gated_after_offline_restart');
  launch('sync-staged-complete');await find(pt.initialLoading);online();await find(pt.habitLabel('Copia completa B',false));await find(pt.synced);await selected(pt.habitLabel('Copia completa B',false));assert.equal(read().allNodes.some(n=>matches(n,pt.habitLabel(title,true))),false);snapshot('09-initial-complete');
  await press(pt.settings);await press(pt.logout);await find(pt.logoutTitle);await press(pt.logout);await find(pt.register);await press(pt.hasAccount);await enter(pt.email,email);await enter(pt.password,password);await press(pt.login);await find(pt.habitLabel(title,true));await find(pt.totalXp(10));await find(pt.synced);assert.equal(read().allNodes.some(n=>matches(n,pt.habitLabel('Copia completa B',false))),false);
  await syncOther();await repeat(()=>synchronize(b!,transportB));assert.equal(other.view(day).totalXp,10);assert.equal(b.view(day).totalXp,0);assert.equal(other.view(day).habits.some(h=>h.title==='Copia completa B'),false);assert.equal(b.view(day).habits.some(h=>h.title===title),false);snapshot('10-origin-account-restored');
  writeFileSync(join(folder,'copy-gates.json'),JSON.stringify(gates,null,2)+'\n');writeFileSync(join(folder,'remote-result.json'),JSON.stringify({a:{habitCount:other.view(day).habits.filter(h=>h.title===title).length,done:true,totalXp:10},b:{habitCount:b.view(day).habits.length,totalXp:0},accountsIsolated:true,sameOriginals:true},null,2)+'\n');report('complete_install_and_account_roundtrip_preserve_isolation_and_xp');success=true;
 }catch(error){
  const diagnostic:Record<string,unknown>={};
  try{diagnostic.processPresent=!!adb('shell','pidof',pkg);}catch(problem){diagnostic.processQuery=problem instanceof Error?problem.message:'unknown';}
  try{diagnostic.foreground=adb('shell','dumpsys','window').split('\n').filter(line=>/mCurrentFocus=|mFocusedApp=/.test(line));}catch{diagnostic.foregroundQueryFailed=true;}
  writeFileSync(join(folder,'failure-app-state.json'),JSON.stringify(diagnostic,null,2)+'\n');
  try{snapshot('failure-reader-partial-copy');}catch{}throw error;
 }finally{
  other?.close();b?.close();const failedSteps:string[]=[];
  const work=[{name:'bridge',run:()=>touch.close()},...saved.map(([k,v])=>({name:k,run:()=>v==='null'?adb('shell','settings','delete','secure',k):adb('shell','settings','put','secure',k,v)})),{name:'network',run:restoreNetwork},{name:'font',run:()=>adb('shell','settings','put','system','font_scale',font)},{name:'screen_timeout',run:()=>adb('shell','settings','put','system','screen_off_timeout',screenTimeout)},...(!notificationGranted&&temporaryPermissionFlags.length?[{name:'notifications',run:()=>adb('shell','pm','clear-permission-flags',readerPackage,permission,...temporaryPermissionFlags)}]:[]),{name:'stop_fixture',run:()=>adb('shell','am','force-stop',pkg)},...(reversed?[{name:'reverse',run:()=>adb('reverse','--remove',devicePort)}]:[])];
  for(const step of work)try{await step.run();}catch{failedSteps.push(step.name);}
  const readback:Record<string,string>={};
  for(const [namespace,key,expected] of [...saved.map(([key,value])=>['secure',key,value] as const),['system','font_scale',font] as const,['system','screen_off_timeout',screenTimeout] as const,['global','wifi_on',wifi] as const,['global','mobile_data',data] as const])try{readback[key]=adb('shell','settings','get',namespace,key);if(readback[key]!==expected)failedSteps.push('readback_'+key);}catch{failedSteps.push('readback_'+key);}
  try{if(adb('reverse','--list').includes(devicePort))failedSteps.push('readback_reverse');}catch{failedSteps.push('readback_reverse');}
  writeFileSync(join(folder,'reader-cleanup.json'),JSON.stringify({restored:!failedSteps.length,failedSteps,readback},null,2)+'\n');
  const apkSha256=createHash('sha256').update(readFileSync(resolve(import.meta.dirname,'../../../.scratch/runtime/interface/readonly-journey/current.apk'))).digest('hex');
  writeFileSync(join(folder,'matrix-summary.json'),JSON.stringify({passed:success&&!failedSteps.length,apkSha256,fontScale:2,dialogFocus,imeReadiness,seedProof,gates,originals,phases,targets,minimumLogicalUnits:44,pixelRounding:'floor',authentication:{touch:[touch.unauthenticatedCode,touch.wrongAudienceCode,touch.wrongIssuerCode]},physicalInput:'grpc.sendTouch',observer:'FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES',fixtureText:'adb.hardware_keys_not_spoken_character_editing',scope:'real nonzero staging in initial and existing accounts, first page500 real HTTP and interrupted second page, offline restart, previous base and original dependency/XP, complete install, post-cut edit and A/B/A; pull expiry and second-page503 are synthetic external faults; no real cleaner, VoiceOver, spoken character editing, performance, palettes or full M1 acceptance',restored:!failedSteps.length},null,2)+'\n');
  if(failedSteps.length&&success)throw new Error('reader_cleanup_incomplete');
 }
});
