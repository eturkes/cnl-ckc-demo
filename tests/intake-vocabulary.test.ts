import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { decodeTerm } from '../src/engine/terms.js';
import type { IntakeVocabulary } from '../src/intake/vocabulary.js';
import { validateIntakeVocabulary } from '../tools/kb/intake.mjs';

import { ROOT } from './clinical-test-support.js';
import {
  box3,
  digestOf,
  loadIntakeImage,
  referenceVocabulary,
  ruleRecords,
  sectionRecords,
} from './intake-backend-support.js';

const subject = () => import('../src/intake/vocabulary.js');
const artifact = (): IntakeVocabulary =>
  JSON.parse(
    readFileSync(join(ROOT, 'kb/generated/intake-vocabulary.json'), 'utf8'),
  ) as IntakeVocabulary;
const keys = (value: object): string[] => Object.keys(value).sort();
const frozenTree = (value: unknown): void => {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) frozenTree(child);
};

interface Corruption {
  name: string;
  path: readonly (string | number)[];
  value?: unknown;
  remove?: boolean;
}
const corruptions: Corruption[] = [
  { name: 'vocabularyVersion', path: ['vocabularyVersion'], value: 2 },
  { name: 'vocabularyVersion', path: ['vocabularyVersion'], value: '1' },
  { name: 'digest', path: ['digest'], value: 'not-a-digest' },
  { name: 'conditions', path: ['conditions'], value: {} },
  { name: 'conditions', path: ['conditions', 0, 'id'], value: 1 },
  { name: 'conditions', path: ['conditions', 0, 'text'], value: null },
  { name: 'conditions', path: ['conditions', 0, 'text'], remove: true },
  { name: 'sections', path: ['sections'], value: 's1' },
  { name: 'sections', path: ['sections', 0, 'heading'], value: [] },
  { name: 'sections', path: ['sections', 0, 'documents'], value: null },
  { name: 'sections', path: ['sections', 0, 'documents', 0], value: 12 },
  { name: 'vocabulary', path: ['vocabulary'], value: null },
  { name: 'vocabulary', path: ['vocabulary', 0], value: {} },
  { name: 'rules', path: ['rules'], value: {} },
  { name: 'rules', path: ['rules', 0, 'id'], value: null },
  { name: 'rules', path: ['rules', 0, 'document'], value: 1 },
  { name: 'rules', path: ['rules', 0, 'sentence'], value: '2' },
  { name: 'rules', path: ['rules', 0, 'sentence'], value: 0.5 },
  { name: 'rules', path: ['rules', 0, 'trigger'], value: null },
  { name: 'rules', path: ['rules', 0, 'trigger', 'kind'], value: 'invented' },
  { name: 'rules', path: ['rules', 0, 'trigger'], value: { kind: 'condition', condition: 1 } },
  { name: 'rules', path: ['rules', 0, 'trigger'], value: { kind: 'section' } },
  { name: 'rules', path: ['rules', 0, 'painSet'], value: ['acute-pain'] },
  { name: 'rules', path: ['rules', 0, 'painSet'], value: {} },
  { name: 'rules', path: ['rules', 0, 'section'], value: 1 },
  { name: 'rules', path: ['rules', 0, 'question'], value: null },
  { name: 'rules', path: ['rules', 0, 'goal'], value: [] },
];

const changed = (raw: IntakeVocabulary, mutation: Corruption): unknown => {
  const result = structuredClone(raw) as unknown as Record<string, unknown>;
  let owner: Record<string | number, unknown> = result;
  for (const key of mutation.path.slice(0, -1)) owner = owner[key] as typeof owner;
  const key = mutation.path.at(-1);
  if (key === undefined) throw new Error('empty corruption path');
  if (mutation.remove === true) delete owner[key];
  else owner[key] = mutation.value;
  if (mutation.name !== 'digest') result.digest = digestOf(result);
  return result;
};

describe('intake vocabulary contract', () => {
  it('V1 artifact digest and exact public shape agree with the frozen reader', async () => {
    const { INTAKE_VOCABULARY, parseVocabulary } = await subject();
    const raw = artifact();
    expect(keys(raw)).toEqual([
      'conditions',
      'digest',
      'rules',
      'sections',
      'vocabulary',
      'vocabularyVersion',
    ]);
    expect(raw.vocabularyVersion).toBe(1);
    expect(raw.digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(raw.digest).toBe(digestOf(raw));
    for (const condition of raw.conditions) expect(keys(condition)).toEqual(['id', 'text']);
    for (const section of raw.sections)
      expect(keys(section)).toEqual(['documents', 'heading', 'id']);
    for (const rule of raw.rules) {
      expect(keys(rule)).toEqual([
        'document',
        'goal',
        'id',
        'painSet',
        'question',
        'section',
        'sentence',
        'trigger',
      ]);
      expect(keys(rule.trigger)).toEqual(
        rule.trigger.kind === 'condition' ? ['condition', 'kind'] : ['kind', 'section'],
      );
    }
    expect(INTAKE_VOCABULARY).toEqual(raw);
    expect(parseVocabulary(raw)).toEqual(raw);
    frozenTree(INTAKE_VOCABULARY);
  });

  it.each([null, undefined, true, 1, 'vocabulary', []].map((raw, index) => ({ raw, index })))(
    'V1 refuses root shape $index',
    async ({ raw }) => {
      const { parseVocabulary } = await subject();
      expect(() => parseVocabulary(raw)).toThrow();
    },
  );

  it.each(corruptions.map((mutation, index) => ({ ...mutation, index })))(
    'V1 refuses named field $name (mutation $index)',
    async (mutation) => {
      const { parseVocabulary } = await subject();
      expect(() => parseVocabulary(changed(artifact(), mutation))).toThrow(
        new RegExp(mutation.name, 'iu'),
      );
    },
  );

  // A well-formed digest that disagrees with the body is a content check: `src/` may not
  // serialize (`kb:asset-check`), so the build grader owns it, not the browser reader.
  it('V1 refuses named field digest when a well-formed digest disagrees with the body', () => {
    const built = artifact() as unknown as Parameters<typeof validateIntakeVocabulary>[0];
    expect(validateIntakeVocabulary({ ...built, digest: 'f'.repeat(64) })).toContain(
      'digest does not match the artifact body',
    );
    expect(validateIntakeVocabulary(built)).toEqual([]);
  });

  it('V1 refuses each missing root field and extra root or nested fields', async () => {
    const { parseVocabulary } = await subject();
    for (const field of keys(artifact())) {
      expect(
        () => parseVocabulary(changed(artifact(), { name: field, path: [field], remove: true })),
        field,
      ).toThrow(new RegExp(field, 'iu'));
    }
    for (const path of [
      [],
      ['conditions', 0],
      ['sections', 0],
      ['rules', 0],
      ['rules', 0, 'trigger'],
    ] as const) {
      const raw = changed(artifact(), {
        name: String(path[0] ?? 'extra'),
        path: [...path, 'extra'],
        value: true,
      });
      expect(() => parseVocabulary(raw), `extra at ${path.join('.')}`).toThrow();
    }
  });

  it('V2 census and section membership come from the four verbatim Box 3 lines', async () => {
    const { INTAKE_VOCABULARY: actual } = await subject();
    expect(actual.conditions).toHaveLength(24);
    expect(actual.sections).toHaveLength(4);
    expect(actual.rules).toHaveLength(48);
    expect(actual.rules.filter(({ trigger }) => trigger.kind === 'condition')).toHaveLength(26);
    expect(actual.rules.filter(({ trigger }) => trigger.kind === 'section')).toHaveLength(22);
    expect(actual.sections).toEqual(sectionRecords);
    for (const section of actual.sections) {
      const sourceLines = box3
        .split('\n')
        .filter(
          (line) => line.startsWith(`${section.heading} (Recommendations `) && line.endsWith(')'),
        );
      expect(sourceLines, section.id).toHaveLength(1);
    }
    for (const rule of actual.rules) {
      const owners = actual.sections.filter(({ documents }) => documents.includes(rule.document));
      expect(owners, rule.id).toHaveLength(1);
      expect(rule.section, rule.id).toBe(owners[0]?.id);
    }
  });

  it('V3 all rule identities, condition bytes, trigger ids and question owners match the independent bag oracle', async () => {
    const { INTAKE_VOCABULARY: actual } = await subject();
    const expected = referenceVocabulary();
    expect(ruleRecords).toHaveLength(48);
    expect(actual.conditions).toEqual(expected.conditions);
    expect(new Set(actual.vocabulary)).toEqual(new Set(expected.vocabulary));
    expect(new Set(actual.vocabulary).size).toBe(actual.vocabulary.length);
    expect(actual.rules.map(({ painSet: _painSet, goal: _goal, ...identity }) => identity)).toEqual(
      expected.rules.map(({ painSet: _painSet, goal: _goal, ...identity }) => identity),
    );
  });

  it('V4 every pain set follows own text then document union with hyphen-bounded types', async () => {
    const { INTAKE_VOCABULARY: actual } = await subject();
    expect(actual.rules.map(({ id, painSet }) => ({ id, painSet }))).toEqual(
      referenceVocabulary().rules.map(({ id, painSet }) => ({ id, painSet })),
    );
    expect(actual.rules.filter(({ painSet }) => painSet.length === 0)).toHaveLength(13);
  });

  it('V4 every declared pain hand-check holds, including subacute distinct from acute', async () => {
    const { INTAKE_VOCABULARY: actual } = await subject();
    const explicit: Record<string, readonly string[]> = {
      'cdc2022-opioid-rec07:2': ['subacute'],
      'cdc2022-opioid-rec07:3': ['chronic'],
      'cdc2022-opioid-rec07:4': ['subacute', 'chronic'],
      'cdc2022-opioid-rec07:5': ['subacute', 'chronic'],
      'cdc2022-opioid-rec10:4': ['subacute', 'chronic'],
      'cdc2022-opioid-rec09:5': ['acute', 'subacute', 'chronic'],
      'cdc2022-opioid-rec09:6': ['acute', 'subacute', 'chronic'],
    };
    const documents: Record<string, readonly string[]> = {
      'cdc2022-opioid-rec01': ['acute'],
      'cdc2022-opioid-rec02': ['subacute', 'chronic'],
      'cdc2022-opioid-rec05': [],
      'cdc2022-opioid-rec08': [],
      'cdc2022-opioid-rec11': [],
      'cdc2022-opioid-rec12': [],
    };
    for (const [id, pains] of Object.entries(explicit)) {
      expect(actual.rules.find((rule) => rule.id === id)?.painSet, id).toEqual(pains);
    }
    for (const [document, pains] of Object.entries(documents)) {
      const rows = actual.rules.filter((rule) => rule.document === document);
      expect(rows.length, document).toBeGreaterThan(0);
      for (const rule of rows) expect(rule.painSet, rule.id).toEqual(pains);
    }
  });

  it('V5 all 48 artifact goals derive exactly their own clinical_rule term on the saved image', async () => {
    const { INTAKE_VOCABULARY: actual } = await subject();
    const engine = await loadIntakeImage(
      new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))),
    );
    expect(actual.rules).toHaveLength(ruleRecords.length);
    let graded = 0;
    for (const [index, rule] of actual.rules.entries()) {
      expect(rule.goal, rule.id).toBe(
        `clinical_derive('${rule.document}',${String(rule.sentence)},Rule,Proof)`,
      );
      const rows = [...engine.prolog.query(rule.goal)] as Record<string, unknown>[];
      expect(rows, rule.id).toHaveLength(1);
      expect(decodeTerm(rows[0]?.Rule), rule.id).toEqual(ruleRecords[index]?.rule);
      expect(rows[0], rule.id).toHaveProperty('Proof');
      graded += 1;
    }
    expect(graded).toBe(48);
  }, 120_000);
});
