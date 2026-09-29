import { sql } from 'drizzle-orm';
import {retryDelay} from '../sync/retry.ts';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { project } from '../../features/habits/domain/project.ts';
import { entityKey } from '../sync/protocol.ts';
import type { Command, Entity, Operation, PushResult, Receipt, Pull } from '../sync/protocol.ts';

export type LocalDatabase = BaseSQLiteDatabase<'sync', unknown>;
type Payload = {payload:string};
type Pending = {envelope:string;status:string};
export type Correction={operationId:string;replacementId:string;command?:Command;occurredAt?:string};
export type RecoveryResolution={kind:'discarded'}|{kind:'corrected';replacementOperationId:string};
type RecoveryError={code:string;fields:{path:string;code:string}[];dependencyIds:string[];resolution?:RecoveryResolution};
export type RecoveryItem={operation:Operation;source:'server'|'local';error:Omit<RecoveryError,'resolution'>;resolution:RecoveryResolution|null};
export class AccountStore {
  constructor(private db:LocalDatabase,readonly accountId:string,readonly deviceId:string,private shutdown:()=>void,private guard:(write?:boolean)=>void=()=>{}) {
    this.guard();
    db.transaction(tx=>{
      const owner=tx.get<{account_id:string}>(sql`select account_id from account_storage`);
      if(owner&&owner.account_id!==accountId) throw new Error('account_store_mismatch');
      tx.run(sql`insert into account_storage(account_id) values(${accountId}) on conflict do nothing`);
      tx.run(sql`insert into sync_state(account_id,next_sequence,onboarding_step) values(${accountId},1,'time_context') on conflict do nothing`);
      tx.run(sql`update sync_mutations set status=case when attempts>=10 then 'blocked_local' else 'retry_wait' end,
        error=case when attempts>=10 then ${JSON.stringify({code:'retry_exhausted'})} else error end
        where account_id=${accountId} and status='in_flight'`);
      this.rebuild(tx);
    });
  }
  private base(db=this.db):Entity[] {
    return db.all<Payload>(sql`select payload from canonical_entities where account_id=${this.accountId}`).map(r=>JSON.parse(r.payload) as Entity);
  }
  private pending(db=this.db):Operation[] {
    return db.all<Pending>(sql`select envelope,status from sync_mutations where account_id=${this.accountId} and (status in ('pending','in_flight','retry_wait','deferred') or (status='blocked_local' and json_extract(error,'$.code')='retry_exhausted')) order by client_sequence`)
      .map(r=>JSON.parse(r.envelope) as Operation);
  }
  enqueue(command:Command,operationId:string,occurredAt:string):Operation {
    this.guard(true);
    return this.db.transaction(tx=>{
      const state=tx.get<{next_sequence:number}>(sql`select next_sequence from sync_state where account_id=${this.accountId}`);
      if(!state||state.next_sequence>=Number.MAX_SAFE_INTEGER) throw new Error('sequence_exhausted');
      const previous=this.pending(tx);
      const dependsOn=previous.filter(op=>'habitId' in command && 'habitId' in op.command && op.command.habitId===command.habitId).map(op=>op.operationId);
      const operation:Operation={operationId,deviceId:this.deviceId,clientSequence:state.next_sequence,occurredAt,dependsOn,command};
      tx.run(sql`insert into sync_mutations(account_id,operation_id,device_id,client_sequence,envelope,dependencies,status)
        values(${this.accountId},${operationId},${this.deviceId},${state.next_sequence},${JSON.stringify(operation)},${JSON.stringify(dependsOn)},'pending')`);
      tx.run(sql`update sync_state set next_sequence=next_sequence+1 where account_id=${this.accountId}`);
      // The durable intent and the rebuilt projection commit together.
      this.rebuild(tx);
      return operation;
    });
  }
  private blockDependents(db:LocalDatabase) {
    const rows=db.all<{envelope:string;status:string;error:string|null}>(sql`select envelope,status,error from sync_mutations where account_id=${this.accountId} order by client_sequence`);
    for(const row of rows) {
      const operation=JSON.parse(row.envelope) as Operation;
      const paths=[...(operation.dependsOn.length>4096?['dependsOn']:[]),
        ...(operation.command.type==='habit.mark'&&operation.command.observedUndoIds.length>4096?['command.observedUndoIds']:[])];
      if(row.status!=='pending'||!paths.length) continue;
      row.status='blocked_local';row.error=JSON.stringify({code:'context_limit_reached',fields:paths.map(path=>({path,code:'context_limit_reached'})),dependencyIds:[]});
      db.run(sql`update sync_mutations set status='blocked_local',next_attempt_at=null,error=${row.error}
        where account_id=${this.accountId} and operation_id=${operation.operationId}`);
    }
    const blocked=new Set(rows.filter(row=>row.status==='rejected'||row.status==='blocked_local'&&(JSON.parse(row.error??'{}') as Partial<RecoveryError>).code!=='retry_exhausted')
      .map(row=>(JSON.parse(row.envelope) as Operation).operationId));
    let changed=true;
    while(changed) {
      changed=false;
      for(const row of rows) {
        const operation=JSON.parse(row.envelope) as Operation;
        if(row.status==='acknowledged'||blocked.has(operation.operationId)) continue;
        const dependencyIds=operation.dependsOn.filter(id=>blocked.has(id));
        if(!dependencyIds.length) continue;
        const error:RecoveryError={code:'dependency_rejected',fields:[],dependencyIds};
        db.run(sql`update sync_mutations set status='blocked_local',next_attempt_at=null,error=${JSON.stringify(error)}
          where account_id=${this.accountId} and operation_id=${operation.operationId}`);
        blocked.add(operation.operationId);changed=true;
      }
    }
  }
  recovery():RecoveryItem[] {
    this.guard();
    return this.db.all<{envelope:string;status:string;error:string}>(sql`select envelope,status,error from sync_mutations
      where account_id=${this.accountId} and (status='rejected' or (status='blocked_local' and json_extract(error,'$.code')!='retry_exhausted')) order by client_sequence`)
      .map(row=>{const error=JSON.parse(row.error) as RecoveryError;return {operation:JSON.parse(row.envelope) as Operation,
        source:row.status==='rejected'?'server':'local',error:{code:error.code,fields:error.fields??[],dependencyIds:error.dependencyIds??[]},resolution:error.resolution??null};});
  }
  discard(operationIds:string[]) {
    this.guard(true);
    this.db.transaction(tx=>{
      const items=new Map(this.recovery().map(item=>[item.operation.operationId,item]));
      for(const id of operationIds) {
        const item=items.get(id);
        if(!item||item.resolution?.kind==='corrected'||item.error.code==='id_content_conflict') throw new Error('operation_not_recoverable');
        tx.run(sql`update sync_mutations set error=json_set(error,'$.resolution',json(${JSON.stringify({kind:'discarded'})}))
          where account_id=${this.accountId} and operation_id=${id}`);
      }
      this.rebuild(tx);
    });
  }
  correct(corrections:Correction[]):Operation[] {
    this.guard(true);
    return this.db.transaction(tx=>{
      const history=this.recovery(),byId=new Map(history.map(item=>[item.operation.operationId,item]));
      const selected=new Map(corrections.map(item=>[item.operationId,item]));
      if(selected.size!==corrections.length||new Set(corrections.map(item=>item.replacementId)).size!==corrections.length) throw new Error('duplicate_correction');
      const mapping=new Map(history.flatMap(item=>item.resolution?.kind==='corrected'?[[item.operation.operationId,item.resolution.replacementOperationId] as const]:[]));
      for(const correction of corrections) {
        const original=byId.get(correction.operationId);
        if(!original||original.resolution?.kind==='corrected'||original.error.code==='id_content_conflict') throw new Error('operation_not_recoverable');
        if(tx.get(sql`select operation_id from sync_mutations where account_id=${this.accountId} and operation_id=${correction.replacementId}`)) throw new Error('replacement_id_in_use');
        mapping.set(correction.operationId,correction.replacementId);
      }
      const remap=(id:string):string=>{const seen=new Set<string>();while(mapping.has(id)) {
        if(seen.has(id)) throw new Error('dependency_cycle');seen.add(id);id=mapping.get(id)!;
      }return id;};
      const habits=new Map<string,string>();
      for(const item of history) {
        if(item.operation.command.type!=='habit.create'||!mapping.has(item.operation.operationId)) continue;
        const target=remap(item.operation.operationId),request=corrections.find(correction=>correction.replacementId===target);
        const row=tx.get<Payload>(sql`select envelope as payload from sync_mutations where account_id=${this.accountId} and operation_id=${target}`);
        const command=request?(request.command??byId.get(request.operationId)!.operation.command):row?(JSON.parse(row.payload) as Operation).command:null;
        if(command?.type==='habit.create'&&command.habitId!==item.operation.command.habitId) habits.set(item.operation.command.habitId,command.habitId);
      }
      const ordered=corrections.slice().sort((a,b)=>byId.get(a.operationId)!.operation.clientSequence-byId.get(b.operationId)!.operation.clientSequence);
      const replacements:Operation[]=[];
      let sequence=tx.get<{next_sequence:number}>(sql`select next_sequence from sync_state where account_id=${this.accountId}`)!.next_sequence;
      for(const correction of ordered) {
        const original=byId.get(correction.operationId)!.operation;
        if(sequence>=Number.MAX_SAFE_INTEGER) throw new Error('sequence_exhausted');
        let command=correction.command??original.command;
        if(command.type!==original.command.type) throw new Error('correction_type_mismatch');
        if(command.type!=='habit.create'&&'habitId' in command) {
          let habitId=command.habitId;const seen=new Set<string>();
          while(habits.has(habitId)) {if(seen.has(habitId)) throw new Error('dependency_cycle');seen.add(habitId);habitId=habits.get(habitId)!;}
          command={...command,habitId};
        }
        if(command.type==='habit.mark') {
          const observedUndoIds=command.observedUndoIds.map(remap),retained=new Set(observedUndoIds);
          if(original.command.type==='habit.mark'&&original.command.observedUndoIds.some(id=>!retained.has(remap(id)))) throw new Error('context_truncation_forbidden');
          command={...command,observedUndoIds};
        }
        const dependsOn=new Set(original.dependsOn.map(remap));
        if(command.type==='habit.mark') for(const id of command.observedUndoIds) {
          if(corrections.some(item=>item.replacementId===id)||tx.get(sql`select operation_id from sync_mutations where account_id=${this.accountId} and operation_id=${id} and status!='acknowledged'`)) dependsOn.add(id);
        }
        const operation:Operation={...original,operationId:correction.replacementId,deviceId:this.deviceId,clientSequence:sequence++,
          occurredAt:correction.occurredAt??original.occurredAt,dependsOn:[...dependsOn],command,supersedesOperationId:original.operationId};
        tx.run(sql`insert into sync_mutations(account_id,operation_id,device_id,client_sequence,envelope,dependencies,status)
          values(${this.accountId},${operation.operationId},${operation.deviceId},${operation.clientSequence},${JSON.stringify(operation)},${JSON.stringify(operation.dependsOn)},'pending')`);
        const resolution:RecoveryResolution={kind:'corrected',replacementOperationId:operation.operationId};
        tx.run(sql`update sync_mutations set error=json_set(error,'$.resolution',json(${JSON.stringify(resolution)}))
          where account_id=${this.accountId} and operation_id=${original.operationId}`);
        replacements.push(operation);
      }
      const graph=new Map(tx.all<Payload>(sql`select envelope as payload from sync_mutations where account_id=${this.accountId} and status!='acknowledged'`)
        .map(row=>{const operation=JSON.parse(row.payload) as Operation;return [operation.operationId,operation.dependsOn] as const;}));
      for(const operation of replacements) {
        const visiting=[...operation.dependsOn],seen=new Set<string>();
        while(visiting.length) {
          const id=visiting.pop()!;if(id===operation.operationId) throw new Error('dependency_cycle');
          if(seen.has(id)) continue;seen.add(id);visiting.push(...(graph.get(id)??[]));
        }
      }
      tx.run(sql`update sync_state set next_sequence=${sequence} where account_id=${this.accountId}`);
      this.rebuild(tx);return replacements;
    });
  }
  private rebuild(db=this.db) {
    this.blockDependents(db);
    const projection=project(this.base(db),this.pending(db),'9999-12-31');
    db.run(sql`delete from projected_views where account_id=${this.accountId}`);
    db.run(sql`insert into projected_views(account_id,kind,entity_key,payload) values(${this.accountId},'xp','total',${JSON.stringify({totalXp:projection.totalXp})})`);
    for(const habit of projection.habits) db.run(sql`insert into projected_views(account_id,kind,entity_key,payload) values(${this.accountId},'habit',${habit.habitId},${JSON.stringify(habit)})`);
  }
  view(day:string) {
    this.guard();
    const pending=this.pending();
    const rejected=this.db.get<{count:number}>(sql`select count(*) as count from sync_mutations where account_id=${this.accountId} and status='rejected' and json_extract(error,'$.resolution') is null`)?.count??0;
    return {...project(this.base(),pending,day),pendingCount:pending.length,rejectedCount:rejected};
  }
  operations():Operation[] {this.guard();return this.pending();}
  readyOperations(now:number):Operation[] {
    this.guard();
    const rows=this.db.all<{envelope:string;status:string;next_attempt_at:string|null}>(sql`select envelope,status,next_attempt_at
      from sync_mutations where account_id=${this.accountId} and status not in ('acknowledged','rejected') order by client_sequence`);
    const operations=rows.map(row=>({...row,operation:JSON.parse(row.envelope) as Operation}));
    const waiting=new Set(operations.map(row=>row.operation.operationId)),ready:Operation[]=[];
    for(const row of operations) {
      if(!['pending','retry_wait','deferred'].includes(row.status)||row.next_attempt_at&&Date.parse(row.next_attempt_at)>now) continue;
      if(row.operation.dependsOn.some(id=>waiting.has(id))) continue;
      ready.push(row.operation);waiting.delete(row.operation.operationId);
    }
    return ready;
  }
  beginAttempt(batch:Operation[],now:number) {
    this.guard(true);
    this.db.transaction(tx=>{for(const op of batch) {
      const attempts=(tx.get<{attempts:number}>(sql`select attempts from sync_mutations where account_id=${this.accountId} and operation_id=${op.operationId}`)?.attempts??0)+1;
      const next=new Date(now+retryDelay(attempts,null,now)).toISOString();
      tx.run(sql`update sync_mutations set status='in_flight',attempts=${attempts},next_attempt_at=${next}
        where account_id=${this.accountId} and operation_id=${op.operationId}`);
    }});
  }
  cancelAttempt(batch:Operation[]) {
    this.guard();
    this.db.transaction(tx=>{for(const op of batch) tx.run(sql`update sync_mutations set status='pending',attempts=max(0,attempts-1),next_attempt_at=null
      where account_id=${this.accountId} and operation_id=${op.operationId} and status='in_flight'`);});
  }
  retryLater(batch:Operation[],error:unknown,now:number) {
    this.guard();
    this.db.transaction(tx=>{for(const op of batch) {
      const attempts=tx.get<{attempts:number}>(sql`select attempts from sync_mutations where account_id=${this.accountId} and operation_id=${op.operationId}`)?.attempts??1;
      const next=new Date(now+retryDelay(attempts,error,now)).toISOString();
      const status=attempts>=10?'blocked_local':'retry_wait',reason=attempts>=10?JSON.stringify({code:'retry_exhausted'}):null;
      tx.run(sql`update sync_mutations set status=${status},next_attempt_at=${attempts>=10?null:next},error=${reason}
        where account_id=${this.accountId} and operation_id=${op.operationId} and status='in_flight'`);
    }});
  }
  retryState() {
    this.guard();
    const rows=this.db.all<{attempts:number;next_attempt_at:string|null;status:string}>(sql`select attempts,next_attempt_at,status from sync_mutations
      where account_id=${this.accountId} and (status in ('retry_wait','deferred') or (status='blocked_local' and json_extract(error,'$.code')='retry_exhausted'))`);
    const dates=rows.flatMap(row=>row.next_attempt_at?[Date.parse(row.next_attempt_at)]:[]);
    return {failures:Math.max(0,...rows.map(row=>row.attempts)),nextAttemptAt:dates.length?Math.min(...dates):null,failedCount:rows.filter(row=>row.status==='blocked_local').length};
  }
  retryFailed() {
    this.guard(true);
    this.db.run(sql`update sync_mutations set status='pending',attempts=0,next_attempt_at=null,error=null where account_id=${this.accountId}
      and status='blocked_local' and json_extract(error,'$.code')='retry_exhausted'`);
  }
  cursor():string|null {
    this.guard();
    return this.db.get<{cursor:string|null}>(sql`select cursor from sync_state where account_id=${this.accountId}`)?.cursor??null;
  }
  private recognize(db:LocalDatabase,receipt:Receipt) {
    const status=receipt.status==='rejected'?'rejected':'acknowledged';
    const local=db.get<{error:string|null}>(sql`select error from sync_mutations where account_id=${this.accountId} and operation_id=${receipt.operationId}`);
    const resolution=local?.error?(JSON.parse(local.error) as RecoveryError).resolution:undefined;
    const error=receipt.status==='rejected'?JSON.stringify({...receipt.error,...(resolution?{resolution}:{})}):null;
    db.run(sql`update sync_mutations set status=${status},result=${JSON.stringify(receipt)},error=${error}
      where account_id=${this.accountId} and operation_id=${receipt.operationId}`);
  }
  private incorporate(db:LocalDatabase,entity:Entity) {
    const key=entityKey(entity);
    if(!key) throw new Error('unsupported_entity');
    const revision=BigInt(entity.value.revision);
    if(revision<0n||revision>9223372036854775807n) throw new Error('invalid_revision');
    const previous=db.get<{revision:string}>(sql`select revision from canonical_entities where account_id=${this.accountId} and kind=${entity.kind} and entity_key=${key}`);
    if(previous&&BigInt(previous.revision)>revision) return;
    db.run(sql`insert into canonical_entities(account_id,kind,entity_key,revision,payload)
      values(${this.accountId},${entity.kind},${key},${entity.value.revision},${JSON.stringify(entity)})
      on conflict(account_id,kind,entity_key) do update set revision=excluded.revision,payload=excluded.payload`);
  }
  applyAck(results:PushResult[],now:number=Date.now()) {
    this.guard(true);
    this.db.transaction(tx=>{
      for(const result of results) {
        if('receipt' in result) {
          this.recognize(tx,result.receipt);
          for(const entity of result.projections??[]) this.incorporate(tx,entity);
        } else {
          const attempts=tx.get<{attempts:number}>(sql`select attempts from sync_mutations where account_id=${this.accountId} and operation_id=${result.operationId}`)?.attempts??0;
          const status=attempts>=10?'blocked_local':'deferred',error=attempts>=10?JSON.stringify({code:'retry_exhausted'}):null;
          const next=attempts>=10?null:new Date(now+retryDelay(attempts,null,now)).toISOString();
          tx.run(sql`update sync_mutations set status=${status},next_attempt_at=${next},error=${error}
            where account_id=${this.accountId} and operation_id=${result.operationId}`);
        }
      }
      this.rebuild(tx);
    });
  }
  applyPull(page:Pull) {
    this.guard(true);
    this.db.transaction(tx=>{
      for(const change of page.changes) {
        for(const receipt of change.operationResults) this.recognize(tx,receipt);
        for(const entity of change.entities) this.incorporate(tx,entity);
      }
      this.rebuild(tx);
      tx.run(sql`update sync_state set cursor=${page.nextCursor} where account_id=${this.accountId}`);
    });
  }
  beginSnapshot(snapshotId:string,revision:string,cursor:string,expiresAt:string) {
    this.guard(true);
    this.db.transaction(tx=>{
      tx.run(sql`delete from snapshot_staging where account_id=${this.accountId}`);
      tx.run(sql`update sync_state set snapshot_id=${snapshotId},snapshot_revision=${revision},snapshot_cursor=${cursor},snapshot_expires_at=${expiresAt} where account_id=${this.accountId}`);
    });
  }
  stageSnapshotPage(snapshotId:string,cursor:string,entities:Entity[],nextCursor:string|null) {
    this.guard(true);
    this.db.transaction(tx=>{
      const state=tx.get<{snapshot_id:string|null;snapshot_cursor:string|null}>(sql`select snapshot_id,snapshot_cursor from sync_state where account_id=${this.accountId}`);
      if(state?.snapshot_id!==snapshotId||state.snapshot_cursor!==cursor) throw new Error('snapshot_mismatch');
      for(const entity of entities) tx.run(sql`insert into snapshot_staging(account_id,snapshot_id,kind,entity_key,revision,payload)
        values(${this.accountId},${snapshotId},${entity.kind},${entityKey(entity)},${entity.value.revision},${JSON.stringify(entity)})`);
      tx.run(sql`update sync_state set snapshot_cursor=${nextCursor} where account_id=${this.accountId}`);
    });
  }
  installSnapshot(snapshotId:string,entityCount:number,receipts:Receipt[],cursor:string) {
    this.guard(true);
    this.db.transaction(tx=>{
      const state=tx.get<{snapshot_id:string|null;snapshot_cursor:string|null}>(sql`select snapshot_id,snapshot_cursor from sync_state where account_id=${this.accountId}`);
      const rows=tx.all<Payload>(sql`select payload from snapshot_staging where account_id=${this.accountId} and snapshot_id=${snapshotId}`);
      if(state?.snapshot_id!==snapshotId||state.snapshot_cursor!==null||rows.length!==entityCount) throw new Error('incomplete_snapshot');
      tx.run(sql`delete from canonical_entities where account_id=${this.accountId}`);
      for(const row of rows) this.incorporate(tx,JSON.parse(row.payload) as Entity);
      for(const receipt of receipts) this.recognize(tx,receipt);
      this.rebuild(tx);
      tx.run(sql`update sync_state set cursor=${cursor},snapshot_id=null,snapshot_revision=null,snapshot_cursor=null,snapshot_expires_at=null where account_id=${this.accountId}`);
      tx.run(sql`delete from snapshot_staging where account_id=${this.accountId}`);
    });
  }
  private closed=false;
  close() { if(!this.closed) {this.closed=true;this.shutdown();} }
}
