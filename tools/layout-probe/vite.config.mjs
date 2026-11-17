import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

/** @param {string} path */
const here = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('.'),
  publicDir: here('../../kb/generated/graph'),
  cacheDir: here('../../.vite/layout-probe'),
  resolve: { alias: { '@kb': here('../../kb/generated') } },
  server: { host: '127.0.0.1', hmr: false, watch: null, fs: { allow: [here('../../')] } },
});
