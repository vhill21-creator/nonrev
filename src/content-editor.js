import { FIELDS } from './editor-fields.js';

const KEY = 'nonrev:content:v1';
const safe = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  }
});
const enabled = env => !!(env.SITE_CONTENT && env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD && env.EDITOR_EMAILS);
const bytes = b64url => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), x => x.charCodeAt(0));
};
const parseJwtPart = part => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(part)));

async function authenticate(request, env) {
  if (!enabled(env)) return null;
  const team = String(env.CF_ACCESS_TEAM_DOMAIN).trim().replace(/^https:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(team)) return null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 10000) return null;
  const sections = token.split('.');
  if (sections.length !== 3 || sections.some(x => !x)) return null;
  try {
    const header = parseJwtPart(sections[0]), payload = parseJwtPart(sections[1]);
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    if (payload.iss !== 'https://' + team || !Array.isArray(payload.aud) || !payload.aud.includes(env.CF_ACCESS_AUD)) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now || typeof payload.iat !== 'number' || payload.iat > now + 60) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
    if (typeof payload.email !== 'string') return null;
    const allowed = String(env.EDITOR_EMAILS).toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(payload.email.toLowerCase())) return null;
    const keysResponse = await fetch('https://' + team + '/cdn-cgi/access/certs');
    if (!keysResponse.ok) return null;
    const keys = await keysResponse.json();
    const jwk = keys.keys?.find(x => x.kid === header.kid && x.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(sections[0] + '.' + sections[1]);
    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(sections[2]), signed);
    return verified ? payload.email.toLowerCase() : null;
  } catch { return null; }
}
async function load(env) {
  if (!env.SITE_CONTENT) return {};
  const saved = await env.SITE_CONTENT.get(KEY, 'json');
  if (!saved || !saved.values || typeof saved.values !== 'object') return {};
  const out = {};
  for (const [name, value] of Object.entries(saved.values)) {
    if (FIELDS[name] && typeof value === 'string') out[name] = value;
  }
  return out;
}
export async function publicContent(env) {
  if (!env.SITE_CONTENT) return safe({ values: {} });
  try {
    const values = await load(env);
    const r = safe({ values });
    r.headers.set('Cache-Control', 'public, max-age=30');
    return r;
  } catch { return safe({ values: {} }, 503); }
}
const editorPage = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="robots" content="noindex,nofollow">',
  '<title>Nonrev Website Editor</title>',
  '<link rel="stylesheet" href="/assets/editor.css">',
  '<script src="/assets/editor.js" defer></script></head><body>',
  '<main class="editor"><header><small>NONREV CHRISTIAN MUSIC</small>',
  '<h1>Website Content Editor</h1>',
  '<p>Edit approved wording and media links without changing website code.</p></header>',
  '<p id="editor-status" role="status" aria-live="polite">Checking permission…</p>',
  '<form id="editor-form"><div id="editor-fields"></div>',
  '<button type="submit">Save changes</button></form>',
  '<footer>New pages and layout changes still use GitHub. Changes can take about one minute to appear everywhere.</footer>',
  '</main></body></html>'
].join('');
export async function adminRoute(request, env) {
  if (!enabled(env)) return safe({ error: 'Editor not configured' }, 404);
  const identity = await authenticate(request, env);
  if (!identity) return safe({ error: 'Cloudflare Access sign-in required' }, 403);
  const path = new URL(request.url).pathname;
  if (path === '/admin' && request.method === 'GET') return new Response(editorPage, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  } });
  if (path !== '/api/admin/content') return safe({ error: 'Not found' }, 404);
  if (request.method === 'GET') {
    try { return safe({ fields: FIELDS, values: await load(env) }); }
    catch { return safe({ error: 'Content unavailable' }, 503); }
  }
  if (request.method !== 'PUT') return safe({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return safe({ error: 'Invalid origin' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return safe({ error: 'JSON required' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 15000) return safe({ error: 'Too large' }, 413);
  let input;
  try { const raw = await request.text(); if (raw.length > 15000) return safe({ error: 'Too large' }, 413); input = JSON.parse(raw); }
  catch { return safe({ error: 'Invalid JSON' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || !input.values || typeof input.values !== 'object' || Array.isArray(input.values)) return safe({ error: 'Invalid content' }, 400);
  const entries = Object.entries(input.values);
  if (entries.length > Object.keys(FIELDS).length) return safe({ error: 'Too many fields' }, 400);
  const values = {};
  for (const [name, item] of entries) {
    const spec = FIELDS[name];
    if (!spec || typeof item !== 'string') return safe({ error: 'Unknown field' }, 400);
    const value = item.trim();
    if (value.length > spec.max || /[\u0000-\u0008\u000B-\u001F]/.test(value)) return safe({ error: 'Invalid field: ' + name }, 400);
    if (spec.type === 'text' && /[<>]/.test(value)) return safe({ error: 'Plain text only' }, 400);
    if (spec.type === 'youtube' && value && !/^[A-Za-z0-9_-]{11}$/.test(value)) return safe({ error: 'Invalid YouTube ID' }, 400);
    if (spec.type === 'image' && value && !/^https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_.~-]+$/.test(value)) return safe({ error: 'Official Wix media URLs only' }, 400);
    if (value) values[name] = value;
  }
  try {
    await env.SITE_CONTENT.put(KEY, JSON.stringify({ values, updatedAt: new Date().toISOString(), updatedBy: identity }));
    return safe({ ok: true });
  } catch { return safe({ error: 'Save failed' }, 503); }
}
