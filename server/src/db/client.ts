import postgres, { type Sql } from 'postgres';

/**
 * Create a Postgres client from a connection URL.
 * Production/host-dev: DATABASE_URL (the compose game-db). Tests: TEST_DATABASE_URL.
 */
export function createDb(url: string): Sql {
  return postgres(url, { onnotice: () => {} });
}

export type { Sql };
