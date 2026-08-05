/**
 * Network connectivity (Phase 6, Offline & Sync). Bridges `@react-native-community/netinfo` to two
 * consumers:
 *   - React Query's `onlineManager` — so queries/mutations pause when offline and resume on reconnect;
 *   - a tiny store the UI reads for the single app-wide offline banner (`OfflineBanner`).
 * Call `startNetworkMonitoring()` once at app startup. Replaces the old per-screen `query.isError`
 * "offline" proxy with a real connectivity signal.
 */
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';
// Type-only import — erased at runtime, so importing this module never loads the native NetInfo
// (which throws at eval when RNCNetInfo is null on a build that predates it). The runtime module is
// required lazily + guarded in startNetworkMonitoring below.
import type { NetInfoState } from '@react-native-community/netinfo';

import { useAuthStore } from '../state/authStore';

/**
 * "Online" = a connection exists AND the internet is reachable. `isInternetReachable` is `null` until
 * NetInfo finishes probing, so unknown is treated as online — avoids a false-offline flash at launch.
 */
export function isOnlineState(
  state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean {
  return !!state.isConnected && state.isInternetReachable !== false;
}

interface NetworkStore {
  online: boolean;
}
// Optimistic default (online); NetInfo's first emission on subscribe corrects it immediately.
export const useNetworkStore = create<NetworkStore>(() => ({ online: true }));

/**
 * Subscribe to connectivity and drive both React Query's `onlineManager` and the UI store from one
 * NetInfo subscription. `onlineManager` owns the subscription lifecycle (a later call replaces the
 * listener), so this is meant to be called once from `App` on mount.
 */
export function startNetworkMonitoring(): void {
  try {
    // Lazy require so a build missing the native module degrades gracefully instead of crashing.
    const NetInfo = require('@react-native-community/netinfo')
      .default as typeof import('@react-native-community/netinfo').default;
    let wasOnline = true; // seeded true so the first emission doesn't count as a "reconnect"
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        const online = isOnlineState(state);
        setOnline(online); // React Query: pause/resume queries + mutations
        useNetworkStore.setState({ online }); // UI: the offline banner
        // Reconnected while authed but running offline (no access token) → warm the session so writes
        // work again. hydrate/api-401 also cover this; this makes it proactive.
        if (online && !wasOnline) {
          const auth = useAuthStore.getState();
          if (auth.status === 'authed' && !auth.accessToken) void auth.refresh();
        }
        wasOnline = online;
      }),
    );
  } catch (err) {
    // No native NetInfo (e.g. a dev build made before it was added → RNCNetInfo is null). Assume
    // online so the app still works; connectivity-driven features (banner, pause/resume, reconnect)
    // stay off until a build that includes @react-native-community/netinfo is installed.
    if (__DEV__) {
      console.warn(
        '[network] @react-native-community/netinfo native module unavailable — assuming online. ' +
          'Install a dev build that includes it to enable offline detection.',
        err,
      );
    }
    onlineManager.setOnline(true);
    useNetworkStore.setState({ online: true });
  }
}

/** Reactive connectivity for components (e.g. `OfflineBanner`). */
export const useIsOnline = (): boolean => useNetworkStore((s) => s.online);
