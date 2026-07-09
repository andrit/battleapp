import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Sql } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { createPgRepos } from '../pg.js';
import type { Repos } from '../types.js';

const TEST_URL = process.env.TEST_DATABASE_URL;
const suite = TEST_URL ? describe : describe.skip;

suite('pg repos (real Postgres)', () => {
  let sql: Sql;
  let repos: Repos;

  beforeAll(async () => {
    sql = createDb(TEST_URL as string);
    await runMigrations(sql);
    repos = createPgRepos(TEST_URL as string);
  });

  afterEach(async () => {
    await sql`TRUNCATE players, stories, participants, turns, reactions, invites, reports, blocks CASCADE`;
  });

  afterAll(async () => {
    await repos.close();
    await sql.end();
  });

  it('ensureDevPlayer is idempotent (one dev row)', async () => {
    const a = await repos.players.ensureDevPlayer();
    const b = await repos.players.ensureDevPlayer();
    expect(a.id).toBe(b.id);
    const [{ n }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM players`;
    expect(n).toBe(1);
  });

  it('persists a settings-free lobby story with the creator as participant', async () => {
    const dev = await repos.players.ensureDevPlayer();
    const s = await repos.stories.create(dev.id);
    expect(s.state).toBe('lobby');
    expect(s.turn_limit).toBeNull();
    expect(s.pace_preset).toBeNull();
    expect(s.settings_confirmed_at).toBeNull();
    expect(s.voice).toEqual({});
    expect(s.participants).toEqual([
      expect.objectContaining({ player_id: dev.id, role: 'author' }),
    ]);
    // timestamps mapped to ISO strings, not Date objects
    expect(typeof s.created_at).toBe('string');

    const reloaded = await repos.stories.findById(s.id);
    expect(reloaded?.id).toBe(s.id);
  });

  it('appends turns with contiguous sequence numbers and reads them back', async () => {
    const dev = await repos.players.ensureDevPlayer();
    const s = await repos.stories.create(dev.id);
    const t1 = await repos.turns.append(s.id, dev.id, 'First line.');
    const t2 = await repos.turns.append(s.id, dev.id, 'Second line.');
    expect(t1?.sequence_number).toBe(1);
    expect(t2?.sequence_number).toBe(2);
    const turns = await repos.turns.listByStory(s.id);
    expect(turns.map((t) => t.content)).toEqual(['First line.', 'Second line.']);
  });

  it('returns null / not-found for missing or non-uuid ids (no 500)', async () => {
    const dev = await repos.players.ensureDevPlayer();
    expect(await repos.stories.findById('not-a-uuid')).toBeNull();
    expect(await repos.turns.append('not-a-uuid', dev.id, 'x')).toBeNull();
    expect(await repos.turns.listByStory('not-a-uuid')).toEqual([]);
    // valid uuid, but no such story
    expect(await repos.turns.append('00000000-0000-0000-0000-000000000000', dev.id, 'x')).toBeNull();
  });

  it('lists stories newest-first with participants populated', async () => {
    const dev = await repos.players.ensureDevPlayer();
    await repos.stories.create(dev.id);
    await repos.stories.create(dev.id);
    const list = await repos.stories.list();
    expect(list).toHaveLength(2);
    expect(list[0].participants).toHaveLength(1);
  });
});
