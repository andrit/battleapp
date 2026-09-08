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

export interface NotifierOptions {
  /**
   * Called when a listener throws. Defaults to `console.error`, deliberately not silence — a
   * swallowed listener error is indistinguishable from a listener that did nothing. Pass a no-op
   * to opt out explicitly.
   */
  onListenerError?: (error: unknown, storyId: string, event: StoryEvent) => void;
}

export interface StoryEvent {
  type: string;
  payload: unknown;
}

export function createInProcessNotifier(options: NotifierOptions = {}): Notifier {
  const onListenerError =
    options.onListenerError ??
    ((error, storyId) => console.error(`[notify] listener failed on story "${storyId}"`, error));

  const listeners = new Map<string, Set<(event: StoryEvent) => void>>();

  return {
    subscribe(storyId, listener) {
      let set = listeners.get(storyId);
      if (!set) {
        set = new Set();
        listeners.set(storyId, set);
      }
      set.add(listener);

      let unsubscribed = false;
      return () => {
        // Idempotent: a second call must not remove a later re-subscription of the same function
        // reference, which a bare `delete(listener)` would do. Re-read the map rather than closing
        // over the set, so an entry replaced since subscribe time is never touched.
        if (unsubscribed) return;
        unsubscribed = true;
        const current = listeners.get(storyId);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) listeners.delete(storyId);
      };
    },
    publish(storyId, event) {
      const set = listeners.get(storyId);
      if (!set) return;
      // Snapshot, and isolate each listener: a WebSocket `send` on a socket that just died throws,
      // and an unguarded loop would silently drop the event for every listener after it — the other
      // player in the same story stops getting live turns. One bad socket must not take out the rest.
      for (const listener of [...set]) {
        try {
          listener(event);
        } catch (error) {
          onListenerError(error, storyId, event);
        }
      }
    },
  };
}
