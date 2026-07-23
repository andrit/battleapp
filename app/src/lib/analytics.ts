/**
 * Thin analytics wrapper (Phase 4 Task 8). One `capture` funnel + typed event helpers for the V1
 * event set. **No-op unless `EXPO_PUBLIC_POSTHOG_KEY` is set** — the PostHog SDK is imported lazily
 * only when a key is present, so the default path (dev, Expo Go, CI, tests) does no work, loads no
 * native code, and makes no network calls. Analytics is best-effort: it never throws into the UI.
 *
 * To enable: set `EXPO_PUBLIC_POSTHOG_KEY` (and optionally `EXPO_PUBLIC_POSTHOG_HOST`) in `app/.env`.
 */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export type AnalyticsEvent =
  | 'story_started'
  | 'turn_submitted'
  | 'story_completed'
  | 'director_hint_viewed'
  | 'director_hint_dismissed';

type AnalyticsProps = Record<string, string | number | boolean | null>;
interface PostHogLike {
  capture: (event: string, properties?: AnalyticsProps) => void;
}

// undefined = not yet initialized; the promise resolves to a client or null (init failed).
let clientPromise: Promise<PostHogLike | null> | undefined;

async function getClient(): Promise<PostHogLike | null> {
  if (!KEY) return null;
  if (clientPromise === undefined) {
    clientPromise = (async () => {
      try {
        const mod = await import('posthog-react-native');
        const PostHog = mod.default as unknown as {
          new (apiKey: string, options: { host: string }): PostHogLike;
        };
        return new PostHog(KEY, { host: HOST });
      } catch {
        return null; // SDK missing or init failed — stay silent
      }
    })();
  }
  return clientPromise;
}

/** True when analytics is configured (a key is present). */
export function isAnalyticsEnabled(): boolean {
  return Boolean(KEY);
}

/** Record an event. No-op when disabled; fire-and-forget when enabled. */
export function capture(event: AnalyticsEvent, properties?: AnalyticsProps): void {
  if (!KEY) return;
  void getClient()
    .then((c) => c?.capture(event, properties))
    .catch(() => {});
}

/** Typed helpers for the V1 event set — call these at the affordance rather than raw `capture`. */
export const analytics = {
  storyStarted: (storyId: string) => capture('story_started', { story_id: storyId }),
  turnSubmitted: (storyId: string) => capture('turn_submitted', { story_id: storyId }),
  storyCompleted: (storyId: string) => capture('story_completed', { story_id: storyId }),
  directorHintViewed: (storyId: string) => capture('director_hint_viewed', { story_id: storyId }),
  directorHintDismissed: (storyId: string) =>
    capture('director_hint_dismissed', { story_id: storyId }),
};
