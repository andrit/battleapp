import { render, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import ComposeScreen from '../src/screens/ComposeScreen';
import { api, ApiError, type StoryWithTurns } from '../src/lib/api';
import { registerMutationDefaults } from '../src/lib/queries';
import { useNetworkStore } from '../src/lib/network';
import type { Turn } from '../src/domain/types';

jest.mock('../src/lib/api', () => ({
  api: { getStory: jest.fn(), submitTurn: jest.fn(), directorHint: jest.fn() },
  ApiError: class ApiError extends Error {
    constructor(status: number, body?: unknown) {
      super(`API error ${status}`);
      Object.assign(this, { status, body }); // fields via assign — no class-field babel helper in the factory
    }
  },
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
  registerMutationDefaults(client); // submit-turn mutationFn + optimistic logic live in the defaults
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  // Reset connectivity so an offline test can't leak into the next one.
  onlineManager.setOnline(true);
  useNetworkStore.setState({ online: true });
});

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

  it('a 409 (the story moved on) shows the skipped message and drops the draft', async () => {
    let reject!: () => void;
    mockApi.submitTurn.mockReturnValue(
      new Promise<Turn>((_res, rej) => {
        reject = () => rej(new ApiError(409, { error: 'turn_moved_on' }));
      }),
    );
    const view = await renderWithClient(<ComposeScreen {...makeProps()} />);
    const user = userEvent.setup();

    await user.type(view.getByTestId('turn-input'), 'A stale line.');
    await user.press(view.getByTestId('submit'));
    reject();

    await waitFor(() => expect(view.getByTestId('submit-error')).toHaveTextContent(/moved on/i));
    expect(view.getByTestId('turn-input').props.value).toBe(''); // stale → retry won't help, draft dropped
  });

  it('offline: queues the turn (not sent yet), shows the queued ack, and closes', async () => {
    onlineManager.setOnline(false); // React Query pauses the mutation
    useNetworkStore.setState({ online: false }); // the component's offline signal
    mockApi.submitTurn.mockResolvedValue(makeTurn('queued', 2));
    const goBack = jest.fn();
    const view = await renderWithClient(<ComposeScreen {...makeProps({ goBack })} />);
    const user = userEvent.setup();

    await user.type(view.getByTestId('turn-input'), 'Written on the subway.');
    await user.press(view.getByTestId('submit'));

    await waitFor(() => expect(view.getByTestId('posted-ack')).toHaveTextContent(/queued/i));
    expect(mockApi.submitTurn).not.toHaveBeenCalled(); // paused offline — not sent until reconnect
    await waitFor(() => expect(goBack).toHaveBeenCalled(), { timeout: 2000 });
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

  it('the hint appearing then dismissing leaves the draft undisturbed and still editable', async () => {
    mockApi.directorHint.mockResolvedValue({ hint: 'Raise the stakes.' });
    const view = await renderWithClient(<ComposeScreen {...makeProps()} />);
    const user = userEvent.setup();

    await user.type(view.getByTestId('turn-input'), 'The captain lit a lantern');
    await view.findByTestId('director-hint'); // hint arrives mid-compose
    expect(view.getByTestId('turn-input').props.value).toBe('The captain lit a lantern');

    await user.press(view.getByTestId('dismiss-hint'));
    await waitFor(() => expect(view.queryByTestId('director-hint')).toBeNull());
    // Draft survived the hint show + dismiss, and the input is still editable (no focus disruption).
    expect(view.getByTestId('turn-input').props.value).toBe('The captain lit a lantern');
    await user.type(view.getByTestId('turn-input'), ' twice');
    expect(view.getByTestId('turn-input').props.value).toBe('The captain lit a lantern twice');
  });
});
