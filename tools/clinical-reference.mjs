// Independent M5 u1 producer. Only the frozen sentence parser crosses the
// production boundary; sites, antecedents, premises, fragments, and grouping do not.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from './kb/bag.mjs';
import { parseAdviceSentence } from './kb/clinical.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PROLOG = /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/u;
const ACE = /^data\/guidelines\/[^/]+\/ace\/([^/]+)\.ace$/u;
const METADATA =
  /^A recommendation is a category-[A-Z]-recommendation and is an evidence-type-[1-4]-recommendation\.$/u;
const SIMPLE_ATOM = /^[a-z][A-Za-z0-9_]*$/u;
const DOCUMENT_ORDER = Object.freeze([
  'cdc2022-opioid-rec01',
  'cdc2022-opioid-rec02',
  'cdc2022-opioid-rec03',
  'cdc2022-opioid-rec04',
  'cdc2022-opioid-rec06',
  'cdc2022-opioid-rec07',
  'cdc2022-opioid-rec08',
  'cdc2022-opioid-rec09',
  'cdc2022-opioid-rec10',
  'cdc2022-opioid-rec11',
  'cdc2022-opioid-rec05',
  'cdc2022-opioid-rec12',
]);

/** @typedef {{ polarity: 'positive' | 'negative', verb: string, object: string, modifiers: Array<{ preposition: string, value: string }> }} AdviceAction */
/** @typedef {{ sentence: number, original: string, condition?: string, subject: string, mode: 'should' | 'can' | 'fact', actions: AdviceAction[] }} AdviceClause */
/** @typedef {{ conditions: string[], subject: string, mode: AdviceClause['mode'], actions: AdviceAction[], sentences: number[] }} AdviceGroup */
/** @typedef {{ line: number, head: string, body: string }} ReferenceSite */
/** @typedef {{ document: string, sentence: number, original: string, sites: ReferenceSite[], antecedent: string }} ReferenceCase */
/** @typedef {{ key: string, document: string, sentence: number, original: string, fragment: string, antecedent: string, premises: string[], groundHeads: string[], sites: ReferenceSite[] }} ReferenceRecord */
/** @typedef {{ version: 1, documentOrder: string[], recordOrder: string[], records: Record<string, ReferenceRecord>, groups: Record<string, string[]> }} ReferenceCorpus */
/** @typedef {{ key: string, document: string, sentence: string, lines: number[], heads: string[], ruleVariable: string }} ActualGate */
/** @typedef {{ key: string, document: string, sentence: string, ordinal: number, literal: string }} ActualPremise */
/** @typedef {{ key: string, document: string, sentence: string, fragment: string }} ActualRule */
/** @typedef {{ key: string, document: string, groups: string }} ActualAdvice */
/** @typedef {{ gates: ActualGate[], premises: ActualPremise[], rules: ActualRule[], advice: ActualAdvice[], malformedGates: string[], malformedPremises: string[], malformedRules: string[], malformedAdvice: string[] }} ActualRecords */
/** @typedef {{ divergences: string[], expectedRecords: number, actualRecords: number, expectedSites: number, actualSites: number }} SiteDiff */
/** @typedef {{ divergences: string[], expectedPremises: number, actualPremises: number }} PremiseDiff */
/** @typedef {{ divergences: string[], expectedRules: number, actualRules: number, expectedGates: number, actualGates: number }} RuleDiff */
/** @typedef {{ divergences: string[], expectedDocuments: number, actualDocuments: number, expectedGroups: number, actualGroups: number }} ReassemblyDiff */

/** @returns {Map<string, Uint8Array>} */
const bagFiles = () => {
  const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) throw new Error(`expected one vendored bag, found ${archives.length}`);
  return verifyBag(readFileSync(join(ROOT, 'kb', /** @type {string} */ (archives[0])))).files;
};

/** @param {Map<string, Uint8Array>} files */
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

/** @param {string} source @param {string} separator @returns {string[]} */
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
      result.push(source.slice(start, index).trim());
      start = index + separator.length;
      index += separator.length - 1;
    }
    if (round < 0 || square < 0 || curly < 0) throw new Error(`unbalanced Prolog term ${source}`);
  }
  if (round !== 0 || square !== 0 || curly !== 0)
    throw new Error(`unbalanced Prolog term ${source}`);
  result.push(source.slice(start).trim());
  return result;
};

/** @param {string} source */
const unwrap = (source) => {
  if (!source.startsWith('(')) return undefined;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = quotedEnd(source, index) - 1;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return index === source.length - 1 ? source.slice(1, -1).trim() : undefined;
    }
  }
  return undefined;
};

/** @param {string} source */
const controlOperator = (source) => {
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = quotedEnd(source, index) - 1;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0) {
      if (char === ';') return ';';
      if (char === '*' && source.startsWith('*->', index)) return '*->';
      if (char === '-' && source[index + 1] === '>') return '->';
    }
  }
  return undefined;
};

/** @param {string} body @returns {string[]} */
const positiveGoals = (body) => {
  if (body === 'true') return [];
  return splitTopLevel(body, ',').flatMap((source) => {
    const goal = source.trim();
    if (goal === '' || goal === 'true' || goal.startsWith('\\+')) return [];
    const inner = unwrap(goal);
    if (inner !== undefined) return positiveGoals(inner);
    const control = controlOperator(goal);
    if (control !== undefined) throw new Error(`unsupported control form ${control}`);
    return [goal];
  });
};

/** @param {string} source */
const splitClause = (source) => {
  if (!source.endsWith('.')) throw new Error(`compiled clause lacks a period: ${source}`);
  const boundary = source.indexOf(' :- ');
  return boundary < 0
    ? { head: source.slice(0, -1), body: 'true' }
    : { head: source.slice(0, boundary), body: source.slice(boundary + 4, -1) };
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
      // `token` here is a Prolog variable name, not a credential.
      // eslint-disable-next-line security/detect-possible-timing-attacks
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
      if (group.conditions.includes(clause.condition)) {
        throw new Error(`duplicate condition ${clause.condition}`);
      }
      group.conditions.push(clause.condition);
    }
    group.sentences.push(clause.sentence);
  }
  return groups;
};

/** @param {Map<string, Uint8Array>} files @returns {ReferenceCase[]} */
const referenceCases = (files) => {
  const selected = new Set(DOCUMENT_ORDER);
  /** @type {ReferenceCase[]} */
  const cases = [];
  /** @type {ReferenceCase | undefined} */
  let current;
  let document = '';
  for (const [offset, line] of payloadSource(files).split('\n').entries()) {
    const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
    if (file !== null) {
      document = file[1] ?? '';
      current = undefined;
      continue;
    }
    const marker = /^% S([1-9][0-9]*):(.*)$/u.exec(line);
    if (marker !== null) {
      const sentence = Number(marker[1]);
      const suffix = marker[2] ?? '';
      current =
        selected.has(document) && sentence > 1
          ? {
              document,
              sentence,
              original: suffix.startsWith(' ') ? suffix.slice(1) : suffix,
              sites: [],
              antecedent: '',
            }
          : undefined;
      if (current !== undefined) cases.push(current);
      continue;
    }
    if (current === undefined || !line.startsWith('guideline_')) continue;
    if (line.includes('\r')) {
      throw new Error(
        `${current.document}:S${String(current.sentence)} line ${String(offset + 1)} contains CR`,
      );
    }
    current.sites.push({ line: offset + 1, ...splitClause(line) });
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

/** @param {Map<string, Uint8Array>} files @returns {ReferenceCorpus} */
export const referenceCorpus = (files) => {
  const cases = referenceCases(files);
  const byKey = new Map(cases.map((item) => [`${item.document}:S${String(item.sentence)}`, item]));
  /** @type {ReferenceCorpus['records']} */
  const records = {};
  /** @type {ReferenceCorpus['groups']} */
  const groups = {};
  /** @type {string[]} */
  const recordOrder = [];

  for (const document of DOCUMENT_ORDER) {
    const clauses = adviceClauses(files, document);
    groups[document] = groupFragments(clauses).map(fragmentTerm);
    for (const clause of clauses) {
      const key = `${document}:S${String(clause.sentence)}`;
      const item = byKey.get(key);
      if (item === undefined) throw new Error(`${key}: no independently enumerated content sites`);
      if (item.original !== clause.original)
        throw new Error(`${key}: payload marker and ACE source diverge`);
      const fragmentGroup = groupFragments([clause])[0];
      if (fragmentGroup === undefined)
        throw new Error(`${key}: fragment rendering lost its sentence`);
      const rawPremises = positiveGoals(item.antecedent);
      const grounded = groundTerms(
        [...item.sites.map(({ head }) => head), ...rawPremises],
        (ordinal) =>
          `'$clinical_hypothetical'(${encodedAtom(document)},${String(clause.sentence)},${String(ordinal)})`,
      );
      const groundHeads = grounded.slice(0, item.sites.length);
      const premises = grounded.slice(item.sites.length);
      records[key] = {
        key,
        document,
        sentence: clause.sentence,
        original: clause.original,
        fragment: fragmentTerm(fragmentGroup),
        antecedent: item.antecedent,
        premises,
        groundHeads,
        sites: item.sites,
      };
      recordOrder.push(key);
    }
  }
  if (recordOrder.length !== cases.length || new Set(recordOrder).size !== cases.length) {
    throw new Error(
      `reference joined ${String(recordOrder.length)} of ${String(cases.length)} cases`,
    );
  }
  return { version: 1, documentOrder: [...DOCUMENT_ORDER], recordOrder, records, groups };
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
    if (round < 0 || square < 0 || curly < 0) throw new Error('unbalanced clinical helper');
  }
  if (round !== 0 || square !== 0 || curly !== 0) throw new Error('unbalanced clinical helper');
  if (clean.slice(start).trim() !== '') throw new Error('clinical helper lacks a final full stop');
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

/** @param {string} source @param {string} name */
const callArguments = (source, name) => {
  const prefix = `${name}(`;
  if (!source.startsWith(prefix) || !source.endsWith(')')) {
    throw new Error(`expected ${name}/?; got ${source}`);
  }
  return splitTopLevel(source.slice(prefix.length, -1), ',');
};

/** @param {string} source */
const listItems = (source) => {
  if (!source.startsWith('[') || !source.endsWith(']'))
    throw new Error(`expected list; got ${source}`);
  const inner = source.slice(1, -1);
  return inner === '' ? [] : splitTopLevel(inner, ',');
};

/** @param {string} source */
const natural = (source) => {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(source))
    throw new Error(`expected natural number; got ${source}`);
  return Number(source);
};

/** @param {string} source @returns {ActualGate} */
const parseGate = (source) => {
  const halves = splitTopLevel(source, ':-');
  if (halves.length !== 2) throw new Error(`gate must contain one rule separator: ${source}`);
  const head = callArguments(/** @type {string} */ (halves[0]), 'clinical_gate');
  if (head.length !== 4) throw new Error(`clinical_gate arity=${String(head.length)}`);
  const document = head[0] ?? '';
  const sentence = head[1] ?? '';
  natural(sentence);
  const variable = head[2] ?? '';
  if (variable === '_' || !/^[A-Z_][A-Za-z0-9_]*$/u.test(variable)) {
    throw new Error(`gate Rule is not a shared variable: ${variable}`);
  }
  const lines = listItems(head[3] ?? '').map(natural);
  const body = splitTopLevel(/** @type {string} */ (halves[1]), ',');
  if (body.length !== lines.length + 1) throw new Error('gate line list and use chain differ');
  /** @type {string[]} */
  const heads = [];
  for (const [index, sourceUse] of body.slice(0, -1).entries()) {
    const use = callArguments(sourceUse, 'clinical_use');
    if (use.length !== 2) throw new Error(`clinical_use arity=${String(use.length)}`);
    if (natural(use[0] ?? '') !== lines[index])
      throw new Error('gate line list and use order differ');
    const term = unwrap(use[1] ?? '');
    if (term === undefined)
      throw new Error(`clinical_use head is not parenthesized: ${use[1] ?? ''}`);
    heads.push(term);
  }
  const rule = callArguments(body.at(-1) ?? '', 'clinical_rule');
  if (rule.length !== 3 || rule[0] !== document || rule[1] !== sentence || rule[2] !== variable) {
    throw new Error('gate does not close through its own clinical_rule');
  }
  return {
    key: `${document}\u0000${sentence}`,
    document,
    sentence,
    lines,
    heads,
    ruleVariable: variable,
  };
};

/** @param {string} source @returns {ActualPremise} */
const parsePremise = (source) => {
  const args = callArguments(source, 'clinical_premise');
  if (args.length !== 4) throw new Error(`clinical_premise arity=${String(args.length)}`);
  const document = args[0] ?? '';
  const sentence = args[1] ?? '';
  natural(sentence);
  const term = unwrap(args[3] ?? '');
  if (term === undefined)
    throw new Error(`clinical_premise literal is not parenthesized: ${args[3] ?? ''}`);
  return {
    key: `${document}\u0000${sentence}`,
    document,
    sentence,
    ordinal: natural(args[2] ?? ''),
    literal: term,
  };
};

/** @param {string} source @returns {ActualRule} */
const parseRule = (source) => {
  const args = callArguments(source, 'clinical_rule');
  if (args.length !== 3) throw new Error(`clinical_rule arity=${String(args.length)}`);
  const document = args[0] ?? '';
  const sentence = args[1] ?? '';
  natural(sentence);
  const fragment = args[2] ?? '';
  if (callArguments(fragment, 'rule').length !== 4)
    throw new Error(`invalid rule fragment ${fragment}`);
  return { key: `${document}::${sentence}`, document, sentence, fragment };
};

/**
 * Read the shipped answer term off `clinical_advice_source/4`. u3 turned
 * `clinical_advice/3` into a derivation rule, so the emitted answer term now travels with
 * the site list. u4 removes this record; the reassembly differential then re-anchors on a
 * live derivation instead of an emitted term.
 * @param {string} source @returns {ActualAdvice}
 */
const parseAdvice = (source) => {
  const args = callArguments(source, 'clinical_advice_source');
  if (args.length !== 4) throw new Error(`clinical_advice_source arity=${String(args.length)}`);
  const answer = callArguments(args[2] ?? '', 'clinical_answer');
  if (answer.length !== 3) throw new Error(`clinical_answer arity=${String(answer.length)}`);
  const document = answer[0] ?? '';
  const groups = answer[1] ?? '';
  listItems(groups);
  return { key: document, document, groups };
};

/** @param {string} source @returns {ActualRecords} */
const actualRecords = (source) => {
  /** @type {ActualGate[]} */
  const gates = [];
  /** @type {ActualPremise[]} */
  const premises = [];
  /** @type {ActualRule[]} */
  const rules = [];
  /** @type {ActualAdvice[]} */
  const advice = [];
  /** @type {string[]} */
  const malformedGates = [];
  /** @type {string[]} */
  const malformedPremises = [];
  /** @type {string[]} */
  const malformedRules = [];
  /** @type {string[]} */
  const malformedAdvice = [];
  for (const raw of statements(source)) {
    const statement = compact(raw);
    if (statement.startsWith('clinical_gate(')) {
      try {
        gates.push(parseGate(statement));
      } catch (error) {
        malformedGates.push(error instanceof Error ? error.message : String(error));
      }
    } else if (statement.startsWith('clinical_premise(')) {
      try {
        premises.push(parsePremise(statement));
      } catch (error) {
        malformedPremises.push(error instanceof Error ? error.message : String(error));
      }
    } else if (statement.startsWith('clinical_rule(')) {
      try {
        rules.push(parseRule(statement));
      } catch (error) {
        malformedRules.push(error instanceof Error ? error.message : String(error));
      }
    } else if (statement.startsWith('clinical_advice_source(')) {
      try {
        advice.push(parseAdvice(statement));
      } catch (error) {
        malformedAdvice.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  return {
    gates,
    premises,
    rules,
    advice,
    malformedGates,
    malformedPremises,
    malformedRules,
    malformedAdvice,
  };
};

/** @param {ReferenceRecord} record */
const prologKey = (record) => `${encodedAtom(record.document)}\u0000${String(record.sentence)}`;

/** @template {{ key: string }} T @param {T[]} values @param {string} kind @param {string[]} divergences */
const keyed = (values, kind, divergences) => {
  /** @type {Map<string, T>} */
  const result = new Map();
  for (const value of values) {
    if (result.has(value.key))
      divergences.push(`${kind}: duplicate ${value.key.replace('\u0000', ':S')}`);
    else result.set(value.key, value);
  }
  return result;
};

/** @param {string[]} expected @param {string[]} actual @param {string} label @param {string[]} divergences */
const compareOrdered = (expected, actual, label, divergences) => {
  if (expected.length !== actual.length) {
    divergences.push(
      `${label}: count expected=${String(expected.length)} actual=${String(actual.length)}`,
    );
  }
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    if (expected[index] !== actual[index]) {
      divergences.push(
        `${label}[${String(index)}]: expected=${expected[index] ?? '<missing>'} actual=${actual[index] ?? '<missing>'}`,
      );
    }
  }
};

/** @param {string[]} terms @param {string} document @param {number} sentence */
const normalizedSkolems = (terms, document, sentence) => {
  const prefix = `'$clinical_hypothetical'(${encodedAtom(document)},${String(sentence)},`;
  const pattern = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}[0-9]+\\)`, 'gu');
  /** @type {Map<string, string>} */
  const names = new Map();
  const normalized = terms.map((term) =>
    term.replace(pattern, (match) => {
      let name = names.get(match);
      if (name === undefined) {
        name = `'$oracle_skolem'(${String(names.size)})`;
        names.set(match, name);
      }
      return name;
    }),
  );
  if (normalized.some((term) => term.includes("'$clinical_hypothetical'("))) {
    throw new Error(`${document}:S${String(sentence)} carries a foreign or malformed skolem`);
  }
  return normalized;
};

/** @param {ReferenceCorpus} corpus @param {ActualRecords} actual @returns {SiteDiff} */
const compareSites = (corpus, actual) => {
  const divergences = [...actual.malformedGates.map((message) => `gate malformed: ${message}`)];
  const gates = keyed(actual.gates, 'gate', divergences);
  const expectedKeys = new Set();
  /** @type {Map<number, ReferenceSite>} */
  const sitesByLine = new Map();
  let expectedSites = 0;
  for (const key of corpus.recordOrder) {
    const record = /** @type {ReferenceRecord} */ (corpus.records[key]);
    const pkey = prologKey(record);
    expectedKeys.add(pkey);
    expectedSites += record.sites.length;
    for (const site of record.sites) {
      if (sitesByLine.has(site.line))
        divergences.push(`reference: duplicate source line ${String(site.line)}`);
      sitesByLine.set(site.line, site);
    }
    const gate = gates.get(pkey);
    if (gate === undefined) {
      divergences.push(`gate missing: ${key}`);
      continue;
    }
    compareOrdered(
      record.sites.map(({ line }) => String(line)),
      gate.lines.map(String),
      `${key} lines`,
      divergences,
    );
    const actualVector = gate.lines.map((line) => {
      const site = sitesByLine.get(line);
      return site === undefined
        ? `<invented:${String(line)}>`
        : `${String(line)}\u0000${site.head}\u0000${site.body}`;
    });
    compareOrdered(
      record.sites.map(({ line, head, body }) => `${String(line)}\u0000${head}\u0000${body}`),
      actualVector,
      `${key} source vector`,
      divergences,
    );
    try {
      compareOrdered(
        normalizedSkolems(record.groundHeads, record.document, record.sentence),
        normalizedSkolems(gate.heads, record.document, record.sentence),
        `${key} grounded heads`,
        divergences,
      );
    } catch (error) {
      divergences.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const gate of actual.gates) {
    if (!expectedKeys.has(gate.key))
      divergences.push(`gate unexpected: ${gate.key.replace('\u0000', ':S')}`);
  }
  /** @type {Map<number, string>} */
  const owners = new Map();
  for (const gate of actual.gates) {
    for (const line of gate.lines) {
      const owner = owners.get(line);
      if (owner !== undefined)
        divergences.push(`site line ${String(line)} owned by ${owner} and ${gate.key}`);
      else owners.set(line, gate.key);
    }
  }
  return {
    divergences,
    expectedRecords: corpus.recordOrder.length,
    actualRecords: actual.gates.length,
    expectedSites,
    actualSites: actual.gates.reduce((sum, gate) => sum + gate.lines.length, 0),
  };
};

/** @param {ReferenceCorpus} corpus @param {ActualRecords} actual @returns {PremiseDiff} */
const comparePremises = (corpus, actual) => {
  const divergences = [
    ...actual.malformedPremises.map((message) => `premise malformed: ${message}`),
  ];
  const gateMessages = /** @type {string[]} */ ([]);
  const gates = keyed(actual.gates, 'gate', gateMessages);
  divergences.push(...gateMessages);
  /** @type {Map<string, ActualPremise[]>} */
  const premiseGroups = new Map();
  for (const premise of actual.premises) {
    const group = premiseGroups.get(premise.key) ?? [];
    group.push(premise);
    premiseGroups.set(premise.key, group);
  }
  const expectedKeys = new Set();
  let expectedPremises = 0;
  for (const key of corpus.recordOrder) {
    const record = /** @type {ReferenceRecord} */ (corpus.records[key]);
    const pkey = prologKey(record);
    expectedKeys.add(pkey);
    expectedPremises += record.premises.length;
    const premises = premiseGroups.get(pkey) ?? [];
    compareOrdered(
      record.premises.map((_, index) => String(index)),
      premises.map(({ ordinal }) => String(ordinal)),
      `${key} premise ordinals`,
      divergences,
    );
    const gate = gates.get(pkey);
    if (gate === undefined) {
      divergences.push(`premise sharing lacks gate: ${key}`);
      continue;
    }
    try {
      compareOrdered(
        normalizedSkolems(
          [...record.groundHeads, ...record.premises],
          record.document,
          record.sentence,
        ),
        normalizedSkolems(
          [...gate.heads, ...premises.map(({ literal }) => literal)],
          record.document,
          record.sentence,
        ),
        `${key} head/premise sharing`,
        divergences,
      );
    } catch (error) {
      divergences.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const key of premiseGroups.keys()) {
    if (!expectedKeys.has(key))
      divergences.push(`premise unexpected: ${key.replace('\u0000', ':S')}`);
  }
  return {
    divergences,
    expectedPremises,
    actualPremises: actual.premises.length,
  };
};

/** @param {string} document @param {number | string} sentence */
const ruleKey = (document, sentence) => `${document}::${String(sentence)}`;

/** @param {ReferenceCorpus} corpus @param {ActualRecords} actual @returns {RuleDiff} */
const compareRules = (corpus, actual) => {
  const divergences = [
    ...actual.malformedRules.map((message) => `rule malformed: ${message}`),
    ...actual.malformedGates.map((message) => `gate malformed: ${message}`),
  ];
  const rules = keyed(actual.rules, 'rule', divergences);
  /** @type {Map<string, ActualGate>} */
  const gates = new Map();
  for (const gate of actual.gates) {
    const key = ruleKey(gate.document, gate.sentence);
    if (gates.has(key)) divergences.push(`gate: duplicate ${key}`);
    else gates.set(key, gate);
  }
  const expectedOrder = corpus.recordOrder.map((key) => {
    const record = /** @type {ReferenceRecord} */ (corpus.records[key]);
    return ruleKey(encodedAtom(record.document), record.sentence);
  });
  compareOrdered(
    expectedOrder,
    actual.rules.map(({ key }) => key),
    'clinical_rule order',
    divergences,
  );
  compareOrdered(
    expectedOrder,
    actual.gates.map(({ document, sentence }) => ruleKey(document, sentence)),
    'clinical_gate order',
    divergences,
  );
  const expectedKeys = new Set(expectedOrder);
  for (const key of corpus.recordOrder) {
    const record = /** @type {ReferenceRecord} */ (corpus.records[key]);
    const expectedKey = ruleKey(encodedAtom(record.document), record.sentence);
    const rule = rules.get(expectedKey);
    if (rule === undefined) divergences.push(`rule missing: ${key}`);
    else if (rule.fragment !== record.fragment) {
      divergences.push(`${key} fragment: expected=${record.fragment} actual=${rule.fragment}`);
    }
    if (!gates.has(expectedKey)) divergences.push(`rule gate missing: ${key}`);
  }
  for (const rule of actual.rules) {
    if (!expectedKeys.has(rule.key)) divergences.push(`rule unexpected: ${rule.key}`);
  }
  for (const gate of actual.gates) {
    const key = ruleKey(gate.document, gate.sentence);
    if (!expectedKeys.has(key)) divergences.push(`gate unexpected: ${key}`);
  }
  return {
    divergences,
    expectedRules: corpus.recordOrder.length,
    actualRules: actual.rules.length,
    expectedGates: corpus.recordOrder.length,
    actualGates: actual.gates.length,
  };
};

/** @param {ActualRule[]} rules @param {string} document @param {string[]} divergences */
const reassemble = (rules, document, divergences) => {
  /** @type {Array<{ conditions: string[], tail: string[], unconditional: boolean }>} */
  const groups = [];
  /** @type {Map<string, { conditions: string[], tail: string[], unconditional: boolean }>} */
  const byConsequence = new Map();
  for (const rule of rules) {
    const args = callArguments(rule.fragment, 'rule');
    if (args.length !== 4) {
      divergences.push(`${document}: malformed rule fragment ${rule.fragment}`);
      continue;
    }
    const conditions = listItems(args[0] ?? '');
    if (conditions.length > 1) {
      divergences.push(
        `${document}: sentence fragment carries ${String(conditions.length)} conditions`,
      );
    }
    const tail = args.slice(1);
    const key = JSON.stringify(tail);
    let group = byConsequence.get(key);
    if (group === undefined) {
      group = { conditions: [], tail, unconditional: false };
      byConsequence.set(key, group);
      groups.push(group);
    }
    if (conditions.length === 0) {
      if (group.unconditional || group.conditions.length > 0) {
        divergences.push(`${document}: duplicate or mixed unconditional consequence ${key}`);
      }
      group.unconditional = true;
    } else {
      if (group.unconditional)
        divergences.push(`${document}: conditional/unconditional collision ${key}`);
      for (const condition of conditions) {
        if (group.conditions.includes(condition)) {
          divergences.push(`${document}: duplicate condition ${condition}`);
        }
        group.conditions.push(condition);
      }
    }
  }
  return groups.map(({ conditions, tail }) => `rule([${conditions.join(',')}],${tail.join(',')})`);
};

/** @param {ReferenceCorpus} corpus @param {ActualRecords} actual @returns {ReassemblyDiff} */
const compareReassembly = (corpus, actual) => {
  const divergences = [
    ...actual.malformedRules.map((message) => `rule malformed: ${message}`),
    ...actual.malformedAdvice.map((message) => `advice malformed: ${message}`),
  ];
  const advice = keyed(actual.advice, 'advice', divergences);
  const expectedDocuments = corpus.documentOrder.map(encodedAtom);
  compareOrdered(
    expectedDocuments,
    actual.advice.map(({ document }) => document),
    'clinical_advice order',
    divergences,
  );
  const expectedSet = new Set(expectedDocuments);
  let actualGroups = 0;
  for (const document of corpus.documentOrder) {
    const encoded = encodedAtom(document);
    const assembled = reassemble(
      actual.rules.filter((rule) => rule.document === encoded),
      document,
      divergences,
    );
    actualGroups += assembled.length;
    const expected = corpus.groups[document] ?? [];
    compareOrdered(expected, assembled, `${document} independent groups`, divergences);
    const shipped = advice.get(encoded);
    if (shipped === undefined) {
      divergences.push(`clinical_answer missing: ${document}`);
      continue;
    }
    const expectedList = `[${expected.join(',')}]`;
    const assembledList = `[${assembled.join(',')}]`;
    if (shipped.groups !== expectedList) {
      divergences.push(
        `${document} shipped groups: expected=${expectedList} actual=${shipped.groups}`,
      );
    }
    if (shipped.groups !== assembledList) {
      divergences.push(
        `${document} reassembly: expected=${shipped.groups} actual=${assembledList}`,
      );
    }
  }
  for (const item of actual.advice) {
    if (!expectedSet.has(item.document))
      divergences.push(`clinical_answer unexpected: ${item.document}`);
  }
  for (const rule of actual.rules) {
    if (!expectedSet.has(rule.document))
      divergences.push(`reassembly rule unexpected: ${rule.key}`);
  }
  return {
    divergences,
    expectedDocuments: corpus.documentOrder.length,
    actualDocuments: actual.advice.length,
    expectedGroups: Object.values(corpus.groups).reduce((sum, groups) => sum + groups.length, 0),
    actualGroups,
  };
};

/** Compare the independently derived source model with the generated helper.
 * @param {ReferenceCorpus} corpus @param {string} helper */
export const clinicalDifferential = (corpus, helper) => {
  const actual = actualRecords(helper);
  return {
    D1: compareSites(corpus, actual),
    D2: comparePremises(corpus, actual),
    D3: compareRules(corpus, actual),
    D4: compareReassembly(corpus, actual),
  };
};

/** @param {ReferenceCorpus} corpus */
export const referenceSummary = (corpus) => {
  /** @type {Record<string, { sites: number, sentences: Record<string, number> }>} */
  const documents = {};
  /** @type {Record<string, number>} */
  const premiseShapes = {};
  let sites = 0;
  let premises = 0;
  for (const key of corpus.recordOrder) {
    const record = /** @type {ReferenceRecord} */ (corpus.records[key]);
    const row = (documents[record.document] ??= { sites: 0, sentences: {} });
    row.sites += record.sites.length;
    row.sentences[String(record.sentence)] = record.sites.length;
    sites += record.sites.length;
    premises += record.premises.length;
    for (const premise of record.premises) {
      const open = premise.indexOf('(');
      if (open <= 0 || !premise.endsWith(')')) throw new Error(`unsupported premise ${premise}`);
      const shape = `${premise.slice(0, open)}/${String(splitTopLevel(premise.slice(open + 1, -1), ',').length)}`;
      premiseShapes[shape] = (premiseShapes[shape] ?? 0) + 1;
    }
  }
  return {
    documents,
    sites,
    sentences: corpus.recordOrder.length,
    premises,
    premiseShapes,
    distinctAntecedents: new Set(
      corpus.recordOrder.map(
        (key) => /** @type {ReferenceRecord} */ (corpus.records[key]).antecedent,
      ),
    ).size,
    groups: Object.values(corpus.groups).reduce((sum, group) => sum + group.length, 0),
  };
};

/** @param {ReferenceCorpus} corpus */
const referenceText = (corpus) => `${JSON.stringify(corpus)}\n`;

const main = () => {
  const command = process.argv[2] ?? 'summary';
  if (command === 'summary') {
    console.log(JSON.stringify(referenceSummary(referenceCorpus(bagFiles()))));
    return;
  }
  if (command === 'determinism') {
    const texts = [
      referenceText(referenceCorpus(bagFiles())),
      referenceText(referenceCorpus(bagFiles())),
    ];
    const hashes = texts.map((text) => createHash('sha256').update(text).digest('hex'));
    if (hashes[0] !== hashes[1]) throw new Error(`reference hashes differ: ${hashes.join(' ')}`);
    console.log(
      JSON.stringify({ bytes: Buffer.byteLength(/** @type {string} */ (texts[0])), hashes }),
    );
    return;
  }
  throw new Error(`unknown command ${command}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
