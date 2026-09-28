import {failureKind} from './retry.ts';
import type {AccountStore} from '../db/account-store.ts';
import type {Entity,Operation,PushResult,Pull,Receipt} from './protocol.ts';
import * as validate from './generated/validate.cjs';

type Manifest={snapshotId:string;highWaterRevision:string;expiresAt:string;entityCount:number;firstPageCursor:string};
type Page={snapshotId:string;highWaterRevision:string;entities:Entity[];complete:boolean;nextPageCursor:string|null;pullCursor:string|null};
type AtCut=Receipt|{operationId:string;status:'notProcessedAtH'};
export class SyncHttpError extends Error {
  constructor(readonly status:number,readonly code:string,readonly retryAfter:string|null=null) {super(code);}
}
export class HttpSync {
  constructor(private origin:string,readonly accountId:string,private token:(force?:boolean)=>string|Promise<string>,private nextId:()=>string) {}
  private async request<T>(path:string,method:string,body:unknown,check:(data:unknown)=>boolean):Promise<T> {
    const headers:Record<string,string>={'Content-Type':'application/json','X-Ritmo-Protocol':'m1.1','X-App-Version':'0.1.0',Authorization:'Bearer '+await this.token(false)};
    if(path==='push') headers['Idempotency-Key']=this.nextId();
    const init:RequestInit={method,headers,signal:AbortSignal.timeout(15000)};
    if(body!==undefined) init.body=JSON.stringify(body);
    let response=await fetch(this.origin+'/api/v1/sync/'+path,init);
    if(response.status===401) {
      headers.Authorization='Bearer '+await this.token(true);
      response=await fetch(this.origin+'/api/v1/sync/'+path,{...init,signal:AbortSignal.timeout(15000)});
    }
    const result:unknown=await response.json().catch(()=>undefined);
    if(!response.ok) {
      let code='http_error';
      if(result&&typeof result==='object'&&'error' in result&&result.error&&typeof result.error==='object'&&'code' in result.error&&typeof result.error.code==='string') code=result.error.code;
      throw new SyncHttpError(response.status,code,response.headers.get('Retry-After'));
    }
    if(!check(result)) throw new Error('unsupported_protocol');
    return result as T;
  }
  push(operations:Operation[]) {return this.request<{results:PushResult[];serverTime:string}>('push','POST',{operations},validate.PushResponse);}
  pull(cursor:string|null) {return this.request<Pull>('pull'+(cursor?'?cursor='+encodeURIComponent(cursor):''),'GET',undefined,validate.PullResponse);}
  snapshot() {return this.request<Manifest>('snapshots','POST',{},validate.SnapshotManifest);}
  page(snapshot:string,cursor:string) {return this.request<Page>('snapshots/'+snapshot+'?cursor='+encodeURIComponent(cursor),'GET',undefined,validate.SnapshotPage);}
  receipts(snapshotId:string,operationIds:string[]) {
    return this.request<{snapshotId:string;highWaterRevision:string;results:AtCut[]}>('receipts','POST',{snapshotId,operationIds},validate.ReceiptsResponse);
  }
}
const running=new WeakSet<AccountStore>();
async function pull(store:AccountStore,api:HttpSync) {
  let high:string|null=null;
  const visited=new Set<string>();
  for(;;) {
    const cursor=store.cursor();if(cursor) visited.add(cursor);
    const page=await api.pull(cursor);
    if(high!==null&&page.highWaterRevision!==high||page.hasMore&&(!page.changes.length||visited.has(page.nextCursor))) throw new Error('pull_mismatch');
    high=page.highWaterRevision;
    store.applyPull(page);
    if(!page.hasMore) break;
  }
}
async function recover(store:AccountStore,api:HttpSync) {
  for(let attempt=0;attempt<2;attempt++) {
    try {await copySnapshot(store,api);return;}
    catch(error) {
      if(!(error instanceof SyncHttpError)||!(error.status===410&&error.code==='snapshot_expired'||error.status===404&&error.code==='resource_inaccessible')) throw error;
      // One fresh copy per attempt; repeated expiry yields to the scheduler's bounded backoff.
      if(attempt===1) throw new Error('snapshot_retry_required',{cause:error});
    }
  }
}
async function copySnapshot(store:AccountStore,api:HttpSync) {
  const manifest=await api.snapshot();let count=0,cursor:string|null=manifest.firstPageCursor,pullCursor:string|null=null;
  store.beginSnapshot(manifest.snapshotId,manifest.highWaterRevision,manifest.firstPageCursor,manifest.expiresAt);
  const visited=new Set<string>();
  while(cursor) {
    visited.add(cursor);
    const page=await api.page(manifest.snapshotId,cursor);
    if(page.snapshotId!==manifest.snapshotId||page.highWaterRevision!==manifest.highWaterRevision||
      page.nextPageCursor&&visited.has(page.nextPageCursor)||page.entities.some(entity=>BigInt(entity.value.revision)>BigInt(manifest.highWaterRevision))) throw new Error('snapshot_mismatch');
    if(page.complete!==!page.nextPageCursor||page.complete!==!!page.pullCursor||!page.complete&&!page.entities.length||count+page.entities.length>manifest.entityCount) throw new Error('incomplete_snapshot');
    store.stageSnapshotPage(manifest.snapshotId,cursor,page.entities,page.nextPageCursor);
    count+=page.entities.length;cursor=page.nextPageCursor;pullCursor=page.pullCursor;
  }
  if(count!==manifest.entityCount||!pullCursor) throw new Error('incomplete_snapshot');
  // Local writers remain available during requests. Repeat until every current pending id is classified at H.
  const classified=new Map<string,AtCut>();
  for(;;) {
    const ids=store.operations().map(op=>op.operationId).filter(id=>!classified.has(id));
    if(!ids.length) {
      store.installSnapshot(manifest.snapshotId,manifest.entityCount,[...classified.values()].filter((r):r is Receipt=>r.status!=='notProcessedAtH'),pullCursor);
      break;
    }
    for(let offset=0;offset<ids.length;offset+=50) {
      const requested=ids.slice(offset,offset+50),expected=new Set(requested);
      const receipts=await api.receipts(manifest.snapshotId,requested);
      if(receipts.snapshotId!==manifest.snapshotId||receipts.highWaterRevision!==manifest.highWaterRevision) throw new Error('snapshot_mismatch');
      for(const receipt of receipts.results) {
        if(!expected.delete(receipt.operationId)||receipt.status!=='rejected'&&receipt.status!=='notProcessedAtH'&&BigInt(receipt.acceptedRevision)>BigInt(manifest.highWaterRevision)) throw new Error('receipt_mismatch');
        classified.set(receipt.operationId,receipt);
      }
      if(expected.size) throw new Error('receipt_mismatch');
    }
  }
}
export async function synchronize(store:AccountStore,api:HttpSync,now:()=>number=Date.now) {
  if(store.accountId!==api.accountId) throw new Error('account_mismatch');
  if(running.has(store)) return;
  running.add(store);
  try {
    try {await pull(store,api);}
    catch(error) {
      if(!(error instanceof SyncHttpError)||error.code!=='resync_required') throw error;
      await recover(store,api);
      await pull(store,api);
    }
    const pending=new Set(store.readyOperations(now()).map(operation=>operation.operationId));
    while(pending.size) {
      const batch=store.readyOperations(now()).filter(operation=>pending.has(operation.operationId)).slice(0,50);
      if(!batch.length) break;
      for(const operation of batch) pending.delete(operation.operationId);
      store.beginAttempt(batch,now());
      let ack:{results:PushResult[];serverTime:string};
      try {ack=await api.push(batch);}
      catch(error) {
        if(failureKind(error)==='retry') store.retryLater(batch,error,now());
        else store.cancelAttempt(batch);
        throw error;
      }
      const expected=new Set(batch.map(op=>op.operationId));
      for(const result of ack.results) {
        const id='receipt' in result?result.receipt.operationId:result.operationId;
        if(!expected.delete(id)) throw new Error('ack_mismatch');
      }
      if(expected.size) throw new Error('ack_mismatch');
      store.applyAck(ack.results,now());
    }
    await pull(store,api);
    return store.retryState();
  } finally {running.delete(store);}
}
