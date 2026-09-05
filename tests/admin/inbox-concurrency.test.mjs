import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from '../ui/helpers/browser.mjs';
import { serveDirectory } from '../ui/helpers/static-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ana = { id: 'ana', email: 'ana@example.com', message: 'Uma conversa.', created_at: '2020-02-01T12:00:00Z', page: '/', read_at: null, archived_at: null };
const bruno = { ...ana, id: 'bruno', email: 'bruno@example.com', created_at: '2020-01-01T12:00:00Z' };
const readAna = { ...ana, read_at: '2020-02-02T12:00:00Z' };
const results = (messages, extra = {}) => ({ messages, unreadCount: messages.filter(m => !m.read_at && !m.archived_at).length, total: messages.length, nextCursor: null, ...extra });

test('Inbox: respostas atrasadas, escrita concorrente, paginação e última busca', { timeout: 60000 }, async t => {
  const server = await serveDirectory(root); t.after(() => server.close());
  const browser = await launchChromium(); t.after(() => browser.close());
  async function mount() {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await page.route('**/inbox-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><title>Inbox concurrency</title><body><main id="inbox-host"></main></body></html>' }));
    await page.goto(server.origin + '/inbox-test');
    await page.evaluate(async () => {
      const { mountInbox } = await import('/admin/inbox.mjs');
      window.inboxRequests = []; window.inboxNotices = [];
      window.disposeInbox = mountInbox(document.querySelector('main'), {
        // Intentionally ignores AbortSignal: even a late response that reaches
        // the controller must not resurrect stale results or unread states.
        api: (route, options = {}) => new Promise((resolve, reject) => window.inboxRequests.push({ route, options, resolve, reject })),
        notify: message => window.inboxNotices.push(message),
      });
    });
    return page;
  }
  async function request(page, index) {
    await page.waitForFunction(index => window.inboxRequests.length > index, index);
    return page.evaluate(index => {
      const r = window.inboxRequests[index];
      return { route: r.route, method: r.options.method || 'GET', body: r.options.body && JSON.parse(r.options.body), aborted: r.options.signal?.aborted };
    }, index);
  }
  const reply = (page, index, value) => page.evaluate(({ index, value }) => window.inboxRequests[index].resolve(value), { index, value });
  const idle = page => page.waitForFunction(() => document.querySelector('.admin-inbox-list').getAttribute('aria-busy') === 'false');

  for (const fails of [false, true]) await t.test(`retoma o filtro interrompido mesmo se a gravação ${fails ? 'falhar' : 'passar'}`, async () => {
    const page = await mount();
    try {
      await request(page, 0); await reply(page, 0, results([ana, bruno])); await idle(page);
      await page.getByRole('button', { name: 'Não lidas', exact: true }).click();
      await request(page, 1);
      await page.getByRole('button', { name: 'Marcar todas como lidas' }).press('Enter');
      assert.equal((await request(page, 2)).body.action, 'read-all');
      assert.equal((await request(page, 1)).aborted, true);
      if (fails) await page.evaluate(() => window.inboxRequests[2].reject(new Error('Conexão indisponível.')));
      else await reply(page, 2, { ok: true, unreadCount: 0 });
      assert.match((await request(page, 3)).route, /view=unread/);
      await reply(page, 3, results(fails ? [ana, bruno] : [])); await idle(page);
      await reply(page, 1, results([ana, bruno]));
      assert.equal(await page.locator('.admin-inbox-row').count(), fails ? 2 : 0);
      if (fails) assert.deepEqual(await page.evaluate(() => window.inboxNotices), ['Conexão indisponível.']);
      else await page.getByText('Tudo em dia.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Atualizar mensagens' }).isEnabled(), true);
    } finally { await page.close(); }
  });

  await t.test('ler uma mensagem retoma a próxima página sem apagar as anteriores', async () => {
    const page = await mount();
    try {
      await request(page, 0); await reply(page, 0, results([ana], { total: 2, nextCursor: { before: ana.created_at, id: ana.id } })); await idle(page);
      await page.getByRole('button', { name: /Carregar mais/ }).click();
      const next = await request(page, 1);
      await page.getByRole('button', { name: /ana@example.com · Não lida/ }).press('Enter');
      assert.equal((await request(page, 2)).body.action, 'read');
      await reply(page, 2, { message: readAna, unreadCount: 1 });
      assert.equal((await request(page, 3)).route, next.route, 'reuses the interrupted cursor');
      await reply(page, 3, results([bruno], { total: 2 })); await idle(page);
      await reply(page, 1, results([bruno], { total: 2, unreadCount: 2 }));
      assert.equal(await page.locator('.admin-inbox-row').count(), 2);
      await page.getByRole('button', { name: /ana@example.com · Lida/ }).waitFor();
      assert.equal(await page.locator('#inbox-sender').evaluate(node => node === document.activeElement), true);
      assert.equal(await page.locator('#inbox-summary').textContent(), '1 mensagem não lida');
    } finally { await page.close(); }
  });

  await t.test('busca e filtro escolhidos durante a escrita só consultam o estado confirmado', async () => {
    const page = await mount();
    try {
      await request(page, 0); await reply(page, 0, results([ana, bruno])); await idle(page);
      await page.getByRole('button', { name: /ana@example.com · Não lida/ }).click();
      await request(page, 1);
      await page.getByRole('searchbox').fill('bruno');
      await page.getByRole('button', { name: 'Arquivadas', exact: true }).click();
      await page.getByRole('searchbox').fill('ana');
      assert.equal(await page.evaluate(() => window.inboxRequests.length), 2, 'no read races the uncommitted write');
      await reply(page, 1, { message: readAna, unreadCount: 1 });
      const params = new URL((await request(page, 2)).route, server.origin).searchParams;
      assert.equal(params.get('view'), 'archived'); assert.equal(params.get('q'), 'ana');
      await reply(page, 2, results([])); await idle(page);
      await page.getByText('Nenhuma mensagem encontrada.').waitFor();
      assert.equal(await page.getByRole('searchbox').evaluate(node => node === document.activeElement), true);
      assert.equal(await page.locator('#inbox-sender').count(), 0, 'does not reopen the previous selection');
    } finally { await page.close(); }
  });

  await t.test('desmontar durante a escrita não dispara outra busca', async () => {
    const page = await mount();
    try {
      await request(page, 0); await reply(page, 0, results([ana])); await idle(page);
      await page.getByRole('button', { name: 'Atualizar mensagens' }).click(); await request(page, 1);
      await page.getByRole('button', { name: /ana@example.com/ }).click(); await request(page, 2);
      await page.evaluate(() => window.disposeInbox());
      await reply(page, 2, { message: readAna, unreadCount: 0 });
      await reply(page, 1, results([ana]));
      assert.equal(await page.evaluate(() => window.inboxRequests.length), 3);
    } finally { await page.close(); }
  });
});
