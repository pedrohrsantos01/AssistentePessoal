import type {Session} from '../identity/session.ts';
import {failureKind,retryDelay} from './retry.ts';

export type SyncState={phase:'idle'|'running'|'retry_wait'|'failed'|'authentication_required'|'update_required'|'blocked'|'paused';failures:number;nextAttemptAt:number|null;lastFailure?:'rate_limit'|'unavailable'|'connection'};
export type SyncClock={now:()=>number;schedule:(delay:number,run:()=>void)=>()=>void};
export type SyncEnvironment={active:boolean;online:boolean};
export const systemClock:SyncClock={now:Date.now,schedule(delay,run){const timer=setTimeout(run,delay);return ()=>clearTimeout(timer);}};
type Lane={state:SyncState;running:boolean;epoch:number;cancel:(()=>void)|null};
const idle=():SyncState=>({phase:'idle',failures:0,nextAttemptAt:null});
const lane=():Lane=>({state:idle(),running:false,epoch:0,cancel:null});
export class SyncScheduler {
  private listeners=new Set<()=>void>();
  subscribe(listener:()=>void) {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  private notify() {for(const listener of this.listeners) listener();}
  requestSync() {if(this.lanes.sync.running) return;this.lanes.sync.cancel?.();this.lanes.sync.cancel=null;this.kick('sync');}
  connectivity() {return {...this.environment};}
  private environment:SyncEnvironment={active:false,online:false};
  private stopped=false;
  private lanes={sync:lane(),revocations:lane()};
  private key:string|null;
  private vaultUnavailable:boolean;
  private beforeVault:{key:string|null;sync:SyncState;revocations:SyncState}|null=null;
  private unsubscribe:()=>void;
  constructor(private session:Session,private origin:string,private clock:SyncClock=systemClock) {
    this.vaultUnavailable=session.networkState().vaultUnavailable;
    this.key=session.networkState().key;this.lanes.sync.state=this.restoredState();
    if(session.networkState().updateRequired||this.vaultUnavailable) this.lanes.revocations.state=this.restoredState();
    this.unsubscribe=session.subscribe(()=>{
      const network=session.networkState(),key=network.key;
      if(network.vaultUnavailable!==this.vaultUnavailable) {
        if(network.vaultUnavailable) this.beforeVault={key:this.key,sync:{...this.lanes.sync.state},revocations:{...this.lanes.revocations.state}};
        this.vaultUnavailable=network.vaultUnavailable;
        for(const lane of Object.values(this.lanes)) {lane.epoch++;lane.cancel?.();lane.cancel=null;}
        this.lanes.sync.state=this.vaultUnavailable?this.restoredState():
          this.resumeAfterVault(this.beforeVault?.key===key?this.beforeVault?.sync:undefined,this.restoredState());
        this.lanes.revocations.state=this.vaultUnavailable?{phase:'paused',failures:0,nextAttemptAt:null}:
          this.resumeAfterVault(this.beforeVault?.revocations,idle());
        if(!this.vaultUnavailable) this.beforeVault=null;
      }
      if(key!==this.key) {
        this.key=key;this.lanes.sync.epoch++;this.lanes.sync.cancel?.();this.lanes.sync.cancel=null;this.lanes.sync.state=this.restoredState();
      }
      if(session.networkState().updateRequired) for(const lane of Object.values(this.lanes)) {
        if(lane.state.phase==='update_required') continue;
        lane.epoch++;lane.cancel?.();lane.cancel=null;lane.state={phase:'update_required',failures:0,nextAttemptAt:null};
      }
      this.notify();this.kick('sync');this.kick('revocations');
    });
  }
  private resumeAfterVault(previous:SyncState|undefined,current:SyncState):SyncState {
    if(!previous||['idle','running','paused'].includes(previous.phase)||['failed','update_required'].includes(current.phase)) return current;
    if(previous.phase!=='retry_wait') return previous;
    return {phase:'retry_wait',failures:Math.max(previous.failures,current.failures),
      nextAttemptAt:Math.max(previous.nextAttemptAt??0,current.nextAttemptAt??0)};
  }
  private restoredState():SyncState {
    if(this.session.networkState().updateRequired) return {phase:'update_required',failures:0,nextAttemptAt:null};
    if(this.session.networkState().vaultUnavailable) return {phase:'paused',failures:0,nextAttemptAt:null};
    if(this.session.databaseRecovery()) return {phase:'paused',failures:0,nextAttemptAt:null};
    if(!this.key||this.session.access().mode==='read_only') return idle();
    const retry=this.session.account().retryState();
    if(retry.failedCount>0) return {phase:'failed',failures:retry.failures,nextAttemptAt:null};
    return retry.nextAttemptAt===null?idle():{phase:'retry_wait',failures:retry.failures,nextAttemptAt:retry.nextAttemptAt};
  }
  private ready() {return !this.stopped&&this.environment.active&&this.environment.online;}
  update(environment:SyncEnvironment) {
    const wasReady=this.ready();this.environment=environment;this.notify();
    if(!this.ready()) for(const lane of Object.values(this.lanes)) {lane.cancel?.();lane.cancel=null;}
    else if(!wasReady) {this.kick('sync');this.kick('revocations');}
  }
  status() {return {sync:{...this.lanes.sync.state},revocations:{...this.lanes.revocations.state}};}
  retry() {
    if(this.stopped) return;
    for(const name of ['sync','revocations'] as const) {
      const lane=this.lanes[name];
      if(lane.running||!['idle','failed'].includes(lane.state.phase)) continue;
      if(name==='sync'&&this.key&&this.session.access().mode==='read_write') this.session.account().retryFailed();
      lane.state=idle();this.kick(name);
    }
  }
  private kick(name:'sync'|'revocations') {void this.run(name);}
  private async run(name:'sync'|'revocations') {
    const lane=this.lanes[name];
    if(!this.ready()||lane.running) return;
    const network=this.session.networkState();
    if(network.updateRequired||network.vaultUnavailable) return;
    if(name==='sync'&&!network.key||name==='revocations'&&!network.revocations) return;
    if(!['idle','retry_wait','paused'].includes(lane.state.phase)) return;
    lane.cancel?.();lane.cancel=null;
    if(lane.state.nextAttemptAt!==null&&lane.state.nextAttemptAt>this.clock.now()) {
      lane.cancel=this.clock.schedule(Math.min(lane.state.nextAttemptAt-this.clock.now(),2147483647),()=>this.kick(name));return;
    }
    const epoch=lane.epoch,key=network.key;
    lane.running=true;lane.state={...lane.state,phase:'running',nextAttemptAt:null};
    this.notify();
    let delay:number|null=name==='sync'?300000:null;
    try {
      if(name==='sync') {
        const pending=await this.session.synchronize(this.origin,this.clock.now,()=>this.ready()&&this.session.networkState().key===key);
        if(this.stopped||epoch!==lane.epoch) return;
        if(pending&&pending.failedCount>0) lane.state={phase:'failed',failures:pending.failures,nextAttemptAt:null};
        else if(pending?.nextAttemptAt!==null&&pending?.nextAttemptAt!==undefined) {
          delay=Math.max(0,pending.nextAttemptAt-this.clock.now());lane.state={phase:'retry_wait',failures:pending.failures,nextAttemptAt:pending.nextAttemptAt};
        } else lane.state=idle();
      } else {
        await this.session.flushRevocations(()=>this.ready());
        if(this.stopped||epoch!==lane.epoch) return;
        lane.state=idle();
      }
    } catch(error) {
      if(this.stopped||epoch!==lane.epoch) return;
      const kind=failureKind(error);
      const pending=name==='sync'&&this.key?this.session.account().retryState():null;
      const failures=Math.max(lane.state.failures+1,pending?.failures??0);
      if(kind==='retry'&&failures<10) {
        delay=Math.max(retryDelay(failures,error,this.clock.now()),(pending?.nextAttemptAt??0)-this.clock.now());
        lane.state={phase:'retry_wait',failures,nextAttemptAt:this.clock.now()+delay,lastFailure:error instanceof Error&&'status' in error&&error.status===429?'rate_limit':error instanceof Error&&'status' in error&&typeof error.status==='number'&&error.status>=500?'unavailable':'connection'};
      } else lane.state={phase:kind==='retry'?'failed':kind,failures:kind==='paused'?lane.state.failures:failures,nextAttemptAt:null};
    } finally {
      lane.running=false;this.notify();
      if(this.ready()) {
        if(epoch!==lane.epoch) this.kick(name);
        else if(delay!==null&&['idle','retry_wait'].includes(lane.state.phase))
          lane.cancel=this.clock.schedule(Math.min(delay,2147483647),()=>this.kick(name));
      }
    }
  }
  dispose() {
    this.stopped=true;this.unsubscribe();
    for(const lane of Object.values(this.lanes)) {lane.cancel?.();lane.cancel=null;}
  }
}
