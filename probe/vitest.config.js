import { fileURLToPath, URL } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: ROOT,
  plugins: [svelte()],
  cacheDir: '.scratch/vite-review',
  resolve: {
    alias: { '@kb': fileURLToPath(new URL('../kb/generated', import.meta.url)) },
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['probe/**/*.dom.test.js'],
  },
});
