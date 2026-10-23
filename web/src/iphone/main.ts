import { createManual, type ManualController } from './controller.ts';
import { pt } from '../i18n/pt-BR.ts';
import { applyTheme } from '../theme.ts';
import './style.css';
const t=pt.iphone;document.title=t.title;applyTheme();
const root=document.getElementById('root')!;
root.innerHTML=`<header><p class="banner">${t.scope}</p><h1>${t.title}</h1><p>${t.intro}</p></header>
<p id="status" role="status" aria-live="polite"></p><p id="error" role="alert"></p><p id="network"></p><p id="mode"></p><p id="capabilities"></p>
<section><h2>${t.auth}</h2><form id="auth"><label>${t.email}<input id="email" type="email" autocomplete="off" required data-draft></label><label>${t.password}<input id="password" type="password" autocomplete="off" required data-draft></label><div class="actions"><button id="login" type="submit">${t.login}</button><button id="register" type="submit">${t.register}</button></div></form><button id="inspect">${t.inspect}</button></section>
<section><h2>${t.local}</h2><button id="onboard">${t.onboard}</button><form id="habit"><label>${t.habitTitle}<input id="title" data-draft required></label><div class="actions"><button id="create" type="submit">${t.create}</button><button id="quota" type="submit">${t.quota}</button></div></form><button id="migration">${t.migration}</button><p id="empty"></p><ul id="habits"></ul></section>
<section><h2>${t.controls}</h2><p id="ownership"></p><div class="actions"><button id="refresh">${t.refresh}</button><button id="takeover">${t.takeover}</button><button id="sync">${t.sync}</button><button id="logout">${t.logout}</button><button id="hold">${t.hold}</button><button id="release">${t.release}</button></div></section>
<section><h2>${t.recovery}</h2><button id="resolve">${t.resolve}</button><form id="recovery"><label>${t.target}<select id="context"></select></label><label>${t.recoveryEmail}<input id="recovery-email" type="email" autocomplete="off" required data-draft></label><label>${t.recoveryPassword}<input id="recovery-password" type="password" autocomplete="off" required data-draft></label><button id="recover" type="submit">${t.recover}</button></form></section>
<section><h2>${t.updating}</h2><p id="cache" role="status"></p><div class="actions"><button id="update">${t.update}</button><button id="reload">${t.reload}</button></div><label class="discard"><input id="discard" type="checkbox">${t.discard}</label><p>${t.installationHelp}</p><p>${t.durability}</p></section>
<section><dl id="metadata"></dl><h2>${t.operations}</h2><ul id="operations"></ul></section>`;
const input=(id:string)=>document.getElementById(id) as HTMLInputElement;
const button=(id:string)=>document.getElementById(id) as HTMLButtonElement;
const text=(id:string,value:string)=>{document.getElementById(id)!.textContent=value;};
let controller:ManualController|undefined,busy=false,inactive=false,rendering=0,registration:ServiceWorkerRegistration|undefined;
let cache=t.cachePreparing as string;
const build=import.meta.env.VITE_RITMO_IPHONE_BUILD??'iphone-1';
function clearPrivate() {for(const item of root.querySelectorAll<HTMLInputElement>('input[data-draft]'))item.value='';input('discard').checked=false;}
function dirty() {return [...root.querySelectorAll<HTMLInputElement>('input[data-draft]')].some(item=>!!item.value);}
function discardGuard() {if(dirty()&&!input('discard').checked)throw new Error('draft_confirmation');}
function errorMessage(error:unknown) {
  const code=error instanceof Error?error.message:'';
  if(typeof error==='object'&&error&&'name' in error&&error.name==='QuotaExceededError')return t.quotaError;
  if(code==='title_required')return t.titleError;
  if(['storage_unreadable','schema_unknown'].includes(code))return t.storage;
  if(['owner_lost','document_inactive'].includes(code))return t.ownershipError;
  if(code==='session_locked')return t.sessionError;
  if(['recovery_required','auth_context_limit','reservation_unconfirmed','stale_auth_attempt'].includes(code))return t.recoveryError;
  if(['update_required','unsupported_protocol'].includes(code))return t.upgradeError;
  if(code==='draft_confirmation')return t.discardError;
  if(typeof error==='object'&&error&&'status' in error&&typeof error.status==='number')return t.remoteError(error.status);
  return t.genericError;
}
async function render() {
  const revision=++rendering;let readable=true,owns=false,selectionValid=true;let metadata:{label:string;value:string}[]=[],journals:Awaited<ReturnType<ManualController['journals']>>=[];
  try {
    if(controller&&!inactive) {
      journals=await controller.journals();const c=await controller.control();owns=!!controller.owner&&c.owner_tab_id===controller.owner.tab&&c.owner_epoch===controller.owner.epoch;selectionValid=!controller.lease||(c.session_state==='active'&&c.selected_account_id===controller.lease.account&&c.selected_context_id===controller.lease.context&&c.session_generation===controller.lease.generation);
      const current=selectionValid?controller.read:null;
      metadata=[{label:t.installation,value:c.installation_id},{label:t.document,value:controller.coordinator.tab},{label:t.build,value:build},{label:t.contexts,value:String(journals.length)},{label:t.sequence,value:String(current?.state.next_sequence??'—')},{label:t.pending,value:String(current?.operations.filter(o=>!['acknowledged','rejected'].includes(o.status)).length??0)},{label:t.xp,value:String(current?.view.totalXp??0)}];
    }
  }catch {readable=false;clearPrivate(); /* Never reveal a cached view after a failed control read. */ }
  if(revision!==rendering)return;
  const view=readable&&selectionValid?controller?.read:null,writer=readable&&owns&&!!controller?.writable&&!inactive;
  text('network',navigator.onLine?t.online:t.offline);text('mode',matchMedia('(display-mode: standalone)').matches||('standalone' in navigator&&navigator.standalone===true)?t.modeStandalone:t.modeBrowser);
  if(controller?.waitingMigration)text('status',t.migrationWaiting);
  text('ownership',controller?.holding?t.held:controller?.compatibility==='upgrade_required'?t.upgradeError:writer?t.writer:t.reader);text('cache',cache);
  text('empty',view?view.view.habits.length?'':t.empty:t.locked);
  const list=document.getElementById('habits')!;
  if(!view)list.replaceChildren();
  else {
    const existing=new Map([...list.querySelectorAll<HTMLLIElement>('li[data-habit]')].map(row=>[row.dataset.habit!,row]));
    for(const habit of view.view.habits) {
      let row=existing.get(habit.habitId);existing.delete(habit.habitId);
      if(!row) {row=document.createElement('li');row.dataset.habit=habit.habitId;row.append(document.createElement('span'),document.createElement('button'));row.querySelector('button')!.addEventListener('click',()=>void run(()=>controller!.mark(habit.habitId),t.saved));list.append(row);}
      row.querySelector('span')!.textContent=habit.title;const action=row.querySelector('button')!;action.textContent=habit.done?t.done:t.mark;action.disabled=!writer||busy||habit.done;
    }
    for(const row of existing.values())row.remove();
  }
  list.setAttribute('aria-label',view?.view.habits.length?t.local:controller?.lease?t.empty:t.locked);
  const dl=document.getElementById('metadata')!;dl.replaceChildren();
  for(const item of metadata) {const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=item.label;dd.textContent=item.value;dd.dataset.label=item.label;dl.append(dt,dd);}
  const operations=document.getElementById('operations')!;operations.replaceChildren();
  for(const row of view?.operations??[]) {const li=document.createElement('li');li.dataset.operation=row.operation_id;li.dataset.state=row.status;li.textContent=t.operation(row.operation_id,row.status);operations.append(li);}
  const select=document.getElementById('context') as HTMLSelectElement,previous=select.value;select.replaceChildren();
  const pending=journals.filter(j=>j.phase!=='active'&&j.context_id);
  if(!pending.length) {const option=document.createElement('option');option.textContent=t.noTarget;option.value='';select.append(option);}
  pending.forEach((j,index)=>{const option=document.createElement('option');option.value=j.attempt_id;option.textContent=t.contextOption(index+1,j.phase);select.append(option);});if([...select.options].some(o=>o.value===previous))select.value=previous;
  for(const control of root.querySelectorAll<HTMLButtonElement>('button'))control.disabled=busy||!controller||inactive||!readable;
  for(const id of ['login','register','inspect'])button(id).disabled||= !writer||!!controller?.lease;
  for(const id of ['onboard','create','quota','sync','logout','migration'])button(id).disabled||= !writer||!view;
  for(const id of ['resolve','recover','hold'])button(id).disabled||=!writer;
  button('recover').disabled||=!pending.length;button('hold').disabled||=!!controller?.holding;
  button('release').disabled=!controller?.holding;button('reload').disabled=false;
  button('update').disabled=!registration||inactive;
  for(const row of list.querySelectorAll<HTMLLIElement>('li[data-habit]')) {const habit=view?.view.habits.find(h=>h.habitId===row.dataset.habit);row.querySelector('button')!.disabled=!writer||busy||!!habit?.done;}
}
async function run(work:()=>Promise<unknown>|void,success=t.ready as string) {
  if(busy)return;busy=true;text('error','');text('status',t.busy);void render();
  try {await work();text('status',success);}catch(error){text('error',errorMessage(error));text('status',t.ready);}
  finally {if(controller&&!inactive)try {await controller.refresh();}catch(error){clearPrivate();text('error',errorMessage(error));}busy=false;await render();}
}
function action(id:string,work:()=>Promise<unknown>|void,success?:string) {button(id).addEventListener('click',()=>void run(work,success));}
document.getElementById('auth')!.addEventListener('submit',event=>{event.preventDefault();const email=input('email').value,password=input('password').value;clearPrivate();const register=(event as SubmitEvent).submitter?.id==='register';void run(()=>controller!.login(email,password,register));});
document.getElementById('habit')!.addEventListener('submit',event=>{event.preventDefault();const title=input('title').value,quota=(event as SubmitEvent).submitter?.id==='quota';void run(async()=>{await controller!.create(title,quota);input('title').value='';},t.saved);});
document.getElementById('recovery')!.addEventListener('submit',event=>{event.preventDefault();const email=input('recovery-email').value,password=input('recovery-password').value,target=(document.getElementById('context') as HTMLSelectElement).value;input('recovery-password').value='';input('recovery-email').value='';void run(()=>controller!.recover(target,email,password),t.resolved);});
action('migration',()=>{discardGuard();clearPrivate();return controller!.abortMigration();},t.migrationAborted);action('inspect',()=>controller!.inspect());action('onboard',()=>controller!.onboard(),t.saved);action('refresh',()=>controller!.refresh());action('takeover',()=>{discardGuard();clearPrivate();return controller!.take();});action('sync',()=>controller!.sync(),t.synced);action('logout',()=>{discardGuard();clearPrivate();return controller!.logout();},t.loggedOut);action('resolve',()=>controller!.resolveContexts(),t.resolved);action('hold',()=>controller!.hold());button('release').addEventListener('click',()=>{controller?.release();void render();});
action('update',async()=>{await registration?.update();cache=registration?.waiting?t.cacheWaiting:t.cacheReady;});
action('reload',()=>{discardGuard();location.reload();});
for(const event of ['online','offline'])window.addEventListener(event,()=>void render());
document.addEventListener('visibilitychange',()=>{if(document.hidden){controller?.invalidate();clearPrivate();}else if(!busy&&!inactive&&controller)void run(()=>controller!.refresh());});
window.addEventListener('pagehide',()=>{inactive=true;controller?.invalidate();controller?.close();clearPrivate();});
window.addEventListener('pageshow',event=>{if(event.persisted){inactive=true;text('status',t.inactive);void render();}});
text('status',t.opening);text('cache',cache);
const probe=(read:()=>unknown)=>{try{return !!read();}catch{return false;}};
const capabilities:[string,boolean][]=[[t.secure,probe(()=>isSecureContext)],[t.database,probe(()=>globalThis.indexedDB)],[t.locks,probe(()=>navigator.locks)],[t.cryptography,probe(()=>globalThis.crypto?.subtle&&globalThis.crypto?.getRandomValues)],[t.worker,probe(()=>'serviceWorker' in navigator)]];
text('capabilities',t.capabilities(capabilities.map(([name,available])=>`${name}: ${available?t.present:t.absent}`)));
const supported=capabilities.every(([,available])=>available);
if(!supported) {text('error',t.unavailable);text('status',t.inactive);void render();}
else {
  controller=createManual(build,invalidated=>{if(invalidated)clearPrivate();void render();});
  void run(async()=>{
    try {await controller!.open();}catch(error){inactive=true;controller!.close();throw error;}
    try {
      registration=await navigator.serviceWorker.register('/ensaio/sw.js',{scope:'/ensaio/'});
      const update=()=>{cache=registration?.waiting?t.cacheWaiting:registration?.active?.state==='activated'?t.cacheReady:t.cachePreparing;void render();};
      const watch=()=>{registration?.installing?.addEventListener('statechange',update);update();};registration.addEventListener('updatefound',watch);watch();
    }catch {cache=t.cacheFailed;}
  }).catch(()=>{text('error',t.storage);});
}
