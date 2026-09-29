import {CLIENT} from '../sync/client-version.ts';
import type {Compatibility} from '../sync/compatibility.ts';
import {failureKind} from '../sync/retry.ts';
import * as validate from '../sync/generated/validate.cjs';
import type {Credentials,RenewedCredentials,IdentityTransport} from './types.ts';
export class IdentityHttpError extends Error {
  constructor(readonly status:number,readonly code:string,readonly retryAfter:string|null=null) {super(code);}
}
export class HttpIdentity implements IdentityTransport {
  constructor(private origin:string,private compatibility?:Compatibility) {}
  private async request(path:string,body:unknown,check?:(data:unknown)=>boolean):Promise<unknown> {
    const current=this.compatibility?.captureRequest()??(()=>{}),client=this.compatibility?.client??CLIENT;
    try {
      const response=await fetch(this.origin+'/api/v1/auth/'+path,{method:'POST',
        headers:{'Content-Type':'application/json','X-Ritmo-Protocol':client.protocol,'X-App-Version':client.appVersion},
        body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
      current();
      const result:unknown=response.status===204||response.status===202?undefined:await response.json().catch(()=>undefined);
      current();
      if(!response.ok) {
        let code='http_error';
        if(result&&typeof result==='object'&&'error' in result&&result.error&&typeof result.error==='object'&&'code' in result.error&&typeof result.error.code==='string') code=result.error.code;
        throw new IdentityHttpError(response.status,code,response.headers.get('Retry-After'));
      }
      if(check&&!check(result)) throw new Error('unsupported_protocol');
      return result;
    } catch(error) {
      current();if(failureKind(error)==='update_required') this.compatibility?.requireUpdate();throw error;
    }
  }
  async login(email:string,password:string,deviceId:string):Promise<Credentials> {
    const result=await this.request('login',{email,password,deviceId},validate.SessionResponse);
    return result as Credentials;
  }
  async register(email:string,password:string,displayName:string,deviceId:string):Promise<Credentials> {
    const result=await this.request('register',{email,password,displayName,deviceId},validate.SessionResponse);
    return result as Credentials;
  }
  async refresh(refreshToken:string):Promise<RenewedCredentials> {
    const result=await this.request('refresh',{refreshToken},validate.RefreshResponse);
    return result as RenewedCredentials;
  }
  async confirmPasswordReset(resetToken:string,newPassword:string) {await this.request('password-reset/confirm',{resetToken,newPassword});}
  async requestPasswordReset(email:string) {await this.request('password-reset/request',{email});}
  async revoke(revokeToken:string) {await this.request('revoke',{revokeToken});}
}
