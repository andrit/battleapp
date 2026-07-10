/**
 * Story session/UI state (client state only).
 *
 * Scope note (Phase 2): server state — the stories list, story detail, turns, and "whose turn"
 * (Story.current_author_id) — lives in React Query (useStories / useStory), per tech-stack.md's
 * split. So this store holds only client/UI session state: which story the user is currently in.
 * The WebSocket connection lifecycle is added here in task 7. `useStoriesStore` from the
 * pre-React-Query Phase 2 sketch is intentionally NOT created — its data is server state and
 * would duplicate React Query (two sources of truth).
 */
import { create } from 'zustand';

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface StoryState {
  activeStoryId: string | null;
  setActiveStory: (id: string | null) => void;
  /** WebSocket connection status for the active story (driven by useStoryWebSocket). */
  wsStatus: WsStatus;
  setWsStatus: (status: WsStatus) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  activeStoryId: null,
  setActiveStory: (id) => set({ activeStoryId: id }),
  wsStatus: 'idle',
  setWsStatus: (wsStatus) => set({ wsStatus }),
}));
