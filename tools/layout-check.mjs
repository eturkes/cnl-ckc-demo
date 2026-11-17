#!/usr/bin/env node
// Blind rendered oracle for `.agent/contracts/g4.md` R1–R6. Budgets belong to layout:budget.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

import { launch } from './layout-probe/browser.mjs';
import { focusSets } from './kb/layout.mjs';
import { inkOf } from './layout-probe/ink.mjs';
import { failedPredicate, predicateFailure } from './layout-probe/failure.mjs';
import { checkProperties } from './layout-probe/properties.mjs';
import { assertGeometryRegressions } from './layout-probe/regressions.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TIMEOUT = 1_800_000;
const started = performance.now();
const CONTROL_TIMEOUT = 15_000;
const GRACE = 3_000;
const CONTROL = process.env['LAYOUT_CHECK_CONTROL'];
const budget = CONTROL === 'hang' ? CONTROL_TIMEOUT : TIMEOUT;
/** @type {import('playwright').Browser | undefined} */
let browser;
/** @type {Awaited<ReturnType<typeof createServer>> | undefined} */
let server;
let phase = 'startup';
let timedOut = false;
const PREDICATES = new Set(['R1', 'R2', 'R3', 'R3PX', 'R4', 'R5', 'R6']);
const cleanup = async () => {
  const b = browser;
  const s = server;
  browser = undefined;
  server = undefined;
  try {
    await b?.close();
  } finally {
    await s?.close();
  }
};
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`layout-check: EXIT whole-run timeout ${String(budget)} ms during ${phase}`);
  const hard = setTimeout(() => process.exit(3), GRACE);
  void cleanup().finally(() => {
    clearTimeout(hard);
    process.exit(3);
  });
}, budget);
/** @type {Map<string, string[]>} */
const failures = new Map();
/** @param {boolean} ok @param {string} rule @param {string} detail */
const require_ = (ok, rule, detail) => {
  if (ok) return;
  if (failFast && PREDICATES.has(rule)) throw predicateFailure(rule, detail);
  const row = failures.get(rule) ?? [];
  if (row.length < 4) row.push(detail);
  failures.set(rule, row);
};
/** @param {import('./layout-probe/probe.js').Result} result @param {string} at */
const collect = (result, at) => {
  for (const [rule, errors] of Object.entries(result.errors))
    for (const error of errors) require_(false, rule, `${at}/${error}`);
};
const args = process.argv.slice(2);
let failFast = false;
let shotArgument;
const usage = () => {
  console.error('usage: node tools/layout-check.mjs [--shots <dir>] [--fail-fast]');
  process.exit(2);
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--fail-fast' && !failFast) failFast = true;
  else if (args[i] === '--shots' && shotArgument === undefined) {
    const path = args[++i];
    if (path === undefined || path.startsWith('--')) usage();
    shotArgument = path;
  } else usage();
}
const shots = resolve(shotArgument ?? resolve(ROOT, '.probe/layout-check'));
mkdirSync(shots, { recursive: true });
/** @type {{ width: number, height: number, dpr: number }[]} */
const CANVASES = [
  { width: 288, height: 320, dpr: 2 },
  { width: 343, height: 440, dpr: 3 },
  { width: 1152, height: 660, dpr: 1 },
];
/** @param {string} path @returns {unknown} */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const network =
  /** @type {Parameters<typeof focusSets>[0] & { lines: { id: string, source: string, target: string }[] }} */ (
    readJson(resolve(ROOT, 'kb/generated/graph/clinical-network.json'))
  );
const sets = focusSets(network);
const layout = /** @type {{ nodes: { label: string[] }[], blocks: { readings: string[][] }[] }} */ (
  readJson(resolve(ROOT, 'kb/generated/graph/clinical-network-layout.json'))
);
const payload = {
  sets,
  failFast,
  ink: await inkOf([
    ...layout.nodes.flatMap((n) => n.label),
    ...layout.blocks.flatMap((b) => b.readings.flat()),
  ]),
};
/** @param {import('playwright').Page} page @param {string} expression @param {unknown} [arg] @returns {Promise<unknown>} */
const run = (page, expression, arg) =>
  page.evaluate(arg === undefined ? expression : `(${expression})(${JSON.stringify(arg)})`);
/** @param {import('playwright').Page} page */
const resultOf = async (page) =>
  /** @type {import('./layout-probe/probe.js').Result} */ (
    await run(page, 'window.layoutProbe.result()')
  );

const control = async () => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    cwd: ROOT,
    env: { ...process.env, LAYOUT_CHECK_CONTROL: 'hang' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const scan = (/** @type {unknown} */ chunk) => {
    output = `${output}${String(chunk)}`.slice(-4000);
  };
  child.stdout.on('data', scan);
  child.stderr.on('data', scan);
  /** @type {number | null} */
  const code = await new Promise((resolve_, reject) => {
    child.once('error', reject);
    child.once('close', (/** @type {number | null} */ code) => resolve_(code));
  });
  require_(
    code === 3 &&
      output.includes(`EXIT whole-run timeout ${String(CONTROL_TIMEOUT)} ms during control/hang`),
    'EXIT',
    `timeout control rc=${String(code)}: ${output.trim()}`,
  );
};
/** @type {Record<string, number>} */
const totals = {};
try {
  phase = 'geometry-regressions';
  assertGeometryRegressions();
  if (CONTROL !== undefined && CONTROL !== 'hang')
    throw new Error(`unknown LAYOUT_CHECK_CONTROL ${CONTROL}`);
  if (CONTROL === undefined) {
    phase = 'timeout-control';
    await control();
    if (failures.has('EXIT')) throw new Error('timeout control failed');
  }
  phase = 'vite-startup';
  server = await createServer({
    configFile: resolve(ROOT, 'tools/layout-probe/vite.config.mjs'),
    logLevel: 'error',
    clearScreen: false,
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite exposed no local URL');
  phase = 'browser-launch';
  browser = await launch((message) => {
    throw new Error(message);
  });
  if (CONTROL === 'hang') {
    const page = await browser.newPage();
    await page.goto(url);
    phase = 'control/hang';
    await run(page, 'new Promise(() => undefined)');
    throw new Error('timeout control returned');
  }
  for (const viewport of CANVASES) {
    const at = `${String(viewport.width)}x${String(viewport.height)}@${String(viewport.dpr)}`;
    phase = `${at}/open`;
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
    });
    page.on('pageerror', (error) => {
      const rows = failures.get('PAGE') ?? [];
      rows.push(`${at}: ${error.message}`);
      failures.set('PAGE', rows);
      if (failFast) void page.close().catch(() => undefined);
    });
    await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForFunction('window.layoutProbe !== undefined');
    const inventory = /** @type {{ boundaries: number, focus: number }} */ (
      await run(page, '(input) => window.layoutProbe.boot(input)', { ...payload, canvas: viewport })
    );
    phase = `${at}/full-samples`;
    await run(page, 'window.layoutProbe.samples()');
    // A known-bad mount is already refused. Exhaustion buys signal only on a still-viable mount.
    await run(page, 'window.layoutProbe.preflight()');
    if (Object.keys((await resultOf(page)).errors).length === 0) {
      phase = `${at}/properties`;
      await checkProperties(page, run, viewport, network, failFast, require_);
    }
    let viable = Object.keys((await resultOf(page)).errors).length === 0;
    if (viable) {
      for (const direction of ['in', 'out']) {
        for (let start = 0; viable && start < inventory.boundaries; start += 24) {
          phase = `${at}/reveal-${direction}/${String(start)}`;
          await run(page, '(a) => window.layoutProbe.revealBatch(a.start, 24, a.direction)', {
            start,
            direction,
          });
          viable = Object.keys((await resultOf(page)).errors).length === 0;
        }
      }
      for (let start = 0; viable && start < inventory.focus; start += 24) {
        phase = `${at}/focus/${String(start)}`;
        await run(page, '(start) => window.layoutProbe.focusBatch(start, 24)', start);
        viable = Object.keys((await resultOf(page)).errors).length === 0;
      }
    } else {
      // Block placement/capping still needs a focus reading after a failed full-view predicate.
      const opioid = sets.findIndex((s) => s.key === 'concept:opioid-therapy');
      await run(page, '(start) => window.layoutProbe.focusBatch(start, 1)', opioid);
    }
    if (shots !== undefined && viewport.width !== 343) {
      for (const key of ['full', 'concept:acute-pain', 'concept:opioid-therapy']) {
        phase = `${at}/shot/${key}`;
        await run(page, '(key) => window.layoutProbe.show(key)', key);
        await page.screenshot({ path: resolve(shots, `${at}-${key.replaceAll(':', '_')}.png`) });
        totals['shots'] = (totals['shots'] ?? 0) + 1;
      }
    }
    if (viewport.width === 288) {
      phase = `${at}/R5-pointer-pan`;
      const pan =
        /** @type {{ id: string, before: { x: number, y: number }, distance: number }} */ (
          await run(page, 'window.layoutProbe.panStart()')
        );
      const mouse = page.mouse;
      let remaining = pan.distance;
      while (remaining > 0) {
        const distance = Math.min(remaining, viewport.height / 2);
        await mouse.move(viewport.width - 4, viewport.height - 30);
        await mouse.down();
        await mouse.move(viewport.width - 4, viewport.height - 30 - distance, { steps: 12 });
        await mouse.up();
        remaining -= distance;
      }
      await run(page, 'window.layoutProbe.paint()');
      await run(page, '(a) => window.layoutProbe.panEnd(a.id, a.before)', pan);
    }
    phase = `${at}/R6-taps`;
    const targets =
      /** @type {{ id: string, dot: { x: number, y: number }, label: { x: number, y: number }, empty: { x: number, y: number }, before: number } | null} */ (
        await run(page, 'window.layoutProbe.interactionTargets()')
      );
    if (targets !== null) {
      const pointer = page.mouse;
      let selectionCount = targets.before;
      for (const kind of ['dot', 'label', 'empty']) {
        const p = kind === 'dot' ? targets.dot : kind === 'label' ? targets.label : targets.empty;
        await pointer.click(p.x, p.y);
        selectionCount = /** @type {number} */ (
          await run(page, '(a) => window.layoutProbe.selection(a.expected, a.before)', {
            expected: kind === 'empty' ? null : targets.id,
            before: selectionCount,
          })
        );
      }
    }
    const result = await resultOf(page);
    collect(result, at);
    if (viable) {
      require_(
        result.counts['focusViews'] === inventory.focus,
        'R2',
        `${at}: focus inventory not exhausted`,
      );
      for (const direction of ['in', 'out'])
        require_(
          result.counts[`boundaries-${direction}`] === inventory.boundaries * 2,
          'R3',
          `${at}: reveal ${direction} inventory not exhausted`,
        );
    }
    for (const [key, value] of Object.entries(result.counts))
      totals[key] = (totals[key] ?? 0) + value;
    await run(page, 'window.layoutProbe.reset()');
    await page.close();
    console.log(
      `layout-check: ${at}: ${String(result.counts['shownSets'] ?? 0)} shown sets; ${String(result.counts['focusViews'] ?? 0)} focus views; ${viable ? 'exhausted' : 'early rejection'}`,
    );
  }
  // Independent second mount: sentinel label/block ink is absent from every other element.
  phase = 'R3PX/open';
  const page = await browser.newPage({
    viewport: { width: 1152, height: 660 },
    deviceScaleFactor: 1,
  });
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.layoutProbe !== undefined');
  await run(page, '(input) => window.layoutProbe.boot(input)', {
    ...payload,
    sentinel: true,
    canvas: { width: 1152, height: 660, dpr: 1 },
  });
  const cases = /** @type {{ labels: string[], boundaries: { id: string, reveal: number }[] }} */ (
    await run(page, 'window.layoutProbe.pixelCases()')
  );
  /** @param {string} id @param {number} z @param {boolean} block @param {boolean} expected */
  const pixel = async (id, z, block, expected) => {
    phase = `R3PX/${id}/${String(z)}`;
    await run(page, '(a) => window.layoutProbe.pixelPrepare(a.id, a.z, a.block)', { id, z, block });
    const row = /** @type {{ inside: number, outside: number, layers: number }} */ (
      await run(page, '(a) => window.layoutProbe.pixelRead(a.id, a.block)', { id, block })
    );
    require_(
      row.layers > 0 && (expected ? row.inside > 0 : row.inside === 0) && row.outside === 0,
      'R3PX',
      `${id}@${String(z)} expected=${String(expected)} sentinel ink inside=${String(row.inside)} outside=${String(row.outside)} layers=${String(row.layers)}`,
    );
    totals['pixelReads'] = (totals['pixelReads'] ?? 0) + 1;
  };
  for (const id of cases.labels) await pixel(id, 1, false, true);
  await run(page, 'window.layoutProbe.pixelMode("block")');
  await pixel('opioid-therapy', 1, true, true);
  await run(page, 'window.layoutProbe.pixelMode("label")');
  for (const { id, reveal } of cases.boundaries) {
    await pixel(id, reveal - 1e-9 * reveal, false, false);
    await pixel(id, reveal, false, true);
  }
  collect(await resultOf(page), 'sentinel');
  await run(page, 'window.layoutProbe.reset()');
  await page.close();
  require_(totals['pixelReads'] === 13, 'R3PX', 'pixel inventory did not run all 13 readings');
  require_(
    shots === undefined || totals['shots'] === 6,
    'R4',
    'screenshot inventory did not produce six states',
  );
} catch (cause) {
  const predicate = failedPredicate(cause);
  if (predicate) {
    const rows = failures.get(predicate.rule) ?? [];
    rows.push(`${phase}: ${predicate.detail}`);
    failures.set(predicate.rule, rows);
  } else if (!timedOut)
    failures.set('HARNESS', [
      `${phase}: ${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}`,
    ]);
} finally {
  phase = 'cleanup';
  try {
    await cleanup();
  } catch (cause) {
    failures.set('EXIT', [`cleanup failed: ${String(cause)}`]);
  }
  clearTimeout(timer);
}
console.log(`layout-check: wall=${((performance.now() - started) / 1000).toFixed(3)}s`);
for (const [rule, rows] of failures)
  for (const row of rows) console.error(`layout-check: ${rule}: ${row}`);
if (failures.size > 0) {
  console.error(`layout-check: FAIL ${String(failures.size)} predicates`);
  process.exitCode = timedOut || [...failures.keys()].some((rule) => !PREDICATES.has(rule)) ? 3 : 1;
} else if (timedOut) process.exitCode = 3;
else
  console.log(
    `layout-check: R1-R3/R5-R6 hold; wall=${((performance.now() - started) / 1000).toFixed(3)}s; ${JSON.stringify(totals)}; timeout control refused control/hang; ${shots === undefined ? 'R4 captures not requested' : 'six R4 captures written (inspection required)'}`,
  );
const exitGuard = setTimeout(() => {
  console.error(`layout-check: EXIT: event loop live ${String(GRACE)} ms after teardown`);
  process.exit(3);
}, GRACE);
exitGuard.unref();
