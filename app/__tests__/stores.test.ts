import { useAuthStore } from '../src/state/authStore';
import { useStoryStore } from '../src/state/storyStore';

describe('useAuthStore stub', () => {
  it('signs in and out', () => {
    useAuthStore.getState().signIn('p1', 'Alice');
    expect(useAuthStore.getState().displayName).toBe('Alice');
    useAuthStore.getState().signOut();
    expect(useAuthStore.getState().playerId).toBeNull();
  });
});

describe('useStoryStore stub', () => {
  it('tracks the active story', () => {
    useStoryStore.getState().setActiveStory('s1');
    expect(useStoryStore.getState().activeStoryId).toBe('s1');
    useStoryStore.getState().setActiveStory(null);
    expect(useStoryStore.getState().activeStoryId).toBeNull();
  });
});
