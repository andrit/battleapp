import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../server.js';
import { createMemoryRepos } from '../repos/index.js';

// Endpoint tests run against fresh in-memory repos each test (fast, isolated).
let app: FastifyInstance;

beforeEach(async () => {
  app = await buildServer({ repos: createMemoryRepos() });
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

describe('GET /me', () => {
  it('returns a stable dev player (bootstrap identity)', async () => {
    const first = await app.inject({ method: 'GET', url: '/me' });
    expect(first.statusCode).toBe(200);
    expect(typeof first.json().id).toBe('string');
    // Idempotent: the same dev player each call.
    const second = await app.inject({ method: 'GET', url: '/me' });
    expect(second.json().id).toBe(first.json().id);
  });
});

describe('POST /stories', () => {
  it('creates a settings-free lobby story', async () => {
    const res = await app.inject({ method: 'POST', url: '/stories' });
    expect(res.statusCode).toBe(201);
    const story = res.json();
    expect(story.state).toBe('lobby');
    expect(story.turn_limit).toBeNull();
    expect(story.pace_preset).toBeNull();
    expect(story.settings_confirmed_at).toBeNull();
    expect(story.participants).toHaveLength(1); // the creator
  });

  it('lists created stories', async () => {
    await app.inject({ method: 'POST', url: '/stories' });
    await app.inject({ method: 'POST', url: '/stories' });
    const res = await app.inject({ method: 'GET', url: '/stories' });
    expect(res.json().stories).toHaveLength(2);
  });

  it('404s on unknown story', async () => {
    const res = await app.inject({ method: 'GET', url: '/stories/nope' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /stories/:id/turns', () => {
  it('appends turns with contiguous sequence numbers, visible via GET', async () => {
    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      payload: { content: 'It was a dark and stormy night.' },
    });
    expect(res.statusCode).toBe(201);
    const turn = res.json();
    expect(turn.sequence_number).toBe(1);
    expect(turn.author_type).toBe('human');

    const second = (
      await app.inject({
        method: 'POST',
        url: `/stories/${story.id}/turns`,
        payload: { content: 'Then the lights went out.' },
      })
    ).json();
    expect(second.sequence_number).toBe(2);

    const fetched = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(fetched.turns).toHaveLength(2);
  });

  it('activates a lobby story on its first turn and marks it the author’s turn (dev loop)', async () => {
    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();
    expect(story.state).toBe('lobby');
    await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      payload: { content: 'The opening line.' },
    });
    const after = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(after.state).toBe('active');
    expect(after.current_author_id).toBe(story.created_by); // the dev player
    expect(after.activated_at).not.toBeNull();
  });

  it('rejects empty content with 400', async () => {
    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s when appending to a missing story', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/stories/nope/turns',
      payload: { content: 'orphan' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('WebSocket /ws/stories/:id', () => {
  it('echoes messages and receives TurnAdded events', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (typeof address !== 'object' || address === null) throw new Error('no address');

    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();
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
      payload: { content: 'A turn arrives over the wire.' },
    });

    await received;
    ws.close();

    const types = messages.map((m) => m.type).sort();
    expect(types).toEqual(['Echo', 'TurnAdded']);
  });
});
