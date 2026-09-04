// Clinician-facing question set derived from exact guideline passages in the bag.
//
// The source corpus primarily stores general recommendations as Horn rules. A
// patient-free query cannot prove a conditional rule's consequent, which is why
// the old catalog exposed schema diagnostics instead of clinical guidance. This
// module reifies a deliberately small set of aligned source passages as
// `clinical_advice/3` facts. The browser still obtains every displayed statement from live Prolog;
// the paired source record makes the proof interpreter report the original
// compiled clause line rather than the helper fact.

import { payloadDocuments } from './payload.mjs';
import { deriveProvenance } from './provenance.mjs';

/** @typedef {{ document: string, sentence: number }} SourceSelection */
/** @typedef {{ id: string, question: string, sources: readonly SourceSelection[] }} ClinicalQuestion */

/** @type {readonly ClinicalQuestion[]} */
export const CLINICAL_QUESTIONS = Object.freeze([
  {
    id: 'when-to-use-opioids',
    question: 'When should clinicians consider opioid therapy for pain?',
    sources: [
      { document: 'cdc2022-opioid-rec01', sentence: 2 },
      { document: 'cdc2022-opioid-rec02', sentence: 2 },
    ],
  },
  {
    id: 'starting-opioid-therapy',
    question: 'How should clinicians start opioid therapy?',
    sources: [
      { document: 'cdc2022-opioid-rec03', sentence: 2 },
      { document: 'cdc2022-opioid-rec04', sentence: 2 },
    ],
  },
  {
    id: 'acute-pain-prescription-duration',
    question: 'How long should opioids be prescribed for acute pain?',
    sources: [{ document: 'cdc2022-opioid-rec06', sentence: 2 }],
  },
  {
    id: 'opioid-follow-up',
    question: 'When and how should clinicians reassess opioid therapy?',
    sources: [{ document: 'cdc2022-opioid-rec07', sentence: 2 }],
  },
  {
    id: 'opioid-safety',
    question: 'What safety steps should accompany opioid prescribing?',
    sources: [
      { document: 'cdc2022-opioid-rec08', sentence: 2 },
      { document: 'cdc2022-opioid-rec09', sentence: 2 },
      { document: 'cdc2022-opioid-rec10', sentence: 2 },
      { document: 'cdc2022-opioid-rec11', sentence: 2 },
    ],
  },
  {
    id: 'continuing-or-tapering-opioids',
    question: 'When should clinicians continue, taper, or discontinue opioids?',
    sources: [{ document: 'cdc2022-opioid-rec05', sentence: 2 }],
  },
  {
    id: 'opioid-use-disorder-treatment',
    question: 'How should clinicians treat opioid use disorder?',
    sources: [{ document: 'cdc2022-opioid-rec12', sentence: 2 }],
  },
]);

const ACE = /^data\/guidelines\/[^/]+\/ace\/([^/]+)\.ace$/u;
const ID = /^[a-z0-9](?:[a-z0-9-]{0,249})$/u;

/** @param {string} value */
const quotedAtom = (value) => {
  if (!ID.test(value)) throw new Error(`clinical catalog has invalid id ${value}`);
  return `'${value}'`;
};

/** JSON strings are valid SWI double-quoted strings for this control-free corpus. @param {string} value */
const quotedString = (value) => {
  // eslint-disable-next-line no-control-regex
  if (/\r|[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('clinical statement contains unsupported control text');
  }
  return JSON.stringify(value);
};

/** @param {Map<string, Uint8Array>} files @param {string} document */
const aceSentences = (files, document) => {
  const matches = [...files.keys()].filter((name) => ACE.exec(name)?.[1] === document);
  if (matches.length !== 1) {
    throw new Error(`${document}: expected one ACE source, found ${matches.length}`);
  }
  const path = /** @type {string} */ (matches[0]);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(
    /** @type {Uint8Array} */ (files.get(path)),
  );
  if (!text.endsWith('\n') || text.includes('\r')) {
    throw new Error(`${path}: clinical source must use LF and end with one`);
  }
  const sentences = text.slice(0, -1).split('\n');
  if (sentences.some((sentence) => sentence === '')) {
    throw new Error(`${path}: clinical source contains an empty sentence`);
  }
  return { path, sentences };
};

/**
 * Ground variables in a compiled clause head so it can travel as data inside a
 * helper fact. Quoted atoms are copied byte for byte; repeated variables map to
 * the same inert atom, preserving the head's equality relationships.
 *
 * @param {string} source
 */
const groundHead = (source) => {
  /** @type {Map<string, string>} */
  const variables = new Map();
  let ordinal = 0;
  let result = '';
  for (let index = 0; index < source.length; ) {
    const char = /** @type {string} */ (source[index]);
    if (char === "'") {
      const start = index;
      index += 1;
      let closed = false;
      while (index < source.length && !closed) {
        if (source[index] === '\\') index += 2;
        else if (source[index] === "'") {
          if (source[index + 1] === "'") index += 2;
          else {
            index += 1;
            closed = true;
          }
        } else index += 1;
      }
      if (!closed) throw new Error('clinical source head contains an unterminated atom');
      result += source.slice(start, index);
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/u.test(/** @type {string} */ (source[end]))) {
        end += 1;
      }
      const token = source.slice(index, end);
      if (/^[A-Z_]/u.test(token)) {
        let replacement = variables.get(token);
        if (replacement === undefined) {
          replacement = `'clinical_variable_${String(ordinal)}'`;
          variables.set(token, replacement);
          ordinal += 1;
        }
        result += replacement;
      } else {
        result += token;
      }
      index = end;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
};

/** @param {string} source */
const sourceClauses = (source) => {
  /** @type {Map<string, { line: number, head: string }>} */
  const bySentence = new Map();
  let document = '';
  let sentence = 0;
  for (const [offset, line] of source.split('\n').entries()) {
    const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
    if (file !== null) {
      document = file[1] ?? '';
      sentence = 0;
      continue;
    }
    const marker = /^% S([1-9][0-9]*):/u.exec(line);
    if (marker !== null) {
      sentence = Number(marker[1]);
      continue;
    }
    if (document === '' || sentence === 0 || !line.startsWith('guideline_')) continue;
    const key = `${document}\u0000${String(sentence)}`;
    if (bySentence.has(key)) continue;
    const rule = line.indexOf(' :- ');
    const head = (rule < 0 ? line.slice(0, -1) : line.slice(0, rule)).trim();
    bySentence.set(key, { line: offset + 1, head: groundHead(head) });
  }
  return bySentence;
};

/**
 * @param {Map<string, Uint8Array>} files
 * @returns {{ records: Array<{ id: string, question: string, goal: string, projection: Array<{ variable: string, descriptor: string }>, provenance: 'bag-derived' }>, names: string[], source: string, helper: string, answers: Map<string, string[]> }}
 */
export const clinicalArtifacts = (files) => {
  const documents = payloadDocuments(files);
  const clauses = sourceClauses(documents.source);
  const provenance = deriveProvenance(files);
  /** @type {Map<string, string>} */
  const passages = new Map();
  for (const chunk of provenance.chunks) {
    const model = /** @type {{ source?: { text?: unknown } }} */ (chunk.model);
    const passage = model.source?.text;
    if (typeof passage !== 'string' || passage === '') {
      throw new Error(`${chunk.document}: provenance carries no source passage`);
    }
    passages.set(chunk.document, passage);
  }
  /** @type {Set<string>} */
  const ids = new Set();
  /** @type {Set<string>} */
  const names = new Set();
  /** @type {string[]} */
  const advice = [];
  /** @type {string[]} */
  const sources = [];
  /** @type {Map<string, string[]>} */
  const answers = new Map();

  const records = CLINICAL_QUESTIONS.map((question) => {
    if (ids.has(question.id)) throw new Error(`duplicate clinical question ${question.id}`);
    ids.add(question.id);
    const qid = quotedAtom(question.id);
    /** @type {string[]} */
    const statements = [];
    for (const selection of question.sources) {
      const ace = aceSentences(files, selection.document);
      names.add(ace.path);
      if (ace.sentences[selection.sentence - 1] === undefined) {
        throw new Error(
          `${selection.document}: no controlled sentence ${String(selection.sentence)}`,
        );
      }
      const clause = clauses.get(
        `${selection.document}\u0000${String(selection.sentence)}`,
      );
      if (clause === undefined) {
        throw new Error(
          `${selection.document}: no compiled clause for sentence ${String(selection.sentence)}`,
        );
      }
      const text = passages.get(selection.document);
      if (text === undefined) throw new Error(`${selection.document}: no aligned source passage`);
      const sourceId = `'$guideline_id'(product,${quotedAtom(selection.document)},${String(selection.sentence)},ref(1),[])`;
      const statement = quotedString(text);
      statements.push(text);
      advice.push(`clinical_advice(${qid},${sourceId},${statement}).`);
      sources.push(
        `clinical_advice_source(${qid},${sourceId},${statement},${clause.head},${String(clause.line)}).`,
      );
    }
    answers.set(question.id, statements);
    return {
      id: question.id,
      question: question.question,
      goal: `clinical_advice(${qid},Source,Answer)`,
      projection: [{ variable: 'Answer', descriptor: 'noun(guideline-passage,countable)' }],
      provenance: /** @type {'bag-derived'} */ ('bag-derived'),
    };
  });

  const helper =
    `:- multifile(clinical_advice/3).\n` +
    `:- dynamic(clinical_advice/3).\n` +
    `:- discontiguous(clinical_advice_source/5).\n` +
    `${advice.join('\n')}\n${sources.join('\n')}\n`;
  return { records, names: [...names].sort(), source: helper, helper, answers };
};
