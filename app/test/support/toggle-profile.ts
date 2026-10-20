import assert from 'node:assert/strict';
import {attributeToggleLatency} from './toggle-latency.ts';
import type {ThreadClock} from '../../src/core/diagnostics/toggle-profile.ts';
type Reading=ThreadClock&{jsBeforeMs:number;jsAfterMs:number};
function reading(value:unknown):Reading {
 assert.ok(value&&typeof value==='object');const r=value as Record<string,unknown>;
 for(const key of ['beforeMs','afterMs','cpuMs','tid','jsBeforeMs','jsAfterMs'])assert.ok(typeof r[key]==='number'&&Number.isFinite(r[key]),'profile_clock_missing');
 const v=r as Reading;
 assert.ok(Number.isInteger(v.tid)&&v.tid>0&&typeof v.thread==='string'&&/js/i.test(v.thread),'profile_not_js_thread');
 assert.ok(v.jsBeforeMs<=v.beforeMs&&v.beforeMs<=v.afterMs&&v.afterMs<=v.jsAfterMs,'profile_clock_order');
 return v;
}
function interval(start:Reading,end:Reading) {
 assert.equal(start.tid,end.tid,'profile_thread_changed');assert.equal(start.thread,end.thread);
 const wallMs=(end.beforeMs+end.afterMs-start.beforeMs-start.afterMs)/2,reportedCpuMs=end.cpuMs-start.cpuMs;
 assert.ok(wallMs>=0,'profile_wall_clock_invalid');
 // This counter proved inconsistent on the AVD. Retain it only as diagnostic data.
 // Authoritative CPU/residency requires the separately validated scheduler trace.
 return {wallMs,reportedCpuMs,cpuClockConsistent:start.cpuMs>=0&&end.cpuMs>=0&&reportedCpuMs>=0&&reportedCpuMs<=wallMs+0.5};
}
export function assembleToggleProfiles(chunks:readonly unknown[]) {
 const groups=new Map<string,Record<string,unknown>[]>();
 for(const value of chunks) {
  assert.ok(value&&typeof value==='object');const v=value as Record<string,unknown>;
  assert.equal(v.schema,1);const start=reading(v.start);reading(v.end);
  assert.ok(Number.isInteger(v.part)&&Number.isInteger(v.parts)&&Number(v.part)>=0&&Number(v.part)<Number(v.parts));
  const key=v.sample+':'+start.beforeMs,group=groups.get(key)??[];group.push(v);groups.set(key,group);
 }
 return [...groups.values()].map(group=>{
  const first=group[0]!;assert.equal(group.length,first.parts,'profile_chunks_missing');
  assert.equal(new Set(group.map(v=>v.part)).size,first.parts,'profile_chunk_duplicate');
  const spans=group.sort((a,b)=>Number(a.part)-Number(b.part)).flatMap(v=>{assert.deepEqual(v.start,first.start);assert.deepEqual(v.end,first.end);assert.equal(v.parts,first.parts);assert.ok(Array.isArray(v.spans));return v.spans;});
  return {...first,spans};
 });
}
export function attributeToggleProfiles(frames:readonly unknown[],marks:readonly unknown[],rawProfiles:readonly unknown[]) {
 const rows=attributeToggleLatency(frames,marks);
 const profiles=rawProfiles.map(value=>{
  assert.ok(value&&typeof value==='object');const v=value as Record<string,unknown>;
  assert.equal(v.schema,1);assert.ok(Number.isInteger(v.sample));assert.ok(Array.isArray(v.spans));
  const start=reading(v.start),end=reading(v.end);interval(start,end);
  const spans=v.spans.map(value=>{
   assert.ok(value&&typeof value==='object');const span=value as Record<string,unknown>;
   assert.ok(typeof span.name==='string');assert.ok(Number.isInteger(span.depth)&&Number(span.depth)>=0);
   const first=reading(span.start),last=reading(span.end);
   assert.equal(first.tid,start.tid);assert.equal(last.tid,start.tid);
   assert.equal(first.thread,start.thread);assert.equal(last.thread,start.thread);
   assert.ok(first.beforeMs>=start.beforeMs&&last.afterMs<=end.afterMs,'profile_span_outside_toggle');
   return {name:span.name,depth:Number(span.depth),start:first,end:last,...interval(first,last)};
  });
  for(const span of spans)if(span.depth>0)assert.ok(spans.some(parent=>parent.depth===span.depth-1&&parent.start.beforeMs<=span.start.beforeMs&&parent.end.afterMs>=span.end.afterMs),'profile_parent_missing');
  for(const name of ['toggle.profile','toggle.day','toggle.view','toggle.command','toggle.identity','store.transaction','store.dependencies','store.base','store.pending','store.project','store.projectionWrite','refresh.profile','refresh.day','refresh.presentation','refresh.status','refresh.nextDay'])assert.equal(spans.filter(s=>s.name===name).length,1,'profile_phase_'+name);
  return {sample:Number(v.sample),start,end,spans,...interval(start,end)};
 });
 assert.equal(profiles.length,20,'profile_cohort_incomplete');
 const used=new Set<number>();
 return rows.map(row=>{
  // Match the actual handler/return interval; sequence is not inferred from log delivery order.
  const candidates=profiles.map((p,index)=>({p,index})).filter(({p})=>p.sample===row.sample&&p.start.beforeMs>=row.handlerAtMs&&p.end.afterMs<=row.reactAtMs);
  assert.equal(candidates.length,1,'profile_event_correlation');const {p,index}=candidates[0]!;assert.ok(!used.has(index));used.add(index);
  return {...p,sequence:row.sequence,totalMs:row.totalMs};
 });
}
