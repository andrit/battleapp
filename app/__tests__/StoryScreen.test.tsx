import { render, userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import StoryScreen from '../src/screens/StoryScreen';
import { api, ApiError, type StoryWithTurns } from '../src/lib/api';
import { useAuthStore } from '../src/state/authStore';
import type { StoryState, Turn } from '../src/domain/types';

jest.mock('../src/lib/api', () => ({
  api: { getStory: jest.fn(), submitTurn: jest.fn() },
  ApiError: class ApiError extends Error {},
  BASE_URL: 'http://localhost:4000',
}));

// StoryScreen mounts useStoryWebSocket → new WebSocket(); WS behavior is covered in
// storyWebSocket.test.tsx, so a no-op keeps these tests focused on the Story View.
class NoopWebSocket {
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = jest.fn();
  constructor(_url: string) {}
}
(globalThis as unknown as { WebSocket: unknown }).WebSocket = NoopWebSocket;

const mockGetStory = api.getStory as jest.Mock;

const makeTurn = (content: string, seq: number, authorId = 'p1'): Turn => ({
  id: `t${seq}`,
  story_id: 's1',
  author_id: authorId,
  author_type: 'human',
  content,
  sequence_number: seq,
  moderation_status: 'passed',
  supersedes: null,
  created_at: 'now',
});

const makeStory = (overrides: Partial<StoryWithTurns> = {}): StoryWithTurns => ({
  id: 's1',
  title: null,
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
  participants: [
    { player_id: 'me', role: 'author', joined_at: 'now' },
    { player_id: 'p2', role: 'author', joined_at: 'now' },
  ],
  current_author_id: 'me',
  created_at: 'now',
  activated_at: null,
  settings_confirmed_at: null,
  completed_at: null,
  turns: [],
  ...overrides,
});

const props = {
  route: { key: 'story', name: 'Story', params: { id: 's1' } },
  navigation: { navigate: jest.fn() },
} as unknown as Parameters<typeof StoryScreen>[0];

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockGetStory.mockReset();
  // No real auth yet — FALLBACK_ME ('me') is the current player in these tests.
  useAuthStore.setState({ token: null, player: null, status: 'anon' });
});

describe('StoryScreen (Story View)', () => {
  it('shows the skeleton while the first load is pending', async () => {
    mockGetStory.mockReturnValue(new Promise<StoryWithTurns>(() => {})); // never resolves
    const screen = await renderWithClient(<StoryScreen {...props} />);
    expect(screen.getByTestId('story-skeleton')).toBeTruthy();
  });

  it('renders a hard error with Retry when there is no cache', async () => {
    mockGetStory.mockRejectedValue(new ApiError(500, {}));
    const screen = await renderWithClient(<StoryScreen {...props} />);
    expect(await screen.findByTestId('story-error')).toBeTruthy();
    expect(screen.getByTestId('story-retry')).toBeTruthy();
  });

  it('renders the turns scroll and a "your turn" bar when it is my turn', async () => {
    mockGetStory.mockResolvedValue(
      makeStory({
        turns: [makeTurn('The ferry left before dawn.', 1, 'me')],
        current_author_id: 'me',
      }),
    );
    const screen = await renderWithClient(<StoryScreen {...props} />);
    expect(await screen.findByTestId('story-scroll')).toBeTruthy();
    expect(screen.getByText('The ferry left before dawn.')).toBeTruthy();
    expect(screen.getByTestId('your-turn-bar')).toBeTruthy();
    expect(screen.queryByTestId('waiting-bar')).toBeNull();
  });

  it('shows the waiting bar when it is the partner’s turn', async () => {
    mockGetStory.mockResolvedValue(
      makeStory({ turns: [makeTurn('Opening.', 1, 'p2')], current_author_id: 'p2' }),
    );
    const screen = await renderWithClient(<StoryScreen {...props} />);
    await screen.findByTestId('story-scroll');
    expect(screen.getByTestId('waiting-bar')).toBeTruthy();
    expect(screen.queryByTestId('your-turn-bar')).toBeNull();
  });

  it('lobby-empty: either author sees the write-opening CTA (built together)', async () => {
    // 'me' is one of the two authors; created_by is the OTHER — the CTA still shows,
    // because in the lobby either author can write the opening line.
    mockGetStory.mockResolvedValue(
      makeStory({ state: 'lobby', current_author_id: null, created_by: 'p2', turns: [] }),
    );
    const screen = await renderWithClient(<StoryScreen {...props} />);
    expect(await screen.findByTestId('lobby-empty')).toBeTruthy();
    expect(screen.getByTestId('write-opening')).toBeTruthy();
  });

  it('lobby-empty: a non-author (spectator) sees the waiting copy (no CTA)', async () => {
    mockGetStory.mockResolvedValue(
      makeStory({
        state: 'lobby',
        current_author_id: null,
        participants: [
          { player_id: 'p1', role: 'author', joined_at: 'now' },
          { player_id: 'p2', role: 'author', joined_at: 'now' },
        ],
        turns: [],
      }),
    );
    const screen = await renderWithClient(<StoryScreen {...props} />);
    expect(await screen.findByTestId('lobby-empty')).toBeTruthy();
    expect(screen.queryByTestId('write-opening')).toBeNull();
    expect(screen.getByText(/Waiting for/)).toBeTruthy();
  });

  it('navigates to Compose from the your-turn bar', async () => {
    mockGetStory.mockResolvedValue(makeStory({ turns: [makeTurn('x', 1, 'me')] }));
    const navigate = jest.fn();
    const localProps = { ...props, navigation: { navigate } } as unknown as typeof props;
    const screen = await renderWithClient(<StoryScreen {...localProps} />);
    const bar = await screen.findByTestId('your-turn-bar');
    await userEvent.press(bar);
    expect(navigate).toHaveBeenCalledWith('Compose', { id: 's1' });
  });

  it('shows the complete footer for a finished story', async () => {
    mockGetStory.mockResolvedValue(
      makeStory({ state: 'complete', current_author_id: null, turns: [makeTurn('End.', 1)] }),
    );
    const screen = await renderWithClient(<StoryScreen {...props} />);
    await screen.findByTestId('story-scroll');
    expect(screen.getByTestId('story-complete')).toBeTruthy();
  });
});
