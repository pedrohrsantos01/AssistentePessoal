import type { Operation, Pull, PushResult } from '../../../app/src/core/sync/protocol.ts';
import type { AtCut } from './account.ts';
import { LocalRepository } from './repository.ts';
import { uuid7 } from './ids.ts';
import { decodeWire } from './wire.ts';
import type { Lease } from './records.ts';
type SnapshotPage={snapshotId:string;highWaterRevision:string;entities:import('../../../app/src/core/sync/protocol.ts').Entity[];nextPageCursor:string|null;complete:boolean;pullCursor:string|null};
export class Remote {
  private claimed=false;
  constructor(private repository:LocalRepository,private readonly lease:Lease,private request:typeof fetch=(input,init)=>globalThis.fetch(input,init)) {this.lease=Object.freeze({...lease});}
  private async post<T>(route:string,body:unknown,schema:string,extra:Record<string,string>={}):Promise<T> {
    await this.repository.assertCurrent(this.lease);
    const response=await this.request(`/api/v1/web/contexts/${this.lease.context}/${route}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Ritmo-Web':'1','X-App-Version':'0.1.0','X-Ritmo-Protocol':'m1.1','X-Ritmo-Owner-Epoch':this.lease.epoch,'X-Ritmo-Owner-Tab':this.lease.tab,'X-Ritmo-Expected-Account':this.lease.account,...extra},body:JSON.stringify(body),cache:'no-store'});
    await this.repository.assertCurrent(this.lease);
    if(!response.ok) {
      if(response.status===426) await this.repository.requireUpgrade(this.lease,new Date().toISOString());
      let code='remote_failed';try {const body=await response.json() as {error?:{code?:unknown}};if(typeof body.error?.code==='string') code=body.error.code;}catch { /* Proxy errors need not be JSON. */ }
      throw Object.assign(new Error(code),{status:response.status,retryAfter:response.headers.get('Retry-After')});
    }
    const value:unknown=await response.json().catch(()=>undefined);let decoded:T;
    try {decoded=decodeWire<T>(schema,value);}
    catch(error) {await this.repository.requireUpgrade(this.lease,new Date().toISOString());throw new Error('unsupported_protocol',{cause:error});}
    await this.repository.assertCurrent(this.lease);return decoded;
  }
  async claim() {
    this.claimed=false;
    const response=await this.post<{contextId:string;epoch:string;tabId:string}>('claim-owner',{epoch:this.lease.epoch,tabId:this.lease.tab},'OwnerReceipt');
    if(response.contextId!==this.lease.context||response.epoch!==this.lease.epoch||response.tabId!==this.lease.tab) throw new Error('owner_lost');this.claimed=true;
  }
  private assertClaimed() {if(!this.claimed) throw new Error('remote_owner_unconfirmed');}
  async push(now=Date.now()) {
    this.assertClaimed();const batch=await this.repository.beginAttempt(this.lease,now);if(!batch.length) return [];
    let result:{results:PushResult[]};
    try {result=await this.post('sync/push',{operations:batch},'PushResponse',{'Idempotency-Key':uuid7()});}
    catch(error) {await this.repository.retry(this.lease,batch,error,now);throw error;}
    await this.repository.applyAck(this.lease,batch,result.results,now);return batch;
  }
  async snapshot() {
    this.assertClaimed();
    const manifest=await this.post<{snapshotId:string;highWaterRevision:string;expiresAt:string;entityCount:number;firstPageCursor:string}>('sync/snapshots',{},'SnapshotManifest');
    await this.repository.beginSnapshot(this.lease,manifest.snapshotId,manifest.highWaterRevision,manifest.firstPageCursor,manifest.expiresAt);
    let cursor:string|null=manifest.firstPageCursor,pullCursor:string|null=null,count=0;
    const visited=new Set<string>();
    while(cursor) {
      visited.add(cursor);
      const page:SnapshotPage=await this.post<SnapshotPage>(`sync/snapshots/${manifest.snapshotId}`,{pageCursor:cursor},'SnapshotPage');
      if(page.snapshotId!==manifest.snapshotId||page.highWaterRevision!==manifest.highWaterRevision||page.nextPageCursor&&visited.has(page.nextPageCursor)||page.complete!==!page.nextPageCursor||page.complete!==!!page.pullCursor||!page.complete&&!page.entities.length||count+page.entities.length>manifest.entityCount) throw new Error('snapshot_mismatch');
      await this.repository.stageSnapshot(this.lease,manifest.snapshotId,cursor,page.entities,page.nextPageCursor);count+=page.entities.length;cursor=page.nextPageCursor;pullCursor=page.pullCursor;
    }
    if(count!==manifest.entityCount||!pullCursor) throw new Error('incomplete_snapshot');
    const classified=new Map<string,AtCut>();
    for(;;) {
      const ids=(await this.repository.receiptIds(this.lease)).filter(id=>!classified.has(id));
      for(let offset=0;offset<ids.length;offset+=50) {
        const requested=ids.slice(offset,offset+50),expected=new Set(requested);
        const response=await this.post<{snapshotId:string;highWaterRevision:string;results:AtCut[]}>('sync/receipts',{snapshotId:manifest.snapshotId,operationIds:requested},'ReceiptsResponse');
        if(response.snapshotId!==manifest.snapshotId||response.highWaterRevision!==manifest.highWaterRevision) throw new Error('snapshot_mismatch');
        for(const item of response.results) {if(!expected.delete(item.operationId)) throw new Error('receipt_mismatch');classified.set(item.operationId,item);}
        if(expected.size) throw new Error('receipt_mismatch');
      }
      try {await this.repository.installSnapshot(this.lease,manifest.snapshotId,count,[...classified.values()],pullCursor);break;}
      catch(error) {if(!(error instanceof Error)||error.message!=='incomplete_classification') throw error;}
    }
  }
  async pull() {
    this.assertClaimed();let cursor=(await this.repository.read(this.lease,'9999-12-31')).state.cursor;
    if(cursor===null) {await this.snapshot();cursor=(await this.repository.read(this.lease,'9999-12-31')).state.cursor;}
    const page=await this.post<Pull>('sync/pull',{cursor,limit:500},'PullResponse');
    await this.repository.applyPull(this.lease,cursor,page);return page;
  }
}
// Presentation caches/drafts are document-only and expire on any journey/owner change.
// Call invalidate on pagehide/visibility hidden and before foreground revalidation.
export class Presentation<T> {
  private stamp:string|null=null;private value:T|null=null;private draft='';
  invalidate() {this.stamp=null;this.value=null;this.draft='';}
  reveal(lease:Lease,value:T) {const stamp=JSON.stringify([lease.installation,lease.account,lease.context,lease.generation,lease.tab,lease.epoch]);if(this.stamp!==stamp) this.invalidate();this.stamp=stamp;this.value=value;}
  edit(text:string) {if(!this.stamp) throw new Error('presentation_invalid');this.draft=text;}
  current() {return {value:this.value,draft:this.draft};}
  canReload(discardConfirmed:boolean) {return !this.draft||discardConfirmed;}
}
export type { Operation };
