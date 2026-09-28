import {test} from 'node:test';
import assert from 'node:assert/strict';
import SQLite from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {migrateLocalDatabase,LocalRecoveryRequired} from '../src/core/db/local-migrations.ts';
import {InstallationStore} from '../src/core/identity/installation-store.ts';
import {mkdtempSync,rmSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {openTestStore} from './support/store.ts';
import {id,day,at,command} from './support/scheduler.ts';

test('an older app refuses an unknown database version without touching offline work',()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-migration-')),path=join(directory,'account.db');
  const original=openTestStore(path,id(1),id(2));const pending=original.enqueue(command,id(4),at);original.close();
  const fault=new SQLite(path);
  try {
    fault.prepare('insert into __drizzle_migrations(hash,created_at) values (?,?)').run('future-fixture',9999999999999);
    assert.throws(()=>{const outdated=openTestStore(path,id(1),id(2));outdated.close();},/local_schema_not_supported/);
    fault.prepare('delete from __drizzle_migrations where created_at=?').run(9999999999999);
    const restored=openTestStore(path,id(1),id(2));
    try {assert.deepEqual(restored.operations(),[pending]);assert.equal(restored.view(day).habits[0]?.title,'Caminhar');}
    finally {restored.close();}
  } finally {fault.close();rmSync(directory,{recursive:true,force:true});}
});

test('a failed sequential migration preserves both an inactive account and the active account, then retries safely',()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-migration-fault-')),aPath=join(directory,'a.db'),bPath=join(directory,'b.db');
  const folder=join(directory,'migrations');
  cpSync(fileURLToPath(new URL('../drizzle',import.meta.url)),folder,{recursive:true});
  const journalPath=join(folder,'meta/_journal.json');
  const journal=JSON.parse(readFileSync(journalPath,'utf8')) as {entries:{idx:number;version:string;when:number;tag:string;breakpoints:boolean}[]};
  journal.entries.push({idx:1,version:'6',when:1790600000000,tag:'0001_fault_fixture',breakpoints:true});
  writeFileSync(journalPath,JSON.stringify(journal));
  const fixturePath=join(folder,'0001_fault_fixture.sql');
  const valid='CREATE INDEX fixture_pending_sequence ON sync_mutations(account_id,client_sequence)';
  // This disposable migration changes an intent before failing: reopening must reveal the original bytes.
  writeFileSync(fixturePath,valid+";\n--> statement-breakpoint\nUPDATE sync_mutations SET envelope='{}' WHERE account_id='"+id(1)+"';\n--> statement-breakpoint\nSELECT * FROM missing_fixture_table;");
  const oldA=openTestStore(aPath,id(1),id(2)),b=openTestStore(bPath,id(99),id(2));
  const pendingA=oldA.enqueue(command,id(4),at),pendingB=b.enqueue({...command,title:'Outra conta'},id(5),at);oldA.close();
  try {
    assert.throws(()=>openTestStore(aPath,id(1),id(2),()=>{},folder),(error:unknown)=>{
      assert.ok(error instanceof Error&&'code' in error&&error.code==='local_migration_failed');
      assert.ok('database' in error&&error.database===aPath);return true;
    });
    assert.deepEqual(b.operations(),[pendingB]);
    const preserved=openTestStore(aPath,id(1),id(2));
    try {assert.deepEqual(preserved.operations(),[pendingA]);assert.equal(preserved.view(day).habits[0]?.title,'Caminhar');}
    finally {preserved.close();}
    writeFileSync(fixturePath,valid+';');
    const upgraded=openTestStore(aPath,id(1),id(2),()=>{},folder);
    try {
      assert.deepEqual(upgraded.operations(),[pendingA]);
      const next=upgraded.enqueue({type:'habit.patchMetadata',habitId:command.habitId,patch:{title:'Depois'}},id(6),at);
      assert.equal(next.clientSequence,2);assert.deepEqual(next.dependsOn,[id(4)]);
    } finally {upgraded.close();}
    const reopened=openTestStore(aPath,id(1),id(2),()=>{},folder);
    try {assert.equal(reopened.view(day).habits[0]?.title,'Depois');assert.equal(reopened.view(day).pendingCount,2);}
    finally {reopened.close();}
    b.close();const reopenedB=openTestStore(bPath,id(99),id(2),()=>{},folder);
    try {assert.deepEqual(reopenedB.operations(),[pendingB]);assert.equal(reopenedB.view(day).habits[0]?.title,'Outra conta');}
    finally {reopenedB.close();}
  } finally {b.close();rmSync(directory,{recursive:true,force:true});}
});

test('an asynchronous installation migration failure preserves the logout fence and protected key references',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'ritmo-installation-migration-')),folder=join(directory,'migrations'),path=join(directory,'installation.db');
  cpSync(fileURLToPath(new URL('../drizzle-control',import.meta.url)),folder,{recursive:true});
  const journalPath=join(folder,'meta/_journal.json');
  const journal=JSON.parse(readFileSync(journalPath,'utf8')) as {entries:{idx:number;version:string;when:number;tag:string;breakpoints:boolean}[]};
  let sqlite=new SQLite(path),db=drizzle(sqlite);
  await migrateLocalDatabase(db,journal,path,async()=>{migrate(db,{migrationsFolder:folder});});
  const control=new InstallationStore(db,id(2));
  control.remember('fixture.credentials','credentials',id(1),id(6));control.remember('fixture.revoke','revocation',id(1),id(6));
  control.activate(id(1),'fixture.credentials','fixture.revoke');control.fence();
  const state=control.state(),keys=control.keys();
  journal.entries.push({idx:1,version:'6',when:1790600000000,tag:'0001_fault_fixture',breakpoints:true});
  writeFileSync(journalPath,JSON.stringify(journal));
  const fixturePath=join(folder,'0001_fault_fixture.sql');
  writeFileSync(fixturePath,"UPDATE installation_control SET session_state='active' WHERE singleton=1;\n--> statement-breakpoint\nSELECT * FROM missing_fixture_table;");
  try {
    await assert.rejects(migrateLocalDatabase(db,journal,path,async()=>{migrate(db,{migrationsFolder:folder});}),
      (error:unknown)=>error instanceof LocalRecoveryRequired&&error.code==='local_migration_failed'&&error.database===path);
    sqlite.close();sqlite=new SQLite(path);db=drizzle(sqlite);
    writeFileSync(fixturePath,'CREATE INDEX fixture_key_purpose ON protected_keys(purpose);');
    await migrateLocalDatabase(db,journal,path,async()=>{migrate(db,{migrationsFolder:folder});});
    const restored=new InstallationStore(db,id(2));assert.deepEqual(restored.state(),state);assert.deepEqual(restored.keys(),keys);
  } finally {sqlite.close();rmSync(directory,{recursive:true,force:true});}
});
