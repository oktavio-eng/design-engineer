import { readFile } from 'node:fs/promises';
// wrangler accepts comments and trailing commas in wrangler.jsonc; so does this guard.
const jsonc = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const config = JSON.parse(jsonc.replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str ?? '').replace(/,(\s*[}\]])/g, '$1'));
const missing = [];
if (config.d1_databases[0].database_id === '00000000-0000-0000-0000-000000000000') missing.push('ID do D1 de produção');
for (const key of ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'ADMIN_EMAIL']) if (!config.vars[key]) missing.push(key);
if (config.vars.LOCAL_DEV !== 'false') missing.push('desligar LOCAL_DEV');
if (missing.length) { console.error('Publicação bloqueada: configure ' + missing.join(', ') + '. Veja docs/studio.md.'); process.exitCode = 1; }
else console.log('Configuração preenchida. Confirme as policies do Cloudflare Access antes da publicação.');
