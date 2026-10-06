// `pnpm visual-qa` — every interaction state of the built demo at 320, 375 and 1280 px,
// measured for horizontal overflow. JSON report on stdout, one PNG per state in `.probe/`,
// exit 1 when any state overflows. Outside `pnpm gate`: it needs a real browser.
// `browser:check` measures 320 px alone, in both locales; this walk adds the wider viewports,
// every boot phase, a run mid-stream, every catalog question's answer, a cancelled run, the graph
// and a failed boot.

import { mkdirSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';

import { questionOf } from './answer-oracle.mjs';
import { failWith, OVERFLOW_PROBE, withBuiltSite } from './browser.mjs';
import { ROOT } from './kb/paths.mjs';

const WIDTHS = [320, 375, 1280];
const BUILT = 'some/nested';
/** The same build with no saved state, so boot fails into the `boot-error` view. */
const IMAGELESS = 'some/imageless';
const TIMEOUT = 60_000;
const OUT = join(ROOT, '.probe');

/** @type {(message: string) => never} */
const fail = failWith('visual-qa');

/** @typedef {{limit: number, scrollWidth: number, worst?: {right: number, at: string}}} Fit */
/** @type {Record<string, {overflow: boolean, limit: number, scrollWidth: number, worst: string | null}>} */
const states = {};

/**
 * @param {import('./browser.mjs').Page} page @param {number} width @param {string} state
 * @returns {Promise<void>}
 */
const measure = async (page, width, state) => {
  const fit = /** @type {Fit} */ (await page.evaluate(OVERFLOW_PROBE));
  states[`${String(width)} ${state}`] = {
    overflow: fit.scrollWidth > fit.limit || fit.worst !== undefined,
    limit: fit.limit,
    scrollWidth: fit.scrollWidth,
    worst:
      fit.worst === undefined ? null : `${fit.worst.at} @ ${String(Math.round(fit.worst.right))}`,
  };
  await page.screenshot({ path: join(OUT, `${String(width)}-${state.replaceAll(' ', '-')}.png`) });
};

/**
 * Click Run — and Cancel as soon as it enables when `cancel` — then resolve once `aria-busy` has
 * gone true and back. The observer is armed before the click, so a run that settles before the
 * next protocol round trip is still seen. Resolves the answer summary.
 *
 * @param {import('./browser.mjs').Page} page @param {boolean} cancel
 * @returns {Promise<string>}
 */
const runAndSettle = async (page, cancel) =>
  String(
    await page.evaluate(`new Promise((resolve) => {
      const region = document.querySelector('section.answer-region');
      let busy = false;
      new MutationObserver(() => {
        if (region.getAttribute('aria-busy') === 'true') busy = true;
        // The summary paints in a later flush than \`aria-busy\`.
        else if (busy) setTimeout(() => resolve(document.querySelector('.summary')?.textContent ?? ''), 50);
      }).observe(region, { attributes: true, attributeFilter: ['aria-busy'] });
      document.querySelector('[data-action="run"]').click();
      if (${String(cancel)}) {
        // Microtask hops, not a timer: the worker's reply is a task and can beat any timeout.
        const cancelButton = document.querySelector('[data-action="cancel"]');
        const hop = (left) => cancelButton.disabled && left > 0
          ? Promise.resolve().then(() => hop(left - 1))
          : cancelButton.click();
        void hop(20);
      }
    })`),
  );

/**
 * @param {import('./browser.mjs').Browser} browser @param {string} url @param {number} width
 * @returns {Promise<void>}
 */
const walk = async (browser, url, width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
  await page.waitForSelector('[data-engine="ready"]', { timeout: TIMEOUT });
  await measure(page, width, 'idle');

  const combobox = page.locator('[role="combobox"]');
  await combobox.click();
  const count = await page.locator('[role="option"]').count();
  if (count === 0) fail(`${String(width)}px: the listbox holds no question`);
  await measure(page, width, 'listbox open');
  await combobox.click();

  for (let index = 0; index < count; index += 1) {
    await combobox.click();
    const option = page.locator(`[role="option"]:nth-of-type(${String(index + 1)})`);
    const id = questionOf(await option.getAttribute('id'), fail);
    await option.click();
    await runAndSettle(page, false);
    await measure(page, width, `answered ${id}`);
    if (index === 0) {
      // The richest page: every disclosure of the first answer open at once.
      await page.locator('.explanation > summary').click();
      await page.locator('.canonical summary').click();
      await page.locator('details.ladder > summary').click();
      await page.waitForSelector('.ladder .disclosures', { timeout: TIMEOUT });
      await page.locator('[data-action="load-page-viewer"]').click();
      await page.waitForSelector('.ladder iframe', { timeout: TIMEOUT });
      await page.locator('details.about summary').click();
      await measure(page, width, 'every disclosure open');
    }
  }

  const status = await runAndSettle(page, true);
  if (!status.startsWith('Cancelled'))
    fail(`${String(width)}px: the run settled before its cancel: ${status}`);
  await measure(page, width, 'run cancelled');

  await page.locator('[data-action="explore-graph"]').click();
  await page.waitForSelector('.graph-shell .counts', { timeout: TIMEOUT });
  await measure(page, width, 'graph explored');
  if (errors.length > 0) fail(`${String(width)}px raised ${errors.join('; ')}`);

  // Control: the same probe over a box planted past the viewport must report the overflow.
  await page.evaluate(
    `document.querySelector('main').append(Object.assign(document.createElement('div'), { style: 'width: ${String(width + 200)}px; height: 1px' }))`,
  );
  const planted = /** @type {Fit} */ (await page.evaluate(OVERFLOW_PROBE));
  if (planted.worst === undefined && planted.scrollWidth <= planted.limit) {
    fail(`control did not fire: a ${String(width + 200)}px box read as fitting ${String(width)}px`);
  }
  await page.close();
};

/** Holds every worker→page message until the walk releases it, so each boot phase stays put. */
const HOLD_WORKER_MESSAGES = `(() => {
  window.__held = [];
  const add = Worker.prototype.addEventListener;
  Worker.prototype.addEventListener = function (type, listener, options) {
    if (type !== 'message') return add.call(this, type, listener, options);
    return add.call(this, type, (event) => {
      window.__held.push(() => listener.call(this, event));
    }, options);
  };
})()`;

/**
 * Every boot phase status, then a run after its second streamed answer, each measured while the
 * worker's next message is held.
 *
 * @param {import('./browser.mjs').Browser} browser @param {string} url @param {number} width
 * @returns {Promise<void>}
 */
const bootPhases = async (browser, url, width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript(HOLD_WORKER_MESSAGES);
  await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
  /** @type {string[]} */
  const phases = [];
  while ((await page.locator('[data-engine="ready"]').count()) === 0) {
    await page.waitForFunction('window.__held.length > 0', undefined, { timeout: TIMEOUT });
    const phase = String(await page.evaluate("document.querySelector('main').dataset.bootPhase"));
    phases.push(phase);
    await measure(page, width, `boot ${phase}`);
    await page.evaluate('window.__held.shift()()');
  }
  if (phases.join(' ') !== 'start fetch load verify') {
    fail(`${String(width)}px: boot passed ${phases.join(' ')}`);
  }
  // Then a run held after its second streamed answer: the busy region with partial statements.
  await page.locator('[role="combobox"]').click();
  // Four answers, so the second leaves the run mid-stream.
  await page.locator('[role="option"][id$="-option-opioid-safety"]').click();
  await page.locator('[data-action="run"]').click();
  for (let released = 0; released < 2; released += 1) {
    await page.waitForFunction('window.__held.length > 0', undefined, { timeout: TIMEOUT });
    await page.evaluate('window.__held.shift()()');
  }
  await page.waitForFunction('window.__held.length > 0', undefined, { timeout: TIMEOUT });
  const busy = await page.locator('section.answer-region[aria-busy="true"] .answer-point').count();
  if (busy === 0) fail(`${String(width)}px: no streamed answer showed while the run was busy`);
  await measure(page, width, 'answer streaming');
  await page.close();
};

/**
 * @param {import('./browser.mjs').Browser} browser @param {string} url @param {number} width
 * @returns {Promise<void>}
 */
const bootError = async (browser, url, width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(url, { waitUntil: 'load', timeout: TIMEOUT });
  await page.waitForSelector('[data-engine="error"]', { timeout: TIMEOUT });
  await measure(page, width, 'boot failed');
  await page.close();
};

mkdirSync(OUT, { recursive: true });
await withBuiltSite(
  { tool: 'visual-qa', fail, nested: BUILT },
  async ({ root, origin, browser }) => {
    await cp(join(ROOT, 'dist'), join(root, IMAGELESS), {
      recursive: true,
      filter: (source) => !/\/kb-[^/]+\.pvm$/u.test(source),
    });
    for (const width of WIDTHS) {
      await bootPhases(browser, `${origin}/${BUILT}/`, width);
      await walk(browser, `${origin}/${BUILT}/`, width);
      await bootError(browser, `${origin}/${IMAGELESS}/`, width);
    }
  },
);

const overflowing = Object.entries(states).filter(([, state]) => state.overflow);
console.log(JSON.stringify({ widths: WIDTHS, states }, null, 1));
if (overflowing.length > 0) {
  fail(
    `${String(overflowing.length)} states overflow: ${overflowing.map(([name]) => name).join(', ')}`,
  );
}
console.error(
  `visual-qa: ok — ${String(Object.keys(states).length)} states across ${WIDTHS.join('/')} px, ` +
    `none overflows; control: a planted over-wide box read as overflow at each width; PNGs in ` +
    `.probe/`,
);
