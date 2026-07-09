import { createDb } from './client.js';
import { runMigrations } from './migrate.js';

// CLI: `npm run migrate` — applies pending migrations against DATABASE_URL.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = createDb(url);
try {
  const applied = await runMigrations(sql);
  console.log(
    applied.length > 0
      ? `Applied ${applied.length} migration(s): ${applied.join(', ')}`
      : 'No pending migrations.',
  );
} catch (err) {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
