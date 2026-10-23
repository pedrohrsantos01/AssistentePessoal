// Dedicated technical entry. No product route imports this fixture or its bridge.
import Dexie from 'dexie';
import { getDayKey } from '../../app/src/features/gamification/domain/day-key.ts';
import { uuid7 as id } from './local/ids.ts';
import { MainDatabase, AppearanceStore, mainStores } from './local/database.ts';
import { Coordinator } from './local/coordinator.ts';
import { LocalRepository, type PublicSession } from './local/repository.ts';
import { Remote, Presentation } from './local/remote.ts';
import type { Lease, Owner } from './local/records.ts';
import { pt } from './i18n/pt-BR.ts';
import { applyTheme } from './theme.ts';
import './style.css';
const build=import.meta.env.VITE_RITMO_PROOF_BUILD??'coord-1';

const timeContext={timezone:'America/Sao_Paulo',dayStartHour:4};
const day=getDayKey(new Date(),timeContext.timezone,timeContext.dayStartHour);
const coordinator=new Coordinator(id(),navigator.locks);await coordinator.start();
const db=new MainDatabase('ritmo-main',state=>{invalidate();phase(state==='versionchange'?pt.coordination.versionChanged:pt.coordination.upgradeBlocked);});
const repository=new LocalRepository(db,coordinator,build),presentation=new Presentation<unknown>();
let stopObserving:(()=>void)|undefined;
function invalidate() {presentation.invalidate();document.getElementById('diagnostic')!.textContent='';}
const visual=new AppearanceStore();let owner:Owner|null=null,lease:Lease|null=null,remote:Remote|null=null;
const headers={'Content-Type':'application/json','X-Ritmo-Web':'1','X-App-Version':'0.1.0','X-Ritmo-Protocol':'m1.1'};
async function post<T>(route:string,body:unknown,extra:Record<string,string>={}):Promise<T> {
  const response=await fetch('/api/v1/web'+route,{method:'POST',credentials:'same-origin',headers:{...headers,...extra},body:JSON.stringify(body)});
  if(!response.ok) throw new Error(`fixture_http_${response.status}`);return await response.json() as T;
}
function phase(value:string) {document.getElementById('phase')!.textContent=value;}
async function refresh() {
  if(!lease) return null;const result=await repository.read(lease,day);stopObserving?.();stopObserving=repository.observeSelection(result.stamp,invalidate);presentation.reveal(result.stamp,result.view);
  const summary={build,owner:result.stamp.tab===coordinator.tab,epoch:result.stamp.epoch,account:lease.account,operations:result.operations.map(row=>({id:row.operation_id,status:row.status,sequence:row.client_sequence})),nextSequence:result.state.next_sequence,view:result.view};
  document.getElementById('diagnostic')!.textContent=JSON.stringify(summary,null,2);return summary;
}
window.addEventListener('pagehide',()=>{stopObserving?.();invalidate();});document.addEventListener('visibilitychange',()=>{invalidate();});
await repository.open(id());owner=await coordinator.acquire(db);
if(owner) await repository.setCompatibility(owner,'compatible',new Date().toISOString());
try {lease=await repository.lease();}catch {/* Explicit online fixture login is needed. */}
applyTheme();document.title=pt.coordination.title;document.getElementById('title')!.textContent=pt.coordination.title;document.getElementById('scope')!.textContent=pt.coordination.scope;phase(pt.coordination.ready);await refresh();
const bridge={
  ready:true,id,build,tab:coordinator.tab,repository,db,coordinator,presentation,visual,refresh,
  phase(index:number) {phase(pt.coordination.phases[index]!);},
  async login(email:string,register=true) {
    if(!owner) throw new Error('fixture_not_owner');
    const attempt=id(),installation=(await db.installation_control.get(1))!.installation_id;
    await repository.startAuth(owner,attempt,null);
    const challenge=await post<{contextId:string;preparationTicket:string;reservationExpiresAt:string;closeCookieExpiresAt:string}>('/auth/challenge',{attemptId:attempt,installationId:installation,expectedAccountId:null});
    await repository.recordChallenge(owner,attempt,challenge.contextId,challenge.reservationExpiresAt,challenge.closeCookieExpiresAt);await repository.prepareDispatched(owner,attempt);
    await post('/auth/prepare',{preparationTicket:challenge.preparationTicket});await post(`/contexts/${challenge.contextId}/confirm-reservation`,{});await repository.confirmReservation(owner,attempt);
    const extra={'X-Ritmo-Owner-Epoch':owner.epoch,'X-Ritmo-Owner-Tab':owner.tab};
    await post(`/contexts/${challenge.contextId}/${register?'register':'login'}`,{email,password:'fixture-password',deviceId:installation,...(register?{displayName:'Fixture'}:{})},extra);
    const session=await post<PublicSession>(`/contexts/${challenge.contextId}/inspect`,{},extra);
    lease=await repository.activate(owner,attempt,session);remote=new Remote(repository,lease);await remote.claim();await refresh();return lease;
  },
  async takeover(explicit=true) {owner=await coordinator.acquire(db,explicit);if(owner) {lease=await repository.lease();remote=new Remote(repository,lease);}await refresh();return owner;},
  async onboard() {if(!lease) throw new Error('fixture_no_session');await repository.enqueue(lease,{type:'profile.setOnboarding',timeContext,completed:false,analyticsConsent:false},id(),new Date().toISOString());},
  async create(title='Fixture') {if(!lease) throw new Error('fixture_no_session');const habit=id();await repository.enqueue(lease,{type:'habit.create',habitId:habit,title,habitType:'binary',scheduleKind:'daily',startDayKey:day,timeContext,iconKey:null,colorToken:null,sortOrder:0},id(),new Date().toISOString());await refresh();return habit;},
  async patch(habit:string) {if(!lease) throw new Error('fixture_no_session');await repository.enqueue(lease,{type:'habit.patchMetadata',habitId:habit,patch:{title:'Changed during staging'}},id(),new Date().toISOString());await refresh();},
  async mark(habit:string) {if(!lease) throw new Error('fixture_no_session');const op=await repository.enqueue(lease,{type:'habit.mark',habitId:habit,dayKey:day,timeContext,observedUndoIds:[]},id(),new Date().toISOString());await refresh();return op;},
  async push() {if(!lease) throw new Error('fixture_no_session');remote??=new Remote(repository,lease);const result=await remote.push();await refresh();return result;},
  async claim() {if(!lease) throw new Error('fixture_no_session');remote??=new Remote(repository,lease);await remote.claim();},
  async pull() {if(!remote) throw new Error('fixture_no_remote');await remote.pull();await refresh();},
  async snapshot() {if(!remote) throw new Error('fixture_no_remote');await remote.snapshot();await refresh();},
  async logout() {if(!lease) throw new Error('fixture_no_session');await repository.logout(lease);presentation.invalidate();lease=null;remote=null;document.getElementById('diagnostic')!.textContent='';},
  async closeCurrentRemote() {if(!lease) throw new Error('fixture_no_session');return post(`/contexts/${lease.context}/close`,{});},
  currentLease:()=>lease,currentOwner:()=>owner,
  async recover() {if(!lease) throw new Error('fixture_no_session');await repository.recoverAttempts(lease);},
  async checkCompatibility(state:'compatible'|'upgrade_required') {if(!owner) throw new Error('fixture_not_owner');await repository.setCompatibility(owner,state,new Date().toISOString());},
  async migration(fail:boolean) {
    const experimental=new Dexie('ritmo-main');experimental.on('blocked',()=>phase(pt.coordination.upgradeBlocked));experimental.version(1).stores(mainStores);experimental.version(2).stores(mainStores).upgrade(async tx=>{if(fail) {if(!lease) throw new Error('fixture_no_session');await tx.table('sync_state').update(lease.account,{next_sequence:4242});throw new Error('fixture_upgrade_abort');}});
    try {await coordinator.gate(()=>experimental.open());return experimental.backendDB().version;}finally {experimental.close();}
  },
  // Only this test bridge can hold a gate without a transaction, to reproduce a frozen owner.
  holdGate() {let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});void coordinator.gate(async()=>{phase(pt.coordination.gateHeld);await held;});Object.assign(bridge,{releaseGate:release});},
  releaseGate:()=>{},
};
Object.assign(window,{proof:bridge});
if('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js');
