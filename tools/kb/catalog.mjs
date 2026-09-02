// Question catalog, derived from the vendored bag's exported queries.
//
// Nothing here is transcribed. The four exported goals are the verbatim `goal/1`
// argument of the bag's own compiled query files, and the two repo-authored goals
// are those goals under one declared atom substitution. A hand-written goal table
// would need a second mechanism to police its own drift; deriving costs 0.6 ms.

import { sha256 } from './bag.mjs';

/** Compiled query members. Distinct from `PAYLOAD`: queries never enter the runtime image. */
const QUERY = /^data\/guidelines\/[^/]+\/queries\/pl\/[^/]+\.pl$/;

/**
 * Repo-authored entries, each derived from an exported analog by replacing one
 * atom. The corpus carries near-miss atoms (`category-B-decision`,
 * `evidence-type-2-recommendation`), so replacement is token-exact and
 * single-hit rather than a substring rewrite.
 */
const AUTHORED = [
  { id: 'category-b-recommendations', from: 'category-a-recommendations', was: 'category-A-recommendation', now: 'category-B-recommendation' },
  { id: 'evidence-type-3-recommendation', from: 'evidence-type-1-recommendation', was: 'evidence-type-1-recommendation', now: 'evidence-type-3-recommendation' },
];

/**
 * The exported query ids this catalog is generated against.
 *
 * Goal text is derived, but *which* questions exist is declared: without this set an
 * extra or renamed query file simply enlarges the catalog, `kb:build` and
 * `kb:asset-check` both agree with themselves, and the drift only surfaces one gate
 * step later as a count mismatch in `src/questions/catalog.ts`. A bag that exports a
 * different question set is a deliberate change and must edit this list.
 */
const EXPORTED = [
  'category-a-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'recommendation-exists',
];

const VARIABLE = /^[A-Z_][A-Za-z0-9_]*$/;

/**
 * Index of the closing quote of the token opening at `start`.
 *
 * Prolog doubles a quote to escape it and also honours backslash escapes, so a
 * naive scan for the next quote character splits a term mid-atom.
 *
 * @param {string} text @param {number} start @returns {number}
 */
const closeQuote = (text, start) => {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i += 1) {
    if (text[i] === '\\') i += 1;
    else if (text[i] === quote) {
      if (text[i + 1] !== quote) return i;
      i += 1;
    }
  }
  throw new Error(`unterminated ${String(quote)}-quoted token`);
};

/**
 * Inner text of the bracketed group opening at `open`, and the closing index.
 *
 * @param {string} text @param {number} open @returns {{ inner: string, end: number }}
 */
const balanced = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const char = /** @type {string} */ (text[i]);
    if (char === "'" || char === '"' || char === '`') i = closeQuote(text, i);
    else if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(open + 1, i), end: i };
    }
  }
  throw new Error('unbalanced term');
};

/**
 * Argument text of the first `name(` outside any quoted token.
 *
 * @param {string} text @param {string} name @returns {string}
 */
const argOf = (text, name) => {
  for (let i = 0; i < text.length; i += 1) {
    const char = /** @type {string} */ (text[i]);
    if (char === "'" || char === '"' || char === '`') {
      i = closeQuote(text, i);
      continue;
    }
    if (char !== '(' || text.slice(i - name.length, i) !== name) continue;
    // A functor ends the identifier before it, so a longer name must not match here.
    const before = text[i - name.length - 1] ?? '';
    if (/[A-Za-z0-9_]/.test(before)) continue;
    return balanced(text, i).inner;
  }
  throw new Error(`no ${name}/1 term`);
};

/** @param {string} text @returns {string[]} comma-separated arguments at depth 0 */
const splitArgs = (text) => {
  /** @type {string[]} */ const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = /** @type {string} */ (text[i]);
    if (char === "'" || char === '"' || char === '`') i = closeQuote(text, i);
    else if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  const tail = text.slice(start);
  if (tail.trim() !== '' || parts.length > 0) parts.push(tail);
  return parts.map((part) => part.trim());
};

/**
 * Projection variables the answer term declares. An empty list is an existence
 * question, which the service renders yes/no rather than as an empty row set.
 *
 * @param {string} answers @returns {{ variable: string, descriptor: string }[]}
 */
const parseProjection = (answers) => {
  const list = answers.trim();
  if (!list.startsWith('[') || !list.endsWith(']')) throw new Error(`answers/1 is not a list: ${list}`);
  const inner = list.slice(1, -1).trim();
  if (inner === '') return [];
  return splitArgs(inner).map((item) => {
    if (!item.startsWith('answer(')) throw new Error(`projection item is not answer/2: ${item}`);
    const args = splitArgs(balanced(item, item.indexOf('(')).inner);
    if (args.length !== 2) throw new Error(`answer/${args.length}, expected answer/2`);
    const [variable, descriptor] = /** @type {[string, string]} */ (args);
    if (!VARIABLE.test(variable)) throw new Error(`projection names ${variable}, which is not a variable`);
    return { variable, descriptor };
  });
};

/**
 * Replace exactly one occurrence of `token`.
 *
 * The count is the guard: zero means the substitution targets an atom the source
 * goal never held, and two means the rewrite would change a site nobody declared.
 *
 * @param {string} text @param {string} token @param {string} replacement @param {string} label
 * @returns {string}
 */
const replaceOnce = (text, token, replacement, label) => {
  const hits = text.split(token).length - 1;
  if (hits !== 1) throw new Error(`${label}: ${token} occurs ${hits} times, expected exactly 1`);
  return text.replace(token, replacement);
};

/** @typedef {{ id: string, question: string, goal: string, projection: { variable: string, descriptor: string }[], provenance: 'bag-exported' | 'repo-authored' }} CatalogRecord */

/**
 * @param {string} name bag-relative path, for diagnostics
 * @param {string} text query file source
 * @returns {CatalogRecord}
 */
const parseQuery = (name, text) => {
  const header = text.match(/^'\$guideline_query'\(/m);
  if (header === null) throw new Error(`${name}: no '$guideline_query' term`);
  const id = splitArgs(argOf(text.slice(header.index), "'$guideline_query'"))[1];
  if (id === undefined || !id.startsWith("'") || !id.endsWith("'")) throw new Error(`${name}: query id is not a quoted atom`);

  const question = text.match(/^% Q\d+: (.+)$/m)?.[1];
  if (question === undefined) throw new Error(`${name}: no question comment`);

  const projectionAt = text.indexOf("'$guideline_query_projection'(");
  if (projectionAt === -1) throw new Error(`${name}: no '$guideline_query_projection' term`);
  const projectionArgs = text.slice(projectionAt);
  const goal = argOf(projectionArgs, 'goal').trim();
  if (goal === '') throw new Error(`${name}: empty goal`);

  return {
    id: id.slice(1, -1),
    question,
    goal,
    projection: parseProjection(argOf(projectionArgs, 'answers')),
    provenance: 'bag-exported',
  };
};

/**
 * Build every catalog record from the verified bag file map.
 *
 * @param {Map<string, Uint8Array>} files bag-relative path → bytes
 * @returns {{ records: CatalogRecord[], names: string[], source: string }}
 */
export const catalogRecords = (files) => {
  const names = [...files.keys()].filter((name) => QUERY.test(name)).sort();
  if (names.length === 0) throw new Error('bag carries no compiled queries');

  const source = names
    .map((name) => `\n% file:${name}\n${Buffer.from(/** @type {Uint8Array} */ (files.get(name))).toString('utf8')}`)
    .join('\n');

  const exported = names.map((name) => parseQuery(name, Buffer.from(/** @type {Uint8Array} */ (files.get(name))).toString('utf8')));
  const byId = new Map(exported.map((record) => [record.id, record]));
  if (byId.size !== exported.length) throw new Error('bag carries duplicate query ids');

  const missing = EXPORTED.filter((id) => !byId.has(id));
  const extra = [...byId.keys()].filter((id) => !EXPORTED.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `bag exports query ids [${[...byId.keys()].sort().join(', ')}], expected [${[...EXPORTED].sort().join(', ')}]`,
    );
  }

  const authored = AUTHORED.map(({ id, from, was, now }) => {
    const base = byId.get(from);
    if (base === undefined) throw new Error(`${id}: derives from ${from}, which the bag does not export`);
    return {
      id,
      question: replaceOnce(base.question, was, now, `${id} question`),
      goal: replaceOnce(base.goal, `'${was}'`, `'${now}'`, `${id} goal`),
      projection: base.projection,
      provenance: /** @type {'repo-authored'} */ ('repo-authored'),
    };
  });

  const records = [...exported, ...authored].sort((a, b) => (a.id < b.id ? -1 : 1));
  return { records, names, source };
};

/** @param {CatalogRecord[]} records @returns {string} the emitted artifact, byte-stable across runs */
export const catalogJson = (records) => `${JSON.stringify({ catalogVersion: 1, entries: records }, undefined, 2)}\n`;

/** @param {string} source @returns {string} */
export const catalogDigest = (source) => sha256(Buffer.from(source, 'utf8'));
