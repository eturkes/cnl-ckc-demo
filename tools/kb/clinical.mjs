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
 * Index just past the quoted atom opening at `start`, honouring `\` escapes and the
 * doubled-quote form. Shared by every scanner that must not mistake an atom's
 * contents for syntax — `'acute-pain'` is why a substring pass is unsound here.
 *
 * @param {string} source @param {number} start
 */
const quotedEnd = (source, start) => {
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') index += 2;
    else if (source[index] === "'") {
      if (source[index + 1] === "'") index += 2;
      else return index + 1;
    } else index += 1;
  }
  throw new Error('clinical source term contains an unterminated atom');
};

/**
 * Ground variables in compiled clause text. Quoted atoms are copied byte for byte;
 * repeated variables map to the same replacement, preserving equality relationships.
 *
 * The caller supplies the variable map so one map can span a sentence's heads AND its
 * antecedent: sharing survives as a shared constant, which is what lets the records
 * live in separate facts. A ground head still drives `clause/3` — it unifies against
 * the stored head's variables — so one form serves both data and execution.
 *
 * @param {string} source @param {Map<string, string>} variables @param {(ordinal: number) => string} skolem
 */
const groundTerm = (source, variables, skolem) => {
  let result = '';
  for (let index = 0; index < source.length; ) {
    const char = /** @type {string} */ (source[index]);
    if (char === "'") {
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
      if (/^[A-Z_]/u.test(token)) {
        // Every `_` is its own variable, so it never shares a replacement; a map keyed
        // on the token text would fuse two independent slots into one equality.
        const key = token === '_' ? `_ ${String(variables.size)}` : token;
        let replacement = variables.get(key);
        if (replacement === undefined) {
          replacement = skolem(variables.size);
          variables.set(key, replacement);
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

/** Legacy single-site form: inert atoms, one map per head. @param {string} source */
const groundHead = (source) =>
  groundTerm(source, new Map(), (ordinal) => `'clinical_variable_${String(ordinal)}'`);

/** Split a clause body on its top-level conjunctions. @param {string} body @returns {string[]} */
const conjuncts = (body) => {
  /** @type {string[]} */
  const parts = [];
  let depth = 0;
  let start = 0;
  let index = 0;
  while (index < body.length) {
    const char = body[index];
    if (char === "'") index = quotedEnd(body, index);
    else if (char === '(') {
      depth += 1;
      index += 1;
    } else if (char === ')') {
      depth -= 1;
      index += 1;
    } else if (char === ',' && depth === 0) {
      parts.push(body.slice(start, index).trim());
      index += 1;
      start = index;
    } else index += 1;
  }
  parts.push(body.slice(start).trim());
  return parts.filter((part) => part !== '');
};

/**
 * A conjunct's top-level control operator, if it carries one. Only `,`, `\+` and
 * `true` have an assumption semantics; a disjunction or an if-then assumed as though
 * it were a literal would claim more than the source does, so the build rejects it.
 *
 * @param {string} goal @returns {string | undefined}
 */
const controlOperator = (goal) => {
  let depth = 0;
  for (let index = 0; index < goal.length; ) {
    const char = goal[index];
    if (char === "'") {
      index = quotedEnd(goal, index);
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0) {
      if (char === ';') return ';';
      if (char === '*' && goal.startsWith('*->', index)) return '*->';
      if (char === '-' && goal[index + 1] === '>') return '->';
    }
    index += 1;
  }
  return undefined;
};

/**
 * The premises a sentence's antecedent asks for. A guideline clause is universally
 * quantified over clinicians and the `actual` world holds no clinician instance, so
 * these are what APPLY the universal rather than working around a gap. A `\+` subgoal
 * contributes none: its truth is not assumable.
 *
 * @param {string} body @returns {string[]}
 */
const premiseGoals = (body) =>
  body === 'true'
    ? []
    : conjuncts(body).flatMap((goal) => {
        if (goal.startsWith('\\+') || goal === 'true') return [];
        // A parenthesised conjunct is still a conjunction; the reference oracle
        // flattens recursively, so a single top-level split would under-report it.
        const inner = unwrap(goal);
        if (inner !== undefined) return premiseGoals(inner);
        const control = controlOperator(goal);
        if (control !== undefined) {
          throw new Error(`clinical antecedent uses unsupported control form ${control}`);
        }
        return [goal];
      });

/** Contents of a fully parenthesised term, else `undefined`. @param {string} goal @returns {string | undefined} */
const unwrap = (goal) => {
  if (!goal.startsWith('(')) return undefined;
  let depth = 0;
  let index = 0;
  while (index < goal.length) {
    const char = goal[index];
    if (char === "'") index = quotedEnd(goal, index);
    else {
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) return index === goal.length - 1 ? goal.slice(1, -1).trim() : undefined;
      }
      index += 1;
    }
  }
  return undefined;
};

/**
 * Every content-bearing clause site per selected sentence, keyed `document\0sentence`.
 *
 * This differs from `sourceClauses` in exactly one way — it keeps EVERY `guideline_*`
 * clause a sentence compiles to, not just the first — and that difference is the gap
 * between 48 cited sites and the corpus's real 686.
 *
 * @param {string} source @param {Set<string>} selected
 */
const contentSites = (source, selected) => {
  /** @type {Map<string, { document: string, sentence: number, clauses: Array<{ line: number, head: string, body: string }> }>} */
  const cases = new Map();
  let document = '';
  /** @type {{ document: string, sentence: number, clauses: Array<{ line: number, head: string, body: string }> } | undefined} */
  let current;
  for (const [offset, line] of source.split('\n').entries()) {
    const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
    if (file !== null) {
      document = file[1] ?? '';
      current = undefined;
      continue;
    }
    const marker = /^% S([1-9][0-9]*):/u.exec(line);
    if (marker !== null) {
      const sentence = Number(marker[1]);
      current = undefined;
      if (selected.has(document) && sentence > 1) {
        current = { document, sentence, clauses: [] };
        cases.set(`${document}\u0000${String(sentence)}`, current);
      }
      continue;
    }
    if (current === undefined || !line.startsWith('guideline_')) continue;
    // A CR survives the LF split and would ride into the emitted head, where the
    // trailing-period slice leaves it inside the term instead of removing it.
    if (line.includes('\r')) {
      throw new Error(
        `${current.document}:${String(current.sentence)}: compiled clause line ` +
          `${String(offset + 1)} contains a carriage return`,
      );
    }
    const rule = line.indexOf(' :- ');
    current.clauses.push({
      line: offset + 1,
      head: (rule < 0 ? line.slice(0, -1) : line.slice(0, rule)).trim(),
      body: rule < 0 ? 'true' : line.slice(rule + 4, -1),
    });
  }
  return cases;
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
  const selections = [];
  /** @type {string[]} */
  const passageFacts = [];
  /** @type {string[]} */
  const sources = [];
  /** @type {Map<string, string[]>} */
  const answers = new Map();
  /** @type {string[]} */
  const gates = [];
  /** @type {string[]} */
  const fragments = [];
  /** @type {string[]} */
  const premises = [];
  const contentIndex = contentSites(
    documents.source,
    new Set(CLINICAL_QUESTIONS.flatMap((q) => q.sources.map((s) => s.document))),
  );

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
      for (const clause of parsed) {
        const record = contentIndex.get(`${selection.document}\u0000${String(clause.sentence)}`);
        if (record === undefined || record.clauses.length === 0) {
          throw new Error(
            `${selection.document}: no content sites for sentence ${String(clause.sentence)}`,
          );
        }
        const bodies = [...new Set(record.clauses.map(({ body }) => body))];
        if (bodies.length !== 1) {
          throw new Error(
            `${selection.document}:${String(clause.sentence)}: ` +
              `${String(bodies.length)} distinct antecedents, expected one`,
          );
        }
        // One map across heads AND premises: the antecedent's variable sharing has to
        // survive as a shared constant, or a premise stops applying to its own clause.
        /** @type {Map<string, string>} */
        const variables = new Map();
        const skolem = (/** @type {number} */ ordinal) =>
          `'$clinical_hypothetical'(${encodedAtom(selection.document)},` +
          `${String(clause.sentence)},${String(ordinal)})`;
        const grounded = record.clauses.map(({ line, head }) => ({
          line,
          head: groundTerm(head, variables, skolem),
        }));
        // Keyed by DOCUMENT, never by question: one question owns up to four documents
        // and each restarts its sentence numbering, so a question key collides.
        const key = `${encodedAtom(selection.document)},${String(clause.sentence)}`;
        gates.push(
          `clinical_gate(${key},Rule,[${grounded.map(({ line }) => String(line)).join(',')}]) :- ` +
            `${grounded.map(({ line, head }) => `clinical_use(${String(line)},(${head}))`).join(',')},` +
            `clinical_rule(${key},Rule).`,
        );
        fragments.push(
          `clinical_rule(${key},${groupTerm(/** @type {AdviceGroup} */ (groupClauses([clause])[0]))}).`,
        );
        for (const [ordinal, goal] of premiseGoals(
          /** @type {string} */ (bodies[0]),
        ).entries()) {
          premises.push(
            `clinical_premise(${key},${String(ordinal)},(${groundTerm(goal, variables, skolem)})).`,
          );
        }
      }
      const text = passages.get(selection.document);
      if (text === undefined) throw new Error(`${selection.document}: no aligned source passage`);
      const first = /** @type {AdviceClause} */ (parsed[0]);
      const doc = encodedAtom(selection.document);
      const sourceId = `'$guideline_id'(product,${doc},${String(first.sentence)},ref(1),[])`;
      // The statement stays computed as the ORACLE the runtime derivation is graded
      // against. It is no longer emitted as a `clinical_advice/3` fact — that lookup was
      // the whole of S1.
      const statement = answerTerm(selection.document, parsed, text);
      statements.push(statement);
      selections.push(`clinical_source(${qid},${doc},${String(first.sentence)}).`);
      passageFacts.push(`clinical_passage(${doc},${quotedString(text)}).`);
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
    `:- discontiguous(clinical_advice_source/4).\n` +
    `:- discontiguous(clinical_gate/4).\n` +
    `:- discontiguous(clinical_rule/3).\n` +
    `:- discontiguous(clinical_premise/4).\n` +
    // Exact-site gate: head, source file and line must all match before the clause's
    // own body runs. Head/line alone would let a same-head clause asserted at another
    // line satisfy the gate, which is the substitution the probe refuted.
    `clinical_use(Line,Head) :- clause(Head,Body,Ref), ` +
    `clause_property(Ref,file('/prolog.pl')), ` +
    `clause_property(Ref,line_count(Line)), call(Body).\n` +
    // The demo's one answer. `clinical_advice/3` carries NO facts and is NOT dynamic, so
    // there is nothing to look up and nothing an `assertz` can fabricate: every solution
    // runs `clinical_derive/4`, which reads its cited heads out of the stored
    // `clinical_gate/4` body and binds `Rule` only after the derivation succeeds.
    // `clinical_derive/4` and `app/3` are defined in the proof source appended after this
    // block; one consult defines the whole file before any query runs.
    `clinical_advice(Q,'$guideline_id'(product,Doc,First,ref(1),[]),` +
    `clinical_answer(Doc,Groups,Passage)) :- ` +
    `clinical_source(Q,Doc,First), clinical_passage(Doc,Passage), ` +
    `findall(R,clinical_derive(Doc,_,R,_),Rules), clinical_groups(Rules,Groups).\n` +
    // Reassemble the per-sentence rules into group terms exactly as `groupClauses` does:
    // merge identical consequents, concatenate their conditions in sentence order, and
    // keep first-appearance group order. `clinical_derive/4` enumerates a document's
    // gates in emission order, which is sentence order.
    `clinical_groups([],[]).\n` +
    `clinical_groups([rule(C,Su,M,A)|T],[rule(Cs,Su,M,A)|R]) :- ` +
    `clinical_merge(Su,M,A,T,Rest,Tail), app(C,Tail,Cs), clinical_groups(Rest,R).\n` +
    `clinical_merge(_,_,_,[],[],[]) :- !.\n` +
    `clinical_merge(Su,M,A,[rule(C,Su1,M1,A1)|T],Rest,Cs) :- ` +
    `Su1 == Su, M1 == M, A1 == A, !, ` +
    `clinical_merge(Su,M,A,T,Rest,Cs1), app(C,Cs1,Cs).\n` +
    `clinical_merge(Su,M,A,[H|T],[H|Rest],Cs) :- clinical_merge(Su,M,A,T,Rest,Cs).\n` +
    `${selections.join('\n')}\n${passageFacts.join('\n')}\n${sources.join('\n')}\n` +
    `${fragments.join('\n')}\n${premises.join('\n')}\n${gates.join('\n')}\n`;
  return { records, names: [...names].sort(), source: helper, helper, answers };
};
