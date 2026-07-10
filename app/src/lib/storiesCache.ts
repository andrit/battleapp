/**
 * Offline mirror of the stories list (branch B2 — never a blank screen).
 *
 * AsyncStorage holds non-secret cache only (tech-stack.md; the auth token stays in SecureStore).
 * On start we prime React Query's stories cache from AsyncStorage, and we write-through whenever
 * the stories query updates. Combined with React Query keeping cached data on a failed refetch,
 * this gives: cold-start offline shows the last list; a mid-session network drop keeps it.
 *
 * Scope note: task 6 caches the stories *list*. Caching already-viewed story *details* too (the
 * full B2) is a later step — persist-client over the whole query cache, or extend this module.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

import { keys } from './queries';
import type { Story } from '../domain/types';

const STORIES_KEY = 'battleapp.cache.stories';

export async function saveStoriesList(stories: Story[]): Promise<void> {
  await AsyncStorage.setItem(STORIES_KEY, JSON.stringify(stories));
}

export async function loadStoriesList(): Promise<Story[] | null> {
  const raw = await AsyncStorage.getItem(STORIES_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Story[];
  } catch {
    return null; // corrupt cache — treat as empty rather than crash
  }
}

/** Seed the stories query from AsyncStorage, unless it already has fresher data. */
export async function primeStoriesCache(qc: QueryClient): Promise<void> {
  if (qc.getQueryData(keys.stories)) return;
  const cached = await loadStoriesList();
  if (cached) qc.setQueryData(keys.stories, { stories: cached });
}

/** Write the stories list to AsyncStorage whenever the stories query updates. Returns unsubscribe. */
export function subscribeStoriesWriteThrough(qc: QueryClient): () => void {
  return qc.getQueryCache().subscribe((event) => {
    const key = event.query?.queryKey;
    if (Array.isArray(key) && key[0] === keys.stories[0]) {
      const data = qc.getQueryData<{ stories: Story[] }>(keys.stories);
      if (data) void saveStoriesList(data.stories);
    }
  });
}
