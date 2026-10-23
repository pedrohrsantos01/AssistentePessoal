import Dexie from 'dexie';
import { MainDatabase, mainStores, check } from '../local/database.ts';
import { Coordinator, assertOwner } from '../local/coordinator.ts';
import { LocalRepository, type PublicSession } from '../local/repository.ts';
import { Remote } from '../local/remote.ts';
import { decodeWire } from '../local/wire.ts';
import { uuid7 } from '../local/ids.ts';
import type { Control, Owner, Lease, Journal, Compatibility } from '../local/records.ts';
import { pt } from '../i18n/pt-BR.ts';
import { getDayKey } from '../../../app/src/features/gamification/domain/day-key.ts';
export const timeContext={timezone:'America/Sao_Paulo',dayStartHour:4};
type Read=Awaited<ReturnType<LocalRepository['read']>>;
type Challenge={attemptId:string;installationId:string;contextId:string;preparationTicket:string;reservationExpiresAt:string;closeCookieExpiresAt:string};
type Terminal={contextId:string;state:'closed'|'expired'};
export class ManualController {
  owner:Owner|null=null;lease:Lease|null=null;read:Read|null=null;waitingMigration=false;compatibility:Compatibility['state']='unknown';
  private selected:Pick<Lease,'account'|'context'|'generation'>|null=null;
  private stopObserving:(()=>void)|undefined;
  private releaseGate:(()=>void)|undefined;
  constructor(readonly repo:LocalRepository,private changed:(invalidated?:boolean)=>void,private request:typeof fetch=(input,init)=>globalThis.fetch(input,init)) {}
  get coordinator() {return this.repo.coordinator;}
  get writable() {return this.compatibility==='compatible'&&!!this.owner&&this.owner.tab===this.coordinator.tab;}
  get holding() {return !!this.releaseGate;}
  invalidate() {this.read=null;this.changed(true);}
  async open() {
    await this.coordinator.start();await this.repo.open(uuid7());await this.take(false);
  }
  async take(explicit=true) {
    this.owner=await this.coordinator.acquire(this.repo.db,explicit);
    if(this.owner) {
      const value=await this.repo.db.build_compatibility.get([this.repo.build,'m1.1',1]);check('Compatibility',value);
      if(value.state==='unknown') await this.repo.setCompatibility(this.owner,'compatible',new Date().toISOString());
    }
    await this.refresh();
  }
  async control() {const c=await this.repo.db.installation_control.get(1);check('Control',c);return c;}
  private async capture() {
    if(!this.owner) throw new Error('owner_lost');const owner={...this.owner},c=await this.control();assertOwner(c,owner);
    return {...owner,installation:c.installation_id,generation:c.session_generation};
  }
  private async fence(stamp:Owner&{installation:string;generation:number}) {
    this.coordinator.assertPresent();const c=await this.control();assertOwner(c,stamp);
    if(c.installation_id!==stamp.installation||c.session_generation!==stamp.generation) throw new Error('session_locked');
    const build=await this.repo.db.build_compatibility.get([this.repo.build,'m1.1',1]);check('Compatibility',build);
    if(build.state!=='compatible') throw new Error('update_required');
  }
  private async post<T>(stamp:Awaited<ReturnType<ManualController['capture']>>,path:string,body:unknown,schema:string) {
    await this.fence(stamp);
    const r=await this.request('/api/v1/web'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Ritmo-Web':'1','X-App-Version':'0.1.0','X-Ritmo-Protocol':'m1.1','X-Ritmo-Owner-Epoch':stamp.epoch,'X-Ritmo-Owner-Tab':stamp.tab},body:JSON.stringify(body)});
    await this.fence(stamp);
    if(!r.ok) {
      if(r.status===426) await this.repo.setCompatibility(stamp,'upgrade_required',new Date().toISOString());
      throw Object.assign(new Error('remote_failed'),{status:r.status});
    }
    const value:unknown=await r.json();const decoded=decodeWire<T>(schema,value);await this.fence(stamp);return decoded;
  }
  private async confirmClose(stamp:Awaited<ReturnType<ManualController['capture']>>,context:string) {
    const proof=await this.post<{contextId:string;installationId:string}>(stamp,`/contexts/${context}/confirm-reservation`,{},'PreparationReceipt');
    if(proof.contextId!==context||proof.installationId!==stamp.installation)throw new Error('reservation_unconfirmed');
  }
  async journals() {const c=await this.control();const rows=await this.repo.db.auth_journal.toArray();for(const j of rows) {check('AuthJournal',j);if(j.installation_id!==c.installation_id) throw new Error('storage_unreadable');}return rows.filter(j=>j.phase!=='terminal');}
  async refresh() {
    try {
    const compatibility=await this.repo.db.build_compatibility.get([this.repo.build,'m1.1',1]);check('Compatibility',compatibility);this.compatibility=compatibility.state;
    const c=await this.control();if(this.owner&&(this.owner.tab!==c.owner_tab_id||this.owner.epoch!==c.owner_epoch)) this.owner=null;
    this.stopObserving?.();this.stopObserving=undefined;
    if(c.session_state!=='active') {this.lease=null;this.invalidate();return;}
    const lease=await this.repo.lease();
    if(this.selected&&(lease.account!==this.selected.account||lease.context!==this.selected.context||lease.generation!==this.selected.generation)) {this.lease=null;this.invalidate();throw new Error('session_locked');}
    this.selected??={account:lease.account,context:lease.context,generation:lease.generation};
    const read=await this.repo.read(lease,getDayKey(new Date(),timeContext.timezone,timeContext.dayStartHour));
    this.lease=lease;this.read=read;this.stopObserving=this.repo.observeSelection(read.stamp,()=>this.invalidate());this.changed();
    }catch(error) {this.read=null;this.compatibility='unknown';this.changed(true);throw error;}
  }
  private current() {if(!this.lease||!this.owner||this.lease.tab!==this.owner.tab||this.lease.epoch!==this.owner.epoch) throw new Error('owner_lost');return this.lease;}
  private async pending() {const stamp=await this.capture();return {stamp,rows:await this.journals()};}
  async login(email:string,password:string,register:boolean) {
    const {stamp,rows}=await this.pending();if(this.lease) throw new Error('session_active');
    let journal=rows.find(j=>j.phase==='reserved'&&j.owner_tab_id===stamp.tab&&j.owner_epoch===stamp.epoch&&j.session_generation===stamp.generation);
    if(journal)await this.confirmClose(stamp,journal.context_id!);
    if(!journal) {
      if(rows.some(j=>['challenging','preparing','reserved','recovery_required'].includes(j.phase))) throw new Error('recovery_required');
      const attempt=uuid7();await this.repo.startAuth(stamp,attempt,null);
      const challenge=await this.post<Challenge>(stamp,'/auth/challenge',{attemptId:attempt,installationId:stamp.installation,expectedAccountId:null},'ChallengeResponse');
      if(challenge.attemptId!==attempt||challenge.installationId!==stamp.installation) throw new Error('account_mismatch');
      await this.repo.recordChallenge(stamp,attempt,challenge.contextId,challenge.reservationExpiresAt,challenge.closeCookieExpiresAt);
      await this.repo.prepareDispatched(stamp,attempt);
      await this.post(stamp,'/auth/prepare',{preparationTicket:challenge.preparationTicket},'PreparationReceipt');
      await this.confirmClose(stamp,challenge.contextId);
      await this.repo.confirmReservation(stamp,attempt);journal=(await this.journals()).find(j=>j.attempt_id===attempt)!;
    }
    await this.post(stamp,`/contexts/${journal.context_id}/${register?'register':'login'}`,{email,password,deviceId:stamp.installation,...(register?{displayName:pt.iphone.displayName}:{})},'WebSession');
    await this.inspect();
  }
  async inspect() {
    const {stamp,rows}=await this.pending();const j=rows.find(j=>j.phase==='reserved'&&j.owner_tab_id===stamp.tab&&j.owner_epoch===stamp.epoch&&j.session_generation===stamp.generation);
    if(!j?.context_id) throw new Error('recovery_required');
    const session=await this.post<PublicSession>(stamp,`/contexts/${j.context_id}/inspect`,{},'WebSession');
    this.lease=await this.repo.activate(stamp,j.attempt_id,session);this.selected={account:this.lease.account,context:this.lease.context,generation:this.lease.generation};await this.refresh();
  }
  async onboard() {await this.repo.enqueue(this.current(),{type:'profile.setOnboarding',timeContext,completed:false,analyticsConsent:false},uuid7(),new Date().toISOString());await this.refresh();}
  async create(title:string,quota=false) {
    if(!title.trim()||Array.from(title).length>120) throw new Error('title_required');
    const lease=this.current(),hook=()=>{throw new DOMException('fixture_quota','QuotaExceededError');};
    if(quota)this.repo.db.sync_state.hook('updating',hook);
    try {await this.repo.enqueue(lease,{type:'habit.create',habitId:uuid7(),title,habitType:'binary',scheduleKind:'daily',startDayKey:getDayKey(new Date(),timeContext.timezone,timeContext.dayStartHour),timeContext,iconKey:null,colorToken:null,sortOrder:0},uuid7(),new Date().toISOString());}
    finally {if(quota)this.repo.db.sync_state.hook('updating').unsubscribe(hook);}
    await this.refresh();
  }
  async mark(habitId:string) {
    const lease=this.current();if(!this.read?.view.habits.some(h=>h.habitId===habitId)) throw new Error('habit_unavailable');
    await this.repo.mark(lease,{type:'habit.mark',habitId,dayKey:getDayKey(new Date(),timeContext.timezone,timeContext.dayStartHour),timeContext},uuid7(),new Date().toISOString());await this.refresh();
  }
  async sync() {
    const lease=this.current(),remote=new Remote(this.repo,lease,this.request);await remote.claim();await this.repo.recoverAttempts(lease);await remote.push();await remote.pull();await this.refresh();
  }
  async logout() {await this.repo.logout(this.current());this.lease=null;this.selected=null;this.invalidate();}
  async resolveContexts() {
    const {stamp,rows}=await this.pending();
    for(const j of rows) {
      if(j.phase==='active')continue;
      if(!j.prepare_dispatched) {await this.fence(stamp);await this.repo.resolveJournal(stamp,j.attempt_id,'not_dispatched');continue;}
      try {
        const proof=await this.post<Terminal>(stamp,`/contexts/${j.context_id}/close`,{},'CloseReceipt');
        if(proof.contextId!==j.context_id) throw new Error('account_mismatch');await this.repo.resolveJournal(stamp,j.attempt_id,proof.state);
      } catch {
        const proof=await this.post<{contextId:string;state:string}>(stamp,`/contexts/${j.context_id}/reservation-status`,{},'ReservationProof');
        if(proof.contextId!==j.context_id||!['expired_unbound','closed_unbound'].includes(proof.state)) throw new Error('recovery_required');
        await this.repo.resolveJournal(stamp,j.attempt_id,proof.state as 'expired_unbound'|'closed_unbound');
      }
    }
  }
  async recover(attempt:string,email:string,password:string) {
    const {stamp,rows}=await this.pending(),j=rows.find(j=>j.attempt_id===attempt&&j.phase!=='active');if(!j?.context_id) throw new Error('recovery_required');
    const proof=await this.post<Terminal>(stamp,'/auth/recovery-close',{contextId:j.context_id,email,password},'CloseReceipt');
    if(proof.contextId!==j.context_id) throw new Error('account_mismatch');await this.repo.resolveJournal(stamp,j.attempt_id,'recovered');
  }
  async abortMigration() {
    const lease=this.current();await this.repo.assertCurrent(lease);
    const experimental=new Dexie(this.repo.db.name,{autoOpen:false});
    experimental.version(1).stores(mainStores);experimental.version(2).stores(mainStores).upgrade(async tx=>{
      const control=await tx.table('installation_control').get(1);check('Control',control);assertOwner(control,lease);
      if(control.session_generation!==lease.generation||control.selected_account_id!==lease.account||control.selected_context_id!==lease.context)throw new Error('session_locked');
      const state=await tx.table('sync_state').get(lease.account);check('SyncState',state);
      await tx.table('sync_state').update(lease.account,{next_sequence:state.next_sequence+1});
      throw new Error('fixture_upgrade_abort');
    });
    experimental.on('blocked',()=>{this.waitingMigration=true;this.changed();});
    try {
      await this.coordinator.gate(async()=>{
        await this.repo.assertCurrent(lease);
        try {await experimental.open();throw new Error('fixture_upgrade_unexpected');}
        catch(error) {if(!(error instanceof Error)||error.message!=='fixture_upgrade_abort')throw error;}
      });
    }finally {experimental.close();this.waitingMigration=false;}
    await this.repo.db.open();await this.refresh();
  }
  async hold() {
    const stamp=await this.capture();if(this.releaseGate)throw new Error('gate_held');
    let ready:()=>void=()=>{},failed:(error:unknown)=>void=()=>{};const entered=new Promise<void>((r,j)=>{ready=r;failed=j;});
    void this.coordinator.gate(async()=>{await this.fence(stamp);await new Promise<void>(release=>{this.releaseGate=release;ready();});this.releaseGate=undefined;this.changed();}).catch(failed);await entered;this.changed();
  }
  release() {this.releaseGate?.();}
  close() {this.release();this.stopObserving?.();this.repo.close();void this.coordinator.stop();}
}
export function createManual(build:string,changed:(invalidated?:boolean)=>void) {const coordinator=new Coordinator(uuid7(),navigator.locks);return new ManualController(new LocalRepository(new MainDatabase('ritmo-main',()=>changed()),coordinator,build),changed);}
export type { Journal, Control };
