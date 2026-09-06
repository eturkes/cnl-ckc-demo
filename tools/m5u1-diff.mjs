// Differential check: independently derived corpus versus a generated u1 helper.
// It compares record multisets, not formatting, and normalizes the gate's local
// Rule variable while retaining every executable head and exact line number.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE = join(ROOT, 'tests/fixtures/m5u1-reference.json');
const CATEGORIES = ['rule', 'site', 'premise', 'gate'];
const SIMPLE_ATOM = /^[a-z][A-Za-z0-9_]*$/u;

/** @typedef {'rule' | 'site' | 'premise' | 'gate'} Category */
/** @typedef {{ expected: number, actual: number, missing: string[], unexpected: string[] }} CategoryDiff */
/** @typedef {{ key: string, document: string, sentence: number, fragment: string, premises: string[], sites: Array<{ line: number, head: string, groundHead: string }> }} CorpusRecord */
/** @typedef {{ recordOrder: string[], records: Record<string, CorpusRecord> }} Corpus */

/** @param {string} source @param {number} start */
const quotedEnd = (source, start) => {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') index += 2;
    else if (source[index] === quote) {
      if (source[index + 1] === quote) index += 2;
      else return index + 1;
    } else index += 1;
  }
  throw new Error(`unterminated quoted term at ${String(start)}`);
};

/** @param {string} source */
const stripComments = (source) => {
  let result = '';
  for (let index = 0; index < source.length;) {
    const char = /** @type {string} */ (source[index]);
    if (char === "'" || char === '"' || char === '`') {
      const end = quotedEnd(source, index);
      result += source.slice(index, end);
      index = end;
    } else if (char === '%') {
      const end = source.indexOf('\n', index);
      index = end < 0 ? source.length : end;
    } else {
      result += char;
      index += 1;
    }
  }
  return result;
};

/** @param {string} source */
const statements = (source) => {
  const clean = stripComments(source);
  /** @type {string[]} */
  const result = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (char === "'" || char === '"' || char === '`') {
      index = quotedEnd(clean, index) - 1;
      continue;
    }
    if (char === '(') round += 1;
    else if (char === ')') round -= 1;
    else if (char === '[') square += 1;
    else if (char === ']') square -= 1;
    else if (char === '{') curly += 1;
    else if (char === '}') curly -= 1;
    else if (char === '.' && round === 0 && square === 0 && curly === 0) {
      const statement = clean.slice(start, index).trim();
      if (statement !== '') result.push(statement);
      start = index + 1;
    }
    if (round < 0 || square < 0 || curly < 0) throw new Error('unbalanced helper source');
  }
  if (round !== 0 || square !== 0 || curly !== 0) throw new Error('unbalanced helper source');
  if (clean.slice(start).trim() !== '') throw new Error('helper source lacks a final full stop');
  return result;
};

/** @param {string} source */
const compact = (source) => {
  let result = '';
  for (let index = 0; index < source.length;) {
    const char = /** @type {string} */ (source[index]);
    if (char === "'" || char === '"' || char === '`') {
      const end = quotedEnd(source, index);
      result += source.slice(index, end);
      index = end;
    } else {
      if (!/\s/u.test(char)) result += char;
      index += 1;
    }
  }
  return result;
};

/** @param {string} source @param {string} separator */
const splitTopLevel = (source, separator) => {
  /** @type {string[]} */
  const result = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = quotedEnd(source, index) - 1;
      continue;
    }
    if (char === '(') round += 1;
    else if (char === ')') round -= 1;
    else if (char === '[') square += 1;
    else if (char === ']') square -= 1;
    else if (char === '{') curly += 1;
    else if (char === '}') curly -= 1;
    else if (source.startsWith(separator, index) && round === 0 && square === 0 && curly === 0) {
      result.push(source.slice(start, index));
      start = index + separator.length;
      index += separator.length - 1;
    }
  }
  result.push(source.slice(start));
  return result;
};

/** @param {string} source @param {string} name */
const callArguments = (source, name) => {
  const prefix = `${name}(`;
  if (!source.startsWith(prefix) || !source.endsWith(')')) {
    throw new Error(`expected ${name}/?; got ${source}`);
  }
  return splitTopLevel(source.slice(prefix.length, -1), ',');
};

/** @param {string} value */
const atom = (value) => (SIMPLE_ATOM.test(value) ? value : `'${value.replaceAll("'", "''")}'`);

/** @param {CorpusRecord} record */
const expectedGate = (record) =>
  `clinical_gate(${atom(record.document)},${String(record.sentence)},Rule,[${record.sites
    .map(({ line }) => String(line))
    .join(',')}]):-${record.sites
    .map(({ line, head }) => `clinical_use(${String(line)},${head})`)
    .join(',')},clinical_rule(${atom(record.document)},${String(record.sentence)},Rule)`;

/** @param {Corpus} corpus */
const expectedRecords = (corpus) => {
  /** @type {Record<Category, string[]>} */
  const expected = { rule: [], site: [], premise: [], gate: [] };
  for (const key of corpus.recordOrder) {
    const record = corpus.records[key];
    if (record === undefined) throw new Error(`${key}: fixture record missing`);
    const doc = atom(record.document);
    const sentence = String(record.sentence);
    expected.rule.push(`clinical_rule(${doc},${sentence},${record.fragment})`);
    record.sites.forEach(({ line, groundHead }) =>
      expected.site.push(`clinical_site(${doc},${sentence},${String(line)},${groundHead})`),
    );
    record.premises.forEach((premise, ordinal) =>
      expected.premise.push(`clinical_premise(${doc},${sentence},${String(ordinal)},${premise})`),
    );
    expected.gate.push(expectedGate(record));
  }
  return expected;
};

/** Canonicalize the gate's local variable name while preserving its binding. @param {string} source */
const canonicalGate = (source) => {
  const halves = splitTopLevel(source, ':-');
  if (halves.length !== 2) throw new Error(`gate must contain one rule separator: ${source}`);
  const head = callArguments(/** @type {string} */ (halves[0]), 'clinical_gate');
  if (head.length !== 4) throw new Error(`clinical_gate arity=${String(head.length)}`);
  const variable = head[2] ?? '';
  if (!/^[A-Z_][A-Za-z0-9_]*$/u.test(variable))
    throw new Error(`gate Rule is not a variable: ${variable}`);
  const body = splitTopLevel(/** @type {string} */ (halves[1]), ',');
  if (body.length < 2) throw new Error('gate body has no site chain');
  const rule = callArguments(/** @type {string} */ (body.at(-1)), 'clinical_rule');
  if (rule.length !== 3 || rule[0] !== head[0] || rule[1] !== head[1] || rule[2] !== variable) {
    throw new Error('gate does not close through its own clinical_rule');
  }
  for (const use of body.slice(0, -1)) {
    if (callArguments(use, 'clinical_use').length !== 2) throw new Error(`invalid gate use ${use}`);
  }
  head[2] = 'Rule';
  rule[2] = 'Rule';
  return `clinical_gate(${head.join(',')}):-${[
    ...body.slice(0, -1),
    `clinical_rule(${rule.join(',')})`,
  ].join(',')}`;
};

/** @param {string} source */
const actualRecords = (source) => {
  /** @type {Record<Category, string[]>} */
  const actual = { rule: [], site: [], premise: [], gate: [] };
  /** @type {string[]} */
  const malformed = [];
  for (const raw of statements(source)) {
    const statement = compact(raw);
    /** @type {Category | undefined} */
    const category = statement.startsWith('clinical_rule(')
      ? 'rule'
      : statement.startsWith('clinical_site(')
        ? 'site'
        : statement.startsWith('clinical_premise(')
          ? 'premise'
          : statement.startsWith('clinical_gate(')
            ? 'gate'
            : undefined;
    if (category === undefined) continue;
    try {
      actual[category].push(category === 'gate' ? canonicalGate(statement) : statement);
    } catch (error) {
      malformed.push(`${error instanceof Error ? error.message : String(error)} :: ${statement}`);
    }
  }
  return { actual, malformed };
};

/** @param {string[]} values @returns {Map<string, number>} */
const multiset = (values) => {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

/** @param {Map<string, number>} left @param {Map<string, number>} right */
const subtract = (left, right) => {
  /** @type {string[]} */
  const result = [];
  for (const [value, count] of left) {
    const remaining = count - (right.get(value) ?? 0);
    for (let index = 0; index < remaining; index += 1) result.push(value);
  }
  return result;
};

/** @param {Corpus} corpus @param {string} source */
export const differential = (corpus, source) => {
  const expected = expectedRecords(corpus);
  const { actual, malformed } = actualRecords(source);
  /** @type {Record<Category, CategoryDiff>} */
  const categories = {
    rule: { expected: 0, actual: 0, missing: [], unexpected: [] },
    site: { expected: 0, actual: 0, missing: [], unexpected: [] },
    premise: { expected: 0, actual: 0, missing: [], unexpected: [] },
    gate: { expected: 0, actual: 0, missing: [], unexpected: [] },
  };
  let divergences = malformed.length;
  for (const category of /** @type {Category[]} */ (CATEGORIES)) {
    const missing = subtract(multiset(expected[category]), multiset(actual[category]));
    const unexpected = subtract(multiset(actual[category]), multiset(expected[category]));
    categories[category] = {
      expected: expected[category].length,
      actual: actual[category].length,
      missing,
      unexpected,
    };
    divergences += missing.length + unexpected.length;
  }
  return { divergences, categories, malformed };
};

/** @param {Corpus} corpus */
const syntheticSource = (corpus) =>
  Object.values(expectedRecords(corpus))
    .flat()
    .map((statement) => `${statement}.`)
    .join('\n');

/** @param {ReturnType<typeof differential>} result */
const summary = (result) => ({
  divergences: result.divergences,
  categories: Object.fromEntries(
    /** @type {Category[]} */ (CATEGORIES).map((category) => [
      category,
      {
        expected: result.categories[category].expected,
        actual: result.categories[category].actual,
        missing: result.categories[category].missing.length,
        unexpected: result.categories[category].unexpected.length,
      },
    ]),
  ),
  malformed: result.malformed.length,
});

// JSON.parse has an `any` return in the standard library; the fixture is producer-checked.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const corpus = /** @type {Corpus} */ (JSON.parse(readFileSync(FIXTURE, 'utf8')));
const argument = process.argv[2];
if (argument === '--self-test') {
  const source = syntheticSource(corpus);
  const clean = differential(corpus, source);
  if (clean.divergences !== 0)
    throw new Error(`clean synthetic helper diverged: ${JSON.stringify(summary(clean))}`);
  const lines = source.split('\n');
  const removed = lines.filter((_, index) => ![0, 48, 734, 1080].includes(index)).join('\n');
  const mutant = differential(corpus, removed);
  if (mutant.divergences !== 4)
    throw new Error(`four-deletion mutant was not detected: ${JSON.stringify(summary(mutant))}`);
  console.log(JSON.stringify({ clean: summary(clean), fourDeletionMutant: summary(mutant) }));
} else {
  if (argument === undefined) throw new Error('usage: node tools/m5u1-diff.mjs <helper-source>');
  const result = differential(corpus, readFileSync(resolve(argument), 'utf8'));
  console.log(JSON.stringify(summary(result)));
  if (result.divergences !== 0) process.exitCode = 1;
}
