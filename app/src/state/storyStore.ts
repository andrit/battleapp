/**
 * Story store stub — Phase 2 adds the real story/turn state, WebSocket wiring,
 * and optimistic submission (B5 branch) via React Query.
 */
import { create } from 'zustand';

interface StoryState {
  activeStoryId: string | null;
  setActiveStory: (id: string | null) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  activeStoryId: null,
  setActiveStory: (id) => set({ activeStoryId: id }),
}));
