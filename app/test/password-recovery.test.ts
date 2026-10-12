import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PasswordRecovery} from '../src/features/journey/password-recovery.ts';
import {IdentityHttpError} from '../src/core/identity/http-identity.ts';
import {receivePasswordResetPath,consumePasswordResetIntent} from '../src/core/identity/password-reset-intent.ts';
import {pt} from '../src/i18n/pt-BR.ts';
const origin='https://api.example.test',token='A'.repeat(43);
function fixture() {
 let online=true,at=0;const requests:string[]=[],confirms:{token:string;password:string}[]=[],timers:{at:number;run:()=>void;active:boolean}[]=[];
 const api={async requestPasswordReset(email:string){requests.push(email);},async confirmPasswordReset(token:string,password:string){confirms.push({token,password});}};
 const recovery=new PasswordRecovery(()=>api,()=>online,{now:()=>at,schedule(delay,run){const timer={at:at+delay,run,active:true};timers.push(timer);return ()=>{timer.active=false;};}});
 return {recovery,api,requests,confirms,online:(value:boolean)=>{online=value;},advance(ms:number){at+=ms;for(const timer of timers)if(timer.active&&timer.at<=at){timer.active=false;timer.run();}}};
}
test('request validates email, preserves aliases and reports uniform acceptance',async()=>{
 const f=fixture();f.recovery.request();await f.recovery.send('invalid');assert.equal(f.recovery.state().error,pt.invalidEmail);assert.deepEqual(f.requests,[]);await f.recovery.send(' A.B+tag@example.test ');assert.deepEqual(f.requests,['a.b+tag@example.test']);assert.equal(f.recovery.state().view,'sent');f.recovery.dispose();
});
test('native intent sanitizes navigation and consumes its transient mailbox once',()=>{
 assert.equal(receivePasswordResetPath(origin+'/password-reset#token='+token,origin),'/');assert.deepEqual(consumePasswordResetIntent(),{kind:'valid',token});assert.equal(consumePasswordResetIntent(),null);
 for(const url of ['https://foreign.test/password-reset#token='+token,origin+'/password-reset?token='+token,origin+'/password-reset#token=short','ritmo://password-reset#token='+token]){assert.equal(receivePasswordResetPath(url,origin),'/');assert.deepEqual(consumePasswordResetIntent(),{kind:'invalid'});}
 assert.equal(receivePasswordResetPath('ritmo:///?ritmoTestFault=reset-429',origin),'/');assert.equal(consumePasswordResetIntent(),null);
});
test('opening never confirms or exposes the secret and confirmation preserves Unicode exactly',async()=>{
 const f=fixture();f.recovery.open({kind:'valid',token});assert.equal(f.confirms.length,0);assert.ok(!JSON.stringify(f.recovery.state()).includes(token));await f.recovery.confirm('short');assert.equal(f.recovery.state().error,pt.invalidPassword);await f.recovery.confirm('\uD800'.repeat(8));assert.equal(f.confirms.length,0);
 const password='  senha 🌱 nova  ';await f.recovery.confirm(password);assert.deepEqual(f.confirms,[{token,password}]);assert.equal(f.recovery.state().view,'complete');await f.recovery.confirm(password);assert.equal(f.confirms.length,1);f.recovery.dispose();
});
test('offline and transient errors preserve the intent for a deliberate retry',async()=>{
 const f=fixture();f.recovery.open({kind:'valid',token});f.online(false);await f.recovery.confirm('new-password');assert.equal(f.recovery.state().error,pt.recoveryOffline);assert.equal(f.confirms.length,0);f.online(true);const confirm=f.api.confirmPasswordReset;f.api.confirmPasswordReset=async()=>{throw new IdentityHttpError(503,'temporarily_unavailable');};await f.recovery.confirm('new-password');assert.equal(f.recovery.state().view,'confirm');assert.equal(f.recovery.state().error,pt.serviceUnavailable);f.api.confirmPasswordReset=confirm;await f.recovery.confirm('new-password');assert.equal(f.confirms[0]?.token,token);f.recovery.dispose();
});
test('used or expired links allow requesting another without creating a session',async()=>{
 const f=fixture();f.api.confirmPasswordReset=async()=>{throw new IdentityHttpError(401,'reset_invalid');};f.recovery.open({kind:'valid',token});await f.recovery.confirm('new-password');assert.equal(f.recovery.state().view,'invalid');f.recovery.request();await f.recovery.send('a@example.test');assert.equal(f.recovery.state().view,'sent');f.recovery.dispose();
});
test('Retry-After survives reopening, without automatic mail or blocking a different endpoint',async()=>{
 const f=fixture();const send=f.api.requestPasswordReset;let count=0;f.api.requestPasswordReset=async()=>{count++;throw new IdentityHttpError(429,'rate_limit','3');};f.recovery.request();await f.recovery.send('a@example.test');assert.equal(f.recovery.state().retryAt,3000);f.recovery.close();f.recovery.request();await f.recovery.send('b@example.test');assert.equal(count,1);f.advance(2999);await f.recovery.send('a@example.test');assert.equal(count,1);f.recovery.open({kind:'valid',token});await f.recovery.confirm('new-password');assert.equal(f.confirms.length,1);f.recovery.request();f.advance(1);assert.equal(f.recovery.state().retryAt,null);assert.equal(count,1);f.api.requestPasswordReset=send;await f.recovery.send('a@example.test');assert.deepEqual(f.requests,['a@example.test']);f.recovery.dispose();
});
test('late replies cannot replace a new link or revive a closed view',async()=>{
 const f=fixture();let resolve!:()=>void;f.api.requestPasswordReset=()=>new Promise<void>(done=>{resolve=done;});f.recovery.request();const request=f.recovery.send('a@example.test');f.recovery.open({kind:'valid',token});resolve();await request;assert.equal(f.recovery.state().view,'confirm');f.recovery.close();assert.equal(f.recovery.state().view,null);f.recovery.dispose();
});
