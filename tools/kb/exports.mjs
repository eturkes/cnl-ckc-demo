// The legacy export lane, read side: which questions the upstream corpus exported, and the
// exact statement the compiled KB must answer each one with.
//
// `queries/` is not in the PVM — `payloadSource`'s payload pattern admits
// `data/guidelines/*/pl/*.pl` alone — so the lane reads its goals out of the verified bag at
// run time and runs them against the shipped image. Nothing new is compiled in.
//
// Nothing here reaches the committed answer oracles. `kb:asset-check` bans that reach over
// `tools/`, and the ban is what keeps the demo's answers a derivation rather than a lookup,
// so the byte comparison lives in `tests/` and `kb:export-check` requires it to have run.

import { createHash } from 'node:crypto';

/**
 * The exported question ids, declared rather than discovered.
 *
 * Deriving the set from the bag would let an added or renamed query file enlarge the lane
 * with a check that agrees with itself. Goal TEXT still comes from the bag; only membership
 * is declared.
 */
export const EXPORTED = Object.freeze([
  'category-a-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'recommendation-exists',
]);

/** The suite holding the byte oracle. `binding:check` requires each of its cases to pass. */
export const LANE_SUITE = 'tests/legacy-export-lane.test.ts';

const QUERY_PATH = /^data\/guidelines\/[^/]+\/queries\/pl\/([^/]+)\.pl$/u;
/**
 * `ace_to_pl` writes one projection statement per query on a single line, the goal in
 * canonical prefix form. Anchoring the whole line refuses any other shape rather than
 * guessing at it; the greedy first group is unambiguous because `,answers(` closes the term.
 */
const PROJECTION = /^'\$guideline_query_projection'\(goal\((.*)\),answers\((\[.*\])\)\)\.$/u;
const PROJECTED = /\banswer\(([A-Z_][A-Za-z0-9_]*)/gu;
/** Variables `statementGoal` owns. A compiled ACE goal names single letters. */
const RESERVED = /\bLane[A-Za-z0-9_]*/u;

/**
 * @typedef {object} ExportedQuery
 * @property {string} id declared export id
 * @property {string} path bag-relative path of the compiled query
 * @property {string} sha256 digest of that file — the query identity the oracle records
 * @property {string} goal the goal term, canonical prefix form
 * @property {string[]} projected the reported variables, in `answers/1` order
 */

/** @param {string} detail @returns {never} */
const refuse = (detail) => {
  throw new Error(`legacy export lane: ${detail}`);
};

/**
 * @param {string} id
 * @param {string} path
 * @param {Uint8Array} bytes
 * @returns {ExportedQuery}
 */
const parseQuery = (id, path, bytes) => {
  const line = Buffer.from(bytes)
    .toString('utf8')
    .split('\n')
    .find((candidate) => candidate.startsWith("'$guideline_query_projection'("));
  if (line === undefined) refuse(`${id} carries no goal projection`);
  const match = PROJECTION.exec(/** @type {string} */ (line));
  if (match === null) refuse(`${id} projection has an unsupported shape`);
  const goal = /** @type {string} */ (/** @type {RegExpExecArray} */ (match)[1]);
  const answers = /** @type {string} */ (/** @type {RegExpExecArray} */ (match)[2]);
  if (RESERVED.test(goal)) refuse(`${id} names a variable the lane reserves`);
  const projected = [...answers.matchAll(PROJECTED)].map(([, name]) => /** @type {string} */ (name));
  if (answers !== '[]' && projected.length === 0) refuse(`${id} projects nothing it reports`);
  return { id, path, sha256: createHash('sha256').update(bytes).digest('hex'), goal, projected };
};

/**
 * The declared exports, read out of a verified bag.
 *
 * Refuses a bag whose exported set differs from `EXPORTED`, naming every offending id.
 *
 * @param {Map<string, Uint8Array>} files bag-relative path → bytes
 * @returns {ExportedQuery[]} one record per declared export, in `EXPORTED` order
 */
export const exportedQueries = (files) => {
  /** @type {Map<string, string>} id → bag path */
  const found = new Map();
  for (const path of files.keys()) {
    const match = QUERY_PATH.exec(path);
    if (match === null) continue;
    const id = /** @type {string} */ (match[1]);
    if (found.has(id)) refuse(`${id} is exported by two guidelines`);
    found.set(id, path);
  }
  const unexpected = [...found.keys()].filter((id) => !EXPORTED.includes(id)).sort();
  const missing = EXPORTED.filter((id) => !found.has(id));
  if (unexpected.length > 0 || missing.length > 0) {
    refuse(
      `bag exports differ from the declared set of ${String(EXPORTED.length)}` +
        (unexpected.length > 0 ? `; unexpected [${unexpected.join(', ')}]` : '') +
        (missing.length > 0 ? `; missing [${missing.join(', ')}]` : ''),
    );
  }
  return EXPORTED.map((id) => {
    const path = /** @type {string} */ (found.get(id));
    return parseQuery(id, path, /** @type {Uint8Array} */ (files.get(path)));
  });
};

/**
 * The goal that renders `query`'s live answer statement into `LaneText`.
 *
 * The whole `'$guideline_answers'` envelope is re-derived, not just its solution list:
 * `query_sha256` is the digest of the query file, so the identity the oracle records is
 * recomputed from the bag rather than copied out of the oracle.
 *
 * Solutions sort by SWI standard order over decoded terms, never by rendered bytes —
 * `findall` order follows clause order in the image, which is a build artifact.
 *
 * @param {ExportedQuery} query
 * @returns {string}
 */
export const statementGoal = (query) => {
  const envelope =
    `'$guideline_answers'(v1,'${query.id}',` +
    `query_sha256('${query.sha256}'),result(LaneResult))`;
  const body =
    query.projected.length === 0
      ? `( ( ${query.goal} ) -> LaneResult = yes ; LaneResult = no )`
      : `findall(sol([${query.projected.join(',')}]), ( ${query.goal} ), LaneRaw), ` +
        `msort(LaneRaw, LaneSorted), LaneResult = solutions(LaneSorted)`;
  return `${body}, with_output_to(string(LaneText), writeq(${envelope}))`;
};
