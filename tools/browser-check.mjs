#!/usr/bin/env node
// The two browser claims `pnpm smoke` does not reach (M1 review E26, R40).
//
// E26 — u2's accept clause names BOTH deployment modes, dev server and built
// output, and only the built one was ever driven. Both are checked here against
// the SAME expectation, read out of the build manifest rather than written down.
//
// R40 — cooperative cancel is delivered between solutions, measured in Node and
// asserted nowhere in a browser. The dev server is what makes that provable: it
// serves modules, so the page can drive `EngineClient` against a real module
// worker instead of guessing at a UI race.
//
// Outside `pnpm gate` on the `pnpm smoke` precedent: it needs a real browser.

import { execFileSync, spawn } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { failWith, launch, serve } from './browser.mjs';
import { loadManifest, ROOT } from './kb/paths.mjs';

const NESTED = 'some/nested';
const READY = '[data-engine="ready"]';
const ERRORED = '[data-engine="error"]';
const TIMEOUT = 60_000;
/** Long enough that solutions are still arriving, short enough to stay inside the run. */
const ABORT_AFTER_MS = 400;
/** The narrowest viewport the presentation promises to contain. */
const NARROW = 320;

/** @type {(message: string) => never} */
const fail = failWith('browser-check');

/** The count the build recorded; the DOM must report this, never a literal here. */
const documents = loadManifest()?.contract.documents;
if (documents === undefined) fail('no build manifest; run pnpm kb:build');

/**
 * Start the Vite dev server and wait for the URL it prints.
 *
 * The port is read from the process rather than chosen here, so a busy default
 * relocates the server instead of failing the check.
 *
 * @returns {Promise<{ url: string, stop: () => void }>}
 */
const devServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stop = () => {
      child.kill('SIGTERM');
    };
    const timer = setTimeout(() => {
      stop();
      reject(new Error('vite printed no local URL within 60 s'));
    }, TIMEOUT);
    let seen = '';
    child.stdout.on('data', (chunk) => {
      seen += String(chunk);
      const url = /(http:\/\/127\.0\.0\.1:\d+\/)/.exec(seen)?.[1];
      if (url === undefined) return;
      clearTimeout(timer);
      resolve({ url, stop });
    });
    child.stderr.on('data', (chunk) => {
      seen += String(chunk);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`vite exited with ${String(code)}: ${seen.slice(-400)}`));
    });
  });

/**
 * Open the About disclosure and read the document count the engine reported.
 *
 * @param {import('./browser.mjs').Page} page
 * @param {string} mode
 * @returns {Promise<number>}
 */
const readDocuments = async (page, mode) => {
  // Waiting for `ready` alone turns every boot failure into a 60 s timeout with a
  // stack trace. Waiting for either terminal state reports the real one in seconds.
  await page.waitForSelector(`${READY}, ${ERRORED}`, { timeout: TIMEOUT });
  if ((await page.locator(ERRORED).count()) > 0) {
    fail(`${mode}: engine reached boot-error instead of ready`);
  }
  // The count ships inside a `<details>`, whose body is not visible until it opens.
  await page.locator('details.about summary').click();
  const text = (await page.locator('details.about').textContent()) ?? '';
  const reported = /reports (\d+) compiled documents/.exec(text)?.[1];
  if (reported === undefined) fail(`${mode}: About panel states no document count`);
  return Number(reported);
};

/**
 * Widest element crossing the right viewport edge, plus the document's own scroll
 * width. Reported by tag and class so a regression names the surface that broke,
 * and measured on live boxes because `overflow-wrap` only shows in layout.
 */
const OVERFLOW_PROBE = `(() => {
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

/**
 * Fail unless the page fits its viewport in the given interaction state.
 *
 * @param {import('./browser.mjs').Page} page
 * @param {string} state
 * @returns {Promise<void>}
 */
const fitsNarrow = async (page, state) => {
  const seen =
    /** @type {{limit: number, scrollWidth: number, worst?: {right: number, at: string}}} */ (
      await page.evaluate(OVERFLOW_PROBE)
    );
  if (seen.scrollWidth > seen.limit) {
    fail(
      `${NARROW}px ${state}: document scrolls to ${seen.scrollWidth}px in a ${seen.limit}px viewport`,
    );
  }
  if (seen.worst !== undefined) {
    fail(
      `${NARROW}px ${state}: ${seen.worst.at} reaches ${Math.round(seen.worst.right)}px past ${seen.limit}px`,
    );
  }
};

/** Drives a real module worker in the page; a string keeps it out of Node's scope. */
const CANCEL_PROBE = `(async () => {
  const { EngineClient } = await import('/src/engine/client.ts');
  const { BUDGET_MAX } = await import('/src/engine/budget.ts');
  const client = new EngineClient();
  try {
    const booted = await client.boot();
    if (booted.kind !== 'booted') return { error: 'boot returned ' + booted.kind };
    const budget = { ...BUDGET_MAX, wallClockMs: 30000 };
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ${String(ABORT_AFTER_MS)});
    const started = performance.now();
    const outcome = await client.query('between(1,100000000,X).', budget, controller.signal);
    const elapsed = performance.now() - started;
    // Same engine, straight after: a cooperative cancel must not cost the session.
    const after = await client.query('guideline_document(D,_,_).', { ...budget, answerCap: 1 });
    return {
      documents: booted.contract.documents,
      kind: outcome.kind,
      solutions: outcome.solutions ? outcome.solutions.length : -1,
      cap: budget.answerCap,
      elapsed,
      after: after.kind,
    };
  } finally {
    client.dispose();
  }
})()`;

// Never trust a leftover dist tree: this check proves the current source.
execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' });

const root = await mkdtemp(join(tmpdir(), 'cnl-ckc-browser-'));
/** @type {import('./browser.mjs').LogEntry[]} */
const log = [];
const server = await serve(root, log);
/** @type {import('./browser.mjs').Browser | undefined} */
let browser;
/** @type {{ url: string, stop: () => void } | undefined} */
let dev;
/** @type {string | undefined} */
let raised;
/** @type {string | undefined} */
let thrown;

try {
  await cp(join(ROOT, 'dist'), join(root, NESTED), { recursive: true });
  browser = await launch(fail);

  // E26, leg 1 — built output, nested path, the deployment the project ships.
  const builtPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  builtPage.on('pageerror', (error) => {
    raised ??= `built output raised ${error.message}`;
  });
  const builtUrl = `http://127.0.0.1:${String(server.port)}/${NESTED}/`;
  await builtPage.goto(builtUrl, { waitUntil: 'load', timeout: TIMEOUT });
  const builtDocuments = await readDocuments(builtPage, 'built');
  if (log.some((entry) => /semantic-graph-.+\.json$/u.test(entry.path))) {
    fail('built: semantic graph data loaded before activation');
  }
  if (log.some((entry) => /cytoscape(?:-fcose|\.esm)-.+\.js$/u.test(entry.path))) {
    fail('built: graph renderer loaded before activation');
  }
  await builtPage.getByRole('button', { name: 'Explore graph' }).click();
  await builtPage.waitForSelector('.graph-shell .counts', { timeout: TIMEOUT });
  if (!log.some((entry) => /semantic-graph-.+\.json$/u.test(entry.path))) {
    fail('built: graph activation requested no semantic graph data');
  }
  if (!log.some((entry) => /cytoscape(?:-fcose|\.esm)-.+\.js$/u.test(entry.path))) {
    fail('built: graph activation requested no visual renderer');
  }

  // E26, leg 2 — dev server, the mode every contributor runs and no check drove.
  dev = await devServer();
  const devPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  devPage.on('pageerror', (error) => {
    raised ??= `dev server raised ${error.message}`;
  });
  await devPage.goto(dev.url, { waitUntil: 'load', timeout: TIMEOUT });
  const devDocuments = await readDocuments(devPage, 'dev');

  for (const [mode, reported] of [
    ['built', builtDocuments],
    ['dev', devDocuments],
  ]) {
    if (reported !== documents) {
      fail(
        `${String(mode)} reported ${String(reported)} documents, manifest records ${String(documents)}`,
      );
    }
  }

  // U7-19 — the containment `pnpm presentation:check` asserts in CSS, measured in
  // layout at the narrowest supported viewport. The static check cannot see a box
  // that overflows for a reason other than an unbroken word.
  const narrowPage = await browser.newPage({ viewport: { width: NARROW, height: 720 } });
  narrowPage.on('pageerror', (error) => {
    raised ??= `narrow viewport raised ${error.message}`;
  });
  await narrowPage.goto(builtUrl, { waitUntil: 'load', timeout: TIMEOUT });
  await narrowPage.waitForSelector(READY, { timeout: TIMEOUT });
  await fitsNarrow(narrowPage, 'idle');
  await narrowPage.locator('[role="combobox"]').click();
  await fitsNarrow(narrowPage, 'listbox open');
  await narrowPage.locator('[role="option"]:first-of-type').click();
  await narrowPage.getByRole('button', { name: 'Run' }).click();
  // Engine-authored text is the whole risk, so measure once it is on screen.
  await narrowPage.locator('section[aria-labelledby] .summary').waitFor({ timeout: TIMEOUT });
  await fitsNarrow(narrowPage, 'answers rendered');
  await narrowPage.locator('.source-passage summary').click();
  await fitsNarrow(narrowPage, 'exact source open');
  await narrowPage.locator('.canonical summary').click();
  await fitsNarrow(narrowPage, 'canonical form open');
  await narrowPage.waitForSelector('details.ladder > summary', { timeout: TIMEOUT });
  if (log.some((entry) => /assets\/cdc[^/]+\.json$/u.test(entry.path))) {
    fail('provenance evidence loaded before its disclosure opened');
  }
  if (log.some((entry) => /assets\/guideline-[^/]+\.pdf$/u.test(entry.path))) {
    fail('guideline PDF loaded before its viewer was requested');
  }
  await narrowPage.locator('details.ladder > summary').click();
  await narrowPage.waitForSelector('.ladder .disclosures', { timeout: TIMEOUT });
  if (!log.some((entry) => /assets\/cdc[^/]+\.json$/u.test(entry.path))) {
    fail('opening the provenance ladder requested no document evidence');
  }
  const pageHref = await narrowPage.locator('.page-actions a').getAttribute('href');
  if (
    pageHref === null ||
    !/\/some\/nested\/assets\/guideline-[^#]+\.pdf#page=\d+$/u.test(pageHref)
  ) {
    fail(`physical-page link is not nested-host safe: ${String(pageHref)}`);
  }
  await fitsNarrow(narrowPage, 'provenance open');
  await narrowPage.getByRole('button', { name: 'Load page viewer' }).click();
  await narrowPage.waitForSelector('.ladder iframe', { timeout: TIMEOUT });
  await narrowPage.locator('.ladder iframe').waitFor({ timeout: TIMEOUT });
  if (!log.some((entry) => /assets\/guideline-[^/]+\.pdf$/u.test(entry.path))) {
    fail('opening the guideline viewer requested no PDF');
  }
  await fitsNarrow(narrowPage, 'guideline viewer open');
  await narrowPage.locator('details.about summary').click();
  await fitsNarrow(narrowPage, 'about open');

  // R40 — cancel delivery between solutions, in a real browser.
  const probe = /** @type {Record<string, unknown>} */ (await devPage.evaluate(CANCEL_PROBE));
  if (typeof probe.error === 'string') fail(`cancel probe: ${probe.error}`);
  const solutions = Number(probe.solutions);
  if (probe.kind !== 'cancelled') {
    fail(`cancel probe settled ${String(probe.kind)} with ${String(solutions)} solutions`);
  }
  // Between solutions, not before the first and not after the last: a run that
  // proved nothing would not show delivery, and one that hit its cap never yielded
  // to the cancel at all.
  if (solutions < 1) fail('cancel arrived before any solution was proven');
  if (solutions >= Number(probe.cap)) fail('run stopped at its answer cap, not at the cancel');
  if (probe.after !== 'limit' && probe.after !== 'solutions') {
    fail(`engine unusable after a cooperative cancel: ${String(probe.after)}`);
  }
  if (Number(probe.documents) !== documents) fail('worker booted a different corpus');
  if (raised !== undefined) fail(raised);

  const broken = log.filter((entry) => entry.status !== 200 && entry.path.startsWith(`/${NESTED}`));
  if (broken.length > 0) fail(`nested assets missing: ${broken.map((e) => e.path).join(', ')}`);

  console.log(
    `browser-check: ok — dev ${dev.url} and built ${builtUrl} both report ${String(documents)} ` +
      `documents; graph and evidence stay lazy; eight states fit ${String(NARROW)}px; ` +
      `cancel delivered after ${String(solutions)} ` +
      `of up to ${String(probe.cap)} solutions in ${Number(probe.elapsed).toFixed(0)} ms, ` +
      `engine still ${String(probe.after)}`,
  );
} catch (cause) {
  // A browser timeout or a launcher fault must read as this check's own one-line
  // failure, not as an uncaught rejection trailing a Node banner.
  thrown =
    cause instanceof Error ? `${cause.name}: ${cause.message.split('\n')[0]}` : String(cause);
} finally {
  await browser?.close();
  dev?.stop();
  server.close();
  await rm(root, { recursive: true, force: true });
}

if (thrown !== undefined) fail(thrown);
