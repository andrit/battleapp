/**
 * usePreferencesStore — pure client-state UX (client-state-ux.md): Stories list filter/sort and
 * Story-View reading controls (font size / comfort / paper). Zustand + AsyncStorage (key
 * `battleapp.prefs`), separate from the auth token (SecureStore) and the offline stories cache —
 * same AsyncStorage layer, different content. Per-device, survives restart, works offline (no
 * loading/error states on any control). Reading prefs are global (every story); list prefs are
 * global to the Stories tab.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PaperChoice } from '../theme/tokens';

export type ListFilter = 'all' | 'your-turn' | 'active' | 'completed';
export type ListSort = 'recent' | 'longest-waiting' | 'az';
export type FontStep = 0 | 1 | 2 | 3; // S / M(default) / L / XL

export interface ListPrefs {
  filter: ListFilter;
  sort: ListSort;
}
export interface ReadingPrefs {
  fontStep: FontStep;
  comfort: boolean; // extra line-height
  paper: PaperChoice;
}

interface PreferencesState {
  list: ListPrefs;
  reading: ReadingPrefs;
  setFilter: (filter: ListFilter) => void;
  setSort: (sort: ListSort) => void;
  setFontStep: (fontStep: FontStep) => void;
  setComfort: (comfort: boolean) => void;
  setPaper: (paper: PaperChoice) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      list: { filter: 'all', sort: 'recent' },
      reading: { fontStep: 1, comfort: false, paper: 'warm' },
      setFilter: (filter) => set((s) => ({ list: { ...s.list, filter } })),
      setSort: (sort) => set((s) => ({ list: { ...s.list, sort } })),
      setFontStep: (fontStep) => set((s) => ({ reading: { ...s.reading, fontStep } })),
      setComfort: (comfort) => set((s) => ({ reading: { ...s.reading, comfort } })),
      setPaper: (paper) => set((s) => ({ reading: { ...s.reading, paper } })),
    }),
    {
      name: 'battleapp.prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
