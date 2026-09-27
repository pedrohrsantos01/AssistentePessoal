import * as SecureStore from 'expo-secure-store';
import type {SecureVault} from './types.ts';
const options={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
export const secureVault:SecureVault={
  get:key=>SecureStore.getItemAsync(key,options),
  set:(key,value)=>SecureStore.setItemAsync(key,value,options),
  remove:key=>SecureStore.deleteItemAsync(key,options),
};
