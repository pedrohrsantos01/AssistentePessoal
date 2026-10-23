// Finite infrastructure proof: real edge/static server, synthetic private API and shell.
// No browser, existing container or personal profile is opened/modified.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile);
const root=resolve(import.meta.dirname,'../..');
const base=join(root,'output/playwright/web-hosting');await mkdir(base,{recursive:true});
const output=await mkdtemp(join(base,'run-'));
const images={
  static:'nginx@sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951',
  edge:'traefik@sha256:aaf0f6185419a50c74651448c1a5bf4606bd2d2ddb7b8749eed505d55bf8b8ea',
  api:'node@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f',
};
const containers=[],checks=[];let network,ca,port,httpPort,success=false;
async function docker(...args) {return (await exec('docker',args,{timeout:120000,maxBuffer:1024*1024})).stdout.trim();}
async function create(image,alias,args=[]) {
  const id=await docker('create','--network',network,'--network-alias',alias,'--label','dev.ritmo.fixture=web-hosting',...args,image);
  containers.push(id);return id;
}
const mount=(source,target)=>['--mount',`type=bind,src=${source},dst=${target},readonly`];
function request(path,{trusted=true,method='GET',headers={},clear=false,servername='ritmo.example.test'}={}) {
  return new Promise((resolve,reject)=>{
    const req=(clear?httpRequest:httpsRequest)({hostname:'127.0.0.1',port:clear?httpPort:port,path,method,
      ...(clear?{}:{servername,ca:trusted?ca:undefined,minVersion:'TLSv1.2'}),
      headers:{Host:'ritmo.example.test',...headers},agent:false},res=>{
      let body='';res.setEncoding('utf8');res.on('data',part=>{body+=part;if(body.length>65536)req.destroy(new Error('fixture_response_too_large'));});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });req.setTimeout(5000,()=>req.destroy(new Error('fixture_request_timeout')));req.on('error',reject);req.end();
  });
}
async function check(name,run) {await run();checks.push(name);console.log(`PASS ${name}`);}
try {
  for(const image of Object.values(images)) {
    try {await docker('image','inspect',image);} catch {await docker('pull',image);}
  }
  const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
  await exec(java,[join(root,'web/scripts/hosting-certificate.java'),output],{timeout:45000});
  ca=await readFile(join(output,'ritmo.crt'));
  const site=join(output,'site');await mkdir(join(site,'assets'),{recursive:true});
  await writeFile(join(site,'index.html'),'<!doctype html><title>fixture-shell</title>synthetic shell');
  await writeFile(join(site,'sw.js'),'/* fixture worker; never installed by this HTTP proof */');
  await writeFile(join(site,'manifest.webmanifest'),'{}');
  await writeFile(join(site,'assets/app-OLDhash123.js'),'/* immutable old build */');
  await writeFile(join(site,'assets/font.ttf'),'synthetic font bytes');
  const dynamic=(await readFile(join(root,'web/deploy/traefik-pwa.example.yml'),'utf8'))+
    '\n  certificates:\n    - certFile: /etc/traefik/certs/ritmo.crt\n      keyFile: /etc/traefik/certs/ritmo.key\n';
  await writeFile(join(output,'dynamic.yml'),dynamic);
  network=await docker('network','create','--label','dev.ritmo.fixture=web-hosting',`ritmo-web-hosting-${randomUUID()}`);
  const actualApi=await docker('create','--network',network,'--network-alias','ritmo-api','--label','dev.ritmo.fixture=web-hosting',
    '--user','10001:10001','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
    ...mount(join(root,'web/scripts/hosting-upstream.mjs'),'/fixture.mjs'),images.api,'node','/fixture.mjs');
  containers.push(actualApi);await docker('start',actualApi);
  const staticId=await docker('create','--network',network,'--network-alias','ritmo-static','--label','dev.ritmo.fixture=web-hosting',
    '--user','10001:10001','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--cap-drop','ALL','--security-opt','no-new-privileges',
    ...mount(join(root,'web/deploy/nginx.conf'),'/etc/nginx/nginx.conf'),...mount(site,'/usr/share/nginx/html'),
    '--entrypoint','nginx',images.static,'-c','/etc/nginx/nginx.conf','-g','daemon off;');
  containers.push(staticId);await docker('start',staticId);
  const dynamicDir=join(output,'dynamic');await mkdir(dynamicDir);await writeFile(join(dynamicDir,'ritmo.yml'),dynamic);
  const certDir=join(output,'certs');await mkdir(certDir);
  for(const name of ['ritmo.crt','ritmo.key']) await writeFile(join(certDir,name),await readFile(join(output,name)));
  const edge=await create(images.edge,'ritmo-edge',['--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
    '-p','127.0.0.1::80','-p','127.0.0.1::443',
    ...mount(join(root,'api/deploy/proxy/traefik-static.example.yml'),'/etc/traefik/traefik.yml'),
    ...mount(dynamicDir,'/etc/traefik/dynamic'),...mount(certDir,'/etc/traefik/certs')]);
  await docker('start',edge);
  port=Number((await docker('port',edge,'443/tcp')).split(':').at(-1));
  httpPort=Number((await docker('port',edge,'80/tcp')).split(':').at(-1));
  let ready=false;for(let i=0;i<40;i++) {try {ready=(await request('/api/v1/health')).status===200;if(ready)break;}catch { /* wait for finite fixture startup */ }await new Promise(r=>setTimeout(r,250));}
  assert.ok(ready,'edge/static/API fixture startup');
  await check('trusted TLS and API path preserved',async()=>{const r=await request('/api/v1/health');assert.equal(r.status,200);assert.equal(JSON.parse(r.body).path,'/api/v1/health');assert.equal(r.headers['cache-control'],'no-store');});
  await check('untrusted certificate refused',()=>assert.rejects(request('/',{trusted:false})));
  await check('wrong TLS name refused',()=>assert.rejects(request('/',{servername:'wrong.example.test'})));
  await check('HTTP redirect ignores forged forwarding headers',async()=>{const r=await request('/',{clear:true,headers:{'X-Forwarded-Proto':'https','X-Forwarded-Host':'attacker.example.test'}});assert.ok([301,308].includes(r.status));assert.equal(new URL(r.headers.location).hostname,'ritmo.example.test');assert.equal(new URL(r.headers.location).protocol,'https:');});
  await check('unknown host has no route',async()=>assert.ok([404,421].includes((await request('/',{headers:{Host:'wrong.example.test'}})).status)));
  await check('SPA deep link and reset return shell without storage',async()=>{for(const path of ['/','/habits/example','/password-reset']) {const r=await request(path);assert.equal(r.status,200);assert.match(r.body,/fixture-shell/);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['referrer-policy'],'no-referrer');}});
  await check('API boundary never falls back to shell',async()=>{for(const path of ['/api','/api/v1/web/unknown']) {const r=await request(path);assert.equal(r.status,401);assert.equal(JSON.parse(r.body).path,path);}assert.match((await request('/apiary')).body,/fixture-shell/);});
  await check('431 and 9KB Cookie traverse edge without HTML fallback',async()=>{const r=await request('/api/v1/web/unknown',{headers:{Cookie:'fixture='+ 'x'.repeat(9000)}});assert.equal(r.status,431);assert.ok(JSON.parse(r.body).cookieBytes>8192);assert.equal(r.headers['cache-control'],'no-store');});
  await check('429 Retry-After and quarantine 503 preserved',async()=>{const r=await request('/api/fixture/limited');assert.equal(r.status,429);assert.equal(r.headers['retry-after'],'60');assert.equal((await request('/api/fixture/quarantine')).status,503);});
  await check('HSTS and nosniff include API error responses',async()=>{for(const path of ['/','/api/v1/web/unknown','/api/fixture/limited','/api/fixture/quarantine']) {const r=await request(path);assert.equal(r.headers['strict-transport-security'],'max-age=31536000');assert.equal(r.headers['x-content-type-options'],'nosniff');}});
  await check('only hash-named assets are immutable',async()=>{assert.match((await request('/assets/app-OLDhash123.js')).headers['cache-control'],/immutable/);assert.equal((await request('/assets/font.ttf')).headers['cache-control'],'no-cache');});
  await check('missing asset/worker has no cached shell',async()=>{for(const path of ['/assets/missing-OLDhash123.js','/missing.js']) {const r=await request(path);assert.equal(r.status,404);assert.doesNotMatch(r.body,/fixture-shell/);assert.equal(r.headers['cache-control'],'no-store');}});
  await check('worker and manifest are revalidated',async()=>{for(const path of ['/sw.js','/manifest.webmanifest']) {const r=await request(path);assert.equal(r.status,200);assert.equal(r.headers['cache-control'],'no-cache');}assert.match((await request('/manifest.webmanifest')).headers['content-type'],/application\/manifest\+json/);});
  await check('technical entries and source paths are unavailable',async()=>{for(const path of ['/coordination.html','/probe','/probe/a','/src/main.tsx','/node_modules/file.js','/.env']) assert.equal((await request(path)).status,404);});
  await check('static server rejects API even if edge is misrouted',async()=>{
    const r=await docker('exec',actualApi,'node','-e',"fetch('http://ritmo-static:8080/api/v1/web/unknown').then(async r=>console.log(JSON.stringify({status:r.status,body:await r.text()})))");
    const value=JSON.parse(r);assert.equal(value.status,404);assert.doesNotMatch(value.body,/fixture-shell/);
  });
  await check('new shell retains old hashed asset',async()=>{
    await writeFile(join(site,'index.html'),'<!doctype html><title>fixture-shell-new</title>new synthetic shell');
    assert.match((await request('/')).body,/fixture-shell-new/);assert.equal((await request('/assets/app-OLDhash123.js')).status,200);
  });
  await check('private API and static server expose no host ports',async()=>{for(const id of [actualApi,staticId]) {const value=JSON.parse(await docker('inspect',id))[0];assert.equal(Object.keys(value.HostConfig.PortBindings??{}).length,0);}});
  success=true;
} finally {
  const cleanupErrors=[];
  for(const id of [...containers].reverse()) {
    try {const logs=await exec('docker',['logs',id],{timeout:10000,maxBuffer:1024*1024});await writeFile(join(output,`${id.slice(0,12)}.log`),logs.stdout+logs.stderr);}catch { /* no logs before startup */ }
    try {await docker('rm','-f',id);}catch {cleanupErrors.push(`container:${id}`);}
  }
  if(network)try {await docker('network','rm',network);}catch {cleanupErrors.push(`network:${network}`);}
  await writeFile(join(base,'result.json'),JSON.stringify({success:success&&cleanupErrors.length===0,checks,images,output,cleanupErrors,scope:'local synthetic HTTP/TLS only; no Safari or public TLS acceptance'},null,2));
  if(cleanupErrors.length)throw new Error('fixture_cleanup_failed');
}
console.log(`Verified ${checks.length} hosting checks; owned containers/network closed.`);
