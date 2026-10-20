// Optional local diagnostics for the explicitly isolated performance build. No user data.
export const performanceTest=process.env.EXPO_PUBLIC_RITMO_PERF_TEST==='1';
export function performanceMark(phase:'app.module'|'fonts.ready'|'preferences.ready'|'runtime.ready'|'toggle.handler'|'local.persisted') {
 if(!performanceTest)return;
 try {performance.mark('ritmo.'+phase);console.info('RITMO_PERF_JS '+JSON.stringify({schema:1,phase,at:performance.now()}));} catch { /* Diagnostics never change application behavior. */ }
}
