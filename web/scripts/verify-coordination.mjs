// Finite headed proof against WebSessionTests' disposable Java/Postgres and loopback TLS.
import { createServer } from 'node:https';
import { request } from 'node:http';
import { readFile,writeFile,mkdir,cp } from 'node:fs/promises';
import { resolve,sep,extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pt } from '../src/i18n/pt-BR.ts';
const [apiPort,tlsPort,certificate,outputArg]=process.argv.slice(2);
if(!certificate) throw new Error('Launch through WebSessionTests (RITMO_WEB_COORDINATION=1).');
const output=resolve(outputArg),root=resolve('dist'),oldRoot=resolve(output,'build-1');await mkdir(output,{recursive:true});
const build=version=>{execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...process.env,VITE_RITMO_PROOF_BUILD:version},stdio:'pipe'});execFileSync(process.execPath,['scripts/service-worker.mjs'],{stdio:'pipe'});};
build('coord-1');await cp(root,oldRoot,{recursive:true});
const origin=`https://127.0.0.1:${tlsPort}`,mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain','.webmanifest':'application/manifest+json','.png':'image/png','.ttf':'font/ttf'};
const holds=new Map(),outcomes=[],errors=[];let requests=0,context;
function hold(path,before=false) {let ready;const promise=new Promise(resolve=>{ready=resolve;});holds.set('/api/v1/web'+path,{ready,before});return promise;}
const server=createServer({pfx:await readFile(certificate),passphrase:'fixture-password'},async(req,res)=>{
  requests++;
  if(req.url?.startsWith('/api/')) {
    const chunks=[];for await(const chunk of req) chunks.push(chunk);const body=Buffer.concat(chunks),hold=holds.get(req.url);holds.delete(req.url);
    const forward=()=>{
      const upstream=request({hostname:'127.0.0.1',port:Number(apiPort),path:req.url,method:req.method,headers:req.headers},response=>{
        const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{
          outcomes.push({path:req.url,status:response.statusCode});const send=()=>{if(!res.destroyed) {res.writeHead(response.statusCode,response.headers);res.end(Buffer.concat(chunks));}};
          if(hold&&!hold.before) hold.ready({send,status:response.statusCode});else send();
        });
      });upstream.on('error',()=>{if(!res.destroyed) res.writeHead(502).end();});upstream.end(body);
    };
    if(hold?.before) hold.ready({send:forward});else forward();return;
  }
  try {
    const path=decodeURIComponent(new URL(req.url??'/',origin).pathname),target=resolve(root,'.'+path);
    if(!target.startsWith(root+sep)) {res.writeHead(403).end();return;}
    let body;try {body=await readFile(target);}catch {body=await readFile(resolve(oldRoot,'.'+path));}
    res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream'});res.end(body);
  } catch {res.writeHead(404).end();}
});
const profile=resolve(output,'profile-'+Date.now());
const start=async()=>{
  context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:false,ignoreHTTPSErrors:false,args:['--ignore-certificate-errors'],viewport:{width:1120,height:880}});
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
};
const open=async()=>{console.log('Opening visible proof page.');const page=await context.newPage();await page.goto(origin+'/coordination.html');await page.waitForFunction(()=>window.proof?.ready,undefined,{timeout:20000});return page;};
const snap=page=>page.evaluate(()=>window.proof.refresh());
const shot=(page,name)=>page.screenshot({path:resolve(output,name),fullPage:true});
try {
  await new Promise(resolve=>server.listen(Number(tlsPort),'127.0.0.1',resolve));await start();
  let [a,freshOther]=await Promise.all([open(),open()]);
  const winners=await Promise.all([a,freshOther].map(page=>page.evaluate(()=>window.proof.currentOwner())));assert.equal(winners.filter(Boolean).length,1);if(!winners[0]) [a,freshOther]=[freshOther,a];await freshOther.close();console.log('Waiting for static offline cache.');await a.waitForFunction(async()=>(await navigator.serviceWorker.getRegistration())?.active?.state==='activated',undefined,{timeout:20000});await a.close();a=await open();
  console.log('Static worker activated; offline restart is verified below.');
  const email='coord-'+Date.now()+'@example.test';const lease=await a.evaluate(email=>window.proof.login(email),email);const epoch=BigInt(lease.epoch);
  console.log('Real login and local queue.');await a.evaluate(()=>window.proof.phase(0));
  const quota=await a.evaluate(async()=>{
    const before=await window.proof.refresh(),hook=()=>{throw new DOMException('fixture_quota','QuotaExceededError');};
    window.proof.db.sync_state.hook('updating',hook);let failure;
    try {await window.proof.create('Must not survive quota');}catch(error){failure=error.name;}
    finally {window.proof.db.sync_state.hook('updating').unsubscribe(hook);}
    return {before,after:await window.proof.refresh(),failure};
  });assert.equal(quota.failure,'QuotaExceededError');assert.deepEqual(quota.after,quota.before);
await a.evaluate(()=>window.proof.onboard());const habit=await a.evaluate(()=>window.proof.create('Fixture A'));await a.evaluate(()=>window.proof.push());
  assert.equal((await snap(a)).operations.filter(row=>row.status==='acknowledged').length,2);
  console.log('Suspended tabs and remote acknowledgements.');const second=await open();assert.equal(await second.evaluate(()=>window.proof.takeover(false)),null);
  // Real server commit waits in the proxy while the previous writer is frozen outside the gate.
  const ackReady=hold(`/contexts/${lease.context}/sync/push`);
  await a.evaluate(habit=>window.proof.mark(habit),habit);
  await a.evaluate(()=>{window.oldPush=window.proof.push().then(()=> 'unexpected-success',error=>error.message);});
  const delayedAck=await ackReady;assert.equal(delayedAck.status,200);
  const cdp=await context.newCDPSession(a);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
  await second.bringToFront();const owner2=await second.evaluate(()=>window.proof.takeover());assert.equal(owner2.epoch,String(epoch+1n));await second.evaluate(()=>window.proof.phase(1));await second.evaluate(()=>window.proof.claim());
  const before=await snap(second);delayedAck.send();await cdp.send('Page.setWebLifecycleState',{state:'active'});
  assert.equal(await a.evaluate(()=>window.oldPush),'owner_lost');assert.deepEqual((await snap(second)).operations,before.operations);
  await assert.rejects(a.evaluate(()=>window.proof.create()),/owner_lost/);
  await second.evaluate(()=>window.proof.recover());await second.evaluate(()=>window.proof.push());
  const classificationReady=hold(`/contexts/${lease.context}/sync/receipts`);
  await second.evaluate(()=>{window.copy=window.proof.pull();});const classification=await classificationReady;
  await second.evaluate(habit=>window.proof.patch(habit),habit);classification.send();await second.evaluate(()=>window.copy);
  assert.equal((await snap(second)).view.habits[0].title,'Changed during staging');
  assert.equal((await snap(second)).view.totalXp,10);await shot(second,'01-frozen-owner-late-ack.png');
  // An old claim arriving AFTER a higher one may not win by arrival time.
  console.log('Late owner claim.');const oldClaimReady=hold(`/contexts/${lease.context}/claim-owner`,true);
  await second.evaluate(()=>{window.oldClaim=window.proof.claim().then(()=> 'unexpected-success',error=>error.message);});const oldClaim=await oldClaimReady;
  const owner3=await a.evaluate(()=>window.proof.takeover());assert.equal(owner3.epoch,String(epoch+2n));await a.evaluate(()=>window.proof.claim());oldClaim.send();assert.equal(await second.evaluate(()=>window.oldClaim),'owner_lost');
  assert.ok(outcomes.some(row=>row.path.endsWith('/claim-owner')&&row.status===409));
  // Freeze INSIDE the short gate: no TTL/steal can bypass it. Pending transfer waits.
  console.log('Frozen inside gate.');await a.evaluate(()=>window.proof.holdGate());await a.getByRole('status').filter({hasText:pt.coordination.gateHeld}).waitFor();await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
  await second.bringToFront();await second.evaluate(()=>{window.take=window.proof.takeover();window.takeDone=false;window.take.then(()=>window.takeDone=true);});
  await second.waitForFunction(async()=>{const locks=await navigator.locks.query();return locks.pending.some(lock=>lock.name==='ritmo:web:commit:v1');});
  assert.equal(await second.evaluate(()=>window.takeDone),false);await second.evaluate(()=>window.proof.phase(2));await shot(second,'02-gate-waits-no-steal.png');
  await cdp.send('Page.setWebLifecycleState',{state:'active'});await a.evaluate(()=>window.proof.releaseGate());await second.evaluate(()=>window.take);assert.equal((await snap(second)).epoch,String(epoch+3n));
  await second.evaluate(()=>window.proof.claim());
  // Close the owner document: only absence of its presence plus CAS permits auto-acquisition.
  const crashSession=await context.newCDPSession(second),crashed=second.waitForEvent('crash');void crashSession.send('Page.crash').catch(()=>undefined);await crashed;await second.close();await a.bringToFront();const recovered=await a.evaluate(()=>window.proof.takeover(false));assert.equal(recovered.epoch,String(epoch+4n));
  console.log('Offline restart.');await context.setOffline(true);await a.evaluate(()=>window.proof.create('Offline preserved'));const offlineBefore=await snap(a);await a.evaluate(()=>window.proof.phase(3));await shot(a,'03-local-offline-intention.png');
  await context.close();context=undefined;await start();await context.setOffline(true);const countBefore=requests;a=await open();
  assert.equal(requests,countBefore);const offlineAfter=await snap(a);assert.deepEqual(offlineAfter.operations,offlineBefore.operations);assert.equal(offlineAfter.nextSequence,offlineBefore.nextSequence);assert.equal(offlineAfter.view.habits.length,2);await shot(a,'04-browser-reopened-offline.png');
  await context.setOffline(false);await a.evaluate(()=>window.proof.claim());await a.evaluate(()=>window.proof.push());
  // Per-account partitions and public cookies: A→B→A keeps A's pending identity and clears draft.
  const privacyReader=await open();await a.bringToFront();await a.evaluate(()=>window.proof.refresh());await privacyReader.evaluate(()=>window.proof.refresh());await privacyReader.evaluate(()=>window.proof.presentation.edit('secondary-draft-A'));
  await a.evaluate(()=>window.proof.presentation.edit('draft-A'));await a.evaluate(()=>window.proof.logout());
  await privacyReader.waitForFunction(()=>document.getElementById('diagnostic').textContent==='');
  assert.deepEqual(await privacyReader.evaluate(()=>window.proof.presentation.current()),{value:null,draft:''});await privacyReader.close();assert.deepEqual(await a.evaluate(()=>window.proof.presentation.current()),{value:null,draft:''});
  const bLease=await a.evaluate(()=>window.proof.login('coord-b-'+Date.now()+'@example.test'));assert.notEqual(bLease.account,lease.account);assert.equal((await snap(a)).operations.length,0);
  await a.evaluate(()=>window.proof.logout());await a.evaluate(email=>window.proof.login(email,false),email);assert.equal((await snap(a)).account,lease.account);assert.equal((await snap(a)).view.habits.length,2);
  // Waiting worker retains old assets and never owns the domain queue or caches an API response.
  await a.evaluate(()=>window.proof.phase(4));await a.evaluate(()=>window.proof.presentation.edit('unsaved'));
  console.log('Waiting SW and simultaneous builds.');build('coord-2');await a.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
  await a.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
  assert.equal(await a.evaluate(()=>window.proof.presentation.canReload(false)),false);assert.equal(await a.evaluate(()=>window.proof.build),'coord-1');
  const oldAsset=[...await readFile(resolve(oldRoot,'coordination.html'),'utf8').then(html=>html.matchAll(/src="([^"]+\.js)"/g))].map(match=>match[1])[0];
  assert.equal(await a.evaluate(async url=>(await fetch(url)).status,oldAsset),200);
  const keys=await a.evaluate(async()=>{const urls=[];for(const key of await caches.keys()) for(const request of await (await caches.open(key)).keys()) urls.push(request.url);return urls;});assert.equal(keys.some(url=>new URL(url).pathname.startsWith('/api/')),false);
  await shot(a,'05-update-waiting-old-build.png');
  // Appearance has an independent commit: after closing an in-flight document, reread reality.
  await a.evaluate(async()=>{await window.proof.visual.read();await window.proof.visual.write({version:1,skin:'holo',mode:'system'});void window.proof.visual.write({version:1,skin:'neo',mode:'dark'}).catch(()=>undefined);});
  await a.close();a=await open();assert.equal(await a.evaluate(()=>window.proof.build),'coord-2');
  const appearance=await a.evaluate(()=>window.proof.visual.read());assert.equal(appearance.paused,false);assert.ok(['holo','neo'].includes(appearance.value.skin));
  // Old raw connection intentionally ignores versionchange to prove blocked, without a gate deadlock.
  console.log('Blocked and aborted schema upgrade.');const blocker=await open();await blocker.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('ritmo-main');request.onsuccess=()=>{window.rawBlocker=request.result;window.rawBlocker.onversionchange=()=>{};resolve();};request.onerror=()=>reject(request.error);}));
  const queueBefore=await snap(a);await a.evaluate(()=>{window.upgrade=window.proof.migration(true).then(()=> 'unexpected-success',error=>error.message);});
  await a.getByRole('status').filter({hasText:pt.coordination.upgradeBlocked}).waitFor();await blocker.evaluate(()=>window.rawBlocker.close());assert.equal(await a.evaluate(()=>window.upgrade),'fixture_upgrade_abort');
  await blocker.close();await a.goto(origin+'/coordination.html');await a.waitForFunction(()=>window.proof?.ready);assert.deepEqual((await snap(a)).operations,queueBefore.operations);assert.equal((await snap(a)).nextSequence,queueBefore.nextSequence);
  await shot(a,'06-upgrade-abort-preserved-queue.png');await a.evaluate(()=>window.proof.phase(5));
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'result.json'),JSON.stringify({browser:await context.browser().version(),headed:true,atomicLocalTests:'web/test/local.test.ts',realHttpFence:true,frozenOutsideGate:true,frozenInsideGateWaited:true,lateAckRejected:true,lateClaimRejected:true,freshTabsOneWriter:true,ownerRendererCrashed:true,reopenedWholeBrowserOffline:true,offlineOperations:offlineAfter.operations,accountIsolation:true,secondaryPresentationClearedOnLogout:true,serviceWorkerWaited:true,oldAssetAvailable:true,apiCached:false,upgradeBlockedAndRolledBack:true,appearanceReread:appearance.value,safariPhysical:'pending',errors},null,2));
  console.log('PASS visible coordination / IndexedDB / Java / SW. '+output);
}finally {if(context) await context.close();await new Promise(resolve=>server.close(resolve));console.log('Owned browser, TLS proxy and profile closed; Java fixture owns API/DB cleanup.');}
