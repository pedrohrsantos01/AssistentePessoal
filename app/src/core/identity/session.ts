import {Compatibility} from '../sync/compatibility.ts';
import {failureKind} from '../sync/retry.ts';
import {CLIENT,type ClientVersion} from '../sync/client-version.ts';
import {HttpSync,synchronize} from '../sync/synchronize.ts';
import * as validate from '../sync/generated/validate.cjs';
import type {AccountStore} from '../db/account-store.ts';
import {InstallationStore} from './installation-store.ts';
import type {Credentials,IdentityTransport,SecureVault} from './types.ts';

type OpenAccount=(accountId:string,guard:(write?:boolean)=>void)=>Promise<AccountStore>;
export type IdentitySource=IdentityTransport|((compatibility:Compatibility)=>IdentityTransport);
export class Session {
  private listeners=new Set<()=>void>();
  subscribe(listener:()=>void) {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  private notify() {for(const listener of this.listeners) listener();}
  networkState() {
    const state=this.control.state();
    return {updateRequired:!this.compatibility.requestsAllowed(),key:this.store&&state.session_state==='active'?state.selected_account_id+':'+state.session_generation:null,
      revocations:state.session_state!=='logging_out'&&this.control.keys().some(key=>key.purpose==='revocation'&&
        (state.session_state!=='active'||key.key!==state.revoke_key))};
  }
  private store:AccountStore|null=null;
  private credentials:Credentials|null=null;
  private serial:Promise<unknown>=Promise.resolve();
  private compatibility:Compatibility;
  private identity:IdentityTransport;
  access() {return this.compatibility.status();}
  constructor(private control:InstallationStore,private vault:SecureVault,identity:IdentitySource,
    private open:OpenAccount,private nextId:()=>string,client:ClientVersion=CLIENT) {
    this.compatibility=new Compatibility(control,client,()=>this.notify());
    this.identity=typeof identity==='function'?identity(this.compatibility):identity;
  }
  private exclusive<T>(work:()=>Promise<T>):Promise<T> {
    const result=this.serial.then(work);this.serial=result.catch(()=>undefined);return result;
  }
  private assertGeneration(generation:number) {
    if(this.control.state().session_generation!==generation) throw new Error('session_locked');
  }
  private async openCurrent() {
    const state=this.control.state();
    if(state.session_state!=='active'||!state.selected_account_id) return;
    const generation=state.session_generation,account=state.selected_account_id;
    const guard=(write=false)=>{
      const current=this.control.state();
      if(current.session_generation!==generation||current.session_state!=='active'||current.selected_account_id!==account)
        throw new Error('session_locked');
      if(write) this.compatibility.assertWritable();
    };
    const opened=await this.open(account,guard);
    try {guard();this.store=opened;this.notify();} catch(error) {opened.close();throw error;}
  }
  account():AccountStore {
    if(!this.store||this.control.state().session_state!=='active') throw new Error('session_locked');
    return this.store;
  }
  login(email:string,password:string) {
    return this.authenticate(device=>this.identity.login(email,password,device));
  }
  register(email:string,password:string,displayName:string) {
    return this.authenticate(device=>this.identity.register(email,password,displayName,device));
  }
  private async identityRequest<T>(request:()=>Promise<T>):Promise<T> {
    this.compatibility.assertRequestAllowed();
    const generation=this.control.state().session_generation;
    try {
      const result=await request();this.assertGeneration(generation);this.compatibility.assertRequestAllowed();return result;
    } catch(error) {
      this.assertGeneration(generation);
      if(failureKind(error)==='update_required') this.compatibility.requireUpdate();
      throw error;
    }
  }
  private async authenticate(request:(device:string)=>Promise<Credentials>) {
    const state=this.control.state();
    if(state.session_state==='logging_out') throw new Error('session_locked');
    const session=await this.identityRequest(async()=>{
      const result=await request(state.device_id);
      if(!validate.SessionResponse(result)||result.profile.accountId!==result.accountId) throw new Error('unsupported_protocol');
      return result;
    });
    await this.exclusive(async()=>{
      this.assertGeneration(state.session_generation);
      if(state.session_state==='active'&&state.selected_account_id!==session.accountId) throw new Error('logout_required');
      this.compatibility.accept();
      const key='ritmo.credentials.'+this.nextId(),revoke='ritmo.revocation.'+this.nextId();
      this.control.remember(revoke,'revocation',session.accountId,session.sessionId);
      await this.vault.set(revoke,session.revokeToken);
      this.control.remember(key,'credentials',session.accountId,session.sessionId);
      await this.vault.set(key,JSON.stringify(session));
      this.assertGeneration(state.session_generation);
      this.close();
      this.control.activate(session.accountId,key,revoke);
      this.credentials=session;
      await this.cleanCredentials();
      await this.openCurrent();
    });
  }
  async synchronize(origin:string,now:()=>number=Date.now,allowed:()=>boolean=()=>true) {
    this.compatibility.assertRequestAllowed();
    const store=this.account(),generation=this.control.state().session_generation;
    const api=new HttpSync(origin,store.accountId,async force=>{
      if(!allowed()) throw new Error('sync_paused');
      this.assertGeneration(generation);
      const token=await this.accessToken(force);
      this.assertGeneration(generation);if(!allowed()) throw new Error('sync_paused');return token;
    },this.nextId,this.compatibility);
    try {return await synchronize(store,api,now);}
    catch(error) {
      this.assertGeneration(generation);
      if(failureKind(error)==='update_required') this.compatibility.requireUpdate();
      throw error;
    }
  }
  private renewal:Promise<string>|null=null;
  async accessToken(force=false):Promise<string> {
    this.compatibility.assertRequestAllowed();
    if(this.control.state().session_state!=='active') throw new Error('session_locked');
    if(this.renewal) return this.renewal;
    const current=this.credentials;
    if(!current) throw new Error('authentication_required');
    if(!force&&Date.parse(current.accessExpiresAt)>Date.now()+30000) return current.accessToken;
    const generation=this.control.state().session_generation;
    // Detach the old refresh durably before sending: an ambiguous outcome must never replay it after restart.
    this.control.useCredentials(null);this.credentials=null;
    const renewal=this.rotate(current,generation);
    this.renewal=renewal;
    try {return await renewal;} finally {if(this.renewal===renewal) this.renewal=null;}
  }
  private async rotate(previous:Credentials,generation:number):Promise<string> {
    const renewed=await this.identityRequest(async()=>{
      const result=await this.identity.refresh(previous.refreshToken);
      if(!validate.RefreshResponse(result)||result.profile.accountId!==previous.accountId) throw new Error('unsupported_protocol');
      return result;
    });
    return this.exclusive(async()=>{
      this.assertGeneration(generation);
      if(renewed.accountId!==previous.accountId||renewed.sessionId!==previous.sessionId) throw new Error('session_mismatch');
      this.compatibility.accept();
      const session={...renewed,revokeToken:previous.revokeToken};
      const key='ritmo.credentials.'+this.nextId();
      this.control.remember(key,'credentials',session.accountId,session.sessionId);
      await this.vault.set(key,JSON.stringify(session));
      this.assertGeneration(generation);
      this.control.useCredentials(key);this.credentials=session;
      await this.cleanCredentials();
      return session.accessToken;
    });
  }
  private async cleanCredentials() {
    const current=this.control.state();
    for(const key of this.control.keys().filter(key=>key.purpose==='credentials'&&
      (current.session_state!=='active'||key.key!==current.credentials_key))) {
      await this.vault.remove(key.key);this.control.forget(key.key);
    }
  }
  logout():Promise<void> {
    // This durable fence precedes every await and every deletion of a secret.
    this.control.fence();
    this.close();
    return this.exclusive(async()=>{
      await this.cleanCredentials();
      this.control.lock();this.notify();
    });
  }
  flushRevocations(allowed:()=>boolean=()=>true):Promise<void> {
    return this.exclusive(async()=>{
      for(const key of this.control.keys().filter(key=>key.purpose==='revocation')) {
        const current=this.control.state();
        if(current.session_state==='logging_out') throw new Error('session_locked');
        if(current.session_state==='active'&&current.revoke_key===key.key) continue;
        if(!allowed()) throw new Error('sync_paused');
        const token=await this.vault.get(key.key);
        if(!allowed()) throw new Error('sync_paused');
        if(token) await this.identityRequest(()=>this.identity.revoke(token));
        await this.vault.remove(key.key);this.control.forget(key.key);
      }
    });
  }
  async restore() {
    if(this.control.state().session_state==='logging_out') {await this.logout();return;}
    await this.exclusive(async()=>{
      const state=this.control.state();
      if(state.session_state==='active'&&state.credentials_key) {
        const value=await this.vault.get(state.credentials_key);
        this.assertGeneration(state.session_generation);
        let parsed:unknown=null;
        try {parsed=value?JSON.parse(value):null;} catch { /* Invalid protected data requires online authentication. */ }
        const metadata=this.control.keys().find(key=>key.key===state.credentials_key);
        const candidate=validate.SessionResponse(parsed)?parsed as Credentials:null;
        if(candidate&&candidate.accountId===state.selected_account_id&&candidate.profile.accountId===candidate.accountId&&candidate.sessionId===metadata?.session_id) {
          this.credentials=candidate;
        } else {this.control.useCredentials(null);this.credentials=null;}
      }
      await this.cleanCredentials();
      await this.openCurrent();
    });
  }
  close() {this.store?.close();this.store=null;this.credentials=null;this.renewal=null;this.notify();}
}
