import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HttpIdentity} from '../src/core/identity/http-identity.ts';
import {SyncScheduler} from '../src/core/sync/scheduler.ts';
import {Clock,fixture,pull,settle,command,id,at,day,acceptedCreate} from './support/scheduler.ts';

test('an offline session pulls automatically when connectivity returns',async t=>{
  const f=fixture(),clock=new Clock();
  t.mock.method(globalThis,'fetch',async()=>pull('cursor-online-000001'));
  await f.session.login('a','fixture-password');
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:false});await settle();
    assert.equal(f.session.account().cursor(),null);
    scheduler.update({active:true,online:true});await settle();
    assert.equal(f.session.account().cursor(),'cursor-online-000001');
  } finally {scheduler.dispose();f.close();}
});

test('foreground polling waits five minutes and pauses until the app is active again',async t=>{
  const f=fixture(),clock=new Clock();let cursor='cursor-opening-00001';
  t.mock.method(globalThis,'fetch',async()=>pull(cursor));
  await f.session.login('a','fixture-password');
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    cursor='cursor-periodic-0001';
    await clock.advance(299999);assert.equal(f.session.account().cursor(),'cursor-opening-00001');
    await clock.advance(1);assert.equal(f.session.account().cursor(),cursor);
    scheduler.update({active:false,online:true});cursor='cursor-foreground-01';
    await clock.advance(600000);assert.equal(f.session.account().cursor(),'cursor-periodic-0001');
    scheduler.update({active:true,online:true});await settle();assert.equal(f.session.account().cursor(),cursor);
    scheduler.dispose();cursor='cursor-after-dispose';await clock.advance(600000);
    assert.equal(f.session.account().cursor(),'cursor-foreground-01');
  } finally {scheduler.dispose();f.close();}
});

test('transient failures wait one then two seconds before synchronization recovers',async t=>{
  const f=fixture(),clock=new Clock();let unavailable=true;
  t.mock.method(globalThis,'fetch',async()=>unavailable?Response.json({error:{code:'unavailable'}},{status:503}):pull('cursor-recovered-001'));
  await f.session.login('a','fixture-password');
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    assert.equal(scheduler.status().sync.nextAttemptAt,clock.now()+1000);
    await clock.advance(1000);assert.equal(scheduler.status().sync.nextAttemptAt,clock.now()+2000);
    unavailable=false;await clock.advance(1999);assert.equal(f.session.account().cursor(),null);
    await clock.advance(1);assert.equal(f.session.account().cursor(),'cursor-recovered-001');
    assert.equal(scheduler.status().sync.phase,'idle');
  } finally {scheduler.dispose();f.close();}
});

test('ten failed attempts stop automatic retries until an explicit retry, preserving local work',async t=>{
  const f=fixture(),clock=new Clock();let unavailable=true;
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>unavailable?Response.json({error:{code:'unavailable'}},{status:503}):
    String(url).endsWith('/push')?acceptedCreate(id(10)):pull('cursor-after-retry-01'));
  await f.session.login('a','fixture-password');
  f.session.account().enqueue(command,id(10),at);
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    for(const delay of [1000,2000,4000,8000,16000,32000,64000,128000,256000]) await clock.advance(delay);
    assert.equal(scheduler.status().sync.phase,'failed');
    assert.equal(scheduler.status().sync.failures,10);
    assert.equal(f.session.account().view(day).pendingCount,1);
    unavailable=false;
    scheduler.update({active:true,online:false});scheduler.update({active:true,online:true});
    await clock.advance(900000);assert.equal(f.session.account().cursor(),null);
    scheduler.retry();await settle();assert.equal(f.session.account().cursor(),'cursor-after-retry-01');
    assert.equal(scheduler.status().sync.phase,'idle');assert.equal(f.session.account().view(day).pendingCount,0);
  } finally {scheduler.dispose();f.close();}
});

test('Retry-After from a non-JSON gateway response survives foreground and connectivity triggers',async t=>{
  const f=fixture(),clock=new Clock();let limited=true;
  t.mock.method(globalThis,'fetch',async()=>limited?new Response('temporarily unavailable',{status:429,headers:{'Retry-After':'600'}}):pull('cursor-rate-limit-01'));
  await f.session.login('a','fixture-password');
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    assert.equal(scheduler.status().sync.phase,'retry_wait');
    assert.equal(scheduler.status().sync.nextAttemptAt,clock.now()+600000);
    limited=false;scheduler.update({active:false,online:false});await clock.advance(1000);
    scheduler.update({active:true,online:true});await clock.advance(598999);
    assert.equal(f.session.account().cursor(),null);
    await clock.advance(1);assert.equal(f.session.account().cursor(),'cursor-rate-limit-01');
  } finally {scheduler.dispose();f.close();}
});

test('a failed push keeps its retry deadline and immutable intention after restarting the session',async t=>{
  const f=fixture(),clock=new Clock();let unavailable=true,requests=0;
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>{requests++;return String(url).endsWith('/push')?
    unavailable?Response.json({error:{code:'unavailable'}},{status:503}):acceptedCreate(id(10)):pull('cursor-durable-00001');});
  await f.session.login('a','fixture-password');
  const operation=f.session.account().enqueue(command,id(10),at);
  let scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    const beforeRestart=requests;scheduler.dispose();await clock.advance(500);await f.restart();unavailable=false;
    scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
    scheduler.update({active:true,online:true});await settle();
    assert.deepEqual(f.session.account().operations(),[operation]);assert.equal(requests,beforeRestart);
    await clock.advance(499);assert.equal(f.session.account().view(day).pendingCount,1);
    await clock.advance(1);assert.equal(f.session.account().view(day).pendingCount,0);
    assert.equal(f.session.account().view(day).habits[0]?.title,'Caminhar');
  } finally {scheduler.dispose();f.close();}
});

test('exhausted pushes stay recoverable after restart and manual retry keeps the original operation ID',async t=>{
  const f=fixture(),clock=new Clock();let unavailable=true;const sent:unknown[]=[];
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{if(String(url).endsWith('/push'))sent.push(JSON.parse(String(init?.body)));return String(url).endsWith('/push')?
    unavailable?Response.json({error:{code:'unavailable'}},{status:503}):acceptedCreate(id(10)):pull('cursor-exhausted-001');});
  await f.session.login('a','fixture-password');const operation=f.session.account().enqueue(command,id(10),at);
  let scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    for(const delay of [1000,2000,4000,8000,16000,32000,64000,128000,256000]) await clock.advance(delay);
    assert.equal(sent.length,10);assert.ok(sent.every(body=>JSON.stringify(body)===JSON.stringify(sent[0])));
    assert.deepEqual(f.session.account().retryState(),{failedCount:1,failures:10,nextAttemptAt:null});
    scheduler.dispose();await f.restart();unavailable=false;
    scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
    scheduler.update({active:true,online:true});await clock.advance(900000);
    assert.equal(scheduler.status().sync.phase,'failed');assert.equal(sent.length,10);
    assert.deepEqual(f.session.account().retryState(),{failedCount:1,failures:10,nextAttemptAt:null});
    assert.deepEqual(f.session.account().operations(),[operation]);
    assert.equal(f.session.account().view(day).habits[0]?.title,'Caminhar');
    scheduler.retry();await settle();assert.equal(sent.length,11);assert.deepEqual(sent[10],sent[0]);assert.equal(f.session.account().view(day).pendingCount,0);
    assert.equal(f.session.account().view(day).habits[0]?.title,'Caminhar');
    assert.equal(scheduler.status().sync.phase,'idle');
  } finally {scheduler.dispose();f.close();}
});

test('login starts automatic sync and logout flushes revocations even without an active account',async t=>{
  const f=fixture(),clock=new Clock();
  t.mock.method(globalThis,'fetch',async()=>pull('cursor-session-00001'));
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    await f.session.login('a','fixture-password');await settle();
    assert.equal(f.session.account().cursor(),'cursor-session-00001');
    scheduler.update({active:true,online:false});await f.session.logout();await settle();
    assert.deepEqual(f.revoked,[]);
    scheduler.update({active:true,online:true});await settle();
    assert.deepEqual(f.revoked,['revoke-fixture-'+id(1)]);
    await f.session.login('b','fixture-password');await settle();
    assert.equal(f.session.account().accountId,id(99));
    assert.equal(f.session.account().cursor(),'cursor-session-00001');
    assert.deepEqual(f.revoked,['revoke-fixture-'+id(1)]);
  } finally {scheduler.dispose();f.close();}
});

test('pausing between pull and push does not strand the offline intention in flight',async t=>{
  const f=fixture(),clock=new Clock();let release:()=>void=()=>{},first=true;
  const delayed=new Promise<void>(resolve=>{release=resolve;});
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>{
    if(String(url).endsWith('/push')) return acceptedCreate(id(10));
    if(first) {first=false;await delayed;}
    return pull('cursor-pause-0000001');
  });
  await f.session.login('a','fixture-password');f.session.account().enqueue(command,id(10),at);
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    scheduler.update({active:false,online:true});release();await settle();
    assert.equal(f.session.account().view(day).pendingCount,1);
    scheduler.update({active:true,online:true});await settle();
    assert.equal(f.session.account().view(day).pendingCount,0);
    assert.equal(f.session.account().view(day).habits[0]?.title,'Caminhar');
  } finally {release();scheduler.dispose();await settle();f.close();}
});

test('a revoked-session retry respects Retry-After without delaying the active account sync',async t=>{
  const f=fixture(),clock=new Clock(),identity=new HttpIdentity('https://api.example.test');let limited=true;
  const sent:string[]=[];
  f.identity.revoke=token=>identity.revoke(token);
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{
    if(String(url).endsWith('/revoke')) {
      if(limited) return new Response('gateway busy',{status:503,headers:{'Retry-After':new Date(clock.now()+2000).toUTCString()}});
      sent.push((JSON.parse(String(init?.body)) as {revokeToken:string}).revokeToken);return new Response(null,{status:204});
    }
    return pull('cursor-active-b-0001');
  });
  await f.session.login('a','fixture-password');await f.session.logout();await f.session.login('b','fixture-password');
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    assert.equal(f.session.account().cursor(),'cursor-active-b-0001');
    assert.equal(scheduler.status().revocations.phase,'retry_wait');
    limited=false;await clock.advance(1999);assert.deepEqual(sent,[]);
    await clock.advance(1);assert.deepEqual(sent,['revoke-fixture-'+id(1)]);
    assert.equal(scheduler.status().revocations.phase,'idle');
  } finally {scheduler.dispose();f.close();}
});

test('interruption during a push preserves the retry deadline before any response arrives',async t=>{
  const f=fixture(),clock=new Clock();let release:()=>void=()=>{},first=true;
  const delayed=new Promise<void>(resolve=>{release=resolve;});
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>{
    if(String(url).endsWith('/push')) {
      if(first) {first=false;await delayed;return Response.json({error:{code:'unavailable'}},{status:503});}
      return acceptedCreate(id(10));
    }
    return pull('cursor-interrupted-1');
  });
  await f.session.login('a','fixture-password');f.session.account().enqueue(command,id(10),at);
  let scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();scheduler.dispose();await f.restart();
    scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
    scheduler.update({active:true,online:true});await settle();
    assert.equal(f.session.account().view(day).pendingCount,1);
    await clock.advance(1000);assert.equal(f.session.account().view(day).pendingCount,0);
  } finally {release();scheduler.dispose();await settle();f.close();}
});

test('deferred operations back off and eventually require a manual retry without losing their content',async t=>{
  const f=fixture(),clock=new Clock();
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>String(url).endsWith('/push')?
    Response.json({results:[{operationId:id(10),status:'deferred',missingDependencyIds:[id(9)]}],serverTime:at}):pull('cursor-deferred-0001'));
  await f.session.login('a','fixture-password');const operation=f.session.account().enqueue(command,id(10),at);
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    assert.equal(scheduler.status().sync.nextAttemptAt,clock.now()+1000);
    for(const delay of [1000,2000,4000,8000,16000,32000,64000,128000,256000]) await clock.advance(delay);
    assert.equal(scheduler.status().sync.phase,'failed');
    assert.deepEqual(f.session.account().operations(),[operation]);
  } finally {scheduler.dispose();f.close();}
});

test('a late response from A cannot change B or stop B automatic synchronization',async t=>{
  const f=fixture(),clock=new Clock();let release:()=>void=()=>{},first=true;
  const delayed=new Promise<void>(resolve=>{release=resolve;});
  t.mock.method(globalThis,'fetch',async()=>{
    if(first) {first=false;await delayed;return Response.json({error:{code:'unavailable'}},{status:503});}
    return pull('cursor-only-b-000001');
  });
  await f.session.login('a','fixture-password');const old=f.session.account();old.enqueue(command,id(10),at);
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    await f.session.logout();await f.session.login('b','fixture-password');release();await settle();
    assert.throws(()=>old.view(day),/session_locked/);
    assert.equal(f.session.account().accountId,id(99));assert.equal(f.session.account().view(day).pendingCount,0);
    assert.equal(f.session.account().cursor(),'cursor-only-b-000001');
    assert.equal(scheduler.status().sync.phase,'idle');
    scheduler.update({active:true,online:false});await f.session.logout();await f.session.login('a','fixture-password');
    assert.equal(f.session.account().view(day).pendingCount,1);
  } finally {release();scheduler.dispose();await settle();f.close();}
});

for(const [status,phase] of [[400,'blocked'],[401,'authentication_required'],[426,'update_required']] as const) {
  test('HTTP '+status+' stops automatic retries while preserving local work',async t=>{
    const f=fixture(),clock=new Clock();let requests=0;
    t.mock.method(globalThis,'fetch',async()=>{requests++;return Response.json({error:{code:'rejected'}},{status});});
    await f.session.login('a','fixture-password');f.session.account().enqueue(command,id(10),at);
    const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
    try {
      scheduler.update({active:true,online:true});await settle();const initial=requests;
      assert.equal(scheduler.status().sync.phase,phase);
      await clock.advance(900000);scheduler.update({active:true,online:false});scheduler.update({active:true,online:true});await settle();
      assert.equal(requests,initial);assert.equal(f.session.account().view(day).pendingCount,1);
    } finally {scheduler.dispose();f.close();}
  });
}

test('a new dependent operation cannot bypass its parent retry deadline',async t=>{
  const f=fixture(),clock=new Clock(),sent:string[][]=[];
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{
    if(String(url).endsWith('/push')) {
      const body=JSON.parse(String(init?.body)) as {operations:{operationId:string}[]};sent.push(body.operations.map(op=>op.operationId));
      return Response.json({error:{code:'unavailable'}},{status:503});
    }
    return pull('cursor-dependency-01');
  });
  await f.session.login('a','fixture-password');f.session.account().enqueue(command,id(10),at);
  const scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
  try {
    scheduler.update({active:true,online:true});await settle();
    f.session.account().enqueue({type:'habit.mark',habitId:id(3),dayKey:day,timeContext:command.timeContext,observedUndoIds:[]},id(11),at);
    await f.session.synchronize('https://api.example.test',clock.now).catch(()=>undefined);
    assert.deepEqual(sent,[[id(10)]]);assert.equal(f.session.account().view(day).pendingCount,2);
  } finally {scheduler.dispose();f.close();}
});

test('the tenth push failure still protects its Retry-After minimum from explicit retry and restart',async t=>{
 const f=fixture(),clock=new Clock();let unavailable=true,pushes=0;
 t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>{
  if(!String(url).endsWith('/push'))return pull('cursor-tenth-floor-01');
  pushes++;return unavailable?Response.json({error:{code:'unavailable'}},{status:503,headers:{'Retry-After':'60'}}):acceptedCreate(id(10));
 });
 await f.session.login('a','fixture-password');const operation=f.session.account().enqueue(command,id(10),at);
 let scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);
 try{
  scheduler.update({active:true,online:true});await settle();
  for(const delay of [60000,60000,60000,60000,60000,60000,64000,128000,256000])await clock.advance(delay);
  assert.equal(pushes,10);assert.equal(scheduler.status().sync.phase,'failed');const floor=clock.now()+60000;
  unavailable=false;scheduler.retry();await settle();assert.equal(pushes,10,'manual retry bypassed the tenth Retry-After');
  assert.equal(scheduler.status().sync.nextAttemptAt,floor);assert.deepEqual(f.session.account().operations(),[operation]);
  scheduler.dispose();await f.restart();scheduler=new SyncScheduler(f.session,'https://api.example.test',clock);scheduler.update({active:true,online:true});
  assert.equal(scheduler.status().sync.phase,'failed');assert.equal(scheduler.status().sync.nextAttemptAt,floor);
  await clock.advance(59999);scheduler.retry();await settle();assert.equal(pushes,10);
  await clock.advance(1);assert.equal(pushes,10,'deadline expiry must not automatically resume exhausted work');
  scheduler.retry();await settle();assert.equal(pushes,11);assert.equal(scheduler.status().sync.phase,'idle');assert.equal(f.session.account().view(day).pendingCount,0);
 }finally{scheduler.dispose();f.close();}
});
