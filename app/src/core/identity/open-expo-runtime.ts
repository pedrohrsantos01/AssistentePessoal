import {HttpIdentity} from './http-identity.ts';
import {openExpoSession} from './open-expo-session.ts';
import {startExpoSync} from '../sync/start-expo-sync.ts';

// The UI owns one runtime, reuses its session, and closes it on teardown.
export async function openExpoRuntime(origin:string) {
  const identity=new HttpIdentity(origin),owner=await openExpoSession(identity);
  try {
    const sync=startExpoSync(owner.session,origin);
    return {session:owner.session,identity,sync:sync.scheduler,close(){sync.close();owner.close();}};
  } catch(error) {owner.close();throw error;}
}
