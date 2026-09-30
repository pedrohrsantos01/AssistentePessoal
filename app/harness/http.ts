import {AppState} from 'react-native';
import {addNetworkStateListener,getNetworkStateAsync} from 'expo-network';
import {openExpoRuntime} from '../src/core/identity/open-expo-runtime.ts';
import {nativeId} from '../src/core/identity/open-expo-session.ts';

const origin='http://127.0.0.1:18765';
const password='native-fixture-password';
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function until(ready:()=>boolean|Promise<boolean>) {
  const deadline=Date.now()+35000;
  while(!await ready()) {if(Date.now()>deadline) throw new Error('native_sync_timeout');await pause(100);}
}
async function online() {
  const state=await getNetworkStateAsync();
  return state.isConnected===true&&state.isInternetReachable!==false;
}
// Android suspends JS timers in background; observe native transitions directly.
function appState(expected:'active'|'background') {
  if(AppState.currentState===expected) return Promise.resolve();
  return new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{subscription.remove();reject(new Error('native_app_state_timeout'));},35000);
    const subscription=AppState.addEventListener('change',state=>{
      if(state===expected) {clearTimeout(timer);subscription.remove();resolve();}
    });
  });
}
function reconnect() {
  return new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{subscription.remove();reject(new Error('native_network_timeout'));},35000);
    const check=(state:{isConnected?:boolean;isInternetReachable?:boolean})=>{
      if(state.isConnected===true&&state.isInternetReachable!==false) {clearTimeout(timer);subscription.remove();resolve();}
    };
    const subscription=addNetworkStateListener(check);
    void getNetworkStateAsync().then(check,error=>{clearTimeout(timer);subscription.remove();reject(error);});
  });
}
export async function exerciseHttp(link:string|null) {
  const match=/^ritmo-http:\/\/test\/([0-9a-f-]{36})\/(prepare|offline|resume|verify)\/([0-9]{4}-[0-9]{2}-[0-9]{2})$/.exec(link??'');
  if(!match) throw new Error('invalid_harness_link');
  const run=match[1]!,phase=match[2]!,day=match[3]!,timeContext={timezone:'UTC',dayStartHour:0};
  let runtime:Awaited<ReturnType<typeof openExpoRuntime>>|undefined;
  try {
    runtime=await openExpoRuntime(origin);const {session,sync}=runtime;
    // Reports contain only this run's synthetic domain fixtures, never credentials or arbitrary errors.
    const report=(phase:string)=>console.log('RITMO_HTTP_HARNESS:'+JSON.stringify({run,phase,passed:true,
      view:session.account().view(day),queue:session.account().operations()}));
    const idle=()=>sync.status().sync.phase==='idle'&&session.account().cursor()!==null;
    const checkHabit=(pending:number)=>{
      const view=session.account().view(day);
      if(view.habits.length!==1||!view.habits[0]?.done||view.totalXp!==10||view.pendingCount!==pending||view.rejectedCount!==0)
        throw new Error('native_habit_mismatch');
    };
    if(phase==='prepare') {
      await session.logout();await session.register(run+'@example.test',password,'HTTP harness');
      await until(idle);
      session.account().enqueue({type:'profile.setOnboarding',timeContext,completed:true,analyticsConsent:false},nativeId(),new Date().toISOString());
      await session.synchronize(origin);
      if(session.account().view(day).pendingCount!==0) throw new Error('native_account_not_empty');
      report('prepared');
    } else if(phase==='offline') {
      await until(async()=>!await online());
      // An unexpired access token restored offline proves the real SecureStore round trip.
      await session.accessToken();
      const habitId=nativeId(),at=new Date().toISOString();
      session.account().enqueue({type:'habit.create',habitId,title:'Hábito offline Android',habitType:'binary',scheduleKind:'daily',
        startDayKey:day,timeContext,iconKey:null,colorToken:null,sortOrder:0},nativeId(),at);
      session.account().enqueue({type:'habit.mark',habitId,dayKey:day,timeContext,observedUndoIds:[]},nativeId(),at);
      checkHabit(2);report('offline');
      // The driver kills this process while the runtime and SQLite handles are still open.
      await new Promise<void>(()=>{});
    } else if(phase==='resume') {
      await until(async()=>!await online());await session.accessToken();checkHabit(2);report('restored');
      await appState('background');report('background');
      await reconnect();
      if(AppState.currentState!=='background') throw new Error('expected_background');
      checkHabit(2);report('background_online');
      await appState('active');
      // No explicit sync until the native foreground/network adapters have drained the queue.
      await until(()=>idle()&&session.account().view(day).pendingCount===0);
      checkHabit(0);await session.accessToken(true);await session.synchronize(origin);checkHabit(0);report('converged');
    } else {
      await until(()=>idle()&&session.account().view(day).pendingCount===0);
      // A second process must restore the rotated refresh token, not replay the consumed token.
      await session.accessToken(true);await session.synchronize(origin);checkHabit(0);report('verified');
    }
  } catch(error) {
    console.log('RITMO_HTTP_HARNESS:'+JSON.stringify({run,phase,passed:false,
      error:error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'native_unexpected_failure'}));
  } finally {runtime?.close();}
}
