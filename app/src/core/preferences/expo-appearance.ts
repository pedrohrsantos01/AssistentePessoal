import {SQLiteStorage} from 'expo-sqlite/kv-store';
import {AppearancePreferences,type PreferenceStorage} from './appearance.ts';
export function expoPreferenceStorage():PreferenceStorage{
 const storage=new SQLiteStorage('ritmo-preferences.db');
 return {get:()=>storage.getItem('appearance'),set:value=>storage.setItem('appearance',value),close:()=>storage.closeAsync()};
}
export function openAppearancePreferences(){return new AppearancePreferences(expoPreferenceStorage());}
