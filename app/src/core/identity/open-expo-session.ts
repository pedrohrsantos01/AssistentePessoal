import {getRandomValues} from 'expo-crypto';
import {expoStorage} from '../db/expo-storage.ts';
import {openLocalSession} from './session-opening.ts';
import type {IdentitySource} from './session.ts';
import {secureVault} from './secure-vault.ts';

export function nativeId():string {
  const random=getRandomValues(new Uint8Array(10));
  const time=Date.now().toString(16).padStart(12,'0');
  const hex=Array.from(random,byte=>byte.toString(16).padStart(2,'0')).join('');
  return time.slice(0,8)+'-'+time.slice(8)+'-7'+hex.slice(0,3)+'-'+
    ((random[2]!&3)|8).toString(16)+hex.slice(5,8)+'-'+hex.slice(8,20);
}
export function openExpoSession(identity:IdentitySource) {
  return openLocalSession(expoStorage,secureVault,identity,nativeId);
}
