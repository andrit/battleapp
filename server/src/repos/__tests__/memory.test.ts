import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryRepos } from '../memory.js';
import type { Repos } from '../types.js';

let repos: Repos;
beforeEach(() => {
  repos = createMemoryRepos();
});

describe('in-memory repos', () => {
  it('ensureDevPlayer is stable across calls', async () => {
    const a = await repos.players.ensureDevPlayer();
    const b = await repos.players.ensureDevPlayer();
    expect(a.id).toBe(b.id);
    expect(a.display_name).toBe('dev');
  });

  it('creates a settings-free lobby story with the creator as participant', async () => {
    const dev = await repos.players.ensureDevPlayer();
    const s = await repos.stories.create(dev.id);
    expect(s.state).toBe('lobby');
    expect(s.turn_limit).toBeNull();
    expect(s.pace_preset).toBeNull();
    expect(s.settings_confirmed_at).toBeNull();
    expect(s.created_by).toBe(dev.id);
    expect(s.participants).toEqual([
      expect.objectContaining({ player_id: dev.id, role: 'author' }),
    ]);
  });

  it('appends turns with contiguous sequence numbers', async () => {
    const dev = await repos.players.ensureDevPlayer();
    const s = await repos.stories.create(dev.id);
    const t1 = await repos.turns.append(s.id, dev.id, 'One.');
    const t2 = await repos.turns.append(s.id, dev.id, 'Two.');
    expect(t1?.sequence_number).toBe(1);
    expect(t2?.sequence_number).toBe(2);
    expect(await repos.turns.listByStory(s.id)).toHaveLength(2);
  });

  it('append returns null for a missing story', async () => {
    const dev = await repos.players.ensureDevPlayer();
    expect(await repos.turns.append('nope', dev.id, 'x')).toBeNull();
  });
});
