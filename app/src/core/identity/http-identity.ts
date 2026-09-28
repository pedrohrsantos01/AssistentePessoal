import * as validate from '../sync/generated/validate.cjs';
import type {Credentials,RenewedCredentials,IdentityTransport} from './types.ts';
export class IdentityHttpError extends Error {
  constructor(readonly status:number,readonly code:string,readonly retryAfter:string|null=null) {super(code);}
}
export class HttpIdentity implements IdentityTransport {
  constructor(private origin:string) {}
  private async request(path:string,body:unknown):Promise<unknown> {
    const response=await fetch(this.origin+'/api/v1/auth/'+path,{method:'POST',
      headers:{'Content-Type':'application/json','X-Ritmo-Protocol':'m1.1','X-App-Version':'0.1.0'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!response.ok) {
      const result:unknown=await response.json().catch(()=>undefined);let code='http_error';
      if(result&&typeof result==='object'&&'error' in result&&result.error&&typeof result.error==='object'&&'code' in result.error&&typeof result.error.code==='string') code=result.error.code;
      throw new IdentityHttpError(response.status,code,response.headers.get('Retry-After'));
    }
    return response.status===204||response.status===202?undefined:await response.json() as unknown;
  }
  async login(email:string,password:string,deviceId:string):Promise<Credentials> {
    const result=await this.request('login',{email,password,deviceId});
    if(!validate.SessionResponse(result)) throw new Error('unsupported_protocol');
    return result as Credentials;
  }
  async register(email:string,password:string,displayName:string,deviceId:string):Promise<Credentials> {
    const result=await this.request('register',{email,password,displayName,deviceId});
    if(!validate.SessionResponse(result)) throw new Error('unsupported_protocol');
    return result as Credentials;
  }
  async refresh(refreshToken:string):Promise<RenewedCredentials> {
    const result=await this.request('refresh',{refreshToken});
    if(!validate.RefreshResponse(result)) throw new Error('unsupported_protocol');
    return result as RenewedCredentials;
  }
  async confirmPasswordReset(resetToken:string,newPassword:string) {await this.request('password-reset/confirm',{resetToken,newPassword});}
  async requestPasswordReset(email:string) {await this.request('password-reset/request',{email});}
  async revoke(revokeToken:string) {await this.request('revoke',{revokeToken});}
}
