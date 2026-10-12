import {resetTokenFromLink} from './reset-link.ts';
import type {ResetIntent} from './types.ts';
// One transient native intent; never retain the incoming URL in router params.
let pending:ResetIntent|null=null;
const listeners=new Set<()=>void>();
export function receivePasswordResetPath(path:string,expectedOrigin:string|undefined):string {
 let reset=false;try {const url=new URL(path,'ritmo:///');reset=url.pathname==='/password-reset'||url.hostname==='password-reset'||url.hash.startsWith('#token=');}catch {reset=path.includes('password-reset');}
 if(reset) {
  try {if(!expectedOrigin)throw new Error('origin_missing');pending={kind:'valid',token:resetTokenFromLink(path,expectedOrigin)};}catch {pending={kind:'invalid'};}
  for(const listener of listeners)listener();
 }
 return '/';
}
export function consumePasswordResetIntent():ResetIntent|null {const intent=pending;pending=null;return intent;}
export function subscribePasswordResetIntent(listener:()=>void) {listeners.add(listener);return ()=>{listeners.delete(listener);};}
