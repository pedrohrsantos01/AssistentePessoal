import {tokens} from '../src/theme/tokens.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import SQLite from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AppearancePreferences,defaultAppearance,effectiveMode,parseAppearance,type PreferenceStorage} from '../src/core/preferences/appearance.ts';
function storage(db:SQLite.Database):PreferenceStorage{return {get:async()=>(db.prepare("SELECT value FROM storage WHERE key='appearance'").get() as {value:string}|undefined)?.value??null,set:async value=>{db.prepare("INSERT INTO storage(key,value) VALUES('appearance',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(value);},close:async()=>{db.close();}};}
function open(path=':memory:'){const db=new SQLite(path);db.exec('CREATE TABLE IF NOT EXISTS storage(key TEXT PRIMARY KEY NOT NULL,value TEXT)');return db;}
test('appearance defaults do not write; a saved installation choice survives reopening a separate SQLite file',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'ritmo-appearance-')),path=join(directory,'preferences.db');let owner:AppearancePreferences|undefined;
 try{const db=open(path);owner=new AppearancePreferences(storage(db));await owner.load();assert.deepEqual(owner.state().appearance,defaultAppearance);assert.equal((db.prepare('SELECT count(*) AS n FROM storage').get() as {n:number})?.n,0);
 await owner.choose({skin:'neo',mode:'light'});await owner.dispose();owner=new AppearancePreferences(storage(open(path)));await owner.load();assert.deepEqual(owner.state().appearance,{version:1,skin:'neo',mode:'light'});
 }finally{await owner?.dispose();rmSync(directory,{recursive:true,force:true});}
});
test('unknown versions, invalid enums and malformed JSON are preserved and cannot be overwritten by selection',async()=>{
 const raws=['{','null','[]','{"version":2,"skin":"neo","mode":"light"}','{"version":1,"skin":["holo"],"mode":"system"}','{"version":1,"skin":"holo","mode":"future"}','{"version":1,"skin":"holo","mode":"system","token":"unexpected"}'];
 for(const raw of raws){const db=open();db.prepare("INSERT INTO storage VALUES('appearance',?)").run(raw);const owner=new AppearancePreferences(storage(db));try{await owner.load();assert.equal(owner.state().error,'read');assert.equal(owner.state().available,false);await owner.choose({skin:'cockpit'});assert.equal(await storage(db).get(),raw);assert.deepEqual(owner.state().appearance,defaultAppearance);}finally{await owner.dispose();}}
});
test('a read outage uses safe defaults and explicit retry resumes the existing value without destructive reset',async()=>{
 let failed=true,writes=0;const raw=JSON.stringify({version:1,skin:'cockpit',mode:'dark'}),owner=new AppearancePreferences({get:async()=>{if(failed)throw new Error('private_path');return raw;},set:async()=>{writes++;}});
 try{await owner.load();assert.equal(owner.state().ready,true);assert.equal(owner.state().error,'read');await owner.choose({skin:'neo'});assert.equal(writes,0);failed=false;await owner.retry();assert.equal(owner.state().appearance.skin,'cockpit');assert.equal(owner.state().error,null);}finally{await owner.dispose();}
});
test('a real SQLite write rejection preserves the confirmed choice and an explicit retry saves the same intent',async()=>{
 const db=open(),owner=new AppearancePreferences(storage(db));try{await owner.load();await owner.choose({skin:'cockpit',mode:'dark'});db.exec("CREATE TRIGGER reject_visual BEFORE UPDATE ON storage BEGIN SELECT RAISE(ABORT,'fixture'); END");await owner.choose({skin:'neo'});assert.equal(owner.state().error,'write');assert.equal(owner.state().appearance.skin,'cockpit');assert.equal(parseAppearance(await storage(db).get()).skin,'cockpit');db.exec('DROP TRIGGER reject_visual');await owner.retry();assert.equal(owner.state().appearance.skin,'neo');assert.equal(owner.state().appearance.mode,'dark');assert.equal(owner.state().error,null);}finally{await owner.dispose();}
});
test('selection becomes visible only after durable success and late completion cannot publish into a disposed owner',async()=>{
 let release!:()=>void,closes=0,events=0;const pending=new Promise<void>(resolve=>{release=resolve;});const owner=new AppearancePreferences({get:async()=>null,set:()=>pending,close:async()=>{closes++;}});await owner.load();owner.subscribe(()=>{events++;});const write=owner.choose({skin:'neo'});assert.equal(owner.state().busy,true);assert.equal(owner.state().appearance.skin,'holo');const before=events,closing=owner.dispose();release();await write;await closing;assert.equal(events,before);assert.equal(closes,1);await owner.dispose();assert.equal(closes,1);
});
test('mode follows the system only while automatic; appearance and manual mode remain independent',()=>{
 assert.equal(effectiveMode('system','light'),'light');assert.equal(effectiveMode('system','dark'),'dark');assert.equal(effectiveMode('light','dark'),'light');assert.equal(effectiveMode('dark','light'),'dark');assert.equal(effectiveMode('system',null),'dark');assert.deepEqual(parseAppearance(null),defaultAppearance);
});

test('new appearance-switch indicators contrast with both track and surface in all six palettes',()=>{
 const luminance=(hex:string)=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return c[0]!*0.2126+c[1]!*0.7152+c[2]!*0.0722;};
 const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
 for(const skin of ['holo','cockpit','neo'] as const)for(const mode of ['light','dark'] as const){const t=tokens(mode,skin);for(const [front,back] of [[t.border.switchTrack,t.bg.track],[t.border.switchTrack,t.bg.elevated],[t.switchOffKnob,t.bg.track],[t.text.onAccent,t.accent.fill]])assert.ok(contrast(front!,back!)>=3,skin+' '+mode+' '+front+' / '+back);assert.ok(contrast(t.text.secondary,t.bg.elevated)>=4.5);}
});
