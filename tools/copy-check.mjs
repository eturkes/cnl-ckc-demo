// `pnpm copy:check` — hold the demo's human-facing prose to the project's
// register, and hold the Japanese catalog at parity with the English one.
//
// Two graders, because the two languages admit different decidable rules. English
// grades on sentence length and banned filler. Japanese grades on PARITY alone:
// every English key present, and every value actually rewritten. The word limits
// do not port — Japanese has no word spaces, so `words()` would score every
// sentence as one word and pass anything at all.
//
// The checker is static. There is no TypeScript runner in this repo, and adding
// one to read two string records would cost more than parsing them does. It
// therefore reads the literals out of the source, which also means it grades the
// bytes that ship rather than a re-export of them. Reading the source is also what
// lets `TEXT`, whose entries are functions, be compared across locales at all.
//
// Usage: node tools/copy-check.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './kb/paths.mjs';

/** Words the project bans outright. */
const FILLER = ['simply', 'robust', 'seamlessly', 'leverage'];

const EN = 'src/i18n/en.ts';
const JA = 'src/i18n/ja.ts';

/**
 * Graded buckets, English only. `LABELS` and `TEXT` are chrome and interpolated
 * prose; their limits almost never bind, and the reason to grade them is the
 * banned-filler sweep.
 *
 * @type {{name: string, limit: number}[]}
 */
const BUCKETS = [
  { name: 'INSTRUCTIONS', limit: 20 },
  { name: 'DESCRIPTIONS', limit: 25 },
  { name: 'LABELS', limit: 25 },
  { name: 'TEXT', limit: 25 },
];

/**
 * Keys whose Japanese value is allowed to be byte-identical to its English one.
 *
 * The word limits do NOT port: Japanese has no word spaces, so `words()` would
 * count every sentence as one and pass everything. Parity is what the gate can
 * actually decide — every key present, and every value actually rewritten.
 *
 * @type {Set<string>}
 */
const UNTRANSLATED_OK = new Set();

/**
 * String literals in a source region, with adjacent `'a' + 'b'` concatenations
 * joined so a wrapped sentence grades as one sentence.
 *
 * @param {string} source @returns {{key: string, text: string}[]}
 */
const literals = (source) => {
  const out = [];
  // Import specifiers are paths, not prose.
  const body = source.replace(/^\s*import[^;]*;/gm, '');
  const entry =
    /(?:^|\n)\s*(?:\/\*\*[\s\S]*?\*\/\s*)?([\w]+):\s*((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+)/g;
  for (const [, key, group] of body.matchAll(entry)) {
    if (key === undefined || group === undefined) continue;
    const text = [...group.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(([, s]) => s ?? '').join('');
    out.push({ key, text });
  }
  // Standalone literals, which is how `TEXT`'s arrow bodies and every template
  // piece are reached — the entry pattern above sees quoted values alone.
  for (const [, text] of body.matchAll(/(?:^|[^\w'])(?:'|`)((?:[^'`\\\n]|\\.){12,})(?:'|`)/g)) {
    if (text !== undefined) out.push({ key: '<literal>', text });
  }
  return out;
};

/**
 * Split prose into sentences. A period between digits is a decimal, not a
 * boundary, so `License 1.1.` is one sentence rather than three. The sentinel is
 * a private-use codepoint: a control character would trip `no-control-regex`.
 *
 * @param {string} text @returns {string[]}
 */
const sentences = (text) =>
  text
    .replace(/(\d)\.(\d)/g, '$1\uE000$2')
    .split(/[.!?]+(?=\s|$)/)
    .map((s) => s.replace(/\uE000/g, '.').trim())
    .filter((s) => s !== '');

/**
 * `${...}` renders as one value, so it counts as one word.
 *
 * @param {string} sentence @returns {number}
 */
const words = (sentence) =>
  sentence
    .replace(/\$\{[^}]*\}/g, 'x')
    .split(/\s+/)
    .filter(Boolean).length;

/**
 * One bucket's source text, between its `export const` and its closing `as const`.
 *
 * @param {string} source @param {string} path @param {string} name @returns {string}
 */
const bucket = (source, path, name) => {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`${path}: no exported ${name}`);
  const end = source.indexOf('\n} as const;', start);
  if (end < 0) throw new Error(`${path}: ${name} is not a closed record`);
  return source.slice(start, end);
};

/**
 * A bucket's entries as `key -> its own source slice`, split on the two-space
 * indent that prettier gives every top-level key. Slicing the source rather than
 * the string value is what lets `TEXT`, whose entries are functions, be compared
 * across locales at all.
 *
 * @param {string} region @returns {Map<string, string>}
 */
const entries = (region) => {
  /** @type {Map<string, string>} */
  const out = new Map();
  const starts = [...region.matchAll(/^ {2}(\w+):/gm)];
  for (const [index, match] of starts.entries()) {
    const key = match[1];
    if (key === undefined || match.index === undefined) continue;
    out.set(key, region.slice(match.index, starts[index + 1]?.index ?? region.length));
  }
  return out;
};

/**
 * Every English key present in Japanese, and every Japanese value rewritten.
 *
 * @param {string[]} failures @returns {number} keys compared
 */
const checkParity = (failures) => {
  const en = readFileSync(join(ROOT, EN), 'utf8');
  const ja = readFileSync(join(ROOT, JA), 'utf8');
  let compared = 0;
  for (const { name } of BUCKETS) {
    const source = entries(bucket(en, EN, name));
    const target = entries(bucket(ja, JA, name));
    for (const key of source.keys()) {
      if (!target.has(key)) failures.push(`${JA} ${name}.${key}: missing`);
    }
    for (const key of target.keys()) {
      if (!source.has(key)) failures.push(`${JA} ${name}.${key}: not a key of ${EN}`);
    }
    for (const [key, text] of source) {
      const other = target.get(key);
      if (other === undefined) continue;
      compared += 1;
      if (other === text && !UNTRANSLATED_OK.has(`${name}.${key}`)) {
        failures.push(`${JA} ${name}.${key}: untranslated`);
      }
    }
  }
  return compared;
};

/**
 * `index.html` ships the English title and description, and `locale.svelte.ts`
 * re-authors both from the catalog on every switch. Two sources for one string is a
 * drift seam nothing else can see: the shell would keep serving a title the app
 * replaces on mount, so no rendered assertion would ever disagree with it.
 *
 * @param {string[]} failures @returns {number} shell strings compared
 */
const checkShell = (failures) => {
  const catalog = new Map(
    literals(bucket(readFileSync(join(ROOT, EN), 'utf8'), EN, 'DESCRIPTIONS'))
      .filter(({ key }) => key !== '<literal>')
      .map(({ key, text }) => [key, text]),
  );
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  /** @type {[string, string | undefined][]} */
  const shell = [
    ['documentTitle', /<title>([^<]*)<\/title>/.exec(html)?.[1]],
    ['documentDescription', /name="description"\s+content="([^"]*)"/.exec(html)?.[1]],
  ];
  for (const [key, shipped] of shell) {
    if (shipped === undefined) failures.push(`index.html: no ${key}`);
    else if (shipped.trim() !== catalog.get(key)) {
      failures.push(`index.html ${key} differs from ${EN} DESCRIPTIONS.${key}`);
    }
  }
  return shell.length;
};

const main = () => {
  const failures = [];
  let graded = 0;

  {
    const source = readFileSync(join(ROOT, EN), 'utf8');
    for (const { name, limit } of BUCKETS) {
      const path = EN;
      const region = bucket(source, path, name);
      const found = literals(region);
      if (found.length === 0) throw new Error(`${path}: ${name} yielded no strings to grade`);
      for (const { key, text } of found) {
        graded += 1;
        for (const sentence of sentences(text)) {
          const n = words(sentence);
          if (n > limit) {
            failures.push(`${path} ${name}.${key}: ${n} words, limit ${limit} — "${sentence}"`);
          }
        }
        for (const word of FILLER) {
          if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
            failures.push(`${path} ${name}.${key}: banned word "${word}"`);
          }
        }
      }
    }
  }

  const compared = checkParity(failures);
  const shell = checkShell(failures);

  if (failures.length > 0) {
    console.error(`copy: ${failures.length} failure(s)`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(
    `copy: ${graded} en strings pass, ${compared} ja keys at parity, ` +
      `${shell} shell strings match index.html`,
  );
};

main();
