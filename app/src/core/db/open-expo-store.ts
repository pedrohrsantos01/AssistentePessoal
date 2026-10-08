import {expoStorage} from './expo-storage.ts';
import {openLocalAccount} from '../identity/session-opening.ts';
export function openExpoStore(accountId:string,deviceId:string,guard:(write?:boolean)=>void=()=>{}) {
  return openLocalAccount(expoStorage,accountId,deviceId,guard);
}
