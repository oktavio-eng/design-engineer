import { COLLECTIONS, validateEntry } from '../admin/schema.mjs';

/**
 * Moves the Studio archive (the single `cms_state` row: collections, trash,
 * activity, revision) between D1 databases — typically from the local
 * `.wrangler/state` to the remote `oktavio-studio` — without copying the
 * SQLite file, which also holds sessions and login attempts. Everything goes
 * through `validateArchive()`: the same per-entry rules the Worker enforces on
 * save, plus the shape of the row itself, so a hand-edited or truncated file
 * is refused before it reaches a database. Drafts, trash and identifiers are
 * preserved exactly; only unknown top-level keys (a backup's `messages`) drop.
 */
export const ARCHIVE_LIMIT = 1_500_000; // bytes — same ceiling as the Worker's save path
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const plainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const bytesOf = value => new TextEncoder().encode(JSON.stringify(value)).length;

export function validateArchive(input) {
  if (!plainObject(input)) fail('O acervo precisa ser um objeto JSON.');
  if (input.version !== 1) fail('Versão do acervo desconhecida (esperado version: 1).');
  if (!Number.isInteger(input.revision) || input.revision < 0) fail('Revisão inválida.');
  if (!plainObject(input.collections)) fail('Coleções ausentes.');
  const ids = COLLECTIONS.map(c => c.id);
  const unknown = Object.keys(input.collections).filter(id => !ids.includes(id));
  if (unknown.length) fail(`Coleção desconhecida: ${unknown.join(', ')}.`);
  const collections = {};
  for (const id of ids) {
    const entries = input.collections[id];
    if (!plainObject(entries)) fail(`A coleção "${id}" precisa ser um objeto de identificador → conteúdo.`);
    collections[id] = {};
    for (const [key, entry] of Object.entries(entries)) {
      if (!KEY_RE.test(key) || ['constructor', 'prototype'].includes(key)) fail(`Identificador inválido em "${id}": ${JSON.stringify(key)}.`);
      try { validateEntry(id, entry); } catch (error) { fail(`"${id}/${key}": ${error.message}`); }
      if (id === 'prompts' && entry.slug !== key) fail(`"prompts/${key}": o slug (${JSON.stringify(entry.slug)}) difere do identificador.`);
      collections[id][key] = entry;
    }
  }
  if (!Array.isArray(input.trash)) fail('Lixeira inválida.');
  const trash = input.trash.map((item, index) => {
    if (!plainObject(item) || typeof item.id !== 'string' || !item.id || !ids.includes(item.collection) || !KEY_RE.test(item.key || '') || Number.isNaN(Date.parse(item.deletedAt))) fail(`Item ${index + 1} da lixeira inválido.`);
    try { validateEntry(item.collection, item.entry); } catch (error) { fail(`Lixeira, "${item.collection}/${item.key}": ${error.message}`); }
    return { id: item.id, collection: item.collection, key: item.key, entry: item.entry, deletedAt: item.deletedAt };
  });
  if (!Array.isArray(input.activity) || input.activity.length > 100 || !input.activity.every(plainObject)) fail('Histórico de atividade inválido (lista de até 100 objetos).');
  const state = { version: 1, revision: input.revision, collections, trash, activity: input.activity };
  const bytes = bytesOf(state);
  if (bytes > ARCHIVE_LIMIT) fail(`O acervo tem ${bytes} bytes; o limite desta versão é ${ARCHIVE_LIMIT}. Amplie o modelo antes de importar.`);
  return state;
}

export function summarize(state) {
  const counts = Object.fromEntries(COLLECTIONS.map(c => [c.id, Object.keys(state.collections[c.id]).length]));
  const entries = Object.values(state.collections).flatMap(Object.values);
  const drafts = entries.filter(entry => entry.draft).length;
  return { total: entries.length, visible: entries.length - drafts, drafts, trash: state.trash.length, revision: state.revision, bytes: bytesOf(state), counts };
}

/** The saved archive, or null when the database still serves the repository seed (no row yet). */
export async function exportArchive(db) {
  const row = await db.prepare('SELECT data, revision FROM cms_state WHERE id = 1').first();
  return row ? validateArchive({ ...JSON.parse(row.data), revision: row.revision }) : null;
}

const quote = text => "'" + text.replace(/'/g, "''") + "'";
export const inspectStatement = 'SELECT revision, length(data) AS bytes FROM cms_state WHERE id = 1;';

/** D1 caps one SQL statement at 100 000 bytes; the archive may reach 1.5 MB.
 * So the JSON travels in UTF-8 slices well under the cap (quotes double when
 * escaped, so 40 KB raw stays under 100 KB even in the worst case), each cut on
 * a code-point boundary. */
const CHUNK_BYTES = 40_000;
export function chunkText(text) {
  const bytes = new TextEncoder().encode(text), decoder = new TextDecoder(), out = [];
  for (let start = 0; start < bytes.length;) {
    let end = Math.min(start + CHUNK_BYTES, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // never split a multi-byte character
    out.push(decoder.decode(bytes.subarray(start, end))); start = end;
  }
  return out;
}

/**
 * Statements for `wrangler d1 execute --file` (one per line). The JSON is
 * assembled in a scratch table `cms_import` (no json_valid constraint, so
 * partial text is allowed), then moved into `cms_state` in one insert that
 * only fires when the assembled text is valid JSON. Without `replaceRevision`
 * it only fills an empty database — an existing row is left untouched (no
 * accidental overwrite of a remote already in use). With it, the row is
 * replaced only while its revision still equals that number, the same
 * optimistic lock the Studio uses between tabs; the revision then advances by
 * one. Reading `inspectStatement` afterwards tells whether anything was
 * written. The scratch table is dropped at the end and re-created empty at the
 * start, so an interrupted run can simply be repeated.
 */
export function importStatements(state, { replaceRevision = null } = {}) {
  const archive = validateArchive(state);
  if (replaceRevision !== null && (!Number.isInteger(replaceRevision) || replaceRevision < 0)) fail('replaceRevision precisa ser um inteiro não negativo.');
  const resolve = replaceRevision === null ? 'DO NOTHING' : `DO UPDATE SET revision = cms_state.revision + 1, data = excluded.data WHERE cms_state.revision = ${replaceRevision}`;
  // In replace mode an empty remote also ends at N+1, so the printed
  // verification rule ("expect N+1") holds whether or not a row existed.
  const revision = replaceRevision === null ? archive.revision : replaceRevision + 1;
  return [
    'CREATE TABLE IF NOT EXISTS cms_import (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);',
    "INSERT OR REPLACE INTO cms_import (id, data) VALUES (1, '');",
    ...chunkText(JSON.stringify(archive)).map(chunk => `UPDATE cms_import SET data = data || ${quote(chunk)} WHERE id = 1;`),
    `INSERT INTO cms_state (id, revision, data) SELECT 1, ${revision}, data FROM cms_import WHERE id = 1 AND json_valid(data) ON CONFLICT(id) ${resolve};`,
    'DROP TABLE cms_import;',
  ];
}

/** Applies `importStatements` atomically through a D1 binding and reports what happened. */
export async function importArchive(db, state, options = {}) {
  const statements = importStatements(state, options);
  const results = await db.batch(statements.map(sql => db.prepare(sql)));
  const row = await db.prepare('SELECT revision FROM cms_state WHERE id = 1').first();
  return { applied: results[statements.length - 2].meta.changes === 1, revision: row?.revision ?? null };
}
