import {HttpIdentity} from './http-identity.ts';
import {openExpoSession} from './open-expo-session.ts';
import {startExpoSync} from '../sync/start-expo-sync.ts';

// Keep the owner even when installation opening fails; recovery must not need a new UI/runtime.
export async function openExpoRuntime(origin:string) {
  let identity:HttpIdentity|undefined,sync:ReturnType<typeof startExpoSync>|undefined,closed=false;
  const owner=await openExpoSession(compatibility=>identity=new HttpIdentity(origin,compatibility));
  const start=()=>{if(!owner.recovery()||owner.recovery()?.scope==='account') sync??=startExpoSync(owner.session,origin);};
  try {start();} catch(error) {owner.close();throw error;}
  return {
    get session(){return owner.session;},
    get identity(){if(!identity) throw new Error('installation_locked');return identity;},
    get sync(){if(!sync) throw new Error('installation_locked');return sync.scheduler;},
    recovery:()=>owner.recovery(),
    async retryDatabase(){if(closed) throw new Error('session_locked');await owner.retryDatabase();if(!closed) start();},
    close(){if(closed) return;closed=true;sync?.close();owner.close();},
  };
}
