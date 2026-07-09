import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

import { createInProcessNotifier, type Notifier } from './notify.js';
import { createRepos, type Repos } from './repos/index.js';

export interface BuildOptions {
  notifier?: Notifier;
  repos?: Repos;
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const notifier = opts.notifier ?? createInProcessNotifier();
  const repos = opts.repos ?? createRepos();

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
