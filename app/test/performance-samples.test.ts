import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frameSample,summarizePerformance,correlateColdStartup,pidIsAbsent,type FrameSample} from './support/performance-samples.ts';
const startup=(sample=1):FrameSample=>({schema:2,pid:100+sample,launchClock:'device_intent_request',originPid:80,coldProof:{pidAbsentBeforeLaunch:true,pidAfterLaunch:100+sample,launcherPid:80,launchNs:1000000000,sample},sample,kind:'startup',frameVsyncNs:2000000000,frameIntendedNs:2000000000,drawVsyncNs:2000000000,drawNs:2010000000,scanNs:1000,frameTotalNs:20000000,frameEndNs:2020000000,dropped:0,checked:false,launchNs:1000000000});
const rows=()=>Array.from({length:10},(_,i)=>[startup(i+1),...Array.from({length:2},(_,index):FrameSample=>({...startup(i+1),kind:'toggle',frameVsyncNs:3000000000+index*1000000000,frameIntendedNs:3000000000+index*1000000000,drawVsyncNs:3000000000+index*1000000000,drawNs:3005000000+index*1000000000,frameEndNs:3020000000+index*1000000000,inputNs:2990000000+index*1000000000,sequence:index+1,checked:index===0}))]).flat();
test('native frame analysis retains a slow cold sample and uses the same launch origin for local cards',()=>{
 const result=summarizePerformance(rows());assert.equal(result.startup.p95Ms,1020);assert.equal(result.startup.allWithinTarget,true);assert.equal(result.localCards.allWithinTarget,false);assert.equal(result.localCards.withinTarget,0);assert.equal(result.feedback.maxMs,30);assert.equal(result.physicalDeviceAccepted,false);
});
for(const invalid of [{drawVsyncNs:1},{drawVsyncNs:2000000001},{launchNs:3000000000},{launchClock:'adb_wall_clock'},{coldProof:undefined},{dropped:1},{frameEndNs:2000000000}])test('native measurement refuses incomplete clock/state/frame '+JSON.stringify(invalid),()=>{assert.throws(()=>frameSample({...startup(),...invalid}));});
test('missing or duplicate samples and unchanged visual state cannot manufacture a passing distribution',()=>{
 const r=rows();assert.throws(()=>summarizePerformance(r.slice(1)));assert.throws(()=>summarizePerformance([...r.slice(0,-1),r[0]!]));assert.throws(()=>summarizePerformance(r.map(v=>v.kind==='toggle'?{...v,checked:false}:v)));
});

test('startup correlation refuses a live process, different PID, different origin and a different launch clock',()=>{
 const row=startup(),proof=row.coldProof!;
 assert.equal(correlateColdStartup(row,proof).launchNs,row.launchNs);
 for(const invalid of [{pidAbsentBeforeLaunch:false},{pidAfterLaunch:999},{launcherPid:77},{launchNs:999},{sample:2}])assert.throws(()=>correlateColdStartup(row,{...proof,...invalid} as typeof proof));
});

test('ADB unavailable or diagnostic failures cannot prove a cold process',()=>{
 assert.equal(pidIsAbsent({status:1,stdout:'',stderr:''}),true);
 assert.equal(pidIsAbsent({status:1,stdout:'',stderr:'adb: device offline'}),false);
 assert.equal(pidIsAbsent({status:1,stdout:'1234',stderr:''}),false);
 assert.equal(pidIsAbsent({status:1}),false);
 assert.equal(pidIsAbsent({status:2,stdout:'',stderr:''}),false);
});
