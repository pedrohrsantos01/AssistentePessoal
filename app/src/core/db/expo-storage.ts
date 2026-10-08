import {openDatabaseSync} from 'expo-sqlite';
import {drizzle} from 'drizzle-orm/expo-sqlite';
import {migrate} from 'drizzle-orm/expo-sqlite/migrator';
import accountMigrations from '../../../drizzle/migrations.ts';
import installationMigrations from '../../../drizzle-control/migrations.ts';
import type {LocalStorage} from './local-opening.ts';

export const expoStorage:LocalStorage={
  journal:kind=>(kind==='installation'?installationMigrations:accountMigrations).journal,
  open(name,kind) {
    const sqlite=openDatabaseSync(name);
    try {
      const db=drizzle(sqlite);
      return {db,exec:sql=>sqlite.execSync(sql),close:()=>sqlite.closeSync(),
        migrate:()=>migrate(db,kind==='installation'?installationMigrations:accountMigrations)};
    } catch(error) {try {sqlite.closeSync();} catch { /* Preserve the original initialization failure. */ } throw error;}
  },
};
