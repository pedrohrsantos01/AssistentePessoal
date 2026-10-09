import {useEffect,useState} from 'react';
import {AppState} from 'react-native';
import {useFonts} from 'expo-font';
import {bundledFonts} from '../theme/fonts.ts';
import {openExpoRuntime} from '../core/identity/open-expo-runtime.ts';
import {nativeId} from '../core/identity/open-expo-session.ts';
import {Journey} from '../features/journey/journey.ts';
import {JourneyView} from '../features/journey/screens.tsx';
import {Banner,Button,Loading,Page,Type} from '../ui/primitives.tsx';
import {pt} from '../i18n/pt-BR.ts';
const origin=process.env.EXPO_PUBLIC_RITMO_JOURNEY_TEST==='1'?'http://127.0.0.1:18766':process.env.EXPO_PUBLIC_RITMO_API_ORIGIN;
export default function App() {
 const [fonts,fontError]=useFonts(bundledFonts),[journey,setJourney]=useState<Journey|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!fonts&&!fontError) return;
  let cancelled=false,owner:Journey|undefined;
  if(!origin||(!/^https:\/\//.test(origin)&&process.env.EXPO_PUBLIC_RITMO_JOURNEY_TEST!=='1')) {setFailed(true);return;}
  void openExpoRuntime(origin).then(runtime=>{
   if(cancelled) {runtime.close();return;}
   owner=new Journey(runtime,nativeId);setJourney(owner);
  }).catch(()=>{if(!cancelled) setFailed(true);});
  return ()=>{cancelled=true;owner?.dispose();};
 },[fonts,fontError,attempt]);
 useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{if(state==='active') journey?.refresh();});return ()=>subscription.remove();},[journey]);
 if(failed||fontError) return <Page><Type size="title" header>{pt.startFailure}</Type><Banner message={pt.genericError} error/><Button label={pt.retry} onPress={()=>{setFailed(false);setAttempt(attempt+1);}}/></Page>;
 if(!journey) return <Loading message={pt.loading}/>;
 return <JourneyView journey={journey}/>;
}
