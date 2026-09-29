import {HttpIdentity,IdentityHttpError} from '../src/core/identity/http-identity.ts';
import {SyncScheduler} from '../src/core/sync/scheduler.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id,command,at,day,pull,acceptedCreate,Clock,settle,credentials} from './support/scheduler.ts';

test('426 preserves local reading and pending work but blocks writes across restart',async t=>{
  const f=fixture();let requests=0;
  t.mock.method(globalThis,'fetch',async()=>{requests++;return Response.json({error:{code:'unsupported_version'}},{status:426});});
  try {
    await f.session.login('a','fixture-password');const store=f.session.account();const pending=store.enqueue(command,id(10),at);
    const before=store.view(day);
    await assert.rejects(f.session.synchronize('https://sync.test'));
    assert.deepEqual(store.view(day),before);assert.deepEqual(store.operations(),[pending]);
    assert.throws(()=>store.enqueue({...command,habitId:id(20)},id(11),at),/update_required/);
    assert.equal(f.session.access().mode,'read_only');
    await f.restart();assert.equal(f.session.access().mode,'read_only');
    assert.deepEqual(f.session.account().operations(),[pending]);
    assert.throws(()=>f.session.account().enqueue({...command,habitId:id(20)},id(11),at),/update_required/);
    await assert.rejects(f.session.synchronize('https://sync.test'),/update_required/);assert.equal(requests,1);
    await f.session.logout();assert.throws(()=>f.session.account(),/session_locked/);
  } finally {f.close();}
});

test('an updated build stays read-only offline and releases writes only after a compatible response',async t=>{
  const f=fixture();let stage:'obsolete'|'offline'|'supported'='obsolete';
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    if(stage==='obsolete') return Response.json({error:{code:'unsupported_version'}},{status:426});
    assert.equal((init.headers as Record<string,string>)['X-App-Version'],'0.1.1');
    if(stage==='offline') throw new TypeError('offline');
    return input.endsWith('/push')?acceptedCreate(id(10)):pull('compatible-cursor-0001');
  });
  try {
    await f.session.login('a','fixture-password');const pending=f.session.account().enqueue(command,id(10),at);
    await assert.rejects(f.session.synchronize('https://sync.test'));
    await f.restart({appVersion:'0.1.1',protocol:'m1.1'});stage='offline';
    assert.equal(f.session.access().mode,'read_only');
    await assert.rejects(f.session.synchronize('https://sync.test'),/offline/);
    assert.throws(()=>f.session.account().enqueue({...command,habitId:id(20)},id(11),at),/update_required/);
    assert.deepEqual(f.session.account().operations(),[pending]);
    stage='supported';await f.session.synchronize('https://sync.test');
    assert.equal(f.session.access().mode,'read_write');assert.equal(f.session.account().view(day).pendingCount,0);
    assert.equal(f.session.account().enqueue({...command,habitId:id(20)},id(11),at).clientSequence,2);
    await f.restart();assert.equal(f.session.access().mode,'read_write');
  } finally {f.close();}
});

test('a refresh upgrade requirement also blocks writes and cannot be bypassed by logout or login',async()=>{
  const f=fixture();
  try {
    await f.session.login('a','fixture-password');const pending=f.session.account().enqueue(command,id(10),at);
    f.identity.refresh=async()=>{throw new IdentityHttpError(426,'unsupported_version');};
    await assert.rejects(f.session.accessToken(true));
    assert.throws(()=>f.session.account().enqueue({...command,habitId:id(20)},id(11),at),/update_required/);
    assert.deepEqual(f.session.account().operations(),[pending]);
    await f.session.logout();await f.restart();
    await assert.rejects(f.session.login('a','fixture-password'),/update_required/);
    await f.restart({appVersion:'0.1.1',protocol:'m1.1'});await f.session.login('a','fixture-password');
    assert.equal(f.session.access().mode,'read_write');assert.deepEqual(f.session.account().operations(),[pending]);
  } finally {f.close();}
});


test('the scheduler restores update-required while offline and never retries a rejected build',async t=>{
  const f=fixture(),clock=new Clock();let requests=0;
  t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response(null,{status:426});});
  let scheduler:SyncScheduler|undefined;
  try {
    await f.session.login('a','fixture-password');f.session.account().enqueue(command,id(10),at);
    await assert.rejects(f.session.synchronize('https://sync.test'));await f.restart();
    scheduler=new SyncScheduler(f.session,'https://sync.test',clock);
    scheduler.update({active:true,online:false});
    assert.equal(scheduler.status().sync.phase,'update_required');
    scheduler.retry();scheduler.update({active:true,online:true});await settle();await clock.advance(900000);
    assert.equal(requests,1);assert.equal(scheduler.status().sync.phase,'update_required');
    const store=f.session.account();assert.equal(store.recovery().length,0);
    assert.throws(()=>store.discard([id(10)]),/update_required/);
    assert.throws(()=>store.retryFailed(),/update_required/);
  } finally {scheduler?.dispose();f.close();}
});

test('a compatible response from a logged-out session cannot release a pending upgrade check',async t=>{
  const f=fixture();let finish!:(response:Response)=>void;
  t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:426}));
  try {
    await f.session.login('a','fixture-password');await assert.rejects(f.session.synchronize('https://sync.test'));
    await f.restart({appVersion:'0.1.1',protocol:'m1.1'});
    t.mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{finish=resolve;}));
    const syncing=f.session.synchronize('https://sync.test');await settle();await f.session.logout();
    finish(pull('obsolete-session-001'));await assert.rejects(syncing,/session_locked/);
    assert.equal(f.session.access().mode,'read_only');
    await f.restart();assert.equal(f.session.access().mode,'read_only');
  } finally {f.close();}
});


test('password recovery shares the installation restriction with the session and uses its build headers',async t=>{
  let transport!:HttpIdentity;
  const f=fixture(compatibility=>transport=new HttpIdentity('https://sync.test',compatibility));
  t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
    assert.equal((init.headers as Record<string,string>)['X-App-Version'],'0.1.0');
    return input.endsWith('/login')?Response.json(credentials(id(1))):new Response(null,{status:426});
  });
  try {
    await f.session.login('a','fixture-password');const pending=f.session.account().enqueue(command,id(10),at);
    await assert.rejects(transport.requestPasswordReset('a@example.test'));
    assert.equal(f.session.access().mode,'read_only');
    assert.deepEqual(f.session.account().operations(),[pending]);
    assert.throws(()=>f.session.account().enqueue({...command,habitId:id(20)},id(11),at),/update_required/);
    await f.restart();assert.equal(f.session.access().mode,'read_only');
  } finally {f.close();}
});


test('an unknown required effect keeps the committed cursor and blocks correction without erasing recovery history',async t=>{
  const f=fixture();
  t.mock.method(globalThis,'fetch',async()=>pull('known-cursor-000001'));
  try {
    await f.session.login('a','fixture-password');const store=f.session.account();
    const rejected=store.enqueue(command,id(10),at);
    store.applyAck([{receipt:{operationId:id(10),status:'rejected',error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false}]);
    await f.session.synchronize('https://sync.test');
    t.mock.method(globalThis,'fetch',async()=>Response.json({changes:[{revision:'1',operationResults:[],entities:[{kind:'futureRequiredEffect',value:{}}]}],
      nextCursor:'unusable-cursor-001',hasMore:false,highWaterRevision:'1',serverTime:at}));
    await assert.rejects(f.session.synchronize('https://sync.test'),/unsupported_protocol/);
    assert.equal(store.cursor(),'known-cursor-000001');assert.equal(store.recovery()[0]?.operation.operationId,rejected.operationId);
    assert.throws(()=>store.correct([{operationId:id(10),replacementId:id(11),command:{...command,title:'Outro'}}]),/update_required/);
    assert.throws(()=>store.discard([id(10)]),/update_required/);
    await f.restart();assert.equal(f.session.access().mode,'read_only');
    assert.deepEqual(f.session.account().recovery()[0]?.operation,rejected);
  } finally {f.close();}
});

test('optional response fields are tolerated and a 426 during push preserves the exact intent for an updated build',async t=>{
  const f=fixture();let sends=0;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    if(input.endsWith('/push')) {sends++;return new Response(null,{status:426});}
    return Response.json({changes:[],nextCursor:'optional-cursor-001',hasMore:false,highWaterRevision:'0',serverTime:at,futureOptional:'ignored'});
  });
  try {
    await f.session.login('a','fixture-password');const pending=f.session.account().enqueue(command,id(10),at);
    await assert.rejects(f.session.synchronize('https://sync.test'));
    assert.equal(sends,1);assert.equal(f.session.account().cursor(),'optional-cursor-001');
    await f.restart();assert.deepEqual(f.session.account().operations(),[pending]);
    assert.equal(f.session.account().view(day).habits[0]?.title,command.title);
    assert.equal(f.session.access().mode,'read_only');
    await f.restart({appVersion:'0.1.1',protocol:'m1.1'});
    t.mock.method(globalThis,'fetch',async(input:string,init:RequestInit)=>{
      if(!input.endsWith('/push')) return pull('updated-cursor-0001');
      const body=JSON.parse(String(init.body)) as {operations:unknown[]};assert.deepEqual(body.operations,[pending]);return acceptedCreate(id(10));
    });
    await f.session.synchronize('https://sync.test');assert.equal(f.session.account().view(day).pendingCount,0);
  } finally {f.close();}
});
