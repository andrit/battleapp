import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../server.js';
import { resetStore } from '../store.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  resetStore();
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'battleapp-server' });
  });
});

describe('stories stubs', () => {
  it('creates a story in lobby state with no settings', async () => {
    const res = await app.inject({ method: 'POST', url: '/stories' });
    expect(res.statusCode).toBe(201);
    const story = res.json();
    expect(story.state).toBe('lobby');
    expect(story.turns).toEqual([]);
    // Settings deferred to the Settings Handshake — creation carries none.
    expect(story).not.toHaveProperty('pace_preset');
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
  it('appends a turn with a contiguous sequence number', async () => {
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

  it('rejects empty content', async () => {
    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();
    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
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
