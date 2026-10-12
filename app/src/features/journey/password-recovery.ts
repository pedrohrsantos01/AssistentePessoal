import {IdentityHttpError} from '../../core/identity/http-identity.ts';
import type {PasswordResetTransport,ResetIntent} from '../../core/identity/types.ts';
import {retryDelay} from '../../core/sync/retry.ts';
import {systemClock,type SyncClock} from '../../core/sync/scheduler.ts';
import {pt} from '../../i18n/pt-BR.ts';
export type PasswordRecoveryState={view:null|'request'|'sent'|'confirm'|'invalid'|'complete';busy:boolean;error:string|null;sentEmail:string;retryAt:number|null};
const idle=():PasswordRecoveryState=>({view:null,busy:false,error:null,sentEmail:'',retryAt:null});
// The secret is intentionally absent from public state, navigation and storage.
export class PasswordRecovery {
 private snapshot=idle();private token:string|null=null;private epoch=0;private stopped=false;
 private waits=new Map<'request'|'confirm',number>();private timers=new Map<'request'|'confirm',()=>void>();private listeners=new Set<()=>void>();
 constructor(private transport:()=>PasswordResetTransport|undefined,private online:()=>boolean,private clock:SyncClock=systemClock) {}
 state=()=>this.snapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 private publish(state:PasswordRecoveryState) {this.snapshot=state;for(const listener of this.listeners) listener();}
 private reset(view:PasswordRecoveryState['view'],token:string|null=null) {this.epoch++;this.token=token;this.publish({...idle(),view,retryAt:view==='request'||view==='confirm'?this.waits.get(view)??null:null});}
 request() {if(!this.stopped)this.reset('request');}
 open(intent:ResetIntent) {if(this.stopped)return;this.reset(intent.kind==='valid'?'confirm':'invalid',intent.kind==='valid'?intent.token:null);}
 close() {if(!this.stopped)this.reset(null);}
 private error(message:string) {this.publish({...this.snapshot,error:message});}
 private async perform(work:(transport:PasswordResetTransport)=>Promise<void>,done:()=>void) {
  if(this.stopped||this.snapshot.busy||this.snapshot.retryAt!==null&&this.snapshot.retryAt>this.clock.now())return;
  if(!this.online()) {this.error(pt.recoveryOffline);return;}
  const epoch=this.epoch,view=this.snapshot.view;this.publish({...this.snapshot,busy:true,error:null});
  try {const transport=this.transport();if(!transport)throw new Error('recovery_unavailable');await work(transport);if(this.stopped||epoch!==this.epoch)return;done();}
  catch(error) {
   if(this.stopped||epoch!==this.epoch)return;
   if(error instanceof IdentityHttpError&&error.code==='reset_invalid') {this.reset('invalid');return;}
   const message=error instanceof IdentityHttpError&&error.status===429?pt.rateLimit:error instanceof IdentityHttpError&&error.status>=500?pt.serviceUnavailable:error instanceof IdentityHttpError&&error.status===426||error instanceof Error&&['update_required','unsupported_protocol'].includes(error.message)?pt.update:pt.recoveryFailure;
   this.error(message);
   if(error instanceof IdentityHttpError&&error.status===429&&(view==='request'||view==='confirm')) {
    const delay=retryDelay(1,error,this.clock.now()),at=this.clock.now()+delay;this.waits.set(view,at);this.publish({...this.snapshot,retryAt:at});
    this.timers.get(view)?.();this.timers.set(view,this.clock.schedule(delay,()=>{this.waits.delete(view);this.timers.delete(view);if(!this.stopped&&this.snapshot.view===view)this.publish({...this.snapshot,retryAt:null});}));
   }
  } finally {if(!this.stopped&&epoch===this.epoch)this.publish({...this.snapshot,busy:false});}
 }
 async send(email:string) {
  if(this.snapshot.view!=='request')return;
  email=email.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254){this.error(pt.invalidEmail);return;}
  const normalized=email.toLowerCase();await this.perform(api=>api.requestPasswordReset(normalized),()=>this.publish({...this.snapshot,view:'sent',sentEmail:normalized}));
 }
 async confirm(password:string) {
  if(this.snapshot.view!=='confirm'||!this.token)return;
  const characters=Array.from(password);if(characters.length<8||characters.length>128||characters.some(c=>/^[\uD800-\uDFFF]$/.test(c))){this.error(pt.invalidPassword);return;}
  const token=this.token;await this.perform(api=>api.confirmPasswordReset(token,password),()=>{this.token=null;this.publish({...this.snapshot,view:'complete'});});
 }
 dispose() {this.epoch++;this.stopped=true;this.token=null;this.snapshot=idle();this.timers.forEach(cancel=>cancel());this.timers.clear();this.waits.clear();this.listeners.clear();}
}
