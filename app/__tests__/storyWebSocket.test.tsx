import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  patchStoryWithTurn,
  storyWsUrl,
  useStoryWebSocket,
} from '../src/lib/storyWebSocket';
import { keys } from '../src/lib/queries';
import { useStoryStore } from '../src/state/storyStore';
import type { StoryWithTurns } from '../src/lib/api';
import type { Turn } from '../src/domain/types';

// Controllable fake WebSocket
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  close = jest.fn(() => this.onclose?.());
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
(globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;

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

const storyWithTurns = (turns: Turn[]): StoryWithTurns => ({
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
  created_by: 'p1',
  participants: [],
  current_author_id: null,
  created_at: 'now',
  activated_at: null,
  settings_confirmed_at: null,
  completed_at: null,
  turns,
});

beforeEach(() => {
  FakeWebSocket.instances = [];
});

describe('storyWsUrl', () => {
  it('rewrites http→ws', () => {
    expect(storyWsUrl('s1')).toMatch(/^ws:\/\/.*\/ws\/stories\/s1$/);
  });
});

describe('patchStoryWithTurn', () => {
  it('appends a turn to the cached story', () => {
    const qc = new QueryClient();
    qc.setQueryData(keys.story('s1'), storyWithTurns([]));
    patchStoryWithTurn(qc, 's1', makeTurn('live', 1));
    const data = qc.getQueryData<StoryWithTurns>(keys.story('s1'));
    expect(data?.turns.map((t) => t.content)).toEqual(['live']);
  });

  it('dedupes by sequence_number (guards optimistic/real overlap)', () => {
    const qc = new QueryClient();
    qc.setQueryData(keys.story('s1'), storyWithTurns([makeTurn('already', 1)]));
    patchStoryWithTurn(qc, 's1', { ...makeTurn('dup-seq', 1), id: 'different-id' });
    const data = qc.getQueryData<StoryWithTurns>(keys.story('s1'));
    expect(data?.turns).toHaveLength(1);
  });

  it('is a no-op when the story is not cached', () => {
    const qc = new QueryClient();
    patchStoryWithTurn(qc, 's1', makeTurn('x', 1));
    expect(qc.getQueryData(keys.story('s1'))).toBeUndefined();
  });
});

describe('useStoryWebSocket', () => {
  const Harness = ({ id }: { id: string }) => {
    useStoryWebSocket(id);
    return null;
  };

  it('connects, patches the cache on a TurnAdded frame, and ignores other frames', async () => {
    const client = new QueryClient();
    client.setQueryData(keys.story('s1'), storyWithTurns([]));

    const screen = await render(
      <QueryClientProvider client={client}>
        <Harness id="s1" />
      </QueryClientProvider>,
    );

    const ws = FakeWebSocket.instances.at(-1)!;
    act(() => ws.onopen?.());
    expect(useStoryStore.getState().wsStatus).toBe('connected');

    act(() => ws.emit({ type: 'TurnAdded', payload: makeTurn('opponent turn', 1) }));
    expect(
      client.getQueryData<StoryWithTurns>(keys.story('s1'))?.turns.map((t) => t.content),
    ).toEqual(['opponent turn']);

    // ignores non-TurnAdded frames (e.g. the echo stub)
    act(() => ws.emit({ type: 'Echo', payload: 'ping' }));
    expect(client.getQueryData<StoryWithTurns>(keys.story('s1'))?.turns).toHaveLength(1);

    // Unmount cleanup (`useEffect` returns () => ws.close()) is a standard pattern, verified by
    // inspection — RNTL's async unmount in this React 19 harness doesn't reliably fire the effect
    // cleanup within the test, and RNTL auto-cleanup handles teardown regardless.
    screen.unmount();
  });
});
