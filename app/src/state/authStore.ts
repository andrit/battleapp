/**
 * Auth store. The token lives in expo-secure-store (Keychain/Keystore) — NEVER AsyncStorage
 * (tech-stack.md). This module imports only SecureStore; AsyncStorage holds non-secret cache
 * only (task 6). Sign-in is a stub until the real auth backend lands in Phase 4 — this task
 * proves the token round-trip and the state shape.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const TOKEN_KEY = 'battleapp.auth.token';

export interface AuthPlayer {
  id: string;
  display_name: string;
}

type AuthStatus = 'loading' | 'authed' | 'anon';

interface AuthState {
  token: string | null;
  player: AuthPlayer | null;
  status: AuthStatus;
  /** Restore the token from SecureStore on app start. Player identity is fetched in Phase 4. */
  hydrate: () => Promise<void>;
  signIn: (token: string, player: AuthPlayer) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  player: null,
  status: 'loading',
  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    set({ token, status: token ? 'authed' : 'anon' });
  },
  signIn: async (token, player) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, player, status: 'authed' });
  },
  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, player: null, status: 'anon' });
  },
}));
