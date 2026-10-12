import {AppearanceReadNotice} from '../features/preferences/appearance-section.tsx';
import '../../global.css';
import {Slot} from 'expo-router';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {ThemeProvider,useTheme} from '../theme/theme.tsx';
import {openAppearancePreferences} from '../core/preferences/expo-appearance.ts';
import type {AppearancePreferences} from '../core/preferences/appearance.ts';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {Loading} from '../ui/primitives.tsx';
import {pt} from '../i18n/pt-BR.ts';
function Content({preferences}:{preferences:AppearancePreferences}){
 const state=useSyncExternalStore(preferences.subscribe,preferences.state),theme=useTheme();
 return <><StatusBar style={theme.mode==='dark'?'light':'dark'}/>{state.ready?<><AppearanceReadNotice preferences={preferences}/><Slot/></>:<Loading message={pt.loading}/>}</>;
}
export default function Layout(){
 const [preferences,setPreferences]=useState<AppearancePreferences|null>(null);
 useEffect(()=>{
  let cancelled=false,owner:AppearancePreferences|undefined;
  const opening=process.env.EXPO_PUBLIC_RITMO_JOURNEY_TEST==='1'?import('../../harness/appearance-runtime.ts').then(module=>module.openTestAppearancePreferences()):Promise.resolve(openAppearancePreferences());
  void opening.then(value=>{owner=value;if(cancelled){void value.dispose();return;}setPreferences(value);void value.load();});
  return ()=>{cancelled=true;void owner?.dispose();};
 },[]);
 return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><ThemeProvider preferences={preferences}>{preferences?<Content preferences={preferences}/>:<Loading message={pt.loading}/>}</ThemeProvider></SafeAreaProvider></GestureHandlerRootView>;
}
