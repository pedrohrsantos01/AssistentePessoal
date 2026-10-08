import {registerRootComponent} from 'expo';
import {useEffect} from 'react';
import {Linking} from 'react-native';
import {exerciseHttp} from './http.ts';
import {exerciseExceptions} from './exceptions.ts';
import {openExpoSession} from '../src/core/identity/open-expo-session.ts';
import type {Credentials,IdentityTransport} from '../src/core/identity/types.ts';

const account='01996300-0000-7000-8000-000000999001';
const other='01996300-0000-7000-8000-000000999099';
const habit='01996300-0000-7000-8000-000000999003';
// Storage harness only: fixture credentials are deliberately not usable by any real server.
function fixture(accountId:string):Credentials {
  return {accountId,sessionId:'01996300-0000-7000-8000-000000999006',
    accessToken:'fixture-access-'+accountId,refreshToken:'fixture-refresh-'+accountId,revokeToken:'fixture-revoke-'+accountId,
    accessExpiresAt:'2099-10-25T13:00:00Z',refreshExpiresAt:'2099-11-25T13:00:00Z',
    profile:{accountId,displayName:'Harness',timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},plan:'free',onboardedAt:null,analyticsConsentAt:null,revision:'0'}};
}
const transport:IdentityTransport={
  async login(email){return fixture(email==='a'?account:other);},
  async register(){throw new Error('unsupported_in_harness');},
  async refresh(){throw new Error('offline');},
  async revoke(){throw new Error('offline');},
};
async function exercise() {
  const owner=await openExpoSession(transport),session=owner.session;
  try {
    let restarting=true;
    try {session.account();} catch {restarting=false;await session.login('a','fixture-password');}
    const timeContext={timezone:'America/Sao_Paulo',dayStartHour:4};
    let store=session.account();
    if(store.view('2026-09-25').pendingCount===0) {
      store.enqueue({type:'habit.create',habitId:habit,title:'Teste SQLite',habitType:'binary',scheduleKind:'daily',
        startDayKey:'2026-09-25',timeContext,iconKey:null,colorToken:null,sortOrder:0},
        '01996300-0000-7000-8000-000000999004','2026-09-25T13:00:00Z');
      store.enqueue({type:'habit.mark',habitId:habit,dayKey:'2026-09-25',timeContext,observedUndoIds:[]},
        '01996300-0000-7000-8000-000000999005','2026-09-25T13:01:00Z');
    }
    if(!restarting) {
      await session.logout();let blocked=false;
      try {store.view('2026-09-25');} catch {blocked=true;}
      if(!blocked) throw new Error('logout_did_not_block');
      await session.login('b','fixture-password');
      if(session.account().view('2026-09-25').pendingCount!==0) throw new Error('account_leak');
      await session.logout();await session.login('a','fixture-password');store=session.account();
    }
    const view=store.view('2026-09-25');
    if(view.pendingCount!==2||view.totalXp!==10||!view.habits[0]?.done) throw new Error('persistence_failed');
    if(await session.accessToken()!==fixture(account).accessToken) throw new Error('protected_session_failed');
    console.log('RITMO_HARNESS:'+JSON.stringify({passed:true,restarting,secureStore:true,view}));
  } finally {owner.close();}
}
function Harness() {
  useEffect(()=>{void (async()=>{
    if(process.env.EXPO_PUBLIC_RITMO_HTTP_HARNESS==='1') {
      const link=await Linking.getInitialURL();
      if(link?.startsWith('ritmo-http://acceptance/')) await exerciseExceptions(link);
      else await exerciseHttp(link);
    }
    else await exercise();
  })().catch(error=>console.error('RITMO_HARNESS:'+JSON.stringify({passed:false,error:String(error)})));},[]);
  return null;
}
registerRootComponent(Harness);
