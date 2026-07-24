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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`auth ${path} ${res.status}`);
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
    if (!res.ok) throw new Error(`auth /me ${res.status}`);
    return (await res.json()) as AuthPlayer;
  },
};
