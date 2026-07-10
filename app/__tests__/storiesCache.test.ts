import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  loadStoriesList,
  primeStoriesCache,
  saveStoriesList,
  subscribeStoriesWriteThrough,
} from '../src/lib/storiesCache';
import { keys } from '../src/lib/queries';
import type { Story } from '../src/domain/types';

const makeStory = (id: string): Story => ({
  id,
  title: null,
  mode: 'freeform',
  elements: null,
  turn_limit: null,
  pace_preset: null,
  state: 'lobby',
  stalled_at: null,
  pure_human: false,
  voice: {},
  summary: null,
  created_by: 'p1',
  participants: [],
  current_author_id: null,
  created_at: 'now',
  activated_at: null,
  settings_confirmed_at: null,
  completed_at: null,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('storiesCache', () => {
  it('round-trips the stories list', async () => {
    const list = [makeStory('a'), makeStory('b')];
    await saveStoriesList(list);
    expect(await loadStoriesList()).toEqual(list);
  });

  it('loadStoriesList returns null when empty', async () => {
    expect(await loadStoriesList()).toBeNull();
  });

  it('primeStoriesCache seeds the query from cache (offline data before any fetch)', async () => {
    await saveStoriesList([makeStory('a')]);
    const qc = new QueryClient();
    await primeStoriesCache(qc);
    expect(qc.getQueryData(keys.stories)).toEqual({ stories: [makeStory('a')] });
  });

  it('primeStoriesCache does not overwrite fresher query data', async () => {
    await saveStoriesList([makeStory('old')]);
    const qc = new QueryClient();
    qc.setQueryData(keys.stories, { stories: [makeStory('fresh')] });
    await primeStoriesCache(qc);
    expect(qc.getQueryData(keys.stories)).toEqual({ stories: [makeStory('fresh')] });
  });

  it('write-through mirrors the list to AsyncStorage on query update', async () => {
    const qc = new QueryClient();
    const unsub = subscribeStoriesWriteThrough(qc);
    qc.setQueryData(keys.stories, { stories: [makeStory('x')] });
    await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget save flush
    expect(await loadStoriesList()).toEqual([makeStory('x')]);
    unsub();
  });
});
