/**
 * Network connectivity (Phase 6, Offline & Sync). Bridges `@react-native-community/netinfo` to two
 * consumers:
 *   - React Query's `onlineManager` — so queries/mutations pause when offline and resume on reconnect;
 *   - a tiny store the UI reads for the single app-wide offline banner (`OfflineBanner`).
 * Call `startNetworkMonitoring()` once at app startup. Replaces the old per-screen `query.isError`
 * "offline" proxy with a real connectivity signal.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

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
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      const online = isOnlineState(state);
      setOnline(online); // React Query: pause/resume queries + mutations
      useNetworkStore.setState({ online }); // UI: the offline banner
    }),
  );
}

/** Reactive connectivity for components (e.g. `OfflineBanner`). */
export const useIsOnline = (): boolean => useNetworkStore((s) => s.online);
