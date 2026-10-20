package RITMO_PACKAGE

import android.os.Debug
import android.os.Process
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

// Only the isolated performance APK registers this synchronous observation port.
class RitmoPerformance(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
 override fun getName() = "RitmoPerformance"
 @ReactMethod(isBlockingSynchronousMethod = true)
 fun readClock(): WritableMap {
  val before = System.nanoTime()
  val cpu = Debug.threadCpuTimeNanos()
  val after = System.nanoTime()
  return Arguments.createMap().apply {
   putDouble("beforeMs", before / 1e6)
   putDouble("afterMs", after / 1e6)
   putDouble("cpuMs", cpu / 1e6)
   putInt("tid", Process.myTid())
   putString("thread", Thread.currentThread().name)
  }
 }
}
class RitmoPerformancePackage : BaseReactPackage() {
 override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = if (name == "RitmoPerformance") RitmoPerformance(reactContext) else null
 override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
  mapOf("RitmoPerformance" to ReactModuleInfo("RitmoPerformance", RitmoPerformance::class.java.name, false, false, false, false))
 }
 override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
