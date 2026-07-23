import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

import { createInProcessNotifier, type Notifier } from './notify.js';
import { createRepos, type Repos } from './repos/index.js';
import { createAiService, type AiService } from './ai/service.js';
import { boundedViewFor, HintLedger, isTurnStalled } from './ai/director.js';

export interface BuildOptions {
  notifier?: Notifier;
  repos?: Repos;
  ai?: AiService;
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const notifier = opts.notifier ?? createInProcessNotifier();
  const repos = opts.repos ?? createRepos();
  const ai = opts.ai ?? (await createAiService());
  const hintLedger = new HintLedger();

  app.addHook('onClose', async () => {
    await repos.close();
  });

  await app.register(websocket);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'battleapp-server',
    version: '0.1.0',
  }));

  app.post('/stories', async (_req, reply) => {
    // ponytail: creator is the dev bootstrap player until auth (Phase 4).
    const creator = await repos.players.ensureDevPlayer();
    const story = await repos.stories.create(creator.id);
    reply.code(201);
    return story;
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
      // ponytail: author is the dev bootstrap player until auth (Phase 4).
      const author = await repos.players.ensureDevPlayer();
      const turn = await repos.turns.append(req.params.id, author.id, content);
      if (!turn) {
        reply.code(404);
        return { error: 'story_not_found' };
      }
      notifier.publish(req.params.id, { type: 'TurnAdded', payload: turn });
      reply.code(201);
      return turn;
    },
  );

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
