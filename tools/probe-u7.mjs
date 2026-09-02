#!/usr/bin/env node
// u7 surface probe: drives the built demo in a real browser and reports the
// rendered-state inventory, responsive overflow, long-text and focus-ring facts
// that u7's accept clause needs measured rather than guessed.
//
// Serving + launcher resolution reuse `tools/smoke.mjs` in shape; this file
// exists because the smoke asserts ONE answer and exits, while a visual-QA pass
// has to walk every state at several widths.
//
// Page functions are passed as FUNCTION OBJECTS, never as strings: Playwright
// evaluates a string as an expression, so a stringified arrow yields a function
// object the protocol cannot serialize and every result comes back undefined.
// Each one therefore inlines its own `cssPath` helper.
//
// Output = JSON on stdout, PNGs in `.probe/`.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOT } from './kb/paths.mjs';

const NESTED = 'some/nested';
const OUT = join(ROOT, '.probe');
const WIDTHS = [320, 375, 1280];
const QUESTIONS = [
  'category-a-recommendations',
  'category-b-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'evidence-type-3-recommendation',
  'recommendation-exists',
];
const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

const resolveGlobal = (pkg) => {
  const globals = join(process.env.PNPM_HOME ?? join(homedir(), '.local/share/pnpm'), 'global');
  for (const dir of readdirSync(globals).sort((a, b) => Number(b) - Number(a))) {
    const entry = join(globals, dir, 'node_modules', pkg);
    if (existsSync(entry)) return pathToFileURL(entry).href;
  }
  throw new Error(`${pkg} missing from ${globals}`);
};

const serve = (root, block) =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = normalize(decodeURI((request.url ?? '/').split('?')[0] ?? '/'));
      const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
      const ok = file.startsWith(root) && existsSync(file) && !(block && path.includes(block));
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
      resolve({ port: server.address().port, close: () => server.close() });
    });
  });

// ---- page functions ----

const overflowFn = () => {
  const cssPath = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.className && typeof n.className === 'string')
        s += '.' + n.className.trim().split(/\s+/).join('.');
      const role = n.getAttribute && n.getAttribute('role');
      if (role) s += '[role=' + role + ']';
      parts.unshift(s);
    }
    return parts.join('>');
  };
  const de = document.documentElement;
  const limit = de.clientWidth;
  const horizontal = [];
  const selfClipped = [];
  for (const el of document.querySelectorAll('main, main *, [role=listbox], [role=listbox] *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > limit + 0.5 || r.left < -0.5)
      horizontal.push({
        sel: cssPath(el),
        left: +r.left.toFixed(1),
        right: +r.right.toFixed(1),
        width: +r.width.toFixed(1),
        overBy: +(r.right - limit).toFixed(1),
        text: (el.textContent || '').trim().slice(0, 50),
      });
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
      selfClipped.push({
        sel: cssPath(el),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
  }
  const main = document.querySelector('main');
  const cs = main ? getComputedStyle(main) : null;
  const content = main
    ? +(
        main.getBoundingClientRect().width -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight)
      ).toFixed(1)
    : null;
  return {
    innerWidth: window.innerWidth,
    docScrollWidth: de.scrollWidth,
    docClientWidth: de.clientWidth,
    documentOverflows: de.scrollWidth > de.clientWidth + 0.5,
    mainWidth: main ? +main.getBoundingClientRect().width.toFixed(1) : null,
    mainPaddingX: cs ? cs.paddingLeft + '/' + cs.paddingRight : null,
    mainPaddingTop: cs ? cs.paddingTop : null,
    mainContentWidth: content,
    horizontal,
    selfClipped,
  };
};

const answerFn = () => {
  const sec = document.querySelector('section[aria-labelledby]');
  const main = document.querySelector('main');
  const q = (s) => (sec ? sec.querySelector(s) : null);
  const all = (s) => (sec ? [...sec.querySelectorAll(s)] : []);
  const status = document.querySelector('.status');
  const alert = document.querySelector('.alert');
  return {
    engine: main ? main.dataset.engine : null,
    h1: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
    ariaBusy: sec ? sec.getAttribute('aria-busy') : null,
    heading: q('h2') ? q('h2').textContent : null,
    summary: q('.summary') ? q('.summary').textContent : null,
    hasFieldset: !!q('fieldset'),
    legend: q('legend') ? q('legend').textContent : null,
    radios: all('input[type=radio]').length,
    radioLabels: all('fieldset label span').map((e) => e.textContent),
    dts: all('dt').map((e) => e.textContent),
    dds: all('dd').map((e) => e.textContent),
    canonicalLabel: q('.canonical') ? q('.canonical').childNodes[0].textContent.trim() : null,
    canonical: q('.canonical code') ? q('.canonical code').textContent : null,
    status: status ? status.textContent : null,
    alert: alert ? alert.textContent : null,
    buttons: [...document.querySelectorAll('button')].map((b) => ({
      text: b.textContent,
      disabled: b.disabled,
    })),
    comboText: document.querySelector('[role=combobox]')
      ? document.querySelector('[role=combobox]').textContent.trim()
      : null,
  };
};

const focusFn = (n) => {
  const cssPath = (el) => {
    const parts = [];
    for (let m = el; m && m.nodeType === 1 && parts.length < 3; m = m.parentElement) {
      let s = m.tagName.toLowerCase();
      if (m.className && typeof m.className === 'string')
        s += '.' + m.className.trim().split(/\s+/).join('.');
      const role = m.getAttribute && m.getAttribute('role');
      if (role) s += '[role=' + role + ']';
      parts.unshift(s);
    }
    return parts.join('>');
  };
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { stop: n, sel: null };
  const cs = getComputedStyle(el);
  let bg = 'rgba(0, 0, 0, 0)';
  for (let p = el; p; p = p.parentElement) {
    const c = getComputedStyle(p).backgroundColor;
    if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
      bg = c;
      break;
    }
  }
  return {
    stop: n,
    sel: cssPath(el),
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type'),
    role: el.getAttribute('role'),
    text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
    focusVisible: el.matches(':focus-visible'),
    outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
    outlineOffset: cs.outlineOffset,
    boxShadow: cs.boxShadow,
    elementBg: cs.backgroundColor,
    ringAgainst: bg,
    accentColor: cs.accentColor,
  };
};

const comboFn = () => {
  const box = document.querySelector('[role=combobox]');
  const list = document.querySelector('[role=listbox]');
  const opts = [...document.querySelectorAll('[role=option]')];
  if (!box) return null;
  const cs = getComputedStyle(box);
  const active = opts.find((o) => o.classList.contains('active'));
  const selected = opts.find((o) => o.getAttribute('aria-selected') === 'true');
  const ac = active ? getComputedStyle(active) : null;
  const lc = list ? getComputedStyle(list) : null;
  const lr = list && !list.hidden ? list.getBoundingClientRect() : null;
  return {
    boxText: box.textContent.trim(),
    boxClasses: box.className,
    ariaExpanded: box.getAttribute('aria-expanded'),
    ariaActivedescendant: box.getAttribute('aria-activedescendant'),
    tabindex: box.getAttribute('tabindex'),
    boxColor: cs.color,
    boxBg: cs.backgroundColor,
    boxBorder: cs.borderColor + ' ' + cs.borderWidth,
    boxFont: cs.fontFamily + ' ' + cs.fontSize,
    boxHeight: +box.getBoundingClientRect().height.toFixed(1),
    boxClipped: box.scrollWidth > box.clientWidth + 1,
    listHidden: list ? list.hidden : null,
    listBg: lc ? lc.backgroundColor : null,
    listMaxHeight: lc ? lc.maxHeight : null,
    listScrolls: list ? list.scrollHeight > list.clientHeight + 1 : null,
    listRect: lr
      ? {
          top: +lr.top.toFixed(1),
          bottom: +lr.bottom.toFixed(1),
          height: +lr.height.toFixed(1),
          right: +lr.right.toFixed(1),
        }
      : null,
    viewportHeight: window.innerHeight,
    optionCount: opts.length,
    activeIndex: active ? opts.indexOf(active) : -1,
    activeBg: ac ? ac.backgroundColor : null,
    activeColor: ac ? ac.color : null,
    selectedIndex: selected ? opts.indexOf(selected) : -1,
    selectedMarker: selected ? getComputedStyle(selected, '::after').content : null,
    options: opts.map((o) => ({
      text: o.textContent.trim(),
      height: +o.getBoundingClientRect().height.toFixed(1),
      clipped: o.scrollWidth > o.clientWidth + 1,
      bg: getComputedStyle(o).backgroundColor,
      color: getComputedStyle(o).color,
    })),
  };
};

const tokensFn = () => {
  const cs = getComputedStyle(document.documentElement);
  const names = [
    '--ink',
    '--ink-soft',
    '--paper',
    '--rule',
    '--accent',
    '--modal',
    '--field',
    '--font-prose',
    '--font-ui',
    '--font-code',
  ];
  const vars = {};
  for (const n of names) vars[n] = cs.getPropertyValue(n).trim();
  const sels = [
    'body',
    'main',
    'h1',
    '.lede',
    '.colophon',
    'button',
    'button:disabled',
    '.status',
    '.alert',
    '.intake .label',
    '[role=combobox]',
    '[role=option]',
    '.caret',
    'section h2',
    '.summary',
    'legend',
    'fieldset',
    'fieldset label',
    'dt',
    'dd',
    '.canonical',
    '.canonical code',
  ];
  const fonts = {};
  for (const sel of sels) {
    const el = document.querySelector(sel.replace(':disabled', ''));
    if (!el) {
      fonts[sel] = null;
      continue;
    }
    const c = getComputedStyle(el);
    fonts[sel] = {
      fontFamily: c.fontFamily,
      fontSize: c.fontSize,
      fontWeight: c.fontWeight,
      color: c.color,
      bg: c.backgroundColor,
      overflowWrap: c.overflowWrap,
    };
  }
  return { vars, fonts };
};

/** Computed styles for the answer-panel selectors, which only exist once settled. */
const settledStylesFn = () => {
  const sels = [
    'button',
    'button.retry',
    'section',
    'section h2',
    '.summary',
    'fieldset',
    'legend',
    'fieldset label',
    'fieldset label span',
    'input[type=radio]',
    'dl',
    'dt',
    'dd',
    '.canonical',
    '.canonical code',
  ];
  const out = {};
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) {
      out[sel] = null;
      continue;
    }
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out[sel] = {
      fontFamily: c.fontFamily,
      fontSize: c.fontSize,
      fontWeight: c.fontWeight,
      letterSpacing: c.letterSpacing,
      textTransform: c.textTransform,
      color: c.color,
      bg: c.backgroundColor,
      borderColor: c.borderColor,
      borderWidth: c.borderWidth,
      overflowWrap: c.overflowWrap,
      width: +r.width.toFixed(1),
      height: +r.height.toFixed(1),
      clipped: el.scrollWidth > el.clientWidth + 1,
    };
  }
  const sec = document.querySelector('section[aria-labelledby]');
  const texts = {
    radioLabels: [...sec.querySelectorAll('fieldset label span')].map((e) => e.textContent),
    dts: [...sec.querySelectorAll('dt')].map((e) => e.textContent),
    dds: [...sec.querySelectorAll('dd')].map((e) => e.textContent),
    canonical: sec.querySelector('.canonical code')
      ? sec.querySelector('.canonical code').textContent
      : null,
    status: document.querySelector('.status').textContent,
    options: [...document.querySelectorAll('[role=option]')].map((e) => e.textContent.trim()),
  };
  return { out, texts };
};

/** Tab order from the very top of the document. */
const resetFocusFn = () => {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
};

// ---- driver ----

if (!existsSync(join(ROOT, 'dist', 'index.html'))) execFileSync('pnpm', ['build'], { cwd: ROOT });
mkdirSync(OUT, { recursive: true });

const mode = process.argv[2] ?? 'all';
const root = await mkdtemp(join(tmpdir(), 'cnl-ckc-probe-'));
await cp(join(ROOT, 'dist'), join(root, NESTED), { recursive: true });
const server = await serve(root, mode === 'boot-error' ? '.pvm' : null);
const url = `http://127.0.0.1:${server.port}/${NESTED}/`;
const launcher = await import(`${resolveGlobal('chromiumfish')}/dist/index.js`);
const browser = await launcher.ChromiumFish({ headless: true });
const report = { mode, url, tokens: null, states: {}, combobox: {}, focus: {}, responsive: {} };

const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });

const boot = async (width) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  return { page, errors };
};

const pick = async (page, id) => {
  await page.locator('[role="combobox"]').click();
  await page.locator(`[role="option"][id$="-option-${id}"]`).click();
};

const settle = (page) =>
  page.waitForFunction(
    () =>
      document.querySelector('section[aria-labelledby]').getAttribute('aria-busy') === 'false',
    { timeout: 60_000 },
  );

try {
  if (mode === 'styles') {
    // Longest-text state at the narrowest supported width, plus a full tab walk.
    for (const width of [320, 1280]) {
      const { page } = await boot(width);
      await page.waitForSelector('[data-engine="ready"]', { timeout: 60_000 });
      await pick(page, 'category-a-recommendations');
      await page.getByRole('button', { name: 'Run' }).click();
      await settle(page);
      report.states[`styles:${width}`] = await page.evaluate(settledStylesFn);
      report.responsive[width] = { settled: await page.evaluate(overflowFn) };

      // Clicking a non-focusable element at the top moves the sequential focus
      // navigation starting point there, so the walk begins at the first control.
      // `blur()` alone leaves the starting point wherever the last click put it.
      await page.evaluate(resetFocusFn);
      await page.locator('h1').click();
      const stops = [];
      for (let i = 0; i < 16; i += 1) {
        await page.keyboard.press('Tab');
        const s = await page.evaluate(focusFn, i);
        stops.push(s);
        if (s.sel === null) break;
      }
      report.focus[width] = stops;
      await shot(page, `styles-w${width}`);
      await page.close();
    }
  } else if (mode === 'boot-error') {
    for (const width of WIDTHS) {
      const { page } = await boot(width);
      await page.waitForSelector('[data-engine="error"]', { timeout: 60_000 });
      report.states[`boot-error:${width}`] = await page.evaluate(answerFn);
      report.responsive[width] = await page.evaluate(overflowFn);
      await shot(page, `state-boot-error-w${width}`);
      await page.close();
    }
  } else {
    const { page, errors } = await boot(1280);
    report.states.booting = await page.evaluate(answerFn);
    await page.waitForSelector('[data-engine="ready"]', { timeout: 60_000 });
    report.tokens = await page.evaluate(tokensFn);
    report.states.idle = await page.evaluate(answerFn);
    await shot(page, 'state-idle');

    report.combobox.closed = await page.evaluate(comboFn);
    await page.locator('[role="combobox"]').click();
    report.combobox.open = await page.evaluate(comboFn);
    await shot(page, 'combo-open');
    await page.locator('[role="combobox"]').press('ArrowDown');
    await page.locator('[role="combobox"]').press('ArrowDown');
    report.combobox.activeMoved = await page.evaluate(comboFn);
    await page.locator('[role="combobox"]').press('Escape');
    report.combobox.closedAfterEscape = await page.evaluate(comboFn);
    await pick(page, 'category-a-recommendations');
    report.combobox.selectedClosed = await page.evaluate(comboFn);
    await page.locator('[role="combobox"]').click();
    report.combobox.openWithSelection = await page.evaluate(comboFn);
    await page.locator('[role="option"]').nth(3).hover();
    report.combobox.hovered = await page.evaluate(comboFn);
    await page.locator('[role="combobox"]').press('Escape');
    report.states.idleSelected = await page.evaluate(answerFn);
    await shot(page, 'state-idle-selected');

    // Focus ring on the combobox, reached by keyboard so `:focus-visible` holds.
    await page.keyboard.press('Tab');
    report.combobox.focusRing = await page.evaluate(focusFn, 'combobox');

    for (const id of QUESTIONS) {
      await pick(page, id);
      await page.getByRole('button', { name: 'Run' }).click();
      const running = await page.evaluate(answerFn);
      await settle(page).catch(() => {});
      const settled = await page.evaluate(answerFn);
      report.states[`settled:${id}`] = { running, settled };
      await shot(page, `state-settled-${id}`);
    }

    // Cancel fork: click Run then Cancel in the same tick window.
    await pick(page, 'category-a-recommendations');
    const run = page.getByRole('button', { name: 'Run' });
    await run.click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    report.states.cancelling = await page.evaluate(answerFn);
    await settle(page).catch(() => {});
    report.states['settled:cancelled'] = await page.evaluate(answerFn);
    await shot(page, 'state-cancelled');

    // Tab order + rings on the richest settled state.
    await pick(page, 'category-a-recommendations');
    await page.getByRole('button', { name: 'Run' }).click();
    await settle(page);
    const stops = [];
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(focusFn, i);
      stops.push(s);
      if (s.sel === null) break;
      if (stops.length > 1 && s.sel === stops[0].sel) break;
    }
    report.focus.tabOrder = stops;
    report.focus.pageErrors = errors;
    await page.close();

    for (const width of WIDTHS) {
      const { page: p } = await boot(width);
      await p.waitForSelector('[data-engine="ready"]', { timeout: 60_000 });
      const idle = await p.evaluate(overflowFn);
      await shot(p, `w${width}-idle`);
      await pick(p, 'category-a-recommendations');
      await p.getByRole('button', { name: 'Run' }).click();
      await settle(p);
      const settled = await p.evaluate(overflowFn);
      await shot(p, `w${width}-settled`);
      await p.locator('[role="combobox"]').click();
      const open = await p.evaluate(overflowFn);
      const combo = await p.evaluate(comboFn);
      await shot(p, `w${width}-combo-open`);
      report.responsive[width] = { idle, settled, open, combo };
      await p.close();
    }
  }
  console.log(JSON.stringify(report, null, 1));
} finally {
  await browser.close();
  server.close();
  await rm(root, { recursive: true, force: true });
}
