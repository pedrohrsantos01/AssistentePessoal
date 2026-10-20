import assert from 'node:assert/strict';
export type ColdProof={pidAbsentBeforeLaunch:true;pidAfterLaunch:number;launcherPid:number;launchNs:number;sample:number};
export type FrameSample={schema:2;pid:number;launchClock?:'device_intent_request';originPid?:number;coldProof?:ColdProof;sample:number;kind:'startup'|'toggle';frameVsyncNs:number;frameIntendedNs:number;drawVsyncNs:number;drawNs:number;scanNs:number;frameTotalNs:number;frameEndNs:number;dropped:0;checked:boolean;launchNs?:number;inputNs?:number;sequence?:number};
export function frameSample(value:unknown):FrameSample {
 assert.ok(value&&typeof value==='object');const v=value as Record<string,unknown>;
 assert.equal(v.schema,2);assert.ok(v.kind==='startup'||v.kind==='toggle');assert.ok(typeof v.checked==='boolean');assert.equal(v.dropped,0);
 for(const key of ['pid','sample','frameVsyncNs','frameIntendedNs','drawVsyncNs','drawNs','scanNs','frameTotalNs','frameEndNs'])assert.ok(typeof v[key]==='number'&&Number.isSafeInteger(v[key])&&v[key]>=0,key);
 assert.ok((v.sample as number)>=1&&(v.sample as number)<=10);
 assert.ok(v.drawVsyncNs===v.frameVsyncNs||v.drawVsyncNs===v.frameIntendedNs,'frame_correlation_missing');
 assert.equal(v.frameEndNs,(v.frameIntendedNs as number)+(v.frameTotalNs as number));assert.ok((v.frameEndNs as number)>=(v.drawNs as number));
 const start=v.kind==='startup'?v.launchNs:v.inputNs;
 assert.ok(typeof start==='number'&&Number.isSafeInteger(start)&&start>0&&start<=(v.drawNs as number),'clock_missing_or_reversed');
 if(v.kind==='startup'){
  assert.equal(v.checked,false);assert.equal(v.launchClock,'device_intent_request');
  const proof=v.coldProof as ColdProof|undefined;assert.ok(proof);assert.equal(proof.pidAbsentBeforeLaunch,true);assert.equal(proof.pidAfterLaunch,v.pid);assert.equal(proof.launcherPid,v.originPid);assert.equal(proof.launchNs,v.launchNs);assert.equal(proof.sample,v.sample);
  for(const n of [proof.pidAfterLaunch,proof.launcherPid])assert.ok(Number.isSafeInteger(n)&&n>0);assert.notEqual(proof.launcherPid,proof.pidAfterLaunch);
 }else assert.ok(v.sequence===1||v.sequence===2);
 return v as FrameSample;
}
export function correlateColdStartup(value:unknown,proof:ColdProof):FrameSample {
 assert.ok(value&&typeof value==='object'&&'kind' in value&&value.kind==='startup');
 return frameSample({...value,coldProof:proof});
}
function distribution(values:number[],targetMs:number) {
 assert.ok(values.length);const sorted=[...values].sort((a,b)=>a-b),rank=(p:number)=>sorted[Math.ceil(p*sorted.length)-1]!;
 return {count:sorted.length,minMs:sorted[0]!,p50Ms:rank(0.5),p95Ms:rank(0.95),maxMs:sorted.at(-1)!,targetMs,withinTarget:sorted.filter(v=>v<=targetMs).length,allWithinTarget:sorted.every(v=>v<=targetMs)};
}
export function summarizePerformance(raw:readonly unknown[]) {
 const rows=raw.map(frameSample),cold=rows.filter(r=>r.kind==='startup'),toggles=rows.filter(r=>r.kind==='toggle');
 assert.equal(cold.length,10);assert.equal(toggles.length,20);assert.equal(new Set(cold.map(r=>r.sample)).size,10);
 for(let sample=1;sample<=10;sample++){
  const group=toggles.filter(r=>r.sample===sample).sort((a,b)=>a.sequence!-b.sequence!);
  assert.equal(group.length,2);assert.equal(group[0]!.sequence,1);assert.equal(group[1]!.sequence,2);assert.equal(group[0]!.checked,true);assert.equal(group[1]!.checked,false);
  assert.ok(group[0]!.inputNs!>=cold.find(r=>r.sample===sample)!.frameEndNs);assert.ok(group[1]!.inputNs!>=group[0]!.frameEndNs);
 }
 const starts=cold.map(r=>(r.frameEndNs-r.launchNs!)/1e6),feedback=toggles.map(r=>(r.frameEndNs-r.inputNs!)/1e6);
 return {measurementValid:true,method:'Device-side Intent launch request / physical ACTION_UP to correlated native frame rendered and issued; process absence/new PID and exact launcher/native clock verified; not physical display photons',startup:distribution(starts,2000),localCards:distribution(starts,300),feedback:distribution(feedback,100),physicalDeviceAccepted:false};
}

export function pidIsAbsent(error:unknown):boolean {
 return !!error&&typeof error==='object'&&'status' in error&&error.status===1&&'stdout' in error&&typeof error.stdout==='string'&&error.stdout.trim()===''&&'stderr' in error&&typeof error.stderr==='string'&&error.stderr.trim()==='';
}
