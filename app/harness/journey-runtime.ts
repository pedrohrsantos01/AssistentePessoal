import {operationHash} from '../src/core/sync/operation-hash.ts';
import type {Operation,PushResult} from '../src/core/sync/protocol.ts';
import {Linking} from 'react-native';
import {expoStorage} from '../src/core/db/expo-storage.ts';
import {secureVault} from '../src/core/identity/secure-vault.ts';
import {openLocalSession} from '../src/core/identity/session-opening.ts';
import {nativeId} from '../src/core/identity/open-expo-session.ts';
import {HttpIdentity} from '../src/core/identity/http-identity.ts';
import {startExpoSync} from '../src/core/sync/start-expo-sync.ts';

// Only the disposable product-test build can inject faults at external ports.
// All recovery, isolation, persistence and UI remain the product implementation.
export async function openJourneyTestRuntime(origin:string) {
 if(process.env.EXPO_PUBLIC_RITMO_JOURNEY_TEST!=='1') throw new Error('test_variant_required');
 const url=await Linking.getInitialURL(),fault=url?.match(/[?&]ritmoTestFault=([a-z0-9-]+)(?:[&#]|$)/)?.[1];
 const originalFetch=globalThis.fetch;let intercepted=false;
 if(['sync-429','sync-503','sync-update','sync-identity','sync-snapshot'].includes(fault??'')) globalThis.fetch=async(input,init)=>{
  const path=typeof input==='string'?input:'';
  if(!path.startsWith(origin+'/api/v1/sync/')) return originalFetch(input,init);
  if(fault==='sync-429'||fault==='sync-503') return new Response(JSON.stringify({error:{code:'temporarily_unavailable'}}),{status:fault==='sync-429'?429:503,headers:{'Content-Type':'application/json','Retry-After':'60'}});
  if(fault==='sync-update') return new Response(JSON.stringify({error:{code:'update_required'}}),{status:426,headers:{'Content-Type':'application/json'}});
  if(fault==='sync-snapshot'&&path.includes('/snapshots/')) {await new Promise<void>(resolve=>setTimeout(resolve,4000));throw new TypeError('synthetic_snapshot_interruption');}
  if(fault==='sync-identity'&&path.endsWith('/push')&&!intercepted&&typeof init?.body==='string') {
   const body=JSON.parse(init.body) as {operations:Operation[]},operation=body.operations.find(op=>op.command.type==='habit.create');
   if(operation) {
    intercepted=true;
    const divergent={...operation,command:{...operation.command,...(operation.command.type==='habit.create'?{title:'Intenção original do ensaio'}:{})}};
    // Seed a different original at the external HTTP boundary, then let the real API prove the collision.
    await originalFetch(input,{...init,headers:{...init.headers as Record<string,string>,'Idempotency-Key':nativeId()},body:JSON.stringify({operations:[divergent]})});
    const response=await originalFetch(input,init),data=await response.json() as {results:PushResult[]};
    const result=data.results.find(r=>'receipt' in r&&r.receipt.operationId===operation.operationId);
    if(result&&'receipt' in result&&result.receipt.status==='rejected'&&result.receipt.error.identityConflict?.originalOperationHash!==operationHash(divergent)) throw new Error('synthetic_collision_not_proven');
    return new Response(JSON.stringify(data),{status:response.status,headers:response.headers});
   }
  }
  return originalFetch(input,init);
 };
 let reads=0,removes=0,opens=0;
 const storage={...expoStorage,open(name: string,kind:Parameters<typeof expoStorage.open>[1]) {
  if((fault==='account-open'&&kind==='account'||fault==='installation-open'&&kind==='installation')&&opens++<2)
   throw Object.assign(new Error('synthetic_private_path_not_for_display'),{code:'SQLITE_CANTOPEN'});
  return expoStorage.open(name,kind);
 }};
 const vault={...secureVault,async get(key:string) {
  if(key.startsWith('ritmo.credentials.')&&reads++===0) {
   if(fault==='vault-read') throw new Error('synthetic_vault_read_failure');
   if(fault==='vault-absent') return null;
  }
  return secureVault.get(key);
 },async remove(key:string) {
  if(fault==='vault-remove'&&removes++===0) throw new Error('synthetic_vault_remove_failure');
  return secureVault.remove(key);
 }};
 let identity:HttpIdentity|undefined,sync:ReturnType<typeof startExpoSync>|undefined,closed=false;
 const owner=await openLocalSession(storage,vault,compatibility=>identity=new HttpIdentity(origin,compatibility),nativeId);
 const start=()=>{if(!owner.recovery()||owner.recovery()?.scope==='account') sync??=startExpoSync(owner.session,origin);};
 try {start();} catch(error) {owner.close();throw error;}
 return {
  get session(){return owner.session;},
  get identity(){if(!identity) throw new Error('installation_locked');return identity;},
  get sync(){if(!sync) throw new Error('installation_locked');return sync.scheduler;},
  recovery:()=>owner.recovery(),
  async retryDatabase(){if(closed) throw new Error('session_locked');await owner.retryDatabase();if(!closed) start();},
  close(){if(closed) return;closed=true;sync?.close();owner.close();globalThis.fetch=originalFetch;},
 };
}
