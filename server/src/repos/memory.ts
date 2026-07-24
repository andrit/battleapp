import { randomUUID } from 'node:crypto';

import type { Player, Story, Turn } from '../domain/types.js';
import type { AuthRepo, PlayerRepo, Repos, StoryRepo, TurnRepo } from './types.js';

const now = (): string => new Date().toISOString();

/** A generated, unique-enough placeholder handle; the user renames it at first sign-in (Task 3). */
const genDisplayName = (): string => `player_${randomUUID().slice(0, 8)}`;

class MemoryPlayerRepo implements PlayerRepo {
  private byId = new Map<string, Player>();
  private devId: string | null = null;

  async ensureDevPlayer(): Promise<Player> {
    if (this.devId) return this.byId.get(this.devId)!;
    const player: Player = {
      id: randomUUID(),
      display_name: 'dev',
      avatar: null,
      stats: { stories_played: 0, stories_completed: 0 },
      created_at: now(),
    };
    this.byId.set(player.id, player);
    this.devId = player.id;
    return player;
  }

  async findById(id: string): Promise<Player | null> {
    return this.byId.get(id) ?? null;
  }

  /** Create + store a Player (used by the auth repo when a new OIDC identity signs in). */
  create(displayName: string): Player {
    const player: Player = {
      id: randomUUID(),
      display_name: displayName,
      avatar: null,
      stats: { stories_played: 0, stories_completed: 0 },
      created_at: now(),
    };
    this.byId.set(player.id, player);
    return player;
  }
}

class MemoryAuthRepo implements AuthRepo {
  private identities = new Map<string, string>(); // `${provider}:${subject}` → playerId
  private refresh = new Map<string, { playerId: string; expiresAt: string }>();

  constructor(private readonly players: MemoryPlayerRepo) {}

  private key(provider: string, subject: string): string {
    return `${provider}:${subject}`;
  }

  async findOrCreatePlayer(provider: string, subject: string): Promise<Player> {
    const existing = this.identities.get(this.key(provider, subject));
    if (existing) {
      const player = await this.players.findById(existing);
      if (player) return player;
    }
    const player = this.players.create(genDisplayName());
    this.identities.set(this.key(provider, subject), player.id);
    return player;
  }

  async storeRefreshToken(hash: string, playerId: string, expiresAt: string): Promise<void> {
    this.refresh.set(hash, { playerId, expiresAt });
  }

  async findRefreshToken(hash: string): Promise<{ playerId: string; expiresAt: string } | null> {
    return this.refresh.get(hash) ?? null;
  }

  async deleteRefreshToken(hash: string): Promise<void> {
    this.refresh.delete(hash);
  }
}

class MemoryStoryRepo implements StoryRepo {
  private byId = new Map<string, Story>();

  async create(createdBy: string): Promise<Story> {
    const story: Story = {
      id: randomUUID(),
      title: null,
      mode: 'freeform',
      elements: null,
      turn_limit: null, // set at the Settings Handshake (Phase 4)
      pace_preset: null,
      state: 'lobby',
      stalled_at: null,
      pure_human: false,
      voice: {},
      summary: null,
      created_by: createdBy,
      participants: [{ player_id: createdBy, role: 'author', joined_at: now() }],
      current_author_id: null,
      created_at: now(),
      activated_at: null,
      settings_confirmed_at: null,
      completed_at: null,
    };
    this.byId.set(story.id, story);
    return story;
  }

  async findById(id: string): Promise<Story | null> {
    return this.byId.get(id) ?? null;
  }

  async list(): Promise<Story[]> {
    return [...this.byId.values()];
  }

  async setActiveAuthor(storyId: string, authorId: string): Promise<void> {
    const story = this.byId.get(storyId);
    if (!story) return;
    story.state = 'active';
    story.activated_at ??= now();
    story.current_author_id = authorId;
  }
}

class MemoryTurnRepo implements TurnRepo {
  private byStory = new Map<string, Turn[]>();

  constructor(private readonly stories: MemoryStoryRepo) {}

  async append(storyId: string, authorId: string, content: string): Promise<Turn | null> {
    if (!(await this.stories.findById(storyId))) return null;
    const list = this.byStory.get(storyId) ?? [];
    const turn: Turn = {
      id: randomUUID(),
      story_id: storyId,
      author_id: authorId,
      author_type: 'human',
      content,
      sequence_number: list.length + 1,
      moderation_status: 'passed',
      supersedes: null,
      created_at: now(),
    };
    list.push(turn);
    this.byStory.set(storyId, list);
    return turn;
  }

  async listByStory(storyId: string): Promise<Turn[]> {
    return [...(this.byStory.get(storyId) ?? [])];
  }
}

export function createMemoryRepos(): Repos {
  const players = new MemoryPlayerRepo();
  const stories = new MemoryStoryRepo();
  const turns = new MemoryTurnRepo(stories);
  const auth = new MemoryAuthRepo(players);
  return {
    players,
    stories,
    turns,
    auth,
    async close() {},
  };
}
