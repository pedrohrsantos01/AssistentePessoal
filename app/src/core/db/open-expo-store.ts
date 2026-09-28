import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../../drizzle/migrations.ts';
import {migrateLocalDatabase} from './local-migrations.ts';
import { AccountStore } from './account-store.ts';

export async function openExpoStore(accountId:string,deviceId:string,guard:()=>void=()=>{}) {
  if(!/^[0-9a-f-]{36}$/.test(accountId)) throw new Error('invalid_account_id');
  const sqlite=openDatabaseSync('account-'+accountId+'.db');
  try {
    sqlite.execSync('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    const db=drizzle(sqlite);
    await migrateLocalDatabase(db,migrations.journal,'account-'+accountId+'.db',()=>migrate(db,migrations));
    // All repository transactions are synchronous: no await can enlist an unrelated writer.
    return new AccountStore(db,accountId,deviceId,()=>sqlite.closeSync(),guard);
  } catch(error) { sqlite.closeSync(); throw error; }
}
