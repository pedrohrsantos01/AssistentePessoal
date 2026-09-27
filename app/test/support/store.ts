import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { AccountStore } from '../../src/core/db/account-store.ts';
export function openTestStore(path:string,accountId:string,deviceId:string,guard:()=>void=()=>{}) {
  const sqlite=new SQLite(path);
  try {
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    const db=drizzle(sqlite);
    migrate(db,{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
    return new AccountStore(db,accountId,deviceId,()=>sqlite.close(),guard);
  } catch(error) { sqlite.close(); throw error; }
}
