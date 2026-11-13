import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import worker from '../src/worker.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = p => path.join(root, p);
const config = JSON.parse(readFileSync(file('wrangler.jsonc'), 'utf8'));
const pages = ['index', 'about', 'music', 'artists', 'videos', 'prayer', 'contact'];

test('Cloudflare worker config points to deployed static files', () => {
  assert.equal(config.name, 'nonrev');
  assert.equal(config.assets.directory, './public');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.ok(config.assets.run_worker_first.includes('/api/*'));
  assert.ok(existsSync(file(config.main)));
});

test('All seven HTML pages and shared front-end assets are bundled', () => {
  for (const page of pages) {
    const f = file(`public/${page}.html`);
    assert.ok(existsSync(f), `Missing ${f}`);
    const html = readFileSync(f, 'utf8');
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /assets\/styles\.css/);
    assert.match(html, /assets\/site\.js/);
  }
  for (const item of ['public/assets/styles.css', 'public/assets/site.js', 'public/404.html', 'public/_headers']) {
    assert.ok(existsSync(file(item)), `Missing ${item}`);
  }
});

test('Worker forwards HTML to static asset binding', async () => {
  const called = [];
  const request = new Request('https://nonrev.example/about.html');
  const result = await worker.fetch(request, {
    ASSETS: { fetch: r => { called.push(r.url); return new Response('Page is here', { status: 200 }); } }
  });
  assert.equal(result.status, 200);
  assert.equal(await result.text(), 'Page is here');
  assert.deepEqual(called, [request.url]);
});

test('Contact route rejects GET rather than exposing static 404', async () => {
  const result = await worker.fetch(new Request('https://nonrev.example/api/contact'), {});
  assert.equal(result.status, 405);
  assert.equal(result.headers.get('Allow'), 'POST');
});

test('Contact route validates email and message before delivery', async () => {
  const request = new Request('https://nonrev.example/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://nonrev.example' },
    body: JSON.stringify({name:'A', email:'invalid', topic:'General question', message:'Hello'})
  });
  const result = await worker.fetch(request, {});
  assert.equal(result.status, 400);
});

test('Contact route explains missing email secrets and preserves email fallback', async () => {
  const request = new Request('https://nonrev.example/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://nonrev.example' },
    body: JSON.stringify({name:'Test Sender', email:'sender@example.com', topic:'Music inquiry', message:'Please send me some information.'})
  });
  const result = await worker.fetch(request, {});
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /not configured/i);
});

test('Editor routes are disabled without Cloudflare Access and KV configuration', async () => {
  for (const path of ['/admin', '/api/admin/content']) {
    const response = await worker.fetch(new Request('https://nonrev.example' + path), {});
    assert.equal(response.status, 404);
  }
});
test('Public content returns an empty override map before KV setup', async () => {
  const response = await worker.fetch(new Request('https://nonrev.example/api/content'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { values: {} });
});
test('Cloudflare config protects editor paths behind Worker validation', () => {
  for (const path of ['/api/*', '/admin', '/admin/*']) {
    assert.ok(config.assets.run_worker_first.includes(path));
  }
});
