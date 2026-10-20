// Optional local diagnostics for the explicitly isolated performance build. No user data.
export const performanceTest=process.env.EXPO_PUBLIC_RITMO_PERF_TEST==='1';
export function performanceMark(phase:'app.module'|'fonts.ready'|'preferences.ready'|'runtime.ready'|'toggle.handler'|'store.committed'|'refresh.started'|'refresh.published'|'refresh.finished'|'local.persisted'|'local.returned'|'toggle.react',inputTimestampMs?:number) {
 if(!performanceTest)return;
 try {
  // RN 0.86's native clock uses steady_clock on Android (system monotonic time).
  // Retain a runtime bracket; the analyzer refuses fallback or incompatible clocks.
  const nativeNow=(globalThis as typeof globalThis&{nativePerformanceNow?:()=>number}).nativePerformanceNow;
  const before=nativeNow?.(),at=performance.now(),after=nativeNow?.();
  performance.mark('ritmo.'+phase);
  console.info('RITMO_PERF_JS '+JSON.stringify({schema:2,phase,at,nativeBeforeMs:before,nativeAfterMs:after,inputTimestampMs}));
 } catch { /* Diagnostics never change application behavior. */ }
}
