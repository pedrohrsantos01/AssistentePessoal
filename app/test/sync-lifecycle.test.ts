import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SyncScheduler} from '../src/core/sync/scheduler.ts';
import {attachSyncLifecycle} from '../src/core/sync/lifecycle.ts';
import {Clock,fixture,pull,settle} from './support/scheduler.ts';

test('live network events win over an older initial lookup and native subscriptions are removed on close',async t=>{
  const f=fixture(),clock=new Clock();let cursor='cursor-native-000001';
  t.mock.method(globalThis,'fetch',async()=>pull(cursor));
  await f.session.login('a','fixture-password');
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  const appListeners=new Set<(active:boolean)=>void>(),networkListeners=new Set<(state:{isConnected:boolean})=>void>();
  let resolveInitial:(state:{isConnected:boolean})=>void=()=>{};
  const initial=new Promise<{isConnected:boolean}>(resolve=>{resolveInitial=resolve;});
  const lifecycle=attachSyncLifecycle(scheduler,{current:()=>true,subscribe(listener){appListeners.add(listener);return ()=>{appListeners.delete(listener);};}},
    {read:()=>initial,subscribe(listener){networkListeners.add(listener);return ()=>{networkListeners.delete(listener);};}});
  try {
    for(const listener of networkListeners) listener({isConnected:false});
    resolveInitial({isConnected:true});await settle();assert.equal(f.session.account().cursor(),null);
    for(const listener of networkListeners) listener({isConnected:true});await settle();
    assert.equal(f.session.account().cursor(),cursor);
    for(const listener of appListeners) listener(false);cursor='cursor-foreground-02';
    await clock.advance(300000);assert.equal(f.session.account().cursor(),'cursor-native-000001');
    for(const listener of appListeners) listener(true);await settle();assert.equal(f.session.account().cursor(),cursor);
    lifecycle();assert.equal(appListeners.size,0);assert.equal(networkListeners.size,0);
    cursor='cursor-disposed-0001';await clock.advance(300000);assert.equal(f.session.account().cursor(),'cursor-foreground-02');
  } finally {lifecycle();f.close();}
});

test('a newer foreground network lookup cannot be overwritten by the delayed initial lookup',async t=>{
  const f=fixture(),clock=new Clock();let cursor='cursor-latest-lookup';
  t.mock.method(globalThis,'fetch',async()=>pull(cursor));await f.session.login('a','fixture-password');
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  const listeners=new Set<(active:boolean)=>void>(),resolvers:((state:{isConnected:boolean})=>void)[]=[];
  const close=attachSyncLifecycle(scheduler,{current:()=>true,subscribe(listener){listeners.add(listener);return ()=>{listeners.delete(listener);};}},
    {read:()=>new Promise(resolve=>resolvers.push(resolve)),subscribe:()=>()=>{}});
  try {
    for(const listener of listeners) listener(false);
    for(const listener of listeners) listener(true);
    resolvers[1]!({isConnected:true});await settle();assert.equal(f.session.account().cursor(),cursor);
    resolvers[0]!({isConnected:false});await settle();cursor='cursor-still-online';
    await clock.advance(300000);assert.equal(f.session.account().cursor(),cursor);
  } finally {close();f.close();}
});
