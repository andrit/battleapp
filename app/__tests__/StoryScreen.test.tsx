import { render, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import StoryScreen from '../src/screens/StoryScreen';
import { api, ApiError, type StoryWithTurns } from '../src/lib/api';
import type { Turn } from '../src/domain/types';

jest.mock('../src/lib/api', () => ({
  api: { getStory: jest.fn(), submitTurn: jest.fn() },
  // Plain subclass — parameter-properties trip babel's jest-hoist checker, and the test only
  // needs a rejectable error (the real ApiError's typed signature comes from the import).
  ApiError: class ApiError extends Error {},
}));

const mockApi = {
  getStory: api.getStory as jest.Mock,
  submitTurn: api.submitTurn as jest.Mock,
};

const makeTurn = (content: string, seq: number): Turn => ({
  id: `t${seq}`,
  story_id: 's1',
  author_id: 'p1',
  author_type: 'human',
  content,
  sequence_number: seq,
  moderation_status: 'passed',
  supersedes: null,
  created_at: 'now',
});

const makeStory = (turns: Turn[]): StoryWithTurns => ({
  id: 's1',
  title: null,
  mode: 'freeform',
  elements: null,
  turn_limit: null,
  pace_preset: null,
  state: 'lobby',
  stalled_at: null,
  pure_human: false,
  voice: {},
  summary: null,
  created_by: 'p1',
  participants: [],
  current_author_id: null,
  created_at: 'now',
  activated_at: null,
  settings_confirmed_at: null,
  completed_at: null,
  turns,
});

const props = {
  route: { key: 'story', name: 'Story', params: { id: 's1' } },
  navigation: {},
} as unknown as Parameters<typeof StoryScreen>[0];

function renderWithClient(ui: ReactElement) {
  // gcTime:0 lets the cache gc once observers unmount, avoiding a lingering RQ timer that keeps
  // the jest worker alive.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockApi.getStory.mockReset();
  mockApi.submitTurn.mockReset();
});

describe('StoryScreen', () => {
  it('submits a turn and shows it in the story scroll (happy path)', async () => {
    const turns: Turn[] = [];
    mockApi.getStory.mockImplementation(() => Promise.resolve(makeStory([...turns])));
    mockApi.submitTurn.mockImplementation((_id: string, content: string) => {
      const t = makeTurn(content, turns.length + 1);
      turns.push(t);
      return Promise.resolve(t);
    });

    const screen = await renderWithClient(<StoryScreen {...props} />);
    await screen.findByText('state: lobby · turns: 0'); // story loaded before interacting
    expect(await screen.findByText('No turns yet — write the first one.')).toBeTruthy();

    const user = userEvent.setup();
    await user.type(screen.getByTestId('turn-input'), 'Once upon a stub.');
    await user.press(screen.getByText('Submit turn'));

    await waitFor(() => {
      expect(screen.getByText('Once upon a stub.')).toBeTruthy();
      expect(screen.getByText('#1 · human')).toBeTruthy();
    });
    // draft cleared on success
    expect(screen.getByTestId('turn-input').props.value).toBe('');
  });

  it('B5: optimistic turn rolls back on error, draft preserved', async () => {
    mockApi.getStory.mockResolvedValue(makeStory([]));
    let reject!: () => void;
    mockApi.submitTurn.mockReturnValue(
      new Promise<Turn>((_res, rej) => {
        reject = () => rej(new ApiError(400, { error: 'content_invalid' }));
      }),
    );

    const screen = await renderWithClient(<StoryScreen {...props} />);
    await screen.findByText('state: lobby · turns: 0');
    await screen.findByText('No turns yet — write the first one.');

    const user = userEvent.setup();
    await user.type(screen.getByTestId('turn-input'), 'Doomed line.');
    await user.press(screen.getByText('Submit turn'));

    // optimistic Section appears immediately
    await waitFor(() => expect(screen.getByText('Doomed line.')).toBeTruthy());

    // server rejects → rollback
    reject();
    await waitFor(() => expect(screen.queryByText('Doomed line.')).toBeNull());

    // draft preserved for retry, and the retry affordance is shown
    expect(screen.getByTestId('turn-input').props.value).toBe('Doomed line.');
    expect(screen.getByText("Couldn't send — tap Submit to retry.")).toBeTruthy();
  });
});
