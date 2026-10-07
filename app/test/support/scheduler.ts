import {operationHash} from '../../src/core/sync/operation-hash.ts';
import type {Compatibility} from '../../src/core/sync/compatibility.ts';
import {CLIENT,type ClientVersion} from '../../src/core/sync/client-version.ts';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import SQLite from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {fileURLToPath} from 'node:url';
import {Session} from '../../src/core/identity/session.ts';
import {InstallationStore} from '../../src/core/identity/installation-store.ts';
import type {Credentials,IdentityTransport} from '../../src/core/identity/types.ts';
import {openTestStore} from './store.ts';

export const id=(n:number)=>'01996300-0000-7000-8000-'+String(n).padStart(12,'0');
export const day='2026-09-25',at='2026-09-25T13:00:00Z';
export const command={type:'habit.create',habitId:id(3),title:'Caminhar',habitType:'binary',scheduleKind:'daily',startDayKey:day,
  timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},iconKey:null,colorToken:null,sortOrder:0} as const;
export const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
export class Clock {
  time=Date.parse(at);
  private tasks=new Set<{at:number;run:()=>void}>();
  now=()=>this.time;
  schedule=(delay:number,run:()=>void)=>{const task={at:this.time+delay,run};this.tasks.add(task);return ()=>{this.tasks.delete(task);};};
  async advance(ms:number) {
    const end=this.time+ms;
    for(;;) {
      const task=[...this.tasks].filter(task=>task.at<=end).sort((a,b)=>a.at-b.at)[0];
      if(!task) break;
      this.time=task.at;this.tasks.delete(task);task.run();await settle();
    }
    this.time=end;await settle();
  }
}
export function credentials(accountId:string):Credentials {
  return {accountId,sessionId:id(6),accessToken:'access-fixture-'+accountId,refreshToken:'refresh-fixture-'+accountId,
    revokeToken:'revoke-fixture-'+accountId,accessExpiresAt:'2099-10-25T13:00:00Z',refreshExpiresAt:'2099-11-25T13:00:00Z',
    profile:{accountId,displayName:'Pessoa',timeContext:{timezone:'UTC',dayStartHour:4},plan:'free',onboardedAt:null,analyticsConsentAt:null,revision:'0'}};
}
export function fixture(source?:(compatibility:Compatibility)=>IdentityTransport) {
  const directory=mkdtempSync(join(tmpdir(),'ritmo-scheduler-')),sqlite=new SQLite(join(directory,'installation.db')),db=drizzle(sqlite);
  migrate(db,{migrationsFolder:fileURLToPath(new URL('../../drizzle-control',import.meta.url))});
  const control=new InstallationStore(db,id(2)),values=new Map<string,string>(),revoked:string[]=[];
  const vault={async get(key:string){return values.get(key)??null;},async set(key:string,value:string){values.set(key,value);},async remove(key:string){values.delete(key);}};
  const identity:IdentityTransport={async login(email){return credentials(email==='a'?id(1):id(99));},async register(){return credentials(id(1));},
    async refresh(){throw new Error('authentication_required');},async revoke(token){revoked.push(token);}};
  let sequence=100,client:ClientVersion=CLIENT;
  const create=()=>new Session(control,vault,source??identity,(account,guard)=>Promise.resolve(openTestStore(join(directory,account+'.db'),account,id(2),guard)),()=>id(++sequence),client);
  let session=create();
  return {get session(){return session;},identity,revoked,
    async restart(nextClient=client){session.close();client=nextClient;session=create();await session.restore();},
    close(){session.close();sqlite.close();rmSync(directory,{recursive:true,force:true});}};
}
export const pull=(cursor:string)=>Response.json({changes:[],nextCursor:cursor,hasMore:false,highWaterRevision:'0',serverTime:at});

export function acceptedCreate(operationId:string) {
  return Response.json({results:[{receipt:{operationId,operationHash:operationHash({operationId,deviceId:id(2),clientSequence:1,occurredAt:at,dependsOn:[],command}),status:'accepted',acceptedRevision:'1'},replayed:false,
    projections:[{kind:'habit',value:{habitId:command.habitId,title:command.title,habitType:'binary',scheduleKind:'daily',startDayKey:day,
      creationTimeContext:command.timeContext,iconKey:null,colorToken:null,sortOrder:0,createdAt:at,updatedAt:at,deletedAt:null,revision:'1'}}]}],serverTime:at});
}
