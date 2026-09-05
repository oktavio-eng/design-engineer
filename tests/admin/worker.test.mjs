import { applyStudioMigrations } from './migrations.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPlatformProxy } from 'wrangler';
import worker from '../../cloudflare/worker.mjs';
import { validateEntry } from '../../admin/schema.mjs';
import { seedContent } from '../../scripts/seed-content.mjs';

test('D1: autenticação, CRUD, conflitos, lixeira, conteúdo público e mensagens', { timeout: 120000 }, async t => {
  const proxy = await getPlatformProxy({ persist: false });
  t.after(() => proxy.dispose());
  const db = proxy.env.DB;
  // D1 exec handles one statement per line; preserve trigger as one statement.
  await applyStudioMigrations(db);
  const env = { ...proxy.env, LOCAL_DEV: 'true', ADMIN_PASSWORD: 'admin123', SITE_ORIGIN: 'https://oktavio.vercel.app', ASSETS: { fetch: () => new Response('asset') } };
  const origin = 'http://127.0.0.1:8787'; let cookie = '', csrf = '';
  async function request(route, { method = 'GET', data, authenticated = true, origin: sentOrigin = origin, extra = {}, environment = env } = {}) {
    return worker.fetch(new Request(origin + route, { method, headers: { 'Origin': sentOrigin, 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}), ...extra }, ...(data ? { body: JSON.stringify(data) } : {}) }), environment);
  }
  assert.equal((await request('/api/admin/content')).status, 401);
  assert.equal((await request('/api/admin/messages')).status, 401);
  assert.equal((await request('/api/admin/login', { method: 'POST', data: { username: 'admin', password: 'wrong' } })).status, 401);
  let response = await request('/api/admin/login', { method: 'POST', data: { username: 'admin', password: 'admin123' } });
  assert.equal(response.status, 200); cookie = response.headers.get('set-cookie').split(';')[0]; csrf = (await response.json()).csrf;
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await request('/api/admin/content', { method: 'POST', data: {}, extra: { 'X-CSRF-Token': 'forged' } })).status, 403);
  assert.equal((await request('/api/admin/content', { method: 'POST', data: {}, origin: 'https://evil.example' })).status, 403);
  let state = await (await request('/api/admin/content')).json();
  const seed = await seedContent(process.cwd()); assert.deepEqual(state.collections, seed.collections);
  for (const [group, entries] of Object.entries(seed.collections)) for (const entry of Object.values(entries)) assert.doesNotThrow(() => validateEntry(group, entry));
  async function change(data, expected = 200) {
    const result = await request('/api/admin/content', { method: 'POST', data: { revision: state.revision, ...data } });
    const body = await result.json(); assert.equal(result.status, expected, JSON.stringify(body)); if (expected === 200) state = body; return body;
  }
  const entry = { name: 'Teste D1', role: 'Local', bio: 'Conteúdo de teste', links: [['Site', 'https://example.com']], draft: false };
  for (const collection of ['projects', 'people', 'refs', 'courses', 'readings', 'writing', 'personal', 'life', 'phases']) {
    await change({ action: 'save', collection, key: 'test-d1', entry, create: true });
    assert.equal(state.collections[collection]['test-d1'].name, entry.name);
  }
  await change({ action: 'save', collection: 'gallery', key: 'test-image', entry: { src: '/avatar.webp', alt: 'Teste', caption: 'D1', width: 100, height: 100 }, create: true });
  await change({ action: 'save', collection: 'prompts', key: 'test-prompt', entry: { title: 'Teste D1', description: 'Teste', category: 'Design', tags: [], prompt: 'Hello' }, create: true });
  const before = state.revision;
  await change({ action: 'save', collection: 'projects', key: 'test-d1', entry: { ...entry, bio: 'Editado', draft: true } });
  assert.equal((await request('/api/admin/content', { method: 'POST', data: { revision: before, action: 'delete', collection: 'projects', key: 'test-d1' } })).status, 409);
  assert.equal((await (await request('/portfolio-content.js')).text()).includes('test-d1'), true, 'other public collections include the entry');
  const publicScript = await (await request('/portfolio-content.js')).text();
  const scope = { window: {} }; const vm = await import('node:vm'); vm.runInNewContext(publicScript, scope);
  assert.equal(scope.window.PORTFOLIO_CONTENT.projects['test-d1'], undefined, 'draft excluded from public data');
  assert.equal(scope.window.PORTFOLIO_CONTENT.gallery.length, 4);
  const siteScope = { window: {} }; vm.runInNewContext(await (await request('/content.js')).text(), siteScope); assert.equal(siteScope.window.SITE_CONTENT.people['test-d1'].name, 'Teste D1');
  assert.match(await (await request('/prompts.mjs')).text(), /test-prompt/);
  await change({ action: 'delete', collection: 'projects', key: 'test-d1' });
  const trash = state.trash[0]; assert.equal(trash.entry.bio, 'Editado');
  await change({ action: 'restore', collection: 'projects', key: 'test-d1', trashId: trash.id });
  assert.equal(state.collections.projects['test-d1'].bio, 'Editado'); assert.equal(state.trash.length, 0);
  for (const payload of ['<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)//', '<svg onload=alert(1)>']) await change({ action: 'save', collection: 'projects', key: 'test-d1', entry: { ...entry, bio: payload } }, 400);
  await change({ action: 'save', collection: 'projects', key: 'test-d1', entry: { ...entry, links: [['Bad', 'javascript:alert(1)']] } }, 400);
  await change({ action: 'save', collection: 'refs', key: 'test-d1', entry: { ...entry, sections: [null] } }, 400);
  // Concurrent writers cannot silently overwrite each other.
  const concurrent = await Promise.all([1, 2].map(n => request('/api/admin/content', { method: 'POST', data: { revision: state.revision, action: 'save', collection: 'projects', key: 'test-d1', entry: { ...entry, bio: `Concurrent ${n}` } } })));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  const message = { email: 'visitor@example.com', message: 'Mensagem de teste', page: '/' };
  assert.equal((await request('/api/contact', { method: 'POST', data: message, origin: 'https://evil.example', authenticated: false })).status, 403);
  assert.equal((await request('/api/contact', { method: 'POST', data: { ...message, email: 'bad' }, authenticated: false })).status, 400);
  assert.equal((await request('/api/contact', { method: 'POST', data: { ...message, website: 'bot' }, authenticated: false })).status, 200);
  assert.equal((await request('/api/admin/messages')).status, 200);
  assert.equal((await request('/api/contact', { method: 'POST', data: message, authenticated: false })).status, 201);
  const messages = await (await request('/api/admin/messages')).json(); assert.equal(messages.messages.length, 1); assert.equal(messages.messages[0].message, message.message);
  const messageId = messages.messages[0].id;
  assert.equal(messages.unreadCount, 1);
  assert.equal((await request('/api/admin/messages', { method: 'POST', data: { action: 'read', id: messageId }, authenticated: false })).status, 401);
  assert.equal((await request('/api/admin/messages', { method: 'POST', data: { action: 'archive', id: messageId }, extra: { 'X-CSRF-Token': 'forged' } })).status, 403);
  assert.equal((await request('/api/admin/messages', { method: 'POST', data: { action: 'archive', id: messageId }, origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/api/admin/messages', { method: 'POST', data: { action: '__proto__', id: messageId } })).status, 400);
  assert.equal((await request('/api/admin/messages', { method: 'POST', data: { action: 'read', id: 'missing' } })).status, 404);
  assert.equal((await request('/api/admin/messages?view=invalid')).status, 400);
  assert.equal((await request('/api/admin/messages?before=invalid&id=abc')).status, 400);
  for (const [action, view, count] of [['read', 'unread', 0], ['unread', 'unread', 1], ['archive', 'inbox', 0], ['restore', 'inbox', 1]]) {
    const changed = await request('/api/admin/messages', { method: 'POST', data: { action, id: messageId } });
    assert.equal(changed.status, 200);
    assert.equal((await (await request('/api/admin/messages?view=' + view)).json()).total, count);
    if (action === 'archive') assert.equal((await (await request('/api/admin/messages?view=archived')).json()).total, 1);
  }
  assert.equal((await (await request('/api/admin/messages?q=Mensagem')).json()).total, 1);
  assert.equal((await (await request('/api/admin/messages?q=%25')).json()).total, 0, 'search treats SQL wildcard characters literally');
  for (let i = 0; i < 9; i++) assert.equal((await request('/api/contact', { method: 'POST', data: message, authenticated: false })).status, 201);
  assert.equal((await request('/api/contact', { method: 'POST', data: message, authenticated: false })).status, 429);
  assert.equal((await request('/api/admin/export')).headers.get('content-disposition'), 'attachment; filename="portfolio-backup.json"');
  // Local credentials and forged Access headers never authorize production.
  for (const route of ['/admin', '/admin.html', '/admin/app.mjs', '/api/admin/content', '/api/admin/messages']) assert.equal((await request(route, { environment: { ...env, LOCAL_DEV: 'false' }, extra: { 'Cf-Access-Authenticated-User-Email': 'admin@example.com' } })).status, 401);
  await request('/api/admin/logout', { method: 'POST', data: {} });
  assert.equal((await request('/api/admin/content')).status, 401);
});
