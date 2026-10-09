import type {Session} from '../../core/identity/session.ts';
import type {AccountStore} from '../../core/db/account-store.ts';
import type {DatabaseRecovery} from '../../core/db/local-migrations.ts';
import type {SyncScheduler,SyncClock} from '../../core/sync/scheduler.ts';
import {systemClock} from '../../core/sync/scheduler.ts';
import {IdentityHttpError} from '../../core/identity/http-identity.ts';
import {getDayKey,nextLogicalDayAt} from '../gamification/domain/day-key.ts';
import type {TimeContext,CreateHabit} from '../../core/sync/protocol.ts';
import {pt} from '../../i18n/pt-BR.ts';
export type Runtime={readonly session:Session;readonly sync:SyncScheduler;recovery:()=>DatabaseRecovery|null;retryDatabase:()=>Promise<void>;close:()=>void};
export type JourneyState={gate:'entry'|'database'|'logout'|'initial'|'account';key:string|null;busy:boolean;error:string|null;
  local:ReturnType<AccountStore['presentation']>|null;day:string|null;instant:number;online:boolean;remote:string;writable:boolean};
export class Journey {
 private listeners=new Set<()=>void>();
 private store:AccountStore|null=null;
 private detachStore:(()=>void)|null=null;
 private detach: (()=>void)[]=[];
 private cancelClock:(()=>void)|null=null;
 private stopped=false;
 private busy=false;
 private error:string|null=null;
 private snapshot!:JourneyState;
 constructor(private runtime:Runtime,private nextId:()=>string,private clock:SyncClock=systemClock) {
  if(!runtime.recovery()||runtime.recovery()?.scope==='account') {
   this.detach.push(runtime.session.subscribe(()=>this.refresh()),runtime.sync.subscribe(()=>this.refresh()));
  }
  this.refresh();
 }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 state=()=>this.snapshot;
 refresh=()=>{
  if(this.stopped) return;
  const state:JourneyState={gate:'entry',key:null,busy:this.busy,error:this.error,local:null,day:null,instant:this.clock.now(),online:false,remote:pt.saved,writable:false};
  if(this.runtime.recovery()) state.gate='database';
  else {
   const session=this.runtime.session,network=session.networkState(),scheduler=this.runtime.sync;
   state.key=network.key;state.online=scheduler.connectivity().online;state.writable=session.access().mode==='read_write';
   if(session.localState()==='logging_out') state.gate='logout';
   else if(network.key) {
    const store=session.account();
    if(store!==this.store) {this.detachStore?.();this.store=store;this.detachStore=store.subscribe(this.refresh);}
    const profile=store.profile(),day=getDayKey(new Date(state.instant),profile.timeContext.timezone,profile.timeContext.dayStartHour);
    state.local=store.presentation(day);state.day=day;
    state.gate=profile.onboardedAt&&store.cursor()===null&&store.operations().length===0?'initial':'account';
    const phase=scheduler.status().sync.phase;
    state.remote=network.updateRequired?pt.update:network.vaultUnavailable?pt.vault:
     phase==='authentication_required'?pt.remoteLogin:state.local.blockedCount?pt.attention:
     !state.online?pt.offline:phase==='running'?pt.syncing:['retry_wait','failed','paused','blocked'].includes(phase)?pt.serviceUnavailable:state.local.pendingCount?pt.saved:pt.synced;
   }
  }
  if(state.gate!=='account'&&state.gate!=='initial') {this.detachStore?.();this.detachStore=null;this.store=null;}
  this.cancelClock?.();this.cancelClock=null;
  if(state.local) {
   const {timezone,dayStartHour}=state.local.profile.timeContext;
   this.cancelClock=this.clock.schedule(nextLogicalDayAt(new Date(state.instant),timezone,dayStartHour)-state.instant,this.refresh);
  }
  this.snapshot=state;for(const listener of this.listeners) listener();
 };
 private message(error:unknown,local=false) {
  if(error instanceof IdentityHttpError) {
   if(error.status===429) return pt.rateLimit;
   if(error.status>=500) return pt.serviceUnavailable;
   if(error.code==='invalid_credentials'||error.status===401) return pt.credentialsError;
   if(error.code==='email_already_exists'||error.status===409) return pt.emailConflict;
  }
  if(error instanceof Error&&error.message==='duplicate_habit') return pt.duplicateHabit;
  if(error instanceof Error&&error.message==='vault_unavailable') return pt.vault;
  return local?pt.localFailure:pt.genericError;
 }
 private async perform(work:()=>Promise<void>) {
  if(this.busy||this.stopped) return;
  this.busy=true;this.error=null;this.refresh();
  try {await work();} catch(error) {this.error=this.message(error);}
  finally {this.busy=false;this.refresh();}
 }
 authenticate(kind:'login'|'register',email:string,password:string,name:string) {
  const normalizedName=name.normalize('NFC').trim(),passwordCharacters=Array.from(password);
  const invalid=(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||email.trim().length>254)?pt.invalidEmail:
   passwordCharacters.length<8||passwordCharacters.length>128||passwordCharacters.some(character=>/^[\uD800-\uDFFF]$/.test(character))?pt.invalidPassword:kind==='register'&&(!normalizedName||Array.from(normalizedName).length>80||Array.from(normalizedName).some(character=>/^[\uD800-\uDFFF]$/.test(character)))?pt.invalidName:null;
  if(invalid) {this.error=invalid;this.refresh();return Promise.resolve();}
  if(!this.snapshot.online) {this.error=pt.offlineAuth;this.refresh();return Promise.resolve();}
  return this.perform(()=>kind==='login'?this.runtime.session.login(email.trim(),password):this.runtime.session.register(email.trim(),password,normalizedName));
 }
 private local(work:(store:AccountStore)=>void) {
  if(this.busy||this.stopped) return false;
  this.error=null;
  try {work(this.runtime.session.account());this.refresh();this.runtime.sync.requestSync();return true;}
  catch(error) {this.error=this.message(error,true);this.refresh();return false;}
 }
 confirmTime(context:TimeContext) {
  try {getDayKey(new Date(this.clock.now()),context.timezone,context.dayStartHour);} catch {this.error=pt.invalidTimezone;this.refresh();return false;}
  return this.local(store=>store.saveTimeContext(context,this.nextId(),new Date(this.clock.now()).toISOString()));
 }
 create(title:string,iconKey:string,colorToken:string,onboarding:boolean) {
  title=title.normalize('NFC').trim();
  if(!title||Array.from(title).length>120||Array.from(title).some(character=>/^[\uD800-\uDFFF]$/.test(character))) {this.error=pt.invalidHabit;this.refresh();return false;}
  return this.local(store=>{
   const context=store.profile().timeContext,day=getDayKey(new Date(this.clock.now()),context.timezone,context.dayStartHour),view=store.view(day);
   if(view.habits.some(habit=>habit.title.toLocaleLowerCase('pt-BR')===title.toLocaleLowerCase('pt-BR'))) throw new Error('duplicate_habit');
   const command:CreateHabit={type:'habit.create',habitId:this.nextId(),title,habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:context,iconKey,colorToken,sortOrder:view.habits.length};
   const at=new Date(this.clock.now()).toISOString();
   if(onboarding) store.finishOnboarding(command,this.nextId(),this.nextId(),at);else store.enqueue(command,this.nextId(),at);
  });
 }
 skip() {return this.local(store=>store.finishOnboarding(null,this.nextId(),this.nextId(),new Date(this.clock.now()).toISOString()));}
 toggle(habitId:string,expectedDone:boolean) {
  return this.local(store=>{
   const context=store.profile().timeContext,dayKey=getDayKey(new Date(this.clock.now()),context.timezone,context.dayStartHour);
   const habit=store.view(dayKey).habits.find(item=>item.habitId===habitId);
   if(!habit||habit.done!==expectedDone) return;
   const command=habit.done?{type:'habit.unmark' as const,habitId,dayKey,timeContext:context}:
    {type:'habit.mark' as const,habitId,dayKey,timeContext:context,observedUndoIds:store.observedUndoIds(habitId,dayKey)};
   store.enqueue(command,this.nextId(),new Date(this.clock.now()).toISOString());
  });
 }
 logout() {return this.perform(()=>this.runtime.session.logout());}
 retry() {return this.perform(async()=>{
  if(this.runtime.recovery()) {
   await this.runtime.retryDatabase();
   if(!this.runtime.recovery()&&!this.detach.length) this.detach.push(this.runtime.session.subscribe(this.refresh),this.runtime.sync.subscribe(this.refresh));
  } else if(this.runtime.session.vaultRecovery().unavailable||this.runtime.session.localState()==='logging_out') await this.runtime.session.retryVault();
  else this.runtime.sync.retry();
 });}
 clearError() {this.error=null;this.refresh();}
 dispose() {this.stopped=true;this.cancelClock?.();this.detachStore?.();this.detach.forEach(unsubscribe=>unsubscribe());this.listeners.clear();this.runtime.close();}
}
