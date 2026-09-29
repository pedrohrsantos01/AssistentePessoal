import {sql} from 'drizzle-orm';
import type {LocalDatabase} from '../db/account-store.ts';
type State={device_id:string;selected_account_id:string|null;session_generation:number;session_state:'active'|'logging_out'|'locked';credentials_key:string|null;revoke_key:string|null};
type Key={key:string;purpose:'credentials'|'revocation';account_id:string;session_id:string};
export class InstallationStore {
  constructor(private db:LocalDatabase,deviceId:string) {
    db.run(sql`insert into installation_control(singleton,device_id) values(1,${deviceId}) on conflict do nothing`);
  }
  state():State {const state=this.db.get<State>(sql`select * from installation_control where singleton=1`);if(!state) throw new Error('installation_missing');return state;}
  blockedClient():string|null {return this.db.get<{blocked_client:string|null}>(sql`select blocked_client from installation_control where singleton=1`)?.blocked_client??null;}
  blockClient(client:string|null) {this.db.run(sql`update installation_control set blocked_client=${client} where singleton=1`);}
  keys():Key[] {return this.db.all<Key>(sql`select * from protected_keys`);}
  remember(key:string,purpose:Key['purpose'],account:string,session:string) {
    this.db.run(sql`insert into protected_keys(key,purpose,account_id,session_id) values(${key},${purpose},${account},${session})`);
  }
  forget(key:string) {this.db.run(sql`delete from protected_keys where key=${key}`);}
  activate(account:string,credentials:string,revoke:string) {
    this.db.run(sql`update installation_control set selected_account_id=${account},credentials_key=${credentials},revoke_key=${revoke},
      session_state='active',session_generation=session_generation+1 where singleton=1`);
  }
  useCredentials(key:string|null) {
    this.db.run(sql`update installation_control set credentials_key=${key} where singleton=1`);
  }
  fence() {
    this.db.run(sql`update installation_control set session_state='logging_out',session_generation=session_generation+1 where singleton=1`);
  }
  lock() {this.db.run(sql`update installation_control set session_state='locked',credentials_key=null,revoke_key=null where singleton=1`);}
}
