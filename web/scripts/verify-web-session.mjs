// Finite integration fixture, launched by WebSessionTests with a disposable API/Postgres.
import { createServer } from 'node:https';
import { request } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pt } from '../src/i18n/pt-BR.ts';
import { tokens } from '../../app/src/theme/tokens.ts';

const [apiPort, tlsPort, certificate, output] = process.argv.slice(2);
const origin = `https://127.0.0.1:${tlsPort}`;
const t = tokens('dark', 'holo');
const text = pt.webSession;
const pageHtml = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${text.title}</title>
<style>body{background:${t.bg.base};color:${t.text.primary};padding:${t.space.section}px;font-family:'${t.fonts.body.regular}',sans-serif}li{padding:${t.space.large}px;color:${t.accent.line}}h1{font-size:${t.typeSize.title}px}p{color:${t.text.secondary}}</style>
<h1>${text.title}</h1><p>${text.scope}</p><p id="status">${text.running}</p><ol id="steps"></ol></html>`;
const holds = new Map();
const seenCookies = [];
const errors = [];
let context;
let browser;
const server = createServer({ pfx: await readFile(certificate), passphrase: 'fixture-password' }, (req, res) => {
  if (req.url === '/proof') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(pageHtml); return; }
  if (!req.url?.startsWith('/api/v1/')) { res.writeHead(404).end(); return; }
  seenCookies.push({ path: req.url, cookie: req.headers.cookie ?? '' });
  const forward = request({ hostname: '127.0.0.1', port: Number(apiPort), path: req.url, method: req.method, headers: req.headers }, upstream => {
    const chunks = [];
    upstream.on('data', chunk => chunks.push(chunk));
    upstream.on('end', () => {
      const body = Buffer.concat(chunks);
      const send = truncate => {
        if (res.destroyed) return;
        res.writeHead(upstream.statusCode, upstream.headers);
        if (truncate) { res.flushHeaders(); res.end('{'); } else res.end(body);
      };
      const hold = holds.get(req.url);
      if (hold) { holds.delete(req.url); hold.ready({ status: upstream.statusCode, send }); }
      else send(false);
    });
  });
  forward.on('error', () => { if (!res.destroyed) res.writeHead(502).end(); });
  req.pipe(forward);
});
const id = () => {
  const ms = Date.now().toString(16).padStart(12, '0'); const suffix = randomBytes(10).toString('hex');
  return `${ms.slice(0, 8)}-${ms.slice(8)}-7${suffix.slice(0, 3)}-8${suffix.slice(3, 6)}-${suffix.slice(6, 18)}`;
};
const headers = { 'Content-Type': 'application/json', 'X-Ritmo-Web': '1', 'X-App-Version': '0.1.0', 'X-Ritmo-Protocol': 'm1.1' };
const owner = c => ({ 'X-Ritmo-Owner-Epoch': '1', 'X-Ritmo-Owner-Tab': c.tab });
function hold(path) {
  let ready;
  const promise = new Promise(resolve => { ready = resolve; });
  holds.set('/api/v1/web' + path, { ready }); return promise;
}
try {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(Number(tlsPort), '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 150 });
  context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1120, height: 920 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/proof`);
  const post = async (path, body = {}, extra = {}) => page.evaluate(async ({ path, body, headers }) => {
    const response = await fetch('/api/v1/web' + path, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body) });
    return { status: response.status, cache: response.headers.get('Cache-Control'), setCookie: response.headers.get('Set-Cookie'), body: await response.json() };
  }, { path, body, headers: { ...headers, ...extra } });
  const success = response => { assert.equal(response.cache, 'no-store'); assert.equal(response.setCookie, null); assert.doesNotMatch(JSON.stringify(response.body), /accessToken|refreshToken|revokeToken|secret_hash|password_hash/); return response.body; };
  const step = async index => { await page.evaluate(message => { const li = document.createElement('li'); li.textContent = message; document.querySelector('#steps').append(li); }, text.steps[index]); await page.waitForTimeout(1000); };
  const prepare = async install => {
    const challenge = await post('/auth/challenge', { installationId: install, attemptId: id(), expectedAccountId: null }); assert.equal(challenge.status, 200);
    const value = success(challenge); const c = { id: value.contextId, install, tab: id() };
    assert.equal((await post('/auth/prepare', { preparationTicket: value.preparationTicket })).status, 200);
    assert.equal((await post(`/contexts/${c.id}/confirm-reservation`)).status, 200); return c;
  };
  const base = await prepare(id()); base.email = `${id()}@example.test`;
  const registration = await post(`/contexts/${base.id}/register`, { email: base.email, password: 'fixture-password', displayName: 'Fixture A', deviceId: base.install }, owner(base));
  assert.equal(registration.status, 201); base.account = success(registration).accountId; await step(0);
  const cookies = await context.cookies(`${origin}/api/v1/web/contexts/${base.id}/inspect`);
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) { assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true); assert.equal(cookie.sameSite, 'Strict'); assert.equal(cookie.path, `/api/v1/web/contexts/${base.id}/`); assert.ok(cookie.expires > Date.now() / 1000); }
  assert.notEqual(cookies[0].value, cookies[1].value); await step(1);
  const late = await prepare(base.install);
  const lateResponse = hold(`/contexts/${late.id}/login`);
  await page.evaluate(({ path, body, headers }) => { window.lateResponse = fetch(path, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); }, { path: `/api/v1/web/contexts/${late.id}/login`, body: { email: base.email, password: 'fixture-password', deviceId: late.install }, headers: { ...headers, ...owner(late) } });
  const lateAccepted = await lateResponse; assert.equal(lateAccepted.status, 200);
  const b = await prepare(base.install); b.email = `${id()}@example.test`;
  const br = await post(`/contexts/${b.id}/register`, { email: b.email, password: 'fixture-password', displayName: 'Fixture B', deviceId: b.install }, owner(b)); assert.equal(br.status, 201); b.account = success(br).accountId; await step(2);
  assert.equal((await post(`/contexts/${late.id}/close`)).status, 200);
  lateAccepted.send(false); const lateMetadata = await page.evaluate(() => window.lateResponse);
  const lateCookies = (await context.cookies(`${origin}/api/v1/web/contexts/${late.id}/inspect`)).filter(c => c.name === '__Secure-ritmo-auth');
  assert.equal(lateCookies.length, 1);
  // Browsers may compensate Expires from Date/arrival time. Server deadlines,
  // never physical cookie disappearance, remain the authorization authority.
  const browserExpiryAdjustmentSeconds = lateCookies[0].expires - Date.parse(lateMetadata.absoluteExpiresAt) / 1000;
  assert.equal((await post(`/contexts/${late.id}/inspect`, {}, owner(late))).status, 401);
  const inspectedB = await post(`/contexts/${b.id}/inspect`, {}, owner(b)); assert.equal(inspectedB.status, 200); assert.equal(success(inspectedB).accountId, b.account); await step(3);
  await page.screenshot({ path: resolve(output, '01-late-response-isolation.png'), fullPage: true });
  const lost = await prepare(base.install); const lostResponse = hold(`/contexts/${lost.id}/login`);
  await page.evaluate(({ path, body, headers }) => { window.lostResponse = fetch(path, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); }, { path: `/api/v1/web/contexts/${lost.id}/login`, body: { email: base.email, password: 'fixture-password', deviceId: lost.install }, headers: { ...headers, ...owner(lost) } });
  const lostAccepted = await lostResponse; assert.equal(lostAccepted.status, 200); lostAccepted.send(true); assert.equal(await page.evaluate(() => window.lostResponse), null);
  const recovered = await post(`/contexts/${lost.id}/inspect`, {}, owner(lost)); assert.equal(recovered.status, 200); assert.equal(success(recovered).accountId, base.account); await step(4);
  const aborted = await prepare(base.install); const abortedResponse = hold(`/contexts/${aborted.id}/login`);
  await page.evaluate(({ path, body, headers }) => { window.abortLogin = new AbortController(); window.abortedResponse = fetch(path, { method: 'POST', credentials: 'same-origin', headers, signal: window.abortLogin.signal, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); }, { path: `/api/v1/web/contexts/${aborted.id}/login`, body: { email: base.email, password: 'fixture-password', deviceId: aborted.install }, headers: { ...headers, ...owner(aborted) } });
  const abortAccepted = await abortedResponse; assert.equal(abortAccepted.status, 200); await page.evaluate(() => window.abortLogin.abort()); await page.evaluate(() => window.abortedResponse); abortAccepted.send(false);
  const proof = success(await post(`/contexts/${aborted.id}/reservation-status`)); assert.equal(proof.state, 'proof_required');
  assert.equal((await post(`/contexts/${aborted.id}/close`)).status, 200); await step(5);
  const atB = seenCookies.filter(r => r.path.startsWith(`/api/v1/web/contexts/${b.id}/`));
  const bCookies = await context.cookies(`${origin}/api/v1/web/contexts/${b.id}/inspect`);
  for (const sent of atB) for (const aCookie of cookies) assert.ok(!sent.cookie.includes(aCookie.value));
  assert.equal(bCookies.length, 2);
  // Real browser headers through the HTTPS edge: do not set a forbidden Cookie
  // header from fetch or substitute the HTTP-only Java assertion for this proof.
  for (let i = 0; i < 3; i++) await context.addCookies([{ name: `synthetic-large-${i}`, value: 'x'.repeat(3000), domain: '127.0.0.1', path: `/api/v1/web/contexts/${b.id}/`, secure: true, httpOnly: true, sameSite: 'Strict' }]);
  const tooLarge = await post(`/contexts/${b.id}/inspect`, {}, owner(b)); assert.equal(tooLarge.status, 431); assert.equal(success(tooLarge).error.code, 'headers_too_large');
  for (let i = 0; i < 3; i++) await context.clearCookies({ name: `synthetic-large-${i}` });
  const cookiePage = await context.newPage(); await cookiePage.goto(`${origin}/api/v1/web/contexts/${b.id}/inspect`); assert.equal(await cookiePage.evaluate(() => document.cookie), ''); await cookiePage.close();
  assert.equal((await post(`/contexts/${b.id}/inspect`, {}, owner(b))).status, 200); await step(6);
  await page.evaluate(done => { document.querySelector('#status').textContent = done; }, text.done);
  await page.screenshot({ path: resolve(output, '02-complete.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ browser: await context.browser().version(), origin, steps: text.steps, cookieAttributes: cookies.map(({ name, httpOnly, secure, sameSite, path, expires }) => ({ name, httpOnly, secure, sameSite, path, expires })), lateCookieRejected: true, lostBodyInspected: true, abortWasNotRollback: true, isolatedB: true, cookieHeader431: true, browserExpiryAdjustmentSeconds, secretsInJavaScript: false }, null, 2));
  await page.waitForTimeout(2500);
  console.log('Visible HTTPS session proof passed (7 stages).');
} finally {
  await context?.close();
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
