import type {ColorMode,Skin} from '../../theme/tokens.ts';
export type ModeChoice='system'|ColorMode;
export type Appearance={version:1;skin:Skin;mode:ModeChoice};
export type PreferenceStorage={get:()=>Promise<string|null>;set:(value:string)=>Promise<void>;close?:()=>Promise<void>};
export type PreferenceState={appearance:Appearance;ready:boolean;available:boolean;busy:boolean;error:'read'|'write'|null};
export const defaultAppearance:Appearance={version:1,skin:'holo',mode:'system'};
export function parseAppearance(raw:string|null):Appearance {
 if(raw===null)return {...defaultAppearance};
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_appearance');
 const item=value as Record<string,unknown>;
 if(item.version!==1||typeof item.skin!=='string'||typeof item.mode!=='string'||!['holo','cockpit','neo'].includes(String(item.skin))||!['system','light','dark'].includes(String(item.mode))||Object.keys(item).some(key=>!['version','skin','mode'].includes(key)))throw new Error('unsupported_appearance');
 return {version:1,skin:item.skin as Skin,mode:item.mode as ModeChoice};
}
export function effectiveMode(choice:ModeChoice,system:ColorMode|'unspecified'|null|undefined):ColorMode {return choice==='system'?(system==='light'?'light':'dark'):choice;}
// Local configuration has an independent lifetime: logout/account changes never own this store.
export class AppearancePreferences {
 private snapshot:PreferenceState={appearance:{...defaultAppearance},ready:false,available:false,busy:false,error:null};
 private listeners=new Set<()=>void>();private closed=false;private pending:Appearance|null=null;private running:Promise<void>=Promise.resolve();
 constructor(private storage:PreferenceStorage){}
 state=()=>this.snapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener);};
 private publish(change:Partial<PreferenceState>){if(this.closed)return;this.snapshot={...this.snapshot,...change};for(const listener of this.listeners)listener();}
 load=():Promise<void>=>{
  if(this.closed||this.snapshot.busy)return this.running;
  this.publish({busy:true});
  this.running=(async()=>{try {
   const appearance=parseAppearance(await this.storage.get());this.pending=null;this.publish({appearance,ready:true,available:true,error:null});
  }catch{this.publish({appearance:{...defaultAppearance},ready:true,available:false,error:'read'});}finally{this.publish({busy:false});}})();return this.running;
 };
 choose=(change:Partial<Pick<Appearance,'skin'|'mode'>>):Promise<void>=>{
  if(this.closed||this.snapshot.busy||!this.snapshot.available)return this.running;
  const next=parseAppearance(JSON.stringify({...this.snapshot.appearance,...change}));this.pending=next;
  this.publish({busy:true,error:null});
  this.running=(async()=>{try{await this.storage.set(JSON.stringify(next));this.pending=null;this.publish({appearance:next,error:null});}
   catch{this.publish({error:'write'});}finally{this.publish({busy:false});}})();return this.running;
 };
 retry=():Promise<void>=>this.snapshot.available&&this.pending?this.choose(this.pending):this.load();
 async dispose(){if(this.closed)return;this.closed=true;this.listeners.clear();await this.running;try{await this.storage.close?.();}catch{/* Closing a cosmetic store cannot alter session recovery. */}}
}
