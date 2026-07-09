import { createMemoryRepos } from './memory.js';
import { createPgRepos } from './pg.js';
import type { Repos } from './types.js';

export type { Repos } from './types.js';
export { createMemoryRepos } from './memory.js';
export { createPgRepos } from './pg.js';

/**
 * The running server's repos: Postgres when DATABASE_URL is set, in-memory otherwise.
 * (Tests inject their own — in-memory for endpoint/unit tests, pg for integration.)
 */
export function createRepos(): Repos {
  const url = process.env.DATABASE_URL;
  return url ? createPgRepos(url) : createMemoryRepos();
}
