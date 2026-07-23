import { render, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import ComposeScreen from '../src/screens/ComposeScreen';
import { api, ApiError, type StoryWithTurns } from '../src/lib/api';
import type { Turn } from '../src/domain/types';

jest.mock('../src/lib/api', () => ({
  api: { getStory: jest.fn(), submitTurn: jest.fn(), directorHint: jest.fn() },
  ApiError: class ApiError extends Error {},
  BASE_URL: 'http://localhost:4000',
}));

// ComposeScreen calls useHeaderHeight() (needs a navigation header context we don't mount here).
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));

jest.mock('../src/lib/analytics', () => ({
  analytics: {
    turnSubmitted: jest.fn(),
    directorHintViewed: jest.fn(),
    directorHintDismissed: jest.fn(),
  },
}));
import { analytics } from '../src/lib/analytics';

const mockApi = {
  getStory: api.getStory as jest.Mock,
  submitTurn: api.submitTurn as jest.Mock,
  directorHint: api.directorHint as jest.Mock,
};

const makeTurn = (content: string, seq: number): Turn => ({
  id: `t${seq}`,
  story_id: 's1',
  author_id: 'p2',
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

function renderWithClient(ui: ReactElement) {
  // ComposeScreen mounts useStory(id), so the story cache always has a live observer and is never
  // GC'd mid-test — the default gcTime is fine here (no override needed).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockApi.getStory.mockResolvedValue(makeStory([makeTurn('The ferry left before dawn.', 1)]));
  mockApi.submitTurn.mockReset();
  mockApi.directorHint.mockResolvedValue({ hint: null });
  (analytics.turnSubmitted as jest.Mock).mockReset();
  (analytics.directorHintViewed as jest.Mock).mockReset();
  (analytics.directorHintDismissed as jest.Mock).mockReset();
});

describe('ComposeScreen', () => {
  it('live 500-char counter turns over-limit and disables Submit past the limit', async () => {
    const view = await renderWithClient(<ComposeScreen {...makeProps()} />);
    const input = view.getByTestId('turn-input');
    const user = userEvent.setup();

    await user.type(input, 'hello');
    expect(view.getByTestId('char-counter')).toHaveTextContent('5 / 500');

    // Over the limit → counter reflects it and Submit is disabled.
    input.props.onChangeText('x'.repeat(501));
    await waitFor(() => expect(view.getByTestId('char-counter')).toHaveTextContent('501 / 500'));
    expect(view.getByTestId('submit').props.accessibilityState.disabled).toBe(true);
  });

  it('submits, shows the coral ack, clears the draft, and closes', async () => {
    mockApi.submitTurn.mockImplementation((_id: string, content: string) =>
      Promise.resolve(makeTurn(content, 2)),
    );
    const goBack = jest.fn();
    const view = await renderWithClient(<ComposeScreen {...makeProps({ goBack })} />);
    const user = userEvent.setup();

    await user.type(view.getByTestId('turn-input'), 'Neither could name the shore.');
    await user.press(view.getByTestId('submit'));

    await waitFor(() => expect(view.getByTestId('posted-ack')).toBeTruthy());
    expect(view.getByTestId('turn-input').props.value).toBe(''); // draft cleared on success
    expect(analytics.turnSubmitted).toHaveBeenCalledWith('s1');
    await waitFor(() => expect(goBack).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('B5: on error the draft is kept, a retry line shows, and the modal stays open', async () => {
    let reject!: () => void;
    mockApi.submitTurn.mockReturnValue(
      new Promise<Turn>((_res, rej) => {
        reject = () => rej(new ApiError(400, { error: 'content_invalid' }));
      }),
    );
    const goBack = jest.fn();
    const view = await renderWithClient(<ComposeScreen {...makeProps({ goBack })} />);
    const user = userEvent.setup();

    await user.type(view.getByTestId('turn-input'), 'Doomed line.');
    await user.press(view.getByTestId('submit'));
    reject();

    await waitFor(() => expect(view.getByTestId('submit-error')).toBeTruthy());
    expect(view.getByTestId('turn-input').props.value).toBe('Doomed line.'); // draft preserved
    expect(goBack).not.toHaveBeenCalled();
  });

  it('shows the director hint when present and dismisses it without closing', async () => {
    mockApi.directorHint.mockResolvedValue({ hint: 'What does the ferry want in return?' });
    const view = await renderWithClient(<ComposeScreen {...makeProps()} />);

    expect(await view.findByTestId('director-hint')).toBeTruthy();
    expect(view.getByText('What does the ferry want in return?')).toBeTruthy();
    await waitFor(() => expect(analytics.directorHintViewed).toHaveBeenCalledWith('s1'));

    const user = userEvent.setup();
    await user.press(view.getByTestId('dismiss-hint'));
    await waitFor(() => expect(view.queryByTestId('director-hint')).toBeNull());
    expect(analytics.directorHintDismissed).toHaveBeenCalledWith('s1');
  });
});
