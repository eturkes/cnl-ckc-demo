import { fileURLToPath, URL } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// `wrangler.jsonc` `dev.port`.
const INTAKE_PROXY = 'http://127.0.0.1:8791';

export default defineConfig({
  plugins: [svelte()],
  // Relative base keeps the built demo working under a nested static path.
  base: './',
  // Worktrees reach the toolchain through a `node_modules` symlink, so the default
  // `node_modules/.vite` cache is one shared directory across every tree. Resolving
  // it against the project root instead keeps concurrent builds from racing.
  cacheDir: '.vite',
  resolve: {
    // The runtime payload is generated and gitignored; the alias is how source
    // reaches it without naming a path into `kb/`.
    alias: { '@kb': fileURLToPath(new URL('./kb/generated', import.meta.url)) },
  },
  // Free-text intake posts same-origin; both servers hand it to the local judgment proxy
  // (`pnpm intake:dev`), so the page's `connect-src 'self'` holds.
  server: { proxy: { '/api/judgment': INTAKE_PROXY } },
  preview: { proxy: { '/api/judgment': INTAKE_PROXY } },
  // The engine worker is a module worker; the default `iife` output cannot carry it.
  worker: { format: 'es' },
  // swipl-wasm ships large .wasm/.data assets; keep them as files, never inlined.
  build: { assetsInlineLimit: 0 },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.dom.test.ts'],
        },
      },
      {
        extends: true,
        // Svelte's exports resolve to the SSR build unless `browser` is asked for,
        // and `mount` throws there. Scoping the condition to this project keeps the
        // node suite on swipl-wasm's node entry.
        resolve: { conditions: ['browser'] },
        test: { name: 'dom', environment: 'jsdom', include: ['tests/**/*.dom.test.ts'] },
      },
    ],
  },
});
