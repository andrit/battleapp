import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

// Apply pending migrations on startup when using Postgres. Idempotent (tracked in
// schema_migrations), so it's a no-op once the schema is current. This is what keeps the
// compose stack turnkey — the production image has no tsx to run the migrate CLI.
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const sql = createDb(dbUrl);
  try {
    const applied = await runMigrations(sql);
    console.log(
      applied.length > 0
        ? `Migrations applied: ${applied.join(', ')}`
        : 'DB schema up to date.',
    );
  } finally {
    await sql.end();
  }
}

const app = await buildServer();
await app.listen({ port, host });
console.log(`battleapp-server listening on ${host}:${port}`);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    // app.close() fires the onClose hook, which closes the repos (and the DB pool).
    app.close().then(() => process.exit(0));
  });
}
