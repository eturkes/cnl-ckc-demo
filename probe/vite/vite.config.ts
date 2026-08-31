import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { assetsInlineLimit: 0, outDir: '../vite-dist', emptyOutDir: true },
  worker: { format: 'es' },
});
