import { fileURLToPath, URL } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Plugin, Rollup } from 'vite';
import { defineConfig } from 'vitest/config';

import { checkNotice, NOTICE, noticeText, notices, packageDir } from './tools/licences.mjs';
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

/**
 * Lists the packages behind every bundled chunk in `dist/licenses/third-party.txt`. The worker
 * builds run inside the main build's transform phase, so their packages are known before the main
 * build emits the notice; `closeBundle` then grades the file on disk.
 */
const licenceNotice = (): { main: Plugin; worker: () => Plugin } => {
  const dirs = new Set<string>();
  let workers = 0;
  let outDir = 'dist';
  let list: ReturnType<typeof notices> = [];
  const collect = (bundle: Rollup.OutputBundle): void => {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk') continue;
      for (const [id, module] of Object.entries(chunk.modules)) {
        // A module tree-shaken to nothing ships no code.
        const dir = module.renderedLength > 0 ? packageDir(id) : undefined;
        if (dir !== undefined) dirs.add(dir);
      }
    }
  };
  return {
    worker: () => ({
      name: 'licence-notice-worker',
      apply: 'build',
      generateBundle(_options, bundle) {
        workers += 1;
        collect(bundle);
      },
    }),
    main: {
      name: 'licence-notice',
      apply: 'build',
      configResolved(config) {
        outDir = config.build.outDir;
      },
      generateBundle(_options, bundle) {
        if (workers === 0) this.error('no worker build reported its packages');
        collect(bundle);
        list = notices(dirs);
        this.emitFile({ type: 'asset', fileName: NOTICE, source: noticeText(list) });
      },
      closeBundle() {
        process.stdout.write(`${checkNotice(outDir, list)}\n`);
      },
    },
  };
};

const licences = licenceNotice();

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
  plugins: [svelte(), licences.main, offlineCache()],
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
  worker: { format: 'es', plugins: () => [licences.worker()] },
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
