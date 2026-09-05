import { readFile, writeFile } from 'node:fs/promises';
const url = new URL(process.argv[2] || 'http://invalid');
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Passe apenas a origem HTTPS real do Worker publicado.');
const configPath = new URL('../vercel.json', import.meta.url);
const config = JSON.parse(await readFile(configPath, 'utf8'));
const paths = ['/api/contact', '/content.js', '/portfolio-content.js', '/prompts.mjs'];
config.rewrites = [...(config.rewrites || []).filter(rule => !paths.includes(rule.source)), ...paths.map(source => ({ source, destination: url.origin + source }))];
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
// Vercel answers from the filesystem before it looks at rewrites, so the three
// modules must stop shipping as static files or the Worker is never reached.
const ignorePath = new URL('../.vercelignore', import.meta.url);
const ignore = (await readFile(ignorePath, 'utf8')).split('\n');
const modules = paths.filter(p => p !== '/api/contact').filter(p => !ignore.includes(p));
if (modules.length) await writeFile(ignorePath, ignore.filter(Boolean).concat(modules).join('\n') + '\n');
console.log(`Rotas da Vercel configuradas${modules.length ? ` e ${modules.join(', ')} excluídos do deploy estático (.vercelignore)` : ''}. Nenhum deploy foi executado.`);
