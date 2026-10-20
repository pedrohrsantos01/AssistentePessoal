package RITMO_PACKAGE

import android.app.Activity
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.util.Log
import android.view.Choreographer
import android.view.FrameMetrics
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewConfiguration
import android.view.ViewTreeObserver
import android.view.Window
import org.json.JSONObject

// Compiled only into the explicit isolated benchmark APK. No network or user content.
@android.annotation.TargetApi(35)
class RitmoFrameProbe(private val activity: Activity) : ViewTreeObserver.OnDrawListener, Choreographer.FrameCallback {
 private data class Draw(val kind: String,val vsync: Long,val observed: Long,val scan: Long,val checked: Boolean,val input: Touch?)
 private data class Touch(val down: Long,val start: Long,val dispatch: Long,val probeEnd: Long,val checked: Boolean)
 private data class Tap(val down: Long,val x: Float,val y: Float,val target: View,val checked: Boolean)
 private val sample=activity.intent.getIntExtra("ritmoPerfSample",0)
 private val root=activity.window.decorView
 private val pending=mutableListOf<Draw>()
 private var touch: Touch?=null
 private var tap: Tap?=null
 private val slop=ViewConfiguration.get(activity).scaledTouchSlop
 private var queued=false
 private var reported=false
 private var sequence=0
 private val choreographer=Choreographer.getInstance()
 private var frameTime=0L
 private var awaitingFrame=false
 private val enabled=sample in 1..10 && Build.VERSION.SDK_INT>=35
 private val frames=Window.OnFrameMetricsAvailableListener { _,metrics,dropped ->
  val frame=FrameMetrics(metrics)
  val actual=frame.getMetric(FrameMetrics.VSYNC_TIMESTAMP)
  val intended=frame.getMetric(FrameMetrics.INTENDED_VSYNC_TIMESTAMP)
  val matches=pending.filter {it.vsync==actual || it.vsync==intended}
  pending.removeAll(matches.toSet())
  for(draw in matches) {
   val duration=frame.getMetric(FrameMetrics.TOTAL_DURATION)
   if(duration<0 || dropped>0) {emit(JSONObject().put("kind","invalid").put("reason","frame_metrics_missing_or_dropped").put("dropped",dropped));continue}
   val end=intended+duration
   if(end<draw.observed) {emit(JSONObject().put("kind","invalid").put("reason","frame_ended_before_draw"));continue}
   val value=JSONObject().put("kind",draw.kind).put("frameVsyncNs",actual).put("frameIntendedNs",intended).put("drawVsyncNs",draw.vsync).put("drawNs",draw.observed).put("scanNs",draw.scan).put("frameTotalNs",duration).put("frameEndNs",end).put("dropped",dropped).put("checked",draw.checked)
   if(draw.kind=="startup") {
    val launch=activity.intent.getLongExtra("ritmoPerfLaunchNs",0L)
    val originPid=activity.intent.getIntExtra("ritmoPerfOriginPid",0)
    if(launch<=0 || launch>draw.observed || originPid<=0 || originPid==Process.myPid()) {
     emit(value.put("kind","invalid").put("reason","device_launch_clock_missing"));continue
    }
    value.put("launchNs",launch).put("launchClock","device_intent_request").put("originPid",originPid)
    reported=true
    activity.reportFullyDrawn()
   } else {
    val input=draw.input
    if(input==null || input.start>end) {emit(JSONObject().put("kind","invalid").put("reason","input_clock_missing"));continue}
    value.put("downNs",input.down).put("inputNs",input.start).put("dispatchNs",input.dispatch).put("dispatchProbeEndNs",input.probeEnd).put("sequence",++sequence)
   }
   emit(value)
  }
 }
 init {
  if(enabled) {root.viewTreeObserver.addOnDrawListener(this);activity.window.addOnFrameMetricsAvailableListener(frames,Handler(Looper.getMainLooper()));armFrame()}
 }
 private fun armFrame() {
  if(!awaitingFrame) {awaitingFrame=true;choreographer.postFrameCallback(this)}
 }
 override fun doFrame(frameTimeNanos:Long) {
  frameTime=frameTimeNanos
  if(enabled && (!queued || touch!=null))choreographer.postFrameCallback(this) else awaitingFrame=false
 }
 private fun emit(value:JSONObject) {Log.i("RitmoPerf",value.put("schema",4).put("sample",sample).put("pid",Process.myPid()).toString())}
 private fun visible(view:View):Boolean= view.isShown && view.getGlobalVisibleRect(Rect())
 private fun nodes(view:View,out:MutableList<View>) {
  if(view.visibility!=View.VISIBLE)return
  if(view.tag is String && (view.tag as String).startsWith("ritmo.perf."))out.add(view)
  if(view is ViewGroup)for(index in 0 until view.childCount)nodes(view.getChildAt(index),out)
 }
 private fun tagged():List<View> {val out=mutableListOf<View>();nodes(root,out);return out}
 private fun checkbox(views:List<View>):View?=views.firstOrNull {it.tag in listOf("ritmo.perf.habit.open","ritmo.perf.habit.done") && visible(it) && it.isEnabled}
 // API35 compatibility: SDK36 deprecates the boolean accessor.
 @Suppress("DEPRECATION")
 private fun checked(view:View):Boolean? {
  val node=view.createAccessibilityNodeInfo()
  return if(node.isCheckable && node.isEnabled && node.isChecked==(view.tag=="ritmo.perf.habit.done"))node.isChecked else null
 }
 override fun onDraw() {
  if(!enabled)return
  val began=System.nanoTime();val views=tagged();val target=checkbox(views) ?: return;val current=checked(target) ?: return
  // The public frame callback runs before traversal. drawingTime is stale during OnDraw.
  val vsync=frameTime
  if(vsync<=0)return
  if(!queued && views.any {it.tag=="ritmo.perf.briefing" && visible(it)} && views.any {it.tag=="ritmo.perf.local-cards" && visible(it)}) {
   queued=true;pending.add(Draw("startup",vsync,System.nanoTime(),System.nanoTime()-began,current,null))
  }
  val input=touch
  if(input!=null && current!=input.checked) {touch=null;pending.add(Draw("toggle",vsync,System.nanoTime(),System.nanoTime()-began,current,input))}
 }
 fun onTouch(event:MotionEvent) {
  val dispatch=System.nanoTime()
  if(!enabled || !reported || touch!=null)return
  when(event.actionMasked) {
   MotionEvent.ACTION_DOWN -> {
    tap=null
    val target=checkbox(tagged()) ?: return;val bounds=Rect();target.getGlobalVisibleRect(bounds)
    if(event.pointerCount==1 && bounds.contains(event.rawX.toInt(),event.rawY.toInt())) {
     val current=checked(target) ?: return
     tap=Tap(event.eventTimeNanos,event.rawX,event.rawY,target,current)
    }
   }
   MotionEvent.ACTION_POINTER_DOWN -> {
    tap=null
    emit(JSONObject().put("kind","gesture_ignored").put("reason","multiple_pointers").put("eventNs",event.eventTimeNanos))
   }
   MotionEvent.ACTION_MOVE -> {
    val candidate=tap ?: return
    val dx=event.rawX-candidate.x;val dy=event.rawY-candidate.y
    if(event.pointerCount!=1 || dx*dx+dy*dy>slop*slop)tap=null
   }
   MotionEvent.ACTION_CANCEL -> tap=null
   MotionEvent.ACTION_UP -> {
    val candidate=tap;tap=null
    if(candidate==null || event.pointerCount!=1)return
    val target=checkbox(tagged()) ?: return;val bounds=Rect();target.getGlobalVisibleRect(bounds)
    if(target===candidate.target && bounds.contains(event.rawX.toInt(),event.rawY.toInt()) && checked(target)==candidate.checked) {
     touch=Touch(candidate.down,event.eventTimeNanos,dispatch,System.nanoTime(),candidate.checked);armFrame()
    }
   }
  }
 }
 fun close() {
  if(enabled) {choreographer.removeFrameCallback(this);if(root.viewTreeObserver.isAlive)root.viewTreeObserver.removeOnDrawListener(this);activity.window.removeOnFrameMetricsAvailableListener(frames)}
 }
}
