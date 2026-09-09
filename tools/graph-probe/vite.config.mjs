import { defineConfig } from 'vite';

// Root is this directory. The 8 MB graph asset is served statically so the dev transform
// never parses it, and `fs.allow` reaches back to `src/graph/` — the probe mounts the SHIPPED
// adapter, never a copy of it.
export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  publicDir: new URL('../../kb/generated/graph', import.meta.url).pathname,
  cacheDir: new URL('../../.vite/graph-probe', import.meta.url).pathname,
  server: { fs: { allow: [new URL('../../', import.meta.url).pathname] } },
});
