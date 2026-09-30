import type {ConfigContext} from 'expo/config';
export default ({config}:ConfigContext)=>{
  const http=process.env.EXPO_PUBLIC_RITMO_HTTP_HARNESS==='1';
  return {...config,...(http?{name:'Ritmo HTTP harness'}:{}),
    android:{...config.android,...(http?{package:'dev.ritmo.httpharness'}:{})},
    plugins:[...(config.plugins??[]),['./harness/with-http-harness.cjs',{enabled:http}]],
  };
};
