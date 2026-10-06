// Shared plumbing for the checks that need a real browser: `smoke`, `browser:check` and
// `visual-qa` each run a scenario inside `withBuiltSite` and drive the slice of the page API
// declared here once — the launcher ships no types, so every consumer would otherwise
// redeclare it.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOT } from './kb/paths.mjs';

/**
 * @typedef {object} Locator
 * @property {() => Promise<void>} click
 * @property {(value: string) => Promise<void>} fill
 * @property {() => Locator} first
 * @property {() => Promise<number>} count
 * @property {(name: string) => Promise<string | null>} getAttribute
 * @property {() => Promise<string | null>} textContent
 * @property {(options?: object) => Promise<void>} waitFor
 * @property {() => Promise<Buffer>} screenshot
 *
 * @typedef {object} Page
 * @property {(url: string, options?: object) => Promise<unknown>} goto
 * @property {(options?: object) => Promise<unknown>} reload
 * @property {(selector: string, options?: object) => Promise<unknown>} waitForSelector
 * @property {(fn: string, arg?: unknown, options?: object) => Promise<unknown>} waitForFunction
 * @property {(selector: string) => Locator} locator
 * @property {(role: string, options?: object) => Locator} getByRole
 * @property {(event: string, handler: (value: Error) => void) => void} on
 * @property {(fn: string, arg?: unknown) => Promise<unknown>} evaluate
 * @property {(options: { path: string }) => Promise<unknown>} screenshot
 * @property {() => Promise<void>} close
 * @property {(script: string) => Promise<void>} addInitScript
 *
 * @typedef {object} Browser
 * @property {(options?: object) => Promise<Page>} newPage
 * @property {() => Promise<void>} close
 *
 * @typedef {{ path: string, status: number }} LogEntry
 */

/**
 * Widest element crossing the right viewport edge, plus the document's own scroll
 * width. Reported by tag and class so a regression names the surface that broke,
 * and measured on live boxes because `overflow-wrap` only shows in layout.
 */
export const OVERFLOW_PROBE = `(() => {
  const root = document.documentElement;
  const limit = root.clientWidth;
  let worst;
  for (const el of document.querySelectorAll('body *')) {
    const right = el.getBoundingClientRect().right;
    // Sub-pixel rounding puts a full-width box a hair past its container.
    if (right <= limit + 0.5) continue;
    if (worst === undefined || right > worst.right) {
      worst = { right, at: el.tagName.toLowerCase() + '.' + (el.getAttribute('class') ?? '') };
    }
  }
  return { limit, scrollWidth: root.scrollWidth, worst };
})()`;

/** @type {Record<string, string>} */
const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
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
  // The specifier is a store path this process resolved itself, and this file never ships.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const launcher = /** @type {{ ChromiumFish: (options?: object) => Promise<Browser> }} */ (
    // eslint-disable-next-line no-unsanitized/method
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
 * @param {(path: string) => boolean} [refuse] severs the connection instead, as a lost network does
 * @returns {Promise<{ port: number, close: () => void }>}
 */
export const serve = (root, log, refuse = () => false) =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = normalize(decodeURI((request.url ?? '/').split('?')[0] ?? '/'));
      if (refuse(path)) {
        log.push({ path, status: 0 });
        request.socket.destroy();
        return;
      }
      const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
      const ok = file.startsWith(root) && existsSync(file);
      log.push({ path, status: ok ? 200 : 404 });
      if (!ok) {
        response.writeHead(404).end();
        return;
      }
      const body = readFileSync(file);
      // Declared like a static host does: `writeHead` alone sends the body chunked, unsized.
      response.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'content-length': body.length,
      });
      response.end(body);
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

/**
 * @typedef {object} BuiltSite
 * @property {string} root the served temp directory; a scenario adds its own copies here
 * @property {string} origin `http://127.0.0.1:<port>`
 * @property {string} url the nested build's URL
 * @property {LogEntry[]} log every request the server saw
 * @property {Browser} browser
 */

/**
 * Build, serve a copy of `dist/` at a nested path under a temp root, launch the browser, run
 * the scenario, and tear down whatever it threw. Never trust a leftover dist tree: every lane
 * proves the current source. A throw becomes the tool's own one-line failure, not an uncaught
 * rejection trailing a Node banner. Build output goes to stderr, so stdout stays the lane's own.
 *
 * @template T
 * @param {{ tool: string, fail: (message: string) => never, nested: string,
 *   refuse?: (path: string) => boolean }} options
 * @param {(site: BuiltSite) => Promise<T>} scenario
 * @returns {Promise<T>}
 */
export const withBuiltSite = async ({ tool, fail, nested, refuse }, scenario) => {
  execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: ['ignore', 2, 2] });
  const root = await mkdtemp(join(tmpdir(), `cnl-ckc-${tool}-`));
  // A lane's `fail` exits the process, skipping the `finally` below; the root still goes, and
  // Playwright reaps the browser it launched.
  const removeRoot = () => {
    rmSync(root, { recursive: true, force: true });
  };
  process.once('exit', removeRoot);
  /** @type {LogEntry[]} */
  const log = [];
  const server = await serve(root, log, refuse);
  /** @type {Browser | undefined} */
  let browser;
  /** @type {string} */
  let thrown;
  try {
    await cp(join(ROOT, 'dist'), join(root, nested), { recursive: true });
    browser = await launch(fail);
    const origin = `http://127.0.0.1:${String(server.port)}`;
    return await scenario({ root, origin, url: `${origin}/${nested}/`, log, browser });
  } catch (cause) {
    thrown =
      cause instanceof Error
        ? `${cause.name}: ${cause.message.split('\n')[0] ?? ''}`
        : String(cause);
  } finally {
    // A browser that refuses to close still leaves the server and the root to clean.
    await browser?.close().catch(() => undefined);
    server.close();
    await rm(root, { recursive: true, force: true });
    process.removeListener('exit', removeRoot);
  }
  return fail(thrown);
};
