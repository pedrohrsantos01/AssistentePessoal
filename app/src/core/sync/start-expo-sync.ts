import {AppState} from 'react-native';
import {addNetworkStateListener,getNetworkStateAsync} from 'expo-network';
import type {Session} from '../identity/session.ts';
import {SyncScheduler} from './scheduler.ts';
import {attachSyncLifecycle} from './lifecycle.ts';

export function startExpoSync(session:Session,origin:string) {
  const scheduler=new SyncScheduler(session,origin);
  const close=attachSyncLifecycle(scheduler,{
    current:()=>AppState.currentState==='active',
    subscribe(listener) {const subscription=AppState.addEventListener('change',state=>listener(state==='active'));return ()=>subscription.remove();},
  },{
    read:getNetworkStateAsync,
    subscribe(listener) {const subscription=addNetworkStateListener(listener);return ()=>subscription.remove();},
  });
  return {scheduler,close};
}
