// `pnpm presentation:check` — presentation invariants a gate step must own.
//
// Every claim here was true when a reviewer read the files by hand and would stay
// true silently if it stopped being so: a font pin loosened to a range, a face
// losing `font-display: swap`, a shipped OFL drifting from the package it came
// from, a text surface losing the containment that keeps an engine-authored token
// inside a 320px viewport. Each is decidable from source alone, so none of them
// needs a browser or a build to be checked.
//
// Like `tools/contrast.mjs`, the expectations are DECLARED. Discovery would grade
// whatever the CSS happens to say against itself and prove nothing.
//
// Usage: node tools/presentation-check.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { requireFiring } from './control.mjs';
import {
  CATALOG,
  cmapOf,
  expectedPoints,
  originalPath,
  rangeOf,
  shippedUrl,
  SUBSETS,
} from './fonts.mjs';
import { ROOT } from './kb/paths.mjs';

const CSS = join(ROOT, 'src/app.css');

const VAR = '@fontsource-variable';

/**
 * The subset files `dist/` is supposed to carry, one row per `@font-face`.
 *
 * `family` is the name the rule declares — the variable packages' `Variable`
 * suffix is dropped deliberately, so a copy-paste of the package name is a
 * regression. `scope` is per row because the Japanese face is a STATIC weight and
 * ships from `@fontsource`, not `@fontsource-variable`; `marker` is the filename
 * fragment that identifies the row, and it carries its own trailing separator so
 * `-latin-ext-` can never be read as `-latin-`.
 *
 * @type {{scope: string, pkg: string, subset: string, marker: string, family: string}[]}
 */
const FACES = [
  {
    scope: VAR,
    pkg: 'atkinson-hyperlegible-next',
    subset: 'latin',
    marker: '-latin-wght-',
    family: 'Atkinson Hyperlegible Next',
  },
  {
    scope: VAR,
    pkg: 'atkinson-hyperlegible-next',
    subset: 'latin-ext',
    marker: '-latin-ext-wght-',
    family: 'Atkinson Hyperlegible Next',
  },
  {
    scope: VAR,
    pkg: 'atkinson-hyperlegible-mono',
    subset: 'latin',
    marker: '-latin-wght-',
    family: 'Atkinson Hyperlegible Mono',
  },
  {
    scope: VAR,
    pkg: 'atkinson-hyperlegible-mono',
    subset: 'latin-ext',
    marker: '-latin-ext-wght-',
    family: 'Atkinson Hyperlegible Mono',
  },
  { scope: VAR, pkg: 'literata', subset: 'latin', marker: '-latin-wght-', family: 'Literata' },
  {
    scope: VAR,
    pkg: 'literata',
    subset: 'latin-ext',
    marker: '-latin-ext-wght-',
    family: 'Literata',
  },
  {
    scope: '@fontsource',
    pkg: 'biz-udpgothic',
    subset: 'japanese-400',
    marker: '-japanese-400-normal.',
    family: 'BIZ UDPGothic',
  },
  {
    scope: '@fontsource',
    pkg: 'biz-udpgothic',
    subset: 'japanese-700',
    marker: '-japanese-700-normal.',
    family: 'BIZ UDPGothic',
  },
];

/**
 * Shipped licence ↔ the package whose bytes it must reproduce. `shipped` is the file stem
 * under `public/licenses/`, separate from `pkg` so the control can point a row at another
 * package's text and prove the byte comparison still fires.
 *
 * @type {{pkg: string, scope: string, shipped: string}[]}
 */
const LICENCES = [...new Map(FACES.map((f) => [f.pkg, f.scope])).entries()].map(([pkg, scope]) => ({
  pkg,
  scope,
  shipped: pkg,
}));

/**
 * Selectors that render engine-authored text, which arrives as document ids,
 * predicate names and answer values with no spaces to break at. Each must contain
 * that text rather than widen its column, so each carries `overflow-wrap`.
 *
 * @type {{file: string, selectors: string[]}[]}
 */
const CONTAINMENT = [
  { file: 'src/questions/QuestionCombobox.svelte', selectors: ['.box', '.list li'] },
  { file: 'src/demo/RunControls.svelte', selectors: ['.status', '.alert'] },
  {
    file: 'src/demo/AnswerPanel.svelte',
    selectors: ['.answer-point', '.document-id', '.source-card blockquote', '.canonical code'],
  },
  {
    file: 'src/provenance/ProvenanceLadder.svelte',
    selectors: ['.proof-steps li', '.premises li'],
  },
];

/**
 * The three role tokens' font stacks, family by family. Each opens with its self-hosted latin
 * face and the Japanese face — `unicode-range` keeps the latter off latin text, so order is
 * what renders latin in the face chosen for it — then system faces for a failed font load,
 * and ends in the generic family that names the role when every face is missing.
 */
const STACKS = [
  {
    token: '--font-ui',
    stack: [
      "'Atkinson Hyperlegible Next'",
      "'BIZ UDPGothic'",
      'ui-sans-serif',
      "'Segoe UI'",
      'system-ui',
      'sans-serif',
    ],
  },
  {
    token: '--font-prose',
    stack: ["'Literata'", "'BIZ UDPGothic'", "'Iowan Old Style'", 'Palatino', 'Georgia', 'serif'],
  },
  {
    token: '--font-code',
    stack: [
      "'Atkinson Hyperlegible Mono'",
      "'BIZ UDPGothic'",
      'ui-monospace',
      "'SFMono-Regular'",
      'Menlo',
      'monospace',
    ],
  },
];

/**
 * @param {string[]} failures @param {string} css @param {typeof STACKS} declared
 */
const checkStacks = (failures, css, declared) => {
  if (declared.length === 0) {
    failures.push('STACKS table is empty, so no role token fallback stack is graded');
    return;
  }
  for (const { token, stack } of declared) {
    const value = new RegExp(`${token}:\\s*([^;]+);`).exec(css)?.[1];
    if (value === undefined) {
      failures.push(`${token}: not declared in src/app.css`);
      continue;
    }
    const shipped = value.split(',').map((family) => family.trim());
    if (shipped.join(', ') !== stack.join(', ')) {
      failures.push(`${token}: ships [${shipped.join(', ')}], STACKS pins [${stack.join(', ')}]`);
    }
  }
};

/** Values that actually break an unbreakable token; `normal` and `initial` do not. */
const WRAPS = new Set(['anywhere', 'break-word']);

/**
 * Innermost rule blocks, as `[selector list, declarations]`. A body that forbids
 * braces matches nothing but a leaf, so an `@media` wrapper never matches on its
 * own — its prelude trails into the first inner rule's selector text instead,
 * which `selectorsOf` strips. Comments go first: a rule documented above itself
 * would otherwise carry the whole comment in its selector list.
 *
 * @param {string} css @returns {[string, string][]}
 */
const rules = (css) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    ([, prelude = '', body = '']) => [prelude, body],
  );

/** @param {string} prelude @returns {string[]} */
const selectorsOf = (prelude) =>
  (prelude.split('{').at(-1) ?? '').split(',').map((s) => s.replace(/\s+/g, ' ').trim());

/** @param {string} body @param {string} property @returns {string | undefined} */
const declaration = (body, property) =>
  new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]*)`).exec(body)?.[1]?.trim();

/** @param {string} file @returns {string} the `<style>` contents of a Svelte component */
const styleOf = (file) => {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const style = /<style>([\s\S]*)<\/style>/.exec(source)?.[1];
  if (style === undefined) throw new Error(`${file}: no <style> block`);
  return style;
};

/** @param {string[]} failures @param {string} css */
const checkFaces = (failures, css) => {
  // Same `JSON.parse` discipline as `loadManifest`: through `unknown`, so the shape
  // claim is explicit rather than an `any` that lint would refuse.
  const parsed = /** @type {unknown} */ (
    JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  );
  const pins = /** @type {{dependencies?: Record<string, string>}} */ (parsed).dependencies ?? {};
  for (const { pkg, scope } of LICENCES) {
    const pin = pins[`${scope}/${pkg}`];
    if (pin === undefined) failures.push(`${pkg}: not a dependency`);
    // A range would let a reinstall change the shipped glyphs without a diff.
    else if (!/^\d+\.\d+\.\d+$/.test(pin)) failures.push(`${pkg}: pinned to range ${pin}`);
  }

  const faces = rules(css).filter(([prelude]) => prelude.includes('@font-face'));
  if (faces.length !== FACES.length) {
    failures.push(`${faces.length} @font-face rules, expected ${FACES.length}`);
  }

  /** @type {Set<string>} */
  const seen = new Set();
  for (const [, body] of faces) {
    const src = /url\('([^']+)'\)/.exec(body)?.[1];
    const family = declaration(body, 'font-family')?.replace(/'/g, '');
    if (src === undefined) {
      failures.push(`a @font-face declares no url(): ${String(family)}`);
      continue;
    }
    // The declared row is matched on the FILE name, so `-latin-ext-` cannot be
    // read as `-latin-`: the trailing separator is part of the marker.
    // A shipped subset is graded as the package face it was cut from.
    const original = SUBSETS.find((subset) => shippedUrl(subset) === src)?.original ?? src;
    const row = FACES.find(
      (f) => original.startsWith(`${f.scope}/${f.pkg}/`) && original.includes(f.marker),
    );
    if (row === undefined) {
      failures.push(`${src}: no declared face — only a declared subset may ship`);
      continue;
    }
    const file = original;
    const key = `${row.pkg} ${row.subset}`;
    if (seen.has(key)) failures.push(`${key}: declared twice`);
    seen.add(key);
    if (family !== row.family) failures.push(`${key}: font-family ${String(family)}`);
    if (declaration(body, 'font-display') !== 'swap') failures.push(`${key}: no font-display swap`);
    if (declaration(body, 'unicode-range') === undefined) failures.push(`${key}: no unicode-range`);
    try {
      readFileSync(join(ROOT, 'node_modules', file));
    } catch {
      failures.push(`${key}: ${file} is not installed`);
    }
  }
  for (const { pkg, subset } of FACES) {
    if (!seen.has(`${pkg} ${subset}`)) failures.push(`${pkg} ${subset}: no @font-face`);
  }

  // Anything the browser would fetch at render time defeats self-hosting.
  // `s?` inside `(?:…)?` reads as star height 2; both quantifiers are bounded at one
  // character, so there is no backtracking to amplify.
  // eslint-disable-next-line security/detect-unsafe-regex -- both quantifiers are bounded at one character
  const remote = /url\(\s*['"]?(?:https?:)?\/\//.exec(css);
  if (remote !== null) failures.push(`remote url in app.css: ${remote[0]}`);
};

/**
 * Each shipped Japanese subset against the code points the catalog text reaches.
 *
 * @param {string[]} failures @param {string} css @param {string} text the catalog source
 * @param {{shipped: string, original: Set<number>, cmap: Set<number>}[]} read
 */
const checkSubsets = (failures, css, text, read) => {
  const hex = (/** @type {number} */ point) =>
    `U+${point.toString(16).toUpperCase().padStart(4, '0')}`;
  for (const { shipped, original, cmap } of read) {
    const expected = expectedPoints(text, rangeOf(css, shippedUrl({ shipped })), original);
    const missing = expected.filter((point) => !cmap.has(point));
    const extra = [...cmap].filter((point) => !expected.includes(point));
    if (missing.length > 0) {
      failures.push(
        `${shipped} lacks ${missing.map(hex).join(' ')}, which ${CATALOG} uses; run pnpm font:subset`,
      );
    }
    if (extra.length > 0) {
      failures.push(`${shipped} carries ${extra.map(hex).join(' ')}, which nothing reaches`);
    }
  }
};

/** @param {string[]} failures @param {typeof LICENCES} rows */
const checkLicences = (failures, rows) => {
  for (const { pkg, scope, shipped } of rows) {
    const ours = join(ROOT, 'public/licenses', `${shipped}.txt`);
    const packaged = join(ROOT, 'node_modules', scope, pkg, 'LICENSE');
    try {
      if (!readFileSync(ours).equals(readFileSync(packaged))) {
        failures.push(`${shipped}.txt differs from the licence ${pkg} ships`);
      }
    } catch (cause) {
      failures.push(`${pkg}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
};

/**
 * @param {string[]} failures
 * @param {(style: string) => string} [transform] applied to each component's `<style>` block,
 *   so the control can grade the real selectors against a stripped declaration
 */
const checkContainment = (failures, transform = (style) => style) => {
  for (const { file, selectors } of CONTAINMENT) {
    const parsed = rules(transform(styleOf(file)));
    for (const selector of selectors) {
      const matched = parsed.filter(([prelude]) => selectorsOf(prelude).includes(selector));
      if (matched.length === 0) {
        failures.push(`${file}: ${selector} no longer exists`);
        continue;
      }
      const wrap = matched
        .map(([, body]) => declaration(body, 'overflow-wrap'))
        .find((value) => value !== undefined && WRAPS.has(value));
      if (wrap === undefined) failures.push(`${file}: ${selector} has no overflow-wrap`);
    }
  }
};

/** @param {(found: string[]) => void} grade @returns {() => string[]} */
const collect = (grade) => () => {
  /** @type {string[]} */
  const found = [];
  grade(found);
  return found;
};

const main = async () => {
  const css = readFileSync(CSS, 'utf8');
  const text = readFileSync(join(ROOT, CATALOG), 'utf8');
  const read = await Promise.all(
    SUBSETS.map(async (subset) => ({
      shipped: subset.shipped,
      original: await cmapOf(originalPath(subset)),
      cmap: await cmapOf(join(ROOT, subset.shipped)),
    })),
  );
  // A kanji the original maps and the catalog never uses: added to the catalog text, the
  // committed subset must be refused as stale by that code point.
  const planted = [...(read[0]?.original ?? [])].find(
    (point) => point >= 0x4e00 && point <= 0x9fff && !read[0]?.cmap.has(point),
  );
  if (planted === undefined) throw new Error('no kanji outside the subset to plant');
  const plantedHex = `U+${planted.toString(16).toUpperCase()}`;

  // One control per declared table, each breaking the input that table grades.
  const controls = [
    requireFiring(
      'presentation',
      {
        mutation: 'one @font-face rule renamed out of app.css',
        expect: ['@font-face rules, expected 8'],
      },
      collect((found) => checkFaces(found, css.replace('@font-face', 'zz-font-face'))),
    ),
    requireFiring(
      'presentation',
      {
        mutation: 'each shipped licence compared against the next package',
        expect: ['differs from the licence'],
      },
      collect((found) =>
        checkLicences(
          found,
          LICENCES.map((row, index) => ({
            ...row,
            shipped: (LICENCES[(index + 1) % LICENCES.length] ?? row).pkg,
          })),
        ),
      ),
    ),
    requireFiring(
      'presentation',
      {
        mutation: "--font-code's generic family dropped from app.css",
        expect: ['--font-code: ships ['],
      },
      collect((found) => checkStacks(found, css.replace(/Menlo,\s*monospace;/u, 'Menlo;'), STACKS)),
    ),
    requireFiring(
      'presentation',
      {
        mutation: `${plantedHex} added to ${CATALOG} without pnpm font:subset`,
        expect: [`lacks ${plantedHex}, which ${CATALOG} uses`],
      },
      collect((found) => checkSubsets(found, css, `${text}${String.fromCodePoint(planted)}`, read)),
    ),
    requireFiring(
      'presentation',
      { mutation: 'the STACKS table emptied', expect: ['STACKS table is empty'] },
      collect((found) => checkStacks(found, css, [])),
    ),
    requireFiring(
      'presentation',
      {
        mutation: 'overflow-wrap stripped from every component style',
        expect: ['has no overflow-wrap'],
      },
      collect((found) =>
        checkContainment(found, (style) => style.replace(/overflow-wrap[^;]*;/g, '')),
      ),
    ),
  ];

  /** @type {string[]} */
  const failures = [];
  checkFaces(failures, css);
  checkSubsets(failures, css, text, read);
  checkLicences(failures, LICENCES);
  checkContainment(failures);
  checkStacks(failures, css, STACKS);

  if (failures.length > 0) {
    console.error(`presentation: ${failures.length} failure(s)`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }
  const contained = CONTAINMENT.reduce((n, { selectors }) => n + selectors.length, 0);
  console.log(
    `presentation: ${FACES.length} faces pinned and installed, ${LICENCES.length} licences ` +
      `byte-equal, ${contained} text surfaces contained, ${STACKS.length} role font stacks pinned, ` +
      `${read.length} Japanese subsets exact to ${CATALOG}, ` +
      `controls: ${controls.join(', ')}`,
  );
};

await main();
