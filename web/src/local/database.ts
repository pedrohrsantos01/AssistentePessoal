import Dexie, { type Table } from 'dexie';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../../contracts/pwa-m1/local.schema.json';
import { entityKey } from '../../../app/src/core/sync/protocol.ts';
import { decimal, type Records, type Control, type Journal, type Compatibility, type Account, type Canonical, type Mutation, type SyncState, type Staging, type Projection, type Appearance } from './records.ts';
const ajv=new Ajv2020({strict:false}); addFormats(ajv); ajv.addSchema({...schema,$id:'local'},'local');
const validators=Object.fromEntries(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`local#/$defs/${name}`})]));
export function check<K extends keyof Records>(kind: K, value: unknown): asserts value is Records[K] {
  if(!validators[kind]?.(value)) throw new Error('storage_unreadable');
  if(kind==='Control'||kind==='AuthJournal') decimal((value as Control|Journal).owner_epoch);
  if(kind==='Canonical'||kind==='Staging') {
    const row=value as Canonical;
    if(row.kind!==row.payload.kind||row.entity_key!==entityKey(row.payload)||row.revision!==row.payload.value.revision||row.payload.kind==='profile'&&row.payload.value.accountId!==row.account_id) throw new Error('storage_unreadable');
    decimal(row.revision);
  }
  if(kind==='Projection') {
    const row=value as Projection;
    if(row.kind==='habit'? !('habitId' in row.payload)||row.entity_key!==row.payload.habitId : !('totalXp' in row.payload)||row.entity_key!=='total') throw new Error('storage_unreadable');
  }
  if(kind==='Mutation') {
    const row=value as Mutation, op=row.envelope;
    if(row.operation_id!==op.operationId||row.device_id!==op.deviceId||row.client_sequence!==op.clientSequence||JSON.stringify(row.dependencies)!==JSON.stringify(op.dependsOn)) throw new Error('storage_unreadable');
  }
}
export const mainStores={
  installation_control:'singleton', auth_journal:'attempt_id,&context_id,phase',
  build_compatibility:'[build_id+protocol_version+schema_version]', account_storage:'account_id',
  canonical_entities:'[account_id+kind+entity_key],account_id',
  sync_mutations:'[account_id+operation_id],&[account_id+device_id+client_sequence],[account_id+status+client_sequence],account_id',
  sync_state:'account_id', snapshot_staging:'[account_id+snapshot_id+kind+entity_key],[account_id+snapshot_id],account_id',
  projected_views:'[account_id+kind+entity_key],account_id',
};
export class MainDatabase extends Dexie {
  declare installation_control: Table<Control,number>;
  declare auth_journal: Table<Journal,string>;
  declare build_compatibility: Table<Compatibility,[string,string,number]>;
  declare account_storage: Table<Account,string>;
  declare canonical_entities: Table<Canonical,[string,string,string]>;
  declare sync_mutations: Table<Mutation,[string,string]>;
  declare sync_state: Table<SyncState,string>;
  declare snapshot_staging: Table<Staging,[string,string,string,string]>;
  declare projected_views: Table<Projection,[string,string,string]>;
  constructor(name='ritmo-main', onState:(state:'versionchange'|'blocked')=>void=()=>{}) {
    super(name,{autoOpen:false}); this.version(1).stores(mainStores);
    this.on('ready',()=>{if(this.backendDB().version!==10) throw new Error('schema_unknown');},true);
    // Never wait for the gate here: the upgrader can already hold it.
    this.on('versionchange',()=>{this.close();onState('versionchange');});
    this.on('blocked',()=>{onState('blocked');});
  }
}
export class AppearanceStore {
  readonly db: Dexie;
  private loaded=false;
  private confirmed: Appearance={version:1,skin:'holo',mode:'system'};
  constructor(name='ritmo-appearance') {
    this.db=new Dexie(name,{autoOpen:false});this.db.version(1).stores({preferences:''});
    this.db.on('ready',()=>{if(this.db.backendDB().version!==10) throw new Error('schema_unknown');},true);
    this.db.on('versionchange',()=>{this.loaded=false;this.db.close();});
  }
  async read() {
    try {
      if(!this.db.isOpen()) await this.db.open();
      const value:unknown=await this.db.table('preferences').get('appearance');
      if(value!==undefined) {check('Appearance',value);this.confirmed=value;}
      else this.confirmed={version:1,skin:'holo',mode:'system'};
      this.loaded=true; return {value:structuredClone(this.confirmed),paused:false};
    } catch {this.loaded=false;return {value:{version:1,skin:'holo',mode:'system'} as Appearance,paused:true};}
  }
  async write(value: Appearance) {
    if(!this.loaded) throw new Error('appearance_paused');check('Appearance',value);
    try {await this.db.transaction('rw',this.db.table('preferences'),()=>this.db.table('preferences').put(value,'appearance'));}
    catch {throw new Error('appearance_write_failed');}
    this.confirmed=structuredClone(value);return structuredClone(this.confirmed);
  }
  close() {this.loaded=false;this.db.close();}
}
