import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import type {Operation} from '../../src/core/sync/protocol.ts';
import {openTestStore} from '../support/store.ts';
import {id} from '../support/scheduler.ts';

const origin=process.env.RITMO_TEST_API,serial=process.env.RITMO_ANDROID_SERIAL;
const pkg='dev.ritmo.httpharness',devicePort='tcp:18765';
function adb(...args:string[]) {return execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',timeout:30000,windowsHide:true}).trim();}
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
type Report={run:string;phase:string;passed:boolean;error?:string;queue:Operation[];
  view:{habits:{habitId:string;title:string;done:boolean}[];totalXp:number;pendingCount:number;rejectedCount:number}};
async function report(run:string,phase:string) {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline) {
    const pid=adb('shell','pidof',pkg);assert.match(pid,/^[0-9]+$/,'native process must still be running');
    const logs=adb('logcat','-d','--pid='+pid,'-s','ReactNativeJS:I','*:S');
    for(const line of logs.split('\n')) {
      const marker=line.indexOf('RITMO_HTTP_HARNESS:');if(marker<0) continue;
      const result=JSON.parse(line.slice(marker+'RITMO_HTTP_HARNESS:'.length)) as Report;
      if(result.run!==run) continue;
      assert.notEqual(result.passed,false,JSON.stringify({phase:result.phase,error:result.error}));
      if(result.phase===phase) {
        console.log(JSON.stringify({phase,passed:true,pending:result.view?.pendingCount,xp:result.view?.totalXp}));
        return result;
      }
    }
    await pause(300);
  }
  throw new Error('native_harness_timeout_'+phase);
}
function launch(run:string,phase:string,day:string) {
  adb('shell','am','force-stop',pkg);
  adb('shell','am','start','-W','-a','android.intent.action.VIEW','-n',pkg+'/.MainActivity','-d','ritmo-http://test/'+run+'/'+phase+'/'+day);
}

test('Android preserves offline intent across process death and automatically converges on foreground without duplicate XP',
  {skip:!serial,timeout:210000},async()=>{
  assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin),'disposable local API required');
  assert.match(serial!,/^emulator-[0-9]+$/,'explicit emulator serial required');
  assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1','only an emulator may have its radios changed');
  assert.equal(adb('reverse','--list').includes(devicePort),false,'test port already owned');
  const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data');
  assert.equal(wifi,'1','start the emulator with Wi-Fi enabled');assert.match(data,/^[01]$/);
  const run=randomUUID(),day=new Date().toISOString().slice(0,10);
  let reversed=false,radiosChanged=false,other:ReturnType<typeof openTestStore>|undefined;
  const connect=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;};
  const disconnect=()=>{if(reversed) {adb('reverse','--remove',devicePort);reversed=false;}};
  const restoreRadios=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
  try {
    connect();launch(run,'prepare',day);await report(run,'prepared');
    const identity=new HttpIdentity(origin),credentials=await identity.login(run+'@example.test','native-fixture-password',id(90));
    other=openTestStore(':memory:',credentials.accountId,id(90));
    let requestId=1000;
    const transport=new HttpSync(origin,credentials.accountId,()=>credentials.accessToken,()=>id(requestId++));
    await synchronize(other,transport);assert.equal(other.view(day).habits.length,0);
    // ADB reverse bypasses the radio path: remove it as well as disabling native connectivity.
    disconnect();radiosChanged=true;adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');
    launch(run,'offline',day);const offline=await report(run,'offline');
    assert.equal(offline.view.pendingCount,2);assert.equal(offline.view.totalXp,10);
    assert.equal(offline.view.habits.length,1);assert.equal(offline.view.habits[0]?.done,true);
    assert.equal(offline.view.rejectedCount,0);assert.equal(offline.queue.length,2);
    launch(run,'resume',day);const restored=await report(run,'restored');
    assert.deepEqual(restored.queue,offline.queue,'IDs, sequence, dependencies and content survive process death');
    assert.deepEqual(restored.view,offline.view);
    adb('shell','input','keyevent','KEYCODE_HOME');await report(run,'background');
    connect();restoreRadios();await report(run,'background_online');
    await pause(1000);await synchronize(other,transport);
    assert.equal(other.view(day).habits.length,0,'reconnection in background must not push the offline intent');
    adb('shell','am','start','-W','-n',pkg+'/.MainActivity');
    const converged=await report(run,'converged');
    await synchronize(other,transport);assert.deepEqual(converged.view,other.view(day));
    assert.equal(converged.view.pendingCount,0);assert.equal(converged.view.totalXp,10);
    // Replay the original native envelopes, then independently mark the same occurrence on another device.
    const replay=await transport.push(offline.queue);
    assert.equal(replay.results.length,2);assert.ok(replay.results.every(result=>'receipt' in result&&result.replayed));
    other.enqueue({type:'habit.mark',habitId:offline.view.habits[0]!.habitId,dayKey:day,
      timeContext:{timezone:'UTC',dayStartHour:0},observedUndoIds:[]},id(92),new Date().toISOString());
    await synchronize(other,transport);assert.equal(other.view(day).totalXp,10);
    launch(run,'verify',day);const reopened=await report(run,'verified');
    assert.deepEqual(reopened.view,other.view(day));assert.equal(reopened.queue.length,0);
  } finally {
    other?.close();
    try {adb('shell','am','force-stop',pkg);} finally {
      try {disconnect();} finally {if(radiosChanged) restoreRadios();}
    }
  }
});
