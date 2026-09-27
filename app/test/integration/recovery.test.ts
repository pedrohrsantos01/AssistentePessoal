import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import SQLite from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {HttpIdentity,IdentityHttpError} from '../../src/core/identity/http-identity.ts';
import {resetTokenFromLink} from '../../src/core/identity/reset-link.ts';
import {Session} from '../../src/core/identity/session.ts';
import {InstallationStore} from '../../src/core/identity/installation-store.ts';
import {openTestStore} from '../support/store.ts';

const id=()=>{const bytes=randomUUID().split('-');bytes[2]='7'+bytes[2]!.slice(1);return bytes.join('-');};
const root=process.env.RITMO_TEST_API,email=process.env.RITMO_RESET_EMAIL,link=process.env.RITMO_RESET_LINK;
assert.ok(root&&email&&link,'Run via the disposable Java integration test, which receives the link through local SMTP');

test('email recovery preserves pending SQLite work across rejected refresh, restart, reauthentication and sync',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-reset-http-')),device=id();
  const sqlite=new SQLite(join(directory,'installation.db')),db=drizzle(sqlite);
  migrate(db,{migrationsFolder:'drizzle-control'});
  const control=new InstallationStore(db,device),values=new Map<string,string>();
  const vault={async get(key:string){return values.get(key)??null;},async set(key:string,value:string){values.set(key,value);},async remove(key:string){values.delete(key);}};
  const api=new HttpIdentity(root);
  const make=()=>new Session(control,vault,api,(account,guard)=>Promise.resolve(openTestStore(join(directory,account+'.db'),account,device,guard)),id);
  let session=make();const day='2026-09-25';
  try {
    await session.login(email,'fixture-password');
    const accountId=session.account().accountId;
    session.account().enqueue({type:'habit.create',habitId:id(),title:'Pendência preservada após recuperar senha',
      habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},
      iconKey:null,colorToken:null,sortOrder:0},id(),'2026-09-25T13:00:00Z');
    const token=resetTokenFromLink(link,'https://api.example.test');
    await api.confirmPasswordReset(token,'changed-fixture-password');
    await assert.rejects(api.confirmPasswordReset(token,'another-fixture-password'),
      error=>error instanceof IdentityHttpError&&error.status===401&&error.code==='reset_invalid');
    await assert.rejects(session.accessToken(true),
      error=>error instanceof IdentityHttpError&&error.status===401&&error.code==='session_invalid');
    assert.equal(session.account().view(day).pendingCount,1);
    session.close();session=make();await session.restore();
    assert.equal(session.account().accountId,accountId);
    assert.equal(session.account().view(day).pendingCount,1);
    await assert.rejects(session.accessToken(),/authentication_required/);
    await assert.rejects(session.login(email,'fixture-password'),
      error=>error instanceof IdentityHttpError&&error.status===401);
    assert.equal(session.account().view(day).pendingCount,1);
    await session.login(email,'changed-fixture-password');
    assert.equal(session.account().accountId,accountId);
    await session.synchronize(root);
    assert.equal(session.account().view(day).pendingCount,0);
    session.close();session=make();await session.restore();
    assert.equal(session.account().view(day).pendingCount,0);
    assert.equal(session.account().view(day).habits[0]?.title,'Pendência preservada após recuperar senha');
  } finally {session.close();sqlite.close();rmSync(directory,{recursive:true,force:true});}
});
