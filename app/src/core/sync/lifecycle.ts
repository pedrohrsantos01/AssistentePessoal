import type {SyncScheduler} from './scheduler.ts';
type NetworkState={isConnected?:boolean;isInternetReachable?:boolean};
type AppLifecycle={current:()=>boolean;subscribe:(listener:(active:boolean)=>void)=>()=>void};
type NetworkLifecycle={read:()=>Promise<NetworkState>;subscribe:(listener:(state:NetworkState)=>void)=>()=>void};

// This owner closes both native subscriptions and the scheduler.
export function attachSyncLifecycle(scheduler:SyncScheduler,app:AppLifecycle,network:NetworkLifecycle) {
  let closed=false,active=app.current(),online=false,revision=0;
  const update=()=>{if(!closed) scheduler.update({active,online});};
  const apply=(state:NetworkState)=>{online=state.isConnected===true&&state.isInternetReachable!==false;update();};
  const refresh=()=>{
    const at=++revision;
    void network.read().then(state=>{if(!closed&&at===revision) apply(state);},()=>{if(!closed&&at===revision) apply({isConnected:false});});
  };
  const unsubscribeNetwork=network.subscribe(state=>{revision++;apply(state);});
  const unsubscribeApp=app.subscribe(value=>{active=value;update();if(active) refresh();});
  refresh();update();
  return ()=>{if(closed) return;closed=true;unsubscribeApp();unsubscribeNetwork();scheduler.dispose();};
}
