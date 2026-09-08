// M5 u1 red suite — the compiled fragment/premise/gate records.
//
// SEED: every case fails until it encodes its ruled row from
// `.agent/archive/contracts/m5u1.md` (predicates P1-P10, design rulings D1-D11, T14 rulings).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  clinicalArtifacts,
  CLINICAL_QUESTIONS,
  parseAdviceSentence,
} from '../tools/kb/clinical.mjs';
import { payloadDocuments } from '../tools/kb/payload.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage, buildQlf } from '../tools/kb/produce.mjs';
import { deriveProvenance } from '../tools/kb/provenance.mjs';
import {
  aceSentenceKeys,
  artifacts,
  bagFiles,
  canonicalGeneratedTerms,
  canonicalSourceTerms,
  gateRecords,
  filePath,
  helperLines,
  keyOf,
  mutatePlSentence,
  orderedHash,
  parseGateRecords,
  parsePremiseRecords,
  positiveGoals,
  replaceFileText,
  replaceVariablesOutsideAtoms,
  ROOT,
  scanContentSites,
  scanRawContentSites,
  sha12,
} from './clinical-test-support.js';

const skolemTokens = (terms: readonly string[]) =>
  terms.flatMap((term) =>
    [...term.matchAll(/'\$clinical_hypothetical'\('([^']+)',(\d+),(\d+)\)/gu)].map((match) => ({
      whole: match[0],
      document: match[1] ?? '',
      sentence: Number(match[2]),
      ordinal: Number(match[3]),
    })),
  );

/**
 * The pre-u1 helper: `clinical_advice/3` as twelve facts, dynamic, with no fragment records.
 * u3 retired those facts and u4 retired `clinical_advice_source/4`, so the differential base
 * is rebuilt from the parts that still ship — the source ids on `clinical_source/3` and the
 * build-time answer oracle. T12 pins the reconstruction's size and hash, which is what proves
 * it byte-exact.
 */
const baselineHelper = (): string => {
  const firstSentence = new Map(
    helperLines
      .filter((line) => line.startsWith('clinical_source('))
      .map((line) => {
        const match = /^clinical_source\(('[^']*'),('[^']*'),(\d+)\)\.$/u.exec(line);
        if (match === null) throw new Error(`unparsed clinical_source: ${line}`);
        return [`${match[1] as string},${match[2] as string}`, match[3] as string] as const;
      }),
  );
  const advice = CLINICAL_QUESTIONS.flatMap(({ id, sources: selections }) => {
    const statements = artifacts.answers.get(id) ?? [];
    return selections.map(({ document }, index) => {
      const sentence = firstSentence.get(`'${id}','${document}'` as `${string},${string}`);
      if (sentence === undefined) throw new Error(`no clinical_source for ${id}/${document}`);
      return (
        `clinical_advice('${id}','$guideline_id'(product,'${document}',${sentence},ref(1),[]),` +
        `${statements[index] as string}).`
      );
    });
  });
  return (
    `:- multifile(clinical_advice/3).\n` +
    `:- dynamic(clinical_advice/3).\n` +
    `${advice.join('\n')}\n`
  );
};

interface Derivation {
  readonly baseSource: string;
  readonly headSource: string;
  readonly baseImage: Uint8Array;
  readonly headImage: Uint8Array;
  readonly baseQlf: Uint8Array;
  readonly headQlf: Uint8Array;
}

const deriveOnce = async (): Promise<Derivation> => {
  const headSource = payloadSource(bagFiles).source;
  const frozen = baselineHelper();
  const baseSource = headSource.replace(artifacts.helper, frozen);
  const baseImage = (await buildImage(baseSource)).image;
  const headImage = (await buildImage(headSource)).image;
  const baseQlf = await buildQlf(baseSource);
  const headQlf = await buildQlf(headSource);
  return { baseSource, headSource, baseImage, headImage, baseQlf, headQlf };
};

let derivations: Promise<readonly [Derivation, Derivation]> | undefined;
const repeatedDerivations = (): Promise<readonly [Derivation, Derivation]> => {
  derivations ??= (async () => [await deriveOnce(), await deriveOnce()] as const)();
  return derivations;
};

describe('clinical records', () => {
  it('T1 byte identity: 7 questions, 12 canonical terms, raw contribution order', () => {
    const strings = CLINICAL_QUESTIONS.map(({ question }) => question);
    const order = CLINICAL_QUESTIONS.flatMap(({ sources }) =>
      sources.map(({ document }) => document),
    );
    const terms = CLINICAL_QUESTIONS.flatMap(({ id }) => artifacts.answers.get(id) ?? []);
    // u3: `clinical_advice/3` is a derivation rule. The twelve raw contributions that used
    // to be its facts are now `clinical_source/3`, in the same order. u4 split it in two —
    // `/3` projects `/4`, which carries the proof — and retired `clinical_advice_source/4`,
    // the last precomputed answer statement in the image.
    const advice = helperLines.filter((line) => line.startsWith('clinical_advice('));
    const selections = helperLines.filter((line) => line.startsWith('clinical_source('));
    const passages = helperLines.filter((line) => line.startsWith('clinical_passage('));
    const sources = helperLines.filter((line) => line.startsWith('clinical_advice_source('));
    expect(sources).toEqual([]);

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
      selections: orderedHash(selections),
      passages: orderedHash(passages),
      records: sha12(JSON.stringify(artifacts.records)),
      names: sha12(JSON.stringify(artifacts.names)),
    }).toEqual({
      advice: 'eafc1f7f65b0',
      selections: '8ca30f2c6f1d',
      passages: 'a8ff3e7a31e5',
      records: '23898631ca0a',
      names: '1d112e138ee5',
    });
    expect({
      advice: advice.length,
      selections: selections.length,
      passages: passages.length,
      rules: helperLines.filter((line) => line.startsWith('clinical_rule(')).length,
      premises: helperLines.filter((line) => line.startsWith('clinical_premise(')).length,
      gates: gateRecords.length,
    }).toEqual({
      advice: 2,
      selections: 12,
      passages: 12,
      rules: 48,
      premises: 346,
      gates: 48,
    });
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
      /^cdc2022-opioid-rec07:2: \d+ distinct antecedents, expected one$/u,
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
    const withBody = (source: Map<string, Uint8Array>, value: string) =>
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
  it('T7 skolem sharing: one map per (Doc,S), heads then premises, deterministic', () => {
    const first = clinicalArtifacts(bagFiles);
    const second = clinicalArtifacts(bagFiles);
    const reversed = clinicalArtifacts(new Map([...bagFiles].reverse()));
    expect(second.helper).toBe(first.helper);
    expect(reversed.helper).toBe(first.helper);

    const premises = parsePremiseRecords(first.helper);
    const gates = parseGateRecords(first.helper);
    const sourceCases = scanContentSites();
    const scopes = new Map<string, Set<string>>();
    for (const gate of gates) {
      const key = keyOf(gate.document, gate.sentence);
      const emittedPremises = premises.filter(
        ({ document, sentence }) => keyOf(document, sentence) === key,
      );
      const terms = [...gate.heads, ...emittedPremises.map(({ literal }) => literal)];
      const skolems = skolemTokens(terms);
      expect(
        skolems.every(
          ({ document, sentence }) => document === gate.document && sentence === gate.sentence,
        ),
        key,
      ).toBe(true);
      scopes.set(key, new Set(skolems.map(({ whole }) => whole)));

      const source = sourceCases.find(
        ({ document, sentence }) => keyOf(document, sentence) === key,
      );
      expect(source, key).toBeDefined();
      if (source === undefined) continue;
      const bodies = [...new Set(source.sites.map(({ body }) => body))];
      expect(canonicalGeneratedTerms(terms, gate.document, gate.sentence), key).toEqual(
        canonicalSourceTerms([
          ...source.sites.map(({ head }) => head),
          ...positiveGoals(bodies[0] ?? ''),
        ]),
      );
    }

    const scoped = [...scopes.entries()];
    expect(scoped.flatMap(([, values]) => [...values]).length).toBeGreaterThan(0);
    for (let left = 0; left < scoped.length; left += 1) {
      for (let right = left + 1; right < scoped.length; right += 1) {
        const [leftKey, leftValues] = scoped[left] ?? ['', new Set<string>()];
        const [rightKey, rightValues] = scoped[right] ?? ['', new Set<string>()];
        expect(
          [...leftValues].filter((value) => rightValues.has(value)),
          `${leftKey} vs ${rightKey}`,
        ).toEqual([]);
      }
    }
  });
  it('T8 tokenizing ground map: quoted atoms intact, no cross-sentence sharing', () => {
    const scopes = [
      ['cdc2022-opioid-rec01', 2],
      ['cdc2022-opioid-rec01', 3],
      ['cdc2022-opioid-rec02', 2],
    ] as const;
    let mutant: Map<string, Uint8Array> = bagFiles;
    for (const [document, sentence] of scopes) {
      mutant = mutatePlSentence(mutant, document, sentence, (line) => {
        const boundary = line.indexOf(' :- ');
        const head = boundary < 0 ? line.slice(0, -1) : line.slice(0, boundary);
        return `${replaceVariablesOutsideAtoms(head, 'Shared')} :- guideline_entity(actual,Shared,clinician,countable).`;
      });
    }

    const emitted = clinicalArtifacts(mutant);
    const gates = parseGateRecords(emitted.helper);
    const premises = parsePremiseRecords(emitted.helper);
    const source = scanContentSites(mutant);
    const ids: Set<string>[] = [];
    for (const [document, sentence] of scopes) {
      const gate = gates.find(
        (candidate) => candidate.document === document && candidate.sentence === sentence,
      );
      const premise = premises.filter(
        (candidate) => candidate.document === document && candidate.sentence === sentence,
      );
      const sourceCase = source.find(
        (candidate) => candidate.document === document && candidate.sentence === sentence,
      );
      expect(gate).toBeDefined();
      expect(sourceCase).toBeDefined();
      expect(premise).toHaveLength(1);
      if (gate === undefined || sourceCase === undefined) continue;
      const terms = [...gate.heads, ...premise.map(({ literal }) => literal)];
      const scopeIds = new Set(skolemTokens(terms).map(({ whole }) => whole));
      expect(scopeIds.size, keyOf(document, sentence)).toBe(1);
      ids.push(scopeIds);
      expect(canonicalGeneratedTerms(terms, document, sentence)).toEqual(
        canonicalSourceTerms([
          ...sourceCase.sites.map(({ head }) => head),
          'guideline_entity(actual,Shared,clinician,countable)',
        ]),
      );
    }
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        expect([...(ids[left] ?? new Set())].some((id) => ids[right]?.has(id))).toBe(false);
      }
    }
    const rec01s2 = gates.find(
      ({ document, sentence }) => document === 'cdc2022-opioid-rec01' && sentence === 2,
    );
    expect(rec01s2?.heads.some((head) => head.includes("'acute-pain'"))).toBe(true);
  });
  it('T9 frozen surfaces: parsed clauses, canonical presentation, passage bytes', () => {
    const baseClinical = execFileSync('git', ['show', '22053ef:tools/kb/clinical.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const currentClinical = readFileSync(join(ROOT, 'tools/kb/clinical.mjs'), 'utf8');
    const span = (source: string, startNeedle: string, endNeedle: string): string => {
      const start = source.indexOf(startNeedle);
      const end = source.indexOf(endNeedle, start + startNeedle.length);
      if (start < 0 || end < 0) throw new Error(`frozen span missing: ${startNeedle}`);
      return source.slice(start, end);
    };
    const boundaries = [
      ['clauseSource', 'const clauseSource =', '/**\n * Parse the tiny controlled-sentence'],
      ['parseAdviceSentence', 'export const parseAdviceSentence =', '/** Group only identical'],
      ['groupClauses', 'const groupClauses =', '/** @param {AdviceModifier}'],
      ['modifierTerm', 'const modifierTerm =', '/** @param {AdviceAction}'],
      ['actionTerm', 'const actionTerm =', '/** @param {AdviceGroup}'],
      ['groupTerm', 'const groupTerm =', '/** @param {string} document'],
      ['answerTerm', 'const answerTerm =', ';\n'],
    ] as const;
    const hashes = (source: string) =>
      Object.fromEntries(
        boundaries.map(([name, start, end]) => [name, sha12(span(source, start, end))]),
      );
    expect(hashes(currentClinical)).toEqual(hashes(baseClinical));

    for (const path of [
      'src/questions/advice.ts',
      'src/questions/serialize.ts',
      'src/questions/humanize.ts',
      'tools/kb/provenance.mjs',
    ]) {
      expect(readFileSync(join(ROOT, path), 'utf8'), path).toBe(
        execFileSync('git', ['show', `22053ef:${path}`], { cwd: ROOT, encoding: 'utf8' }),
      );
    }

    const parsed = CLINICAL_QUESTIONS.flatMap(({ sources }) =>
      sources.flatMap(({ document }) => {
        const path = filePath(bagFiles, `/ace/${document}.ace`);
        const sentences = Buffer.from(bagFiles.get(path) ?? [])
          .toString('utf8')
          .trimEnd()
          .split('\n');
        return sentences
          .slice(1)
          .map((sentence, index) => parseAdviceSentence(sentence, index + 2));
      }),
    );
    const provenance = deriveProvenance(bagFiles);
    const passages = new Map(
      provenance.chunks.map(({ document, model }) => {
        const text = (model as { source?: { text?: unknown } }).source?.text;
        if (typeof text !== 'string') throw new Error(`${document}: source passage missing`);
        return [document, text];
      }),
    );
    const orderedPassages = CLINICAL_QUESTIONS.flatMap(({ sources }) =>
      sources.map(({ document }) => passages.get(document) ?? ''),
    );
    const presentations = CLINICAL_QUESTIONS.flatMap(({ id }) => artifacts.answers.get(id) ?? []);
    expect({
      parsed: [parsed.length, sha12(JSON.stringify(parsed))],
      presentations: [presentations.length, orderedHash(presentations)],
      passages: [orderedPassages.length, sha12(JSON.stringify(orderedPassages))],
    }).toEqual({
      parsed: [48, 'a445b21c3d93'],
      presentations: [12, '59a516ba9989'],
      passages: [12, '1e11a0c96231'],
    });
    expect({
      rules: helperLines.filter((line) => line.startsWith('clinical_rule(')).length,
      gates: gateRecords.length,
    }).toEqual({ rules: 48, gates: 48 });
  });
  it('T10 lossless guard fails closed on a non-rebuildable sentence', () => {
    const valid = CLINICAL_QUESTIONS.flatMap(({ sources }) =>
      sources.flatMap(({ document }) => {
        const path = filePath(bagFiles, `/ace/${document}.ace`);
        return Buffer.from(bagFiles.get(path) ?? [])
          .toString('utf8')
          .trimEnd()
          .split('\n')
          .slice(1)
          .map((sentence, index) => parseAdviceSentence(sentence, index + 2));
      }),
    );
    expect(valid).toHaveLength(48);
    expect(() =>
      parseAdviceSentence('If then every clinician should consider opioid-therapy.', 99),
    ).toThrowError(/^controlled sentence 99 is not lossless\n {2}source: /u);
    expect(gateRecords).toHaveLength(48);
  });
  it('T11 determinism: two derivations and a reversed file map agree byte for byte', async () => {
    const first = clinicalArtifacts(bagFiles);
    const second = clinicalArtifacts(bagFiles);
    const reversed = clinicalArtifacts(new Map([...bagFiles].reverse()));
    for (const prefix of ['clinical_rule(', 'clinical_premise(', 'clinical_gate(']) {
      const rows = (helper: string) => helper.split('\n').filter((line) => line.startsWith(prefix));
      expect(rows(second.helper), prefix).toEqual(rows(first.helper));
      expect(rows(reversed.helper), prefix).toEqual(rows(first.helper));
    }
    const expectedOrder = [
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
    ];
    for (const prefix of ['clinical_rule(', 'clinical_premise(', 'clinical_gate(']) {
      const order = [
        ...new Set(
          first.helper
            .split('\n')
            .filter((line) => line.startsWith(prefix))
            .map((line) => /^clinical_[a-z]+\('([^']+)'/u.exec(line)?.[1] ?? ''),
        ),
      ];
      expect(order, prefix).toEqual(expectedOrder);
    }
    for (const gate of parseGateRecords(first.helper)) {
      expect(gate.lines, keyOf(gate.document, gate.sentence)).toEqual(
        [...gate.lines].sort((left, right) => left - right),
      );
    }
    const premiseGroups = new Map<string, number[]>();
    for (const premise of parsePremiseRecords(first.helper)) {
      const key = keyOf(premise.document, premise.sentence);
      premiseGroups.set(key, [...(premiseGroups.get(key) ?? []), premise.ordinal]);
    }
    for (const [key, ordinals] of premiseGroups) {
      expect(ordinals, key).toEqual(ordinals.map((_, index) => index));
    }

    const [left, right] = await repeatedDerivations();
    expect(right.headSource).toBe(left.headSource);
    expect(Buffer.from(right.headImage)).toEqual(Buffer.from(left.headImage));
  }, 300_000);
  it('T12 budget delta measured and reproducible, no ceiling', async () => {
    const frozen = baselineHelper();
    expect(Buffer.byteLength(frozen)).toBe(15_480);
    expect(sha12(frozen)).toBe('7a8bb9e7cc6d');
    expect(gateRecords).toHaveLength(48);

    const [first, second] = await repeatedDerivations();
    const delta = (derivation: Derivation) => ({
      payload: Buffer.byteLength(derivation.headSource) - Buffer.byteLength(derivation.baseSource),
      pvm: derivation.headImage.byteLength - derivation.baseImage.byteLength,
      qlf: derivation.headQlf.byteLength - derivation.baseQlf.byteLength,
    });
    const firstDelta = delta(first);
    expect(delta(second)).toEqual(firstDelta);
    expect(Object.values(firstDelta).every(Number.isInteger)).toBe(true);
    expect(firstDelta.payload).not.toBe(0);
    expect(Buffer.from(second.baseImage)).toEqual(Buffer.from(first.baseImage));
    expect(Buffer.from(second.headImage)).toEqual(Buffer.from(first.headImage));
    expect(Buffer.from(second.baseQlf)).toEqual(Buffer.from(first.baseQlf));
    expect(Buffer.from(second.headQlf)).toEqual(Buffer.from(first.headQlf));
  }, 300_000);
  it('T13 malformed payload fails closed across the pinned fault category', () => {
    const message = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      return '<no error>';
    };
    const document = 'cdc2022-opioid-rec01';
    const ace = `/ace/${document}.ace`;
    const pl = `/pl/${document}.pl`;
    const missingAce = new Map(bagFiles);
    missingAce.delete(filePath(missingAce, ace));
    const metadataOnly = replaceFileText(bagFiles, ace, (text) => `${text.split('\n')[0] ?? ''}\n`);
    const emptyAce = replaceFileText(bagFiles, ace, (text) => text.replace('\n', '\n\n'));
    const crAce = replaceFileText(bagFiles, ace, (text) => text.replace('\n', '\r\n'));
    const zeroSite = replaceFileText(bagFiles, pl, (text) => text.replace(/^% S2:.*\n/mu, ''));
    const unterminated = mutatePlSentence(bagFiles, document, 2, (line, index) => {
      if (index !== 0) return line;
      const boundary = line.indexOf(' :- ');
      const body = boundary < 0 ? 'true' : line.slice(boundary + 4, -1);
      return `guideline_entity(actual,'unterminated,clinician,countable) :- ${body}.`;
    });
    const multipleBodies = mutatePlSentence(bagFiles, document, 2, (line, index) =>
      index === 0 ? `${line.split(' :- ')[0]}.` : line,
    );

    const faults: readonly [string, Map<string, Uint8Array>, RegExp][] = [
      ['missing ACE', missingAce, /missing-file: .*\/ace\/|expected one ACE source, found 0/u],
      ['metadata-only ACE', metadataOnly, /recommendation has no clinical clauses|alignment-span/u],
      [
        'empty ACE sentence',
        emptyAce,
        /clinical source contains an empty sentence|ace-empty-sentence/u,
      ],
      ['ACE CR', crAce, /clinical source must use LF|unsupported-control/u],
      ['missing PL marker', zeroSite, /prolog-sentence|no .*sentence 2|sentence 2.*no /u],
      ['unterminated atom', unterminated, /unterminated|prolog-[a-z-]+/u],
      ['multiple antecedents', multipleBodies, /antecedent/u],
    ];
    for (const [name, files, expected] of faults) {
      expect(
        message(() => clinicalArtifacts(files)),
        name,
      ).toMatch(expected);
    }
    expect(gateRecords).toHaveLength(48);
  });
  it('T14 ruled readings: record order, traversal order, ordinals, fresh anonymous', async () => {
    const errorMessage = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      return '<no error>';
    };
    const expectedOrder = [
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
    ];
    const gates = parseGateRecords();
    const premises = parsePremiseRecords();
    const cases = scanRawContentSites();
    const lines = gates.flatMap((gate) => gate.lines);
    expect({
      rules: helperLines.filter((line) => line.startsWith('clinical_rule(')).length,
      gates: gates.length,
      sites: lines.length,
      uniqueSites: new Set(lines).size,
      clinicalSiteFacts: helperLines.filter((line) => line.startsWith('clinical_site(')).length,
    }).toEqual({ rules: 48, gates: 48, sites: 686, uniqueSites: 686, clinicalSiteFacts: 0 });
    expect(new Set(gates.map(({ document, sentence }) => keyOf(document, sentence))).size).toBe(48);
    expect(
      sha12(
        JSON.stringify(
          cases.flatMap(({ document, sentence, sites }) =>
            sites.map(({ line, head, body }) => ({ document, sentence, line, head, body })),
          ),
        ),
      ),
    ).toBe('5eb476c05d18');

    for (const prefix of ['clinical_rule(', 'clinical_premise(', 'clinical_gate(']) {
      const order = [
        ...new Set(
          helperLines
            .filter((line) => line.startsWith(prefix))
            .map((line) => /^clinical_[a-z]+\('([^']+)'/u.exec(line)?.[1] ?? ''),
        ),
      ];
      expect(order, prefix).toEqual(expectedOrder);
    }

    let document = '';
    const markers: string[] = [];
    for (const line of payloadDocuments(bagFiles).source.split('\n')) {
      const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
      if (file !== null) {
        document = file[1] ?? '';
        continue;
      }
      if (new RegExp('^% S[1-9][0-9]*:', 'u').test(line) && expectedOrder.includes(document)) {
        markers.push(line);
      }
    }
    expect(markers).toHaveLength(60);
    expect(markers.every((marker) => /^% S[1-9][0-9]*: \S/u.test(marker))).toBe(true);
    expect(aceSentenceKeys().sort()).toEqual(
      cases.map(({ document, sentence }) => keyOf(document, sentence)).sort(),
    );

    for (const source of cases) {
      const key = keyOf(source.document, source.sentence);
      const gate = gates.find(({ document, sentence }) => keyOf(document, sentence) === key);
      const emitted = premises.filter(
        ({ document, sentence }) => keyOf(document, sentence) === key,
      );
      expect(gate, key).toBeDefined();
      if (gate === undefined) continue;
      const bodies = [...new Set(source.sites.map(({ body }) => body))];
      const terms = [...gate.heads, ...emitted.map(({ literal }) => literal)];
      expect(canonicalGeneratedTerms(terms, source.document, source.sentence), key).toEqual(
        canonicalSourceTerms([
          ...source.sites.map(({ head }) => head),
          ...positiveGoals(bodies[0] ?? ''),
        ]),
      );
      expect(
        emitted.map(({ ordinal }) => ordinal),
        key,
      ).toEqual(emitted.map((_, index) => index));
      const opaqueOrdinals = [...new Set(skolemTokens(terms).map(({ ordinal }) => ordinal))].sort(
        (left, right) => left - right,
      );
      expect(opaqueOrdinals, key).toEqual(opaqueOrdinals.map((_, index) => index));
    }

    const documentId = 'cdc2022-opioid-rec01';
    const sentence = 2;
    const withBody = (body: string) =>
      mutatePlSentence(bagFiles, documentId, sentence, (line) => {
        const boundary = line.indexOf(' :- ');
        const head = boundary < 0 ? line.slice(0, -1) : line.slice(0, boundary);
        return `${head} :- ${body}.`;
      });
    const anonymous = clinicalArtifacts(
      withBody(
        'guideline_entity(actual,_,clinician,countable),guideline_entity(actual,_,patient,countable)',
      ),
    );
    const anonymousPremises = parsePremiseRecords(anonymous.helper).filter(
      ({ document, sentence: actualSentence }) =>
        document === documentId && actualSentence === sentence,
    );
    expect(anonymousPremises.map(({ ordinal }) => ordinal)).toEqual([0, 1]);
    const anonymousIds = anonymousPremises.map(({ literal }) => {
      const ids = new Set(skolemTokens([literal]).map(({ whole }) => whole));
      expect(ids.size).toBe(1);
      return [...ids][0];
    });
    expect(anonymousIds[0]).not.toBe(anonymousIds[1]);

    const duplicate = clinicalArtifacts(
      withBody('guideline_schema_version(1),guideline_schema_version(1)'),
    );
    expect(
      parsePremiseRecords(duplicate.helper)
        .filter(
          ({ document, sentence: actualSentence }) =>
            document === documentId && actualSentence === sentence,
        )
        .map(({ literal }) => literal),
    ).toEqual(['guideline_schema_version(1)', 'guideline_schema_version(1)']);
    expect(
      parsePremiseRecords(clinicalArtifacts(withBody('true')).helper).filter(
        ({ document, sentence: actualSentence }) =>
          document === documentId && actualSentence === sentence,
      ),
    ).toEqual([]);

    for (const [operator, body] of [
      [';', '(guideline_schema_version(1);guideline_schema_version(1))'],
      ['->', '(guideline_schema_version(1)->guideline_schema_version(1))'],
      ['*->', '(guideline_schema_version(1)*->guideline_schema_version(1))'],
    ] as const) {
      expect(
        errorMessage(() => clinicalArtifacts(withBody(body))),
        operator,
      ).toContain(`unsupported control form ${operator}`);
    }
    const cr = mutatePlSentence(bagFiles, documentId, sentence, (line, index) =>
      index === 0 ? `${line}\r` : line,
    );
    expect(errorMessage(() => clinicalArtifacts(cr))).toMatch(/CR|carriage return|prolog-clause/u);
    const multiple = mutatePlSentence(bagFiles, documentId, sentence, (line, index) =>
      index === 0 ? `${line.split(' :- ')[0]}.` : line,
    );

    expect(Buffer.byteLength(baselineHelper())).toBe(15_480);
    expect(sha12(baselineHelper())).toBe('7a8bb9e7cc6d');
    const [first, second] = await repeatedDerivations();
    const deltas = (derivation: Derivation) => [
      Buffer.byteLength(derivation.headSource) - Buffer.byteLength(derivation.baseSource),
      derivation.headImage.byteLength - derivation.baseImage.byteLength,
      derivation.headQlf.byteLength - derivation.baseQlf.byteLength,
    ];
    expect(deltas(second)).toEqual(deltas(first));
    expect(errorMessage(() => clinicalArtifacts(multiple))).toMatch(
      /^cdc2022-opioid-rec01:2: \d+ distinct antecedents, expected one$/u,
    );
  }, 300_000);
});
