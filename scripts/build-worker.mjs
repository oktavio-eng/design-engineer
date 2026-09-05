import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedContent } from './seed-content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.worker-assets');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
// Allowlist prevents deployment of git, secrets, messages exports or dev data.
for (const file of ['index.html', 'wiki.html', 'changelog.html', 'prompts.html', 'admin.html', 'styles', 'admin', 'vendor', 'data', 'favicon.svg', 'new-favicon.png', 'avatar.webp', 'og.jpg', 'Logo Black.svg', 'content.js', 'portfolio-content.js', 'script.js', 'content-sync.js', 'chrome.js', 'favicons.js', 'intro.js', 'mail.js', 'cmd.mjs', 'prompts.mjs', 'portfolio.mjs', 'contrib.mjs', 'cursor.mjs', 'sound.mjs', 'scroll.mjs']) await cp(path.join(root, file), path.join(out, file), { recursive: true });
await mkdir(path.join(root, '.worker-generated'), { recursive: true });
await writeFile(path.join(root, '.worker-generated/seed.json'), JSON.stringify(await seedContent(root)));
await writeFile(path.join(root, '.worker-generated/prompts-source.mjs'), `export default ${JSON.stringify(await readFile(path.join(root, 'prompts.mjs'), 'utf8'))};`);
console.log('Assets do studio e conteúdo inicial preparados. Nenhuma publicação feita.');
