import { readFile, readdir } from 'node:fs/promises';

export async function applyStudioMigrations(db) {
  const directory = new URL('../../cloudflare/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const schema = await readFile(new URL(file, directory), 'utf8');
    // Preserve the throttle trigger's BEGIN/END as a single D1 statement.
    const [tables, trigger] = schema.split('CREATE TRIGGER');
    for (const sql of tables.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
    if (trigger) await db.prepare('CREATE TRIGGER' + trigger.trimEnd().replace(/;$/, '')).run();
  }
}
