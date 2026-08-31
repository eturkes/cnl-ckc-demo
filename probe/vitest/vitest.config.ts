import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    include: ['live-prolog.test.ts'],
  },
});
