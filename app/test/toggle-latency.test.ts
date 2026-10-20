import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attributeToggleLatency} from './support/toggle-latency.ts';

function cohort() {
 const frames:Record<string,unknown>[]=[],marks:Record<string,unknown>[]=[];
 for(let sample=1;sample<=10;sample++)for(let sequence=1;sequence<=2;sequence++) {
  const start=10000*sample+1000*sequence;
  frames.push({schema:4,downNs:(start-60)*1e6,kind:'toggle',sample,sequence,pid:sample,checked:sequence===1,dropped:0,inputNs:start*1e6,dispatchNs:(start+2)*1e6,dispatchProbeEndNs:(start+2.1)*1e6,
   frameVsyncNs:(start+90)*1e6,frameIntendedNs:(start+90)*1e6,drawVsyncNs:(start+90)*1e6,drawNs:(start+95)*1e6,scanNs:1000,frameTotalNs:15e6,frameEndNs:(start+105)*1e6});
  for(const [phase,offset] of [['toggle.handler',5],['store.committed',15],['refresh.started',16],['refresh.finished',40],['local.persisted',41],['refresh.started',42],['refresh.finished',66],['local.returned',67],['toggle.react',80]] as const) {
   const at=start+offset;marks.push({schema:2,sample,phase,at,nativeBeforeMs:at-0.001,nativeAfterMs:at+0.001,...(phase==='toggle.handler'?{inputTimestampMs:start}:{})});
  }
 }
 return {frames,marks};
}
test('attribution preserves all slow samples and separates input, committed work, repeated refresh and presentation',()=>{
 const {frames,marks}=cohort(),rows=attributeToggleLatency(frames,marks);assert.equal(rows.length,20);
 assert.equal(rows[0]!.totalMs,105);assert.equal(rows[0]!.eventToDispatchMs,2);assert.equal(rows[0]!.handlerToCommitMs,10);assert.equal(rows[0]!.commitToReturnMs,52);assert.equal(rows[0]!.refreshCount,2);assert.equal(rows[0]!.reactToFrameMs,25);
});
test('attribution rejects missing dispatch, JS fallback clocks, mismatched events and missing or reversed phases',()=>{
 const {frames,marks}=cohort();
 assert.throws(()=>attributeToggleLatency(frames.map((f,i)=>i?f:{...f,dispatchNs:undefined}),marks));
 for(const patch of [{nativeBeforeMs:1e12},{inputTimestampMs:0},{at:1e12}])assert.throws(()=>attributeToggleLatency(frames,marks.map((m,i)=>i?m:{...m,...patch})));
 assert.throws(()=>attributeToggleLatency(frames,marks.filter(m=>m.phase!=='store.committed')));
 assert.throws(()=>attributeToggleLatency(frames,marks.filter(m=>m.phase!=='refresh.finished')));
 assert.throws(()=>attributeToggleLatency(frames,marks.filter(m=>m.phase!=='toggle.react')));
});
test('an earlier ACTION_UP cannot acquire a later press just because its frame changes the checkbox',()=>{
 const {frames,marks}=cohort();
 // Observed in the rejected Android run: the armed UP preceded the real press by ~5.7s.
 const first=marks[0]!;first.inputTimestampMs=Number(first.inputTimestampMs)+5671;
 assert.throws(()=>attributeToggleLatency(frames,marks),/event_clock_correlation_missing/);
});
