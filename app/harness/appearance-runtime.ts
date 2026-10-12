import {Linking} from 'react-native';
import {AppearancePreferences} from '../src/core/preferences/appearance.ts';
import {expoPreferenceStorage} from '../src/core/preferences/expo-appearance.ts';
// External-port faults exist only in the disposable product-test variant.
export async function openTestAppearancePreferences(){
 if(process.env.EXPO_PUBLIC_RITMO_JOURNEY_TEST!=='1')throw new Error('test_variant_required');
 const url=await Linking.getInitialURL(),fault=url?.match(/[?&]ritmoTestFault=(preferences-[a-z-]+)(?:[&#]|$)/)?.[1];
 const storage=expoPreferenceStorage();let reads=0,writes=0;
 return new AppearancePreferences({...storage,get:async()=>{
  if(fault==='preferences-read'&&reads++===0)throw new Error('synthetic_preference_read_failure');
  return storage.get();
 },set:async value=>{if(fault==='preferences-write'&&writes++===0)throw new Error('synthetic_preference_write_failure');return storage.set(value);}});
}
