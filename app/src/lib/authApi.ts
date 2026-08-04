/**
 * Thin client for the auth endpoints (Phase 5). Kept separate from `api.ts` and importing neither
 * it nor `authStore` — so the dependency chain stays acyclic: `api.ts` → `authStore` → `authApi`.
 * These calls take tokens explicitly (they run during sign-in / hydrate, before/around the store's
 * own token state).
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Provider = 'apple' | 'google';

export interface AuthPlayer {
  id: string;
  display_name: string;
}

/** The result of a successful sign-in (`POST /auth/oidc`). */
export interface Session {
  access_token: string;
  refresh_token: string;
  player: AuthPlayer;
}

/** Thrown when an auth endpoint responds non-2xx. A `fetch` rejection (offline/unreachable) stays a
 *  TypeError — NOT an AuthApiError — which is exactly how callers tell "offline" from "token rejected". */
export class AuthApiError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`auth ${path} ${status}`);
    this.name = 'AuthApiError';
  }
}

/** True only when the server actively rejected our token (401/403) — the sign-out signal. A network
 *  failure or a 5xx is NOT a rejection: keep the session and retry later. */
export function isAuthRejection(err: unknown): boolean {
  return err instanceof AuthApiError && (err.status === 401 || err.status === 403);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new AuthApiError(res.status, path);
  return (await res.json()) as T;
}

export const authApi = {
  /** Verify a provider id_token → our session (access + refresh + player). */
  oidc: (provider: Provider, idToken: string) =>
    postJson<Session>('/auth/oidc', { provider, id_token: idToken }),

  /** Rotate: exchange a refresh token for a fresh access + refresh pair. */
  refresh: (refreshToken: string) =>
    postJson<{ access_token: string; refresh_token: string }>('/auth/refresh', {
      refresh_token: refreshToken,
    }),

  /** Revoke a refresh token (best-effort; server 204s). */
  signout: async (refreshToken: string): Promise<void> => {
    await fetch(`${BASE_URL}/auth/signout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  /** The authenticated player for an access token. */
  me: async (accessToken: string): Promise<AuthPlayer> => {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new AuthApiError(res.status, '/me');
    return (await res.json()) as AuthPlayer;
  },

  /** Dev-only: sign in as a stable named test account (Alice/Bob) with real tokens. Retired with real auth. */
  devSession: (name: string) => postJson<Session>('/auth/dev', { name }),
};
