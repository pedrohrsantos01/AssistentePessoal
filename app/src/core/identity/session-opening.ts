import {AccountStore} from '../db/account-store.ts';
import {LocalRecoveryRequired,type DatabaseRecovery} from '../db/local-migrations.ts';
import {openLocalDatabase,type LocalStorage} from '../db/local-opening.ts';
import {InstallationStore} from './installation-store.ts';
import {Session,type IdentitySource} from './session.ts';
import type {SecureVault} from './types.ts';

export async function openLocalAccount(storage:LocalStorage,account:string,device:string,guard:(write?:boolean)=>void=()=>{}) {
  if(!/^[0-9a-f-]{36}$/.test(account)) throw new Error('invalid_account_id');
  return (await openLocalDatabase(storage,'account','account-'+account+'.db',
    (db,close)=>new AccountStore(db,account,device,close,guard))).value;
}
export async function openLocalSession(storage:LocalStorage,vault:SecureVault,identity:IdentitySource,nextId:()=>string) {
  const owner=new SessionOpening(storage,vault,identity,nextId);await owner.retryDatabase();return owner;
}
export class SessionOpening {
  private current:Session|null=null;
  private shutdown:(()=>void)|null=null;
  private failure:LocalRecoveryRequired|null=null;
  private closed=false;
  private attempt:Promise<void>|null=null;
  constructor(private storage:LocalStorage,private vault:SecureVault,private identity:IdentitySource,private nextId:()=>string) {}
  get session():Session {if(!this.current) throw new Error('installation_locked');return this.current;}
  recovery():DatabaseRecovery|null {return this.failure?.diagnostic('installation')??this.current?.databaseRecovery()??null;}
  async retryDatabase():Promise<void> {
    if(this.closed) throw new Error('session_locked');
    if(this.current) {await this.current.retryDatabase();return;}
    if(this.attempt) return this.attempt;
    const attempt=this.open();this.attempt=attempt;
    try {await attempt;} finally {if(this.attempt===attempt) this.attempt=null;}
  }
  private async open() {
    let acquired:{value:InstallationStore;close:()=>void}|undefined,session:Session|undefined;
    try {
      acquired=await openLocalDatabase(this.storage,'installation','installation.db',db=>{
        const control=new InstallationStore(db,this.nextId());control.state();control.keys();control.blockedClient();return control;
      });
      if(this.closed) throw new Error('session_locked');
      const control=acquired.value;
      session=new Session(control,this.vault,this.identity,(account,guard)=>openLocalAccount(this.storage,account,control.state().device_id,guard),this.nextId);
      await session.restore();
      if(this.closed) throw new Error('session_locked');
      this.current=session;this.shutdown=acquired.close;this.failure=null;
    } catch(error) {
      session?.close();
      try {acquired?.close();} catch(cleanup) {if(error instanceof LocalRecoveryRequired) error.cleanupCause=cleanup;}
      if(this.closed) throw new Error('session_locked');
      if(!(error instanceof LocalRecoveryRequired)) throw error;
      this.failure=error;
    }
  }
  close() {if(this.closed) return;this.closed=true;this.current?.close();this.current=null;this.shutdown?.();this.shutdown=null;}
}
