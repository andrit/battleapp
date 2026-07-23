import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../server.js';
import { createMemoryRepos } from '../repos/index.js';
import type { AiService } from '../ai/service.js';
import type { Repos } from '../repos/types.js';
import type { Story, Turn } from '../domain/types.js';

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

// --- Moderation hook (over real in-memory repos, with an injected verdict) ------

describe('moderation hook on POST /stories/:id/turns', () => {
  it('rejects a turn with 422 and does not store it when moderation says reject', async () => {
    const ai: AiService = {
      async moderateTurn() {
        return { verdict: 'reject', reason: 'no good' };
      },
      async directorHint() {
        return null;
      },
    };
    app = await buildServer({ repos: createMemoryRepos(), ai });
    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();

    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      payload: { content: 'a blocked line' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: 'moderation_rejected', reason: 'no good' });

    const fetched = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(fetched.turns).toHaveLength(0); // fail-closed: nothing stored
  });

  it('fails closed with 502 when moderation errors', async () => {
    const ai: AiService = {
      async moderateTurn() {
        throw new Error('provider down');
      },
      async directorHint() {
        return null;
      },
    };
    app = await buildServer({ repos: createMemoryRepos(), ai });
    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();

    const res = await app.inject({
      method: 'POST',
      url: `/stories/${story.id}/turns`,
      payload: { content: 'unscreenable' },
    });
    expect(res.statusCode).toBe(502);

    const fetched = (await app.inject({ method: 'GET', url: `/stories/${story.id}` })).json();
    expect(fetched.turns).toHaveLength(0);
  });
});

// --- Director-hint stall gating (fake repos serving a stalled active story) ------

function stalledRepos(): Repos {
  const oldTurn: Turn = {
    id: 't1',
    story_id: 's1',
    author_id: 'p1',
    author_type: 'human',
    content: 'The ferry left before dawn.',
    sequence_number: 1,
    moderation_status: 'passed',
    supersedes: null,
    // 2 days ago — well past the 12h fast half-span.
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  };
  const story: Story = {
    id: 's1',
    title: 'The Glass Ferry',
    mode: 'freeform',
    elements: null,
    turn_limit: null,
    pace_preset: 'fast',
    state: 'active',
    stalled_at: null,
    pure_human: false,
    voice: {},
    summary: null,
    created_by: 'p1',
    participants: [
      { player_id: 'p1', role: 'author', joined_at: 'now' },
      { player_id: 'p2', role: 'author', joined_at: 'now' },
    ],
    current_author_id: 'p2',
    created_at: 'now',
    activated_at: 'now',
    settings_confirmed_at: null,
    completed_at: null,
  };
  return {
    players: {
      async ensureDevPlayer() {
        throw new Error('unused');
      },
      async findById() {
        return null;
      },
    },
    stories: {
      async create() {
        throw new Error('unused');
      },
      async findById(id) {
        return id === 's1' ? story : null;
      },
      async list() {
        return [story];
      },
    },
    turns: {
      async append() {
        return null;
      },
      async listByStory(id) {
        return id === 's1' ? [oldTurn] : [];
      },
    },
    async close() {},
  };
}

describe('GET /stories/:id/director-hint', () => {
  it('returns a hint for a stalled turn, then null on the second call (one per stalled turn)', async () => {
    app = await buildServer({ repos: stalledRepos() });

    const first = await app.inject({ method: 'GET', url: '/stories/s1/director-hint' });
    expect(first.statusCode).toBe(200);
    expect(typeof first.json().hint).toBe('string');
    expect(first.json().hint.length).toBeGreaterThan(0);

    const second = await app.inject({ method: 'GET', url: '/stories/s1/director-hint' });
    expect(second.json().hint).toBeNull();
  });

  it('returns null (no error) when the turn is not stalled', async () => {
    // Fresh in-memory story is in lobby with no current author → never stalled.
    app = await buildServer({ repos: createMemoryRepos() });
    const story = (await app.inject({ method: 'POST', url: '/stories' })).json();
    const res = await app.inject({ method: 'GET', url: `/stories/${story.id}/director-hint` });
    expect(res.statusCode).toBe(200);
    expect(res.json().hint).toBeNull();
  });

  it('404s on an unknown story', async () => {
    app = await buildServer({ repos: createMemoryRepos() });
    const res = await app.inject({ method: 'GET', url: '/stories/nope/director-hint' });
    expect(res.statusCode).toBe(404);
  });
});
