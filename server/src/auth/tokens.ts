/**
 * Our own session tokens (Phase 5) — issued after a provider id_token is verified (oidc.ts).
 *
 * - **Access token:** short-lived signed JWT (HS256) carrying the player id as `sub`. Sent as a
 *   Bearer token on API calls; stateless to verify.
 * - **Refresh token:** opaque random string; only its SHA-256 hash is stored server-side, with an
 *   expiry. Single-use (rotated on refresh) and revocable on sign-out.
 */
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// HS256 secret for our access tokens. Required in production; a clearly-insecure dev default keeps
// local/offline runs working. (fail-fast env validation is a project pattern — tighten in deploy.)
function accessSecret(): Uint8Array {
  const s = process.env.AUTH_JWT_SECRET ?? 'dev-insecure-access-secret-change-me';
  return new TextEncoder().encode(s);
}

export async function issueAccessToken(playerId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(playerId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(accessSecret());
}

/** Verify our access token and return the player id (`sub`). Throws if invalid/expired. */
export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, accessSecret());
  if (!payload.sub) throw new Error('access token missing sub');
  return payload.sub;
}

export interface RefreshToken {
  token: string; // the opaque secret returned to the client (never stored)
  hash: string; // sha256(token) — what we persist
  expiresAt: string; // ISO 8601
}

export function createRefreshToken(): RefreshToken {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    hash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString(),
  };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
