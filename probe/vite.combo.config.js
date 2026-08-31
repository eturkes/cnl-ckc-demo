import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'combo-dist',
    emptyOutDir: true,
    rollupOptions: { input: 'combo-index.html' },
  },
});
