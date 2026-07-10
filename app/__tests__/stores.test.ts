import { useStoryStore } from '../src/state/storyStore';

describe('useStoryStore', () => {
  it('tracks the active story', () => {
    useStoryStore.getState().setActiveStory('s1');
    expect(useStoryStore.getState().activeStoryId).toBe('s1');
    useStoryStore.getState().setActiveStory(null);
    expect(useStoryStore.getState().activeStoryId).toBeNull();
  });
});
