import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

import { createInProcessNotifier, type Notifier } from './notify.js';
import { createRepos, type Repos } from './repos/index.js';
import { createAiService, type AiService } from './ai/service.js';
import { boundedViewFor, HintLedger, isTurnStalled } from './ai/director.js';
import { createRemoteOidcConfig, isProvider, verifyIdToken, type OidcConfig } from './auth/oidc.js';
import {
  createRefreshToken,
  hashRefreshToken,
  issueAccessToken,
  verifyAccessToken,
} from './auth/tokens.js';
import type { Player } from './domain/types.js';

export interface BuildOptions {
  notifier?: Notifier;
  repos?: Repos;
  ai?: AiService;
  /** OIDC verification config; defaults to the remote (Apple/Google) JWKS. Tests inject a local one. */
  oidc?: OidcConfig;
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const notifier = opts.notifier ?? createInProcessNotifier();
  const repos = opts.repos ?? createRepos();
  const ai = opts.ai ?? (await createAiService());
  const oidc = opts.oidc ?? createRemoteOidcConfig();
  const hintLedger = new HintLedger();

  // Resolve the authed Player from a Bearer access token; null if absent/invalid.
  const authedPlayer = async (authHeader: string | undefined): Promise<Player | null> => {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      return await repos.players.findById(await verifyAccessToken(authHeader.slice(7)));
    } catch {
      return null;
    }
  };

  // Issue our session (access + refresh) for a player. Shared by every sign-in path.
  const issueSession = async (player: Player) => {
    const refresh = createRefreshToken();
    await repos.auth.storeRefreshToken(refresh.hash, player.id, refresh.expiresAt);
    return { access_token: await issueAccessToken(player.id), refresh_token: refresh.token, player };
  };

  // Dev-account sign-in is available outside production only.
  const devAuthAllowed = process.env.NODE_ENV !== 'production';

  app.addHook('onClose', async () => {
    await repos.close();
  });

  await app.register(websocket);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'battleapp-server',
    version: '0.1.0',
  }));

  app.post('/stories', async (req, reply) => {
    const creator = await authedPlayer(req.headers.authorization);
    if (!creator) {
      reply.code(401);
      return { error: 'unauthorized' };
    }
    const story = await repos.stories.create(creator.id);
    reply.code(201);
    return story;
  });

  // POST /auth/oidc — verify a provider id_token, upsert the player, issue our access + refresh.
  app.post<{ Body: { provider?: string; id_token?: string } }>(
    '/auth/oidc',
    async (req, reply) => {
      const { provider, id_token } = req.body ?? {};
      if (!isProvider(provider) || typeof id_token !== 'string') {
        reply.code(400);
        return { error: 'invalid_request' };
      }
      let claims;
      try {
        claims = await verifyIdToken(provider, id_token, oidc);
      } catch (err) {
        // Log the real reason (aud mismatch, expired, JWKS unreachable) — the client only sees a 401.
        req.log.warn({ err, provider }, 'oidc id_token verification failed');
        reply.code(401);
        return { error: 'invalid_id_token' };
      }
      const player = await repos.auth.findOrCreatePlayer(claims.provider, claims.subject);
      reply.code(201);
      return issueSession(player);
    },
  );

  // POST /auth/dev — dev-only: sign in as a stable named test account (Alice/Bob) with real tokens.
  // Lets two devices act as two different players (retires the no-auth /me bootstrap). Not in prod.
  app.post<{ Body: { name?: string } }>('/auth/dev', async (req, reply) => {
    if (!devAuthAllowed) {
      reply.code(404);
      return { error: 'not_found' };
    }
    const name = req.body?.name?.trim();
    if (!name || !/^[a-z0-9_]{2,20}$/i.test(name)) {
      reply.code(400);
      return { error: 'invalid_name' };
    }
    let player = await repos.auth.findOrCreatePlayer('dev', name);
    // Give the account a friendly handle (the name) on first creation.
    if (/^player_[0-9a-f]{8}$/.test(player.display_name)) {
      const named = await repos.players.updateDisplayName(player.id, name);
      if (named !== 'taken') player = named;
    }
    reply.code(201);
    return issueSession(player);
  });

  // POST /auth/refresh — single-use rotation: validate the refresh token, issue a new pair.
  app.post<{ Body: { refresh_token?: string } }>('/auth/refresh', async (req, reply) => {
    const token = req.body?.refresh_token;
    if (typeof token !== 'string') {
      reply.code(400);
      return { error: 'invalid_request' };
    }
    const hash = hashRefreshToken(token);
    const found = await repos.auth.findRefreshToken(hash);
    if (!found || Date.parse(found.expiresAt) <= Date.now()) {
      if (found) await repos.auth.deleteRefreshToken(hash); // reap expired
      reply.code(401);
      return { error: 'invalid_refresh_token' };
    }
    await repos.auth.deleteRefreshToken(hash); // rotate: the presented token is now spent
    const refresh = createRefreshToken();
    await repos.auth.storeRefreshToken(refresh.hash, found.playerId, refresh.expiresAt);
    return { access_token: await issueAccessToken(found.playerId), refresh_token: refresh.token };
  });

  // POST /auth/signout — revoke a refresh token (idempotent).
  app.post<{ Body: { refresh_token?: string } }>('/auth/signout', async (req, reply) => {
    const token = req.body?.refresh_token;
    if (typeof token === 'string') await repos.auth.deleteRefreshToken(hashRefreshToken(token));
    reply.code(204);
    return null;
  });

  // GET /me — the authenticated player (the client always signs in now; no dev fallback).
  app.get('/me', async (req, reply) => {
    const player = await authedPlayer(req.headers.authorization);
    if (!player) {
      reply.code(401);
      return { error: 'unauthorized' };
    }
    return player;
  });

  // PATCH /me — first-run handle pick: set the authed player's unique display name.
  app.patch<{ Body: { display_name?: string } }>('/me', async (req, reply) => {
    const player = await authedPlayer(req.headers.authorization);
    if (!player) {
      reply.code(401);
      return { error: 'unauthorized' };
    }
    const name = req.body?.display_name?.trim();
    if (!name || name.length < 1 || name.length > 40) {
      reply.code(400);
      return { error: 'invalid_display_name' };
    }
    const result = await repos.players.updateDisplayName(player.id, name);
    if (result === 'taken') {
      reply.code(409);
      return { error: 'display_name_taken' };
    }
    return result;
  });

  app.get('/stories', async () => ({ stories: await repos.stories.list() }));

  app.get<{ Params: { id: string } }>('/stories/:id', async (req, reply) => {
    const story = await repos.stories.findById(req.params.id);
    if (!story) {
      reply.code(404);
      return { error: 'story_not_found' };
    }
    const turns = await repos.turns.listByStory(story.id);
    return { ...story, turns };
  });

  app.post<{ Params: { id: string }; Body: { content?: string } }>(
    '/stories/:id/turns',
    async (req, reply) => {
      const content = req.body?.content;
      if (typeof content !== 'string' || content.length < 1 || content.length > 500) {
        reply.code(400);
        return { error: 'content_invalid' };
      }
      const author = await authedPlayer(req.headers.authorization);
      if (!author) {
        reply.code(401);
        return { error: 'unauthorized' };
      }
      // Moderation hook (ai-service-layer §4.1): every SubmitTurn is screened before storage.
      // Fail-closed — only passed content becomes a Turn; a moderation failure never stores.
      let verdict;
      try {
        verdict = await ai.moderateTurn(content);
      } catch {
        reply.code(502);
        return { error: 'moderation_unavailable' };
      }
      if (verdict.verdict === 'reject') {
        reply.code(422);
        return { error: 'moderation_rejected', reason: verdict.reason };
      }
      const turn = await repos.turns.append(req.params.id, author.id, content);
      if (!turn) {
        reply.code(404);
        return { error: 'story_not_found' };
      }
      // Activate the story and hand the turn to the OTHER participant (alternation). With a single
      // participant (solo dev testing) it stays the author's turn so the loop still continues.
      const story = await repos.stories.findById(req.params.id);
      const other = story?.participants.find((p) => p.player_id !== author.id);
      await repos.stories.setActiveAuthor(req.params.id, other?.player_id ?? author.id);
      notifier.publish(req.params.id, { type: 'TurnAdded', payload: turn });
      reply.code(201);
      return turn;
    },
  );

  // POST /stories/:id/join — the authed player joins a story as its second author (dev stand-in for
  // real invites, which arrive in a later phase). This is what makes the two-player loop testable.
  app.post<{ Params: { id: string } }>('/stories/:id/join', async (req, reply) => {
    const player = await authedPlayer(req.headers.authorization);
    if (!player) {
      reply.code(401);
      return { error: 'unauthorized' };
    }
    const result = await repos.stories.addParticipant(req.params.id, player.id);
    if (result === 'not_found') {
      reply.code(404);
      return { error: 'story_not_found' };
    }
    if (result === 'full') {
      reply.code(409);
      return { error: 'story_full' };
    }
    return result;
  });

  // Director hint (ai-service-layer §4.2): stall-gated, ≤1 per stalled turn, silent otherwise.
  // Always 200 with `{ hint: null }` when no hint applies — a missing hint is never an error.
  app.get<{ Params: { id: string } }>('/stories/:id/director-hint', async (req, reply) => {
    const story = await repos.stories.findById(req.params.id);
    if (!story) {
      reply.code(404);
      return { error: 'story_not_found' };
    }
    const turns = await repos.turns.listByStory(story.id);
    // Not stalled (someone's still within their span, or the story isn't active) → nothing to say.
    if (!isTurnStalled(story, turns, Date.now())) return { hint: null };
    // One hint per stalled turn: the turn index is the ledger key.
    if (hintLedger.wasServed(story.id, turns.length)) return { hint: null };

    let hint = null;
    try {
      hint = await ai.directorHint(boundedViewFor(story, turns));
    } catch {
      // Silent skip (ai-director-spec §6): the escalation ladder continues unaffected.
      return { hint: null };
    }
    if (hint) hintLedger.markServed(story.id, turns.length);
    return { hint: hint?.hint ?? null };
  });

  app.get<{ Params: { id: string } }>('/ws/stories/:id', { websocket: true }, (socket, req) => {
    const { id } = req.params;
    const unsubscribe = notifier.subscribe(id, (event) => {
      socket.send(JSON.stringify(event));
    });
    socket.on('message', (raw: Buffer) => {
      // Phase 1 echo stub — proves the socket path; real events replace this in Phase 6.
      socket.send(JSON.stringify({ type: 'Echo', payload: raw.toString() }));
    });
    socket.on('close', unsubscribe);
  });

  return app;
}
