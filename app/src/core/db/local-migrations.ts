import {sql} from 'drizzle-orm';
import type {LocalDatabase} from './account-store.ts';

type Journal={entries:{when:number}[]};
export class LocalRecoveryRequired extends Error {
  constructor(readonly database:string,readonly code:'local_schema_not_supported'|'local_migration_failed',cause?:unknown) {
    super(code,{cause});
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
