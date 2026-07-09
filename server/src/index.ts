import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildServer();
await app.listen({ port, host });
console.log(`battleapp-server listening on ${host}:${port}`);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    // app.close() fires the onClose hook, which closes the repos (and the DB pool).
    app.close().then(() => process.exit(0));
  });
}
