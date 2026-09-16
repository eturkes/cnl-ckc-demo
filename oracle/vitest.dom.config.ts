import { fileURLToPath, URL } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte()],
  cacheDir: '.scratch/orc-view-vite-dom',
  resolve: {
    alias: { '@kb': fileURLToPath(new URL('../kb/generated', import.meta.url)) },
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['oracle/**/*.dom.test.ts'],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
