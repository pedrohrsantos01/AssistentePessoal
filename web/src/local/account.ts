import { operationHash } from '../../../app/src/core/sync/operation-hash.ts';
import { retryDelay, retryAfterDelay } from '../../../app/src/core/sync/retry.ts';
import { project } from '../../../app/src/features/habits/domain/project.ts';
import { entityKey, type Command, type Entity, type Operation, type PushResult, type Receipt, type Pull } from '../../../app/src/core/sync/protocol.ts';
import type { Correction } from '../../../app/src/core/db/account-store.ts';
import { check } from './database.ts';
import { decimal, type Canonical, type Mutation, type SyncState } from './records.ts';
export type AtCut=Receipt|{operationId:string;status:'notProcessedAtH'};
export class AccountData {
  constructor(readonly account: string, readonly device: string, readonly state: SyncState, readonly base: Canonical[], readonly rows: Mutation[]) {
    check('SyncState',state);
    for(const row of base) {check('Canonical',row);if(row.account_id!==account) throw new Error('account_mismatch');}
    for(const row of rows) {check('Mutation',row);if(row.account_id!==account) throw new Error('account_mismatch');}
    if(state.account_id!==account) throw new Error('account_mismatch');
    rows.sort((a,b)=>a.client_sequence-b.client_sequence);
  }
  unconfirmed() {return this.rows.filter(row=>['pending','in_flight','retry_wait','deferred'].includes(row.status)||row.status==='blocked_local'&&(row.error?.identity||['retry_exhausted','identity_dependency_unresolved'].includes(row.error?.code??'')));}
  receiptIds() {return [...new Set([...this.unconfirmed().map(row=>row.operation_id),...this.rows.flatMap(row=>row.error?.identity?.originalOperationId&&!row.error.resolution?[row.error.identity.originalOperationId]:[])])];}
  view(day: string) {
    const pending=this.rows.filter(row=>['pending','in_flight','retry_wait','deferred'].includes(row.status)||row.status==='blocked_local'&&row.error?.code==='retry_exhausted').map(row=>row.envelope);
    return project(this.base.map(row=>row.payload),pending,day);
  }
  enqueue(command:Command,operationId:string,occurredAt:string):Operation {
    const dependsOn=this.unconfirmed().filter(row=>'habitId' in command&&'habitId' in row.envelope.command&&row.envelope.command.habitId===command.habitId).map(row=>row.operation_id);
    return this.insert({operationId,deviceId:this.device,clientSequence:this.state.next_sequence,occurredAt,dependsOn,command});
  }
  private insert(operation:Operation) {
    if(this.state.next_sequence>=Number.MAX_SAFE_INTEGER) throw new Error('sequence_exhausted');
    if(this.rows.some(row=>row.operation_id===operation.operationId)) throw new Error('operation_id_in_use');
    this.rows.push({account_id:this.account,operation_id:operation.operationId,device_id:operation.deviceId,client_sequence:operation.clientSequence,envelope:structuredClone(operation),dependencies:[...operation.dependsOn],status:'pending',attempts:0,next_attempt_at:null,error:null,result:null});
    this.state.next_sequence++;return structuredClone(operation);
  }
  recoverAttempts() {
    for(const row of this.rows) if(row.status==='in_flight') {row.status=row.attempts>=10?'blocked_local':'retry_wait';if(row.attempts>=10) row.error={code:'retry_exhausted',fields:[],dependencyIds:[]};}
  }
  ready(now:number) {
    const waiting=new Set(this.rows.filter(row=>!['acknowledged','rejected'].includes(row.status)).map(row=>row.operation_id)),ready:Mutation[]=[];
    for(const row of this.rows) {
      if(!['pending','retry_wait','deferred'].includes(row.status)||row.next_attempt_at&&Date.parse(row.next_attempt_at)>now||row.envelope.dependsOn.some(id=>waiting.has(id))) continue;
      ready.push(row);waiting.delete(row.operation_id);
    }
    return ready;
  }
  beginAttempt(now:number,limit=50) {
    const batch=this.ready(now).slice(0,limit);
    for(const row of batch) {row.status='in_flight';row.attempts++;row.next_attempt_at=new Date(now+retryDelay(row.attempts,null,now)).toISOString();}
    return structuredClone(batch.map(row=>row.envelope));
  }
  retry(batch:Operation[],error:unknown,now:number) {
    for(const op of batch) {
      const row=this.rows.find(row=>row.operation_id===op.operationId);
      if(!row||row.status!=='in_flight') continue;
      const exhausted=row.attempts>=10,delay=exhausted?retryAfterDelay(error,now):retryDelay(row.attempts,error,now);
      row.status=exhausted?'blocked_local':'retry_wait';row.next_attempt_at=delay>0?new Date(now+delay).toISOString():null;
      row.error=exhausted?{code:'retry_exhausted',fields:[],dependencyIds:[]}:null;
    }
  }
  recognize(receipt:Receipt) {
    if(receipt.operationHash&&!(receipt.status==='rejected'&&receipt.error.identityConflict)) for(const row of this.rows) {
      if(row.error?.identity?.originalOperationId===receipt.operationId&&row.error.identity.originalOperationHash===receipt.operationHash) row.error.identity.originalReceipt=receipt;
    }
    const row=this.rows.find(row=>row.operation_id===receipt.operationId);if(!row) return;
    const hash=operationHash(row.envelope),previous=row.error;
    if(row.result?.operationHash===hash&&!(row.result.status==='rejected'&&row.result.error.identityConflict)) return;
    const conflict=receipt.status==='rejected'?receipt.error.identityConflict:undefined;
    if(!receipt.operationHash||receipt.operationHash!==hash||conflict) {
      const identity:NonNullable<Mutation['error']>['identity']={...previous?.identity,localOperationHash:hash,reason:conflict?.kind??(previous?.identity?.reason&&previous.identity.reason!=='missing_proof'?previous.identity.reason:receipt.operationHash?'content_mismatch':'missing_proof')};
      if(conflict) {identity.originalOperationId=conflict.originalOperationId;identity.originalOperationHash=conflict.originalOperationHash;identity.conflictReceipt=receipt;}
      else if(receipt.operationHash) {identity.originalOperationId=receipt.operationId;identity.originalOperationHash=receipt.operationHash;identity.originalReceipt=receipt;}
      row.status='blocked_local';row.error={code:'id_content_conflict',fields:[],dependencyIds:[],identity};return;
    }
    row.status=receipt.status==='rejected'?'rejected':'acknowledged';row.result=structuredClone(receipt);row.next_attempt_at=null;
    row.error=receipt.status==='rejected'?{...receipt.error,...(previous?.resolution?{resolution:previous.resolution}:{})}:null;
  }
  incorporate(entity:Entity) {
    const incoming:Canonical={account_id:this.account,kind:entity.kind,entity_key:entityKey(entity),revision:entity.value.revision,payload:entity};check('Canonical',incoming);
    const index=this.base.findIndex(row=>row.kind===entity.kind&&row.entity_key===incoming.entity_key);
    if(index>=0&&decimal(this.base[index]!.revision)>decimal(incoming.revision)) return;
    if(index>=0) this.base[index]=structuredClone(incoming);else this.base.push(structuredClone(incoming));
  }
  ack(results:PushResult[],now:number) {
    for(const result of results) {
      if('receipt' in result) {this.recognize(result.receipt);for(const entity of result.projections??[]) this.incorporate(entity);}
      else {
        const row=this.rows.find(row=>row.operation_id===result.operationId);if(!row) throw new Error('ack_mismatch');
        row.status=row.attempts>=10?'blocked_local':'deferred';row.error=row.attempts>=10?{code:'retry_exhausted',fields:[],dependencyIds:[]}:null;
        row.next_attempt_at=row.attempts>=10?null:new Date(now+retryDelay(row.attempts,null,now)).toISOString();
      }
    }
  }
  pull(page:Pull) {
    for(const change of page.changes) {for(const receipt of change.operationResults) this.recognize(receipt);for(const entity of change.entities) this.incorporate(entity);}
    this.state.cursor=page.nextCursor;
  }
  rebuild() {
    for(const row of this.rows) if(row.status==='blocked_local'&&!row.error?.resolution&&['identity_dependency_unresolved','dependency_rejected'].includes(row.error?.code??'')) {
      row.status=row.attempts>=10?'blocked_local':'pending';row.error=row.attempts>=10?{code:'retry_exhausted',fields:[],dependencyIds:[]}:null;
    }
    const blocked=new Set(this.rows.filter(row=>row.status==='rejected'||row.status==='blocked_local'&&row.error?.code!=='retry_exhausted').map(row=>row.operation_id));
    let changed=true;
    while(changed) {changed=false;for(const row of this.rows) {
      if(row.status==='acknowledged'||blocked.has(row.operation_id)) continue;
      const dependencyIds=row.dependencies.filter(id=>blocked.has(id));if(!dependencyIds.length) continue;
      const uncertain=this.rows.some(parent=>dependencyIds.includes(parent.operation_id)&&(parent.error?.identity||parent.error?.code==='identity_dependency_unresolved'));
      row.status='blocked_local';row.error={code:uncertain?'identity_dependency_unresolved':'dependency_rejected',fields:[],dependencyIds};blocked.add(row.operation_id);changed=true;
    }}
    for(const row of this.rows) check('Mutation',row);
    return this.view('9999-12-31');
  }
  correct(corrections:Correction[]) {
    const byId=new Map(this.rows.map(row=>[row.operation_id,row]));
    if(new Set(corrections.map(item=>item.operationId)).size!==corrections.length||new Set(corrections.map(item=>item.replacementId)).size!==corrections.length) throw new Error('duplicate_correction');
    const mapping=new Map(this.rows.flatMap(row=>row.error?.resolution?.kind==='corrected'?[[row.operation_id,row.error.resolution.replacementOperationId] as const]:[]));
    for(const request of corrections) {
      const row=byId.get(request.operationId);
      if(!row||!['rejected','blocked_local'].includes(row.status)||!row.error||row.error.identity||row.error.code==='identity_dependency_unresolved'||row.error.resolution?.kind==='corrected') throw new Error('operation_not_recoverable');
      if(byId.has(request.replacementId)) throw new Error('replacement_id_in_use');mapping.set(request.operationId,request.replacementId);
    }
    const remap=(id:string)=>{const seen=new Set<string>();while(mapping.has(id)) {if(seen.has(id)) throw new Error('dependency_cycle');seen.add(id);id=mapping.get(id)!;}return id;};
    const habits=new Map<string,string>();
    for(const row of this.rows) if(row.envelope.command.type==='habit.create'&&mapping.has(row.operation_id)) {
      const target=remap(row.operation_id),request=corrections.find(item=>item.replacementId===target);
      const command=request?(request.command??byId.get(request.operationId)!.envelope.command):byId.get(target)?.envelope.command;
      if(command?.type==='habit.create') habits.set(row.envelope.command.habitId,command.habitId);
    }
    const replacements:Operation[]=[];
    for(const request of [...corrections].sort((a,b)=>byId.get(a.operationId)!.client_sequence-byId.get(b.operationId)!.client_sequence)) {
      const row=byId.get(request.operationId)!,original=row.envelope;let command=structuredClone(request.command??original.command);
      if(command.type!==original.command.type) throw new Error('correction_type_mismatch');
      if(command.type!=='habit.create'&&'habitId' in command) {
        let habitId=command.habitId;const seen=new Set<string>();while(habits.has(habitId)) {if(seen.has(habitId)) throw new Error('dependency_cycle');seen.add(habitId);habitId=habits.get(habitId)!;}command={...command,habitId};
      }
      if(command.type==='habit.mark') {
        const observedUndoIds=command.observedUndoIds.map(remap),retained=new Set(observedUndoIds);
        if(original.command.type==='habit.mark'&&original.command.observedUndoIds.some(id=>!retained.has(remap(id)))) throw new Error('context_truncation_forbidden');command={...command,observedUndoIds};
      }
      const dependsOn=new Set(original.dependsOn.map(remap));
      if(command.type==='habit.mark') for(const id of command.observedUndoIds) if(corrections.some(item=>item.replacementId===id)||byId.has(id)&&byId.get(id)!.status!=='acknowledged') dependsOn.add(id);
      const op=this.insert({...original,operationId:request.replacementId,deviceId:this.device,clientSequence:this.state.next_sequence,occurredAt:request.occurredAt??original.occurredAt,dependsOn:[...dependsOn],command,supersedesOperationId:original.operationId});
      row.error={...row.error!,resolution:{kind:'corrected',replacementOperationId:op.operationId}};replacements.push(op);
    }
    const graph=new Map(this.rows.filter(row=>row.status!=='acknowledged').map(row=>[row.operation_id,row.dependencies]));
    for(const op of replacements) {const visiting=[...op.dependsOn],seen=new Set<string>();while(visiting.length) {const id=visiting.pop()!;if(id===op.operationId) throw new Error('dependency_cycle');if(seen.has(id)) continue;seen.add(id);visiting.push(...(graph.get(id)??[]));}}
    return replacements;
  }
}
