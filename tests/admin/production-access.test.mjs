import { applyStudioMigrations } from './migrations.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { getPlatformProxy } from 'wrangler';
import worker from '../../cloudflare/worker.mjs';

/**
 * Production shape without Cloudflare: LOCAL_DEV=false, the Access variables
 * filled in, and a test RSA key standing in for the team's signing key. The
 * Worker fetches `${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs` to verify tokens,
 * so that one URL is answered here with the test key's JWK; every other fetch
 * fails loudly. Nothing leaves the process.
 */
const TEAM = 'https://gow-test.cloudflareaccess.com', AUD = 'a'.repeat(64), EMAIL = 'oktavio@gowstudio.pro', SITE = 'https://oktavio.vercel.app';
const HOST = 'https://oktavio-studio.example.workers.dev';
const b64url = input => Buffer.from(input).toString('base64url');
function keyPair(kid) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' } };
}
const now = () => Math.floor(Date.now() / 1000);
function sign({ privateKey }, payload, header = {}) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key', ...header }));
  const body = b64url(JSON.stringify({ iss: TEAM, aud: [AUD], email: EMAIL, iat: now(), nbf: now() - 5, exp: now() + 600, sub: randomUUID(), ...payload }));
  const signature = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url');
  return `${head}.${body}.${signature}`;
}

test('Produção simulada: Access RS256 no Worker — token válido entra, forjado/expirado/outro e-mail não; módulos e contato seguem públicos', { timeout: 120000 }, async t => {
  const proxy = await getPlatformProxy({ persist: false });
  t.after(() => proxy.dispose());
  await applyStudioMigrations(proxy.env.DB);
  const team = keyPair('test-key'), stranger = keyPair('test-key');
  const realFetch = globalThis.fetch;
  let certFetches = 0;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    // The first certs answer is a maintenance page without keys: it must not be cached for five minutes.
    if (url === TEAM + '/cdn-cgi/access/certs') { certFetches++; return new Response(JSON.stringify(certFetches === 1 ? { message: 'maintenance' } : { keys: [team.jwk] }), { headers: { 'Content-Type': 'application/json' } }); }
    throw new Error('fetch inesperado em produção simulada: ' + url);
  };
  t.after(() => { globalThis.fetch = realFetch; });
  const assets = { fetch: request => new Response(new URL(request.url).pathname.endsWith('.mjs') ? 'export default 1;' : '<!doctype html><div id="admin-root"></div>', { headers: { 'Content-Type': new URL(request.url).pathname.endsWith('.mjs') ? 'text/javascript' : 'text/html' } }) };
  const env = { ...proxy.env, LOCAL_DEV: 'false', SITE_ORIGIN: SITE, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAIL: EMAIL, ASSETS: assets };
  const call = (route, { method = 'GET', token, headers = {}, data, environment = env } = {}) => worker.fetch(new Request(HOST + route, { method, headers: { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) }), environment);
  const valid = sign(team, {});
  // First contact with the team's certs is the maintenance body above: denied, and not kept for five minutes.
  assert.equal((await call('/api/admin/session', { token: valid })).status, 401, 'a malformed certs response denies, and is not kept');
  assert.equal(certFetches, 1);

  // Anonymous and forged identities never reach the Studio.
  for (const route of ['/admin', '/admin.html', '/admin/app.mjs', '/api/admin/session', '/api/admin/content', '/api/admin/messages', '/api/admin/export']) {
    assert.equal((await call(route)).status, 401, `${route} anônimo`);
    assert.equal((await call(route, { headers: { 'Cf-Access-Authenticated-User-Email': EMAIL } })).status, 401, `${route} só com header de e-mail`);
  }
  const rejected = {
    'assinado por outra chave com o mesmo kid': sign(stranger, {}),
    'expirado': sign(team, { exp: now() - 60 }),
    'ainda não válido': sign(team, { nbf: now() + 3600 }),
    'outro e-mail': sign(team, { email: 'alguem@example.com' }),
    'outra audience': sign(team, { aud: ['b'.repeat(64)] }),
    'outro issuer': sign(team, { iss: 'https://outro.cloudflareaccess.com' }),
    'alg none': `${b64url(JSON.stringify({ alg: 'none', kid: 'test-key' }))}.${valid.split('.')[1]}.`,
    'alg HS256': sign(team, {}, { alg: 'HS256' }),
    'kid desconhecido': sign(team, {}, { kid: 'other' }),
    'assinatura adulterada': valid.slice(0, -4) + (valid.endsWith('AAAA') ? 'BBBB' : 'AAAA'),
    'corpo adulterado': (() => { const [h, , s] = valid.split('.'); return `${h}.${b64url(JSON.stringify({ iss: TEAM, aud: [AUD], email: EMAIL, exp: now() + 600 }))}.${s}`; })(),
    'não é um JWT': 'abc',
  };
  for (const [why, token] of Object.entries(rejected)) {
    assert.equal((await call('/api/admin/session', { token })).status, 401, `token ${why}`);
    assert.equal((await call('/admin', { token })).status, 401, `/admin com token ${why}`);
  }
  // The password login and the local session cookie do not exist in production.
  assert.equal((await call('/api/admin/login', { method: 'POST', data: { username: 'admin', password: 'admin123' }, headers: { Origin: HOST } })).status, 401);
  assert.equal((await call('/api/admin/content', { headers: { Cookie: 'admin_session=' + 'f'.repeat(64) } })).status, 401);
  // Missing Access configuration fails closed even with a well-formed token.
  for (const missing of ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'ADMIN_EMAIL']) assert.equal((await call('/api/admin/session', { token: valid, environment: { ...env, [missing]: '' } })).status, 401, `sem ${missing}`);
  assert.equal((await call('/api/admin/session', { token: valid, environment: { ...env, ACCESS_TEAM_DOMAIN: 'http://gow-test.cloudflareaccess.com' } })).status, 401, 'team domain sem HTTPS');

  // The authorized identity gets the Studio: assets, session, and CSRF-protected writes.
  const session = await call('/api/admin/session', { token: valid });
  assert.equal(session.status, 200);
  const identity = await session.json();
  assert.equal(identity.username, EMAIL); assert.equal(identity.mode, 'cloudflare'); assert.match(identity.csrf, /^[a-f0-9]{64}$/);
  assert.equal((await call('/admin', { token: valid })).status, 200);
  assert.match(await (await call('/admin', { token: valid })).text(), /admin-root/);
  assert.equal((await call('/admin/app.mjs', { token: valid })).headers.get('content-type'), 'text/javascript');
  assert.equal((await call('/api/admin/content', { token: valid })).status, 200);
  const write = (extra = {}, body = {}) => call('/api/admin/content', { method: 'POST', token: valid, headers: { Origin: HOST, 'X-CSRF-Token': identity.csrf, ...extra }, data: { revision: 0, action: 'save', collection: 'projects', key: 'prod-sim', entry: { name: 'Produção simulada', role: 'Teste', bio: 'ok', links: [], draft: true }, create: true, ...body } });
  assert.equal((await write({ 'X-CSRF-Token': 'forged' })).status, 403, 'CSRF errado');
  assert.equal((await write({ Origin: SITE })).status, 403, 'escrita de outra origem, mesmo a do site público');
  assert.equal((await write({ Origin: '' })).status, 403, 'escrita sem Origin');
  const saved = await write(), savedBody = await saved.text();
  assert.equal(saved.status, 200, savedBody);
  assert.equal(JSON.parse(savedBody).collections.projects['prod-sim'].draft, true);
  // Certificates are cached: many requests, one fetch of the team's keys after the malformed one.
  assert.equal(certFetches, 2);
  const logout = await call('/api/admin/logout', { method: 'POST', token: valid, headers: { Origin: HOST, 'X-CSRF-Token': identity.csrf }, data: {} });
  assert.equal((await logout.json()).redirect, '/cdn-cgi/access/logout');

  // Public surface: the three modules and the contact endpoint need no identity and never answer HTML.
  for (const [route, marker] of [['/content.js', 'window.SITE_CONTENT='], ['/portfolio-content.js', 'window.PORTFOLIO_CONTENT='], ['/prompts.mjs', 'export const PROMPTS =']]) {
    const response = await call(route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
    const body = await response.text();
    assert.ok(body.includes(marker) && !/<html|<!doctype|cloudflareaccess/i.test(body), `${route} é JavaScript público`);
    assert.equal(body.includes('prod-sim'), false, `${route} não vaza o rascunho`);
  }
  const message = { email: 'visitor@example.com', message: 'Olá da produção simulada', page: '/' };
  assert.equal((await call('/api/contact', { method: 'POST', data: message })).status, 403, 'contato sem Origin');
  assert.equal((await call('/api/contact', { method: 'POST', data: message, headers: { Origin: 'https://evil.example' } })).status, 403, 'contato de origem estranha');
  assert.equal((await call('/api/contact', { method: 'POST', data: message, headers: { Origin: HOST } })).status, 403, 'contato do próprio host do Worker também não: só o site público');
  const preflight = await call('/api/contact', { method: 'OPTIONS', headers: { Origin: SITE } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), SITE);
  const sent = await call('/api/contact', { method: 'POST', data: message, headers: { Origin: SITE } });
  assert.equal(sent.status, 201); assert.equal(sent.headers.get('access-control-allow-origin'), SITE);
  assert.equal((await (await call('/api/admin/messages', { token: valid })).json()).total, 1, 'the message reaches the authenticated inbox');
  // Anything else on the Worker host bounces to the public site.
  const elsewhere = await call('/wiki');
  assert.equal(elsewhere.status, 302); assert.equal(elsewhere.headers.get('location'), SITE + '/wiki');
  // Everything admin.html and admin.css pull in must be served here, not bounced to Vercel (a cross-origin 302 breaks module scripts).
  for (const asset of ['/styles/admin.css', '/styles/main.css', '/styles/tokens/colors.css', '/vendor/cuelume/index.js', '/vendor/lenis/lenis.css', '/cursor.mjs', '/sound.mjs', '/new-favicon.png']) assert.equal((await call(asset)).status, 200, `${asset} served by the Worker`);
});
