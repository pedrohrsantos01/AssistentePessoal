import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {migrateLocalDatabase} from '../../src/core/db/local-migrations.ts';
import { AccountStore } from '../../src/core/db/account-store.ts';
export function openTestStore(path:string,accountId:string,deviceId:string,guard:(write?:boolean)=>void=()=>{},migrationsFolder=fileURLToPath(new URL('../../drizzle',import.meta.url))) {
  const sqlite=new SQLite(path);
  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    const db=drizzle(sqlite);
    const journal=JSON.parse(readFileSync(join(migrationsFolder,'meta/_journal.json'),'utf8')) as {entries:{when:number}[]};
    migrateLocalDatabase(db,journal,path,()=>migrate(db,{migrationsFolder}));
    return new AccountStore(db,accountId,deviceId,()=>sqlite.close(),guard);
  } catch(error) { sqlite.close(); throw error; }
}
