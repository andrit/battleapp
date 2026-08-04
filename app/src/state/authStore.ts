/**
 * Auth store (Phase 5). OIDC social sign-in issues our own **access + refresh** tokens:
 *
 * - the **refresh token** is the only persisted secret — it lives in **expo-secure-store**
 *   (Keychain/Keystore), NEVER AsyncStorage (which isn't encrypted);
 * - the **access token** is held in memory only and re-obtained from the refresh token on cold start
 *   (`hydrate`) and whenever the API sees a 401 (`refresh`).
 *
 * Server calls go through `authApi` (which imports neither this store nor `api.ts`).
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { authApi, isAuthRejection, type AuthPlayer, type Provider, type Session } from '../lib/authApi';
import { clearPlayer, loadPlayer, savePlayer } from '../lib/playerCache';
import { getProviderIdToken } from '../lib/oauth';

export type { AuthPlayer, Session } from '../lib/authApi';

/**
 * Outcome of a token rotation. Only `invalid` (the server rejected the token) ends the session;
 * `offline` is a transient/network failure where the session and refresh token are KEPT for retry.
 */
export type RefreshResult =
  | { status: 'refreshed'; accessToken: string }
  | { status: 'invalid' }
  | { status: 'offline' };

/** A freshly-created player still carries a generated `player_xxxxxxxx` handle to rename. */
export function needsHandle(player: AuthPlayer): boolean {
  return /^player_[0-9a-f]{8}$/.test(player.display_name);
}

// The ONLY secret we persist. (The old `battleapp.auth.token` key is superseded by this.)
const REFRESH_KEY = 'battleapp.auth.refresh';

type AuthStatus = 'loading' | 'authed' | 'anon';

interface AuthState {
  accessToken: string | null; // in memory only
  refreshToken: string | null; // mirror of SecureStore, for refresh/sign-out calls
  player: AuthPlayer | null;
  status: AuthStatus;
  /**
   * A brand-new account that just finished the handle pick — routes to the one-time First-story
   * prompt (screen-states #4) before the app. In-memory only, so it shows exactly once: a returning
   * user hydrates straight into the app on cold start.
   */
  justOnboarded: boolean;
  /** One-shot: the First-story prompt's "Start a story" was tapped → Stories opens the create flow. */
  pendingStart: boolean;
  /** Run a provider OAuth flow → verify server-side → adopt the session. Throws on cancel/failure. */
  signInWithProvider: (provider: Provider) => Promise<void>;
  /** Dev-only: sign in as a named test account (Alice/Bob) with real tokens. Retired with real auth. */
  signInAsDevAccount: (name: string) => Promise<void>;
  /** Adopt a fresh sign-in session: persist the refresh token, go authed. */
  signIn: (session: Session) => Promise<void>;
  /** Adopt the chosen handle for a brand-new account → show the one-time First-story prompt next. */
  completeHandlePick: (player: AuthPlayer) => void;
  /** Leave the First-story prompt into the app; `start` carries the "Start a story" intent. */
  dismissFirstStory: (start: boolean) => void;
  /** Stories consumed the "Start a story" intent (create flow launched) — clear it. */
  clearPendingStart: () => void;
  /**
   * Cold-start restore: refresh-token → new access → player. A rejected token signs out; a network
   * failure keeps the session and restores identity from the player cache (authed offline).
   */
  hydrate: () => Promise<void>;
  /**
   * Rotate the tokens. `refreshed` → fresh access token; `invalid` → token rejected (signed out);
   * `offline` → transient/network failure, session KEPT for retry. Only `invalid` signs out.
   */
  refresh: () => Promise<RefreshResult>;
  /** Revoke + clear everything, go anon. */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  player: null,
  status: 'loading',
  justOnboarded: false,
  pendingStart: false,

  signInWithProvider: async (provider) => {
    const idToken = await getProviderIdToken(provider); // provider OAuth flow (native)
    const session = await authApi.oidc(provider, idToken); // server verifies + issues our tokens
    await get().signIn(session);
  },

  signInAsDevAccount: async (name) => {
    // Transitional: real-token sign-in as a named test account, so two devices can be two players.
    await get().signIn(await authApi.devSession(name));
  },

  signIn: async ({ access_token, refresh_token, player }) => {
    await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
    await savePlayer(player); // non-secret identity, for offline cold start
    set({ accessToken: access_token, refreshToken: refresh_token, player, status: 'authed' });
  },

  completeHandlePick: (player) => {
    void savePlayer(player); // keep the offline-identity cache in sync with the new handle
    set({ player, justOnboarded: true });
  },

  dismissFirstStory: (start) => set({ justOnboarded: false, pendingStart: start }),

  clearPendingStart: () => set({ pendingStart: false }),

  hydrate: async () => {
    const stored = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!stored) {
      set({ status: 'anon' });
      return;
    }
    set({ refreshToken: stored });
    const result = await get().refresh();
    if (result.status === 'invalid') return; // token rejected → already signed out (anon)
    if (result.status === 'refreshed') {
      try {
        const me = await authApi.me(result.accessToken);
        await savePlayer(me);
        set({ player: me, status: 'authed' });
        return;
      } catch (err) {
        if (isAuthRejection(err)) {
          await get().signOut();
          return;
        }
        // network failure on /me — we still hold a valid access token; fall through to offline restore
      }
    }
    // Offline (refresh or /me failed on the network): restore identity from cache, KEEP the token,
    // stay authed offline. Reconnect warms the access token (network.ts) or the next 401 refresh does.
    const cached = await loadPlayer();
    if (cached) set({ player: cached, status: 'authed' });
    else set({ status: 'anon' }); // no cached identity; token kept for a later online launch
  },

  refresh: async () => {
    const rt = get().refreshToken;
    if (!rt) {
      set({ status: 'anon' });
      return { status: 'invalid' };
    }
    try {
      const { access_token, refresh_token } = await authApi.refresh(rt);
      await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
      set({ accessToken: access_token, refreshToken: refresh_token });
      return { status: 'refreshed', accessToken: access_token };
    } catch (err) {
      if (isAuthRejection(err)) {
        await get().signOut(); // token truly rejected (401/403)
        return { status: 'invalid' };
      }
      return { status: 'offline' }; // network / 5xx — keep the token + session, retry later
    }
  },

  signOut: async () => {
    const rt = get().refreshToken;
    if (rt) {
      try {
        await authApi.signout(rt);
      } catch {
        // best-effort revoke; local clear happens regardless
      }
    }
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await clearPlayer();
    set({
      accessToken: null,
      refreshToken: null,
      player: null,
      status: 'anon',
      justOnboarded: false,
      pendingStart: false,
    });
  },
}));
