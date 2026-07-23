import { analytics, capture, isAnalyticsEnabled } from '../src/lib/analytics';

// No EXPO_PUBLIC_POSTHOG_KEY in the test env → analytics is the default no-op.
describe('analytics (disabled by default)', () => {
  it('reports disabled when no key is configured', () => {
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it('capture and the typed helpers no-op without throwing or loading the SDK', () => {
    expect(() => capture('turn_submitted', { story_id: 's1' })).not.toThrow();
    expect(() => analytics.storyStarted('s1')).not.toThrow();
    expect(() => analytics.turnSubmitted('s1')).not.toThrow();
    expect(() => analytics.storyCompleted('s1')).not.toThrow();
    expect(() => analytics.directorHintViewed('s1')).not.toThrow();
    expect(() => analytics.directorHintDismissed('s1')).not.toThrow();
  });
});
