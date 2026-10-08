import {sql} from 'drizzle-orm';
import type {LocalDatabase} from './account-store.ts';

type Journal={entries:{when:number}[]};
export type DatabaseRecovery={database:string;scope:'installation'|'account';stage:'open'|'pragma'|'migration'|'initialize';
  code:string;sqliteCode:string|null;reason:'schema'|'migration'|'unreadable'|'storage'|'unknown'};
function sqliteCode(error:unknown):string|null {
  const seen=new Set<unknown>();
  while(error instanceof Error&&!seen.has(error)) {
    seen.add(error);
    if('code' in error&&typeof error.code==='string') {
      const base=/^SQLITE_([A-Z]+)(?:_[A-Z0-9]+)*$/.exec(error.code)?.[1];
      if(base&&['ERROR','INTERNAL','PERM','ABORT','BUSY','LOCKED','NOMEM','READONLY','INTERRUPT','IOERR','CORRUPT',
        'NOTFOUND','FULL','CANTOPEN','PROTOCOL','EMPTY','SCHEMA','TOOBIG','CONSTRAINT','MISMATCH','MISUSE',
        'NOLFS','AUTH','FORMAT','RANGE','NOTADB','NOTICE','WARNING'].includes(base)) return 'SQLITE_'+base;
    }
    error=error.cause;
  }
  return null;
}
export class LocalRecoveryRequired extends Error {
  cleanupCause:unknown;
  constructor(readonly database:string,readonly code:'local_schema_not_supported'|'local_migration_failed'|'local_open_failed'|'local_pragma_failed'|'local_initialization_failed',
    cause?:unknown,readonly stage:DatabaseRecovery['stage']='migration') {super(code,{cause});}
  diagnostic(scope:DatabaseRecovery['scope']):DatabaseRecovery {
    const native=sqliteCode(this.cause);
    const reason=this.code==='local_schema_not_supported'?'schema':
      native==='SQLITE_CORRUPT'||native==='SQLITE_NOTADB'?'unreadable':
      native&&/^SQLITE_(CANTOPEN|IOERR|FULL|READONLY|BUSY|LOCKED|NOMEM|PERM)(_|$)/.test(native)?'storage':
      this.code==='local_migration_failed'?'migration':'unknown';
    return {database:this.database,scope,stage:this.stage,code:this.code,sqliteCode:native,reason};
  }
}

// Keep Drizzle's migrator/transaction. The guard prevents silently opening a newer or divergent schema.
export function migrateLocalDatabase(db:LocalDatabase,journal:Journal,database:string,apply:()=>Promise<void>):Promise<void>;
export function migrateLocalDatabase(db:LocalDatabase,journal:Journal,database:string,apply:()=>void):void;
export function migrateLocalDatabase(db:LocalDatabase,journal:Journal,database:string,apply:()=>void|Promise<void>):void|Promise<void> {
  const failure=(error:unknown):never=>{throw error instanceof LocalRecoveryRequired?error:new LocalRecoveryRequired(database,'local_migration_failed',error);};
  try {
    const table=db.get(sql`select name from sqlite_master where type='table' and name='__drizzle_migrations'`);
    if(table) {
      const applied=db.all<{created_at:number}>(sql`select created_at from __drizzle_migrations order by created_at`);
      if(applied.some((row,index)=>Number(row.created_at)!==journal.entries[index]?.when)) throw new LocalRecoveryRequired(database,'local_schema_not_supported');
    }
    const result=apply();
    if(result instanceof Promise) return result.catch(failure);
  } catch(error) {failure(error);}
}
