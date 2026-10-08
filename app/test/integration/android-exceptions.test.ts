import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {HttpIdentity} from '../../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../../src/core/sync/synchronize.ts';
import {operationHash} from '../../src/core/sync/operation-hash.ts';
import type {Operation,Receipt} from '../../src/core/sync/protocol.ts';
import type {RecoveryItem} from '../../src/core/db/account-store.ts';
import type {DatabaseRecovery} from '../../src/core/db/local-migrations.ts';
import {openTestStore} from '../support/store.ts';
import {id} from '../support/scheduler.ts';

const origin=process.env.RITMO_TEST_API,serial=process.env.RITMO_ANDROID_SERIAL;
const pkg='dev.ritmo.httpharness',devicePort='tcp:18765',password='native-fixture-password';
type Scenario='vault'|'opening'|'identity-operation'|'identity-sequence'|'accounts';
type Report={run:string;scenario:Scenario;phase:string;passed:boolean;error?:string;queue:Operation[];recovery:RecoveryItem[];
  view:{habits:{habitId:string;title:string;done:boolean}[];totalXp:number;pendingCount:number;rejectedCount:number}|null;
  accountId?:string;vault?:{unavailable:boolean;cleanupPending:boolean};database?:DatabaseRecovery;
  handles?:{opened:number;closed:number;vaultReads:number};vaultReads?:number;preservedQueue?:Operation[];originalReceipt?:Receipt;receiptOrderChanged?:boolean};
function adb(...args:string[]) {return execFileSync(process.env.RITMO_ADB??'adb',['-s',serial!,...args],{encoding:'utf8',timeout:30000,windowsHide:true}).trim();}
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function report(run:string,scenario:Scenario,phase:string) {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline) {
    const pid=adb('shell','pidof',pkg);assert.match(pid,/^[0-9]+$/,'native process must still be running');
    for(const line of adb('logcat','-d','--pid='+pid,'-s','ReactNativeJS:I','*:S').split('\n')) {
      const marker=line.indexOf('RITMO_ANDROID_ACCEPTANCE:');if(marker<0) continue;
      const result=JSON.parse(line.slice(marker+'RITMO_ANDROID_ACCEPTANCE:'.length)) as Report;
      if(result.run!==run||result.scenario!==scenario) continue;
      assert.notEqual(result.passed,false,JSON.stringify({scenario,phase:result.phase,error:result.error}));
      if(result.phase===phase) {
        console.log(JSON.stringify({scenario,phase,passed:true,pending:result.view?.pendingCount??null,
          xp:result.view?.totalXp??null,blocked:result.recovery.length,database:result.database?.code??null,receiptOrderChanged:result.receiptOrderChanged??null}));
        return result;
      }
    }
    await pause(300);
  }
  throw new Error('native_acceptance_timeout_'+phase);
}
async function scenario(name:Scenario,exercise:(f:{
  run:string;day:string;launch:(phase:string)=>void;report:(phase:string)=>Promise<Report>;
  connect:()=>void;disconnect:()=>void;offline:()=>void;online:()=>void;
  observer:(suffix?:'a'|'b')=>Promise<{store:ReturnType<typeof openTestStore>;api:HttpSync;sync:()=>Promise<void>}>
})=>Promise<void>) {
  assert.ok(origin&&/^http:\/\/127[.]0[.]0[.]1:[0-9]+$/.test(origin),'disposable local API required');
  assert.match(serial!,/^emulator-[0-9]+$/);
  assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1','only an explicit emulator may be modified');
  assert.equal(adb('reverse','--list').includes(devicePort),false,'test reverse port already owned');
  const wifi=adb('shell','settings','get','global','wifi_on'),data=adb('shell','settings','get','global','mobile_data');
  assert.equal(wifi,'1');assert.match(data,/^[01]$/);
  const run=randomUUID(),day=new Date().toISOString().slice(0,10);
  let reversed=false,radiosChanged=false,sequence=50000;
  const stores:ReturnType<typeof openTestStore>[]=[];
  const connect=()=>{adb('reverse',devicePort,'tcp:'+new URL(origin).port);reversed=true;};
  const disconnect=()=>{if(reversed) {adb('reverse','--remove',devicePort);reversed=false;}};
  const restore=()=>{adb('shell','svc','wifi',wifi==='1'?'enable':'disable');adb('shell','svc','data',data==='1'?'enable':'disable');};
  try {
    connect();
    await exercise({run,day,connect,disconnect,
      offline:()=>{disconnect();radiosChanged=true;adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');},
      online:()=>{connect();restore();},
      launch:phase=>{
        adb('shell','am','force-stop',pkg);
        adb('shell','am','start','-W','-a','android.intent.action.VIEW','-n',pkg+'/.MainActivity',
          '-d','ritmo-http://acceptance/'+run+'/'+name+'/'+phase+'/'+day);
      },
      report:phase=>report(run,name,phase),
      observer:async(suffix='a')=>{
        const credentials=await new HttpIdentity(origin).login(run+'-'+name+'-'+suffix+'@example.test',password,id(sequence++));
        const store=openTestStore(':memory:',credentials.accountId,id(sequence++));stores.push(store);
        const api=new HttpSync(origin,credentials.accountId,()=>credentials.accessToken,()=>id(sequence++));
        return {store,api,sync:async()=>{await synchronize(store,api);}};
      },
    });
  } finally {
    for(const store of stores) store.close();
    try {adb('shell','am','force-stop',pkg);} finally {
      try {disconnect();} finally {if(radiosChanged) restore();}
    }
  }
}

test('native vault failure preserves local writes across process death and retry converges once',{skip:!serial,timeout:180000},async()=>{
  await scenario('vault',async f=>{
    f.launch('prepare');const prepared=await f.report('prepared');assert.equal(prepared.queue.length,2);
    const other=await f.observer();await other.sync();assert.equal(other.store.view(f.day).habits.length,0);
    f.launch('blocked');const blocked=await f.report('vault_blocked');
    assert.deepEqual(blocked.queue.slice(0,2),prepared.queue);assert.equal(blocked.queue.length,4);
    assert.equal(blocked.view?.totalXp,20);assert.equal(blocked.vault?.unavailable,true);assert.ok((blocked.vaultReads??0)>=2);
    await other.sync();assert.equal(other.store.view(f.day).habits.length,0);
    f.launch('retry');const recovered=await f.report('vault_recovered');
    assert.equal(recovered.vault?.unavailable,false);assert.equal(recovered.queue.length,0);
    await other.sync();assert.deepEqual(recovered.view,other.store.view(f.day));
    const replay=await other.api.push(blocked.queue);assert.ok(replay.results.every(r=>'receipt' in r&&r.replayed));
    f.launch('verify');const verified=await f.report('verified');await other.sync();
    assert.deepEqual(verified.view,other.store.view(f.day));assert.equal(verified.view?.totalXp,20);
  });
});

test('native database opening, pragma and migration failures preserve work and retry safely',{skip:!serial,timeout:240000},async()=>{
  await scenario('opening',async f=>{
    f.launch('prepare');const prepared=await f.report('prepared');const other=await f.observer();
    for(const phase of ['account_open','account_pragma','account_migration','installation_open']) {
      f.launch(phase);const blocked=await f.report(phase+'_blocked'),recovered=await f.report(phase+'_recovered');
      assert.equal(blocked.view,null);assert.equal(blocked.database?.scope,phase==='installation_open'?'installation':'account');
      assert.equal(blocked.database?.stage,phase==='account_pragma'?'pragma':phase==='account_migration'?'migration':'open');
      if(phase==='installation_open') {assert.equal(blocked.handles?.opened,0);assert.equal(blocked.handles?.vaultReads,0);}
      else assert.equal((blocked.handles?.opened??0)-(blocked.handles?.closed??0),1,'failed account handle must close');
      assert.deepEqual(recovered.queue,prepared.queue,'migration rollback/retry must preserve the immutable envelopes');
      assert.deepEqual(recovered.view,prepared.view);await other.sync();assert.equal(other.store.view(f.day).habits.length,0);
    }
    f.launch('verify');const verified=await f.report('verified');await other.sync();
    assert.deepEqual(verified.view,other.store.view(f.day));assert.equal(verified.view?.totalXp,10);
    const replay=await other.api.push(prepared.queue);assert.ok(replay.results.every(r=>'receipt' in r&&r.replayed));
  });
});

for(const name of ['identity-operation','identity-sequence'] as const) test(
  'native '+name+' preserves uncertain intention and original receipt while independent work continues',{skip:!serial,timeout:150000},async()=>{
    await scenario(name,async f=>{
      f.launch('exercise');const blocked=await f.report('identity_blocked');assert.equal(blocked.recovery.length,2);
      const parent=blocked.recovery[0]!,child=blocked.recovery[1]!;
      assert.equal(child.error.code,'identity_dependency_unresolved');assert.equal(parent.resolution,null);
      assert.notEqual(blocked.originalReceipt?.operationHash,operationHash(parent.operation));
      assert.equal(parent.error.identity?.localOperationHash,operationHash(parent.operation),'Hermes and Node must hash the exact Unicode envelope equally');
      const other=await f.observer();await other.sync();assert.deepEqual(blocked.view,other.store.view(f.day));
      assert.equal(other.store.view(f.day).totalXp,10);assert.equal(other.store.view(f.day).habits.filter(h=>h.done).length,1);
      const manifest=await other.api.snapshot();
      const receipts=await other.api.receipts(manifest.snapshotId,[child.operation.operationId,blocked.originalReceipt!.operationId]);
      assert.equal(receipts.results[0]?.status,'notProcessedAtH');assert.deepEqual(receipts.results[1],blocked.originalReceipt);
      f.launch('verify');const verified=await f.report('verified');
      assert.deepEqual(verified.recovery,blocked.recovery);assert.equal(verified.queue.length,0);
      await other.sync();assert.deepEqual(verified.view,other.store.view(f.day));
    });
  });

test('native offline logout and online A B A reentry isolate accounts and preserve pending envelopes',{skip:!serial,timeout:210000},async()=>{
  await scenario('accounts',async f=>{
    f.launch('prepare');const prepared=await f.report('prepared'),accountA=prepared.accountId;
    const a=await f.observer();await a.sync();assert.equal(a.store.view(f.day).habits.length,0);
    f.offline();f.launch('logout');const logout=await f.report('offline_logout');
    assert.equal(logout.view,null);assert.deepEqual(logout.preservedQueue,prepared.queue);
    f.online();f.launch('account_b');const bReport=await f.report('account_b');
    assert.notEqual(bReport.accountId,accountA);assert.equal(bReport.view?.habits.length,1);
    const b=await f.observer('b');await b.sync();assert.deepEqual(bReport.view,b.store.view(f.day));
    await a.sync();assert.equal(a.store.view(f.day).habits.length,0,'B must not send pending work belonging to A');
    f.launch('account_a');const restored=await f.report('account_a_restored'),converged=await f.report('account_a_converged');
    assert.equal(restored.accountId,accountA);assert.deepEqual(restored.queue,prepared.queue);
    assert.equal(converged.view?.habits.length,1);await a.sync();assert.deepEqual(converged.view,a.store.view(f.day));
    await b.sync();assert.deepEqual(bReport.view,b.store.view(f.day));assert.equal(b.store.view(f.day).totalXp,10);
    f.launch('verify');const verified=await f.report('verified');await a.sync();assert.deepEqual(verified.view,a.store.view(f.day));
    const replay=await a.api.push(prepared.queue);assert.ok(replay.results.every(r=>'receipt' in r&&r.replayed));
    await a.sync();assert.equal(a.store.view(f.day).totalXp,10);
  });
});
