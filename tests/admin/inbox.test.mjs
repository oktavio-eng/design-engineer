import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyStudioMigrations } from './migrations.mjs';
import worker from '../../cloudflare/worker.mjs';
import { listMessages, updateMessage } from '../../cloudflare/messages.mjs';
import { launchChromium } from '../ui/helpers/browser.mjs';
import { serveDirectory } from '../ui/helpers/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
test('Caixa de entrada: paginação estável, busca, leitura em lote e preservação do arquivo', async t => {
  const proxy = await getPlatformProxy({ persist: false }); t.after(() => proxy.dispose());
  const db = proxy.env.DB; await applyStudioMigrations(db);
  // Same timestamp exercises the ID tie-breaker; old dates avoid the contact throttle.
  await db.batch(Array.from({ length: 61 }, (_, i) => db.prepare('INSERT INTO messages (id, created_at, email, message, page) VALUES (?, ?, ?, ?, ?)').bind(`message-${String(i).padStart(3, '0')}`, '2020-01-01T10:00:00Z', `visitor${i}@example.com`, `Olá, mensagem ${i}`, '/wiki')));
  const first = await listMessages(db, new URLSearchParams());
  assert.equal(first.messages.length, 50); assert.equal(first.total, 61); assert.equal(first.unreadCount, 61);
  const next = await listMessages(db, new URLSearchParams(first.nextCursor));
  assert.equal(next.messages.length, 11); assert.equal(next.nextCursor, null);
  assert.equal(new Set([...first.messages, ...next.messages].map(message => message.id)).size, 61);
  const archived = await updateMessage(db, { action: 'archive', id: first.messages[0].id });
  assert.equal(archived.unreadCount, 60);
  await updateMessage(db, { action: 'unread', id: archived.message.id });
  const read = await updateMessage(db, { action: 'read-all' }); assert.equal(read.unreadCount, 0);
  assert.equal((await listMessages(db, new URLSearchParams({ view: 'unread' }))).total, 0);
  const archive = await listMessages(db, new URLSearchParams({ view: 'archived' }));
  assert.equal(archive.messages[0].read_at, null, 'read-all only affects the inbox');
  assert.equal((await db.prepare('SELECT count(*) AS total FROM messages').first()).total, 61, 'archive never deletes the message');
  assert.equal((await listMessages(db, new URLSearchParams({ q: 'visitor0@' }))).total, 1);
});

test('Inbox real: leitura, filtros, arquivo, foco, erros, temas e 320px', { timeout: 120000 }, async t => {
  const proxy = await getPlatformProxy({ persist: false }); t.after(() => proxy.dispose());
  const db = proxy.env.DB; await applyStudioMigrations(db);
  const server = await serveDirectory(root); t.after(() => server.close());
  const browser = await launchChromium(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const env = { ...proxy.env, LOCAL_DEV: 'true', SITE_ORIGIN: server.origin };
  let failNextRead = false, failNextWrite = false;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== server.origin) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/admin/messages' && ((request.method() === 'GET' && failNextRead) || (request.method() === 'POST' && failNextWrite))) {
        failNextRead = false; failNextWrite = false;
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Conexão indisponível. Tente novamente."}' });
      }
      const response = await worker.fetch(new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), ...(request.postData() ? { body: request.postData() } : {}) }), env);
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    }
    return route.continue();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.origin + '/admin.html');
  await page.getByLabel('Senha', { exact: true }).fill('admin123');
  await page.getByRole('button', { name: 'Entrar no studio' }).click();
  await page.getByRole('button', { name: 'Mensagens', exact: true }).click();
  await page.getByText('Sua caixa está tranquila.').waitFor();
  const body = 'Olá, Otavio!\n\nGostaria de conversar sobre um projeto de produto digital. Podemos marcar uma conversa nesta semana?';
  for (const [id, email, message, date] of [['ana', 'ana@example.com', body, '2026-09-04T20:00:00Z'], ['bruno', 'bruno@example.com', 'As referências da wiki me ajudaram muito. Obrigado por compartilhar!', '2026-09-03T18:00:00Z'], ['unsafe', 'visitor@example.com', '<img src=x onerror="alert(1)">\nTexto literal.', '2026-09-02T12:00:00Z']]) {
    await db.prepare('INSERT INTO messages (id, email, message, page, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, email, message, '/wiki', date).run();
  }
  await page.getByRole('button', { name: 'Atualizar mensagens' }).click();
  await page.getByText('3 mensagens não lidas', { exact: true }).waitFor();
  await mkdir(path.join(root, 'artifacts/admin'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'artifacts/admin/inbox-light.png') });
  await page.getByRole('button', { name: /ana@example.com · Não lida/ }).press('Enter');
  await page.getByRole('button', { name: 'Marcar como não lida', exact: true }).waitFor();
  assert.equal(await page.locator('#inbox-sender').evaluate(node => document.activeElement === node), true, 'reader receives and retains keyboard focus after the read is saved');
  assert.equal(await page.locator('.admin-inbox-body').textContent(), body);
  assert.ok((await db.prepare('SELECT read_at FROM messages WHERE id = ?').bind('ana').first()).read_at);
  assert.match(await page.getByRole('link', { name: 'Responder por e-mail' }).getAttribute('href'), /^mailto:ana%40example\.com/);
  await page.addScriptTag({ path: path.join(root, 'node_modules/axe-core/axe.min.js') });
  async function axe(label) {
    const violations = await page.evaluate(async () => (await window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], label);
  }
  await axe('inbox reader light');
  await page.screenshot({ path: path.join(root, 'artifacts/admin/inbox-reading.png') });
  failNextWrite = true;
  await page.getByRole('button', { name: 'Arquivar mensagem' }).click();
  await page.getByText('Conexão indisponível. Tente novamente.').waitFor();
  assert.equal((await db.prepare('SELECT archived_at FROM messages WHERE id = ?').bind('ana').first()).archived_at, null);
  await page.getByRole('button', { name: 'Fechar aviso' }).click();
  await page.getByRole('button', { name: 'Arquivar mensagem' }).click();
  await page.getByText('Mensagem arquivada.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /ana@example.com/ }).count(), 0);
  await page.getByRole('button', { name: 'Arquivadas', exact: true }).click();
  await page.getByRole('button', { name: /ana@example.com · Lida/ }).click();
  await page.getByRole('button', { name: 'Mover para entrada' }).click();
  await page.getByText('Nenhuma mensagem arquivada.').waitFor();
  await page.getByRole('button', { name: 'Entrada', exact: true }).click();
  await page.getByRole('button', { name: /ana@example.com · Lida/ }).click();
  await page.getByRole('button', { name: 'Marcar como não lida', exact: true }).click();
  await page.getByRole('button', { name: /ana@example.com · Não lida/ }).waitFor();
  assert.equal(await page.locator('[data-message-id="ana"]').evaluate(node => document.activeElement === node), true);
  await page.reload();
  await page.getByRole('button', { name: 'Mensagens', exact: true }).click();
  await page.getByText('3 mensagens não lidas', { exact: true }).waitFor();
  await page.keyboard.press('Control+k');
  assert.equal(await page.getByRole('searchbox', { name: 'Buscar mensagens' }).evaluate(node => document.activeElement === node), true);
  await page.getByRole('searchbox', { name: 'Buscar mensagens' }).fill('referências');
  await page.getByRole('button', { name: /bruno@example.com/ }).waitFor();
  assert.equal(await page.locator('.admin-inbox-row').count(), 1);
  await page.getByRole('searchbox', { name: 'Buscar mensagens' }).fill('does-not-exist');
  await page.getByText('Nenhuma mensagem encontrada.').waitFor();
  await page.getByRole('searchbox', { name: 'Buscar mensagens' }).fill('');
  await page.getByRole('button', { name: /visitor@example.com/ }).click();
  await page.getByRole('button', { name: 'Marcar como não lida', exact: true }).waitFor();
  assert.equal(await page.locator('.admin-inbox-body img').count(), 0);
  assert.match(await page.locator('.admin-inbox-body').textContent(), /<img src=x/);
  await page.getByRole('button', { name: 'Voltar à caixa de entrada' }).click();
  await page.getByRole('button', { name: 'Marcar todas como lidas', exact: true }).click();
  await page.getByText('0 mensagens não lidas', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Não lidas', exact: true }).click();
  await page.getByText('Tudo em dia.', { exact: true }).waitFor();
  failNextRead = true;
  await page.getByRole('button', { name: 'Atualizar mensagens' }).click();
  await page.getByRole('alert').getByText('Conexão indisponível. Tente novamente.').waitFor();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await page.getByText('Tudo em dia.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Entrada', exact: true }).click();
  await page.getByRole('button', { name: /ana@example.com/ }).click();
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  await page.addScriptTag({ path: path.join(root, 'node_modules/axe-core/axe.min.js') });
  await axe('inbox reader dark');
  await page.screenshot({ path: path.join(root, 'artifacts/admin/inbox-dark.png') });
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.locator('.admin-inbox-list-pane').isVisible(), false);
    assert.equal(await page.locator('.admin-inbox-reader').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}`);
    await axe(`inbox reader ${width}`);
    await page.screenshot({ path: path.join(root, `artifacts/admin/inbox-mobile-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Voltar à caixa de entrada' }).click();
    assert.equal(await page.locator('[data-message-id="ana"]').evaluate(node => document.activeElement === node), true);
    assert.equal(await page.locator('.admin-inbox-reader').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `list fits ${width}`);
    await axe(`inbox list ${width}`);
    await page.getByRole('button', { name: /ana@example.com/ }).press('Enter');
  }
  assert.equal(await page.locator('.admin-inbox-message').evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.getByRole('button', { name: 'Voltar à caixa de entrada' }).click();
  await db.batch(Array.from({ length: 52 }, (_, i) => db.prepare('INSERT INTO messages (id, created_at, email, message, page) VALUES (?, ?, ?, ?, ?)').bind(`older-${String(i).padStart(3, '0')}`, '2020-01-01T10:00:00Z', `older${i}@example.com`, 'Uma conversa anterior.', '/')));
  await page.getByRole('button', { name: 'Atualizar mensagens' }).click();
  await page.getByRole('button', { name: 'Carregar mais · 50 de 55' }).click();
  await page.locator('.admin-inbox-row[data-message-id="older-000"]').press('Enter');
  await page.getByRole('button', { name: 'Marcar como não lida', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voltar à caixa de entrada' }).click();
  assert.equal(await page.locator('.admin-inbox-row').count(), 55, 'reading an older page keeps the loaded messages');
  assert.equal(await page.locator('.admin-inbox-row[data-message-id="older-000"]').evaluate(node => document.activeElement === node), true, 'return keeps focus on the older message');
  assert.deepEqual(errors, []);
});
