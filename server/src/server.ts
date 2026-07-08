import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

import { createInProcessNotifier, type Notifier } from './notify.js';
import { addTurn, createStory, getStory, listStories } from './store.js';

export interface BuildOptions {
  notifier?: Notifier;
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const notifier = opts.notifier ?? createInProcessNotifier();

  await app.register(websocket);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'battleapp-server',
    version: '0.1.0',
  }));

  app.post('/stories', async (_req, reply) => {
    const story = createStory();
    reply.code(201);
    return story;
  });

  app.get('/stories', async () => ({ stories: listStories() }));

  app.get<{ Params: { id: string } }>('/stories/:id', async (req, reply) => {
    const story = getStory(req.params.id);
    if (!story) {
      reply.code(404);
      return { error: 'story_not_found' };
    }
    return story;
  });

  app.post<{ Params: { id: string }; Body: { content?: string } }>(
    '/stories/:id/turns',
    async (req, reply) => {
      const content = req.body?.content;
      if (!content || typeof content !== 'string') {
        reply.code(400);
        return { error: 'content_required' };
      }
      const turn = addTurn(req.params.id, content);
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
