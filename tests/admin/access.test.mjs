import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessIdentity } from '../../cloudflare/access.mjs';

test('Access exige assinatura, e-mail, audience e validade corretos', async t => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'test-key' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [jwk] });
  t.after(() => { globalThis.fetch = originalFetch; });
  const env = { ACCESS_TEAM_DOMAIN: 'https://studio-test.cloudflareaccess.com', ACCESS_AUD: 'studio-audience', ADMIN_EMAIL: 'admin@example.com' };
  const claims = { iss: env.ACCESS_TEAM_DOMAIN, aud: [env.ACCESS_AUD], email: env.ADMIN_EMAIL, exp: Math.floor(Date.now() / 1000) + 60 };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  async function token(payload, header = { alg: 'RS256', kid: jwk.kid }) {
    const input = encode(header) + '.' + encode(payload);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(input));
    return input + '.' + Buffer.from(signature).toString('base64url');
  }
  const identity = jwt => accessIdentity(new Request('https://studio.example/admin', { headers: { 'Cf-Access-Jwt-Assertion': jwt } }), env);
  const valid = await token(claims);
  assert.equal((await identity(valid)).username, env.ADMIN_EMAIL);
  for (const change of [{ email: 'other@example.com' }, { aud: ['other'] }, { iss: 'https://forged.example' }, { exp: 1 }, { nbf: claims.exp + 3600 }]) assert.equal(await identity(await token({ ...claims, ...change })), null);
  assert.equal(await identity(await token(claims, { alg: 'none', kid: jwk.kid })), null);
  const parts = valid.split('.'); parts[1] = encode({ ...claims, exp: claims.exp + 100 });
  assert.equal(await identity(parts.join('.')), null);
});
