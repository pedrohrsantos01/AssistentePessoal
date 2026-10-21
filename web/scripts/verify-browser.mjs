import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Finite static build verification, not a persistent Vite/dev server.
// A dedicated profile preserves IndexedDB/SW across browser restart, never touches a user's Chrome profile.
const root = resolve('dist');
const output = resolve('../output/playwright/pwa-probe');
await mkdir(output, { recursive: true });
const profile = resolve(output, `profile-${Date.now()}`);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain' };
let requests = 0;
const server = createServer(async (req, res) => {
  requests++;
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const actual = /^\/probe\/(a|b)\/?$/.test(pathname) ? resolve(root, 'index.html') : file;
    const body = await readFile(actual);
    res.writeHead(200, { 'Content-Type': mime[extname(actual)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const errors = [];
let context;
const start = async () => {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: false, viewport: { width: 1120, height: 920 }, slowMo: 180,
  });
  context.on('page', monitor);
  for (const page of context.pages()) monitor(page);
};
function monitor(page) { page.on('pageerror', e => errors.push(e.message)); }
async function snapshot(page) { return JSON.parse(await page.getByTestId('diagnostic').textContent()); }
async function waitFor(page, predicate) {
  await page.waitForFunction(predicate, undefined, { timeout: 15000 });
}
// Predicates sent to the browser cannot close over Node values.
async function countIs(page, count) {
  await page.waitForFunction(n => {
    const value = document.querySelector('[data-testid=diagnostic]')?.textContent;
    return value && JSON.parse(value).operationIds.length === n;
  }, count);
}

try {
  await start();
  let page = context.pages()[0];
  await page.goto(`${origin}/probe/a`);
  await page.getByTestId('owner').filter({ hasText: 'Esta aba tem' }).waitFor();
  await page.getByTestId('cache').filter({ hasText: 'Cache offline preparado.' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload(); // First navigation was not controlled; this one must be.
  await waitFor(page, () => Boolean(navigator.serviceWorker.controller));
  await page.getByRole('checkbox').click();
  await countIs(page, 1);
  const committed = await snapshot(page);
  assert.equal(committed.totalXp, 10);
  assert.equal(await page.getByRole('checkbox').getAttribute('aria-checked'), 'true');
  await page.getByRole('button', { name: 'Simular falha de quota na alteração' }).click();
  await page.getByRole('alert').filter({ hasText: 'Falha simulada' }).waitFor();
  assert.deepEqual(await snapshot(page), committed);
  await page.screenshot({ path: resolve(output, '01-commit-rollback.png'), fullPage: true });

  // Reopen the whole browser with the same disk profile and transport offline BEFORE navigating.
  await context.close(); context = undefined;
  await start();
  await context.setOffline(true);
  page = context.pages()[0];
  const requestsBefore = requests;
  await page.goto(`${origin}/probe/a`);
  await countIs(page, 1);
  const reopened = await snapshot(page);
  assert.deepEqual(reopened.operationIds, committed.operationIds);
  assert.equal(reopened.nextSequence, committed.nextSequence);
  assert.equal(reopened.totalXp, 10);
  assert.equal(requests, requestsBefore, 'offline navigation must not reach the local server');
  await page.screenshot({ path: resolve(output, '02-reopened-offline.png'), fullPage: true });

  const second = await context.newPage();
  await second.goto(`${origin}/probe/a`);
  await second.getByRole('button', { name: 'Assumir escrita nesta aba' }).waitFor();
  assert.equal(await second.getByRole('checkbox').isDisabled(), true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
  await second.bringToFront();
  await second.getByRole('button', { name: 'Assumir escrita nesta aba' }).click();
  await second.getByTestId('owner').filter({ hasText: 'Esta aba tem' }).waitFor();
  await second.getByRole('checkbox').click();
  await countIs(second, 2);
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await countIs(page, 2);
  assert.equal(await page.getByRole('checkbox').isDisabled(), true);
  assert.equal((await snapshot(second)).totalXp, 0);
  assert.equal(await second.getByRole('checkbox').getAttribute('aria-checked'), 'false');
  await second.screenshot({ path: resolve(output, '03-takeover-after-freeze.png'), fullPage: true });

  await second.getByRole('link', { name: 'Abrir fixture B' }).click();
  await countIs(second, 0);
  assert.equal((await snapshot(second)).totalXp, 0);
  await second.getByRole('checkbox', { name: 'Cumprimento: Ler um capítulo' }).waitFor();
  // Each foreground fixture still reads only its own rows; this is not an authentication proof.
  await page.bringToFront();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, '04-narrow-layout.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const browser = await context.browser().version();
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({
    browser, playwright: '1.64.1', headed: true, origin, offlineServerRequests: requests - requestsBefore,
    atomicRollback: true, persistedOperations: committed.operationIds,
    reopenedOffline: true, frozenTabTakeover: true, staleUiDisabled: true,
    accountFixtureIsolation: true, narrowViewport: '390x844',
    capabilities: await page.evaluate(async () => ({
      indexedDB: Boolean(window.indexedDB), webLocks: Boolean(navigator.locks),
      serviceWorker: Boolean(navigator.serviceWorker.controller),
      storageEstimate: await navigator.storage.estimate(), persisted: await navigator.storage.persisted(),
      fonts: document.fonts.check('16px ChakraPetch_400Regular'),
    })), errors, safariPhysical: 'not tested',
  }, null, 2));
  console.log(`PASS visible browser: ${browser}. Evidence: ${output}`);
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  console.log('Owned browser and finite HTTP server closed.');
}
