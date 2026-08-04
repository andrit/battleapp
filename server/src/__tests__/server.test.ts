import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../server.js';
import { createMemoryRepos } from '../repos/index.js';

// Endpoint tests run against fresh in-memory repos each test (fast, isolated). Story/turn routes
// require auth now, so each test signs in as a dev account and sends a Bearer token.
let app: FastifyInstance;
let token: string; // a signed-in dev account ('tester')

async function devToken(name: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/auth/dev', payload: { name } });
  return res.json().access_token as string;
}
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

beforeEach(async () => {
  app = await buildServer({ repos: createMemoryRepos() });
  token = await devToken('tester');
});

afterEach(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'battleapp-server' });
  });
});

describe('POST /stories', () => {
  it('401s without a token', async () => {
    const res = await app.inject({ method: 'POST', url: '/stories' });
    expect(res.statusCode).toBe(401);
  });

  it('creates a settings-free lobby story owned by the authed player', async () => {
    const res = await app.inject({ method: 'POST', url: '/stories', headers: bearer(token) });
    expect(res.statusCode).toBe(201);
    const story = res.json();
    expect(story.state).toBe('lobby');
    expect(story.turn_limit).toBeNull();
    expect(story.settings_confirmed_at).toBeNull();
    expect(story.participants).toHaveLength(1); // the creator
  });

  it('lists created stories', async () => {
    await app.inject({ method: 'POST', url: '/stories', headers: bearer(token) });
    await app.inject({ method: 'POST', url: '/stories', headers: bearer(token) });
    const res = await app.inject({ method: 'GET', url: '/stories' });
    expect(res.json().stories).toHaveLength(2);
  });

  it('404s on unknown story', async () => {
    const res = await app.inject({ method: 'GET', url: '/stories/nope' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /stories/:id/turns', () => {
  async function newStory() {
    return (await app.inject({ method: 'POST', url: '/stories', headers: bearer(token) })).json();
  }

  it('appends turns with contiguous sequence numbers, attributed to the author', async () => {
    const story = await newStory();
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(token),
      payload: { content: 'It was a dark and stormy night.' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().sequence_number).toBe(1);
    expect(res.json().author_id).toBe(story.created_by);

    const second = (
      await app.inject({
        method: 'POST',
        url: `/stories/${story.id}/turns`,
        headers: bearer(token),
        payload: { content: 'Then the lights went out.' },
      })
    ).json();
    expect(second.sequence_number).toBe(2);

    const fetched = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(fetched.turns).toHaveLength(2);
  });

  it('401s without a token', async () => {
    const story = await newStory();
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      payload: { content: 'no token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('activates a lobby story on its first turn (solo → stays the author’s turn)', async () => {
    const story = await newStory();
    expect(story.state).toBe('lobby');
    await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(token),
      payload: { content: 'The opening line.' },
    });
    const after = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(after.state).toBe('active');
    expect(after.current_author_id).toBe(story.created_by); // solo: still your turn
    expect(after.activated_at).not.toBeNull();
  });

  it('rejects empty content with 400', async () => {
    const story = await newStory();
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(token),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s when appending to a missing story', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/stories/nope/turns',
      headers: bearer(token),
      payload: { content: 'orphan' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('accepts a turn whose token matches the next sequence', async () => {
    const story = await newStory();
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(token),
      payload: { content: 'Matches the next slot.', token: 1 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().sequence_number).toBe(1);
  });

  it('409s a stale token — the slot moved on (turn_moved_on)', async () => {
    const story = await newStory();
    // The first turn occupies sequence 1 (solo → still the author's turn afterwards).
    const first = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(token),
      payload: { content: 'The opening line.', token: 1 },
    });
    expect(first.statusCode).toBe(201);
    // A stale offline replay still thinks it is writing sequence 1.
    const stale = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(token),
      payload: { content: 'A stale offline turn.', token: 1 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toBe('turn_moved_on');
  });

  it('403s a non-participant trying to write', async () => {
    const story = await newStory();
    const outsider = await devToken('outsider');
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(outsider),
      payload: { content: 'I was not invited.' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_a_participant');
  });
});

describe('join + turn alternation (two players)', () => {
  it('a second player joins, then turns alternate between the two authors', async () => {
    const alice = await devToken('alice');
    const bob = await devToken('bob');
    const story = (await app.inject({ method: 'POST', url: '/stories', headers: bearer(alice) })).json();
    const aliceId = story.created_by;

    const joined = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/join`,
      headers: bearer(bob),
    });
    expect(joined.statusCode).toBe(200);
    expect(joined.json().participants).toHaveLength(2);
    const bobId = joined.json().participants.find((p: { player_id: string }) => p.player_id !== aliceId)
      .player_id;

    // Alice writes → it becomes Bob's turn.
    await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(alice),
      payload: { content: 'The ferry left before dawn.' },
    });
    let s = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(s.current_author_id).toBe(bobId);

    // Bob writes → back to Alice.
    await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(bob),
      payload: { content: 'The water started answering back.' },
    });
    s = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(s.current_author_id).toBe(aliceId);
  });

  it('409s a turn taken out of turn (not_your_turn)', async () => {
    const alice = await devToken('alice');
    const bob = await devToken('bob');
    const story = (await app.inject({ method: 'POST', url: '/stories', headers: bearer(alice) })).json();
    await app.inject({ method: 'POST', url: `/stories/${story.id}/join`, headers: bearer(bob) });
    // Alice writes the opening line → the turn passes to Bob.
    await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(alice),
      payload: { content: 'Alice opens.' },
    });
    // Alice tries again, but it is Bob's turn now.
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(alice),
      payload: { content: 'Alice jumps the queue.' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('not_your_turn');
  });

  it('409s a join when the story already has two authors', async () => {
    const alice = await devToken('alice');
    const bob = await devToken('bob');
    const carol = await devToken('carol');
    const story = (await app.inject({ method: 'POST', url: '/stories', headers: bearer(alice) })).json();
    await app.inject({ method: 'POST', url: `/stories/${story.id}/join`, headers: bearer(bob) });
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/join`,
      headers: bearer(carol),
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('WebSocket /ws/stories/:id', () => {
  it('echoes messages and receives TurnAdded events', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (typeof address !== 'object' || address === null) throw new Error('no address');

    const story = (
      await app.inject({ method: 'POST', url: '/stories', headers: bearer(token) })
    ).json();
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws/stories/${story.id}`);

    const messages: Array<{ type: string }> = [];
    const received = new Promise<void>((resolve) => {
      ws.addEventListener('message', (event) => {
        messages.push(JSON.parse(String(event.data)));
        if (messages.length === 2) resolve();
      });
    });

    await new Promise<void>((resolve) => ws.addEventListener('open', () => resolve()));
    ws.send('ping');
    await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      headers: bearer(token),
      payload: { content: 'A turn arrives over the wire.' },
    });

    await received;
    ws.close();

    const types = messages.map((m) => m.type).sort();
    expect(types).toEqual(['Echo', 'TurnAdded']);
  });
});
