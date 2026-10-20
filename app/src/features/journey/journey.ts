import {performanceSpan,profileToggle} from '../../core/diagnostics/toggle-profile.ts';
import {performanceMark} from '../../core/diagnostics/performance.ts';
import {PasswordRecovery} from './password-recovery.ts';
import type {PasswordResetTransport} from '../../core/identity/types.ts';
import type {Session} from '../../core/identity/session.ts';
import type {AccountStore,RecoveryItem} from '../../core/db/account-store.ts';
import type {DatabaseRecovery} from '../../core/db/local-migrations.ts';
import type {SyncScheduler,SyncClock,SyncState} from '../../core/sync/scheduler.ts';
import {systemClock} from '../../core/sync/scheduler.ts';
import {IdentityHttpError} from '../../core/identity/http-identity.ts';
import {getDayKey,nextLogicalDayAt} from '../gamification/domain/day-key.ts';
import type {TimeContext,CreateHabit,Command} from '../../core/sync/protocol.ts';
import {pt} from '../../i18n/pt-BR.ts';
import {titleKey} from '../habits/domain/title.ts';
import {habitIcons} from '../habits/catalog.ts';
import {habitPickerColors} from '../../theme/tokens.ts';
export type HabitDraft={title:string;iconKey:string|null;colorToken:string|null};
export type Runtime={readonly session:Session;readonly sync:SyncScheduler;readonly identity?:PasswordResetTransport;recovery:()=>DatabaseRecovery|null;retryDatabase:()=>Promise<void>;close:()=>void};
export type JourneyState={gate:'entry'|'database'|'logout'|'initial'|'account';key:string|null;busy:boolean;error:string|null;
  local:ReturnType<AccountStore['presentation']>|null;day:string|null;instant:number;online:boolean;remote:string;writable:boolean;vaultUnavailable:boolean;authenticationRequired:boolean;recovery:DatabaseRecovery|null;operations:ReturnType<AccountStore['operationStates']>;recoveries:RecoveryItem[];sync:SyncState;snapshot:{staged:number}|null;canRetry:boolean};
export class Journey {
 readonly passwordRecovery:PasswordRecovery;
 private listeners=new Set<()=>void>();
 private store:AccountStore|null=null;
 private detachStore:(()=>void)|null=null;
 private detach: (()=>void)[]=[];
 private cancelClock:(()=>void)|null=null;
 private stopped=false;
 private busy=false;
 private attempt=0;
 private localWhileBusy=false;
 private error:string|null=null;
 private snapshot!:JourneyState;
 constructor(private runtime:Runtime,private nextId:()=>string,private clock:SyncClock=systemClock) {
  this.passwordRecovery=new PasswordRecovery(()=>runtime.identity,()=>this.snapshot?.online??false,clock);
  if(!runtime.recovery()||runtime.recovery()?.scope==='account') {
   this.detach.push(runtime.session.subscribe(()=>this.refresh()),runtime.sync.subscribe(()=>this.refresh()));
  }
  this.refresh();
 }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 state=()=>this.snapshot;
 refresh=()=>{
  if(this.stopped) return;
  performanceMark('refresh.started');
  const state:JourneyState={gate:'entry',key:null,busy:this.busy,error:this.error,local:null,day:null,instant:this.clock.now(),online:false,remote:pt.saved,writable:false,vaultUnavailable:false,authenticationRequired:false,recovery:this.runtime.recovery(),operations:[],recoveries:[],sync:{phase:'idle',failures:0,nextAttemptAt:null},snapshot:null,canRetry:false};
  if(state.recovery) state.gate='database';
  else {
   const session=this.runtime.session,network=session.networkState(),scheduler=this.runtime.sync;
   state.key=network.key;state.vaultUnavailable=network.vaultUnavailable;state.online=scheduler.connectivity().online;state.writable=session.access().mode==='read_write';
   if(session.localState()==='logging_out') state.gate='logout';
   else if(network.key) {
    const store=session.account();
    if(store!==this.store) {this.detachStore?.();this.store=store;this.detachStore=store.subscribe(this.refresh);}
    const profile=performanceSpan('refresh.profile',()=>store.profile()),day=performanceSpan('refresh.day',()=>getDayKey(new Date(state.instant),profile.timeContext.timezone,profile.timeContext.dayStartHour));
    state.local=performanceSpan('refresh.presentation',()=>store.presentation(day));state.day=day;
    state.gate=store.initialCopyRequired()?'initial':'account';
    performanceSpan('refresh.status',()=>{state.operations=store.operationStates();state.recoveries=store.recovery();state.snapshot=store.snapshotProgress();state.sync=scheduler.status().sync;});
    state.canRetry=state.online&&!state.busy&&['idle','failed'].includes(state.sync.phase)&&(state.sync.nextAttemptAt===null||state.sync.nextAttemptAt<=state.instant);
    const phase=state.sync.phase;state.authenticationRequired=phase==='authentication_required';
    state.remote=!state.writable?pt.update:network.vaultUnavailable?pt.vault:
     phase==='authentication_required'?pt.remoteLogin:state.local.blockedCount?pt.attention:
     !state.online?pt.offline:phase==='running'?pt.syncing:['retry_wait','failed','paused','blocked'].includes(phase)?pt.serviceUnavailable:state.local.pendingCount?pt.saved:pt.synced;
   }
  }
  if(state.gate!=='account'&&state.gate!=='initial') {this.detachStore?.();this.detachStore=null;this.store=null;}
  this.cancelClock?.();this.cancelClock=null;
  if(state.local) {
   const {timezone,dayStartHour}=state.local.profile.timeContext;
   const dayBoundary=performanceSpan('refresh.nextDay',()=>nextLogicalDayAt(new Date(state.instant),timezone,dayStartHour));
   const retryBoundary=state.sync.nextAttemptAt!==null&&state.sync.nextAttemptAt>state.instant?state.sync.nextAttemptAt:Infinity;
   this.cancelClock=this.clock.schedule(Math.min(dayBoundary,retryBoundary)-state.instant,this.refresh);
  }
  if(this.snapshot&&state.key!==this.snapshot.key) {this.error=null;state.error=null;this.passwordRecovery.close();}
  this.snapshot=state;performanceMark('refresh.published');for(const listener of this.listeners) listener();performanceMark('refresh.finished');
 };
 private message(error:unknown,local=false) {
  if(error instanceof IdentityHttpError) {
   if(error.status===426) return pt.update;
   if(error.status===429) return pt.rateLimit;
   if(error.status>=500) return pt.serviceUnavailable;
   if(error.code==='invalid_credentials'||error.status===401) return pt.credentialsError;
   if(error.code==='email_already_exists'||error.status===409) return pt.emailConflict;
  }
  if(error instanceof Error&&['update_required','unsupported_protocol'].includes(error.message)) return pt.update;
  if(error instanceof Error&&error.message==='logout_required') return pt.sameAccountRequired;
  if(error instanceof Error&&error.message==='duplicate_habit') return pt.duplicateHabit;
  if(error instanceof Error&&error.message==='habit_unavailable') return pt.habitUnavailable;
  if(error instanceof Error&&error.message==='vault_unavailable') return this.snapshot.gate==='logout'?pt.logoutVault:this.snapshot.local?pt.vault:pt.vaultLocked;
  return local?pt.localFailure:pt.genericError;
 }
 private async perform(work:()=>Promise<void>,allowLocal=false) {
  if(this.busy||this.stopped) return;
  const key=this.snapshot.key,attempt=++this.attempt;
  this.busy=true;this.localWhileBusy=allowLocal;this.error=null;this.refresh();
  try {await work();} catch(error) {if(!this.stopped&&attempt===this.attempt&&this.snapshot.key===key) this.error=this.message(error);}
  finally {if(attempt===this.attempt) {this.busy=false;this.localWhileBusy=false;this.refresh();}}
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
  if((this.busy&&!this.localWhileBusy)||this.stopped) return false;
  this.error=null;
  const previous=this.snapshot;
  try {
   work(this.runtime.session.account());performanceMark('local.persisted');
   // A committed store notification already publishes the fresh presentation.
   // Commands without a notification still clear errors and update the clock.
   if(this.snapshot===previous)this.refresh();
   this.runtime.sync.requestSync();performanceMark('local.returned');return true;
  }
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
   const context=store.profile().timeContext,day=getDayKey(new Date(this.clock.now()),context.timezone,context.dayStartHour),view=store.presentation(day);
   if(view.managementHabits.some(habit=>titleKey(habit.title)===titleKey(title))) throw new Error('duplicate_habit');
   const command:CreateHabit={type:'habit.create',habitId:this.nextId(),title,habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:context,iconKey,colorToken,sortOrder:view.managementHabits.length};
   const at=new Date(this.clock.now()).toISOString();
   if(onboarding) store.finishOnboarding(command,this.nextId(),this.nextId(),at);else store.enqueue(command,this.nextId(),at);
  });
 }
 skip() {return this.local(store=>store.finishOnboarding(null,this.nextId(),this.nextId(),new Date(this.clock.now()).toISOString()));}
 toggle(habitId:string,expectedDone:boolean) {
  return profileToggle(()=>this.local(store=>{
   const context=performanceSpan('toggle.profile',()=>store.profile().timeContext),dayKey=performanceSpan('toggle.day',()=>getDayKey(new Date(this.clock.now()),context.timezone,context.dayStartHour));
   const habit=performanceSpan('toggle.view',()=>store.view(dayKey).habits.find(item=>item.habitId===habitId));
   if(!habit||habit.done!==expectedDone) return;
   const command=performanceSpan('toggle.command',()=>habit.done?{type:'habit.unmark' as const,habitId,dayKey,timeContext:context}:
    {type:'habit.mark' as const,habitId,dayKey,timeContext:context,observedUndoIds:store.observedUndoIds(habitId,dayKey)});
   const id=performanceSpan('toggle.identity',()=>this.nextId()),at=new Date(this.clock.now()).toISOString();
   store.enqueue(command,id,at);
  }));
 }
 edit(habitId:string,baseline:HabitDraft,draft:HabitDraft) {
  const title=draft.title===baseline.title?baseline.title:draft.title.normalize('NFC').trim();
  if(!title||Array.from(title).length>120||Array.from(title).some(character=>/^[\uD800-\uDFFF]$/.test(character))) {this.error=pt.invalidHabit;this.refresh();return false;}
  return this.local(store=>{
   const habits=store.presentation(this.snapshot.day!).managementHabits;
   if(!habits.some(habit=>habit.habitId===habitId)) throw new Error('habit_unavailable');
   if(habits.some(habit=>habit.habitId!==habitId&&titleKey(habit.title)===titleKey(title))) throw new Error('duplicate_habit');
   const patch:Extract<import('../../core/sync/protocol.ts').Command,{type:'habit.patchMetadata'}>['patch']={};
   if(title!==baseline.title) patch.title=title;
   // Preserve unknown existing keys. Only a newly selected key needs catalogue validation.
   if(draft.iconKey!==baseline.iconKey) {
    if(draft.iconKey!==null&&!Object.hasOwn(habitIcons,draft.iconKey)) throw new Error('invalid_metadata');
    patch.iconKey=draft.iconKey;
   }
   if(draft.colorToken!==baseline.colorToken) {
    const colors:readonly string[]=[...Object.keys(habitPickerColors),'green'];
    if(draft.colorToken!==null&&!colors.includes(draft.colorToken)) throw new Error('invalid_metadata');
    patch.colorToken=draft.colorToken;
   }
   if(Object.keys(patch).length) store.enqueue({type:'habit.patchMetadata',habitId,patch},this.nextId(),new Date(this.clock.now()).toISOString());
  });
 }
 move(habitId:string,direction:-1|1) {
  return this.local(store=>{
   const habits=store.presentation(this.snapshot.day!).managementHabits,index=habits.findIndex(habit=>habit.habitId===habitId),target=index+direction;
   if(index<0) throw new Error('habit_unavailable');
   if(target<0||target>=habits.length) return;
   [habits[index],habits[target]]=[habits[target]!,habits[index]!];
   // Integer positions resolve ties deterministically; each intent changes only order.
   const occurredAt=new Date(this.clock.now()).toISOString();
   store.enqueueBatch(habits.flatMap((habit,sortOrder)=>habit.sortOrder===sortOrder?[]:[{command:{type:'habit.patchMetadata' as const,habitId:habit.habitId,patch:{sortOrder}},operationId:this.nextId(),occurredAt}]));
  });
 }
 delete(habitId:string) {
  return this.local(store=>{
   if(!store.presentation(this.snapshot.day!).managementHabits.some(habit=>habit.habitId===habitId)) throw new Error('habit_unavailable');
   store.enqueue({type:'habit.delete',habitId},this.nextId(),new Date(this.clock.now()).toISOString());
  });
 }
 logout() {
  // Logout fences immediately even if an older remote action is still waiting.
  if(this.snapshot.gate==='logout'&&this.busy) return Promise.resolve();
  this.busy=false;return this.perform(()=>this.runtime.session.logout());
 }
 retry() {return this.perform(async()=>{
  if(this.runtime.recovery()) {
   await this.runtime.retryDatabase();
   if(!this.runtime.recovery()&&!this.detach.length) this.detach.push(this.runtime.session.subscribe(this.refresh),this.runtime.sync.subscribe(this.refresh));
  } else if(this.runtime.session.vaultRecovery().unavailable||this.runtime.session.localState()==='logging_out') await this.runtime.session.retryVault();
  else this.runtime.sync.retry();
 },this.snapshot.gate==='account'&&this.runtime.session.vaultRecovery().unavailable);}
 correct(operationId:string,command:Command,dependentIds:string[]) {
  if('title' in command) {
   const title=command.title.normalize('NFC').trim();
   if(!title||Array.from(title).length>120||Array.from(title).some(c=>/^[\uD800-\uDFFF]$/.test(c))) {this.error=pt.invalidHabit;this.refresh();return false;}
   command={...command,title};
  }
  if(command.type==='habit.patchMetadata'&&command.patch.title!==undefined) {
   const title=command.patch.title.normalize('NFC').trim();
   if(!title||Array.from(title).length>120||Array.from(title).some(c=>/^[\uD800-\uDFFF]$/.test(c))) {this.error=pt.invalidHabit;this.refresh();return false;}
   command={...command,patch:{...command.patch,title}};
  }
  return this.local(store=>{
   const item=store.recovery().find(item=>item.operation.operationId===operationId&&!item.resolution);
   if(!item||item.error.identity||item.error.code==='identity_dependency_unresolved') throw new Error('operation_not_recoverable');
   if(command.type==='habit.create'&&item.error.code==='id_content_conflict'&&!item.error.identity) command={...command,habitId:this.nextId()};
   store.correct([{operationId,replacementId:this.nextId(),command},...dependentIds.map(operationId=>({operationId,replacementId:this.nextId()}))]);
  });
 }
 discard(operationId:string) {return this.local(store=>store.discard([operationId]));}
 clearError() {this.error=null;this.refresh();}
 dispose() {this.passwordRecovery.dispose();this.stopped=true;this.cancelClock?.();this.detachStore?.();this.detach.forEach(unsubscribe=>unsubscribe());this.listeners.clear();this.runtime.close();}
}
