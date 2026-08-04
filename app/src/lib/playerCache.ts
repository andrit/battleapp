/**
 * Player identity cache (Phase 6, Offline & Sync). Mirrors the **non-secret** authed player
 * (id + display_name) to AsyncStorage so an offline cold start can show the app with the right
 * identity WITHOUT reaching `/me`. Never holds a token — the refresh token stays in SecureStore
 * (see authStore). Cleared on sign-out.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthPlayer } from './authApi';

const PLAYER_KEY = 'battleapp.auth.player';

export async function savePlayer(player: AuthPlayer): Promise<void> {
  await AsyncStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

export async function loadPlayer(): Promise<AuthPlayer | null> {
  const raw = await AsyncStorage.getItem(PLAYER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthPlayer;
  } catch {
    return null; // corrupt cache → treat as absent
  }
}

export async function clearPlayer(): Promise<void> {
  await AsyncStorage.removeItem(PLAYER_KEY);
}
