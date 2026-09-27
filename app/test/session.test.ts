import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import SQLite from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {fileURLToPath} from 'node:url';
import {Session} from '../src/core/identity/session.ts';
import {InstallationStore} from '../src/core/identity/installation-store.ts';
import type {Credentials,IdentityTransport,SecureVault} from '../src/core/identity/types.ts';
import {openTestStore} from './support/store.ts';

export const a='01996300-0000-7000-8000-000000000001',b='01996300-0000-7000-8000-000000000099';
const device='01996300-0000-7000-8000-000000000002';
export const command={type:'habit.create',habitId:'01996300-0000-7000-8000-000000000003',title:'Caminhar',habitType:'binary',scheduleKind:'daily',startDayKey:'2026-09-25',timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},iconKey:null,colorToken:null,sortOrder:0} as const;
export function credentials(accountId:string):Credentials {
  return {accountId,sessionId:'01996300-0000-7000-8000-000000000006',accessToken:'access-fixture-'+accountId,
    refreshToken:'refresh-fixture-'+accountId,revokeToken:'revoke-fixture-'+accountId,
    accessExpiresAt:'2099-10-25T13:00:00Z',refreshExpiresAt:'2099-11-25T13:00:00Z',
    profile:{accountId,displayName:'Pessoa',timeContext:{timezone:'UTC',dayStartHour:4},plan:'free',onboardedAt:null,analyticsConsentAt:null,revision:'0'}};
}
class Vault implements SecureVault {
  values=new Map<string,string>();
  failure:'get'|'set'|'remove'|null=null;
  async get(key:string) {if(this.failure==='get') throw new Error('vault_unavailable');return this.values.get(key)??null;}
  async set(key:string,value:string) {if(this.failure==='set') throw new Error('vault_unavailable');this.values.set(key,value);}
  async remove(key:string) {if(this.failure==='remove') throw new Error('vault_unavailable');this.values.delete(key);}
}
function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'ritmo-session-'));
  const db=new SQLite(join(directory,'installation.db'));
  const orm=drizzle(db);
  migrate(orm,{migrationsFolder:fileURLToPath(new URL('../drizzle-control',import.meta.url))});
  const control=new InstallationStore(orm,device);
  const vault=new Vault();
  let online=true;
  const transport:IdentityTransport={
    async login(email) {if(!online) throw new Error('offline');return credentials(email==='a'?a:b);},
    async register() {return credentials(a);},
    async refresh() {throw new Error('offline');},
    async revoke() {if(!online) throw new Error('offline');},
  };
  let id=0;
  const make=()=>new Session(control,vault,transport,(account,guard)=>Promise.resolve(openTestStore(join(directory,account+'.db'),account,device,guard)),()=>String(++id));
  let session=make();
  return {vault,transport,control,get session(){return session;},offline(){online=false;},online(){online=true;},
    async restart(){session.close();session=make();await session.restore();},
    close(){session.close();db.close();rmSync(directory,{recursive:true,force:true});}};
}
test('offline logout locks A, B sees its own database, and online reentry restores A pending work',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');
    const old=f.session.account();
    old.enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.offline();await f.session.logout();
    assert.throws(()=>old.view('2026-09-25'),/session_locked/);
    await f.restart();
    assert.throws(()=>f.session.account(),/session_locked/);
    await assert.rejects(f.session.login('a','fixture-password'),/offline/);
    f.online();await f.session.login('b','fixture-password');
    assert.equal(f.session.account().accountId,b);
    assert.equal(f.session.account().view('2026-09-25').pendingCount,0);
    await f.session.logout();await f.session.login('a','fixture-password');
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
    assert.equal(f.session.account().view('2026-09-25').habits[0]?.title,'Caminhar');
  } finally {f.close();}
});

test('failed credential removal keeps logout blocked across restart and preserves pending work',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');
    const old=f.session.account();
    old.enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.vault.failure='remove';
    await assert.rejects(f.session.logout(),/vault_unavailable/);
    assert.throws(()=>old.operations(),/session_locked/);
    await assert.rejects(f.restart(),/vault_unavailable/);
    assert.throws(()=>f.session.account(),/session_locked/);
    f.vault.failure=null;await f.restart();
    assert.throws(()=>f.session.account(),/session_locked/);
    // Only the revocation capability survives successful local logout.
    assert.ok([...f.vault.values.values()].every(value=>value.startsWith('revoke-fixture')));
    await f.session.login('a','fixture-password');
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
  } finally {f.close();}
});

test('a lost refresh response requires online login but keeps local work across restart',async()=>{
  const f=fixture();
  try {
    f.transport.login=async()=>({...credentials(a),accessExpiresAt:'2000-01-01T00:00:00Z'});
    await f.session.login('a','fixture-password');
    f.session.account().enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    await assert.rejects(f.session.accessToken(),/offline/);
    await f.restart();
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
    await assert.rejects(f.session.accessToken(),/authentication_required/);
    f.transport.login=async()=>credentials(a);
    await f.session.login('a','fixture-password');
    assert.equal(await f.session.accessToken(),credentials(a).accessToken);
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
  } finally {f.close();}
});

test('invalid protected credentials cannot authenticate a different account after restart',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');
    const key=[...f.vault.values.keys()].find(key=>key.includes('.credentials.'))!;
    f.vault.values.set(key,JSON.stringify(credentials(b)));
    await f.restart();
    assert.equal(f.session.account().accountId,a);
    await assert.rejects(f.session.accessToken(),/authentication_required/);
  } finally {f.close();}
});

test('a late refresh and pull from A cannot write into the session or database of B',async()=>{
  const f=fixture();
  try {
    f.transport.login=async email=>({...credentials(email==='a'?a:b),accessExpiresAt:email==='a'?'2000-01-01T00:00:00Z':'2099-10-25T13:00:00Z'});
    await f.session.login('a','fixture-password');const old=f.session.account();
    let release!:(value:Credentials)=>void;const response=new Promise<Credentials>(resolve=>{release=resolve;});f.transport.refresh=()=>response;
    const refresh=f.session.accessToken();const rejected=assert.rejects(refresh,/session_locked/);
    await f.session.logout();await f.session.login('b','fixture-password');
    release(credentials(a));await rejected;
    assert.throws(()=>old.applyPull({changes:[],hasMore:false,nextCursor:'late-A',highWaterRevision:'0',serverTime:'2026-09-26T13:00:00Z'}),/session_locked/);
    assert.equal(f.session.account().accountId,b);
    assert.equal(f.session.account().cursor(),null);
    assert.equal(await f.session.accessToken(),credentials(b).accessToken);
  } finally {f.close();}
});
test('offline revocations are retried without renewing or touching the active account',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');f.offline();await f.session.logout();
    await assert.rejects(f.session.flushRevocations(),/offline/);
    await f.restart();f.online();await f.session.login('b','fixture-password');
    await f.session.flushRevocations();
    assert.equal(f.session.account().accountId,b);
    assert.equal(f.control.keys().filter(key=>key.purpose==='revocation'&&key.account_id===a).length,0);
    assert.ok(f.control.keys().some(key=>key.purpose==='revocation'&&key.account_id===b));
  } finally {f.close();}
});

test('failure saving a rotated credential never reactivates the old refresh after restart',async()=>{
  const f=fixture();
  try {
    f.transport.login=async()=>({...credentials(a),accessExpiresAt:'2000-01-01T00:00:00Z'});
    f.transport.refresh=async()=>({...credentials(a),refreshToken:'new-fixture-refresh-0000000000000000000000'});
    await f.session.login('a','fixture-password');
    f.session.account().enqueue(command,'01996300-0000-7000-8000-000000000010','2026-09-25T13:00:00Z');
    f.vault.failure='set';await assert.rejects(f.session.accessToken(),/vault_unavailable/);
    f.vault.failure=null;await f.restart();
    await assert.rejects(f.session.accessToken(),/authentication_required/);
    assert.equal(f.session.account().view('2026-09-25').pendingCount,1);
    await f.session.logout();
    assert.ok([...f.vault.values.values()].every(value=>value.startsWith('revoke-fixture')));
  } finally {f.close();}
});
test('logout fences a credential write already in flight and removes it before finishing',async()=>{
  const f=fixture();
  try {
    let started!:()=>void,release!:()=>void;
    const entered=new Promise<void>(resolve=>{started=resolve;}),resume=new Promise<void>(resolve=>{release=resolve;});
    const set=f.vault.set.bind(f.vault);
    f.vault.set=async(key,value)=>{if(key.includes('.credentials.')) {started();await resume;}await set(key,value);};
    const login=f.session.login('a','fixture-password');
    const refused=assert.rejects(login,/session_locked/);await entered;
    const logout=f.session.logout();
    assert.throws(()=>f.session.account(),/session_locked/);
    release();await refused;await logout;await f.restart();
    assert.throws(()=>f.session.account(),/session_locked/);
    assert.ok([...f.vault.values.values()].every(value=>value.startsWith('revoke-fixture')));
  } finally {f.close();}
});
