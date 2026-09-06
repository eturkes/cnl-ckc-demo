// M5 u1 red suite — the compiled fragment/premise/gate records.
//
// SEED: every case fails until it encodes its ruled row from
// `.agent/contracts/m5u1.md` (predicates P1-P10, design rulings D1-D11, T14 rulings).

import { describe, expect, it } from 'vitest';

import { clinicalArtifacts, CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import {
  aceSentenceKeys,
  artifacts,
  bagFiles,
  canonicalGeneratedTerms,
  canonicalSourceTerms,
  gateRecords,
  helperLines,
  keyOf,
  mutatePlSentence,
  orderedHash,
  parseGateRecords,
  parsePremiseRecords,
  positiveGoals,
  scanContentSites,
  scanRawContentSites,
  sha12,
} from './clinical-test-support.js';

const unimplemented = (): never => {
  throw new Error('unimplemented');
};

describe('clinical records', () => {
  it('T1 byte identity: 7 questions, 12 canonical terms, raw contribution order', () => {
    const strings = CLINICAL_QUESTIONS.map(({ question }) => question);
    const order = CLINICAL_QUESTIONS.flatMap(({ sources }) =>
      sources.map(({ document }) => document),
    );
    const terms = CLINICAL_QUESTIONS.flatMap(({ id }) => artifacts.answers.get(id) ?? []);
    const advice = helperLines.filter((line) => line.startsWith('clinical_advice('));
    const sources = helperLines.filter((line) => line.startsWith('clinical_advice_source('));

    expect({
      strings: orderedHash(strings),
      order: orderedHash(order),
      terms: orderedHash(terms),
    }).toEqual({
      strings: 'dacbfac1c8b4',
      order: 'ba17af72c3d2',
      terms: '59a516ba9989',
    });
    expect(order).toEqual([
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
    expect({
      advice: orderedHash(advice),
      sources: orderedHash(sources),
      records: sha12(JSON.stringify(artifacts.records)),
      names: sha12(JSON.stringify(artifacts.names)),
    }).toEqual({
      advice: 'c82743a860ab',
      sources: '2bc7ca83227a',
      records: '23898631ca0a',
      names: '1d112e138ee5',
    });
    expect({
      advice: advice.length,
      sources: sources.length,
      rules: helperLines.filter((line) => line.startsWith('clinical_rule(')).length,
      premises: helperLines.filter((line) => line.startsWith('clinical_premise(')).length,
      gates: gateRecords.length,
    }).toEqual({ advice: 12, sources: 12, rules: 48, premises: 346, gates: 48 });
  });
  it('T3 total site coverage: 686 lines, equality both ways, ACE↔PL bijection', () => {
    const expectedCases = scanContentSites();
    const expected = new Map(
      expectedCases.map(({ document, sentence, sites }) => [
        keyOf(document, sentence),
        sites.map(({ line }) => line),
      ]),
    );
    const actual = new Map(
      gateRecords.map(({ document, sentence, lines }) => [keyOf(document, sentence), lines]),
    );
    const expectedLines = [...expected.values()].flat();
    const actualLines = gateRecords.flatMap(({ lines }) => lines);

    expect(expectedCases).toHaveLength(48);
    expect(expectedCases.every(({ sites }) => sites.length > 0)).toBe(true);
    expect(aceSentenceKeys().sort()).toEqual([...expected.keys()].sort());
    expect(gateRecords).toHaveLength(48);
    expect(actual.size).toBe(48);
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [key, lines] of expected) {
      expect(actual.get(key), key).toEqual(lines);
      expect(lines, `${key}: payload order`).toEqual(
        [...lines].sort((left, right) => left - right),
      );
    }
    expect(actualLines).toHaveLength(686);
    expect(new Set(actualLines).size).toBe(686);
    expect(actualLines.sort((left, right) => left - right)).toEqual(
      expectedLines.sort((left, right) => left - right),
    );
  });
  it('T4 site vector equals the reference recipe: keyed {line,head,body}', () => {
    const reference = scanContentSites();
    const raw = scanRawContentSites();
    const vector = raw.flatMap(({ document, sentence, sites }) =>
      sites.map(({ line, head, body }) => ({ document, sentence, line, head, body })),
    );

    expect(raw).toEqual(reference);
    expect(raw).toHaveLength(48);
    expect(raw.every(({ marker }) => /^% S[1-9][0-9]*: \S/u.test(marker))).toBe(true);
    expect(vector).toHaveLength(686);
    expect(sha12(JSON.stringify(vector))).toBe('5eb476c05d18');

    for (const expected of raw) {
      const key = keyOf(expected.document, expected.sentence);
      const gate = gateRecords.find(({ document, sentence }) => keyOf(document, sentence) === key);
      expect(gate, key).toBeDefined();
      if (gate === undefined) continue;
      expect(gate.lines, key).toEqual(expected.sites.map(({ line }) => line));
      expect(
        canonicalGeneratedTerms(gate.heads, expected.document, expected.sentence),
        key,
      ).toEqual(canonicalSourceTerms(expected.sites.map(({ head }) => head)));
    }
  });
  it('T5 one antecedent per sentence, multi-body input throws P5 exactly', () => {
    const real = scanContentSites();
    expect(
      real.map(({ document, sentence, sites }) => ({
        key: keyOf(document, sentence),
        bodies: new Set(sites.map(({ body }) => body)).size,
      })),
    ).toEqual(
      real.map(({ document, sentence }) => ({ key: keyOf(document, sentence), bodies: 1 })),
    );

    const mutant = mutatePlSentence(bagFiles, 'cdc2022-opioid-rec07', 2, (line, index) =>
      index === 0 ? `${line.split(' :- ')[0]}.` : line,
    );
    expect(() => clinicalArtifacts(mutant)).toThrowError(
      /^cdc2022-opioid-rec07:2: multiple antecedents$/u,
    );
  });
  it('T6 premise decomposition: nested conjunction, NAF, duplicates, ground, true', () => {
    const premises = parsePremiseRecords();
    for (const expected of scanContentSites()) {
      const key = keyOf(expected.document, expected.sentence);
      const bodies = [...new Set(expected.sites.map(({ body }) => body))];
      expect(bodies, key).toHaveLength(1);
      const positives = positiveGoals(bodies[0] ?? '');
      const gate = gateRecords.find(({ document, sentence }) => keyOf(document, sentence) === key);
      const emitted = premises.filter(
        ({ document, sentence }) => keyOf(document, sentence) === key,
      );
      expect(gate, key).toBeDefined();
      if (gate === undefined) continue;
      expect(
        emitted.map(({ ordinal }) => ordinal),
        key,
      ).toEqual(positives.map((_, index) => index));
      expect(
        canonicalGeneratedTerms(
          [...gate.heads, ...emitted.map(({ literal }) => literal)],
          expected.document,
          expected.sentence,
        ),
        key,
      ).toEqual(canonicalSourceTerms([...expected.sites.map(({ head }) => head), ...positives]));
    }

    const document = 'cdc2022-opioid-rec01';
    const sentence = 2;
    const body = String.raw`(guideline_entity(actual,A,clinician,countable),(guideline_cardinality(actual,A,na,eq,1),\+ guideline_entity(actual,A,blocked,countable))),guideline_entity(actual,A,clinician,countable),guideline_schema_version(1)`;
    const withBody = (source: ReadonlyMap<string, Uint8Array>, value: string) =>
      mutatePlSentence(source, document, sentence, (line) => {
        const boundary = line.indexOf(' :- ');
        const head = boundary < 0 ? line.slice(0, -1) : line.slice(0, boundary);
        return `${head} :- ${value}.`;
      });
    const mutant = withBody(bagFiles, body);
    const mutantArtifacts = clinicalArtifacts(mutant);
    const mutantGate = parseGateRecords(mutantArtifacts.helper).find(
      (gate) => gate.document === document && gate.sentence === sentence,
    );
    const mutantPremises = parsePremiseRecords(mutantArtifacts.helper).filter(
      (premise) => premise.document === document && premise.sentence === sentence,
    );
    const mutantCase = scanContentSites(mutant).find(
      (row) => row.document === document && row.sentence === sentence,
    );
    expect(mutantGate).toBeDefined();
    expect(mutantCase).toBeDefined();
    if (mutantGate === undefined || mutantCase === undefined) return;
    expect(mutantPremises.map(({ ordinal }) => ordinal)).toEqual([0, 1, 2, 3]);
    expect(mutantPremises[0]?.literal).toBe(mutantPremises[2]?.literal);
    expect(mutantPremises[3]?.literal).toBe('guideline_schema_version(1)');
    expect(
      canonicalGeneratedTerms(
        [...mutantGate.heads, ...mutantPremises.map(({ literal }) => literal)],
        document,
        sentence,
      ),
    ).toEqual(
      canonicalSourceTerms([...mutantCase.sites.map(({ head }) => head), ...positiveGoals(body)]),
    );

    for (const emptyBody of ['true', String.raw`\+ guideline_entity(actual,A,blocked,countable)`]) {
      const empty = clinicalArtifacts(withBody(bagFiles, emptyBody));
      expect(
        parsePremiseRecords(empty.helper).filter(
          (premise) => premise.document === document && premise.sentence === sentence,
        ),
        emptyBody,
      ).toEqual([]);
    }
  });
  it('T7 skolem sharing: one map per (Doc,S), heads then premises, deterministic', unimplemented);
  it('T8 tokenizing ground map: quoted atoms intact, no cross-sentence sharing', unimplemented);
  it('T9 frozen surfaces: parsed clauses, canonical presentation, passage bytes', unimplemented);
  it('T10 lossless guard fails closed on a non-rebuildable sentence', unimplemented);
  it('T11 determinism: two derivations and a reversed file map agree byte for byte', unimplemented);
  it('T12 budget delta measured and reproducible, no ceiling', unimplemented);
  it('T13 malformed payload fails closed across the pinned fault category', unimplemented);
  it('T14 ruled readings: record order, traversal order, ordinals, fresh anonymous', unimplemented);
});
