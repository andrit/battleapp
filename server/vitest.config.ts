import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Keep AI calls offline: unset ANTHROPIC_API_KEY before any test module loads (see the file).
    setupFiles: ['./vitest.setup.ts'],
    // DB-backed test files share one Postgres (battleapp_dev) and TRUNCATE between tests, so
    // running files in parallel lets one file's cleanup wipe another's rows mid-test. The suite
    // is tiny — serialize files for deterministic DB isolation. (Tests within a file already run
    // sequentially.) A production DB is never truncated, so this is a test-only concern.
    fileParallelism: false,
  },
});
