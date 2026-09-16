import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.scratch/orc-view-vite',
  test: {
    environment: 'node',
    include: ['oracle/**/*.test.ts'],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
