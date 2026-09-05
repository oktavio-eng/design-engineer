/** Converts a Supabase JSON export to an idempotent D1 import, preserving IDs
 * and timestamps. It never reads service keys or modifies the source database. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('Uso: node scripts/import-supabase-messages.mjs arquivo.json .local/messages-import.sql');
const rows = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(rows)) throw new Error('O arquivo precisa conter uma lista de mensagens.');
const quote = value => value == null ? 'NULL' : "'" + String(value).replace(/'/g, "''") + "'";
const statements = [];
for (const row of rows) {
  if (!/^[0-9a-f-]{36}$/i.test(row.id) || Number.isNaN(Date.parse(row.created_at)) || typeof row.email !== 'string' || row.email.length > 254 || typeof row.message !== 'string' || !row.message.trim() || row.message.length > 5000 || (row.page != null && (typeof row.page !== 'string' || row.page.length > 200))) throw new Error('Uma mensagem possui formato inválido. O arquivo não foi gerado.');
  statements.push(`INSERT OR IGNORE INTO messages (id, created_at, email, message, page) VALUES (${[row.id, new Date(row.created_at).toISOString(), row.email, row.message, row.page].map(quote).join(', ')});`);
}
// Keep rate protection in place. D1 imports are idempotent; failures can be
// retried safely. Very recent historical batches may need time between runs.
await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
await writeFile(output, statements.join('\n') + '\n', { mode: 0o600 });
console.log(`${rows.length} mensagens preparadas. Confira IDs/contagem após importar e mantenha o Supabase intacto até validar.`);
