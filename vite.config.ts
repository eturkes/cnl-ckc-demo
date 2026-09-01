import { fileURLToPath, URL } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

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
  // The engine worker is a module worker; the default `iife` output cannot carry it.
  worker: { format: 'es' },
  // swipl-wasm ships large .wasm/.data assets; keep them as files, never inlined.
  build: { assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
