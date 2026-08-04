import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** How long a persisted cache entry stays valid on restore — and how long inactive queries are kept
 *  in memory so they actually make it into the persisted snapshot (offline reads need both). */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

/** Bump to invalidate all persisted caches after a shape change (dehydrated data becomes unreadable). */
export const CACHE_BUSTER = 'v1';

/**
 * retry:false keeps failures fast and deterministic (a turn-based game surfaces errors rather than
 * silently retrying). With `onlineManager` wired to NetInfo (Phase 6 task 1), queries pause offline
 * and refetch on reconnect instead of retrying. gcTime is long so inactive queries (e.g. a story you
 * viewed earlier) survive in the persisted cache for offline reading.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: CACHE_MAX_AGE } },
  });
}

/** AsyncStorage persister for the whole React Query cache (list + viewed story details). */
export function createCachePersister() {
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'battleapp.rq-cache',
    throttleTime: 1000, // coalesce rapid cache writes
  });
}
