import { randomUUID } from 'node:crypto';

import type { Participant, Player, Story, Turn } from '../domain/types.js';
import { createDb, type Sql } from '../db/client.js';
import type { AuthRepo, PlayerRepo, Repos, StoryRepo, TurnRepo } from './types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string): boolean => UUID_RE.test(s);

/** A generated, unique-enough placeholder handle; the user renames it at first sign-in (Task 3). */
const genDisplayName = (): string => `player_${randomUUID().slice(0, 8)}`;

// timestamptz comes back from the driver as a Date; the domain uses ISO strings.
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const isoReq = (d: Date): string => d.toISOString();

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapParticipant(r: any): Participant {
  return { player_id: r.player_id, role: r.role, joined_at: isoReq(r.joined_at) };
}

function mapPlayer(r: any): Player {
  return {
    id: r.id,
    display_name: r.display_name,
    avatar: r.avatar,
    stats: { stories_played: r.stats_stories_played, stories_completed: r.stats_stories_completed },
    created_at: isoReq(r.created_at),
  };
}

function mapStory(r: any, participants: Participant[]): Story {
  return {
    id: r.id,
    title: r.title,
    mode: r.mode,
    elements: r.elements,
    turn_limit: r.turn_limit,
    pace_preset: r.pace_preset,
    state: r.state,
    stalled_at: iso(r.stalled_at),
    pure_human: r.pure_human,
    voice: r.voice,
    summary: r.summary,
    created_by: r.created_by,
    participants,
    current_author_id: r.current_author_id,
    created_at: isoReq(r.created_at),
    activated_at: iso(r.activated_at),
    settings_confirmed_at: iso(r.settings_confirmed_at),
    completed_at: iso(r.completed_at),
  };
}

function mapTurn(r: any): Turn {
  return {
    id: r.id,
    story_id: r.story_id,
    author_id: r.author_id,
    author_type: r.author_type,
    content: r.content,
    sequence_number: r.sequence_number,
    moderation_status: r.moderation_status,
    supersedes: r.supersedes,
    created_at: isoReq(r.created_at),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

class PgPlayerRepo implements PlayerRepo {
  constructor(private readonly sql: Sql) {}

  async ensureDevPlayer(): Promise<Player> {
    // Idempotent bootstrap: one row with the reserved 'dev' display_name.
    const [row] = await this.sql`
      INSERT INTO players (display_name) VALUES ('dev')
      ON CONFLICT (display_name) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING *`;
    return mapPlayer(row);
  }

  async findById(id: string): Promise<Player | null> {
    if (!isUuid(id)) return null;
    const [row] = await this.sql`SELECT * FROM players WHERE id = ${id}`;
    return row ? mapPlayer(row) : null;
  }
}

class PgStoryRepo implements StoryRepo {
  constructor(private readonly sql: Sql) {}

  private async participantsFor(storyId: string): Promise<Participant[]> {
    const rows = await this.sql`
      SELECT player_id, role, joined_at FROM participants
      WHERE story_id = ${storyId} ORDER BY joined_at`;
    return rows.map(mapParticipant);
  }

  async create(createdBy: string): Promise<Story> {
    const id = await this.sql.begin(async (tx) => {
      const [row] = await tx`INSERT INTO stories (created_by) VALUES (${createdBy}) RETURNING id`;
      await tx`
        INSERT INTO participants (story_id, player_id, role)
        VALUES (${row.id}, ${createdBy}, 'author')`;
      return row.id as string;
    });
    const created = await this.findById(id);
    if (!created) throw new Error('story vanished immediately after create'); // unreachable
    return created;
  }

  async findById(id: string): Promise<Story | null> {
    if (!isUuid(id)) return null;
    const [row] = await this.sql`SELECT * FROM stories WHERE id = ${id}`;
    if (!row) return null;
    return mapStory(row, await this.participantsFor(id));
  }

  async list(): Promise<Story[]> {
    const rows = await this.sql`SELECT * FROM stories ORDER BY created_at DESC`;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id as string);
    const parts = await this.sql`
      SELECT story_id, player_id, role, joined_at FROM participants
      WHERE story_id IN ${this.sql(ids)} ORDER BY joined_at`;
    const byStory = new Map<string, Participant[]>();
    for (const p of parts) {
      const list = byStory.get(p.story_id) ?? [];
      list.push(mapParticipant(p));
      byStory.set(p.story_id, list);
    }
    return rows.map((r) => mapStory(r, byStory.get(r.id) ?? []));
  }

  async setActiveAuthor(storyId: string, authorId: string): Promise<void> {
    if (!isUuid(storyId)) return;
    await this.sql`
      UPDATE stories
      SET state = 'active',
          activated_at = COALESCE(activated_at, now()),
          current_author_id = ${authorId}
      WHERE id = ${storyId}`;
  }
}

class PgTurnRepo implements TurnRepo {
  constructor(private readonly sql: Sql) {}

  async append(storyId: string, authorId: string, content: string): Promise<Turn | null> {
    if (!isUuid(storyId)) return null;
    const [exists] = await this.sql`SELECT 1 FROM stories WHERE id = ${storyId}`;
    if (!exists) return null;
    // ponytail: sequence_number via MAX+1 can race under concurrent appends to one story; the
    // UNIQUE(story_id, sequence_number) constraint is the backstop. ceiling: real concurrency.
    // upgrade: retry-on-unique-violation or a per-story advisory lock. Fine for V1 (alternating).
    const [row] = await this.sql`
      INSERT INTO turns (story_id, author_id, author_type, content, sequence_number)
      VALUES (${storyId}, ${authorId}, 'human', ${content},
        (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM turns WHERE story_id = ${storyId}))
      RETURNING *`;
    return mapTurn(row);
  }

  async listByStory(storyId: string): Promise<Turn[]> {
    if (!isUuid(storyId)) return [];
    const rows = await this.sql`
      SELECT * FROM turns WHERE story_id = ${storyId} ORDER BY sequence_number`;
    return rows.map(mapTurn);
  }
}

class PgAuthRepo implements AuthRepo {
  constructor(private readonly sql: Sql) {}

  async findOrCreatePlayer(provider: string, subject: string): Promise<Player> {
    const [existing] = await this.sql`
      SELECT p.* FROM auth_identities i
      JOIN players p ON p.id = i.player_id
      WHERE i.provider = ${provider} AND i.subject = ${subject}`;
    if (existing) return mapPlayer(existing);
    return this.sql.begin(async (tx) => {
      const [player] = await tx`
        INSERT INTO players (display_name) VALUES (${genDisplayName()}) RETURNING *`;
      await tx`
        INSERT INTO auth_identities (provider, subject, player_id)
        VALUES (${provider}, ${subject}, ${player.id})`;
      return mapPlayer(player);
    });
  }

  async storeRefreshToken(hash: string, playerId: string, expiresAt: string): Promise<void> {
    await this.sql`
      INSERT INTO refresh_tokens (token_hash, player_id, expires_at)
      VALUES (${hash}, ${playerId}, ${expiresAt})`;
  }

  async findRefreshToken(hash: string): Promise<{ playerId: string; expiresAt: string } | null> {
    const [row] = await this.sql`
      SELECT player_id, expires_at FROM refresh_tokens WHERE token_hash = ${hash}`;
    return row ? { playerId: row.player_id, expiresAt: isoReq(row.expires_at) } : null;
  }

  async deleteRefreshToken(hash: string): Promise<void> {
    await this.sql`DELETE FROM refresh_tokens WHERE token_hash = ${hash}`;
  }
}

export function createPgRepos(url: string): Repos {
  const sql = createDb(url);
  return {
    players: new PgPlayerRepo(sql),
    stories: new PgStoryRepo(sql),
    turns: new PgTurnRepo(sql),
    auth: new PgAuthRepo(sql),
    async close() {
      await sql.end();
    },
  };
}
