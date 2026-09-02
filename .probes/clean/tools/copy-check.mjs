// `pnpm copy:check` — hold the demo's human-facing prose to the project's
// register: 20 words per sentence for instructions, 25 for descriptions, and no
// filler words.
//
// The checker is static. There is no TypeScript runner in this repo, and adding
// one to read two string records would cost more than parsing them does. It
// therefore reads the literals out of the source, which also means it grades the
// bytes that ship rather than a re-export of them.
//
// Usage: node tools/copy-check.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './kb/paths.mjs';

/** Words the project bans outright. */
const FILLER = ['simply', 'robust', 'seamlessly', 'leverage'];

/**
 * Graded files. `copy.ts` splits its own buckets; `describe.ts` is every state's
 * reader-facing wording, which is prose by the same rule even though it lives
 * beside logic.
 *
 * @type {{path: string, buckets: {name: string, limit: number}[]}[]}
 */
const SOURCES = [
  {
    path: 'src/demo/copy.ts',
    buckets: [
      { name: 'INSTRUCTIONS', limit: 20 },
      { name: 'DESCRIPTIONS', limit: 25 },
    ],
  },
  { path: 'src/demo/describe.ts', buckets: [{ name: '*', limit: 25 }] },
];

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
  // Standalone literals (`return 'No proof found.'`, template pieces) so
  // `describe.ts` is graded whole rather than only where it uses object keys.
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

const main = () => {
  const failures = [];
  let graded = 0;

  for (const { path, buckets } of SOURCES) {
    const source = readFileSync(join(ROOT, path), 'utf8');
    for (const { name, limit } of buckets) {
      let region = source;
      if (name !== '*') {
        const start = source.indexOf(`export const ${name}`);
        if (start < 0) throw new Error(`${path}: no exported ${name}`);
        const end = source.indexOf('\n} as const;', start);
        if (end < 0) throw new Error(`${path}: ${name} is not a closed record`);
        region = source.slice(start, end);
      }
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

  if (failures.length > 0) {
    console.error(`copy: ${failures.length} failure(s)`);
    for (const line of failures) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`copy: ${graded} strings pass`);
};

main();
