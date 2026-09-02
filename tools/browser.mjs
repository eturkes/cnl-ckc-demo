// Shared plumbing for the checks that need a real browser.
//
// `smoke.mjs` and `browser-check.mjs` both serve static files from a temporary
// root, resolve the launcher out of the pnpm global store and drive the same
// slice of the page API. That slice is declared here once; the launcher ships no
// types, so every consumer would otherwise redeclare it.

import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';

/**
 * @typedef {object} Locator
 * @property {() => Promise<void>} click
 * @property {() => Promise<number>} count
 * @property {() => Promise<string | null>} textContent
 * @property {(options?: object) => Promise<void>} waitFor
 *
 * @typedef {object} Page
 * @property {(url: string, options?: object) => Promise<unknown>} goto
 * @property {(selector: string, options?: object) => Promise<unknown>} waitForSelector
 * @property {(selector: string) => Locator} locator
 * @property {(role: string, options?: object) => Locator} getByRole
 * @property {(event: string, handler: (value: Error) => void) => void} on
 * @property {(fn: string, arg?: unknown) => Promise<unknown>} evaluate
 *
 * @typedef {object} Browser
 * @property {(options?: object) => Promise<Page>} newPage
 * @property {() => Promise<void>} close
 *
 * @typedef {{ path: string, status: number }} LogEntry
 */

/** @type {Record<string, string>} */
const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

/**
 * @param {string} tool
 * @returns {(message: string) => never}
 */
export const failWith = (tool) => (message) => {
  console.error(`${tool}: ${message}`);
  process.exit(1);
};

/**
 * pnpm globals move between store versions, so scan newest first.
 *
 * @param {string} pkg
 * @param {(message: string) => never} fail
 * @returns {string}
 */
export const resolveGlobal = (pkg, fail) => {
  const globals = join(process.env.PNPM_HOME ?? join(homedir(), '.local/share/pnpm'), 'global');
  for (const dir of readdirSync(globals).sort((a, b) => Number(b) - Number(a))) {
    const entry = join(globals, dir, 'node_modules', pkg);
    if (existsSync(entry)) return pathToFileURL(entry).href;
  }
  return fail(`${pkg} missing from ${globals}`);
};

/**
 * @param {(message: string) => never} fail
 * @returns {Promise<Browser>}
 */
export const launch = async (fail) => {
  // The launcher resolves out of the pnpm global store at run time and ships no
  // types, so this import is the one place `any` legitimately enters these files.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const launcher = /** @type {{ ChromiumFish: (options?: object) => Promise<Browser> }} */ (
    await import(`${resolveGlobal('chromiumfish', fail)}/dist/index.js`)
  );
  return launcher.ChromiumFish({ headless: true });
};

/**
 * Static server over `root` that records every request, so a silently missing
 * nested asset fails the check instead of degrading the page.
 *
 * @param {string} root
 * @param {LogEntry[]} log
 * @returns {Promise<{ port: number, close: () => void }>}
 */
export const serve = (root, log) =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = normalize(decodeURI((request.url ?? '/').split('?')[0] ?? '/'));
      const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
      const ok = file.startsWith(root) && existsSync(file);
      log.push({ path, status: ok ? 200 : 404 });
      if (!ok) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      response.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        port,
        close: () => {
          server.close();
        },
      });
    });
  });
