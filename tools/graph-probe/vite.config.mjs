import { fileURLToPath, URL } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

/** @param {string} path */
const here = (path) => fileURLToPath(new URL(path, import.meta.url));

// Root is this directory: `index.html` mounts the adapter, `app.html` the whole component.
// The 8 MB graph asset is served statically so the dev transform never parses it, `fs.allow`
// reaches back to `src/` — both probes mount the SHIPPED modules, never a copy — and `@kb`
// mirrors the product alias, which `SemanticGraph.svelte` resolves its default asset URL from.
export default defineConfig({
  plugins: [svelte()],
  root: here('.'),
  publicDir: here('../../kb/generated/graph'),
  cacheDir: here('../../.vite/graph-probe'),
  resolve: { alias: { '@kb': here('../../kb/generated') } },
  server: { fs: { allow: [here('../../')] } },
});
