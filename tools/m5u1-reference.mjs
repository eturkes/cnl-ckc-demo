// Independent M5 u1 reference derived from the verified bag payload.
// Production imports are limited to the frozen catalog surface; enumeration,
// antecedent extraction, premise grounding, and term rendering live here.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from './kb/bag.mjs';
import { CLINICAL_QUESTIONS } from './kb/clinical.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PROLOG = /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/u;

/** @typedef {{ line: number, head: string, body: string }} Site */
/** @typedef {{ question: string, document: string, sentence: number, original: string, sites: Site[], antecedent: string }} Case */

/** @returns {Map<string, Uint8Array>} */
const bagFiles = () => {
  const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) throw new Error(`expected one vendored bag, found ${archives.length}`);
  return verifyBag(readFileSync(join(ROOT, 'kb', /** @type {string} */ (archives[0])))).files;
};

/** Reimplement `payloadDocuments` so its source lines are an independent oracle.
 * @param {Map<string, Uint8Array>} files */
const payloadSource = (files) => {
  const names = [...files.keys()].filter((name) => PROLOG.test(name)).sort();
  if (names.length === 0) throw new Error('bag carries no compiled Prolog payload');
  return names
    .map(
      (name) =>
        `\n% file:${name}\n${Buffer.from(/** @type {Uint8Array} */ (files.get(name))).toString('utf8')}`,
    )
    .join('\n');
};

/** @param {string} line */
const splitClause = (line) => {
  const boundary = line.indexOf(' :- ');
  return boundary < 0
    ? { head: line.slice(0, -1), body: 'true' }
    : { head: line.slice(0, boundary), body: line.slice(boundary + 4, -1) };
};

/** @param {Map<string, Uint8Array>} files @returns {Case[]} */
export const referenceCases = (files) => {
  const selected = new Map(
    CLINICAL_QUESTIONS.flatMap((question) =>
      question.sources.map(({ document }) => [document, question.id]),
    ),
  );
  if (
    selected.size !== CLINICAL_QUESTIONS.reduce((sum, question) => sum + question.sources.length, 0)
  ) {
    throw new Error('clinical catalog selects a document more than once');
  }

  /** @type {Case[]} */
  const cases = [];
  /** @type {Case | undefined} */
  let current;
  let document = '';
  for (const [index, line] of payloadSource(files).split('\n').entries()) {
    const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
    if (file !== null) {
      document = file[1] ?? '';
      current = undefined;
      continue;
    }
    const marker = /^% S([1-9][0-9]*): (.*)$/u.exec(line);
    if (marker !== null) {
      const sentence = Number(marker[1]);
      const question = selected.get(document);
      current =
        question === undefined || sentence <= 1
          ? undefined
          : {
              question,
              document,
              sentence,
              original: marker[2] ?? '',
              sites: [],
              antecedent: '',
            };
      if (current !== undefined) cases.push(current);
      continue;
    }
    if (current === undefined || !line.startsWith('guideline_')) continue;
    current.sites.push({ line: index + 1, ...splitClause(line) });
  }

  for (const item of cases) {
    if (item.sites.length === 0) {
      throw new Error(`${item.document}:S${String(item.sentence)} has no content site`);
    }
    const bodies = [...new Set(item.sites.map(({ body }) => body))];
    if (bodies.length !== 1) {
      throw new Error(
        `${item.document}:S${String(item.sentence)} has ${bodies.length} antecedents`,
      );
    }
    item.antecedent = /** @type {string} */ (bodies[0]);
  }
  return cases;
};

/** @param {Case[]} cases */
export const referenceSummary = (cases) => {
  /** @type {Record<string, { sites: number, sentences: Record<string, number> }>} */
  const documents = {};
  for (const item of cases) {
    const row = (documents[item.document] ??= { sites: 0, sentences: {} });
    row.sites += item.sites.length;
    row.sentences[String(item.sentence)] = item.sites.length;
  }
  return {
    sites: cases.reduce((sum, item) => sum + item.sites.length, 0),
    sentences: cases.length,
    distinctAntecedents: new Set(cases.map(({ antecedent }) => antecedent)).size,
    documents,
  };
};

const main = () => {
  const command = process.argv[2] ?? 'summary';
  if (command !== 'summary') throw new Error(`unknown command ${command}`);
  console.log(JSON.stringify(referenceSummary(referenceCases(bagFiles()))));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
