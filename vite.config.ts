import { fileURLToPath, URL } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import { writeServiceWorker } from './tools/offline-sw.mjs';

/** Reads the written build, so worker-emitted assets (the PVM) are listed too. */
const offlineCache = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'offline-cache',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      writeServiceWorker(outDir);
    },
  };
};

// Real Chromium, outside `pnpm gate`: `pnpm test:browser` sets VITEST_BROWSER and points
// VITEST_CHROMIUM at the chromiumfish binary. Loaded only then, so `vite dev`, `vite build` and
// the gate's suite never import a browser driver.
const browserProject =
  process.env.VITEST_BROWSER === '1'
    ? await (async () => {
        const { playwright } = await import('@vitest/browser-playwright');
        const { axCombobox } = await import('./tests/support/ax-commands.js');
        return {
          extends: true as const,
          resolve: { conditions: ['browser'] },
          // Pre-bundled up front: discovering axe-core mid-run made Vite reload the test page.
          optimizeDeps: { include: ['axe-core'] },
          test: {
            name: 'browser',
            include: ['tests/**/*.browser.test.ts'],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({
                launchOptions:
                  process.env.VITEST_CHROMIUM === undefined
                    ? {}
                    : { executablePath: process.env.VITEST_CHROMIUM },
              }),
              instances: [{ browser: 'chromium' as const }],
              commands: { axCombobox },
            },
          },
        };
      })()
    : undefined;

// `wrangler.jsonc` `dev.port`.
const INTAKE_PROXY = 'http://127.0.0.1:8791';

export default defineConfig({
  plugins: [svelte(), offlineCache()],
  // Relative base keeps the built demo working under a nested static path.
  base: './',
  // Worktrees reach the toolchain through a `node_modules` symlink, so the default
  // `node_modules/.vite` cache is one shared directory across every tree. Resolving
  // it against the project root instead keeps concurrent builds from racing.
  cacheDir: '.vite',
  resolve: {
    // The runtime payload is generated and gitignored; the alias is how source
    // reaches it without naming a path into `kb/`.
    alias: { '@kb': fileURLToPath(new URL('./kb/generated', import.meta.url)) },
  },
  // Free-text intake posts same-origin; both servers hand it to the local judgment proxy
  // (`pnpm intake:dev`), so the page's `connect-src 'self'` holds.
  server: { proxy: { '/api/judgment': INTAKE_PROXY } },
  preview: { proxy: { '/api/judgment': INTAKE_PROXY } },
  // The engine worker is a module worker; the default `iife` output cannot carry it.
  worker: { format: 'es' },
  // swipl-wasm ships large .wasm/.data assets; keep them as files, never inlined.
  build: { assetsInlineLimit: 0 },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.dom.test.ts', 'tests/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        // Svelte's exports resolve to the SSR build unless `browser` is asked for,
        // and `mount` throws there. Scoping the condition to this project keeps the
        // node suite on swipl-wasm's node entry.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/**/*.dom.test.ts'],
          setupFiles: ['tests/support/dom-setup.ts'],
        },
      },
      ...(browserProject === undefined ? [] : [browserProject]),
    ],
  },
});
