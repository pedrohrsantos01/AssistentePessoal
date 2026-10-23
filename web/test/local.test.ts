import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Dexie from 'dexie';
import { operationHash } from '../../app/src/core/sync/operation-hash.ts';
import { AppearanceStore, mainStores } from '../src/local/database.ts';
import { LocalRepository } from '../src/local/repository.ts';
import { Coordinator } from '../src/local/coordinator.ts';
import { Presentation, Remote } from '../src/local/remote.ts';
import { increment } from '../src/local/records.ts';
import { setup,login,id,at,day,create } from './local-support.ts';

test('real schema: atomic intention/sequence/view, quota and explicit abort preserve prior commit',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),command=create(),operation=await f.repo.enqueue(lease,command,id(),at),before=await f.repo.read(lease,day);
    assert.equal(before.state.next_sequence,2);assert.equal(before.view.habits.length,1);assert.equal(operation.deviceId,lease.installation);
    const hook=()=>{throw new DOMException('fixture_quota','QuotaExceededError');};f.db.sync_state.hook('updating',hook);
    await assert.rejects(f.repo.enqueue(lease,create(),id(),at),{name:'QuotaExceededError'});f.db.sync_state.hook('updating').unsubscribe(hook);
    assert.deepEqual(await f.repo.read(lease,day),before);
    const abort=()=>{Dexie.currentTransaction!.abort();};f.db.projected_views.hook('creating',abort);
    await assert.rejects(f.repo.enqueue(lease,create(),id(),at));f.db.projected_views.hook('creating').unsubscribe(abort);
    assert.deepEqual(await f.repo.read(lease,day),before);
  }finally {await f.close();}
});

test('CAS on two new documents has one winner; presence blocks autoacquire; explicit transfer fences stale commits/acks/pulls',async()=>{
  const f=await setup();const other=new Coordinator(id(),f.locks);await other.start();try {
    const lease=await login(f.repo,f.owner),op=await f.repo.enqueue(lease,create(),id(),at);
    assert.equal(await other.acquire(f.db),null);
    const next=await other.acquire(f.db,true);assert.ok(next);
    const before=await f.repo.read(lease,day);
    await assert.rejects(f.repo.enqueue(lease,create(),id(),at),/owner_lost/);
    await assert.rejects(f.repo.applyAck(lease,[op],[{receipt:{operationId:op.operationId,status:'accepted',acceptedRevision:'2',operationHash:operationHash(op)},replayed:false}],Date.now()),/owner_lost/);
    await assert.rejects(f.repo.applyPull(lease,null,{changes:[],nextCursor:'cursor-0000000001',hasMore:false,highWaterRevision:'2',serverTime:at}),/owner_lost/);
    assert.deepEqual(await f.repo.read(lease,day),before);
  }finally {await other.stop();await f.close();}
});

test('fresh concurrent claim CAS and dead-document recovery do not adopt another winner',async()=>{
  const f=await setup();const a=new Coordinator(id(),f.locks),b=new Coordinator(id(),f.locks);await a.start();await b.start();try {
    await f.db.installation_control.update(1,{owner_tab_id:null,owner_epoch:'9007199254740992'});
    const results=await Promise.all([a.acquire(f.db),b.acquire(f.db)]);assert.equal(results.filter(Boolean).length,1);
    assert.equal(results.find(Boolean)!.epoch,'9007199254740993');
    const winner=results[0]?a:b,loser=results[0]?b:a;await winner.stop();assert.ok(await loser.acquire(f.db));
    assert.throws(()=>increment('9223372036854775807'),/epoch_exhausted/);
  }finally {await a.stop();await b.stop();await f.close();}
});

test('four contexts, irreversible dispatch, missing proof, old callback and terminal local use',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner);const j=await f.db.auth_journal.where('context_id').equals(lease.context).first();
    await f.repo.resolveJournal(f.owner,j!.attempt_id,'expired');
    await f.repo.enqueue(lease,create(),id(),at);await assert.rejects(f.repo.beginAttempt(lease,Date.now()),/authentication_required/);
    const attempt=id();await f.repo.startAuth(f.owner,attempt,null);await f.repo.recordChallenge(f.owner,attempt,id(),at,at);await f.repo.prepareDispatched(f.owner,attempt);
    await assert.rejects(f.repo.resolveJournal(f.owner,attempt,'not_dispatched'),/invalid_terminal_proof/);
    await f.repo.resolveJournal(f.owner,attempt,'expired_unbound');
    await assert.rejects(f.repo.confirmReservation(f.owner,attempt),/reservation_unconfirmed/);
    for(let n=0;n<4;n++) await f.repo.startAuth(f.owner,id(),null);
    await assert.rejects(f.repo.startAuth(f.owner,id(),null),/auth_context_limit/);
    assert.equal((await f.repo.read(lease,day)).operations.length,1);
  }finally {await f.close();}
});

test('A→B→A preserves queue, blocks old journey callbacks/read and never exposes B through A lease',async()=>{
  const f=await setup();try {
    const a=await login(f.repo,f.owner),op=await f.repo.enqueue(a,create(),id(),at),presentation=new Presentation<string>();
    presentation.reveal(a,'A');presentation.edit('draft-A');presentation.reveal({account:a.account,context:a.context,generation:a.generation,installation:a.installation,tab:a.tab,epoch:a.epoch},'A');assert.equal(presentation.current().draft,'draft-A');assert.equal(presentation.canReload(false),false);
    await f.repo.logout(a);presentation.invalidate();assert.deepEqual(presentation.current(),{value:null,draft:''});
    const b=await login(f.repo,f.owner);await assert.rejects(f.repo.read(a,day),/session_locked/);assert.equal((await f.repo.read(b,day)).operations.length,0);
    await f.repo.logout(b);const again=await login(f.repo,f.owner,a.account);
    assert.equal((await f.repo.read(again,day)).operations[0]!.operation_id,op.operationId);assert.notEqual(again.generation,a.generation);
    await assert.rejects(f.repo.enqueue(a,create(),id(),at),/session_locked/);
    presentation.reveal(again,'A-new');assert.equal(presentation.current().draft,'');
  }finally {await f.close();}
});

test('beginAttempt commits before dispatch; crash resumes same immutable intention and delayed receipts need matching hash',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),op=await f.repo.enqueue(lease,create(),id(),at);
    assert.deepEqual(await f.repo.beginAttempt(lease,1000),[op]);
    assert.equal((await f.repo.read(lease,day)).operations[0]!.status,'in_flight');
    f.db.close();await f.db.open();await f.repo.recoverAttempts(lease);
    const resumed=(await f.repo.read(lease,day)).operations[0]!;assert.deepEqual(resumed.envelope,op);assert.equal(resumed.attempts,1);assert.equal(resumed.status,'retry_wait');
    await f.repo.applyAck(lease,[op],[{receipt:{operationId:op.operationId,status:'accepted',acceptedRevision:'2'},replayed:false}],1000);
    assert.equal((await f.repo.read(lease,day)).operations[0]!.error?.identity?.reason,'missing_proof');
    await assert.rejects(f.repo.correct(lease,[{operationId:op.operationId,replacementId:id()}]),/operation_not_recoverable/);
    await f.repo.applyAck(lease,[op],[{receipt:{operationId:op.operationId,status:'accepted',acceptedRevision:'2',operationHash:operationHash(op)},replayed:false}],1000);
    const after=await f.repo.read(lease,day);assert.equal(after.operations[0]!.status,'acknowledged');assert.equal(after.state.cursor,null);assert.equal(after.state.next_sequence,2);
  }finally {await f.close();}
});

test('rejected root correction remaps dependency graph/habit identity; original envelopes remain byte-identical',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),command=create(),root=await f.repo.enqueue(lease,command,id(),at),child=await f.repo.enqueue(lease,{type:'habit.patchMetadata',habitId:command.habitId,patch:{title:'Updated'}},id(),at);
    await f.repo.applyAck(lease,[root],[{receipt:{operationId:root.operationId,operationHash:operationHash(root),status:'rejected',error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false}],1000);
    assert.equal((await f.repo.read(lease,day)).operations[1]!.error?.code,'dependency_rejected');
    const newHabit=id(),replacement=id(),childReplacement=id();
    const corrected=await f.repo.correct(lease,[{operationId:child.operationId,replacementId:childReplacement},{operationId:root.operationId,replacementId:replacement,command:create(newHabit)}]);
    assert.deepEqual(corrected[1]!.dependsOn,[replacement]);assert.ok('habitId' in corrected[1]!.command&&corrected[1]!.command.habitId===newHabit);
    const rows=(await f.repo.read(lease,day)).operations;assert.deepEqual(rows[0]!.envelope,root);assert.deepEqual(rows[1]!.envelope,child);
    assert.equal(rows[2]!.envelope.supersedesOperationId,root.operationId);
  }finally {await f.close();}
});

test('snapshot swap atomically rechecks ALL current IDs at H, including an intention added during staging',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),first=await f.repo.enqueue(lease,create(),id(),at),snapshot=id();
    await f.repo.beginSnapshot(lease,snapshot,'5','page-00000000001','2026-10-23T12:00:00Z');
    await f.repo.stageSnapshot(lease,snapshot,'page-00000000001',[],null);
    const second=await f.repo.enqueue(lease,create(),id(),at),before=await f.repo.read(lease,day);
    await assert.rejects(f.repo.installSnapshot(lease,snapshot,0,[{operationId:first.operationId,status:'notProcessedAtH'}],'cursor-0000000001'),/incomplete_classification/);
    assert.deepEqual(await f.repo.read(lease,day),before);
    await f.repo.installSnapshot(lease,snapshot,0,[first,second].map(op=>({operationId:op.operationId,status:'notProcessedAtH' as const})),'cursor-0000000001');
    const after=await f.repo.read(lease,day);assert.equal(after.state.cursor,'cursor-0000000001');assert.equal(after.view.habits.length,2);assert.deepEqual(after.operations.map(row=>row.envelope),[first,second]);
  }finally {await f.close();}
});

test('build compatibility is per executable; unknown/corrupt format preserves data and closes',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner);await f.repo.enqueue(lease,create(),id(),at);
    await f.repo.setCompatibility(f.owner,'upgrade_required',at);const newer=new LocalRepository(f.db,f.coordinator,'fixture-new');await newer.open(id());await newer.setCompatibility(f.owner,'compatible',at);
    await assert.rejects(f.repo.enqueue(lease,create(),id(),at),/update_required/);assert.equal((await f.repo.read(lease,day)).operations.length,1);
    await newer.enqueue(lease,create(),id(),at);
    await f.db.installation_control.update(1,{owner_epoch:'9223372036854775808'});await assert.rejects(newer.read(lease,day),/invalid_decimal/);
    assert.equal(await f.db.sync_mutations.where('account_id').equals(lease.account).count(),2);
  }finally {await f.close();}
});

test('V1→experimental V2 rollback preserves V1; unknown physical version refuses reopening without deleting',async()=>{
  const f=await setup();let upgrade:Dexie|undefined;try {
    const lease=await login(f.repo,f.owner),op=await f.repo.enqueue(lease,create(),id(),at);f.db.close();
    upgrade=new Dexie(f.name);upgrade.version(1).stores(mainStores);upgrade.version(2).stores(mainStores).upgrade(async tx=>{await tx.table('sync_state').update(lease.account,{next_sequence:4242});throw new Error('fixture_upgrade_abort');});
    await assert.rejects(upgrade.open(),/fixture_upgrade_abort/);upgrade.close();await f.db.open();assert.deepEqual((await f.repo.read(lease,day)).operations[0]!.envelope,op);assert.equal((await f.repo.read(lease,day)).state.next_sequence,2);f.db.close();
    upgrade=new Dexie(f.name);upgrade.version(2).stores(mainStores);await upgrade.open();upgrade.close();
    await assert.rejects(f.db.open(),/schema_unknown/);assert.equal(await Dexie.exists(f.name),true);
  }finally {upgrade?.close();await f.close();}
});

test('appearance failure pauses only preferences, failed write keeps saved value, reopen reads actual committed choice',async()=>{
  const f=await setup(),visual=new AppearanceStore(`visual-${id()}`);try {
    const lease=await login(f.repo,f.owner);assert.equal((await visual.read()).paused,false);
    const chosen={version:1 as const,skin:'neo' as const,mode:'dark' as const};await visual.write(chosen);
    const hook=()=>{throw new DOMException('fixture_quota','QuotaExceededError');};visual.db.table('preferences').hook('updating',hook);
    await assert.rejects(visual.write({...chosen,skin:'cockpit'}),/appearance_write_failed/);visual.db.table('preferences').hook('updating').unsubscribe(hook);
    visual.close();assert.deepEqual((await visual.read()).value,chosen);
    await visual.db.table('preferences').put({version:99},'appearance');assert.equal((await visual.read()).paused,true);await assert.rejects(visual.write(chosen),/appearance_paused/);
    await f.repo.enqueue(lease,create(),id(),at);assert.equal((await f.repo.read(lease,day)).operations.length,1);
  }finally {visual.close();await visual.db.delete();await f.close();}
});


test('async adapter preserves native operation envelopes, provisional projection and rejection/correction semantics',async()=>{
  const {openTestStore}=await import('../../app/test/support/store.ts');
  const f=await setup();let native:ReturnType<typeof openTestStore>|undefined;try {
    const lease=await login(f.repo,f.owner);native=openTestStore(':memory:',lease.account,lease.installation);
    const rootId=id(),childId=id(),command=create();
    const root=await f.repo.enqueue(lease,command,rootId,at);assert.deepEqual(root,native.enqueue(command,rootId,at));
    const mark={type:'habit.mark' as const,habitId:command.habitId,dayKey:day,timeContext:{timezone:'America/Sao_Paulo',dayStartHour:4},observedUndoIds:[]};
    const child=await f.repo.enqueue(lease,mark,childId,at);assert.deepEqual(child,native.enqueue(mark,childId,at));
    assert.deepEqual((await f.repo.read(lease,day)).view,{habits:native.view(day).habits,totalXp:native.view(day).totalXp});
    const rejection={receipt:{operationId:root.operationId,operationHash:operationHash(root),status:'rejected' as const,error:{code:'title_unavailable',fields:[],dependencyIds:[]}},replayed:false};
    await f.repo.applyAck(lease,[root],[rejection],1000);native.applyAck([rejection],1000);
    const requests=[{operationId:rootId,replacementId:id(),command:create()},{operationId:childId,replacementId:id()}];
    assert.deepEqual(await f.repo.correct(lease,requests),native.correct(requests));
    assert.deepEqual((await f.repo.read(lease,day)).view,{habits:native.view(day).habits,totalXp:native.view(day).totalXp});
  }finally {native?.close();await f.close();}
});


test('default network port retains Window receiver and cannot send before the matching owner claim',async()=>{
  const f=await setup(),original=globalThis.fetch;let calls=0;try {
    const lease=await login(f.repo,f.owner);
    globalThis.fetch=async function(this:unknown,_input,init) {
      assert.equal(this,globalThis);calls++;
      assert.deepEqual(JSON.parse(String(init?.body)),{epoch:lease.epoch,tabId:lease.tab});
      return new Response(JSON.stringify({contextId:lease.context,epoch:lease.epoch,tabId:lease.tab,futureOptional:'tolerated'}));
    };
    const remote=new Remote(f.repo,lease);
    await assert.rejects(remote.push(),/remote_owner_unconfirmed/);assert.equal(calls,0);
    await remote.claim();assert.equal(calls,1);
  }finally {globalThis.fetch=original;await f.close();}
});


test('authoritative selection observer invalidates a secondary presentation on logout without deleting intentions',async()=>{
  const f=await setup();let stop:(()=>void)|undefined;try {
    const lease=await login(f.repo,f.owner),op=await f.repo.enqueue(lease,create(),id(),at),presentation=new Presentation<string>();
    presentation.reveal(lease,'account-A');presentation.edit('unsaved-A');
    const invalidated=new Promise<void>(resolve=>{stop=f.repo.observeSelection(lease,()=>{presentation.invalidate();resolve();});});
    await f.repo.logout(lease);await invalidated;assert.deepEqual(presentation.current(),{value:null,draft:''});
    const again=await login(f.repo,f.owner,lease.account);assert.equal((await f.repo.read(again,day)).operations[0]!.operation_id,op.operationId);
  }finally {stop?.();await f.close();}
});


test('transport tolerates optional fields but an unknown required effect cannot advance the committed cursor',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner);
    await f.repo.applyPull(lease,null,{changes:[],nextCursor:'cursor-0000000001',hasMore:false,highWaterRevision:'1',serverTime:at});
    const before=await f.repo.read(lease,day);
    const page={changes:[{revision:'2',operationResults:[{operationId:id(),status:'accepted',acceptedRevision:'2'}],entities:[{kind:'futureRequiredEffect',value:{revision:'2'}}]}],nextCursor:'cursor-0000000002',hasMore:false,highWaterRevision:'2',serverTime:at};
    const request:typeof fetch=async input=>new Response(JSON.stringify(String(input).endsWith('/claim-owner')?{contextId:lease.context,epoch:lease.epoch,tabId:lease.tab}:page));
    const remote=new Remote(f.repo,lease,request);await remote.claim();
    await assert.rejects(remote.pull(),/unsupported_protocol/);
    await assert.rejects(f.repo.enqueue(lease,create(),id(),at),/update_required/);
    assert.deepEqual(await f.repo.read(lease,day),before);
  }finally {await f.close();}
});


test('malformed derived rows are preserved and block writes instead of being overwritten by a rebuild',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner);await f.db.projected_views.update([lease.account,'xp','total'],{payload:{habitId:id(),title:'Wrong kind',done:false}});
    const malformed=await f.db.projected_views.get([lease.account,'xp','total']);
    await assert.rejects(f.repo.read(lease,day),/storage_unreadable/);
    await assert.rejects(f.repo.enqueue(lease,create(),id(),at),/storage_unreadable/);
    assert.deepEqual(await f.db.projected_views.get([lease.account,'xp','total']),malformed);assert.equal((await f.db.sync_state.get(lease.account))!.next_sequence,1);
  }finally {await f.close();}
});

test('optional nested response fields are ignored before persisting strict V1 entities and receipts',async()=>{
  const f=await setup();try {
    const lease=await login(f.repo,f.owner),command=create(),op=await f.repo.enqueue(lease,command,id(),at);
    await f.repo.applyPull(lease,null,{changes:[],nextCursor:'cursor-0000000001',hasMore:false,highWaterRevision:'1',serverTime:at});
    const {timeContext: creationTimeContext,...habit}=command;const value={...habit};delete (value as Partial<typeof command>).type;
    const page={changes:[{revision:'2',operationResults:[{operationId:op.operationId,status:'accepted',acceptedRevision:'2',operationHash:operationHash(op),futureOptional:true}],entities:[{kind:'habit',value:{...value,creationTimeContext,createdAt:at,updatedAt:at,deletedAt:null,revision:'2',futureOptional:true}}]}],nextCursor:'cursor-0000000002',hasMore:false,highWaterRevision:'2',serverTime:at,futureOptional:true};
    const request:typeof fetch=async input=>new Response(JSON.stringify(String(input).endsWith('/claim-owner')?{contextId:lease.context,epoch:lease.epoch,tabId:lease.tab}:page));
    const remote=new Remote(f.repo,lease,request);await remote.claim();await remote.pull();
    const result=await f.repo.read(lease,day);assert.equal(result.state.cursor,page.nextCursor);assert.equal(result.operations[0]!.status,'acknowledged');assert.equal(Object.hasOwn(result.operations[0]!.result!,'futureOptional'),false);
    assert.equal(Object.hasOwn((await f.db.canonical_entities.get([lease.account,'habit',command.habitId]))!.payload.value,'futureOptional'),false);
  }finally {await f.close();}
});


test('an in-flight response retains its immutable account/generation even if a consumer reuses a mutable lease object',async()=>{
  const f=await setup();try {
    const a=await login(f.repo,f.owner);assert.equal(Object.isFrozen(a),true);
    await f.repo.applyPull(a,null,{changes:[],nextCursor:'cursor-0000000001',hasMore:false,highWaterRevision:'1',serverTime:at});
    const mutable={...a};let release:(value:Response)=>void=()=>{},started:()=>void=()=>{};
    const dispatched=new Promise<void>(resolve=>{started=resolve;});
    const response=new Promise<Response>(resolve=>{release=resolve;});
    const request:typeof fetch=async input=>{
      if(String(input).endsWith('/claim-owner')) return new Response(JSON.stringify({contextId:a.context,epoch:a.epoch,tabId:a.tab}));
      started();return response;
    };
    const remote=new Remote(f.repo,mutable,request);await remote.claim();const pulling=remote.pull();await dispatched;
    await f.repo.logout(a);const b=await login(f.repo,f.owner);
    await f.repo.applyPull(b,null,{changes:[],nextCursor:'cursor-0000000001',hasMore:false,highWaterRevision:'1',serverTime:at});Object.assign(mutable,b);
    const before=await f.repo.read(b,day);
    release(new Response(JSON.stringify({changes:[],nextCursor:'cursor-0000000002',hasMore:false,highWaterRevision:'2',serverTime:at})));
    await assert.rejects(pulling,/session_locked/);assert.deepEqual(await f.repo.read(b,day),before);
  }finally {await f.close();}
});
