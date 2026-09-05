/**
 * Studio archive transfer — export the local D1's `cms_state` (or strip a
 * dashboard backup) to a JSON file, and turn that file into one SQL statement
 * for `wrangler d1 execute --remote --file`. Never talks to a remote database
 * itself; see docs/studio.md ("Transferir o acervo").
 *
 *   node scripts/transfer-studio-content.mjs export .local/acervo.json
 *   node scripts/transfer-studio-content.mjs export .local/acervo.json --from-backup ~/Downloads/portfolio-backup.json
 *   node scripts/transfer-studio-content.mjs import .local/acervo.json .local/acervo-import.sql
 *   node scripts/transfer-studio-content.mjs import .local/acervo.json .local/acervo-import.sql --replace-revision 12
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportArchive, importStatements, inspectStatement, summarize, validateArchive } from '../cloudflare/content-transfer.mjs';

const [command, ...rest] = process.argv.slice(2);
const usage = 'Uso:\n  node scripts/transfer-studio-content.mjs export <saida.json> [--from-backup <backup.json>]\n  node scripts/transfer-studio-content.mjs import <acervo.json> <saida.sql> [--replace-revision <N>]';
const flags = {}, positional = [];
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith('--')) { positional.push(rest[i]); continue; }
  // A flag without its value is an error, never a silent fall-through to another mode.
  if (rest[i + 1] === undefined || rest[i + 1].startsWith('--')) { console.error(`${rest[i]} precisa de um valor.\n${usage}`); process.exit(1); }
  flags[rest[i]] = rest[++i];
}

async function save(file, text) {
  if (!path.resolve(file).startsWith(path.resolve('.local') + path.sep)) console.warn(`Aviso: ${file} está fora de .local/ — confira se o caminho está no .gitignore antes de commitar.`);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, text, { mode: 0o600 });
}
const report = state => {
  const s = summarize(state);
  return `${s.total} conteúdos (${s.visible} visíveis, ${s.drafts} rascunhos), ${s.trash} na lixeira, revisão ${s.revision}, ${s.bytes} bytes.\n  ` + Object.entries(s.counts).map(([id, n]) => `${id} ${n}`).join(' · ');
};

if (command === 'export' && positional[0]) {
  let state;
  if (flags['--from-backup']) {
    // A dashboard backup is the archive plus `messages`; validation drops the extra key.
    state = validateArchive(JSON.parse(await readFile(flags['--from-backup'], 'utf8')));
  } else {
    // Read-only against the same .wrangler/state the dev server uses.
    const { getPlatformProxy } = await import('wrangler');
    const proxy = await getPlatformProxy({ persist: true });
    try { state = await exportArchive(proxy.env.DB); } finally { await proxy.dispose(); }
    if (!state) { console.error('O D1 local ainda não tem acervo salvo: o Studio está servindo o seed gerado dos arquivos do repositório. Nada a exportar.'); process.exitCode = 1; }
  }
  if (state) {
    await save(positional[0], JSON.stringify(state, null, 2) + '\n');
    console.log(`Acervo exportado para ${positional[0]}: ${report(state)}`);
  }
} else if (command === 'import' && positional[0] && positional[1]) {
  const state = validateArchive(JSON.parse(await readFile(positional[0], 'utf8')));
  if (flags['--replace-revision'] !== undefined && !/^\d+$/.test(flags['--replace-revision'])) { console.error('--replace-revision precisa ser um inteiro (a revisão remota atual).'); process.exit(1); }
  const replaceRevision = flags['--replace-revision'] === undefined ? null : Number(flags['--replace-revision']);
  const statements = importStatements(state, { replaceRevision }), summary = report(state);
  const header = `-- Acervo do Studio gerado em ${new Date().toISOString()} a partir de ${path.basename(positional[0])}.\n-- ${summary.replace(/\n\s+/, ' ')}\n-- ${statements.length - 4} fatias de JSON (limite de 100 KB por instrução no D1), montadas em cms_import e movidas para cms_state em uma instrução.\n-- ${replaceRevision === null ? 'Só preenche um banco vazio; uma linha existente fica intacta (changes = 0).' : `Substitui a linha apenas se a revisão remota ainda for ${replaceRevision}; depois ela passa a ${replaceRevision + 1}.`}\n`;
  await save(positional[1], header + statements.join('\n') + '\n' + inspectStatement + '\n');
  console.log(`SQL pronto em ${positional[1]} (${statements.length} instruções): ${summary}`);
  console.log(replaceRevision === null
    ? `Modo seguro: aplica só em banco vazio. Resultado esperado do SELECT final: revision ${state.revision}. Se o remoto já tiver acervo, nada é gravado — exporte-o, compare e rode de novo com --replace-revision <revisão remota>.`
    : `Resultado esperado do SELECT final: revision ${replaceRevision + 1}. Se continuar ${replaceRevision} ou outro valor, o remoto mudou e nada foi gravado.`);
  console.log('Aplicar (você): npx wrangler d1 execute oktavio-studio --remote --file=' + positional[1]);
} else { console.error(usage); process.exitCode = 1; }
