import type {LocalDatabase} from './account-store.ts';
import {LocalRecoveryRequired,migrateLocalDatabase} from './local-migrations.ts';

export type DatabaseKind='installation'|'account';
export type SQLiteConnection={db:LocalDatabase;exec:(sql:string)=>void;close:()=>void;migrate:()=>void|Promise<void>};
// Only the native SQLite/file boundary varies; guards, migration policy and repositories are shared.
export type LocalStorage={open:(name:string,kind:DatabaseKind)=>SQLiteConnection;journal:(kind:DatabaseKind)=>{entries:{when:number}[]}};
export async function openLocalDatabase<T>(storage:LocalStorage,kind:DatabaseKind,name:string,
  initialize:(db:LocalDatabase,close:()=>void)=>T):Promise<{value:T;close:()=>void}> {
  let connection:SQLiteConnection|undefined,stage:LocalRecoveryRequired['stage']='open';
  let closed=false;
  const close=()=>{if(connection&&!closed) {closed=true;connection.close();}};
  try {
    const acquired=storage.open(name,kind);connection=acquired;stage='pragma';
    acquired.exec(kind==='installation'?'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;':'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    stage='migration';
    await migrateLocalDatabase(acquired.db,storage.journal(kind),name,async()=>{await acquired.migrate();});
    stage='initialize';
    return {value:initialize(acquired.db,close),close};
  } catch(error) {
    const failure=error instanceof LocalRecoveryRequired?error:new LocalRecoveryRequired(name,
      stage==='open'?'local_open_failed':stage==='pragma'?'local_pragma_failed':stage==='migration'?'local_migration_failed':'local_initialization_failed',error,stage);
    try {close();} catch(cleanup) {failure.cleanupCause=cleanup;}
    if(error instanceof Error&&error.message==='session_locked') throw error;
    throw failure;
  }
}
