import { entityKey, type Command, type Entity, type Operation, type PushResult, type Pull } from '../../../app/src/core/sync/protocol.ts';
import type { Correction } from '../../../app/src/core/db/account-store.ts';
import { liveQuery } from 'dexie';
import { AccountData, type AtCut } from './account.ts';
import { MainDatabase, check } from './database.ts';
import { Coordinator, assertOwner } from './coordinator.ts';
import { decimal, type Compatibility, type Control, type Journal, type Lease, type Owner } from './records.ts';
export type PublicSession={contextId:string;installationId:string;accountId:string;ownerEpoch:string;ownerTabId:string;profile:Extract<Entity,{kind:'profile'}>['value']};
export class LocalRepository {
  constructor(readonly db:MainDatabase, readonly coordinator:Coordinator, readonly build:string) {}
  async open(installationId:string) {
    this.db.on('populate',tx=>tx.table('installation_control').add({singleton:1,installation_id:installationId,schema_version:1,session_state:'locked',session_generation:0,selected_account_id:null,selected_context_id:null,owner_tab_id:null,owner_epoch:'0'} satisfies Control));
    await this.coordinator.gate(async()=>{
      await this.db.open();
      await this.db.transaction('rw',this.db.installation_control,this.db.build_compatibility,async()=>{
        check('Control',await this.db.installation_control.get(1));
        const key=this.buildKey();if(!await this.db.build_compatibility.get(key)) await this.db.build_compatibility.add({build_id:this.build,protocol_version:'m1.1',schema_version:1,state:'unknown',checked_at:null});
      });
    });
  }
  private buildKey():[string,string,number] {return [this.build,'m1.1',1];}
  private async control(owner?:Owner,write=false) {
    this.coordinator.assertPresent();const control=await this.db.installation_control.get(1);check('Control',control);
    if(owner) {if(owner.tab!==this.coordinator.tab) throw new Error('owner_lost');assertOwner(control,owner);}
    const compatibility=await this.db.build_compatibility.get(this.buildKey());check('Compatibility',compatibility);
    if(write&&compatibility.state!=='compatible') throw new Error('update_required');
    return control;
  }
  private session<T>(owner:Owner,work:(control:Control,owner:Owner)=>Promise<T>,compatible=true) {
    owner=Object.freeze({...owner});
    return this.coordinator.gate(()=>this.db.transaction('rw',this.db.tables,async()=>work(await this.control(owner,compatible),owner)));
  }
  setCompatibility(owner:Owner,state:Compatibility['state'],at:string) {
    return this.session(owner,async()=>{const value:Compatibility={build_id:this.build,protocol_version:'m1.1',schema_version:1,state,checked_at:at};check('Compatibility',value);await this.db.build_compatibility.put(value);},false);
  }
  requireUpgrade(lease:Lease,at:string) {
    lease=Object.freeze({...lease});
    return this.coordinator.gate(()=>this.db.transaction('rw',this.db.tables,async()=>{
      await this.guard(lease,true);
      await this.db.build_compatibility.put({build_id:this.build,protocol_version:'m1.1',schema_version:1,state:'upgrade_required',checked_at:at});
    }));
  }
  async lease():Promise<Lease> {
    return this.db.transaction('r',this.db.tables,async()=>{
      const c=await this.control();if(c.session_state!=='active'||!c.selected_account_id||!c.selected_context_id||!c.owner_tab_id) throw new Error('session_locked');
      return Object.freeze({installation:c.installation_id,account:c.selected_account_id,context:c.selected_context_id,generation:c.session_generation,tab:c.owner_tab_id,epoch:c.owner_epoch});
    });
  }
  private async guard(lease:Lease,write:boolean) {
    const c=await this.control(write?lease:undefined,write);
    if(c.installation_id!==lease.installation||c.session_state!=='active'||c.selected_account_id!==lease.account||c.selected_context_id!==lease.context||c.session_generation!==lease.generation) throw new Error('session_locked');
    const account=await this.db.account_storage.get(lease.account);check('Account',account);if(account.state!=='ready') throw new Error('account_blocked');
    const journal=await this.db.auth_journal.where('context_id').equals(lease.context).first();check('AuthJournal',journal);
    if(journal.installation_id!==lease.installation||journal.account_id!==lease.account||!['active','terminal'].includes(journal.phase)) throw new Error('storage_unreadable');
    return c;
  }
  observeSelection(stamp:Lease,invalidate:()=>void) {
    stamp=Object.freeze({...stamp});
    // Observe only the authoritative singleton; no unfiltered domain subscription.
    // Notifications are hints. Foreground presentation still performs a guarded read.
    const subscription=liveQuery(()=>this.db.installation_control.get(1)).subscribe({
      next:value=>{
        try {
          check('Control',value);
          if(value.session_state!=='active'||value.installation_id!==stamp.installation||value.selected_account_id!==stamp.account||value.selected_context_id!==stamp.context||value.session_generation!==stamp.generation||value.owner_tab_id!==stamp.tab||value.owner_epoch!==stamp.epoch) invalidate();
        }catch {invalidate();}
      },error:()=>invalidate(),
    });
    return ()=>subscription.unsubscribe();
  }
  async assertCurrent(lease:Lease) {lease=Object.freeze({...lease});await this.db.transaction('r',this.db.tables,async()=>{await this.guard(lease,true);});}
  private async load(lease:Lease) {
    for(const row of await this.db.projected_views.where('account_id').equals(lease.account).toArray()) check('Projection',row);
    const state=await this.db.sync_state.get(lease.account);check('SyncState',state);
    return new AccountData(lease.account,lease.installation,state,await this.db.canonical_entities.where('account_id').equals(lease.account).toArray(),await this.db.sync_mutations.where('account_id').equals(lease.account).toArray());
  }
  private async save(data:AccountData) {
    const view=data.rebuild();check('SyncState',data.state);
    await this.db.sync_state.put(data.state);
    await this.db.canonical_entities.where('account_id').equals(data.account).delete();
    await this.db.canonical_entities.bulkPut(data.base);
    await this.db.sync_mutations.bulkPut(data.rows);
    await this.db.projected_views.where('account_id').equals(data.account).delete();
    await this.db.projected_views.bulkPut([...view.habits.map(h=>({account_id:data.account,kind:'habit' as const,entity_key:h.habitId,payload:h})),{account_id:data.account,kind:'xp',entity_key:'total',payload:{totalXp:view.totalXp}}]);
  }
  private account<T>(lease:Lease,work:(data:AccountData,lease:Lease)=>Promise<T>|T) {
    lease=Object.freeze({...lease});
    return this.coordinator.gate(()=>this.db.transaction('rw',this.db.tables,async()=>{
      await this.guard(lease,true);const data=await this.load(lease);const result=await work(data,lease);await this.save(data);return result;
    }));
  }
  enqueue(lease:Lease,command:Command,id:string,at:string) {command=structuredClone(command);return this.account(lease,data=>data.enqueue(command,id,at));}
  correct(lease:Lease,requests:Correction[]) {requests=structuredClone(requests);return this.account(lease,data=>data.correct(requests));}
  recoverAttempts(lease:Lease) {return this.account(lease,data=>data.recoverAttempts());}
  async read(lease:Lease,day:string) {
    lease=Object.freeze({...lease});
    return this.db.transaction('r',this.db.tables,async()=>{
      const c=await this.guard(lease,false),data=await this.load(lease);
      return {view:data.view(day),operations:structuredClone(data.rows),state:data.state,stamp:{...lease,tab:c.owner_tab_id!,epoch:c.owner_epoch}};
    });
  }
  beginAttempt(lease:Lease,now:number) {return this.account(lease,async(data,lease)=>{
    const journal=await this.db.auth_journal.where('context_id').equals(lease.context).first();if(journal?.phase!=='active') throw new Error('authentication_required');
    return data.beginAttempt(now);
  });}
  retry(lease:Lease,batch:Operation[],error:unknown,now:number) {batch=structuredClone(batch);return this.account(lease,data=>data.retry(batch,error,now));}
  applyAck(lease:Lease,batch:Operation[],results:PushResult[],now:number) {
    batch=structuredClone(batch);results=structuredClone(results);
    return this.account(lease,data=>{
      const expected=new Set(batch.map(op=>op.operationId));
      for(const result of results) if(!expected.delete('receipt' in result?result.receipt.operationId:result.operationId)) throw new Error('ack_mismatch');
      if(expected.size) throw new Error('ack_mismatch');data.ack(results,now);
    });
  }
  applyPull(lease:Lease,expectedCursor:string|null,page:Pull) {page=structuredClone(page);return this.account(lease,data=>{if(data.state.cursor!==expectedCursor) throw new Error('pull_mismatch');data.pull(page);});}
  beginSnapshot(lease:Lease,id:string,revision:string,cursor:string,expires:string) {return this.account(lease,async(data,lease)=>{
    decimal(revision);await this.db.snapshot_staging.where('account_id').equals(lease.account).delete();
    Object.assign(data.state,{snapshot_id:id,snapshot_revision:revision,snapshot_cursor:cursor,snapshot_expires_at:expires});
  });}
  stageSnapshot(lease:Lease,id:string,cursor:string,entities:Entity[],next:string|null) {entities=structuredClone(entities);return this.account(lease,async(data,lease)=>{
    if(data.state.snapshot_id!==id||data.state.snapshot_cursor!==cursor) throw new Error('snapshot_mismatch');
    for(const payload of entities) {
      if(decimal(payload.value.revision)>decimal(data.state.snapshot_revision!)) throw new Error('snapshot_mismatch');
      const row={account_id:lease.account,snapshot_id:id,kind:payload.kind,entity_key:entityKey(payload),revision:payload.value.revision,payload};
      check('Staging',row);await this.db.snapshot_staging.add(row);
    }
    data.state.snapshot_cursor=next;
  });}
  receiptIds(lease:Lease) {lease=Object.freeze({...lease});return this.db.transaction('r',this.db.tables,async()=>{await this.guard(lease,false);return (await this.load(lease)).receiptIds();});}
  installSnapshot(lease:Lease,id:string,count:number,classification:AtCut[],cursor:string) {classification=structuredClone(classification);return this.account(lease,async(data,lease)=>{
    const staged=await this.db.snapshot_staging.where('[account_id+snapshot_id]').equals([lease.account,id]).toArray();
    if(data.state.snapshot_id!==id||data.state.snapshot_cursor!==null||staged.length!==count) throw new Error('incomplete_snapshot');
    const byId=new Map(classification.map(item=>[item.operationId,item]));
    if(byId.size!==classification.length||data.receiptIds().some(op=>!byId.has(op))) throw new Error('incomplete_classification');
    for(const item of classification) if(item.status!=='notProcessedAtH'&&item.status!=='rejected'&&decimal(item.acceptedRevision)>decimal(data.state.snapshot_revision!)) throw new Error('snapshot_mismatch');
    data.base.length=0;
    for(const row of staged) {check('Staging',row);data.incorporate(row.payload);}
    for(const item of classification) if(item.status!=='notProcessedAtH') data.recognize(item);
    Object.assign(data.state,{cursor,snapshot_id:null,snapshot_revision:null,snapshot_cursor:null,snapshot_expires_at:null});
    await this.db.snapshot_staging.where('account_id').equals(lease.account).delete();
  });}
  startAuth(owner:Owner,attempt:string,expected:string|null) {return this.session(owner,async(c,owner)=>{
    const journals=await this.db.auth_journal.toArray();for(const j of journals) check('AuthJournal',j);
    if(journals.filter(j=>j.phase!=='terminal').length>=4) throw new Error('auth_context_limit');
    const row:Journal={attempt_id:attempt,context_id:null,installation_id:c.installation_id,expected_account_id:expected,account_id:null,session_generation:c.session_generation,owner_epoch:owner.epoch,owner_tab_id:owner.tab,prepare_dispatched:false,phase:'challenging',reservation_expires_at:null,close_cookie_expires_at:null,terminal_proof:null};
    check('AuthJournal',row);await this.db.auth_journal.add(row);return row;
  });}
  private async journal(c:Control,attempt:string) {
    const j=await this.db.auth_journal.get(attempt);check('AuthJournal',j);
    if(j.installation_id!==c.installation_id||j.session_generation!==c.session_generation||j.owner_epoch!==c.owner_epoch||j.owner_tab_id!==c.owner_tab_id) throw new Error('stale_auth_attempt');return j;
  }
  recordChallenge(owner:Owner,attempt:string,context:string,reservation:string,close:string) {return this.session(owner,async c=>{
    const j=await this.journal(c,attempt);if(j.phase!=='challenging') throw new Error('stale_auth_attempt');
    await this.db.auth_journal.put({...j,context_id:context,phase:'preparing',reservation_expires_at:reservation,close_cookie_expires_at:close});
  });}
  prepareDispatched(owner:Owner,attempt:string) {return this.session(owner,async c=>{
    const j=await this.journal(c,attempt);if(j.phase!=='preparing'||j.prepare_dispatched) throw new Error('stale_auth_attempt');await this.db.auth_journal.put({...j,prepare_dispatched:true});
  });}
  confirmReservation(owner:Owner,attempt:string) {return this.session(owner,async c=>{
    const j=await this.journal(c,attempt);if(j.phase!=='preparing'||!j.prepare_dispatched) throw new Error('reservation_unconfirmed');await this.db.auth_journal.put({...j,phase:'reserved'});
  });}
  activate(owner:Owner,attempt:string,session:PublicSession) {session=structuredClone(session);return this.session(owner,async(c,owner)=>{
    const j=await this.journal(c,attempt);
    if(j.phase!=='reserved'||j.context_id!==session.contextId||session.installationId!==c.installation_id||session.ownerEpoch!==owner.epoch||session.ownerTabId!==owner.tab||j.expected_account_id&&j.expected_account_id!==session.accountId||session.profile.accountId!==session.accountId) throw new Error('account_mismatch');
    if(c.session_generation>=Number.MAX_SAFE_INTEGER) throw new Error('generation_exhausted');
    if(c.selected_context_id&&c.selected_context_id!==j.context_id) {
      const previous=await this.db.auth_journal.where('context_id').equals(c.selected_context_id).first();check('AuthJournal',previous);
      if(previous.phase==='active') await this.db.auth_journal.put({...previous,phase:'close_pending'});
    }
    const existing=await this.db.account_storage.get(session.accountId);if(existing) {check('Account',existing);if(existing.state==='blocked') throw new Error('account_blocked');}
    else {await this.db.account_storage.add({account_id:session.accountId,state:'ready'});await this.db.sync_state.add({account_id:session.accountId,cursor:null,next_sequence:1,onboarding_step:'time_context',snapshot_id:null,snapshot_revision:null,snapshot_cursor:null,snapshot_expires_at:null});}
    const generation=c.session_generation+1;
    await this.db.auth_journal.put({...j,account_id:session.accountId,phase:'active',session_generation:generation});
    await this.db.installation_control.put({...c,session_state:'active',session_generation:generation,selected_account_id:session.accountId,selected_context_id:session.contextId});
    const lease:Lease={...owner,installation:c.installation_id,account:session.accountId,context:session.contextId,generation};
    const data=await this.load(lease);data.incorporate({kind:'profile',value:session.profile});data.recoverAttempts();await this.save(data);return Object.freeze(lease);
  });}
  logout(lease:Lease) {return this.account(lease,async(_data,lease)=>{
    const c=await this.control(lease,true);if(c.session_generation>=Number.MAX_SAFE_INTEGER) throw new Error('generation_exhausted');
    const j=await this.db.auth_journal.where('context_id').equals(lease.context).first();check('AuthJournal',j);
    if(j.phase==='active') await this.db.auth_journal.put({...j,phase:'close_pending'});
    await this.db.installation_control.put({...c,session_state:'locked',session_generation:c.session_generation+1,selected_account_id:null,selected_context_id:null});
  });}
  resolveJournal(owner:Owner,attempt:string,proof:NonNullable<Journal['terminal_proof']>) {return this.session(owner,async c=>{
    const j=await this.db.auth_journal.get(attempt);check('AuthJournal',j);
    if(j.installation_id!==c.installation_id||j.phase==='terminal') throw new Error('stale_auth_attempt');
    if(proof==='not_dispatched'&&(j.prepare_dispatched||j.account_id)||['expired_unbound','closed_unbound'].includes(proof)&&j.account_id!==null||proof!=='not_dispatched'&&!j.context_id) throw new Error('invalid_terminal_proof');
    // This input is a verified response from the context capability/original-account recovery,
    // or local proof that prepare was never dispatched. A transport 404 is never a proof.
    await this.db.auth_journal.put({...j,phase:'terminal',terminal_proof:proof});
  });}
  close() {this.db.close();}
}
