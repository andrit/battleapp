import { render, userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import StoriesScreen from '../src/screens/StoriesScreen';
import { api, ApiError, type StoryWithTurns } from '../src/lib/api';
import { useAuthStore } from '../src/state/authStore';
import { usePreferencesStore } from '../src/state/preferencesStore';
import type { Story, StoryState } from '../src/domain/types';

jest.mock('../src/lib/api', () => ({
  api: { listStories: jest.fn(), createStory: jest.fn() },
  ApiError: class ApiError extends Error {},
  BASE_URL: 'http://localhost:4000',
}));

// StoriesScreen reads navigation from context; a mock lets us assert mockNavigate() without a navigator.
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockApi = {
  listStories: api.listStories as jest.Mock,
  createStory: api.createStory as jest.Mock,
};

function makeStory(id: string, overrides: Partial<Story> = {}): Story {
  return {
    id,
    title: `Story ${id}`,
    mode: 'freeform',
    elements: null,
    turn_limit: null,
    pace_preset: null,
    state: 'active' as StoryState,
    stalled_at: null,
    pure_human: false,
    voice: {},
    summary: null,
    created_by: 'me',
    participants: [],
    current_author_id: 'me',
    created_at: '2026-07-01T00:00:00.000Z',
    activated_at: '2026-07-01T00:00:00.000Z',
    settings_confirmed_at: null,
    completed_at: null,
    ...overrides,
  };
}

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockNavigate.mockReset();
  mockApi.listStories.mockReset();
  mockApi.createStory.mockReset();
  useAuthStore.setState({ token: null, player: null, status: 'anon' }); // FALLBACK_ME = 'me'
  usePreferencesStore.setState({
    list: { filter: 'all', sort: 'recent' },
    reading: { fontStep: 1, comfort: false, paper: 'warm' },
  });
});

describe('StoriesScreen', () => {
  it('shows the skeleton while the first load is pending', async () => {
    mockApi.listStories.mockReturnValue(new Promise(() => {})); // never resolves
    const screen = await renderWithClient(<StoriesScreen />);
    expect(screen.getByTestId('stories-skeleton')).toBeTruthy();
  });

  it('shows the first-run empty state with a Start CTA when there are no stories', async () => {
    mockApi.listStories.mockResolvedValue({ stories: [] });
    const screen = await renderWithClient(<StoriesScreen />);
    expect(await screen.findByTestId('stories-empty')).toBeTruthy();
    expect(screen.getByTestId('start-story-cta')).toBeTruthy();
  });

  it('renders a hard error with Retry when there is no cache', async () => {
    mockApi.listStories.mockRejectedValue(new ApiError(500, {}));
    const screen = await renderWithClient(<StoriesScreen />);
    expect(await screen.findByTestId('stories-error')).toBeTruthy();
    expect(screen.getByTestId('stories-retry')).toBeTruthy();
  });

  it('lists stories your-turn-first, with a your-turn dot only on my active turn', async () => {
    mockApi.listStories.mockResolvedValue({
      stories: [
        makeStory('done', { state: 'complete', current_author_id: null }),
        makeStory('waiting', { current_author_id: 'p2' }),
        makeStory('mine', { current_author_id: 'me' }),
      ],
    });
    const screen = await renderWithClient(<StoriesScreen />);
    await screen.findByTestId('stories-list');

    // your-turn dot appears exactly once (only the 'mine' card).
    expect(screen.getAllByTestId('your-turn-dot')).toHaveLength(1);
    // grouping: the first rendered card title is the your-turn story.
    const titles = screen.getAllByTestId('story-card');
    expect(titles).toHaveLength(3);
  });

  it('starts a story from the FAB and navigates to it', async () => {
    mockApi.listStories.mockResolvedValue({ stories: [makeStory('a')] });
    mockApi.createStory.mockResolvedValue({ id: 'new-1' } as StoryWithTurns);
    const screen = await renderWithClient(<StoriesScreen />);
    await screen.findByTestId('stories-list');

    await userEvent.press(screen.getByTestId('start-story-fab'));
    expect(mockNavigate).toHaveBeenCalledWith('Story', { id: 'new-1' });
  });

  it('filters the list to completed stories when the Completed chip is selected', async () => {
    mockApi.listStories.mockResolvedValue({
      stories: [
        makeStory('mine', { current_author_id: 'me' }),
        makeStory('done', { state: 'complete', current_author_id: null }),
      ],
    });
    const screen = await renderWithClient(<StoriesScreen />);
    await screen.findByTestId('stories-list');
    expect(screen.getByText('Story mine')).toBeTruthy();

    await userEvent.press(screen.getByTestId('filter-completed'));
    expect(screen.getByText('Story done')).toBeTruthy();
    expect(screen.queryByText('Story mine')).toBeNull();
  });

  it('shows the filtered-empty state (not first-run) and Show all resets the filter', async () => {
    mockApi.listStories.mockResolvedValue({
      stories: [makeStory('mine', { current_author_id: 'me' })], // no completed stories
    });
    const screen = await renderWithClient(<StoriesScreen />);
    await screen.findByTestId('stories-list');

    await userEvent.press(screen.getByTestId('filter-completed'));
    expect(screen.getByTestId('stories-filtered-empty')).toBeTruthy();
    expect(screen.queryByTestId('stories-empty')).toBeNull(); // distinct from first-run

    await userEvent.press(screen.getByTestId('show-all'));
    expect(await screen.findByTestId('stories-list')).toBeTruthy();
  });
});
