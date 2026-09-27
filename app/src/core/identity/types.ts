export type Credentials={
  accountId:string;sessionId:string;accessToken:string;accessExpiresAt:string;
  refreshToken:string;refreshExpiresAt:string;revokeToken:string;
  profile:{accountId:string;displayName:string;timeContext:{timezone:string;dayStartHour:number};
    plan:'free'|'pro';onboardedAt:string|null;analyticsConsentAt:string|null;revision:string};
};
export type RenewedCredentials=Omit<Credentials,'revokeToken'>;
export interface SecureVault {
  get(key:string):Promise<string|null>;
  set(key:string,value:string):Promise<void>;
  remove(key:string):Promise<void>;
}
export interface IdentityTransport {
  login(email:string,password:string,deviceId:string):Promise<Credentials>;
  register(email:string,password:string,displayName:string,deviceId:string):Promise<Credentials>;
  refresh(refreshToken:string):Promise<RenewedCredentials>;
  revoke(revokeToken:string):Promise<void>;
}
