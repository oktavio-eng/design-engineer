import { applyStudioMigrations } from './migrations.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getPlatformProxy } from 'wrangler';
import worker from '../../cloudflare/worker.mjs';
import { ARCHIVE_LIMIT, chunkText, exportArchive, importArchive, importStatements, summarize, validateArchive } from '../../cloudflare/content-transfer.mjs';

const run = promisify(execFile);
test('Acervo: exporta do D1 local, valida, importa em D1 vazio e respeita a trava de revisão', { timeout: 120000 }, async t => {
  // Two isolated databases: `source` plays the local Studio, `target` the remote.
  const source = await getPlatformProxy({ persist: false }), target = await getPlatformProxy({ persist: false });
  t.after(() => Promise.all([source.dispose(), target.dispose()]));
  await applyStudioMigrations(source.env.DB); await applyStudioMigrations(target.env.DB);
  const origin = 'http://127.0.0.1:8787';
  async function client(proxy) {
    const env = { ...proxy.env, LOCAL_DEV: 'true', ADMIN_PASSWORD: 'admin123', SITE_ORIGIN: 'https://oktavio.vercel.app', ASSETS: { fetch: () => new Response('asset') } };
    let cookie = '', csrf = '';
    const request = async (route, { method = 'GET', data } = {}) => worker.fetch(new Request(origin + route, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf }, ...(data ? { body: JSON.stringify(data) } : {}) }), env);
    const login = await request('/api/admin/login', { method: 'POST', data: { username: 'admin', password: 'admin123' } });
    cookie = login.headers.get('set-cookie').split(';')[0]; csrf = (await login.json()).csrf;
    return request;
  }
  const request = await client(source);
  let state = await (await request('/api/admin/content')).json();
  const change = async data => { const r = await request('/api/admin/content', { method: 'POST', data: { revision: state.revision, ...data } }); assert.equal(r.status, 200); state = await r.json(); };
  const entry = { name: 'Projeto migrado', role: 'Local → remoto', bio: "Texto com 'aspas' e ; ponto e vírgula", links: [['Site', 'https://example.com']], draft: false };
  await change({ action: 'save', collection: 'projects', key: 'migrado-visivel', entry, create: true });
  await change({ action: 'save', collection: 'projects', key: 'migrado-rascunho', entry: { ...entry, name: 'Rascunho migrado', draft: true }, create: true });
  await change({ action: 'save', collection: 'people', key: 'pessoa-migrada', entry: { ...entry, name: 'Pessoa migrada' }, create: true });
  await change({ action: 'delete', collection: 'people', key: 'pessoa-migrada' });

  // Export mirrors the row exactly: drafts, trash, activity, revision.
  assert.equal(await exportArchive(target.env.DB), null, 'an untouched database has nothing to export');
  // Replace mode on an empty database still lands on N+1, matching what the CLI tells the operator to expect.
  const scratch = await getPlatformProxy({ persist: false }); t.after(() => scratch.dispose()); await applyStudioMigrations(scratch.env.DB);
  assert.deepEqual(await importArchive(scratch.env.DB, await exportArchive(source.env.DB), { replaceRevision: 40 }), { applied: true, revision: 41 });
  const archive = await exportArchive(source.env.DB);
  assert.deepEqual(archive.collections, state.collections);
  assert.deepEqual(archive.trash, state.trash);
  assert.equal(archive.revision, state.revision);
  assert.equal(archive.collections.projects['migrado-rascunho'].draft, true);
  const summary = summarize(archive);
  assert.equal(summary.drafts, 1); assert.equal(summary.trash, 1); assert.equal(summary.counts.projects, Object.keys(state.collections.projects).length);
  // A dashboard backup carries `messages`; the archive drops it and nothing else.
  assert.deepEqual(validateArchive({ ...archive, messages: [{ id: 'x' }] }), archive);

  // Fresh import fills the empty target and the Worker serves it: drafts stay private.
  const first = await importArchive(target.env.DB, archive);
  assert.deepEqual(first, { applied: true, revision: archive.revision });
  const remote = await client(target);
  const imported = await (await remote('/api/admin/content')).json();
  assert.deepEqual(imported.collections, state.collections);
  assert.deepEqual(imported.trash, state.trash);
  assert.equal(imported.revision, archive.revision);
  const vm = await import('node:vm'); const scope = { window: {} };
  vm.runInNewContext(await (await remote('/portfolio-content.js')).text(), scope);
  assert.equal(scope.window.PORTFOLIO_CONTENT.projects['migrado-visivel'].name, 'Projeto migrado');
  assert.equal(scope.window.PORTFOLIO_CONTENT.projects['migrado-rascunho'], undefined, 'draft excluded from public data');

  // Safe mode never overwrites a populated database; the lock replaces only at the expected revision.
  const edited = structuredClone(archive); edited.collections.projects['migrado-visivel'].bio = 'Segunda rodada';
  assert.deepEqual(await importArchive(target.env.DB, edited), { applied: false, revision: archive.revision });
  assert.deepEqual(await importArchive(target.env.DB, edited, { replaceRevision: archive.revision + 7 }), { applied: false, revision: archive.revision });
  assert.deepEqual(await importArchive(target.env.DB, edited, { replaceRevision: archive.revision }), { applied: true, revision: archive.revision + 1 });
  assert.equal((await (await remote('/api/admin/content')).json()).collections.projects['migrado-visivel'].bio, 'Segunda rodada');
  // The remote keeps working as a normal Studio afterwards (its own lock advances).
  const save = await remote('/api/admin/content', { method: 'POST', data: { revision: archive.revision + 1, action: 'save', collection: 'projects', key: 'migrado-visivel', entry: { ...entry, bio: 'Editado no remoto' } } });
  assert.equal(save.status, 200); assert.equal((await save.json()).revision, archive.revision + 2);

  // Invalid archives never become SQL.
  const reject = (mutate, pattern) => { const bad = structuredClone(archive); mutate(bad); assert.throws(() => validateArchive(bad), pattern); };
  reject(bad => { bad.collections.unknown = {}; }, /Coleção desconhecida/);
  reject(bad => { delete bad.collections.prompts; }, /"prompts"/);
  reject(bad => { bad.collections.projects['Bad Key'] = entry; }, /Identificador inválido/);
  reject(bad => { bad.collections.projects['migrado-visivel'].bio = '<img src=x onerror=alert(1)>'; }, /projects\/migrado-visivel/);
  reject(bad => { bad.collections.projects['migrado-visivel'].draft = 'sim'; }, /Visibilidade/);
  reject(bad => { bad.collections.prompts['solto'] = { title: 'Solto', description: 'x', category: 'Design', tags: [], prompt: 'y', slug: 'outro' }; }, /slug/);
  reject(bad => { bad.trash[0].entry = { name: '' }; }, /Lixeira/);
  reject(bad => { bad.revision = -1; }, /Revisão/);
  reject(bad => { bad.version = 2; }, /Versão/);
  reject(bad => { bad.collections.projects['migrado-visivel'].bio = 'x'.repeat(99_000); for (let i = 0; i < 20; i++) bad.collections.projects[`grande-${i}`] = { ...entry, bio: 'y'.repeat(99_000) }; }, new RegExp(String(ARCHIVE_LIMIT)));
  assert.throws(() => importStatements(archive, { replaceRevision: 1.5 }), /replaceRevision/);

  // D1 caps a statement at 100 KB: a big archive travels in slices, each under the cap, and lands whole.
  const big = structuredClone(archive);
  for (let i = 0; i < 12; i++) big.collections.readings[`leitura-grande-${i}`] = { ...entry, name: `Leitura ${i}`, bio: "Ç'est ✓ ".repeat(3_000) + 'x'.repeat(30_000) };
  const bigStatements = importStatements(big, { replaceRevision: archive.revision + 2 });
  assert.ok(bigStatements.length > 10, 'several slices');
  assert.ok(Math.max(...bigStatements.map(sql => Buffer.byteLength(sql))) < 100_000, 'every statement stays under the D1 limit');
  assert.equal(chunkText('é'.repeat(40_000)).join(''), 'é'.repeat(40_000), 'slices never split a multi-byte character');
  assert.deepEqual(await importArchive(target.env.DB, big, { replaceRevision: archive.revision + 2 }), { applied: true, revision: archive.revision + 3 });
  assert.deepEqual((await (await remote('/api/admin/content')).json()).collections.readings['leitura-grande-11'], big.collections.readings['leitura-grande-11']);
  assert.equal((await target.env.DB.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'cms_import'").first()).n, 0, 'scratch table dropped');

  // CLI: backup → archive JSON → SQL file that D1 runs as one statement.
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-transfer-'));
  const backup = path.join(dir, 'portfolio-backup.json'), archiveFile = path.join(dir, 'acervo.json'), sqlFile = path.join(dir, 'acervo-import.sql');
  await writeFile(backup, JSON.stringify({ ...archive, messages: [{ id: 'm1' }] }));
  const script = path.resolve('scripts/transfer-studio-content.mjs');
  const exported = await run('node', [script, 'export', archiveFile, '--from-backup', backup]);
  assert.match(exported.stdout, /rascunhos/);
  assert.deepEqual(JSON.parse(await readFile(archiveFile, 'utf8')), archive);
  const generated = await run('node', [script, 'import', archiveFile, sqlFile, '--replace-revision', String(archive.revision + 3)]);
  assert.match(generated.stdout, new RegExp(`revision ${archive.revision + 4}`));
  const sql = await readFile(sqlFile, 'utf8');
  assert.match(sql, /^-- Acervo do Studio/);
  const lines = sql.split('\n').filter(line => line && !line.startsWith('--'));
  const results = await target.env.DB.batch(lines.map(line => target.env.DB.prepare(line)));
  assert.deepEqual(results.at(-1).results, [{ revision: archive.revision + 4, bytes: JSON.stringify(archive).length }], 'the trailing SELECT reports the new revision');
  assert.deepEqual((await (await remote('/api/admin/content')).json()).collections, archive.collections, 'the file restores the archive exactly');
  await assert.rejects(run('node', [script, 'export', archiveFile, '--from-backup']), /precisa de um valor/);
  await assert.rejects(run('node', [script, 'import', archiveFile, sqlFile, '--replace-revision', '']), /inteiro/);
  // A dashboard backup is itself a valid input (only `messages` is dropped); a foreign file is not.
  const foreign = path.join(dir, 'foreign.json'); await writeFile(foreign, JSON.stringify({ version: 2, revision: 0, collections: {}, trash: [], activity: [] }));
  await assert.rejects(run('node', [script, 'import', foreign, sqlFile]), /Versão do acervo desconhecida/);
  await assert.rejects(run('node', [script, 'export']), /Uso/);
});
