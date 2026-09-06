// Independent M5 u1 reference derived from the verified bag payload.
// Production imports are limited to the frozen catalog/parser surface; site,
// antecedent, premise, and fragment logic is reimplemented here.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import { verifyBag } from './kb/bag.mjs';
import { CLINICAL_QUESTIONS, parseAdviceSentence } from './kb/clinical.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PROLOG = /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/u;
const ACE = /^data\/guidelines\/[^/]+\/ace\/([^/]+)\.ace$/u;
const METADATA =
  /^A recommendation is a category-[A-Z]-recommendation and is an evidence-type-[1-4]-recommendation\.$/u;
const SIMPLE_ATOM = /^[a-z][A-Za-z0-9_]*$/u;
const DEFAULT_FIXTURE = join(ROOT, 'tests/fixtures/m5u1-reference.json');
const require = createRequire(import.meta.url);

/** @typedef {{ polarity: 'positive' | 'negative', verb: string, object: string, modifiers: Array<{ preposition: string, value: string }> }} AdviceAction */
/** @typedef {{ sentence: number, original: string, condition?: string, subject: string, mode: 'should' | 'can' | 'fact', actions: AdviceAction[] }} AdviceClause */
/** @typedef {{ conditions: string[], subject: string, mode: AdviceClause['mode'], actions: AdviceAction[], sentences: number[] }} AdviceGroup */
/** @typedef {{ line: number, head: string, body: string }} Site */
/** @typedef {{ question: string, document: string, sentence: number, original: string, sites: Site[], antecedent: string }} Case */
/** @typedef {{ key: string, question: string, document: string, sentence: number, original: string, fragment: string, antecedent: string, premises: string[], sites: Array<{ line: number, head: string, groundHead: string }> }} CorpusRecord */
/** @typedef {{ version: 1, questions: Array<{ id: string, question: string, documents: string[] }>, recordOrder: string[], records: Record<string, CorpusRecord> }} Corpus */
/** @typedef {{ prolog: { query(goal: string): { once(): Record<string, unknown> } } }} ReferenceEngine */
/** @typedef {(image: Uint8Array) => (options: Record<string, unknown>) => Promise<ReferenceEngine>} ImageLoader */

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

/** @param {string} source @param {number} start @returns {number} */
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
  throw new Error(`unterminated quoted Prolog token at ${String(start)}`);
};

/** Split only commas outside quoted text and nested terms. @param {string} source */
const splitConjunction = (source) => {
  /** @type {string[]} */
  const terms = [];
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
    else if (char === ',' && round === 0 && square === 0 && curly === 0) {
      terms.push(source.slice(start, index).trim());
      start = index + 1;
    }
    if (round < 0 || square < 0 || curly < 0) {
      throw new Error(`unbalanced Prolog term ${source}`);
    }
  }
  if (round !== 0 || square !== 0 || curly !== 0)
    throw new Error(`unbalanced Prolog term ${source}`);
  terms.push(source.slice(start).trim());
  if (terms.some((term) => term === '')) throw new Error(`empty conjunct in ${source}`);
  return terms;
};

/** @param {string} source @param {(token: string) => string} variable */
const replaceVariables = (source, variable) => {
  let result = '';
  for (let index = 0; index < source.length;) {
    const char = /** @type {string} */ (source[index]);
    if (char === "'" || char === '"' || char === '`') {
      const end = quotedEnd(source, index);
      result += source.slice(index, end);
      index = end;
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/u.test(/** @type {string} */ (source[end]))) {
        end += 1;
      }
      const token = source.slice(index, end);
      result += /^[A-Z_]/u.test(token) ? variable(token) : token;
      index = end;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
};

/** @param {string[]} terms @param {(ordinal: number) => string} replacement */
const groundTerms = (terms, replacement) => {
  /** @type {Map<string, string>} */
  const variables = new Map();
  let ordinal = 0;
  return terms.map((term) =>
    replaceVariables(term, (token) => {
      if (token === '_') return replacement(ordinal++);
      let grounded = variables.get(token);
      if (grounded === undefined) {
        grounded = replacement(ordinal++);
        variables.set(token, grounded);
      }
      return grounded;
    }),
  );
};

/** @param {string} source */
const groundHead = (source) =>
  groundTerms([source], (ordinal) => `'clinical_variable_${String(ordinal)}'`)[0];

/** @param {string} body @param {string} document @param {number} sentence */
const premises = (body, document, sentence) => {
  if (body === 'true') return [];
  const positive = splitConjunction(body).filter((term) => !term.startsWith('\\+'));
  return groundTerms(
    positive,
    (ordinal) =>
      `'$clinical_hypothetical'(${encodedAtom(document)},${String(sentence)},${String(ordinal)})`,
  );
};

/** @param {string} value */
const encodedAtom = (value) => {
  // eslint-disable-next-line no-control-regex
  if (/\r|\n|[\u0000-\u001f\u007f]/u.test(value)) throw new Error('unsafe Prolog atom text');
  return SIMPLE_ATOM.test(value) ? value : `'${value.replaceAll("'", "''")}'`;
};

/** @param {string} value */
const quotedString = (value) => {
  // eslint-disable-next-line no-control-regex
  if (/\r|[\u0000-\u001f\u007f]/u.test(value)) throw new Error('unsafe Prolog string text');
  return JSON.stringify(value);
};

/** @param {AdviceAction} action */
const actionTerm = (action) =>
  `action(${action.polarity},${encodedAtom(action.verb)},${quotedString(action.object)},` +
  `[${action.modifiers
    .map(({ preposition, value }) => `modifier(${encodedAtom(preposition)},${quotedString(value)})`)
    .join(',')}])`;

/** @param {AdviceGroup} group */
const fragmentTerm = (group) =>
  `rule([${group.conditions.map(quotedString).join(',')}],${quotedString(group.subject)},` +
  `${group.mode},[${group.actions.map(actionTerm).join(',')}])`;

/** @param {Map<string, Uint8Array>} files @param {string} document */
const adviceClauses = (files, document) => {
  const matches = [...files.keys()].filter((name) => ACE.exec(name)?.[1] === document);
  if (matches.length !== 1)
    throw new Error(`${document}: expected one ACE source, found ${matches.length}`);
  const path = /** @type {string} */ (matches[0]);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(
    /** @type {Uint8Array} */ (files.get(path)),
  );
  if (!text.endsWith('\n') || text.includes('\r')) throw new Error(`${path}: invalid line endings`);
  const [metadata, ...content] = text.slice(0, -1).split('\n');
  if (metadata === undefined || !METADATA.test(metadata))
    throw new Error(`${document}: invalid metadata`);
  return content.map(
    (source, index) => /** @type {AdviceClause} */ (parseAdviceSentence(source, index + 2)),
  );
};

/** @param {AdviceClause[]} clauses */
const groupFragments = (clauses) => {
  /** @type {AdviceGroup[]} */
  const groups = [];
  /** @type {Map<string, AdviceGroup>} */
  const byConsequence = new Map();
  for (const clause of clauses) {
    const key = JSON.stringify({
      subject: clause.subject,
      mode: clause.mode,
      actions: clause.actions,
    });
    let group = byConsequence.get(key);
    if (group === undefined) {
      group = {
        conditions: [],
        subject: clause.subject,
        mode: clause.mode,
        actions: clause.actions,
        sentences: [],
      };
      byConsequence.set(key, group);
      groups.push(group);
    }
    if (clause.condition === undefined) {
      if (group.conditions.length > 0 || group.sentences.length > 0) {
        throw new Error('duplicate or mixed unconditional consequence');
      }
    } else {
      if (group.sentences.length > 0 && group.conditions.length === 0) {
        throw new Error('conditional and unconditional consequences collide');
      }
      if (group.conditions.includes(clause.condition))
        throw new Error(`duplicate condition ${clause.condition}`);
      group.conditions.push(clause.condition);
    }
    group.sentences.push(clause.sentence);
  }
  return groups;
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
        `${item.document}:S${String(item.sentence)} has ${String(bodies.length)} antecedents`,
      );
    }
    item.antecedent = /** @type {string} */ (bodies[0]);
  }
  return cases;
};

/** @param {Map<string, Uint8Array>} files @returns {Corpus} */
export const referenceCorpus = (files) => {
  const cases = referenceCases(files);
  const byKey = new Map(cases.map((item) => [`${item.document}:S${String(item.sentence)}`, item]));
  /** @type {Corpus['records']} */
  const records = {};
  /** @type {string[]} */
  const recordOrder = [];

  for (const question of CLINICAL_QUESTIONS) {
    for (const { document } of question.sources) {
      const clauses = adviceClauses(files, document);
      const fragmentBySentence = new Map(
        groupFragments(clauses).flatMap((group) => {
          const fragment = fragmentTerm(group);
          return group.sentences.map((sentence) => [sentence, fragment]);
        }),
      );
      for (const clause of clauses) {
        const key = `${document}:S${String(clause.sentence)}`;
        const item = byKey.get(key);
        const fragment = fragmentBySentence.get(clause.sentence);
        if (item === undefined || fragment === undefined)
          throw new Error(`${key}: incomplete reference join`);
        if (item.question !== question.id || item.original !== clause.original) {
          throw new Error(`${key}: payload marker and ACE source diverge`);
        }
        const record = {
          key,
          question: question.id,
          document,
          sentence: clause.sentence,
          original: clause.original,
          fragment,
          antecedent: item.antecedent,
          premises: premises(item.antecedent, document, clause.sentence),
          sites: item.sites.map(({ line, head }) => ({
            line,
            head,
            groundHead: /** @type {string} */ (groundHead(head)),
          })),
        };
        records[key] = record;
        recordOrder.push(key);
      }
    }
  }
  if (recordOrder.length !== cases.length || new Set(recordOrder).size !== cases.length) {
    throw new Error(
      `reference corpus joined ${String(recordOrder.length)} of ${String(cases.length)} cases`,
    );
  }
  return {
    version: 1,
    questions: CLINICAL_QUESTIONS.map(({ id, question, sources }) => ({
      id,
      question,
      documents: sources.map(({ document }) => document),
    })),
    recordOrder,
    records,
  };
};

/** @param {Corpus} corpus */
const corpusText = (corpus) => format(JSON.stringify(corpus), { parser: 'json', printWidth: 100 });

/** @param {Corpus} corpus */
export const referenceSummary = (corpus) => {
  /** @type {Record<string, { sites: number, sentences: Record<string, number> }>} */
  const documents = {};
  /** @type {Record<string, number>} */
  const premiseShapes = {};
  const fragments = new Set();
  let sites = 0;
  let premiseCount = 0;
  for (const key of corpus.recordOrder) {
    const item = /** @type {CorpusRecord} */ (corpus.records[key]);
    const row = (documents[item.document] ??= { sites: 0, sentences: {} });
    row.sites += item.sites.length;
    row.sentences[String(item.sentence)] = item.sites.length;
    sites += item.sites.length;
    premiseCount += item.premises.length;
    fragments.add(item.fragment);
    for (const premise of item.premises) {
      const open = premise.indexOf('(');
      if (open <= 0 || !premise.endsWith(')')) throw new Error(`unsupported premise ${premise}`);
      const shape = `${premise.slice(0, open)}/${String(splitConjunction(premise.slice(open + 1, -1)).length)}`;
      premiseShapes[shape] = (premiseShapes[shape] ?? 0) + 1;
    }
  }
  return {
    sites,
    sentences: corpus.recordOrder.length,
    distinctAntecedents: new Set(
      corpus.recordOrder.map((key) => /** @type {CorpusRecord} */ (corpus.records[key]).antecedent),
    ).size,
    premises: premiseCount,
    premiseShapes,
    fragments: fragments.size,
    documents,
  };
};

/** @param {Corpus} corpus */
const compareShippedFragments = async (corpus) => {
  const loaded = /** @type {unknown} */ (require('swipl-wasm/dist/loadImageDefault.js'));
  const load =
    typeof loaded === 'function'
      ? /** @type {ImageLoader} */ (loaded)
      : /** @type {{ default: ImageLoader }} */ (loaded).default;
  /** @type {string[]} */
  const diagnostics = [];
  const engine = await load(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))))({
    print: () => {},
    printErr: (/** @type {string} */ line) => diagnostics.push(line),
  });
  /** @type {Array<{ document: string, expected: string, actual: string }>} */
  const divergences = [];
  let groups = 0;
  for (const question of corpus.questions) {
    for (const document of question.documents) {
      const fragments = [];
      const seen = new Set();
      for (const key of corpus.recordOrder) {
        const record = /** @type {CorpusRecord} */ (corpus.records[key]);
        if (record.document !== document || seen.has(record.fragment)) continue;
        seen.add(record.fragment);
        fragments.push(record.fragment);
      }
      groups += fragments.length;
      const expected = `[${fragments.join(',')}]`;
      const goal =
        `clinical_advice(_,_,clinical_answer(D,Groups,_)),atom_string(D,${quotedString(document)}),` +
        'term_string(Groups,Text,[quoted(true),numbervars(true),ignore_ops(true)]).';
      const result = engine.prolog.query(goal).once();
      const text = /** @type {{ v?: unknown } | undefined} */ (result['Text']);
      if (result['$error'] !== undefined || typeof text?.v !== 'string') {
        throw new Error(
          `${document}: shipped clinical answer unavailable: ${JSON.stringify(result)}`,
        );
      }
      const actual = text.v;
      if (actual !== expected) divergences.push({ document, expected, actual });
    }
  }
  if (diagnostics.length > 0)
    throw new Error(`image emitted diagnostics\n${diagnostics.join('\n')}`);
  return { documents: 12, groups, divergences };
};

const main = async () => {
  const command = process.argv[2] ?? 'summary';
  if (command === 'summary') {
    console.log(JSON.stringify(referenceSummary(referenceCorpus(bagFiles()))));
    return;
  }
  if (command === 'write') {
    const path = resolve(process.argv[3] ?? DEFAULT_FIXTURE);
    mkdirSync(dirname(path), { recursive: true });
    const text = await corpusText(referenceCorpus(bagFiles()));
    writeFileSync(path, text);
    console.log(
      JSON.stringify({
        path,
        bytes: Buffer.byteLength(text),
        sha256: createHash('sha256').update(text).digest('hex'),
      }),
    );
    return;
  }
  if (command === 'check') {
    const path = resolve(process.argv[3] ?? DEFAULT_FIXTURE);
    const expected = await corpusText(referenceCorpus(bagFiles()));
    const actual = readFileSync(path, 'utf8');
    if (actual !== expected) throw new Error(`${path}: fixture diverges from producer`);
    console.log(
      JSON.stringify({
        path,
        bytes: Buffer.byteLength(actual),
        sha256: createHash('sha256').update(actual).digest('hex'),
      }),
    );
    return;
  }
  if (command === 'compare-shipped') {
    console.log(JSON.stringify(await compareShippedFragments(referenceCorpus(bagFiles()))));
    return;
  }
  if (command === 'determinism') {
    const texts = await Promise.all([
      corpusText(referenceCorpus(bagFiles())),
      corpusText(referenceCorpus(bagFiles())),
    ]);
    const hashes = texts.map((text) => createHash('sha256').update(text).digest('hex'));
    if (hashes[0] !== hashes[1]) throw new Error(`producer hashes differ: ${hashes.join(' ')}`);
    console.log(JSON.stringify({ hashes }));
    return;
  }
  throw new Error(`unknown command ${command}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
