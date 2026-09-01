import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte()],
  cacheDir: '.vite',
  // swipl-wasm ships large .wasm/.data assets; keep them as files, never inlined.
  build: { assetsInlineLimit: 0 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
  },
});
