/**
 * Post-deploy check, read-only. Walks the public domain and the Worker host
 * and reports what a visitor and an anonymous stranger get:
 *
 *   node scripts/verify-studio-production.mjs https://oktavio-studio.<sub>.workers.dev [--public https://oktavio.vercel.app]
 *
 * - the three content modules answer JavaScript with the right MIME type and
 *   never an HTML page (Vercel 404, Access login) — on both hosts, and the
 *   public copy matches the Worker's, which is what proves the rewrite is live;
 * - /admin and /api/admin/* refuse an anonymous request (401 from the Worker,
 *   or a redirect to the team's Access login at the edge); a 200 is a failure;
 * - /api/contact refuses a POST without a trusted Origin (403; a 404 on the
 *   public domain means the rewrite is missing) and the preflight from the
 *   public origin comes back with it echoed — so the proxy forwards Origin.
 *
 * Only GET, HEAD, OPTIONS and POSTs that the Worker rejects before touching
 * the database (no Origin, foreign Origin, and an empty body on top) are sent.
 * Exit code 1 when anything fails.
 */
const args = process.argv.slice(2);
const studio = args.find(arg => !arg.startsWith('--'));
const publicSite = args.includes('--public') ? args[args.indexOf('--public') + 1] : 'https://oktavio.vercel.app';
if (!studio || !/^https:\/\/[^/]+$/.test(studio) || !/^https:\/\/[^/]+$/.test(publicSite || '')) { console.error('Uso: node scripts/verify-studio-production.mjs https://HOST-DO-STUDIO [--public https://oktavio.vercel.app]'); process.exit(1); }

const results = [];
const check = (ok, label, detail = '') => { results.push(ok); console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`); return ok; };
async function probe(url, init = {}) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'verify-studio-production', ...init.headers }, ...init });
    return { status: response.status, type: response.headers.get('content-type') || '', location: response.headers.get('location') || '', acao: response.headers.get('access-control-allow-origin') || '', body: init.method === 'HEAD' ? '' : await response.text() };
  } catch (error) { return { error: error.message, status: 0, type: '', location: '', acao: '', body: '' }; }
}
const isHTML = body => /<!doctype|<html|cloudflareaccess\.com/i.test(body.slice(0, 2000));
const anonymousRefused = r => r.status === 401 || ([302, 303, 307].includes(r.status) && /cloudflareaccess\.com/.test(r.location));
const describe = r => r.error ? `erro: ${r.error}` : `${r.status}${r.type ? ` ${r.type.split(';')[0]}` : ''}${r.location ? ` → ${r.location}` : ''}`;

const modules = [['/content.js', /window\.SITE_CONTENT\s*=/], ['/portfolio-content.js', /window\.PORTFOLIO_CONTENT\s*=/], ['/prompts.mjs', /export const PROMPTS\s*=/]];
console.log(`Público: ${publicSite}\nStudio:  ${studio}\n`);
for (const [route, marker] of modules) {
  const [pub, wk] = await Promise.all([probe(publicSite + route), probe(studio + route)]);
  for (const [name, r] of [['público', pub], ['Worker', wk]]) {
    check(r.status === 200 && /^(text|application)\/javascript/.test(r.type) && !isHTML(r.body) && marker.test(r.body), `${route} no ${name} é JavaScript`, describe(r));
  }
  check(pub.body && pub.body === wk.body, `${route}: público e Worker servem o mesmo módulo`, pub.body === wk.body ? 'rewrite ativo' : 'diferem: o público ainda serve o arquivo estático da Vercel, ou o Worker está em outra revisão');
}
console.log('');
for (const route of ['/admin', '/admin.html', '/admin/app.mjs', '/api/admin/session', '/api/admin/content', '/api/admin/messages', '/api/admin/export']) {
  const r = await probe(studio + route);
  check(anonymousRefused(r), `${route} anônimo no Studio é recusado`, describe(r) + (r.status === 401 ? ' (Worker)' : /cloudflareaccess/.test(r.location) ? ' (Access na borda)' : ''));
  const forged = await probe(studio + route, { headers: { 'Cf-Access-Authenticated-User-Email': 'admin@example.com' } });
  check(anonymousRefused(forged), `${route} com header de e-mail forjado é recusado`, describe(forged));
}
for (const route of ['/admin', '/admin.html', '/api/admin/content']) {
  const r = await probe(publicSite + route);
  check(!(r.status === 200 && /admin-root|admin-page/.test(r.body)) && !(r.status === 200 && route.startsWith('/api/')), `${route} não existe no domínio público`, describe(r));
}
console.log('');
for (const [name, host] of [['público', publicSite], ['Worker', studio]]) {
  const none = await probe(host + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check(none.status === 403, `POST /api/contact sem Origin no ${name} → 403`, describe(none) + (none.status === 404 && name === 'público' ? ' (rewrite ausente na Vercel)' : ''));
  const foreign = await probe(host + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
  check(foreign.status === 403, `POST /api/contact com Origin estranha no ${name} → 403`, describe(foreign));
}
const preflight = await probe(publicSite + '/api/contact', { method: 'OPTIONS', headers: { Origin: publicSite, 'Access-Control-Request-Method': 'POST' } });
check(preflight.status === 204 && preflight.acao === publicSite, 'OPTIONS /api/contact pelo domínio público ecoa a origem', describe(preflight) + (preflight.acao ? ` ACAO ${preflight.acao}` : ' (sem Access-Control-Allow-Origin: o proxy da Vercel não repassou o Origin, ou o rewrite está ausente)'));
const bounce = await probe(studio + '/wiki');
check(bounce.status === 302 && bounce.location === publicSite + '/wiki', 'Rotas fora do Studio no Worker voltam ao site público', describe(bounce));

const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.${failed ? ` ${failed} falharam.` : ''}`);
process.exitCode = failed ? 1 : 0;
