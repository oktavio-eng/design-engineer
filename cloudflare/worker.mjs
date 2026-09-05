import { COLLECTIONS, validateEntry } from '../admin/schema.mjs';
import { accessIdentity, hash, randomToken } from './access.mjs';
import { listMessages, updateMessage } from './messages.mjs';
import seed from '../.worker-generated/seed.json' with { type: 'json' };
import promptsSource from '../.worker-generated/prompts-source.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const serialize = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw fail(415, 'Envie os dados em JSON.');
  const reader = request.body?.getReader(); if (!reader) throw fail(400, 'Dados ausentes.');
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1024 * 1024) { await reader.cancel(); throw fail(413, 'Conteúdo muito grande.'); } chunks.push(value); }
  const all = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(all)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw fail(400, 'Dados inválidos.'); }
}
async function stateFrom(db) {
  const row = await db.prepare('SELECT data, revision FROM cms_state WHERE id = 1').first();
  if (!row) return structuredClone(seed);
  const state = { ...JSON.parse(row.data), revision: row.revision };
  // A collection added to the seed after the first save starts from its seed
  // entries instead of crashing every route that reads it.
  state.collections ??= {};
  for (const [id, entries] of Object.entries(seed.collections)) state.collections[id] ??= structuredClone(entries);
  return state;
}
async function updateContent(db, input) {
  const state = await stateFrom(db);
  if (input.revision !== state.revision) throw fail(409, 'O conteúdo mudou em outra aba. Recarregue a lista antes de salvar.');
  const next = structuredClone(state), { action, collection, key, entry } = input;
  if (!COLLECTIONS.some(c => c.id === collection) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(key || '') || ['constructor', 'prototype'].includes(key)) throw fail(400, 'Coleção ou identificador inválido.');
  const entries = next.collections[collection];
  if (action === 'save') {
    validateEntry(collection, entry);
    if (input.create && Object.hasOwn(entries, key)) throw fail(409, 'Já existe um conteúdo com esse identificador.');
    if (!input.create && !Object.hasOwn(entries, key)) throw fail(404, 'Conteúdo não encontrado.');
    entries[key] = collection === 'prompts' ? { ...entry, slug: key } : entry;
  } else if (action === 'delete') {
    if (!Object.hasOwn(entries, key)) throw fail(404, 'Conteúdo não encontrado.');
    if (collection === 'people' && JSON.stringify(next.collections.refs).includes(`"ref":"${key}"`)) throw fail(409, 'Esta pessoa está vinculada a uma referência. Remova o vínculo antes de excluir.');
    next.trash.unshift({ id: crypto.randomUUID(), collection, key, entry: entries[key], deletedAt: new Date().toISOString() }); delete entries[key];
  } else if (action === 'restore') {
    const index = next.trash.findIndex(item => item.id === input.trashId && item.collection === collection && item.key === key);
    if (index < 0) throw fail(404, 'Conteúdo não encontrado na lixeira.');
    if (Object.hasOwn(entries, key)) throw fail(409, 'Já existe um conteúdo com esse identificador.');
    entries[key] = next.trash[index].entry; next.trash.splice(index, 1);
  } else throw fail(400, 'Ação inválida.');
  next.activity.unshift({ action, collection, key, name: entry?.name || entry?.title || entries[key]?.name || state.collections[collection][key]?.name || key, at: new Date().toISOString() });
  next.activity = next.activity.slice(0, 100); next.revision++;
  const data = JSON.stringify(next);
  if (new TextEncoder().encode(data).length > 1_500_000) throw fail(413, 'O acervo atingiu o limite desta versão. Exporte um backup antes de ampliar o armazenamento.');
  // D1 batch is transactional. The version predicate rejects stale writes
  // even when separate Worker isolates race to save the same revision.
  const result = await db.batch([
    db.prepare('INSERT OR IGNORE INTO cms_state (id, revision, data) VALUES (1, 0, ?)').bind(JSON.stringify(seed)),
    db.prepare('UPDATE cms_state SET revision = ?, data = ? WHERE id = 1 AND revision = ?').bind(next.revision, data, state.revision),
  ]);
  if (result[1].meta.changes !== 1) throw fail(409, 'Outra aba salvou primeiro. Recarregue para continuar.');
  return next;
}
async function route(request, env) {
  const url = new URL(request.url), pathname = url.pathname;
  const local = env.LOCAL_DEV === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const origin = request.headers.get('Origin');
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const publicOrigin = local ? url.origin : env.SITE_ORIGIN;
  if (pathname === '/api/contact') {
    const cors = { 'Access-Control-Allow-Origin': publicOrigin, 'Vary': 'Origin' };
    if (origin !== publicOrigin && !(local && origin === url.origin)) throw fail(403, 'Origem não permitida.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (request.method !== 'POST') throw fail(405, 'Método não permitido.');
    const input = await readBody(request);
    if (input.website) return json({ ok: true }, 200, cors);
    const { email, message, page = '/' } = input;
    if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email) || typeof message !== 'string' || !message.trim() || message.length > 5000 || typeof page !== 'string' || page.length > 200 || !page.startsWith('/')) throw fail(400, 'Confira o e-mail e a mensagem.');
    try { await env.DB.prepare('INSERT INTO messages (id, email, message, page) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), email, message.trim(), page).run(); }
    catch (error) { if (error.message.includes('message_rate_limit')) return json({ error: 'Muitas mensagens. Tente novamente mais tarde.' }, 429, cors); throw error; }
    return json({ ok: true }, 201, cors);
  }
  const adminRoute = pathname === '/admin' || pathname === '/admin.html' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
  if (write && origin !== url.origin) throw fail(403, 'Origem não permitida.');
  if (adminRoute && request.headers.get('Sec-Fetch-Site') === 'cross-site' && write) throw fail(403, 'Origem não permitida.');
  let session;
  const token = /(?:^|;\s*)admin_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (local) {
    if (token) session = await env.DB.prepare('SELECT csrf FROM admin_sessions WHERE token_hash = ? AND expires > ?').bind(await hash(token), Date.now()).first();
    if (session) session = { ...session, username: 'admin', mode: 'local' };
  } else if (adminRoute) session = await accessIdentity(request, env);
  if (pathname === '/api/admin/login' && request.method === 'POST' && local) {
    const { username, password } = await readBody(request), key = 'local';
    const attempt = await env.DB.prepare('SELECT count, expires FROM login_attempts WHERE key = ?').bind(key).first();
    if (attempt?.expires > Date.now() && attempt.count >= 10) throw fail(429, 'Muitas tentativas. Aguarde um minuto.');
    await env.DB.prepare('INSERT INTO login_attempts (key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires < ? THEN 1 ELSE count + 1 END, expires = CASE WHEN expires < ? THEN excluded.expires ELSE expires END').bind(key, Date.now() + 60000, Date.now(), Date.now()).run();
    if (username !== 'admin' || typeof password !== 'string' || password.length > 256 || await hash(password) !== await hash(env.ADMIN_PASSWORD || 'admin123')) throw fail(401, 'Usuário ou senha incorretos.');
    const id = randomToken(), csrf = randomToken();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key),
      env.DB.prepare('DELETE FROM admin_sessions WHERE expires < ? OR token_hash = ?').bind(Date.now(), token ? await hash(token) : ''),
      env.DB.prepare('INSERT INTO admin_sessions (token_hash, csrf, expires) VALUES (?, ?, ?)').bind(await hash(id), csrf, Date.now() + 28800000),
    ]);
    return json({ csrf, username: 'admin', mode: 'local' }, 200, { 'Set-Cookie': `admin_session=${id}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800` });
  }
  if (adminRoute && !session && (!local || pathname.startsWith('/api/admin/'))) throw fail(401, local ? 'Entre novamente para continuar.' : 'Acesso restrito. Entre pelo Cloudflare Access.');
  if (pathname.startsWith('/api/admin/')) {
    if (write && request.headers.get('X-CSRF-Token') !== session.csrf) throw fail(403, 'Sessão inválida. Entre novamente.');
    if (pathname === '/api/admin/session' && request.method === 'GET') return json(session);
    if (pathname === '/api/admin/logout' && request.method === 'POST') {
      if (local && token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await hash(token)).run();
      return json({ ok: true, ...(!local ? { redirect: '/cdn-cgi/access/logout' } : {}) }, 200, { 'Set-Cookie': 'admin_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0' });
    }
    if (pathname === '/api/admin/content' && request.method === 'GET') return json(await stateFrom(env.DB));
    if (pathname === '/api/admin/content' && request.method === 'POST') return json(await updateContent(env.DB, await readBody(request)));
    if (pathname === '/api/admin/messages' && request.method === 'GET') return json(await listMessages(env.DB, url.searchParams));
    if (pathname === '/api/admin/messages' && request.method === 'POST') return json(await updateMessage(env.DB, await readBody(request)));
    if (pathname === '/api/admin/export' && request.method === 'GET') return json({ ...await stateFrom(env.DB), messages: (await env.DB.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()).results }, 200, { 'Content-Disposition': 'attachment; filename="portfolio-backup.json"' });
    throw fail(404, 'Rota não encontrada.');
  }
  if (!['GET', 'HEAD'].includes(request.method)) throw fail(405, 'Método não permitido.');
  if (['/content.js', '/portfolio-content.js', '/prompts.mjs'].includes(pathname)) {
    const state = await stateFrom(env.DB);
    const collections = Object.fromEntries(Object.entries(state.collections).map(([group, entries]) => [group, Object.fromEntries(Object.entries(entries).filter(([, entry]) => !entry.draft))]));
    let source;
    if (pathname === '/prompts.mjs') {
      const begin = promptsSource.indexOf('export const PROMPTS ='), end = promptsSource.indexOf('\nfunction searchText');
      // Same two anchors scripts/seed-content.mjs cuts on at build time; a missing one must be a 500, never a silently truncated module.
      if (begin < 0 || end < begin) throw fail(500, 'prompts.mjs mudou de forma: os marcadores PROMPTS/searchText não foram encontrados.');
      source = promptsSource.slice(0, begin) + `export const PROMPTS = ${serialize(Object.values(collections.prompts))};\n` + promptsSource.slice(end);
    } else {
      const site = pathname === '/content.js', names = site ? ['people', 'phases', 'refs', 'courses', 'readings'] : ['projects', 'personal', 'life', 'writing', 'gallery'];
      const value = Object.fromEntries(names.map(key => [key, key === 'gallery' ? Object.values(collections[key]) : collections[key]]));
      source = `window.${site ? 'SITE_CONTENT' : 'PORTFOLIO_CONTENT'}=${serialize(value)};`;
      if (site) source += `window.CMS_BASE=${serialize(Object.fromEntries(names.map(key => [key, seed.collections[key]])))};`;
    }
    return new Response(source, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }
  // Public site remains on Vercel. Assets allowlist is created by build-worker;
  // private files and .worker-generated never enter the asset directory.
  if (!local && !adminRoute && !/^\/(styles|vendor)\//.test(pathname) && !['/new-favicon.png', '/cursor.mjs', '/sound.mjs'].includes(pathname)) return Response.redirect(env.SITE_ORIGIN + pathname + url.search, 302);
  return env.ASSETS.fetch(request);
}
export default {
  async fetch(request, env) {
    let response;
    try { response = await route(request, env); }
    catch (error) { response = json({ error: error.status ? error.message : 'Não foi possível concluir. Tente novamente.' }, error.status || 500); }
    const secured = new Response(response.body, response);
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('X-Frame-Options', 'DENY');
    secured.headers.set('Referrer-Policy', 'same-origin');
    if (new URL(request.url).pathname.startsWith('/admin')) { secured.headers.set('X-Robots-Tag', 'noindex, nofollow'); secured.headers.set('Cache-Control', 'no-store'); }
    return secured;
  }
};
