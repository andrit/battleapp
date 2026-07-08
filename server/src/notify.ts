/**
 * Notify layer — the seam for live updates (WebSocket fan-out).
 *
 * V1 runs a single server instance, so the in-process implementation is all we need.
 * V2 swaps in a Valkey pub/sub adapter behind this same interface when the server goes
 * multi-instance (tech-stack.md — Caching & horizontal scale). Game code only ever sees
 * Notifier.
 */
export interface Notifier {
  subscribe(storyId: string, listener: (event: StoryEvent) => void): () => void;
  publish(storyId: string, event: StoryEvent): void;
}

export interface StoryEvent {
  type: string;
  payload: unknown;
}

export function createInProcessNotifier(): Notifier {
  const listeners = new Map<string, Set<(event: StoryEvent) => void>>();

  return {
    subscribe(storyId, listener) {
      let set = listeners.get(storyId);
      if (!set) {
        set = new Set();
        listeners.set(storyId, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(storyId);
      };
    },
    publish(storyId, event) {
      listeners.get(storyId)?.forEach((listener) => listener(event));
    },
  };
}
