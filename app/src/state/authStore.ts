/**
 * Auth store stub — Phase 2 adds real sign-in/out, SecureStore token handling.
 */
import { create } from 'zustand';

interface AuthState {
  playerId: string | null;
  displayName: string | null;
  signIn: (playerId: string, displayName: string) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  playerId: null,
  displayName: null,
  signIn: (playerId, displayName) => set({ playerId, displayName }),
  signOut: () => set({ playerId: null, displayName: null }),
}));
