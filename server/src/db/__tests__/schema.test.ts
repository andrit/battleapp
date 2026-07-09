import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Sql } from '../client.js';
import { runMigrations } from '../migrate.js';

const TEST_URL = process.env.TEST_DATABASE_URL;

// Constraint tests need a real Postgres. Locally: TEST_DATABASE_URL → workbench pg / battleapp_dev.
// CI: a postgres:16 service provides it. Absent → skip (keeps the suite green with no DB).
const suite = TEST_URL ? describe : describe.skip;

suite('schema constraints (real Postgres)', () => {
  let sql: Sql;

  beforeAll(async () => {
    sql = createDb(TEST_URL as string);
    await runMigrations(sql);
  });

  afterEach(async () => {
    await sql`TRUNCATE players, stories, participants, turns, reactions, invites, reports, blocks CASCADE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  const newPlayer = async (name: string): Promise<string> => {
    const [p] = await sql<{ id: string }[]>`
      INSERT INTO players (display_name) VALUES (${name}) RETURNING id`;
    return p.id;
  };
  const newStory = async (createdBy: string) => {
    const [s] = await sql`INSERT INTO stories (created_by) VALUES (${createdBy}) RETURNING *`;
    return s;
  };
  const newTurn = async (storyId: string, authorId: string, seq: number, content = 'A line.') => {
    const [t] = await sql<{ id: string }[]>`
      INSERT INTO turns (story_id, author_id, author_type, content, sequence_number)
      VALUES (${storyId}, ${authorId}, 'human', ${content}, ${seq}) RETURNING id`;
    return t.id;
  };

  it('runMigrations is idempotent (second run applies nothing)', async () => {
    expect(await runMigrations(sql)).toEqual([]);
  });

  it('StartStory persists a settings-free lobby story', async () => {
    const p = await newPlayer('creator');
    const s = await newStory(p);
    expect(s.state).toBe('lobby');
    expect(s.turn_limit).toBeNull();
    expect(s.pace_preset).toBeNull();
    expect(s.settings_confirmed_at).toBeNull();
    expect(s.pure_human).toBe(false);
    expect(s.voice).toEqual({}); // open dial-map defaults empty
    expect(s.mode).toBe('freeform');
  });

  it('rejects a duplicate (story_id, sequence_number)', async () => {
    const p = await newPlayer('p1');
    const s = await newStory(p);
    await newTurn(s.id, p, 1);
    await expect(newTurn(s.id, p, 1)).rejects.toThrow(); // same position, same story
  });

  it('rejects a duplicate reaction (turn_id, user_id)', async () => {
    const p = await newPlayer('p2');
    const s = await newStory(p);
    const t = await newTurn(s.id, p, 1);
    await sql`INSERT INTO reactions (turn_id, user_id) VALUES (${t}, ${p})`;
    await expect(
      sql`INSERT INTO reactions (turn_id, user_id) VALUES (${t}, ${p})`,
    ).rejects.toThrow();
  });

  it('rejects an invalid story state', async () => {
    const p = await newPlayer('p3');
    await expect(
      sql`INSERT INTO stories (created_by, state) VALUES (${p}, 'bogus')`,
    ).rejects.toThrow();
  });

  it('enforces Turn content length 1..500', async () => {
    const p = await newPlayer('p4');
    const s = await newStory(p);
    await expect(newTurn(s.id, p, 1, '')).rejects.toThrow(); // too short
    await expect(newTurn(s.id, p, 2, 'x'.repeat(501))).rejects.toThrow(); // too long
    await expect(newTurn(s.id, p, 3, 'x'.repeat(500))).resolves.toBeTruthy(); // boundary OK
  });

  it('rejects a Turn referencing a nonexistent Story (FK)', async () => {
    const p = await newPlayer('p5');
    await expect(
      sql`INSERT INTO turns (story_id, author_id, author_type, content, sequence_number)
          VALUES (gen_random_uuid(), ${p}, 'human', 'orphan', 1)`,
    ).rejects.toThrow();
  });

  it('rejects a self-block and duplicate blocks', async () => {
    const a = await newPlayer('a');
    const b = await newPlayer('b');
    await expect(
      sql`INSERT INTO blocks (blocker_id, blocked_id) VALUES (${a}, ${a})`,
    ).rejects.toThrow(); // self-block
    await sql`INSERT INTO blocks (blocker_id, blocked_id) VALUES (${a}, ${b})`;
    await expect(
      sql`INSERT INTO blocks (blocker_id, blocked_id) VALUES (${a}, ${b})`,
    ).rejects.toThrow(); // duplicate
  });
});
