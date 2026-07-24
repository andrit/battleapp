/**
 * OIDC id_token verification (Phase 5). The client signs in with a provider (Apple/Google) and
 * sends us the provider's `id_token`; we verify its signature against the provider's JWKS and check
 * `iss` / `aud` / `exp`, then trust the `sub` as the external user id. We never use the provider's
 * tokens for our own API — we issue our own (see tokens.ts).
 *
 * The key source is injectable (`ProviderConfig.keys`): a remote JWKS in production, a local JWKS in
 * tests — so the whole flow verifies offline against a key pair the test controls.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type Provider = 'apple' | 'google';
export const PROVIDERS: readonly Provider[] = ['apple', 'google'];

export function isProvider(v: unknown): v is Provider {
  return typeof v === 'string' && (PROVIDERS as readonly string[]).includes(v);
}

export interface OidcClaims {
  provider: Provider;
  subject: string;
  email?: string;
}

export interface ProviderConfig {
  issuer: string | string[];
  audience: string; // our OAuth client id for this provider (the token's expected `aud`)
  keys: JWTVerifyGetKey; // jose key resolver — remote JWKS (prod) or local JWKS (tests)
}

export type OidcConfig = Record<Provider, ProviderConfig>;

/** Verify a provider `id_token`: JWKS signature + `iss`/`aud`/`exp`. Throws on anything invalid. */
export async function verifyIdToken(
  provider: Provider,
  idToken: string,
  config: OidcConfig,
): Promise<OidcClaims> {
  const cfg = config[provider];
  const { payload } = await jwtVerify(idToken, cfg.keys, {
    issuer: cfg.issuer,
    audience: cfg.audience,
  });
  if (!payload.sub) throw new Error('id_token missing sub');
  return {
    provider,
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

// Provider issuers + JWKS endpoints (public, stable).
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';

/**
 * Production config: remote JWKS (jose caches + rotates them). `audience` comes from env — the app's
 * OAuth client ids (GOOGLE_CLIENT_ID, APPLE_CLIENT_ID). Constructed lazily; no network until a token
 * is actually verified.
 */
export function createRemoteOidcConfig(env: NodeJS.ProcessEnv = process.env): OidcConfig {
  return {
    google: {
      issuer: GOOGLE_ISSUERS,
      audience: env.GOOGLE_CLIENT_ID ?? '',
      keys: createRemoteJWKSet(new URL(GOOGLE_JWKS)),
    },
    apple: {
      issuer: APPLE_ISSUER,
      audience: env.APPLE_CLIENT_ID ?? '',
      keys: createRemoteJWKSet(new URL(APPLE_JWKS)),
    },
  };
}
