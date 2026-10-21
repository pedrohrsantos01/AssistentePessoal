import {detailedPerformanceTest} from './performance.ts';
export type ThreadClock={beforeMs:number;afterMs:number;cpuMs:number;tid:number;thread:string};
type Reading=ThreadClock&{jsBeforeMs:number;jsAfterMs:number};
type Span={name:string;depth:number;start:Reading;end:Reading};
let readNative:(()=>ThreadClock)|undefined;
let active:{start:Reading;spans:Span[];depth:number}|undefined;
export function installPerformanceClock(clock:()=>ThreadClock) {if(detailedPerformanceTest)readNative=clock;}
function read():Reading|undefined {
 try {const jsBeforeMs=performance.now(),native=readNative?.(),jsAfterMs=performance.now();return native?{...native,jsBeforeMs,jsAfterMs}:undefined;}
 catch {return undefined;}
}
// Inert outside an explicitly instrumented toggle; no logs inside measured spans.
export function performanceSpan<T>(name:string,work:()=>T):T {
 const profile=active,start=profile&&read();if(!profile||!start)return work();
 const depth=profile.depth++;
 try {return work();} finally {const end=read();profile.depth--;if(end)profile.spans.push({name,depth,start,end});}
}
export function profileToggle<T>(work:()=>T):T {
 if(!detailedPerformanceTest||active)return work();const start=read();if(!start)return work();
 const profile={start,spans:[] as Span[],depth:0};active=profile;
 try {return work();} finally {
  const end=read();active=undefined;
  // Emit after the timed response; the cohort checks complete profiles and clock/thread identity.
  setTimeout(()=>{try {
   // Android log entries are bounded. Keep each chunk below the logcat payload limit.
   const parts=Math.ceil(profile.spans.length/4);
   for(let part=0;part<parts;part++)console.info('RITMO_PERF_PROFILE '+JSON.stringify({schema:1,part,parts,start,end,spans:profile.spans.slice(part*4,part*4+4)}));
  }catch{}},500);
 }
}
