#!/usr/bin/env node
// `pnpm test:browser` — the vitest `browser` project in real Chromium, outside `pnpm gate`.
//
// The project exists only under VITEST_BROWSER=1, so the gate's suite never needs a browser.
// Chromium is the chromiumfish build the other browser lanes already use, resolved from the
// pnpm global store, so nothing downloads a second browser.

import { spawnSync } from 'node:child_process';

import { failWith, resolveGlobal } from './browser.mjs';
import { ROOT } from './kb/paths.mjs';

const fail = failWith('test:browser');
// The launcher module ships no types; its `binaryPath` resolves the installed Chromium.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- the launcher ships no types
const launcher = /** @type {{ binaryPath: () => Promise<string> }} */ (
  // eslint-disable-next-line no-unsanitized/method -- a store path this process resolved itself
  await import(`${resolveGlobal('chromiumfish', fail)}/dist/index.js`)
);
const chromium = await launcher.binaryPath();
const run = spawnSync('pnpm', ['exec', 'vitest', 'run', '--project', 'browser'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITEST_BROWSER: '1', VITEST_CHROMIUM: chromium },
});
process.exitCode = run.status ?? 1;
