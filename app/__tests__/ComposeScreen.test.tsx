import { render, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import ComposeScreen from '../src/screens/ComposeScreen';
import { api, ApiError, type StoryWithTurns } from '../src/lib/api';
import type { Turn } from '../src/domain/types';

jest.mock('../src/lib/api', () => ({
  api: { getStory: jest.fn(), submitTurn: jest.fn() },
  ApiError: class ApiError extends Error {},
  BASE_URL: 'http://localhost:4000',
}));

const mockApi = {
  getStory: api.getStory as jest.Mock,
  submitTurn: api.submitTurn as jest.Mock,
};

const makeTurn = (content: string, seq: number): Turn => ({
  id: `t${seq}`,
  story_id: 's1',
  author_id: 'me',
  author_type: 'human',
  content,
  sequence_number: seq,
  moderation_status: 'passed',
  supersedes: null,
  created_at: 'now',
});

const makeStory = (turns: Turn[]): StoryWithTurns =>
  ({
    id: 's1',
    title: null,
    mode: 'freeform',
    elements: null,
    turn_limit: null,
    pace_preset: null,
    state: 'active',
    stalled_at: null,
    pure_human: false,
    voice: {},
    summary: null,
    created_by: 'me',
    participants: [],
    current_author_id: 'me',
    created_at: 'now',
    activated_at: null,
    settings_confirmed_at: null,
    completed_at: null,
    turns,
  }) as StoryWithTurns;

function makeProps(navigation: { goBack?: jest.Mock } = {}) {
  return {
    route: { key: 'compose', name: 'Compose', params: { id: 's1' } },
    navigation: { goBack: jest.fn(), ...navigation },
  } as unknown as Parameters<typeof ComposeScreen>[0];
}

function renderWithClient(ui: ReactElement, client: QueryClient) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockApi.getStory.mockReset();
  mockApi.submitTurn.mockReset();
});

describe('ComposeScreen (temporary, Task 4)', () => {
  it('submits a turn, optimistically appends it to the story cache, then closes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    // Seed the story cache the optimistic update writes into.
    client.setQueryData(['story', 's1'], makeStory([]));
    mockApi.submitTurn.mockImplementation((_id: string, content: string) =>
      Promise.resolve(makeTurn(content, 1)),
    );

    const goBack = jest.fn();
    const screen = await renderWithClient(<ComposeScreen {...makeProps({ goBack })} />, client);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('turn-input'), 'Once upon a stub.');
    await user.press(screen.getByText('Submit'));

    await waitFor(() => {
      const cached = client.getQueryData<StoryWithTurns>(['story', 's1']);
      expect(cached?.turns.at(-1)?.content).toBe('Once upon a stub.');
    });
    await waitFor(() => expect(goBack).toHaveBeenCalled());
  });

  it('B5: on error the optimistic turn rolls back, the draft is kept, and a retry line shows', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(['story', 's1'], makeStory([]));
    let reject!: () => void;
    mockApi.submitTurn.mockReturnValue(
      new Promise<Turn>((_res, rej) => {
        reject = () => rej(new ApiError(400, { error: 'content_invalid' }));
      }),
    );

    const goBack = jest.fn();
    const screen = await renderWithClient(<ComposeScreen {...makeProps({ goBack })} />, client);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('turn-input'), 'Doomed line.');
    await user.press(screen.getByText('Submit'));

    // optimistic append lands in the cache
    await waitFor(() => {
      const cached = client.getQueryData<StoryWithTurns>(['story', 's1']);
      expect(cached?.turns.at(-1)?.content).toBe('Doomed line.');
    });

    reject();

    // rollback: the optimistic turn is gone…
    await waitFor(() => {
      const cached = client.getQueryData<StoryWithTurns>(['story', 's1']);
      expect(cached?.turns).toHaveLength(0);
    });
    // …the draft stays for retry, the modal did not close, and the retry line shows
    expect(screen.getByTestId('turn-input').props.value).toBe('Doomed line.');
    expect(goBack).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't post — tap Submit to retry.")).toBeTruthy();
  });
});
