import { sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { project } from '../../features/habits/domain/project.ts';
import { entityKey } from '../sync/protocol.ts';
import type { Command, Entity, Operation, PushResult, Receipt, Pull } from '../sync/protocol.ts';

export type LocalDatabase = BaseSQLiteDatabase<'sync', unknown>;
type Payload = {payload:string};
type Pending = {envelope:string;status:string};
export class AccountStore {
  constructor(private db:LocalDatabase,readonly accountId:string,readonly deviceId:string,private shutdown:()=>void,private guard:()=>void=()=>{}) {
    this.guard();
    db.transaction(tx=>{
      const owner=tx.get<{account_id:string}>(sql`select account_id from account_storage`);
      if(owner&&owner.account_id!==accountId) throw new Error('account_store_mismatch');
      tx.run(sql`insert into account_storage(account_id) values(${accountId}) on conflict do nothing`);
      tx.run(sql`insert into sync_state(account_id,next_sequence,onboarding_step) values(${accountId},1,'time_context') on conflict do nothing`);
      tx.run(sql`update sync_mutations set status='pending' where account_id=${accountId} and status='in_flight'`);
    });
  }
  private base(db=this.db):Entity[] {
    return db.all<Payload>(sql`select payload from canonical_entities where account_id=${this.accountId}`).map(r=>JSON.parse(r.payload) as Entity);
  }
  private pending(db=this.db):Operation[] {
    return db.all<Pending>(sql`select envelope,status from sync_mutations where account_id=${this.accountId} and status in ('pending','in_flight','retry_wait','deferred') order by client_sequence`)
      .map(r=>JSON.parse(r.envelope) as Operation);
  }
  enqueue(command:Command,operationId:string,occurredAt:string):Operation {
    this.guard();
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
  private rebuild(db=this.db) {
    const projection=project(this.base(db),this.pending(db),'9999-12-31');
    db.run(sql`delete from projected_views where account_id=${this.accountId}`);
    db.run(sql`insert into projected_views(account_id,kind,entity_key,payload) values(${this.accountId},'xp','total',${JSON.stringify({totalXp:projection.totalXp})})`);
    for(const habit of projection.habits) db.run(sql`insert into projected_views(account_id,kind,entity_key,payload) values(${this.accountId},'habit',${habit.habitId},${JSON.stringify(habit)})`);
  }
  view(day:string) {
    this.guard();
    const pending=this.pending();
    const rejected=this.db.get<{count:number}>(sql`select count(*) as count from sync_mutations where account_id=${this.accountId} and status='rejected'`)?.count??0;
    return {...project(this.base(),pending,day),pendingCount:pending.length,rejectedCount:rejected};
  }
  operations():Operation[] {this.guard();return this.pending();}
  cursor():string|null {
    this.guard();
    return this.db.get<{cursor:string|null}>(sql`select cursor from sync_state where account_id=${this.accountId}`)?.cursor??null;
  }
  private recognize(db:LocalDatabase,receipt:Receipt) {
    const status=receipt.status==='rejected'?'rejected':'acknowledged';
    db.run(sql`update sync_mutations set status=${status},result=${JSON.stringify(receipt)},error=${receipt.status==='rejected'?JSON.stringify(receipt.error):null}
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
  applyAck(results:PushResult[]) {
    this.guard();
    this.db.transaction(tx=>{
      for(const result of results) {
        if('receipt' in result) {
          this.recognize(tx,result.receipt);
          for(const entity of result.projections??[]) this.incorporate(tx,entity);
        } else tx.run(sql`update sync_mutations set status='deferred' where account_id=${this.accountId} and operation_id=${result.operationId}`);
      }
      this.rebuild(tx);
    });
  }
  applyPull(page:Pull) {
    this.guard();
    this.db.transaction(tx=>{
      for(const change of page.changes) {
        for(const receipt of change.operationResults) this.recognize(tx,receipt);
        for(const entity of change.entities) this.incorporate(tx,entity);
      }
      this.rebuild(tx);
      tx.run(sql`update sync_state set cursor=${page.nextCursor} where account_id=${this.accountId}`);
    });
  }
  installSnapshot(snapshotId:string,entities:Entity[],receipts:Receipt[],cursor:string) {
    this.guard();
    this.db.transaction(tx=>{
      tx.run(sql`delete from snapshot_staging where account_id=${this.accountId}`);
      for(const entity of entities) tx.run(sql`insert into snapshot_staging(account_id,snapshot_id,kind,entity_key,revision,payload)
        values(${this.accountId},${snapshotId},${entity.kind},${entityKey(entity)},${entity.value.revision},${JSON.stringify(entity)})`);
      tx.run(sql`delete from canonical_entities where account_id=${this.accountId}`);
      for(const entity of entities) this.incorporate(tx,entity);
      for(const receipt of receipts) this.recognize(tx,receipt);
      this.rebuild(tx);
      tx.run(sql`update sync_state set cursor=${cursor},snapshot_id=null,snapshot_revision=null,snapshot_cursor=null,snapshot_expires_at=null where account_id=${this.accountId}`);
      tx.run(sql`delete from snapshot_staging where account_id=${this.accountId}`);
    });
  }
  private closed=false;
  close() { if(!this.closed) {this.closed=true;this.shutdown();} }
}
