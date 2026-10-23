// Only accessible controls dispatch the manual journey. No page.evaluate/test bridge.
import { createServer } from 'node:https';
import { request } from 'node:http';
import { readFile,writeFile,mkdir,cp } from 'node:fs/promises';
import { resolve,sep,extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pt } from '../src/i18n/pt-BR.ts';
const t=pt.iphone,[apiPort,tlsPort,certificate,outputArg]=process.argv.slice(2);
if(!certificate)throw new Error('Launch through WebSessionTests with RITMO_WEB_IPHONE=1.');
const output=resolve(outputArg),root=resolve('dist-iphone'),old=resolve(output,'build-1'),origin=`https://127.0.0.1:${tlsPort}`;
await mkdir(output,{recursive:true});
const build=version=>execFileSync(process.execPath,['--import','tsx','scripts/build-iphone.mjs'],{env:{...process.env,VITE_RITMO_IPHONE_BUILD:version},stdio:'pipe'});
build('iphone-1');await cp(root,old,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.ttf':'font/ttf','.png':'image/png','.txt':'text/plain'};
let context,copied,requests=0,loginRequests=0,corruptLogin=true;
const errors=[],checks=[];
const server=createServer({pfx:await readFile(certificate),passphrase:'fixture-password'},async(req,res)=>{
  requests++;
  if(req.url?.startsWith('/api/')) {
    if(/\/(login|register)$/.test(req.url))loginRequests++;
    const chunks=[];for await(const part of req)chunks.push(part);
    const upstream=request({hostname:'127.0.0.1',port:Number(apiPort),path:req.url,method:req.method,headers:req.headers},response=>{
      const body=[];response.on('data',part=>body.push(part));response.on('end',()=>{
        if(res.destroyed)return;
        if(response.statusCode>=400) console.log(`HTTP ${response.statusCode} ${req.url}`);
        const corrupt=corruptLogin&&req.url.endsWith('/register')&&response.statusCode===201;if(corrupt)corruptLogin=false;
        const headers={...response.headers};if(corrupt)delete headers['content-length'];
        res.writeHead(response.statusCode,headers);res.end(corrupt?'{':Buffer.concat(body));
      });
    });upstream.on('error',()=>{if(!res.destroyed)res.writeHead(502).end();});upstream.end(Buffer.concat(chunks));return;
  }
  try {
    const path=decodeURIComponent(new URL(req.url??'/',origin).pathname);
    if(!path.startsWith('/ensaio/')) {res.writeHead(404).end();return;}
    const relative=path.slice('/ensaio/'.length)||'index.html',file=resolve(root,relative);
    if(!file.startsWith(root+sep)) {res.writeHead(404).end();return;}
    let body;try {body=await readFile(file);}catch {body=await readFile(resolve(old,relative));}
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-store':'no-cache'});res.end(body);
  }catch {res.writeHead(404).end();}
});
const profile=resolve(output,'profile-'+Date.now());
async function launch(profilePath=profile) {
  const ctx=await chromium.launchPersistentContext(profilePath,{channel:'chrome',headless:false,ignoreHTTPSErrors:false,args:['--ignore-certificate-errors'],viewport:{width:430,height:900},slowMo:100});
  ctx.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));return ctx;
}
const note=name=>{checks.push(name);console.log(`PASS ${name}`);};
async function enabled(locator) {const deadline=Date.now()+20000;while(Date.now()<deadline){if(await locator.isEnabled())return;await new Promise(r=>setTimeout(r,50));}throw new Error('manual_control_never_enabled');}
async function idle(page) {await enabled(page.getByRole('button',{name:t.refresh,exact:true}));}
async function open(ctx=context) {const page=await ctx.newPage();await page.goto(origin+'/ensaio/');await page.getByRole('heading',{name:t.title,exact:true}).waitFor();await page.locator('#status').filter({hasText:t.ready}).waitFor();await idle(page);return page;}
async function click(page,name,allowError=false) {const control=page.getByRole('button',{name,exact:true});await enabled(control);await control.click();await idle(page);if(!allowError)assert.equal(await page.locator('#error').textContent(),'');}
async function auth(page,email,register=false,allowError=false) {await page.getByLabel(t.email,{exact:true}).fill(email);await page.getByLabel(t.password,{exact:true}).fill('fixture-password');await click(page,register?t.register:t.login,allowError);}
const rows=page=>page.locator('#operations li').evaluateAll(elements=>elements.map(e=>({id:e.getAttribute('data-operation'),state:e.getAttribute('data-state')})));
// DOM attribute inspection above never executes a command or accesses a store/credential.
async function create(page,title) {await page.getByLabel(t.habitTitle,{exact:true}).fill(title);await click(page,t.create);}
const shot=(page,name)=>page.screenshot({path:resolve(output,name),fullPage:true});
const emailA=`manual-a-${randomUUID()}@fixture.example.test`,emailB=`manual-b-${randomUUID()}@fixture.example.test`;
try {
  await new Promise(r=>server.listen(Number(tlsPort),'127.0.0.1',r));context=await launch();let a=await open();
  await auth(a,emailA,true,true);assert.equal(loginRequests,1,`${await a.locator('#error').textContent()} | ${await a.locator('#context').textContent()}`);assert.ok((await a.locator('#error').textContent()).length);const passwordsBefore=loginRequests;
  await click(a,t.inspect);assert.equal(loginRequests,passwordsBefore);note('lost login body recovered by touch inspection without password replay');
  await click(a,t.onboard);await create(a,'Ensaio A');await a.getByRole('button',{name:t.mark,exact:true}).click();await idle(a);await click(a,t.sync);
  assert.equal((await rows(a)).filter(row=>row.state==='acknowledged').length,3);assert.equal(await a.locator(`dd[data-label="${t.xp}"]`).textContent(),'10');note('touch profile/create/mark/sync reached actual Java and IndexedDB');await shot(a,'01-manual-sync.png');
  const before=await rows(a);await a.getByLabel(t.habitTitle,{exact:true}).fill('Quota must not persist');await click(a,t.quota,true);assert.equal(await a.locator('#error').textContent(),t.quotaError);assert.deepEqual(await rows(a),before);await a.getByLabel(t.habitTitle,{exact:true}).fill('');note('quota abort preserves queue without a false success');
  const sequence=page=>page.locator(`dd[data-label="${t.sequence}"]`).textContent();const beforeMigration=await rows(a),sequenceBefore=await sequence(a);await click(a,t.migration);assert.deepEqual(await rows(a),beforeMigration);assert.equal(await sequence(a),sequenceBefore);note('manual aborted upgrade preserves V1 and exact queue/sequence after a mutation');
  const second=await open();assert.equal(await second.getByRole('button',{name:t.create,exact:true}).isEnabled(),false);
  await a.bringToFront();await click(a,t.hold);
  await second.bringToFront();await second.getByRole('button',{name:t.takeover,exact:true}).click();
  await a.bringToFront();await enabled(a.getByRole('button',{name:t.release,exact:true}));await a.getByRole('button',{name:t.release,exact:true}).click();await idle(second);
  await second.bringToFront();await create(second,'Owner B document');await a.bringToFront();await click(a,t.refresh);assert.equal(await a.getByRole('button',{name:t.create,exact:true}).isEnabled(),false);note('secondary read-only, gate wait/release and explicit transfer use touch controls');
  await second.close();await click(a,t.takeover);
  await a.locator('#cache').filter({hasText:t.cacheReady}).waitFor();await context.setOffline(true);await create(a,'Offline preserved');const offlineRows=await rows(a);await shot(a,'02-manual-offline.png');
  await context.close();context=await launch();await context.setOffline(true);const beforeRequests=requests;a=await open();assert.equal(requests,beforeRequests);assert.deepEqual(await rows(a),offlineRows);note('whole-browser offline reopen preserves exact identities without network');
  await context.setOffline(false);await click(a,t.sync);
  const cookies=(await context.cookies()).filter(cookie=>cookie.domain==='127.0.0.1'&&cookie.secure);assert.ok(cookies.length>=2&&cookies.every(cookie=>cookie.httpOnly),'actual protected context cookies are copied, not an empty root-URL selection');copied=await launch(resolve(output,'copied-profile-'+Date.now()));await copied.addCookies(cookies);
  const fresh=await open(copied);assert.equal(await fresh.getByRole('button',{name:t.sync,exact:true}).isEnabled(),false);assert.equal((await rows(fresh)).length,0);await auth(fresh,emailA);await click(fresh,t.sync);assert.equal(await fresh.locator(`dd[data-label="${t.xp}"]`).textContent(),'10');assert.equal(await fresh.locator('dd').filter({hasText:emailA}).count(),0);
  const installation=page=>page.locator(`dd[data-label="${t.installation}"]`).textContent();assert.notEqual(await installation(fresh),await installation(a));await copied.close();copied=undefined;note('copied cookies cannot activate a new installation; explicit login creates its own context');
  await context.setOffline(true);await create(a,'A pending logout');const pendingA=await rows(a);await click(a,t.logout);assert.equal((await rows(a)).length,0);
  await context.setOffline(false);await auth(a,emailB,true);await click(a,t.onboard);await create(a,'Only B');assert.equal(await a.getByText('Ensaio A',{exact:true}).count(),0);
  await a.getByLabel(t.recoveryEmail,{exact:true}).fill(emailB);await a.getByLabel(t.recoveryPassword,{exact:true}).fill('fixture-password');await click(a,t.recover,true);assert.ok((await a.locator('#error').textContent()).length);assert.equal(await a.getByText('Only B',{exact:true}).count(),1);
  await a.getByLabel(t.recoveryEmail,{exact:true}).fill(emailA);await a.getByLabel(t.recoveryPassword,{exact:true}).fill('fixture-password');await click(a,t.recover);note('B credentials cannot close A; original account recovery preserves the active B journey');await click(a,t.logout);
  await auth(a,emailA);const recovered=await rows(a);for(const row of pendingA)assert.ok(recovered.some(value=>value.id===row.id));assert.equal(await a.getByText('Only B',{exact:true}).count(),0);await click(a,t.resolve);note('offline logout and A-B-A preserve A intentions and isolate the presentation');
  await a.getByLabel(t.habitTitle,{exact:true}).fill('Draft stays in this document');build('iphone-2');await click(a,t.update);await a.locator('#cache').filter({hasText:t.cacheWaiting}).waitFor();assert.equal(await a.getByLabel(t.habitTitle,{exact:true}).inputValue(),'Draft stays in this document');
  await click(a,t.reload,true);assert.equal(await a.locator('#error').textContent(),t.discardError);note('waiting update does not reload a draft; deliberate reload requires discard');await shot(a,'03-manual-update-waiting.png');
  for(const control of await a.getByRole('button').all()) {const box=await control.boundingBox();assert.ok(box&&box.width>=44&&box.height>=44,'manual touch target >=44 CSS px');}
  const layout=await a.locator('html').evaluate(element=>({scroll:element.scrollWidth,client:element.clientWidth}));assert.ok(layout.scroll<=layout.client,'manual shell has no horizontal overflow');note('manual controls meet 44px targets and reflow without horizontal overflow');
  copied=await launch(resolve(output,'unsupported-profile-'+Date.now()));
  await copied.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
  const unsupported=await copied.newPage();await unsupported.goto(origin+'/ensaio/');await unsupported.getByRole('alert').filter({hasText:t.unavailable}).waitFor();assert.equal(await unsupported.getByRole('button',{name:t.create,exact:true}).isEnabled(),false);await copied.close();copied=undefined;note('missing Web Locks blocks writes with readable diagnostics, without unsafe fallback');
  assert.equal(errors.length,0,errors.join('\n'));
  await writeFile(resolve(output,'result.json'),JSON.stringify({success:true,checks,browser:context.browser()?.version(),physicalSafari:false,homeScreen:false,scope:'local touch-control proof only'},null,2));
}finally {await copied?.close();await context?.close();await new Promise(r=>server.close(r));}
