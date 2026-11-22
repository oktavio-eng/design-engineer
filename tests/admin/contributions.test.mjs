import { applyStudioMigrations } from './migrations.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getPlatformProxy } from 'wrangler';
import worker from '../../cloudflare/worker.mjs';
import { parseContributions } from '../../cloudflare/contributions.mjs';

// The same shape GitHub serves: one <td> per day, one <tool-tip> per <td>.
function calendar(days, countFor = i => i % 3) {
  const start = Date.UTC(2025, 10, 22);
  let html = '';
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86400000).toISOString().slice(0, 10), count = countFor(i);
    html += `<td tabindex="0" data-ix="${i}" data-date="${date}" id="contribution-day-component-${i}" data-level="${Math.min(count, 4)}" role="gridcell" class="ContributionCalendar-day"></td>`;
    html += `<tool-tip id="tooltip-${i}" for="contribution-day-component-${i}" popover="manual">${count ? `${count} contribution${count > 1 ? 's' : ''} on ${date}.` : `No contributions on ${date}.`}</tool-tip>`;
  }
  return html;
}

test('parser: junta células e tooltips, recusa ano curto', () => {
  const data = parseContributions(calendar(365, i => (i === 10 ? 1234 : i % 3)), 'someone', new Date('2026-11-22T10:00:00Z'));
  assert.equal(data.days.length, 365);
  assert.equal(data.fetchedAt, '2026-11-22');
  assert.equal(data.days[10].count, 1234);
  assert.equal(data.days[1].count, 1);
  assert.throws(() => parseContributions(calendar(120)), /Parsed only 120 days/);
});

test('Worker: /data/contributions.json vem do D1, o cron atualiza e o seed cobre a primeira vez', { timeout: 120000 }, async t => {
  const proxy = await getPlatformProxy({ persist: false });
  t.after(() => proxy.dispose());
  await applyStudioMigrations(proxy.env.DB);
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  let github = () => new Response('', { status: 503 });
  globalThis.fetch = async (url, init) => String(url).startsWith('https://github.com/') ? github(url, init) : realFetch(url, init);
  const env = { ...proxy.env, LOCAL_DEV: 'false', SITE_ORIGIN: 'https://oktavio.vercel.app', ASSETS: { fetch: request => new Response('seed:' + new URL(request.url).pathname) } };
  const get = () => worker.fetch(new Request('https://oktavio-studio.oktavio.workers.dev/data/contributions.json'), env);

  // Empty table and GitHub down: the seed bundled with the assets, never a redirect.
  let response = await get();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'seed:/data/contributions.json');

  // The cron stores a full year…
  github = () => new Response(calendar(365));
  const waits = [];
  await worker.scheduled({ cron: '17 3 * * *' }, env, { waitUntil: promise => waits.push(promise) });
  await Promise.all(waits);
  response = await get();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.match(response.headers.get('cache-control'), /s-maxage=3600/);
  const stored = await response.json();
  assert.equal(stored.days.length, 365);
  assert.equal(stored.user, 'oktavio-eng');

  // …and a broken markup leaves that copy alone instead of blanking the graph.
  github = () => new Response('<html>changed</html>');
  const failed = [];
  await worker.scheduled({ cron: '17 3 * * *' }, env, { waitUntil: promise => failed.push(promise) });
  await assert.rejects(Promise.all(failed), /Parsed only 0 days/);
  assert.equal((await (await get()).json()).total, stored.total);
});

test('migration 0004: troca só os caminhos convertidos e sobe a revisão', { timeout: 120000 }, async t => {
  const proxy = await getPlatformProxy({ persist: false });
  t.after(() => proxy.dispose());
  const db = proxy.env.DB;
  await applyStudioMigrations(db);
  const data = { collections: { projects: { x: {
    preview: '/assets/projects/dascia/cover.jpg',
    gallery: [{ src: '/assets/projects/pixel-office/01-office.png' }, { src: '/assets/projects/bullster/web-cover.webp' }],
    links: [['Site', 'https://example.com/assets/projects/dascia/cover.jpg']],
  } } } };
  await db.prepare('INSERT INTO cms_state (id, revision, data) VALUES (1, 7, ?)').bind(JSON.stringify(data)).run();
  const sql = await readFile(new URL('../../cloudflare/migrations/0004_webp_asset_paths.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  const row = await db.prepare('SELECT revision, data FROM cms_state WHERE id = 1').first();
  const project = JSON.parse(row.data).collections.projects.x;
  assert.equal(row.revision, 8);
  assert.equal(project.preview, '/assets/projects/dascia/cover.webp');
  assert.deepEqual(project.gallery.map(photo => photo.src), ['/assets/projects/pixel-office/01-office.webp', '/assets/projects/bullster/web-cover.webp']);
  assert.equal(project.links[0][1], 'https://example.com/assets/projects/dascia/cover.jpg', 'only exact quoted asset paths change');
});
