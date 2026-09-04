// `pnpm contrast:check` — prove every colour pair the UI actually renders meets
// its WCAG 2.2 threshold.
//
// The pairs are DECLARED rather than discovered. A checker that walks the
// rendered DOM cannot run in this gate, because the jsdom project has no canvas
// and axe-core reports every `color-contrast` result as `incomplete`. Declaring
// the pairs also keeps the check honest in the other direction: a combination
// that never co-occurs on screen is not evidence of anything, so it is absent.
//
// Usage: node tools/contrast.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './kb/paths.mjs';

const CSS = join(ROOT, 'src/app.css');

/** SC 1.4.3 normal text. */
const NORMAL = 4.5;
/** SC 1.4.3 large text (≥24px, or ≥18.66px bold) and SC 1.4.11 non-text. */
const LARGE = 3;

/**
 * Every foreground/background pair the shipped UI renders, with the use site it
 * stands for. `min` is the threshold that applies to that site, not the highest
 * one available: holding a 1px border to 4.5:1 would force a darker rule than
 * the design needs and prove nothing SC 1.4.11 asks for.
 *
 * @type {{fg: string, bg: string, min: number, where: string}[]}
 */
const PAIRS = [
  { fg: '--text', bg: '--surface', min: NORMAL, where: 'body text on the page' },
  { fg: '--text-muted', bg: '--surface', min: NORMAL, where: 'status line, colophon, legend' },
  { fg: '--text', bg: '--surface-raised', min: NORMAL, where: 'combobox and listbox text' },
  { fg: '--text-muted', bg: '--surface-raised', min: NORMAL, where: 'combobox prompt and caret' },
  { fg: '--text', bg: '--surface-sunken', min: NORMAL, where: 'disclosure body text' },
  { fg: '--text-muted', bg: '--surface-sunken', min: NORMAL, where: 'disclosure secondary text' },
  { fg: '--action-text', bg: '--action', min: NORMAL, where: 'Run and Cancel button labels' },
  { fg: '--action-text', bg: '--warn', min: NORMAL, where: 'Retry button label' },
  { fg: '--action', bg: '--surface', min: NORMAL, where: 'the h1 wordmark and links' },
  { fg: '--action', bg: '--surface-raised', min: NORMAL, where: 'disclosure summary marker' },
  { fg: '--warn', bg: '--surface', min: NORMAL, where: 'alert text beside its rule' },
  { fg: '--border', bg: '--surface', min: LARGE, where: 'field and panel borders' },
  { fg: '--border', bg: '--surface-raised', min: LARGE, where: 'listbox border against its fill' },
  { fg: '--action', bg: '--surface-raised', min: LARGE, where: 'active option fill boundary' },
  { fg: '--focus-ring', bg: '--surface', min: LARGE, where: 'focus indicator on the page' },
  { fg: '--focus-ring', bg: '--surface-raised', min: LARGE, where: 'focus indicator on a field' },
  { fg: '--action-text', bg: '--action', min: LARGE, where: 'selected option text on its fill' },
];

/**
 * @param {string} css
 * @param {RegExp} selector
 * @param {string} name
 * @returns {Map<string, string>}
 */
const tokenBlock = (css, selector, name) => {
  const body = selector.exec(css)?.[1];
  if (body === undefined) throw new Error(`${CSS}: no ${name} block`);
  /** @type {Map<string, string>} */
  const tokens = new Map();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) tokens.set(name, value.trim());
  }
  return tokens;
};

/**
 * `#rgb` and `#rrggbb` only. Any other notation throws rather than degrading to
 * a guess, so an unparseable colour can never read as a passing pair.
 *
 * @param {string} value @param {string} name @returns {[number, number, number]}
 */
const rgb = (value, name) => {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim())?.[1];
  if (hex === undefined) throw new Error(`${name}: ${value} is not a hex colour`);
  // `replace` rather than a spread: spreading the match group loses its string
  // type, and the doubling callback then reads as `any`.
  const digits = hex.length === 3 ? hex.replace(/./g, (d) => d + d) : hex;
  /** @param {number} i @returns {number} */
  const channel = (i) => Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  return [channel(0), channel(1), channel(2)];
};

/**
 * WCAG relative luminance: sRGB channels linearized, then weighted.
 *
 * @param {number[]} channels @returns {number}
 */
const luminance = (channels) => {
  /** @param {number} c @returns {number} */
  const linear = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** @param {number[]} a @param {number[]} b @returns {number} */
const contrast = (a, b) => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const main = () => {
  const css = readFileSync(CSS, 'utf8');
  const light = tokenBlock(css, /:root\s*\{([^}]*)\}/, ':root');
  const darkOverrides = tokenBlock(
    css,
    /:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/,
    'dark theme',
  );
  const dark = new Map(light);
  for (const [name, value] of darkOverrides) dark.set(name, value);
  if (PAIRS.length === 0) throw new Error('the pair table is empty');

  const failures = [];
  /** @type {[string, Map<string, string>][]} */
  const themes = [
    ['light', light],
    ['dark', dark],
  ];
  for (const [theme, tokens] of themes) {
    for (const { fg, bg, min, where } of PAIRS) {
      const [fgValue, bgValue] = [tokens.get(fg), tokens.get(bg)];
      if (fgValue === undefined) throw new Error(`${fg} is not defined for ${theme}`);
      if (bgValue === undefined) throw new Error(`${bg} is not defined for ${theme}`);
      // Floor rather than round: 4.4999 must not report as 4.5 and pass.
      const ratio = Math.floor(contrast(rgb(fgValue, fg), rgb(bgValue, bg)) * 100) / 100;
      if (ratio < min) {
        failures.push(`${theme}: ${fg} on ${bg} = ${ratio}:1, need ${min}:1 — ${where}`);
      }
    }
  }

  const unused = [...light.keys()].filter(
    (name) => !name.startsWith('--font-') && !PAIRS.some((p) => p.fg === name || p.bg === name),
  );
  if (unused.length > 0) failures.push(`colour tokens in no pair: ${unused.join(', ')}`);

  if (failures.length > 0) {
    console.error(`contrast: ${failures.length} failure(s)`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`contrast: ${String(PAIRS.length * 2)} light/dark pairs pass`);
};

main();
