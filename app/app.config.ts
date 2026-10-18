import type {ConfigContext} from 'expo/config';
export default ({config}:ConfigContext)=>{
 const http=process.env.EXPO_PUBLIC_RITMO_HTTP_HARNESS==='1';
 const technical=process.env.EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS==='1';
 const journey=process.env.EXPO_PUBLIC_RITMO_JOURNEY_TEST==='1';
 const readOnly=process.env.EXPO_PUBLIC_RITMO_READONLY_TEST==='1',updated=process.env.EXPO_PUBLIC_RITMO_READONLY_UPDATED==='1';
 if(readOnly&&(!journey||http||technical)||updated&&!readOnly) throw new Error('isolated_readonly_variant_required');
 return {...config,version:readOnly?(updated?'0.1.1':'0.1.0'):config.version,name:readOnly?'Ritmo — ensaio de leitura':http?'Ritmo HTTP harness':technical?'Ritmo — harness técnico':'Ritmo',slug:'ritmo',scheme:'ritmo',userInterfaceStyle:'automatic',
  android:{...config.android,package:http?'dev.ritmo.httpharness':technical?'dev.ritmo.foundationharness':readOnly?'dev.ritmo.readonlytest':journey?'dev.ritmo.journeytest':'dev.ritmo.app'},
  plugins:[...(config.plugins??[]),'expo-router','expo-font','expo-system-ui','./plugins/with-font-licenses.cjs',['./harness/with-http-harness.cjs',{enabled:http||journey}]],
 };
};
