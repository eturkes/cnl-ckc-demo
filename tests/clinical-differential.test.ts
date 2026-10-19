import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  clinicalDifferential,
  referenceCorpus,
  referenceSummary,
} from '../tools/clinical-reference.mjs';
import { verifyBag } from '../tools/kb/bag.mjs';
import { CLINICAL_QUESTIONS, clinicalArtifacts } from '../tools/kb/clinical.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
if (archives.length !== 1) throw new Error(`expected one KB bag, found ${String(archives.length)}`);
const files = verifyBag(readFileSync(join(ROOT, 'kb', archives[0] as string))).files;
const reference = referenceCorpus(files);
const summary = referenceSummary(reference);
const artifacts = clinicalArtifacts(files);
// u4 retired `clinical_advice_source/4`, so the shipped answer term is no longer in the
// helper text. D4 grades the independent reassembly against the producer's own oracle;
// `clinical-answer-live` A2 grades that oracle against the live derivation.
const answerTerms = CLINICAL_QUESTIONS.flatMap(({ id }) => artifacts.answers.get(id) ?? []);
const differential = clinicalDifferential(reference, artifacts.source, answerTerms);
const evidence = (divergences: string[]): string => divergences.slice(0, 20).join('\n');

describe('clinical compiler differential', () => {
  it('D1: emits the independently enumerated keyed source vectors', () => {
    const producer = readFileSync(join(ROOT, 'tools', 'clinical-reference.mjs'), 'utf8');
    expect(producer.match(/\.\/kb\/clinical\.mjs/gu) ?? []).toHaveLength(1);
    expect(producer).toContain("import { parseAdviceSentence } from './kb/clinical.mjs';");
    expect(differential.D1.divergences, evidence(differential.D1.divergences)).toEqual([]);
    expect(differential.D1).toMatchObject({
      expectedRecords: 53,
      actualRecords: 53,
      expectedSites: 723,
      actualSites: 723,
    });
  });

  it('D2: preserves premise order and opaque-skolem sharing', () => {
    expect(differential.D2.divergences, evidence(differential.D2.divergences)).toEqual([]);
    expect(differential.D2).toMatchObject({ expectedPremises: 451, actualPremises: 451 });
  });

  it('D3: keeps one rule and its unifying gate per sentence', () => {
    expect(differential.D3.divergences, evidence(differential.D3.divergences)).toEqual([]);
    expect(differential.D3).toMatchObject({
      expectedRules: 53,
      actualRules: 53,
      expectedGates: 53,
      actualGates: 53,
    });
  });

  it('D4: reassembles sentence rules into the shipped grouped terms', () => {
    expect(differential.D4.divergences, evidence(differential.D4.divergences)).toEqual([]);
    expect(differential.D4).toMatchObject({
      expectedDocuments: 12,
      actualDocuments: 12,
      expectedGroups: 43,
      actualGroups: 43,
    });
  });

  it('D8: reproduces the superseded oracle census', () => {
    expect(summary).toMatchObject({
      sites: 723,
      sentences: 53,
      premises: 451,
      distinctAntecedents: 37,
      groups: 43,
      premiseShapes: {
        'guideline_entity/4': 133,
        'guideline_cardinality/5': 133,
        'guideline_operator/3': 5,
        'guideline_event/3': 47,
        'guideline_arg/4': 94,
        'guideline_pp/4': 27,
        'guideline_property/4': 5,
        'guideline_qualifier/4': 7,
      },
    });
    expect(
      Object.fromEntries(
        Object.entries(summary.documents).map(([document, { sites }]) => [document, sites]),
      ),
    ).toEqual({
      'cdc2022-opioid-rec01': 41,
      'cdc2022-opioid-rec02': 83,
      'cdc2022-opioid-rec03': 30,
      'cdc2022-opioid-rec04': 76,
      'cdc2022-opioid-rec06': 9,
      'cdc2022-opioid-rec07': 154,
      'cdc2022-opioid-rec08': 76,
      'cdc2022-opioid-rec09': 58,
      'cdc2022-opioid-rec10': 44,
      'cdc2022-opioid-rec11': 16,
      'cdc2022-opioid-rec05': 87,
      'cdc2022-opioid-rec12': 49,
    });
  });
});
