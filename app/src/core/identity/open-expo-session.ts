import {getRandomValues} from 'expo-crypto';
import {openDatabaseSync} from 'expo-sqlite';
import {drizzle} from 'drizzle-orm/expo-sqlite';
import {migrate} from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../../../drizzle-control/migrations.ts';
import {migrateLocalDatabase} from '../db/local-migrations.ts';
import {openExpoStore} from '../db/open-expo-store.ts';
import {InstallationStore} from './installation-store.ts';
import {Session,type IdentitySource} from './session.ts';
import {secureVault} from './secure-vault.ts';

export function nativeId():string {
  const random=getRandomValues(new Uint8Array(10));
  const time=Date.now().toString(16).padStart(12,'0');
  const hex=Array.from(random,byte=>byte.toString(16).padStart(2,'0')).join('');
  return time.slice(0,8)+'-'+time.slice(8)+'-7'+hex.slice(0,3)+'-'+
    ((random[2]!&3)|8).toString(16)+hex.slice(5,8)+'-'+hex.slice(8,20);
}
export async function openExpoSession(identity:IdentitySource) {
  const sqlite=openDatabaseSync('installation.db');
  try {
    sqlite.execSync('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const db=drizzle(sqlite);await migrateLocalDatabase(db,migrations.journal,'installation.db',()=>migrate(db,migrations));
    const control=new InstallationStore(db,nativeId());
    const session=new Session(control,secureVault,identity,
      (account,guard)=>openExpoStore(account,control.state().device_id,guard),nativeId);
    await session.restore();
    return {session,close(){session.close();sqlite.closeSync();}};
  } catch(error) {sqlite.closeSync();throw error;}
}
