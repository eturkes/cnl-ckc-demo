// `pnpm presentation:check` — the presentation invariants u7 argued in prose and
// no gate step owned (M1 review U7-19, U7-20, U7-26).
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

import { ROOT } from './kb/paths.mjs';

const CSS = join(ROOT, 'src/app.css');
const SCOPE = '@fontsource-variable';

/**
 * The six subset files `dist/` is supposed to carry, one row per `@font-face`.
 * `family` is the name the rule declares — the packages' `Variable` suffix is
 * dropped deliberately, so a copy-paste of the package name is a regression.
 *
 * @type {{pkg: string, subset: string, family: string}[]}
 */
const FACES = [
  { pkg: 'atkinson-hyperlegible-next', subset: 'latin', family: 'Atkinson Hyperlegible Next' },
  { pkg: 'atkinson-hyperlegible-next', subset: 'latin-ext', family: 'Atkinson Hyperlegible Next' },
  { pkg: 'atkinson-hyperlegible-mono', subset: 'latin', family: 'Atkinson Hyperlegible Mono' },
  { pkg: 'atkinson-hyperlegible-mono', subset: 'latin-ext', family: 'Atkinson Hyperlegible Mono' },
  { pkg: 'literata', subset: 'latin', family: 'Literata' },
  { pkg: 'literata', subset: 'latin-ext', family: 'Literata' },
];

/** Shipped licence ↔ the package whose bytes it must reproduce. */
const LICENCES = [...new Set(FACES.map((f) => f.pkg))];

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
];

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
  for (const pkg of LICENCES) {
    const pin = pins[`${SCOPE}/${pkg}`];
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
    const file = src.startsWith(`${SCOPE}/`) ? src : undefined;
    if (file === undefined) {
      failures.push(`${src}: not a ${SCOPE} file — fonts must self-host`);
      continue;
    }
    // The declared row is matched on the FILE name, so `-latin-ext-` cannot be
    // read as `-latin-`: the trailing separator is part of the marker.
    const row = FACES.find(
      (f) => src.startsWith(`${SCOPE}/${f.pkg}/`) && src.includes(`-${f.subset}-wght-`),
    );
    if (row === undefined) {
      failures.push(`${src}: no declared face — only latin and latin-ext may ship`);
      continue;
    }
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
  const remote = /url\(\s*['"]?(?:https?:)?\/\//.exec(css);
  if (remote !== null) failures.push(`remote url in app.css: ${remote[0]}`);
};

/** @param {string[]} failures */
const checkLicences = (failures) => {
  for (const pkg of LICENCES) {
    const shipped = join(ROOT, 'public/licenses', `${pkg}.txt`);
    const packaged = join(ROOT, 'node_modules', SCOPE, pkg, 'LICENSE');
    try {
      if (!readFileSync(shipped).equals(readFileSync(packaged))) {
        failures.push(`${pkg}.txt differs from the licence ${pkg} ships`);
      }
    } catch (cause) {
      failures.push(`${pkg}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
};

/** @param {string[]} failures */
const checkContainment = (failures) => {
  for (const { file, selectors } of CONTAINMENT) {
    const parsed = rules(styleOf(file));
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

const main = () => {
  const css = readFileSync(CSS, 'utf8');
  /** @type {string[]} */
  const failures = [];
  checkFaces(failures, css);
  checkLicences(failures);
  checkContainment(failures);

  if (failures.length > 0) {
    console.error(`presentation: ${failures.length} failure(s)`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }
  const contained = CONTAINMENT.reduce((n, { selectors }) => n + selectors.length, 0);
  console.log(
    `presentation: ${FACES.length} faces pinned and installed, ${LICENCES.length} licences ` +
      `byte-equal, ${contained} text surfaces contained`,
  );
};

main();
