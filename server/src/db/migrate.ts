import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sql } from './client.js';

// server/src/db → ../../migrations = server/migrations (holds in tsx dev and in dist build,
// since tsc keeps the src→dist depth; the Dockerfile copies migrations/ into the image).
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

/**
 * Apply any not-yet-applied SQL migrations, in filename order, each in its own transaction.
 * Idempotent: already-applied files are skipped. Returns the filenames applied this run.
 */
export async function runMigrations(sql: Sql): Promise<string[]> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
  const applied = new Set(appliedRows.map((r) => r.name));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedThisRun: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const ddl = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    appliedThisRun.push(file);
  }
  return appliedThisRun;
}
