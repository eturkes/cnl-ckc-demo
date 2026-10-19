// The one suite `pnpm stryker` grades, run alone: a mutant another suite kills earns it no credit.
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  // The sandbox reaches the toolchain through a `node_modules` symlink, so the default cache
  // inside it would be the primary tree's, shared with every other run.
  cacheDir: '.vite',
  // The app's `@kb` alias (`vite.config.ts`): a suite reaching `src/` imports generated assets.
  resolve: { alias: { '@kb': fileURLToPath(new URL('../../kb/generated', import.meta.url)) } },
  // `STRYKER_SUITE` grades another base-green suite alone, and `STRYKER_TESTNAME` (a name
  // pattern) one case inside it; the defaults stay u6's whole lane.
  test: {
    environment: 'node',
    include: [process.env['STRYKER_SUITE'] ?? 'tests/legacy-export-lane.test.ts'],
    ...(process.env['STRYKER_TESTNAME'] === undefined
      ? {}
      : { testNamePattern: process.env['STRYKER_TESTNAME'] }),
  },
});
