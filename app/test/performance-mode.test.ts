import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {requirePerformanceMode,validateObservationMode} from './support/performance-mode.ts';
test('observation modes are explicit and missing detailed data never falls back to lightweight',()=>{
 for(const value of [undefined,'','other'])assert.throws(()=>requirePerformanceMode(value),/explicit_performance_mode_required/);
 assert.equal(requirePerformanceMode('lightweight'),'lightweight');assert.equal(requirePerformanceMode('detailed'),'detailed');
 assert.deepEqual(validateObservationMode('lightweight',[],[{mode:'lightweight'}],[]),[]);
 assert.throws(()=>validateObservationMode('lightweight',[],[],[]),/performance_marks_missing/);
 assert.throws(()=>validateObservationMode('lightweight',[],[{mode:'detailed'}],[]),/performance_mode_mismatch/);
 assert.throws(()=>validateObservationMode('lightweight',[],[{mode:'lightweight'}],[{}]),/lightweight_contains_detailed_profiles/);
 assert.throws(()=>validateObservationMode('detailed',[],[{mode:'detailed'}],[]));
});
test('lightweight and disabled modes never call the synchronous port; detailed mode preserves profiling and exceptions',()=>{
 const source=`
  import assert from 'node:assert/strict';
  import {performanceTest,performanceMode,performanceMark} from './src/core/diagnostics/performance.ts';
  import {installPerformanceClock,profileToggle,performanceSpan} from './src/core/diagnostics/toggle-profile.ts';
  let reads=0,logs=[];console.info=value=>logs.push(value);
  globalThis.nativePerformanceNow=()=>performance.now();
  installPerformanceClock(()=>{reads++;const at=performance.now();return {beforeMs:at,afterMs:at,cpuMs:0,tid:1,thread:'js'};});
  assert.equal(profileToggle(()=>performanceSpan('work',()=>42)),42);
  const failure=new Error('storage_failure');assert.throws(()=>profileToggle(()=>performanceSpan('work',()=>{throw failure;})),error=>error===failure);
  performanceMark('toggle.handler',123);
  await new Promise(resolve=>setTimeout(resolve,550));
  assert.equal(reads>0,performanceMode==='detailed');
  assert.equal(logs.filter(line=>line.startsWith('RITMO_PERF_PROFILE ')).length,performanceMode==='detailed'?2:0);
  const marks=logs.filter(line=>line.startsWith('RITMO_PERF_JS '));assert.equal(marks.length,performanceTest?1:0);
  if(performanceTest){const mark=JSON.parse(marks[0].slice(14));assert.equal(mark.mode,performanceMode);assert.equal(mark.inputTimestampMs,123);assert.ok(mark.nativeBeforeMs<=mark.at&&mark.at<=mark.nativeAfterMs);}
 `;
 for(const mode of ['lightweight','detailed','disabled'])execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',source],{cwd:process.cwd(),env:{...process.env,EXPO_PUBLIC_RITMO_PERF_TEST:mode==='disabled'?'':'1',EXPO_PUBLIC_RITMO_PERF_MODE:mode==='disabled'?'':mode},windowsHide:true});
 assert.throws(()=>execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',"import './src/core/diagnostics/performance.ts'"],{env:{...process.env,EXPO_PUBLIC_RITMO_PERF_TEST:'1',EXPO_PUBLIC_RITMO_PERF_MODE:''},stdio:'pipe',windowsHide:true}),/explicit_performance_mode_required/);
});
test('presentation capture refuses an incompatible or missing performance mode before opening resources',{skip:process.platform!=='win32'},()=>{
 for(const args of [['-Presentation'],['-Performance','-Presentation','-PerformanceMode','detailed']]){
  assert.throws(()=>execFileSync('pwsh.exe',['-NoProfile','-File','../scripts/verify-android-accessibility.ps1',...args],{cwd:process.cwd(),windowsHide:true,stdio:'pipe'}),/Presentation exige Performance no modo lightweight/);
 }
});
