// The one suite `pnpm stryker` grades, run alone: a mutant another suite kills earns it no credit.
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  // The sandbox reaches the toolchain through a `node_modules` symlink, so the default cache
  // inside it would be the primary tree's, shared with every other run.
  cacheDir: '.vite',
  test: { environment: 'node', include: ['tests/legacy-export-lane.test.ts'] },
});
