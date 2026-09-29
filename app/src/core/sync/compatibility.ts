import type {InstallationStore} from '../identity/installation-store.ts';
import {CLIENT,type ClientVersion} from './client-version.ts';

export class Compatibility {
  private blocked:string|null;
  readonly key:string;
  constructor(private control:InstallationStore,readonly client:ClientVersion=CLIENT,private changed:()=>void=()=>{}) {
    this.key=client.appVersion+'|'+client.protocol;this.blocked=control.blockedClient();
  }
  status() {return {mode:this.blocked?'read_only' as const:'read_write' as const,reason:this.blocked?'update_required' as const:null};}
  requestsAllowed() {return this.blocked!==this.key;}
  assertWritable() {if(this.blocked) throw new Error('update_required');}
  assertRequestAllowed() {if(!this.requestsAllowed()) throw new Error('update_required');}
  captureRequest() {
    this.assertRequestAllowed();const generation=this.control.state().session_generation;
    return ()=>{
      if(generation!==this.control.state().session_generation) throw new Error('session_locked');
      this.assertRequestAllowed();
    };
  }
  accept() {
    if(this.blocked&&this.blocked!==this.key) {this.control.blockClient(null);this.blocked=null;this.changed();}
  }
  requireUpdate() {
    this.blocked=this.key;
    try {this.control.blockClient(this.key);} finally {this.changed();}
  }
}
