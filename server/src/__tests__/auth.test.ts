import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose';

import { buildServer } from '../server.js';
import { createMemoryRepos } from '../repos/index.js';
import type { OidcConfig } from '../auth/oidc.js';

// A local RS256 key pair + JWKS the test controls — so provider id_token verification runs fully
// offline (no real Apple/Google network calls), exactly the prod path minus the remote JWKS.
let privateKey: CryptoKey;
let oidc: OidcConfig;

const GOOGLE_ISS = 'https://accounts.google.com';
const GOOGLE_AUD = 'test-google-client-id';

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  oidc = {
    google: { issuer: GOOGLE_ISS, audience: GOOGLE_AUD, keys },
    apple: { issuer: 'https://appleid.apple.com', audience: 'test-apple-client-id', keys },
  };
});

/** Sign a provider id_token with the test key. Overrides let us forge invalid ones. */
async function idToken(
  over: { sub?: string; iss?: string; aud?: string; email?: string } = {},
): Promise<string> {
  return new SignJWT({ email: over.email ?? 'writer@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(over.iss ?? GOOGLE_ISS)
    .setAudience(over.aud ?? GOOGLE_AUD)
    .setSubject(over.sub ?? 'google-sub-1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

let app: FastifyInstance;
beforeEach(async () => {
  app = await buildServer({ repos: createMemoryRepos(), oidc });
});
afterEach(async () => {
  await app.close();
});

async function signIn(sub = 'google-sub-1') {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/oidc',
    payload: { provider: 'google', id_token: await idToken({ sub }) },
  });
  return res;
}

describe('POST /auth/oidc', () => {
  it('verifies a provider id_token and issues our access + refresh tokens + player', async () => {
    const res = await signIn();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.access_token).toBe('string');
    expect(typeof body.refresh_token).toBe('string');
    expect(typeof body.player.id).toBe('string');
  });

  it('is idempotent per identity — the same sub returns the same player', async () => {
    const a = (await signIn('sub-x')).json();
    const b = (await signIn('sub-x')).json();
    expect(b.player.id).toBe(a.player.id);
  });

  it('401s an id_token with the wrong audience', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oidc',
      payload: { provider: 'google', id_token: await idToken({ aud: 'someone-else' }) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('400s a malformed request', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/oidc', payload: { provider: 'x' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /me (authed)', () => {
  it('returns the authed player for a valid Bearer access token', async () => {
    const { access_token, player } = (await signIn()).json();
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${access_token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(player.id);
  });

  it('401s an invalid Bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('401s when no token is sent', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/dev (dev accounts)', () => {
  it('signs in as a stable named test account with real tokens', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev', payload: { name: 'alice' } });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.player.display_name).toBe('alice');
    expect(typeof body.access_token).toBe('string');
    // idempotent: same name → same player
    const again = await app.inject({ method: 'POST', url: '/auth/dev', payload: { name: 'alice' } });
    expect(again.json().player.id).toBe(body.player.id);
  });

  it('two different names are two different players', async () => {
    const a = (await app.inject({ method: 'POST', url: '/auth/dev', payload: { name: 'alice' } })).json();
    const b = (await app.inject({ method: 'POST', url: '/auth/dev', payload: { name: 'bob' } })).json();
    expect(b.player.id).not.toBe(a.player.id);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates: issues a new pair and invalidates the used refresh token (single-use)', async () => {
    const { refresh_token } = (await signIn()).json();

    const rotated = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token },
    });
    expect(rotated.statusCode).toBe(200);
    expect(typeof rotated.json().access_token).toBe('string');
    expect(rotated.json().refresh_token).not.toBe(refresh_token);

    // The original (now-spent) refresh token no longer works.
    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token },
    });
    expect(reuse.statusCode).toBe(401);
  });
});

describe('PATCH /me (first-run handle pick)', () => {
  it('sets a unique display name for the authed player', async () => {
    const { access_token } = (await signIn()).json();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${access_token}` },
      payload: { display_name: 'ferrywriter' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().display_name).toBe('ferrywriter');
  });

  it('409s a handle already taken by another player', async () => {
    const a = (await signIn('sub-a')).json();
    await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${a.access_token}` },
      payload: { display_name: 'taken_name' },
    });
    const b = (await signIn('sub-b')).json();
    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: { authorization: `Bearer ${b.access_token}` },
      payload: { display_name: 'taken_name' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('401s without a token', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/me', payload: { display_name: 'x' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/signout', () => {
  it('revokes the refresh token', async () => {
    const { refresh_token } = (await signIn()).json();
    const out = await app.inject({ method: 'POST', url: '/auth/signout', payload: { refresh_token } });
    expect(out.statusCode).toBe(204);

    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token },
    });
    expect(refresh.statusCode).toBe(401);
  });
});
