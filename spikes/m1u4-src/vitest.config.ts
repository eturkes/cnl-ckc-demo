import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.vite-spike-m1u4-src',
  test: { environment: 'node', include: ['spikes/m1u4-src/**/*.test.ts'] },
});
