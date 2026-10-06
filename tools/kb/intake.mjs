// Free-text intake vocabulary, derived from the verified bag (`.agent/contracts/m5u16.md` V1-V6).
//
// Every rule here is one `clinical_rule/3` fragment the image carries, read from the SAME parsed
// clauses `clinicalArtifacts` emits, so the artifact and the image cannot disagree. A rule's
// trigger is its condition, else its CDC Box 3 section; its goal is the build-time
// `clinical_derive/4` call the browser runs by id, so no goal is assembled at run time.

import { createHash } from 'node:crypto';

import { CLINICAL_QUESTIONS, clinicalArtifacts } from './clinical.mjs';
import { deriveProvenance } from './provenance.mjs';

export const INTAKE_VOCABULARY_VERSION = 1;
export const INTAKE_PATH = 'intake-vocabulary.json';
const BOX3 = 'data/guidelines/cdc-2022-opioid/source/box3-extraction.txt';
const SECTION = /^(.+) \(Recommendations ([0-9, and]+)\)$/u;
const NUMBERS = /^[0-9]+$/u;
const PAIN_TYPES = /** @type {const} */ (['acute', 'subacute', 'chronic']);
// Hyphen-bounded: `subacute-pain` must never read as `acute-pain`.
const PAIN = /(?<![\w-])(acute|subacute|chronic)-pain(?![\w-])/gu;
// Quote-free, so the id embeds in a quoted atom as-is.
const DOCUMENT = /^[a-z0-9-]+$/u;

/** @typedef {typeof PAIN_TYPES[number]} PainType */
/** @typedef {{ kind: 'condition', condition: string } | { kind: 'section', section: string }} IntakeTrigger */
/** @typedef {{ id: string, document: string, sentence: number, trigger: IntakeTrigger, painSet: PainType[], section: string, question: string, goal: string, text: string }} IntakeRule */
/** @typedef {{ ace: { text: string, sentences: { number: number, text: string }[] }, alignment: { spans: { group: number, side: string, start: number, end: number }[] }, source: { text: string } }} AlignedDocument */
/** @typedef {{ id: string, heading: string, documents: string[] }} IntakeSection */
/** @typedef {{ vocabularyVersion: number, digest: string, conditions: { id: string, text: string }[], sections: IntakeSection[], vocabulary: string[], rules: IntakeRule[] }} IntakeVocabulary */

/** @param {number} value @param {number} width */
const pad = (value, width) => String(value).padStart(width, '0');

/** @param {string} document */
const goalOf = (document, /** @type {number} */ sentence) => {
  if (!DOCUMENT.test(document)) throw new Error(`intake: document id ${document} is not a plain atom`);
  return `clinical_derive('${document}',${String(sentence)},Rule,Proof)`;
};

/** @param {Map<string, Uint8Array>} files @returns {IntakeSection[]} */
const boxSections = (files) => {
  const bytes = files.get(BOX3);
  if (bytes === undefined) throw new Error(`intake: bag carries no ${BOX3}`);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return text
    .split('\n')
    .flatMap((line) => {
      const match = SECTION.exec(line);
      const heading = match?.[1];
      const list = match?.[2];
      return heading === undefined || list === undefined ? [] : [{ heading, list }];
    })
    .map(({ heading, list }, index) => ({
      id: `s${String(index + 1)}`,
      heading,
      documents: list.split(/, and |, | and /u).map((n) => {
        if (!NUMBERS.test(n)) throw new Error(`intake: Box 3 section ${heading} lists ${n}`);
        return `cdc2022-opioid-rec${pad(Number(n), 2)}`;
      }),
    }));
};

/** @param {import('./clinical.mjs').AdviceClause} clause @returns {Set<PainType>} */
const painMentions = (clause) => {
  const text = [
    clause.condition ?? '',
    ...clause.actions.flatMap((action) => [action.object, ...action.modifiers.map((m) => m.value)]),
  ].join('\n');
  return new Set([...text.matchAll(PAIN)].map((match) => /** @type {PainType} */ (match[1])));
};

/** @param {Set<PainType>} set @returns {PainType[]} */
const ordered = (set) => PAIN_TYPES.filter((type) => set.has(type));

// A source sentence ends at `.`, `!` or `?` before whitespace or the end of the passage.
const SOURCE_SENTENCE_END = /[.!?](?=\s|$)/gu;

/**
 * A rule's own guideline wording, which its judgment question quotes: the source sentence(s)
 * holding the alignment groups only its ACE sentence carries — all of its groups when none is
 * its own — so two rules of one document read as their own recommendations, not the whole
 * passage. Fails closed on a sentence with no aligned source text.
 *
 * @param {AlignedDocument} document @param {number} sentence @param {string} id
 * @returns {string}
 */
const rulePassage = (document, sentence, id) => {
  /** @type {Map<number, [number, number]>} */
  const ranges = new Map();
  let cursor = 0;
  for (const { number, text } of document.ace.sentences) {
    const start = document.ace.text.indexOf(text, cursor);
    if (start < 0) throw new Error(`intake: ${id} ACE sentence ${String(number)} is not in its text`);
    ranges.set(number, [start, start + text.length]);
    cursor = start + text.length;
  }
  /** @param {[number, number] | undefined} range @returns {Set<number>} */
  const groupsIn = (range) =>
    new Set(
      range === undefined
        ? []
        : document.alignment.spans
            .filter((span) => span.side === 'ace' && span.start >= range[0] && span.end <= range[1])
            .map((span) => span.group),
    );
  const own = groupsIn(ranges.get(sentence));
  const shared = new Set(
    [...ranges.keys()].filter((number) => number !== sentence).flatMap((number) => [...groupsIn(ranges.get(number))]),
  );
  const distinct = new Set([...own].filter((group) => !shared.has(group)));
  const groups = distinct.size > 0 ? distinct : own;
  const spans = document.alignment.spans.filter((span) => span.side === 'source' && groups.has(span.group));
  if (spans.length === 0) throw new Error(`intake: ${id} aligns to no source text`);
  const from = Math.min(...spans.map((span) => span.start));
  const to = Math.max(...spans.map((span) => span.end));
  const ends = [...document.source.text.matchAll(SOURCE_SENTENCE_END)].map((match) => match.index + 1);
  const start = Math.max(0, ...ends.filter((end) => end <= from));
  const end = Math.min(document.source.text.length, ...ends.filter((end) => end >= to));
  return document.source.text.slice(start, end).trim();
};

/** @param {Omit<IntakeVocabulary, 'digest'>} body */
export const vocabularyDigest = (body) =>
  createHash('sha256').update(JSON.stringify(body)).digest('hex');

/**
 * @param {Map<string, Uint8Array>} files
 * @returns {{ model: IntakeVocabulary, bytes: Uint8Array, path: string }}
 */
export const deriveIntakeVocabulary = (files) => {
  const { sentences } = clinicalArtifacts(files);
  /** @type {Map<string, AlignedDocument>} */
  const aligned = new Map(
    deriveProvenance(files).chunks.map((chunk) => [chunk.document, /** @type {AlignedDocument} */ (chunk.model)]),
  );
  const sections = boxSections(files);
  /** @type {Map<string, string>} */
  const conditionIds = new Map();
  /** @type {string[]} */
  const vocabulary = [];
  /** @param {string} term */
  const note = (term) => {
    if (term !== '' && !vocabulary.includes(term)) vocabulary.push(term);
  };
  /** @type {Map<string, Set<PainType>>} */
  const documentPain = new Map();
  for (const { document, clause } of sentences) {
    if (clause.condition !== undefined && !conditionIds.has(clause.condition)) {
      conditionIds.set(clause.condition, `c${pad(conditionIds.size + 1, 2)}`);
    }
    if (clause.condition !== undefined) note(clause.condition);
    for (const action of clause.actions) {
      note(action.object);
      for (const modifier of action.modifiers) note(modifier.value);
    }
    const pain = documentPain.get(document) ?? new Set();
    for (const type of painMentions(clause)) pain.add(type);
    documentPain.set(document, pain);
  }
  const rules = sentences.map(({ question, document, clause }) => {
    const own = painMentions(clause);
    const section = sections.find((candidate) => candidate.documents.includes(document));
    const condition = clause.condition === undefined ? undefined : conditionIds.get(clause.condition);
    /** @type {IntakeTrigger} */
    const trigger =
      condition === undefined
        ? { kind: 'section', section: section?.id ?? '' }
        : { kind: 'condition', condition };
    const id = `${document}:${String(clause.sentence)}`;
    const evidence = aligned.get(document);
    if (evidence === undefined) throw new Error(`intake: ${id} has no provenance document`);
    return {
      id,
      document,
      sentence: clause.sentence,
      trigger,
      painSet: ordered(own.size > 0 ? own : (documentPain.get(document) ?? new Set())),
      section: section?.id ?? '',
      question,
      goal: goalOf(document, clause.sentence),
      text: rulePassage(evidence, clause.sentence, id),
    };
  });
  const body = {
    vocabularyVersion: INTAKE_VOCABULARY_VERSION,
    conditions: [...conditionIds].map(([text, id]) => ({ id, text })),
    sections,
    vocabulary,
    rules,
  };
  const model = {
    vocabularyVersion: body.vocabularyVersion,
    digest: vocabularyDigest(body),
    conditions: body.conditions,
    sections: body.sections,
    vocabulary: body.vocabulary,
    rules: body.rules,
  };
  return {
    model,
    bytes: Buffer.from(`${JSON.stringify(model, undefined, 2)}\n`, 'utf8'),
    path: INTAKE_PATH,
  };
};

/**
 * Structural refusals over a derived model. Census counts are the suite's to pin; this grades
 * the invariants every consumer relies on, so an emptied table or an orphaned reference is named.
 *
 * @param {IntakeVocabulary} model @returns {string[]}
 */
export const validateIntakeVocabulary = (model) => {
  /** @type {string[]} */
  const problems = [];
  if (model.vocabularyVersion !== INTAKE_VOCABULARY_VERSION) {
    problems.push(`vocabularyVersion ${String(model.vocabularyVersion)} is not ${String(INTAKE_VOCABULARY_VERSION)}`);
  }
  const body = {
    vocabularyVersion: model.vocabularyVersion,
    conditions: model.conditions,
    sections: model.sections,
    vocabulary: model.vocabulary,
    rules: model.rules,
  };
  if (model.digest !== vocabularyDigest(body)) problems.push('digest does not match the artifact body');
  for (const table of /** @type {const} */ (['conditions', 'sections', 'vocabulary', 'rules'])) {
    if (model[table].length === 0) problems.push(`${table} table is empty`);
  }
  const conditions = new Set(model.conditions.map((condition) => condition.id));
  const sections = new Map(model.sections.map((section) => [section.id, section]));
  for (const section of model.sections) {
    if (section.documents.length === 0) problems.push(`section ${section.id} has no documents`);
  }
  const questions = new Set(CLINICAL_QUESTIONS.map((question) => question.id));
  const ids = new Set();
  for (const rule of model.rules) {
    if (ids.has(rule.id)) problems.push(`rule ${rule.id} is duplicated`);
    ids.add(rule.id);
    const homes = model.sections.filter((section) => section.documents.includes(rule.document));
    if (homes.length !== 1) {
      problems.push(`rule ${rule.id}: document lies in ${String(homes.length)} sections, expected 1`);
    } else if (homes[0]?.id !== rule.section) {
      problems.push(`rule ${rule.id}: section ${rule.section} is not its document's`);
    }
    if (rule.trigger.kind === 'condition' && !conditions.has(rule.trigger.condition)) {
      problems.push(`rule ${rule.id}: unknown condition ${rule.trigger.condition}`);
    }
    if (rule.trigger.kind === 'section' && !sections.has(rule.trigger.section)) {
      problems.push(`rule ${rule.id}: unknown section ${rule.trigger.section}`);
    }
    if (rule.painSet.join() !== PAIN_TYPES.filter((type) => rule.painSet.includes(type)).join()) {
      problems.push(`rule ${rule.id}: painSet ${rule.painSet.join()} is not ordered acute, subacute, chronic`);
    }
    if (!questions.has(rule.question)) problems.push(`rule ${rule.id}: unknown question ${rule.question}`);
    if (rule.goal !== goalOf(rule.document, rule.sentence)) problems.push(`rule ${rule.id}: goal drifted`);
    if (rule.text.trim() === '') problems.push(`rule ${rule.id}: carries no guideline wording`);
  }
  return problems;
};
