// Clinician-facing question set derived from the controlled clauses in the bag.
//
// The source corpus primarily stores general recommendations as Horn rules. A
// patient-free query cannot prove a conditional rule's consequent, which is why
// the old catalog exposed schema diagnostics instead of clinical guidance. This
// module reifies each selected recommendation as a structured `clinical_answer/3`
// term inside `clinical_advice/3`. The browser renders that term with one generic
// grammar; no per-answer summary prose exists. The exact source passage travels in
// the same term as a fail-closed fallback and the paired source record makes the
// proof interpreter report every contributing compiled sentence.

import { payloadDocuments } from './payload.mjs';
import { deriveProvenance } from './provenance.mjs';

/** @typedef {{ document: string }} SourceSelection */
/** @typedef {{ id: string, question: string, sources: readonly SourceSelection[] }} ClinicalQuestion */

/** @type {readonly ClinicalQuestion[]} */
export const CLINICAL_QUESTIONS = Object.freeze([
  {
    id: 'when-to-use-opioids',
    question: 'When should clinicians consider opioid therapy for pain?',
    sources: [{ document: 'cdc2022-opioid-rec01' }, { document: 'cdc2022-opioid-rec02' }],
  },
  {
    id: 'starting-opioid-therapy',
    question: 'How should clinicians start opioid therapy?',
    sources: [{ document: 'cdc2022-opioid-rec03' }, { document: 'cdc2022-opioid-rec04' }],
  },
  {
    id: 'acute-pain-prescription-duration',
    question: 'How long should opioids be prescribed for acute pain?',
    sources: [{ document: 'cdc2022-opioid-rec06' }],
  },
  {
    id: 'opioid-follow-up',
    question: 'When and how should clinicians reassess opioid therapy?',
    sources: [{ document: 'cdc2022-opioid-rec07' }],
  },
  {
    id: 'opioid-safety',
    question: 'What safety steps should accompany opioid prescribing?',
    sources: [
      { document: 'cdc2022-opioid-rec08' },
      { document: 'cdc2022-opioid-rec09' },
      { document: 'cdc2022-opioid-rec10' },
      { document: 'cdc2022-opioid-rec11' },
    ],
  },
  {
    id: 'continuing-or-tapering-opioids',
    question: 'When should clinicians continue, taper, or discontinue opioids?',
    sources: [{ document: 'cdc2022-opioid-rec05' }],
  },
  {
    id: 'opioid-use-disorder-treatment',
    question: 'How should clinicians treat opioid use disorder?',
    sources: [{ document: 'cdc2022-opioid-rec12' }],
  },
]);

const ACE = /^data\/guidelines\/[^/]+\/ace\/([^/]+)\.ace$/u;
const ID = /^[a-z0-9](?:[a-z0-9-]{0,249})$/u;
const SIMPLE_ATOM = /^[a-z][A-Za-z0-9_]*$/u;

/** @param {string} value */
const encodedAtom = (value) => {
  if (!ID.test(value)) throw new Error(`clinical catalog has invalid id ${value}`);
  return SIMPLE_ATOM.test(value) ? value : `'${value}'`;
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

const METADATA = /^A recommendation is a category-[A-Z]-recommendation and is an evidence-type-[1-4]-recommendation\.$/u;
const PREPOSITIONS = new Set([
  'above',
  'after',
  'against',
  'at',
  'before',
  'during',
  'for',
  'from',
  'in',
  'of',
  'on',
  'to',
  'with',
]);

/** @typedef {{ preposition: string, value: string }} AdviceModifier */
/** @typedef {{ polarity: 'positive' | 'negative', verb: string, object: string, modifiers: AdviceModifier[] }} AdviceAction */
/** @typedef {{ sentence: number, original: string, condition?: string, subject: string, mode: 'should' | 'can' | 'fact', actions: AdviceAction[] }} AdviceClause */
/** @typedef {{ conditions: string[], subject: string, mode: AdviceClause['mode'], actions: AdviceAction[], sentences: number[] }} AdviceGroup */

/** @param {string} text */
const splitComplement = (text) => {
  const tokens = text === '' ? [] : text.split(' ');
  const first = tokens.findIndex((token) => PREPOSITIONS.has(token));
  const object = (first < 0 ? tokens : tokens.slice(0, first)).join(' ');
  /** @type {AdviceModifier[]} */
  const modifiers = [];
  for (let index = first; index >= 0 && index < tokens.length; ) {
    const preposition = /** @type {string} */ (tokens[index]);
    let end = index + 1;
    while (end < tokens.length && !PREPOSITIONS.has(/** @type {string} */ (tokens[end]))) {
      end += 1;
    }
    const value = tokens.slice(index + 1, end).join(' ');
    if (value === '') throw new Error(`clinical action has an empty ${preposition} modifier`);
    modifiers.push({ preposition, value });
    index = end;
  }
  return { object, modifiers };
};

/** @param {string} text */
const parseAction = (text) => {
  let rest = text;
  /** @type {'positive' | 'negative'} */
  let polarity = 'positive';
  if (rest.startsWith('not ')) {
    polarity = 'negative';
    rest = rest.slice(4);
  }
  const space = rest.indexOf(' ');
  const verb = space < 0 ? rest : rest.slice(0, space);
  if (!SIMPLE_ATOM.test(verb)) throw new Error(`clinical action has invalid verb ${verb}`);
  const complement = splitComplement(space < 0 ? '' : rest.slice(space + 1));
  return { polarity, verb, ...complement };
};

/** Reassemble an action byte for byte, before the sentence grammar adds its modal. @param {AdviceAction} action */
const actionSource = (action) =>
  `${action.polarity === 'negative' ? 'not ' : ''}${action.verb}` +
  `${action.object === '' ? '' : ` ${action.object}`}` +
  action.modifiers.map(({ preposition, value }) => ` ${preposition} ${value}`).join('');

/** @param {AdviceClause} clause */
const clauseSource = (clause) => {
  let main;
  if (clause.mode === 'fact') {
    const [first] = clause.actions;
    if (
      clause.actions.length === 1 &&
      first?.verb === 'is' &&
      first.polarity === 'negative'
    ) {
      const complement = actionSource({ ...first, polarity: 'positive', verb: '' }).trim();
      main = `${clause.subject} is not ${complement}`;
    } else {
      main = `${clause.subject} ${clause.actions.map(actionSource).join(' and ')}`;
    }
  } else {
    main =
      `${clause.subject} ${clause.mode} ` +
      clause.actions.map(actionSource).join(` and ${clause.mode} `);
  }
  return `${clause.condition === undefined ? '' : `If ${clause.condition} then `}${main}.`;
};

/**
 * Parse the tiny controlled-sentence surface used by the selected recommendations.
 *
 * This is a lossless parser, not a summarizer. Every accepted sentence is rebuilt
 * byte-for-byte before it can enter the image; a future grammar form fails the KB
 * build instead of being guessed into plausible clinical prose.
 *
 * @param {string} original @param {number} sentence @returns {AdviceClause}
 */
export const parseAdviceSentence = (original, sentence) => {
  if (!original.endsWith('.')) throw new Error(`controlled sentence ${sentence} has no period`);
  let main = original.slice(0, -1);
  /** @type {string | undefined} */
  let condition;
  if (main.startsWith('If ')) {
    const then = main.indexOf(' then ');
    if (then < 0 || main.indexOf(' then ', then + 1) >= 0) {
      throw new Error(`controlled sentence ${sentence} has an ambiguous condition`);
    }
    condition = main.slice(3, then);
    main = main.slice(then + 6);
  }

  /** @type {AdviceClause['mode']} */
  let mode;
  /** @type {string} */
  let subject;
  /** @type {AdviceAction[]} */
  let actions;
  const should = main.indexOf(' should ');
  const can = main.indexOf(' can ');
  const isNot = main.indexOf(' is not ');
  const increases = main.indexOf(' increases ');
  if (should >= 0) {
    mode = 'should';
    subject = main.slice(0, should);
    actions = main
      .slice(should + 8)
      .split(' and should ')
      .map(parseAction);
  } else if (can >= 0) {
    mode = 'can';
    subject = main.slice(0, can);
    actions = main
      .slice(can + 5)
      .split(' and can ')
      .map(parseAction);
  } else if (isNot >= 0) {
    mode = 'fact';
    subject = main.slice(0, isNot);
    actions = [parseAction(`not is ${main.slice(isNot + 8)}`)];
  } else if (increases >= 0) {
    mode = 'fact';
    subject = main.slice(0, increases);
    actions = main
      .slice(increases + 11)
      .split(' and increases ')
      .map((text) => parseAction(`increases ${text}`));
  } else {
    throw new Error(`controlled sentence ${sentence} uses an unsupported clause form`);
  }
  if (subject === '' || actions.length === 0) {
    throw new Error(`controlled sentence ${sentence} has an empty clause component`);
  }
  const parsed = {
    sentence,
    original,
    ...(condition === undefined ? {} : { condition }),
    subject,
    mode,
    actions,
  };
  const rebuilt = clauseSource(parsed);
  if (rebuilt !== original) {
    throw new Error(
      `controlled sentence ${sentence} is not lossless\n  source: ${original}\n  parsed: ${rebuilt}`,
    );
  }
  return parsed;
};

/** Group only identical consequents; expanding the groups yields the same clause multiset. @param {AdviceClause[]} clauses */
const groupClauses = (clauses) => {
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
        throw new Error('duplicate or mixed unconditional clinical consequence');
      }
    } else {
      if (group.sentences.length > 0 && group.conditions.length === 0) {
        throw new Error('conditional and unconditional clinical clauses share a consequence');
      }
      if (group.conditions.includes(clause.condition)) {
        throw new Error(`duplicate clinical condition ${clause.condition}`);
      }
      group.conditions.push(clause.condition);
    }
    group.sentences.push(clause.sentence);
  }
  if (groups.reduce((total, group) => total + group.sentences.length, 0) !== clauses.length) {
    throw new Error('clinical grouping lost a controlled sentence');
  }
  return groups;
};

/** @param {AdviceModifier} modifier */
const modifierTerm = (modifier) =>
  `modifier(${encodedAtom(modifier.preposition)},${quotedString(modifier.value)})`;

/** @param {AdviceAction} action */
const actionTerm = (action) =>
  `action(${action.polarity},${encodedAtom(action.verb)},${quotedString(action.object)},` +
  `[${action.modifiers.map(modifierTerm).join(',')}])`;

/** @param {AdviceGroup} group */
const groupTerm = (group) =>
  `rule([${group.conditions.map(quotedString).join(',')}],${quotedString(group.subject)},` +
  `${group.mode},[${group.actions.map(actionTerm).join(',')}])`;

/** @param {string} document @param {AdviceClause[]} clauses @param {string} passage */
const answerTerm = (document, clauses, passage) =>
  `clinical_answer(${encodedAtom(document)},[${groupClauses(clauses).map(groupTerm).join(',')}],` +
  `${quotedString(passage)})`;

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
    const qid = encodedAtom(question.id);
    /** @type {string[]} */
    const statements = [];
    for (const selection of question.sources) {
      const ace = aceSentences(files, selection.document);
      names.add(ace.path);
      const [metadata, ...content] = ace.sentences;
      if (metadata === undefined || !METADATA.test(metadata)) {
        throw new Error(`${selection.document}: first controlled sentence is not recommendation metadata`);
      }
      if (content.length === 0) {
        throw new Error(`${selection.document}: recommendation has no clinical clauses`);
      }
      const parsed = content.map((sentence, index) => parseAdviceSentence(sentence, index + 2));
      const sites = parsed.map(({ sentence }) => {
        const clause = clauses.get(`${selection.document}\u0000${String(sentence)}`);
        if (clause === undefined) {
          throw new Error(
            `${selection.document}: no compiled clause for sentence ${String(sentence)}`,
          );
        }
        return `site(${String(clause.line)},${clause.head})`;
      });
      const text = passages.get(selection.document);
      if (text === undefined) throw new Error(`${selection.document}: no aligned source passage`);
      const first = /** @type {AdviceClause} */ (parsed[0]);
      const sourceId = `'$guideline_id'(product,${encodedAtom(selection.document)},${String(first.sentence)},ref(1),[])`;
      const statement = answerTerm(selection.document, parsed, text);
      statements.push(statement);
      advice.push(`clinical_advice(${qid},${sourceId},${statement}).`);
      sources.push(
        `clinical_advice_source(${qid},${sourceId},${statement},[${sites.join(',')}]).`,
      );
    }
    answers.set(question.id, statements);
    return {
      id: question.id,
      question: question.question,
      goal: `clinical_advice(${qid},Source,Answer)`,
      projection: [{ variable: 'Answer', descriptor: 'noun(clinical-advice,countable)' }],
      provenance: /** @type {'bag-derived'} */ ('bag-derived'),
    };
  });

  const helper =
    `:- multifile(clinical_advice/3).\n` +
    `:- dynamic(clinical_advice/3).\n` +
    `:- discontiguous(clinical_advice_source/4).\n` +
    `${advice.join('\n')}\n${sources.join('\n')}\n`;
  return { records, names: [...names].sort(), source: helper, helper, answers };
};
