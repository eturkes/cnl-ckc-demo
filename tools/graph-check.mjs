#!/usr/bin/env node
// Grades the shipped graph renderer against the edge-view contract R1-R7 of
// `.agent/contracts/m5u8.md`.
//
// Outside `pnpm gate` on the `pnpm smoke` precedent: it needs a real browser. Nothing in the
// vitest suites can stand in — `semantic-graph.dom.test.ts` mocks the adapter away and jsdom
// has no canvas, so rendered curves, rendered label text and selection state are invisible
// there.
//
// `node tools/graph-check.mjs [--shots <dir>]`.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { answerDocuments } from './answer-oracle.mjs';
import { failWith, launch } from './browser.mjs';
import { ROOT } from './kb/paths.mjs';

const GENERATED = join(ROOT, 'kb/generated');
const CONFIG = join(ROOT, 'tools/graph-probe/vite.config.mjs');
const TIMEOUT = 120_000;
/**
 * The shipped `.graph-shell .canvas` box at a 1280x900 and a 320x720 device. The probe stage
 * is the whole viewport, so sizing the viewport to the box makes every fit zoom the
 * product's own; a device-sized run overstates each label by ~1.4x.
 */
const VIEWPORTS = [
  { name: 'desktop', width: 1152, height: 558 },
  { name: 'mobile', width: 296, height: 384 },
];
/**
 * The DEVICES whose canvas boxes `VIEWPORTS` are.
 *
 * `app.html` mounts the whole component, which computes its own box from the page container,
 * so there the device size is the input and the box an output. `.agent/contracts/m5u10.md`.
 */
const DEVICES = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 320, height: 720 },
];
/** `canvas.ts` floors the fit here; a settled label may never come out below it. */
const MIN_LABEL_PX = 11;
/** Files that must not name the renderer, and the pattern that would say they do. */
const SEAM = ['src/graph/model.ts', 'src/graph/index.ts', 'src/graph/SemanticGraph.svelte'];
const RENDERER = /cytoscape|fcose/iu;

/** @type {(message: string) => never} */
const fail = failWith('graph-check');

// `JSON.parse` is typed `any`; routing it through `unknown` keeps every cast below an
// explicit, checkable claim. Same pattern as `tools/kb/paths.mjs`.
/** @param {string} path @returns {unknown} */
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/**
 * The 12 answer contributions, built the way `tests/graph-live.test.ts` builds them: the
 * cited documents come from the bag, the sentences and lines from each provenance chunk.
 *
 * @returns {import('../src/graph/model.js').GraphFocusToken[]}
 */
const focusTokens = () => {
  const catalog = /** @type {{ entries: { id: string, question: string }[] }} */ (
    readJson(join(GENERATED, 'question-catalog.json'))
  );
  const questions = new Map(catalog.entries.map((entry) => [entry.id, entry.question]));
  const tokens = [];
  for (const [id, documents] of answerDocuments(fail)) {
    const question = questions.get(id);
    if (question === undefined) fail(`catalog has no question text for ${id}`);
    for (const document of documents) {
      const chunk =
        /** @type {{ ace: { text: string, sentences: { number: number }[] }, clauses: { line: number, sentence: number | null }[] }} */ (
          readJson(join(GENERATED, 'provenance/documents', `${document}.json`))
        );
      const sentences = chunk.ace.sentences.slice(1).map(({ number }) => number);
      const lines = sentences.flatMap((sentence) => {
        const clause = chunk.clauses.find((candidate) => candidate.sentence === sentence);
        return clause === undefined ? [] : [clause.line];
      });
      tokens.push({ document, sentences, lines, question, answer: chunk.ace.text });
    }
  }
  return tokens;
};

/** @returns {Promise<{ url: string, stop: () => void }>} */
const devServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'vite', '--config', CONFIG, '--host', '127.0.0.1'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stop = () => {
      child.kill('SIGTERM');
    };
    let seen = '';
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`vite printed no URL:\n${seen.slice(-800)}`));
    }, 60_000);
    const scan = (/** @type {unknown} */ chunk) => {
      seen += String(chunk);
      const url = /(http:\/\/127\.0\.0\.1:\d+\/)/u.exec(seen)?.[1];
      if (url === undefined) return;
      clearTimeout(timer);
      resolve({ url, stop });
    };
    child.stdout.on('data', scan);
    child.stderr.on('data', scan);
  });

/**
 * @param {import('./browser.mjs').Browser} browser
 * @param {string} url
 * @param {{ width: number, height: number }} viewport
 * @param {unknown} tokens
 */
const openProbe = async (browser, url, viewport, tokens) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (/** @type {Error} */ error) => fail(`page raised ${error.message}`));
  await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
  await page.evaluate(`window.graphProbe.boot(${JSON.stringify(tokens)})`);
  return page;
};

/** @type {string[]} */
const violations = [];
/** @param {boolean} ok @param {string} rule @param {string} detail */
const require_ = (ok, rule, detail) => {
  if (!ok) violations.push(`${rule}: ${detail}`);
};

/**
 * C1-C7 over one component reading.
 *
 * A pure grader, because the C2/C6 firing input below re-runs the SAME function over a sweep
 * whose selection callback was detached and requires it to refuse — a grader reached only
 * through the live campaign could not be fired at all.
 *
 * @param {import('./graph-probe/app.svelte.js').InteractionReading} row
 * @param {string} at
 * @returns {string[]}
 */
const gradeInteractions = (row, at) => {
  /** @type {string[]} */
  const out = [];
  /** @param {boolean} ok @param {string} rule @param {string} detail */
  const req = (ok, rule, detail) => {
    if (!ok) out.push(`${rule}: ${at}: ${detail}`);
  };
  const n = (/** @type {number} */ value) => String(value);

  req(row.cyNodes > 0 && row.cyEdges > 0, 'C1', `the renderer drew ${n(row.cyNodes)} nodes`);
  req(row.counts !== '', 'C1', 'the ready header reported no counts');
  req(
    row.answerView === (row.view === 'answer'),
    'C1',
    `an answer focus reads ${String(row.answerView)} in the ${row.view} view`,
  );

  req(
    row.missResults === 0 && row.missReported,
    'C2',
    `"${row.missQuery}" returned ${n(row.missResults)} results`,
  );
  req(row.searchResults > 0, 'C2', `"${row.searchQuery}" matched nothing`);
  req(
    row.searchCard === row.searchChosen,
    'C2',
    `chose ${row.searchChosen}, card ${row.searchCard}`,
  );
  req(row.searchEmitted !== '', 'C2', 'a chosen search result emitted no selection');
  req(
    row.searchCanvasSelected === row.searchChosen,
    'C2',
    `chose ${row.searchChosen}, canvas selects ${row.searchCanvasSelected}`,
  );

  req(
    row.pathSteps >= 2,
    'C3',
    `the panel listed ${n(row.pathSteps)} steps for "${row.pathQuery}"`,
  );
  req(
    row.pathCanvasNodes === row.pathSteps,
    'C3',
    `${n(row.pathCanvasNodes)} highlighted nodes for ${n(row.pathSteps)} listed steps`,
  );
  req(
    row.pathCanvasEdges === row.pathSteps - 1,
    'C3',
    `${n(row.pathCanvasEdges)} highlighted edges for ${n(row.pathSteps)} listed steps`,
  );
  req(row.pathStatus !== '', 'C3', 'the path panel announced nothing');
  req(
    row.clearedPanel && row.clearedCanvasPath === 0,
    'C3',
    `Clear left ${n(row.clearedCanvasPath)} highlighted elements`,
  );

  const counts = row.expandRounds.map((round) => round.nodes);
  req(row.expandRounds.length > 0, 'C4', 'no expand round ran');
  req(
    counts.every((value, index) => index === 0 || value >= (counts[index - 1] ?? 0)),
    'C4',
    `expanding lowered the drawn node count: ${counts.map(n).join(' → ')}`,
  );
  req(
    row.expandRounds.at(-1)?.enabled === false,
    'C4',
    `expand stayed enabled after ${n(row.expandRounds.length)} rounds`,
  );

  req(
    Math.abs(row.zoomPerturbed - row.zoomFitted) > 0.01,
    'C5',
    'the probe could not move the viewport off the fit, so recentering had nothing to undo',
  );
  req(row.recenterMoved, 'C5', `recentering left the viewport at ${row.zoomPerturbed.toFixed(3)}`);
  req(
    row.recenterRelaidOut === 0,
    'C5',
    `recentering moved ${n(row.recenterRelaidOut)} nodes, so it re-ran the layout`,
  );
  if (row.view === 'concept') {
    req(row.recenterSelectedOnScreen, 'C5', 'recentering left the selection off the canvas');
  } else {
    req(
      Math.abs(row.zoomRecentered - row.zoomFitted) < 0.01,
      'C5',
      `fitting the answer read ${row.zoomRecentered.toFixed(3)} against a fit of ${row.zoomFitted.toFixed(3)}`,
    );
  }

  req(row.tapCard === row.tapNode, 'C6', `tapped ${row.tapNode}, card reads ${row.tapCard}`);
  req(
    row.tapCanvasSelected === row.tapNode,
    'C6',
    `tapped ${row.tapNode}, canvas selects ${row.tapCanvasSelected}`,
  );
  req(row.tapEmitted !== '', 'C6', 'a canvas tap emitted no selection');

  req(
    row.indexEntries === row.indexCanvasNodes,
    'C7',
    `the index lists ${n(row.indexEntries)} of the canvas's ${n(row.indexCanvasNodes)} nodes`,
  );
  req(
    row.indexCurrent === row.indexCard,
    'C7',
    `aria-current ${row.indexCurrent}, card ${row.indexCard}`,
  );
  req(
    row.indexChosenCard === row.indexChosen,
    'C7',
    `chose ${row.indexChosen}, card reads ${row.indexChosenCard}`,
  );
  req(
    row.indexChosenCanvas === row.indexChosen,
    'C7',
    `chose ${row.indexChosen}, canvas selects ${row.indexChosenCanvas}`,
  );
  return out;
};

// R6 is decidable without a browser: the seam is a source census.
for (const file of SEAM) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  require_(!RENDERER.test(source), 'R6', `${file} names the renderer`);
}
const model = readFileSync(join(ROOT, 'src/graph/model.ts'), 'utf8');
require_(!/^import\s/mu.test(model), 'R6', 'src/graph/model.ts is no longer import-free');
const canvas = readFileSync(join(ROOT, 'src/graph/canvas.ts'), 'utf8');
require_(
  /mountGraphCanvas = async \(\n?\s*container: HTMLElement,\n?\s*onSelect: \(id: string\) => void,/u.test(
    canvas,
  ),
  'R6',
  'the mountGraphCanvas signature moved',
);

/** @param {string} flag @returns {string | undefined} */
const option = (flag) =>
  process.argv.includes(flag)
    ? (process.argv[process.argv.indexOf(flag) + 1] ?? fail(`${flag} needs a path`))
    : undefined;
const shots = option('--shots');
const report = option('--report');
if (shots !== undefined) mkdirSync(shots, { recursive: true });

const tokens = focusTokens();
const dev = await devServer();
/** @type {import('./browser.mjs').Browser | undefined} */
let browser;
/** @type {Record<string, unknown>[]} */
const readings = [];
/** @type {(import('./graph-probe/app.svelte.js').InteractionReading & { device: string })[]} */
const components = [];
/** @type {Record<string, unknown>[]} */
const fallbacks = [];
try {
  browser = await launch(fail);
  for (const viewport of VIEWPORTS) {
    const page = await openProbe(browser, dev.url, viewport, tokens);
    const views = /** @type {string[]} */ (await page.evaluate('window.graphProbe.views()'));
    require_(
      views.length === tokens.length + 2,
      'fixtures',
      `${String(views.length)} fixtures for ${String(tokens.length)} contributions + 2`,
    );
    for (const view of views) {
      const row = /** @type {import('./graph-probe/probe.js').Reading} */ (
        await page.evaluate(
          `window.graphProbe.render(${JSON.stringify(view)}, ${JSON.stringify(viewport.name === 'mobile' ? 'dark' : 'light')})`,
        )
      );
      const at = `${viewport.name}/${view}`;
      require_(
        row.parallelSeparated === row.parallelPairs,
        'R1',
        `${at}: ${String(row.parallelSeparated)}/${String(row.parallelPairs)} parallel pairs separated`,
      );
      require_(row.labelMismatches.length === 0, 'R2', `${at}: ${row.labelMismatches.join(', ')}`);
      require_(
        row.labelledOffPath === 0,
        'R2',
        `${at}: ${String(row.labelledOffPath)} labelled edges outside the proof path`,
      );
      require_(row.selectableElements === 0, 'R3', `${at}: a tap can select an element`);
      require_(
        row.highlightAfterTap === row.highlightBeforeTap,
        'R3',
        `${at}: tapping moved the highlight ${String(row.highlightBeforeTap)} → ${String(row.highlightAfterTap)}`,
      );
      require_(row.tapDelivered, 'R3', `${at}: a tap reached no selection callback`);
      require_(row.dashedEdges === 0, 'R4', `${at}: ${String(row.dashedEdges)} edges dash already`);
      require_(
        row.labelPx >= MIN_LABEL_PX - 0.01,
        'R5',
        `${at}: settled at ${row.labelPx.toFixed(2)} px, floor ${String(MIN_LABEL_PX)}`,
      );
      require_(row.truncatedLabels.length === 0, 'R7', `${at}: ${row.truncatedLabels.join(', ')}`);
      require_(
        row.wrapModes.length === 1 && row.wrapModes[0] === 'wrap',
        'R7',
        `${at}: node labels render as ${row.wrapModes.join('/')}, not wrap`,
      );
      require_(
        row.labelsMeasured > 0,
        'R7',
        `${at}: the renderer measured no label, so nothing was graded`,
      );
      require_(row.paletteMismatches.length === 0, 'palette', `${at}: ${row.paletteMismatches[0]}`);
      readings.push({ viewport: viewport.name, ...row });
      if (shots === undefined) continue;
      await page.screenshot({
        path: join(shots, `${view.replace(/[^a-z0-9-]+/giu, '_')}-${viewport.name}.png`),
      });
    }
    const flip =
      /** @type {{ before: string, after: string, restored: string, moved: number, mismatches: number }} */ (
        await page.evaluate('window.graphProbe.themeFlip()')
      );
    require_(
      flip.after !== flip.before && flip.restored === flip.before,
      'theme',
      `${viewport.name}: a theme flip read ${flip.before} → ${flip.after} → ${flip.restored}`,
    );
    require_(
      flip.mismatches === 0,
      'theme',
      `${viewport.name}: ${String(flip.mismatches)} colours off-token in the flipped theme`,
    );
    require_(
      flip.moved === 0,
      'theme',
      `${viewport.name}: a theme flip moved ${String(flip.moved)} nodes, so it remounted`,
    );
    const dash = /** @type {{ before: number, during: number, after: number }} */ (
      await page.evaluate('window.graphProbe.dashControl()')
    );
    require_(
      dash.before === 0 && dash.during === 1 && dash.after === 0,
      'R4',
      `${viewport.name}: per-edge dashing reads ${String(dash.before)}/${String(dash.during)}/${String(dash.after)}`,
    );
  }

  // The component half. `index.html` above mounts the adapter; `app.html` mounts the shipped
  // `SemanticGraph.svelte` over the same asset, which is the only place the component's state
  // and the renderer's output can be read against each other. `.agent/contracts/m5u10.md`.
  const answerFocus = tokens[0] ?? fail('the bag yielded no answer focus');
  for (const device of DEVICES) {
    const page = await browser.newPage({
      viewport: { width: device.width, height: device.height },
    });
    page.on('pageerror', (/** @type {Error} */ error) => fail(`app probe raised ${error.message}`));
    await page.goto(`${dev.url}app.html`, { waitUntil: 'load', timeout: TIMEOUT });
    /** @param {string} call @returns {Promise<unknown>} */
    const run = (call) => page.evaluate(`window.componentProbe.${call}`);

    /** @type {{ view: 'concept' | 'answer', focus: unknown }[]} */
    const sweeps = [
      { view: 'concept', focus: null },
      { view: 'answer', focus: answerFocus },
    ];
    for (const { view, focus } of sweeps) {
      const row = /** @type {import('./graph-probe/app.svelte.js').InteractionReading} */ (
        await run(`interactions(${JSON.stringify(view)}, ${JSON.stringify(focus)})`)
      );
      for (const violation of gradeInteractions(row, `${device.name}/${view}`)) {
        violations.push(violation);
      }
      components.push({ device: device.name, ...row });
      if (shots !== undefined) {
        await page.screenshot({ path: join(shots, `component-${view}-${device.name}.png`) });
      }
    }

    // Firing input for every grader above: the same sweep with the component's selection
    // callback detached. C2 and C6 are the two predicates only the callback can satisfy, so a
    // grader that stopped reading passes this and a working one refuses it by name.
    const control = /** @type {import('./graph-probe/app.svelte.js').InteractionReading} */ (
      await run('interactions("concept", null, {"emit":false})')
    );
    const refused = gradeInteractions(control, `${device.name}/control`);
    require_(
      refused.some((line) => line.startsWith('C2:')) &&
        refused.some((line) => line.startsWith('C6:')),
      'control',
      `${device.name}: a detached selection callback drew ${String(refused.length)} refusals, none naming C2 and C6`,
    );

    const load = /** @type {import('./graph-probe/app.svelte.js').LoadFallbackReading} */ (
      await run('loadFallback()')
    );
    const at = device.name;
    require_(load.retryPresent, 'C9', `${at}: a failed load offered no retry control`);
    require_(load.namesCause, 'C9', `${at}: the alert named no cause — ${load.alert}`);
    require_(load.recovered !== '', 'C9', `${at}: retrying never reached the ready header`);
    require_(load.rendererAfterRetry, 'C9', `${at}: retrying reached ready with no renderer`);

    const palette = /** @type {import('./graph-probe/app.svelte.js').PaletteFallbackReading} */ (
      await run('paletteFallback()')
    );
    require_(palette.counts !== '', 'C10', `${at}: the model itself failed to load`);
    require_(!palette.renderer, 'C10', `${at}: a refused palette still mounted a renderer`);
    require_(
      palette.unnamedTokens.length === 0,
      'C10',
      `${at}: the notice names none of ${palette.unnamedTokens.join(', ')}`,
    );
    require_(palette.relations > 0, 'C10', `${at}: the HTML relation view lists nothing`);
    require_(palette.nodeIndex > 0, 'C10', `${at}: the HTML node index lists nothing`);
    fallbacks.push({ device: device.name, ...load, ...palette });
  }
} finally {
  await browser?.close();
  dev.stop();
}

if (report !== undefined) {
  writeFileSync(report, `${JSON.stringify({ readings, components, fallbacks }, null, 1)}\n`);
}

const number = (/** @type {string} */ key) =>
  readings.map((row) => Number(row[key])).sort((a, b) => a - b);
const total = (/** @type {string} */ key) => number(key).reduce((sum, value) => sum + value, 0);
const median = (/** @type {number[]} */ values) =>
  values.length % 2 === 1
    ? (values[(values.length - 1) / 2] ?? 0)
    : ((values[values.length / 2 - 1] ?? 0) + (values[values.length / 2] ?? 0)) / 2;

// A green run has to prove it graded something. Every rule above passes on an empty campaign,
// so the counts the summary prints are themselves required to be non-zero.
require_(total('parallelPairs') > 0, 'R1', 'no fixture carried a parallel pair');
require_(
  total('labelsMeasured') === total('nodes'),
  'R7',
  `${String(total('labelsMeasured'))} of ${String(total('nodes'))} labels reached the renderer`,
);
require_(
  components.length === DEVICES.length * 2,
  'C11',
  `${String(components.length)} component sweeps for ${String(DEVICES.length)} devices x 2 views`,
);
require_(
  fallbacks.length === DEVICES.length,
  'C11',
  `${String(fallbacks.length)} fallback sweeps for ${String(DEVICES.length)} devices`,
);
// Expanding is allowed to add nothing on a view that was never truncated, so the guarantee
// that the control does anything at all is a campaign-level count.
const expanded = components.filter(
  (row) => (row.expandRounds.at(-1)?.nodes ?? 0) > (row.expandRounds[0]?.nodes ?? 0),
).length;
const taps = components.filter((row) => row.tapEmitted !== '').length;
require_(expanded > 0, 'C4', 'no view raised its drawn node count on expand');
require_(taps > 0, 'C6', 'no canvas tap reached the selection callback');

if (violations.length > 0) {
  for (const violation of violations) console.error(`graph-check: ${violation}`);
  fail(`${String(violations.length)} contract violations over ${String(readings.length)} views`);
}

console.log(
  `graph-check: R1-R7 and the palette hold over ${String(readings.length)} rendered views — ` +
    `${String(total('parallelSeparated'))}/${String(total('parallelPairs'))} parallel pairs separated, ` +
    `${String(total('labelsMeasured'))} node labels drawn whole, ` +
    `labels ${(number('labelPx')[0] ?? 0).toFixed(2)}-${(number('labelPx').at(-1) ?? 0).toFixed(2)} px ` +
    `over a ${String(MIN_LABEL_PX)} px floor, worst view ${String(number('labelOverlaps').at(-1) ?? 0)} ` +
    `label overlaps, median ${median(number('settleMs')).toFixed(0)} ms to settle`,
);
console.log(
  `graph-check: C1-C11 hold over ${String(components.length)} component sweeps and ` +
    `${String(fallbacks.length)} fallback sweeps — ` +
    `${String(components.reduce((sum, row) => sum + row.cyNodes, 0))} nodes drawn from the ` +
    `component's own state, ${String(expanded)} views expanded, ${String(taps)} canvas taps ` +
    `delivered, both fallbacks kept the HTML relation view, ` +
    `control: a detached selection callback refused by C2 + C6`,
);
