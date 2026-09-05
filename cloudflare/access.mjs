const encoder = new TextEncoder();
const hex = data => [...new Uint8Array(data)].map(n => n.toString(16).padStart(2, '0')).join('');
export const hash = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const decode = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
let keysCache;
/** Verify Access at the origin as well as at the edge. A forged identity
 * header or an unprotected alternate hostname never grants administration. */
export async function accessIdentity(request, env) {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN || '') || !env.ACCESS_AUD || !env.ADMIN_EMAIL) return null;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) return null;
  try {
    const parts = token.split('.'); if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || payload.iss !== env.ACCESS_TEAM_DOMAIN || !Array.isArray(payload.aud) || !payload.aud.includes(env.ACCESS_AUD) || typeof payload.exp !== 'number' || payload.exp <= now || (payload.nbf && payload.nbf > now + 30) || payload.email?.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return null;
    // Keys are cached for five minutes; an unknown `kid` (Cloudflare rotating
    // the signing key) refreshes them once so a valid token is not locked out
    // for the rest of the window. A malformed certs body is never cached.
    const load = async () => {
      const response = await fetch(env.ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs', { signal: AbortSignal.timeout(5000) });
      const keys = response.ok ? (await response.json())?.keys : null;
      if (!Array.isArray(keys)) return false;
      keysCache = { domain: env.ACCESS_TEAM_DOMAIN, keys, until: Date.now() + 300_000, fetchedAt: Date.now() };
      return true;
    };
    const find = () => keysCache?.keys.find(key => key.kid === header.kid && key.kty === 'RSA');
    if ((!keysCache || keysCache.domain !== env.ACCESS_TEAM_DOMAIN || keysCache.until < Date.now()) && !await load()) return null;
    let jwk = find();
    if (!jwk && Date.now() - keysCache.fetchedAt > 30_000 && await load()) jwk = find();
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), encoder.encode(parts[0] + '.' + parts[1]))) return null;
    return { username: payload.email, csrf: await hash('studio-csrf:' + token), mode: 'cloudflare' };
  } catch { return null; }
}
