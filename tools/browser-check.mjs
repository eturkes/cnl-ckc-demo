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
import { readdirSync, readFileSync } from 'node:fs';
import { copyFile, cp, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expectedAnswer, questionOf } from './answer-oracle.mjs';
import { failWith, launch, serve } from './browser.mjs';
import {
  CATALOG,
  cmapOf,
  cut,
  expectedPoints,
  originalPath,
  rangeOf,
  shippedUrl,
  SUBSETS,
} from './fonts.mjs';
import { loadManifest, ROOT } from './kb/paths.mjs';

const NESTED = 'some/nested';
/** The face firing input: the same build with its Japanese woff2 files renamed away. */
const FACELESS = 'some/faceless';
const PARITY = 'some/parity';
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
    // `detached` puts pnpm AND the vite it execs into one process group, and `stop` signals
    // the group. Signalling the child alone reaps the pnpm wrapper and orphans vite, which
    // keeps the inherited stdout pipe open — the check then prints its success line and hangs
    // forever, taking `pnpm release:check` with it.
    const child = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    const stop = () => {
      const { pid } = child;
      if (pid === undefined) return;
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        // Already gone: the group exited between the check and the signal.
      }
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
  // The count ships inside a closed `<details>`, so wait for the node, not its visibility.
  // It is read from the attribute the panel binds, never parsed out of a localized sentence.
  const corpus = page.locator('details.about [data-documents]');
  await corpus.waitFor({ state: 'attached', timeout: TIMEOUT });
  const reported = await corpus.getAttribute('data-documents');
  if (reported === null || !/^\d+$/u.test(reported)) {
    fail(`${mode}: About panel carries no document count: ${String(reported)}`);
  }
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

/** States measured, counted rather than written down: adding one must not restate it. */
let narrowStates = 0;

/**
 * Fail unless the page fits its viewport in the given interaction state.
 *
 * @param {import('./browser.mjs').Page} page
 * @param {string} state
 * @returns {Promise<void>}
 */
const fitsNarrow = async (page, state) => {
  narrowStates += 1;
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

/**
 * Fail unless the rendered canonical answer is byte-equal to the bag-derived expectation.
 *
 * `pnpm smoke` grades one question at one viewport in English. This grades whatever the page
 * itself selected, at the narrowest viewport, in both locales — the pair is what decides that
 * translating the interface leaves the engine's own answer untouched.
 *
 * @param {import('./browser.mjs').Page} page
 * @param {string} leg
 * @param {string} expected
 * @returns {Promise<void>}
 */
const canonicalMatches = async (page, leg, expected) => {
  const rendered = ((await page.locator('.canonical code').textContent()) ?? '').trim();
  if (rendered === expected) return;
  // The answer runs to kilobytes, so name the first divergent byte and show a window around
  // it rather than printing two walls of Prolog and leaving the reader to diff them.
  let at = 0;
  while (at < expected.length && expected[at] === rendered[at]) at += 1;
  /** @type {(text: string) => string} */
  const window = (text) => `…${text.slice(Math.max(0, at - 40), at + 60)}…`;
  fail(
    `${leg}: rendered answer differs from the bag at byte ${String(at)} ` +
      `(bag ${String(expected.length)} B, dom ${String(rendered.length)} B)\n` +
      `  bag: ${window(expected)}\n  dom: ${window(rendered)}`,
  );
};

/**
 * The Japanese subset, hashed by the build. It must be absent from the request log
 * while the page is English and present once the page is Japanese.
 */
const JAPANESE_FACE = /biz-udpgothic-japanese-\d+-normal[^/]*\.woff2$/u;

/**
 * The two Japanese `@font-face` rows and how many the browser has actually fetched.
 * `unicode-range` is the whole font budget — bytes an English visitor must never
 * pay — and `document.fonts` is where that is decidable, because a declared
 * face stays `unloaded` until a glyph inside its range needs rendering.
 */
const FACE_PROBE = `(async () => {
  await document.fonts.ready;
  const faces = [...document.fonts].filter((face) => face.family === 'BIZ UDPGothic');
  return { declared: faces.length, loaded: faces.filter((face) => face.status === 'loaded').length };
})()`;

/**
 * The Japanese face grader: ask the font set for a Japanese glyph and read whether a
 * `BIZ UDPGothic` face actually loaded. A missing file rejects the load at once, so a lost face
 * is named immediately instead of running out a timeout.
 */
const FACE_SETTLED = `(async () => {
  try {
    await document.fonts.load('16px "BIZ UDPGothic"', 'あ');
  } catch {
    return false;
  }
  return [...document.fonts].some((face) => face.family === 'BIZ UDPGothic' && face.status === 'loaded');
})()`;

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

/**
 * One locale's pass over every interaction state at the narrowest viewport.
 *
 * Each leg opens its own page, and each page is its own browser context, so the
 * lazy-load assertions read only the requests that leg made. The Japanese leg
 * switches language before the first state, so every state is measured in the
 * script with no word spaces; the English leg proves its whole run never fetched
 * the Japanese face.
 *
 * @param {import('./browser.mjs').Browser} browser
 * @param {string} builtUrl
 * @param {'en' | 'ja'} lang
 * @returns {Promise<{ question: string, expectedCanonical: { serialized: string, rows: number } }>}
 */
const narrowSweep = async (browser, builtUrl, lang) => {
  const since = log.length;
  /** @type {(pattern: RegExp) => boolean} */
  const requested = (pattern) => log.slice(since).some((entry) => pattern.test(entry.path));
  const page = await browser.newPage({ viewport: { width: NARROW, height: 720 } });
  page.on('pageerror', (error) => {
    raised ??= `narrow ${lang} viewport raised ${error.message}`;
  });
  await page.goto(builtUrl, { waitUntil: 'load', timeout: TIMEOUT });
  await page.waitForSelector(READY, { timeout: TIMEOUT });
  if (lang === 'ja') {
    await page.locator('[data-action="language-switch"]').click();
    await page.waitForSelector('html[lang="ja"]', { timeout: TIMEOUT });
    if (!(await page.evaluate(FACE_SETTLED))) {
      fail('Japanese rendered without the Japanese face; the interface is in fallback glyphs');
    }
    if (!requested(JAPANESE_FACE)) {
      fail('Japanese rendered without the Japanese face; the interface is in fallback glyphs');
    }
  }
  await fitsNarrow(page, `${lang} idle`);
  await page.locator('[role="combobox"]').click();
  await fitsNarrow(page, `${lang} listbox open`);
  // E9 — the oracle follows the page's own selection, so the option's id is read before the
  // click closes the listbox rather than the question being written down here.
  const firstOption = page.locator('[role="option"]:first-of-type');
  const question = questionOf(await firstOption.getAttribute('id'), fail);
  const expectedCanonical = expectedAnswer(question, fail);
  await firstOption.click();
  await page.locator('[data-action="run"]').click();
  // Engine-authored text is the whole risk, so measure once it is on screen.
  await page.waitForSelector('section[aria-labelledby] .answer-point', { timeout: TIMEOUT });
  await fitsNarrow(page, `${lang} answers rendered`);
  await page.locator('.explanation > summary').click();
  await fitsNarrow(page, `${lang} sources open`);
  await page.locator('.canonical summary').click();
  await fitsNarrow(page, `${lang} canonical form open`);
  // Payload never translates, and the canonical answer is the claim the demo makes.
  await canonicalMatches(page, `${lang} ${question}`, expectedCanonical.serialized);
  await page.waitForSelector('details.ladder > summary', { timeout: TIMEOUT });
  if (requested(/assets\/cdc[^/]+\.json$/u)) {
    fail(`${lang}: provenance evidence loaded before its disclosure opened`);
  }
  if (requested(/assets\/guideline-[^/]+\.pdf$/u)) {
    fail(`${lang}: guideline PDF loaded before its viewer was requested`);
  }
  await page.locator('details.ladder > summary').click();
  await page.waitForSelector('.ladder .disclosures', { timeout: TIMEOUT });
  if (!requested(/assets\/cdc[^/]+\.json$/u)) {
    fail(`${lang}: opening the provenance ladder requested no document evidence`);
  }
  const pageHref = await page.locator('.page-actions a').getAttribute('href');
  if (
    pageHref === null ||
    !/\/some\/nested\/assets\/guideline-[^#]+\.pdf#page=\d+$/u.test(pageHref)
  ) {
    fail(`${lang}: physical-page link is not nested-host safe: ${String(pageHref)}`);
  }
  await fitsNarrow(page, `${lang} provenance open`);
  await page.locator('[data-action="load-page-viewer"]').click();
  await page.waitForSelector('.ladder iframe', { timeout: TIMEOUT });
  if (!requested(/assets\/guideline-[^/]+\.pdf$/u)) {
    fail(`${lang}: opening the guideline viewer requested no PDF`);
  }
  await fitsNarrow(page, `${lang} guideline viewer open`);
  await page.locator('details.about summary').click();
  await fitsNarrow(page, `${lang} about open`);
  if (lang === 'en') {
    // Every disclosure is open, the widest this page ever gets, and still no Japanese
    // glyph may have been needed.
    const faces = /** @type {{declared: number, loaded: number}} */ (
      await page.evaluate(FACE_PROBE)
    );
    if (faces.declared !== 2) fail(`${String(faces.declared)} Japanese faces declared, expected 2`);
    if (faces.loaded !== 0 || requested(JAPANESE_FACE)) {
      fail('an English page fetched the Japanese face; its unicode-range no longer gates it');
    }
  }
  return { question, expectedCanonical };
};

/**
 * A hostile goal only termination can stop: `repeat,fail` never yields a solution, so the
 * worker sits inside one synchronous `next()` and no cooperative cancel or soft deadline can
 * land. The client's main-thread deadline must kill that worker and boot a replacement.
 * Spawns are counted through a `Worker` subclass, because the client constructs the global.
 */
const KILL_PROBE = `(async () => {
  const Native = globalThis.Worker;
  let spawned = 0;
  globalThis.Worker = class extends Native {
    constructor(...args) {
      super(...args);
      spawned += 1;
    }
  };
  const { EngineClient } = await import('/src/engine/client.ts');
  const { BUDGET_MAX } = await import('/src/engine/budget.ts');
  const client = new EngineClient();
  try {
    const booted = await client.boot();
    if (booted.kind !== 'booted') return { error: 'boot returned ' + booted.kind };
    const started = performance.now();
    const outcome = await client.query('repeat,fail.', { ...BUDGET_MAX, wallClockMs: 300 });
    const settled = performance.now() - started;
    const atSettle = spawned;
    // Joins the recreation the deadline already started; single-flight keeps it at one.
    const recreated = await client.reset();
    const cycle = performance.now() - started;
    const after = await client.query('findall(D,guideline_document(D,_,_),Ds),length(Ds,N).', {
      ...BUDGET_MAX,
      answerCap: 1,
    });
    return {
      kind: outcome.kind,
      limit: outcome.limit,
      settled,
      cycle,
      atSettle,
      spawned,
      recreated: recreated.kind,
      documents: recreated.kind === 'booted' ? recreated.contract.documents : -1,
      after: after.kind === 'solutions' ? after.solutions[0].display.N : after.kind,
    };
  } finally {
    client.dispose();
    globalThis.Worker = Native;
  }
})()`;

/**
 * Each shipped subset against the package face it was cut from, drawn in this browser: the
 * catalog's code points must rasterize byte-identically at each weight. Control: the same cut
 * without `AUTOFIT` must differ, since FreeType's CJK hinting reads those glyphs.
 *
 * @param {import('./browser.mjs').Browser} browser
 * @param {string} dir served directory @param {string} url its URL
 * @returns {Promise<number>} code points drawn
 */
const faceParity = async (browser, dir, url) => {
  const css = readFileSync(join(ROOT, 'src/app.css'), 'utf8');
  const catalog = readFileSync(join(ROOT, CATALOG), 'utf8');
  await mkdir(dir, { recursive: true });
  let drawn = '';
  /** @type {string[]} */
  const rules = [];
  for (const subset of SUBSETS) {
    const original = await cmapOf(originalPath(subset));
    const points = expectedPoints(catalog, rangeOf(css, shippedUrl(subset)), original, {
      autofit: false,
    });
    drawn = String.fromCodePoint(...points);
    const weight = String(subset.weight);
    await copyFile(originalPath(subset), join(dir, `original-${weight}.woff2`));
    await copyFile(join(ROOT, subset.shipped), join(dir, `subset-${weight}.woff2`));
    await writeFile(join(dir, `bare-${weight}.woff2`), await cut(subset, points));
    for (const family of ['original', 'subset', 'bare']) {
      rules.push(
        `@font-face{font-family:${family};font-weight:${weight};src:url('${family}-${weight}.woff2')}`,
      );
    }
  }
  await writeFile(
    join(dir, 'index.html'),
    `<!doctype html><style>${rules.join('')}p{width:640px;margin:0;font-size:16px}</style><p id="t"></p>`,
  );
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
  await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
  /** @type {Record<string, Buffer>} */
  const shots = {};
  for (const { weight } of SUBSETS) {
    for (const family of ['original', 'subset', 'bare']) {
      await page.evaluate(
        `(async () => {
          const t = document.getElementById('t');
          t.textContent = ${JSON.stringify(drawn)};
          t.style.font = '${String(weight)} 16px ${family}';
          await document.fonts.load('${String(weight)} 16px ${family}', t.textContent);
          await document.fonts.ready;
        })()`,
      );
      shots[`${family}-${String(weight)}`] = await page.locator('#t').screenshot();
    }
  }
  await page.close();
  for (const { weight } of SUBSETS) {
    const original = shots[`original-${String(weight)}`];
    if (
      original === undefined ||
      !original.equals(shots[`subset-${String(weight)}`] ?? Buffer.of())
    ) {
      fail(`the ${String(weight)} subset rasterizes differently from the face it was cut from`);
    }
    if (original.equals(shots[`bare-${String(weight)}`] ?? Buffer.of())) {
      fail(`control did not fire: a ${String(weight)} cut without AUTOFIT rasterized identically`);
    }
  }
  return [...drawn].length;
};

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
  await builtPage.locator('[data-action="explore-graph"]').click();
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
  // layout at the narrowest supported viewport, once per locale. The static check
  // cannot see a box that overflows for a reason other than an unbroken word, and
  // Japanese has no word spaces to break at.
  const english = await narrowSweep(browser, builtUrl, 'en');
  const japanese = await narrowSweep(browser, builtUrl, 'ja');
  if (japanese.question !== english.question) {
    fail(
      `the locales selected different first questions: ${english.question}, ${japanese.question}`,
    );
  }
  const { question, expectedCanonical } = english;
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

  // A hostile goal killed by the client's deadline, and the engine that replaced it.
  const kill = /** @type {Record<string, unknown>} */ (await devPage.evaluate(KILL_PROBE));
  if (typeof kill.error === 'string') fail(`kill probe: ${kill.error}`);
  if (kill.kind !== 'limit' || kill.limit !== 'wall-clock') {
    fail(`hostile goal settled ${String(kill.kind)}/${String(kill.limit)}, not a wall-clock kill`);
  }
  if (kill.atSettle !== 2 || kill.spawned !== 2) {
    fail(
      `expected the deadline to respawn exactly one worker, saw ${String(kill.atSettle)} at ` +
        `settle and ${String(kill.spawned)} after the reset`,
    );
  }
  if (kill.recreated !== 'booted' || kill.documents !== documents) {
    fail(
      `recreated engine reported ${String(kill.recreated)} with ${String(kill.documents)} documents`,
    );
  }
  if (kill.after !== String(documents)) {
    fail(
      `recreated engine answered ${String(kill.after)}, expected ${String(documents)} documents`,
    );
  }
  if (raised !== undefined) fail(raised);

  // Control on the lane's face grader: a build whose Japanese files are gone must be refused.
  const faceless = join(root, FACELESS);
  await cp(join(ROOT, 'dist'), faceless, { recursive: true });
  for (const name of readdirSync(join(faceless, 'assets'))) {
    if (JAPANESE_FACE.test(`/assets/${name}`)) {
      await rename(join(faceless, 'assets', name), join(faceless, 'assets', `${name}.renamed`));
    }
  }
  const facelessPage = await browser.newPage({ viewport: { width: NARROW, height: 720 } });
  await facelessPage.goto(`http://127.0.0.1:${String(server.port)}/${FACELESS}/`, {
    waitUntil: 'load',
    timeout: TIMEOUT,
  });
  await facelessPage.waitForSelector(READY, { timeout: TIMEOUT });
  await facelessPage.locator('[data-action="language-switch"]').click();
  await facelessPage.waitForSelector('html[lang="ja"]', { timeout: TIMEOUT });
  if (await facelessPage.evaluate(FACE_SETTLED)) {
    fail('control did not fire: a build without its Japanese woff2 still loaded the face');
  }

  const parity = await faceParity(
    browser,
    join(root, PARITY),
    `http://127.0.0.1:${String(server.port)}/${PARITY}/`,
  );

  const broken = log.filter((entry) => entry.status !== 200 && entry.path.startsWith(`/${NESTED}`));
  if (broken.length > 0) fail(`nested assets missing: ${broken.map((e) => e.path).join(', ')}`);

  console.log(
    `browser-check: ok — dev ${dev.url} and built ${builtUrl} both report ${String(documents)} ` +
      `documents; graph and evidence stay lazy; ${String(narrowStates)} states fit ` +
      `${String(NARROW)}px across both locales; ` +
      `${question} rendered the bag's ${String(expectedCanonical.rows)}-row canonical answer ` +
      `byte for byte in both locales; cancel delivered after ${String(solutions)} ` +
      `of up to ${String(probe.cap)} solutions in ${Number(probe.elapsed).toFixed(0)} ms, ` +
      `engine still ${String(probe.after)}; a hostile goal was killed at ` +
      `${Number(kill.settled).toFixed(0)} ms and its replacement engine reported ` +
      `${String(kill.documents)} documents ${Number(kill.cycle).toFixed(0)} ms in; both Japanese subsets rasterize ` +
      `${String(parity)} catalog code points identically to their originals; controls: a build ` +
      `without its Japanese woff2 refused, a cut without AUTOFIT rasterized differently`,
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
