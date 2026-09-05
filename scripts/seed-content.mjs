import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
export async function seedContent(root) {
  const context = { window: {} };
  for (const file of ['content.js', 'portfolio-content.js']) vm.runInNewContext(await readFile(path.join(root, file), 'utf8'), context);
  const promptSource = await readFile(path.join(root, 'prompts.mjs'), 'utf8');
  const begin = promptSource.indexOf('export const PROMPTS ='), end = promptSource.indexOf('\nfunction searchText');
  // cloudflare/worker.mjs splices the served /prompts.mjs on these same two anchors: fail the build if either moves.
  if (begin < 0 || end < begin) throw new Error('prompts.mjs: marcadores "export const PROMPTS =" / "function searchText" não encontrados nessa ordem.');
  const source = promptSource.slice(begin + 'export const PROMPTS ='.length, end);
  const prompts = vm.runInNewContext(source.trim().replace(/;$/, ''));
  const collections = { ...context.window.PORTFOLIO_CONTENT, ...context.window.SITE_CONTENT,
    gallery: Object.fromEntries(context.window.PORTFOLIO_CONTENT.gallery.map((entry, i) => [`image-${i + 1}`, entry])),
    prompts: Object.fromEntries(prompts.map(entry => [entry.slug, entry])) };
  return JSON.parse(JSON.stringify({ version: 1, revision: 0, collections, trash: [], activity: [] }));
}
