import type { MainDatabase } from './database.ts';
import { check } from './database.ts';
import { increment, type Control, type Owner } from './records.ts';
export const commitGate='ritmo:web:commit:v1';
export const presenceName=(tab:string)=>`ritmo:web:document:${tab}`;
export class Coordinator {
  private present=false;
  private releasePresence: (()=>void)|undefined;
  private presenceTask: Promise<void>|undefined;
  constructor(readonly tab: string, private locks: LockManager) {}
  async start() {
    if(this.presenceTask) throw new Error('document_already_started');
    let resolveReady:()=>void=()=>{},rejectReady:(error:unknown)=>void=()=>{};
    const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    this.presenceTask=this.locks.request(presenceName(this.tab),{ifAvailable:true},async lock=>{
      if(!lock) throw new Error('duplicate_document');
      this.present=true;resolveReady();
      await new Promise<void>(resolve=>{this.releasePresence=resolve;});
      this.present=false;
    }).catch((error:unknown)=>{this.present=false;rejectReady(error);});
    await ready;
  }
  assertPresent() {if(!this.present) throw new Error('document_inactive');}
  async gate<T>(work:()=>Promise<T>):Promise<T> {
    this.assertPresent();
    return this.locks.request(commitGate,async()=>{this.assertPresent();return work();});
  }
  async acquire(db: MainDatabase, explicit=false):Promise<Owner|null> {
    this.assertPresent();
    const captured=await db.installation_control.get(1);check('Control',captured);
    if(captured.owner_tab_id===this.tab) return Object.freeze({tab:this.tab,epoch:captured.owner_epoch});
    const publish=()=>this.gate(()=>db.transaction('rw',db.installation_control,async()=>{
      const current=await db.installation_control.get(1);check('Control',current);
      // Explicit transfer still uses a CAS: losing contenders must not adopt the winner.
      if(current.owner_tab_id!==captured.owner_tab_id||current.owner_epoch!==captured.owner_epoch) return null;
      const epoch=increment(current.owner_epoch);
      await db.installation_control.put({...current,owner_tab_id:this.tab,owner_epoch:epoch});
      return Object.freeze({tab:this.tab,epoch});
    }));
    if(explicit||captured.owner_tab_id===null) return publish();
    return this.locks.request(presenceName(captured.owner_tab_id),{ifAvailable:true},lock=>lock?publish():Promise.resolve(null));
  }
  async stop() {this.present=false;this.releasePresence?.();await this.presenceTask;}
}
export function assertOwner(control: Control, owner: Owner) {
  if(control.owner_tab_id!==owner.tab||control.owner_epoch!==owner.epoch) throw new Error('owner_lost');
}
