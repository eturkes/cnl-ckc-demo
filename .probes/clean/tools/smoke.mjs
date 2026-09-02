#!/usr/bin/env node
// Real-browser proof that the shipped static build answers a question.
//
// Everything else in the gate runs the engine under Node. This is the only check
// that exercises the built bundle, the module worker, the hashed PVM fetch and
// the rendered answer together, and it serves them from a NESTED path because
// `base: './'` is the whole reason a nested static host works at all.
//
// The oracle is read out of the vendored bag at run time rather than written
// here, so the expectation cannot drift from the knowledge base it claims to
// reproduce.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifyBag } from './kb/bag.mjs';
import { ROOT } from './kb/paths.mjs';

/**
 * The slice of the browser API this check drives. Declared here because the
 * launcher is resolved from the pnpm global store and ships no types.
 *
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
 *
 * @typedef {object} Browser
 * @property {(options?: object) => Promise<Page>} newPage
 * @property {() => Promise<void>} close
 *
 * @typedef {{ path: string, status: number }} LogEntry
 */

const QUESTION = 'dosage-reduction-content';
const NESTED = 'some/nested';
/** @type {Record<string, string>} */
const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

/**
 * @param {string} message
 * @returns {never}
 */
const fail = (message) => {
  console.error(`smoke: ${message}`);
  process.exit(1);
};

/**
 * The bag's own recorded answer for `id`, unwrapped from its `result(...)` envelope.
 *
 * @param {string} id
 * @returns {string}
 */
const committedAnswer = (id) => {
  const kb = join(ROOT, 'kb');
  const archive = readdirSync(kb).find((name) => name.endsWith('.tar.gz'));
  if (archive === undefined) fail('no bag archive in kb/');
  const { files } = verifyBag(readFileSync(join(kb, archive)));
  const path = [...files.keys()].find((name) => name.endsWith(`/answers/${id}.pl`));
  const bytes = path === undefined ? undefined : files.get(path);
  if (bytes === undefined) fail(`bag has no committed answer for ${id}`);
  const text = Buffer.from(bytes).toString('utf8');
  const open = text.indexOf('result(') + 'result('.length;
  let depth = 1;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')' && (depth -= 1) === 0) return text.slice(open, i);
  }
  return fail(`committed answer for ${id} is unbalanced`);
};

/**
 * pnpm globals move between store versions, so scan newest first.
 *
 * @param {string} pkg
 * @returns {string}
 */
const resolveGlobal = (pkg) => {
  const globals = join(process.env.PNPM_HOME ?? join(homedir(), '.local/share/pnpm'), 'global');
  for (const dir of readdirSync(globals).sort((a, b) => Number(b) - Number(a))) {
    const entry = join(globals, dir, 'node_modules', pkg);
    if (existsSync(entry)) return pathToFileURL(entry).href;
  }
  return fail(`${pkg} missing from ${globals}`);
};

/**
 * Static server over `root` that records every request, so a silently missing
 * nested asset fails the check instead of degrading the page.
 *
 * @param {string} root
 * @param {LogEntry[]} log
 * @returns {Promise<{ port: number, close: () => void }>}
 */
const serve = (root, log) =>
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

if (!existsSync(join(ROOT, 'dist', 'index.html'))) execFileSync('pnpm', ['build'], { cwd: ROOT });

const expected = committedAnswer(QUESTION);
const root = await mkdtemp(join(tmpdir(), 'cnl-ckc-smoke-'));
/** @type {LogEntry[]} */
const log = [];
const server = await serve(root, log);
const url = `http://127.0.0.1:${server.port}/${NESTED}/`;
/** @type {Browser | undefined} */
let browser;
/** @type {string | undefined} */
let raised;

try {
  await cp(join(ROOT, 'dist'), join(root, NESTED), { recursive: true });
  // The launcher resolves out of the pnpm global store at run time and ships no
  // types, so this import is the one place `any` legitimately enters the file.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const launcher = /** @type {{ ChromiumFish: (options?: object) => Promise<Browser> }} */ (
    await import(`${resolveGlobal('chromiumfish')}/dist/index.js`)
  );
  browser = await launcher.ChromiumFish({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => {
    raised ??= `page raised ${error.message}`;
  });

  await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForSelector('[data-engine="ready"]', { timeout: 45_000 });

  await page.locator('[role="combobox"]').click();
  await page.locator(`[role="option"][id$="-option-${QUESTION}"]`).click();
  await page.getByRole('button', { name: 'Run' }).click();

  // The canonical answer ships behind a disclosure, so a visibility wait needs
  // it open first. Opening it is also what proves the control works.
  await page.locator('.canonical summary').click();

  const answer = page.locator('section[aria-labelledby] .canonical code');
  await answer.waitFor({ timeout: 45_000 });
  const rendered = (await answer.textContent())?.trim();
  if (rendered !== expected) {
    fail(`rendered answer differs from the bag\n  bag: ${expected}\n  dom: ${String(rendered)}`);
  }

  const rows = await page.locator('section[aria-labelledby] fieldset input[type="radio"]').count();
  if (rows !== 2) fail(`expected 2 answer rows, rendered ${rows}`);
  if ((await page.locator('[data-engine="error"]').count()) > 0)
    fail('the engine reported an error');

  const broken = log.filter((entry) => entry.status !== 200 && entry.path.startsWith(`/${NESTED}`));
  if (broken.length > 0) fail(`nested assets missing: ${broken.map((e) => e.path).join(', ')}`);
  if (raised !== undefined) fail(raised);

  const served = log.filter((entry) => entry.status === 200).length;
  console.log(
    `smoke: ok — ${url} answered ${QUESTION} with ${rows} rows matching the bag, ` +
      `${served} nested requests served`,
  );
} finally {
  await browser?.close();
  server.close();
  await rm(root, { recursive: true, force: true });
}
