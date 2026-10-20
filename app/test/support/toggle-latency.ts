import assert from 'node:assert/strict';
import {frameSample} from './performance-samples.ts';

type Mark={schema:2;sample:number;phase:string;at:number;nativeBeforeMs:number;nativeAfterMs:number;inputTimestampMs?:number};
function mark(value:unknown):Mark {
 assert.ok(value&&typeof value==='object');const v=value as Record<string,unknown>;
 assert.equal(v.schema,2);assert.equal(typeof v.phase,'string');
 for(const key of ['sample','at','nativeBeforeMs','nativeAfterMs'])assert.ok(typeof v[key]==='number'&&Number.isFinite(v[key]));
 assert.ok((v.nativeBeforeMs as number)<=(v.at as number)&&(v.at as number)<=(v.nativeAfterMs as number),'javascript_clock_not_native_monotonic');
 return v as Mark;
}
// Sources and runtime clock checks are recorded in the protocol. No host clocks or offsets.
export function attributeToggleLatency(frames:readonly unknown[],rawMarks:readonly unknown[]) {
 const marks=rawMarks.map(mark),rows=frames.map(frameSample).filter(f=>f.kind==='toggle');
 assert.equal(rows.length,20);
 assert.equal(new Set(rows.map(f=>f.sample+':'+f.sequence)).size,20,'duplicate_toggle');
 return rows.map(frame=>{
  assert.equal(frame.schema,4);const input=frame.inputNs!/1e6,dispatch=frame.dispatchNs!/1e6,probeEnd=frame.dispatchProbeEndNs!/1e6,end=frame.frameEndNs/1e6;
  assert.ok(input<=dispatch&&dispatch<=probeEnd&&probeEnd<=end,'native_dispatch_clock_invalid');
  const sampleMarks=marks.filter(m=>m.sample===frame.sample),handlers=sampleMarks.filter(m=>m.phase==='toggle.handler');
  assert.equal(handlers.length,2);const handler=handlers[frame.sequence!-1]!,next=handlers[frame.sequence!];
  assert.ok(typeof handler.inputTimestampMs==='number'&&Math.abs(handler.inputTimestampMs-input)<1,'event_clock_correlation_missing');
  assert.ok(handler.at>=probeEnd&&handler.at<=end,'handler_outside_native_interval');
  const group=sampleMarks.filter(m=>m.at>=handler.at&&(!next||m.at<next.at));
  const one=(phase:string)=>{const found=group.filter(m=>m.phase===phase);assert.equal(found.length,1,phase);return found[0]!;};
  const commit=one('store.committed'),returned=one('local.returned'),react=one('toggle.react'),refreshes=group.filter(m=>m.phase==='refresh.started'&&m.at<=returned.at);
  assert.ok(handler.at<=commit.at&&commit.at<=returned.at&&returned.at<=react.at&&react.at<=end,'phase_order_invalid');
  return {sample:frame.sample,sequence:frame.sequence,checked:frame.checked,totalMs:end-input,handlerAtMs:handler.at,reactAtMs:react.at,eventToDispatchMs:dispatch-input,dispatchProbeMs:probeEnd-dispatch,dispatchToHandlerMs:handler.at-dispatch,
   handlerToCommitMs:commit.at-handler.at,commitToReturnMs:returned.at-commit.at,returnToReactMs:react.at-returned.at,reactToFrameMs:end-react.at,
   refreshCount:refreshes.length,refreshes:refreshes.map(start=>{
    const finish=group.find(m=>m.phase==='refresh.finished'&&m.at>=start.at);assert.ok(finish&&finish.at<=returned.at,'refresh_end_missing');
    return {durationMs:finish.at-start.at};
   }),clockBracketMaxMs:Math.max(...group.map(m=>m.nativeAfterMs-m.nativeBeforeMs))};
 });
}
