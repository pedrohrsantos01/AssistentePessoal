import SQLite from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from 'drizzle-orm/better-sqlite3/migrator';
import {mkdtempSync,rmSync,renameSync,readFileSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {LocalStorage,DatabaseKind} from '../../src/core/db/local-opening.ts';
import type {IdentityTransport} from '../../src/core/identity/types.ts';
import {credentials,id} from './scheduler.ts';

export function openingFixture() {
  const directory=mkdtempSync(join(tmpdir(),'ritmo-opening-'));
  const folders={installation:join(directory,'control-migrations'),account:join(directory,'account-migrations')};
  cpSync(fileURLToPath(new URL('../../drizzle-control',import.meta.url)),folders.installation,{recursive:true});
  cpSync(fileURLToPath(new URL('../../drizzle',import.meta.url)),folders.account,{recursive:true});
  const path=(account?:string)=>join(directory,account?'account-'+account+'.db':'installation.db');
  const handles:SQLite.Database[]=[];
  let pragmaFault:Error|null=null;
  let gate:{kind:DatabaseKind;wait:Promise<void>;entered:()=>void}|null=null;
  const storage:LocalStorage={
    journal:kind=>JSON.parse(readFileSync(join(folders[kind],'meta/_journal.json'),'utf8')) as {entries:{when:number}[]},
    open(name,kind) {
      const sqlite=new SQLite(join(directory,name)),db=drizzle(sqlite);handles.push(sqlite);
      return {db,exec(sql){if(pragmaFault) throw pragmaFault;sqlite.exec(sql);},close:()=>sqlite.close(),
        async migrate(){if(gate?.kind===kind) {const current=gate;current.entered();await current.wait;}migrate(db,{migrationsFolder:folders[kind]});}};
    },
  };
  const values=new Map<string,string>();
  const vault={async get(key:string){return values.get(key)??null;},async set(key:string,value:string){values.set(key,value);},async remove(key:string){values.delete(key);}};
  const identity:IdentityTransport={async login(email){return credentials(email==='a'?id(1):id(99));},async register(){return credentials(id(1));},
    async refresh(){throw new Error('authentication_required');},async revoke(){}};
  let sequence=100;
  return {storage,vault,identity,path,folders,values,handles,nextId:()=>id(++sequence),
    pragmaFailure(error:Error|null){pragmaFault=error;},
    pause(kind:DatabaseKind){
      let resume!:()=>void,entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});
      const wait=new Promise<void>(resolve=>{resume=resolve;});gate={kind,wait,entered};
      return {started,resume(){gate=null;resume();}};
    },
    hide(account?:string){renameSync(path(account),path(account)+'.preserved');},
    unhide(account?:string){renameSync(path(account)+'.preserved',path(account));},
    migration(kind:DatabaseKind){return folders[kind];},
    close(){for(const handle of handles) if(handle.open) handle.close();rmSync(directory,{recursive:true,force:true});},
  };
}
