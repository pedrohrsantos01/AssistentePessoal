import {Platform} from 'react-native';
import {migrate} from 'drizzle-orm/expo-sqlite/migrator';
import accountMigrations from '../drizzle/migrations.ts';
import {expoStorage} from '../src/core/db/expo-storage.ts';
import type {AccountStore} from '../src/core/db/account-store.ts';
import type {DatabaseKind,LocalStorage} from '../src/core/db/local-opening.ts';
import {openLocalSession} from '../src/core/identity/session-opening.ts';
import {nativeId} from '../src/core/identity/open-expo-session.ts';
import {secureVault} from '../src/core/identity/secure-vault.ts';
import {HttpIdentity} from '../src/core/identity/http-identity.ts';
import {HttpSync,synchronize} from '../src/core/sync/synchronize.ts';
import {startExpoSync} from '../src/core/sync/start-expo-sync.ts';
import type {CreateHabit} from '../src/core/sync/protocol.ts';

const origin='http://127.0.0.1:18765',password='native-fixture-password';
const timeContext={timezone:'UTC',dayStartHour:0};
function check(condition:boolean,code:string):asserts condition {if(!condition) throw new Error(code);}
function ordered(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(ordered);
  if(value===null||typeof value!=='object') return value;
  const record=value as Record<string,unknown>;
  return Object.fromEntries(Object.keys(record).sort().map(key=>[key,ordered(record[key])]));
}
function same(actual:unknown,expected:unknown,code:string) {check(JSON.stringify(ordered(actual))===JSON.stringify(ordered(expected)),code);}
async function fails(work:()=>unknown|Promise<unknown>,expected:string) {
  try {await work();} catch(error) {check(error instanceof Error&&error.message===expected,'unexpected_failure_code');return;}
  throw new Error('expected_failure_missing');
}
async function until(ready:()=>boolean) {
  const deadline=Date.now()+35000;
  while(!ready()) {check(Date.now()<deadline,'acceptance_sync_timeout');await new Promise(resolve=>setTimeout(resolve,100));}
}
function create(day:string,title:string):CreateHabit {
  return {type:'habit.create',habitId:nativeId(),title,habitType:'binary',scheduleKind:'daily',
    startDayKey:day,timeContext,iconKey:null,colorToken:null,sortOrder:0};
}
function pair(store:AccountStore,day:string,title:string) {
  const command=create(day,title),at=new Date().toISOString();
  const parent=store.enqueue(command,nativeId(),at);
  const child=store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext,observedUndoIds:[]},nativeId(),at);
  return {parent,child};
}

// The fault switches wrap external native boundaries only. Production modules are unchanged.
export async function exerciseExceptions(link:string) {
  const match=/^ritmo-http:\/\/acceptance\/([0-9a-f-]{36})\/(vault|opening|identity-operation|identity-sequence|accounts)\/([a-z_]+)\/([0-9]{4}-[0-9]{2}-[0-9]{2})$/.exec(link);
  check(match!==null,'invalid_acceptance_link');check(Platform.OS==='android','android_only');
  const run=match[1]!,scenario=match[2]!,phase=match[3]!,day=match[4]!;
  const prefix='acceptance-'+scenario+'-'+run+'-';
  const fault:{vault:boolean;kind:DatabaseKind|null;stage:'open'|'pragma'|'migration'|null}={vault:false,kind:null,stage:null};
  const counts={opened:0,closed:0,vaultReads:0};
  const journal=accountMigrations.journal;
  const injectedMigrations={journal:{...journal,entries:[...journal.entries,{idx:journal.entries.length,version:'6',
    when:journal.entries[journal.entries.length-1]!.when+1,tag:'acceptance_rollback',breakpoints:true}]},
    migrations:{...accountMigrations.migrations,
      ['m'+String(journal.entries.length).padStart(4,'0')]:
        "UPDATE sync_mutations SET envelope=json_set(envelope,'$.command.title','must_rollback') WHERE account_id=(SELECT account_id FROM account_storage) AND json_extract(envelope,'$.command.type')='habit.create';\n--> statement-breakpoint\nSELECT value FROM acceptance_missing_table;"}};
  const storage:LocalStorage={
    journal:kind=>kind==='account'&&fault.kind===kind&&fault.stage==='migration'?injectedMigrations.journal:expoStorage.journal(kind),
    open(name,kind) {
      if(fault.kind===kind&&fault.stage==='open') throw Object.assign(new Error('controlled_open_failure'),{code:'SQLITE_CANTOPEN'});
      const connection=expoStorage.open(prefix+name,kind);counts.opened++;let closed=false;
      return {db:connection.db,
        exec(sql) {
          if(fault.kind===kind&&fault.stage==='pragma') throw Object.assign(new Error('controlled_pragma_failure'),{code:'SQLITE_IOERR'});
          connection.exec(sql);
        },
        migrate:()=>fault.kind===kind&&fault.stage==='migration'
          ?migrate(connection.db as Parameters<typeof migrate>[0],injectedMigrations):connection.migrate(),
        close() {if(!closed) {closed=true;counts.closed++;connection.close();}},
      };
    },
  };
  const vault={
    get(key:string) {counts.vaultReads++;if(fault.vault) return Promise.reject(new Error('controlled_vault_failure'));return secureVault.get(key);},
    set:secureVault.set,remove:secureVault.remove,
  };
  let owner:Awaited<ReturnType<typeof openLocalSession>>|undefined,automatic:ReturnType<typeof startExpoSync>|undefined;
  const open=()=>openLocalSession(storage,vault,compatibility=>new HttpIdentity(origin,compatibility),nativeId);
  const report=(name:string,store:AccountStore|null,details:Record<string,unknown>={})=>{
    // Only synthetic domain fixtures and allowlisted diagnostics; no credential/reference/platform error.
    console.log('RITMO_ANDROID_ACCEPTANCE:'+JSON.stringify({run,scenario,phase:name,passed:true,
      view:store?.view(day)??null,queue:store?.operations()??[],recovery:store?.recovery()??[],...details}));
  };
  const prepare=async()=>{
    owner=await open();
    await owner.session.register(run+'-'+scenario+'-a@example.test',password,'Native acceptance');
    owner.session.account().enqueue({type:'profile.setOnboarding',timeContext,completed:true,analyticsConsent:false},nativeId(),new Date().toISOString());
    await owner.session.synchronize(origin);
    pair(owner.session.account(),day,'Hábito '+scenario+' A');
    report('prepared',owner.session.account(),{accountId:owner.session.account().accountId});
  };
  try {
    if(phase==='prepare') await prepare();
    else if(scenario==='vault') {
      fault.vault=phase==='blocked'||phase==='retry';owner=await open();
      const session=owner.session,store=session.account();
      automatic=startExpoSync(session,origin);
      if(fault.vault) {
        check(session.vaultRecovery().unavailable,'vault_not_paused');
        await fails(()=>session.accessToken(),'vault_unavailable');
        await session.retryVault();check(session.vaultRecovery().unavailable,'failed_retry_not_preserved');
        if(phase==='blocked') {
          check(store.view(day).pendingCount===2,'initial_queue_changed');
          pair(store,day,'Escrita durante falha do cofre');
          check(store.view(day).pendingCount===4&&store.view(day).totalXp===20,'local_write_blocked');
          await until(()=>automatic!.scheduler.status().sync.phase==='paused');
          report('vault_blocked',store,{vault:session.vaultRecovery(),vaultReads:counts.vaultReads});
        } else {
          check(store.view(day).pendingCount===4,'restart_lost_vault_queue');
          const before=store.operations();fault.vault=false;await session.retryVault();
          same(store.operations(),before,'vault_retry_changed_intent');
          await until(()=>automatic!.scheduler.status().sync.phase==='idle'&&store.view(day).pendingCount===0);
          await session.accessToken(true);await session.synchronize(origin);
          check(store.view(day).totalXp===20,'vault_retry_duplicate_xp');
          report('vault_recovered',store,{vault:session.vaultRecovery(),vaultReads:counts.vaultReads});
        }
      } else {
        await until(()=>automatic!.scheduler.status().sync.phase==='idle'&&store.view(day).pendingCount===0);
        await session.accessToken(true);await session.synchronize(origin);
        check(store.view(day).totalXp===20,'vault_reopen_duplicate_xp');report('verified',store);
      }
    } else if(scenario==='opening') {
      if(phase==='verify') {
        owner=await open();await owner.session.synchronize(origin);check(owner.session.account().view(day).totalXp===10,'opening_duplicate_xp');
        report('verified',owner.session.account());
      } else {
        check(['account_open','account_pragma','account_migration','installation_open'].includes(phase),'invalid_opening_phase');
        fault.kind=phase==='installation_open'?'installation':'account';
        fault.stage=phase==='account_pragma'?'pragma':phase==='account_migration'?'migration':'open';
        owner=await open();
        const diagnostic=owner.recovery();
        check(diagnostic!==null&&diagnostic.scope===fault.kind&&diagnostic.stage===fault.stage,'opening_diagnostic_mismatch');
        await fails(()=>owner!.session.account(),fault.kind==='installation'?'installation_locked':'session_locked');
        if(fault.kind==='installation') check(counts.opened===0&&counts.vaultReads===0,'installation_fallback_attempted');
        else {
          check(counts.opened-counts.closed===1,'failed_connection_leaked');
          automatic=startExpoSync(owner.session,origin);
          check(automatic.scheduler.status().sync.phase==='paused','database_sync_not_paused');
          await fails(()=>owner!.session.synchronize(origin),'session_locked');
        }
        report(phase+'_blocked',null,{database:diagnostic,handles:{...counts}});
        automatic?.close();automatic=undefined;
        fault.kind=null;fault.stage=null;await owner.retryDatabase();
        check(owner.recovery()===null,'opening_retry_still_blocked');
        check(owner.session.account().view(day).pendingCount===2&&owner.session.account().view(day).totalXp===10,'opening_retry_lost_work');
        report(phase+'_recovered',owner.session.account(),{handles:{...counts}});
      }
    } else if(scenario.startsWith('identity-')) {
      owner=await open();const session=owner.session;
      if(phase==='exercise') {
        await session.register(run+'-'+scenario+'-a@example.test',password,'Identity acceptance');
        session.account().enqueue({type:'profile.setOnboarding',timeContext,completed:true,analyticsConsent:false},nativeId(),new Date().toISOString());
        await session.synchronize(origin);
        const store=session.account(),command=create(day,'Intenção divergente Café 😀');
        const parent=store.enqueue(command,nativeId(),new Date().toISOString());
        const original={...parent,operationId:scenario==='identity-sequence'?nativeId():parent.operationId,
          command:{...command,title:'Intenção canônica Café 😀'}};
        const api=new HttpSync(origin,store.accountId,()=>session.accessToken(),nativeId);
        const accepted=await api.push([original]);check('receipt' in accepted.results[0]!,'original_not_accepted');
        const receipt=accepted.results[0].receipt;check(receipt.status==='accepted','original_receipt_not_accepted');
        const child=store.enqueue({type:'habit.mark',habitId:command.habitId,dayKey:day,timeContext,observedUndoIds:[]},nativeId(),new Date().toISOString());
        pair(store,day,'Independente Água 😀');
        await synchronize(store,api);
        const recovery=store.recovery();
        check(recovery.length===2,'identity_chain_not_blocked');
        same(recovery[0]?.operation,parent,'divergent_intent_changed');
        same(recovery[1]?.operation,child,'dependent_intent_changed');
        check(recovery[1]?.error.code==='identity_dependency_unresolved','dependent_not_preserved');
        await fails(()=>store.correct([{operationId:parent.operationId,replacementId:nativeId()}]),'operation_not_recoverable');
        await fails(()=>store.discard([child.operationId]),'operation_not_recoverable');
        check(store.view(day).pendingCount===0&&store.view(day).totalXp===10,'independent_work_failed');
        const replay=await api.push([original]);check('receipt' in replay.results[0]!,'original_replay_failed');
        same(replay.results[0].receipt,receipt,'original_receipt_changed');
        report('identity_blocked',store,{accountId:store.accountId,originalReceipt:receipt,
          receiptOrderChanged:JSON.stringify(Object.keys(replay.results[0].receipt))!==JSON.stringify(Object.keys(receipt))});
      } else {
        check(phase==='verify','invalid_identity_phase');await session.synchronize(origin);
        check(session.account().recovery().length===2&&session.account().view(day).totalXp===10,'identity_restart_lost_diagnostic');
        await fails(()=>session.account().discard([session.account().recovery()[0]!.operation.operationId]),'operation_not_recoverable');
        report('verified',session.account(),{accountId:session.account().accountId});
      }
    } else {
      owner=await open();const session=owner.session;
      if(phase==='logout') {
        const old=session.account(),before=old.operations();await session.logout();
        await fails(()=>old.view(day),'session_locked');await fails(()=>session.account(),'session_locked');
        let refused=false;try {await session.login(run+'-'+scenario+'-a@example.test',password);} catch {refused=true;}
        check(refused,'offline_login_accepted');await fails(()=>session.account(),'session_locked');
        report('offline_logout',null,{preservedQueue:before});
      } else if(phase==='account_b') {
        await fails(()=>session.account(),'session_locked');
        await session.register(run+'-'+scenario+'-b@example.test',password,'Native account B');
        check(session.account().view(day).habits.length===0,'account_a_leaked_to_b');
        session.account().enqueue({type:'profile.setOnboarding',timeContext,completed:true,analyticsConsent:false},nativeId(),new Date().toISOString());
        await session.synchronize(origin);pair(session.account(),day,'Somente B');await session.synchronize(origin);
        check(session.account().view(day).totalXp===10,'account_b_sync_failed');
        report('account_b',session.account(),{accountId:session.account().accountId});
      } else if(phase==='account_a') {
        const old=session.account();await session.logout();await session.login(run+'-'+scenario+'-a@example.test',password);
        await fails(()=>old.view(day),'session_locked');
        check(session.account().view(day).pendingCount===2,'account_a_queue_lost');
        report('account_a_restored',session.account(),{accountId:session.account().accountId});
        await session.synchronize(origin);await session.accessToken(true);await session.flushRevocations();
        check(session.account().view(day).pendingCount===0&&session.account().view(day).totalXp===10,'account_a_convergence_failed');
        report('account_a_converged',session.account(),{accountId:session.account().accountId});
      } else {
        check(phase==='verify','invalid_account_phase');await session.accessToken(true);await session.synchronize(origin);
        check(session.account().view(day).pendingCount===0&&session.account().view(day).totalXp===10,'account_a_reopen_failed');
        report('verified',session.account(),{accountId:session.account().accountId});
      }
    }
    // Let the driver observe reports and kill the process with actual native handles open.
    await new Promise<void>(()=>{});
  } catch(error) {
    console.log('RITMO_ANDROID_ACCEPTANCE:'+JSON.stringify({run,scenario,phase,passed:false,
      error:error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'native_unexpected_failure'}));
  } finally {automatic?.close();owner?.close();}
}
