import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import type { Engine, ImageLoader } from '../src/engine/session.js';
import type { PlTerm } from '../src/engine/terms.js';
import type { IntakeRule, IntakeVocabulary, PainType } from '../src/intake/vocabulary.js';
import { CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';

import { artifacts, bagFiles } from './clinical-test-support.js';

// Restricted independent reader for the ground terms clinical_rule/3 emits.
export const readGroundTerm = (source: string): PlTerm => {
  const lexemes =
    source.match(/"(?:\\.|[^"\\])*"|'(?:\\.|''|[^'\\])*'|[a-zA-Z_][\w-]*|\d+|[()[\],.]/gu) ?? [];
  let offset = 0;
  for (const lexeme of lexemes) {
    while (offset < source.length && /\s/u.test(source[offset] ?? '')) offset += 1;
    if (!source.startsWith(lexeme, offset)) throw new Error(`unsupported ground term at ${offset}`);
    offset += lexeme.length;
  }
  if (source.slice(offset).trim() !== '') throw new Error('unparsed ground-term suffix');
  let cursor = 0;
  const consume = (lexeme: string): void => {
    if (lexemes[cursor++] !== lexeme) throw new Error(`expected ${lexeme} in ${source}`);
  };
  const sequence = (end: string): PlTerm[] => {
    const values: PlTerm[] = [];
    if (lexemes[cursor] !== end) {
      values.push(term());
      while (lexemes[cursor] === ',') {
        cursor += 1;
        values.push(term());
      }
    }
    consume(end);
    return values;
  };
  const term = (): PlTerm => {
    const lexeme = lexemes[cursor++];
    if (lexeme === undefined) throw new Error('truncated ground term');
    if (lexeme === '[') return { kind: 'list', items: sequence(']') };
    if (lexeme.startsWith('"')) return { kind: 'string', value: JSON.parse(lexeme) as string };
    if (/^\d+$/u.test(lexeme)) return { kind: 'integer', value: Number(lexeme) };
    const value = lexeme.startsWith("'")
      ? lexeme.slice(1, -1).replaceAll("''", "'").replaceAll("\\'", "'").replaceAll('\\\\', '\\')
      : lexeme;
    if (lexemes[cursor] === '(') {
      cursor += 1;
      return { kind: 'compound', functor: value, args: sequence(')') };
    }
    return { kind: 'atom', value };
  };
  const value = term();
  if (lexemes[cursor] === '.') cursor += 1;
  if (cursor !== lexemes.length) throw new Error('extra ground-term lexemes');
  return value;
};

export const compound = (term: PlTerm | undefined, name: string): PlTerm[] => {
  if (term?.kind !== 'compound' || term.functor !== name) throw new Error(`expected ${name}`);
  return term.args;
};
export const list = (term: PlTerm | undefined): PlTerm[] => {
  if (term?.kind !== 'list') throw new Error('expected list');
  return term.items;
};
export const text = (term: PlTerm | undefined): string => {
  if (term?.kind !== 'atom' && term?.kind !== 'string') throw new Error('expected text');
  return term.value;
};

export const ruleRecords = artifacts.helper
  .split('\n')
  .filter((line) => line.startsWith('clinical_rule('))
  .map((source) => {
    const [document, sentence, rule] = compound(readGroundTerm(source), 'clinical_rule');
    if (sentence?.kind !== 'integer' || rule === undefined) throw new Error('bad clinical rule');
    const [conditions, , , actions] = compound(rule, 'rule');
    const actionParts = list(actions).map((action) => compound(action, 'action'));
    return {
      id: `${text(document)}:${String(sentence.value)}`,
      document: text(document),
      sentence: Number(sentence.value),
      rule,
      source,
      conditions: list(conditions).map(text),
      objects: actionParts.map((parts) => text(parts[2])),
      modifiers: actionParts.flatMap((parts) =>
        list(parts[3]).map((modifier) => text(compound(modifier, 'modifier')[1])),
      ),
      actionText: actionParts.flatMap((parts) => [
        text(parts[1]),
        text(parts[2]),
        ...list(parts[3]).flatMap((modifier) => compound(modifier, 'modifier').map(text)),
      ]),
    };
  });

export const box3 = new TextDecoder('utf-8', { fatal: true }).decode(
  bagFiles.get('data/guidelines/cdc-2022-opioid/source/box3-extraction.txt'),
);
export const sectionRecords = box3
  .split('\n')
  .filter((line) => /^.+ \(Recommendations [\d, and]+\)$/u.test(line))
  .map((line, index) => {
    const heading = line.slice(0, line.lastIndexOf(' (Recommendations '));
    const list = line.slice(line.lastIndexOf('(Recommendations ') + 17, -1);
    return {
      id: `s${String(index + 1)}`,
      heading,
      documents: (list.match(/\d+/gu) ?? []).map(
        (number) => `cdc2022-opioid-rec${number.padStart(2, '0')}`,
      ),
    };
  });

const painTypes: readonly PainType[] = ['acute', 'subacute', 'chronic'];
const ownPains = (record: (typeof ruleRecords)[number]): PainType[] => {
  const words = [...record.conditions, ...record.actionText].join(' ');
  return painTypes.filter((pain) =>
    new RegExp(`(?<![\\p{L}\\p{N}-])${pain}-pain(?![\\p{L}\\p{N}-])`, 'u').test(words),
  );
};

export const digestOf = (raw: object): string => {
  const withoutDigest = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'digest'));
  return createHash('sha256').update(JSON.stringify(withoutDigest)).digest('hex');
};

export const referenceVocabulary = (): IntakeVocabulary => {
  const conditions = [...new Set(ruleRecords.flatMap((record) => record.conditions))].map(
    (value, index) => ({ id: `c${String(index + 1).padStart(2, '0')}`, text: value }),
  );
  const rules = ruleRecords.map((record) => {
    const section = sectionRecords.find(({ documents }) => documents.includes(record.document));
    const question = CLINICAL_QUESTIONS.find(({ sources }) =>
      sources.some(({ document }) => document === record.document),
    );
    if (section === undefined || question === undefined) throw new Error(`${record.id}: no owner`);
    if (record.conditions.length > 1) throw new Error(`${record.id}: multiple conditions`);
    const condition = conditions.find(({ text }) => text === record.conditions[0]);
    const own = ownPains(record);
    const documentPains = ruleRecords
      .filter(({ document }) => document === record.document)
      .flatMap(ownPains);
    return {
      id: record.id,
      document: record.document,
      sentence: record.sentence,
      trigger:
        condition === undefined
          ? { kind: 'section' as const, section: section.id }
          : { kind: 'condition' as const, condition: condition.id },
      painSet: painTypes.filter((pain) => (own.length > 0 ? own : documentPains).includes(pain)),
      section: section.id,
      question: question.id as IntakeRule['question'],
      goal: `clinical_derive('${record.document}',${String(record.sentence)},Rule,Proof)`,
    };
  });
  const vocabulary = [
    ...new Set(
      ruleRecords.flatMap((record) => [
        ...record.conditions,
        ...record.objects,
        ...record.modifiers,
      ]),
    ),
    // An intransitive action (`work with a patient`) carries the empty object: no term.
  ].filter((term) => term !== '');
  const result: IntakeVocabulary = {
    vocabularyVersion: 1,
    digest: '',
    conditions,
    sections: sectionRecords,
    vocabulary,
    rules,
  };
  return { ...result, digest: digestOf(result) };
};

const require = createRequire(import.meta.url);
export const loadIntakeImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  return (typeof factory === 'function' ? factory : factory.default)(image)({ arguments: ['-q'] });
};
