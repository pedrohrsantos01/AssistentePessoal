import SQLite from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Session} from '../../src/core/identity/session.ts';
import {InstallationStore} from '../../src/core/identity/installation-store.ts';
import {AccountStore} from '../../src/core/db/account-store.ts';
import {SyncScheduler,type SyncClock} from '../../src/core/sync/scheduler.ts';
import {Journey} from '../../src/features/journey/journey.ts';
import {openLocalSession} from '../../src/core/identity/session-opening.ts';
import type {LocalStorage,DatabaseKind} from '../../src/core/db/local-opening.ts';
import type {Credentials,IdentityTransport,PasswordResetTransport} from '../../src/core/identity/types.ts';
const id=(n:number)=>'01996300-0000-7000-8000-'+String(n).padStart(12,'0');
export function fixture() {
 const directory=mkdtempSync(join(tmpdir(),'ritmo-component-')),control=new SQLite(join(directory,'control.db'));
 const db=drizzle(control);migrate(db,{migrationsFolder:join(process.cwd(),'drizzle-control')});
 const storage=new Map<string,string>(),at=Date.parse('2026-10-09T13:00:00Z');let sequence=100;
 const clock:SyncClock={now:()=>at,schedule:()=>()=>{}};
 const credentials=(accountId:string):Credentials=>({accountId,sessionId:id(30),accessToken:'fixture-access-token-for-component-tests',accessExpiresAt:'2099-10-09T13:00:00Z',refreshToken:'fixture-refresh-token-for-component-tests',refreshExpiresAt:'2099-11-09T13:00:00Z',revokeToken:'fixture-revoke-token-for-component-tests',profile:{accountId,displayName:accountId===id(1)?'Pessoa A':'Pessoa B',timeContext:{timezone:'UTC',dayStartHour:4},plan:'free',onboardedAt:null,analyticsConsentAt:null,revision:'0'}});
 const identity:IdentityTransport&PasswordResetTransport={async login(email){return credentials(email.startsWith('a')?id(1):id(2));},async register(){return credentials(id(1));},async refresh(){throw new Error('authentication_required');},async revoke(){},async requestPasswordReset(){},async confirmPasswordReset(){}};
 let requireUpdate=()=>{};
 const vault:import('../../src/core/identity/types.ts').SecureVault={async get(k){return storage.get(k)??null;},async set(k,v){storage.set(k,v);},async remove(k){storage.delete(k);}};
 const session=new Session(new InstallationStore(db,id(40)),vault,compatibility=>{requireUpdate=()=>compatibility.requireUpdate();return identity;},async(account,guard)=>{
  const sqlite=new SQLite(join(directory,account+'.db')),database=drizzle(sqlite);migrate(database,{migrationsFolder:join(process.cwd(),'drizzle')});
  return new AccountStore(database,account,id(40),()=>sqlite.close(),guard);
 },()=>id(++sequence));
 // Component tests keep remote I/O separate; commands and databases remain real.
 jest.spyOn(session,'synchronize').mockResolvedValue(undefined);
 const scheduler=new SyncScheduler(session,'http://fixture.invalid',clock);
 const journey=new Journey({session,identity,sync:scheduler,recovery:()=>session.databaseRecovery(),retryDatabase:()=>session.retryDatabase(),close:()=>{}},()=>id(++sequence),clock);
 return {journey,session,scheduler,vault,identity,requireUpdate:()=>requireUpdate(),path:()=>join(directory,id(1)+'.db'),close(){journey.dispose();scheduler.dispose();session.close();control.close();rmSync(directory,{recursive:true,force:true});}};
}

export async function openingFixture(initialFault:DatabaseKind|null=null) {
 const directory=mkdtempSync(join(tmpdir(),'ritmo-opening-component-'));let fault=initialFault,sequence=200;
 const values=new Map<string,string>(),handles:SQLite.Database[]=[];
 const storage:LocalStorage={
  journal:kind=>JSON.parse(readFileSync(join(process.cwd(),kind==='installation'?'drizzle-control':'drizzle','meta/_journal.json'),'utf8')) as {entries:{when:number}[]},
  open(name,kind){
   if(kind===fault) throw Object.assign(new Error('private_path_and_credential'),{code:'SQLITE_CANTOPEN'});
   const sqlite=new SQLite(join(directory,name));handles.push(sqlite);const db=drizzle(sqlite);
   return {db,exec:sql=>sqlite.exec(sql),close:()=>sqlite.close(),migrate:()=>migrate(db,{migrationsFolder:join(process.cwd(),kind==='installation'?'drizzle-control':'drizzle')})};
  },
 };
 const source=fixture();const identity=source.identity;source.close();
 const owner=await openLocalSession(storage,{async get(k){return values.get(k)??null;},async set(k,v){values.set(k,v);},async remove(k){values.delete(k);}},identity,()=>id(++sequence));
 const clock:SyncClock={now:()=>Date.parse('2026-10-09T13:00:00Z'),schedule:()=>()=>{}};let scheduler:SyncScheduler|null=null;
 const start=()=>{if(!owner.recovery()||owner.recovery()?.scope==='account') scheduler??=new SyncScheduler(owner.session,'http://fixture.invalid',clock);};start();
 const runtime={identity,get session(){return owner.session;},get sync(){if(!scheduler) throw new Error('installation_locked');return scheduler;},recovery:()=>owner.recovery(),async retryDatabase(){await owner.retryDatabase();start();},close(){scheduler?.dispose();owner.close();}};
 const journey=new Journey(runtime,()=>id(++sequence),clock);
 return {journey,owner,identity,get scheduler(){return runtime.sync;},fault:(kind:DatabaseKind|null)=>{fault=kind;},close(){journey.dispose();for(const handle of handles) if(handle.open) handle.close();rmSync(directory,{recursive:true,force:true});}};
}
