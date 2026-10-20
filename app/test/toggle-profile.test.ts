import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assembleToggleProfiles,attributeToggleProfiles} from './support/toggle-profile.ts';
const names=['toggle.profile','toggle.day','toggle.view','toggle.command','toggle.identity','store.transaction','store.dependencies','store.base','store.pending','store.project','store.projectionWrite','refresh.profile','refresh.day','refresh.presentation','refresh.status','refresh.nextDay'];
function fixture() {
 const frames:Record<string,unknown>[]=[],marks:Record<string,unknown>[]=[],chunks:Record<string,unknown>[]=[];
 const clock=(at:number,cpu:number)=>({beforeMs:at,afterMs:at+0.001,cpuMs:cpu,tid:1,thread:'mqt_v_js',jsBeforeMs:at-0.001,jsAfterMs:at+0.002});
 for(let sample=1;sample<=10;sample++)for(let sequence=1;sequence<=2;sequence++) {
  const at=10000*sample+1000*sequence;
  frames.push({schema:4,downNs:(at-60)*1e6,kind:'toggle',sample,sequence,pid:sample,checked:sequence===1,dropped:0,inputNs:at*1e6,dispatchNs:(at+2)*1e6,dispatchProbeEndNs:(at+2.1)*1e6,frameVsyncNs:(at+90)*1e6,frameIntendedNs:(at+90)*1e6,drawVsyncNs:(at+90)*1e6,drawNs:(at+95)*1e6,scanNs:1000,frameTotalNs:15e6,frameEndNs:(at+105)*1e6});
  // Include one mount marker before the first press, as in the real process.
  if(sequence===1)marks.push({schema:2,sample,phase:'toggle.react',at:at+1,nativeBeforeMs:at+0.999,nativeAfterMs:at+1.001});
  for(const [phase,offset] of [['toggle.handler',5],['store.committed',30],['refresh.started',31],['refresh.finished',60],['local.returned',66],['toggle.react',80]] as const) {
   const time=at+offset;marks.push({schema:2,sample,phase,at:time,nativeBeforeMs:time-0.001,nativeAfterMs:time+0.001,...(phase==='toggle.handler'?{inputTimestampMs:at}:{})});
  }
  const spans=names.map((name,i)=>({name,depth:0,start:clock(at+6+i*3,i*2),end:clock(at+8+i*3,i*2+1)}));
  for(let part=0;part<4;part++)chunks.push({schema:1,sample,part,parts:4,start:clock(at+5.5,0),end:clock(at+67,35),spans:spans.slice(part*4,part*4+4)});
 }
 return {frames,marks,chunks};
}
test('profiles correlate the same press, preserve elapsed spans and retain the raw counter',()=>{
 const f=fixture(),profiles=assembleToggleProfiles(f.chunks.reverse()),rows=attributeToggleProfiles(f.frames,f.marks,profiles);
 assert.equal(rows.length,20);assert.equal(rows[0]!.sequence,1);assert.equal(rows[0]!.reportedCpuMs,35);assert.ok(Math.abs(rows[0]!.wallMs-61.5)<0.01);
 assert.equal(rows[0]!.spans.length,16);assert.equal(rows[0]!.spans[0]!.cpuClockConsistent,true);
});
test('missing or duplicate log chunks cannot silently remove a slow profile',()=>{
 const f=fixture();assert.throws(()=>assembleToggleProfiles(f.chunks.slice(1)),/profile_chunks_missing/);
 assert.throws(()=>assembleToggleProfiles([...f.chunks,f.chunks[0]]));
 assert.throws(()=>attributeToggleProfiles(f.frames,f.marks,assembleToggleProfiles(f.chunks).slice(1)),/profile_cohort_incomplete/);
});
test('incompatible wall clocks, another thread and incomplete instrumentation invalidate the cohort',()=>{
 for(const patch of [{tid:2},{thread:'main'},{beforeMs:1e12}]) {
  const f=fixture(),profiles=assembleToggleProfiles(f.chunks),first=profiles[0]!,spans=first.spans as {end:Record<string,unknown>}[];
  spans[0]!.end={...spans[0]!.end,...patch};assert.throws(()=>attributeToggleProfiles(f.frames,f.marks,profiles));
 }
 const f=fixture(),profiles=assembleToggleProfiles(f.chunks);profiles[0]!.spans=[];assert.throws(()=>attributeToggleProfiles(f.frames,f.marks,profiles),/profile_phase/);
 const nested=assembleToggleProfiles(f.chunks);(nested[0]!.spans[0] as {depth:number}).depth=99;assert.throws(()=>attributeToggleProfiles(f.frames,f.marks,nested),/profile_parent_missing/);
});
test('a CPU counter exceeding elapsed time remains diagnostic and cannot provide CPU or waiting attribution',()=>{
 const f=fixture(),profiles=assembleToggleProfiles(f.chunks),span=profiles[0]!.spans[0] as {end:{cpuMs:number}};span.end.cpuMs=1e8;
 const result=attributeToggleProfiles(f.frames,f.marks,profiles)[0]!.spans[0]!;
 assert.equal(result.cpuClockConsistent,false);assert.ok(result.reportedCpuMs>result.wallMs);assert.equal('cpuMs' in result,false);assert.equal('nonCpuMs' in result,false);
});
