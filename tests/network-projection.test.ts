// g2 N1–N12: public producer → pure contract graders + constructed/generated regressions.
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { deriveFrames } from '../tools/kb/frames.mjs';
import { census, NETWORK_PATH } from '../tools/kb/network.mjs';
import * as tables from '../tools/kb/network-tables.mjs';
import { oracleFrame, roles } from './support/network-oracle.js';
import * as graders from './support/network-graders.js';
import {
  envelope,
  fact,
  files,
  gid,
  project,
  synthetic,
  type Network,
} from './support/network-subject.js';
import { holds } from './support/property.js';

const framed = deriveFrames(files);
const ref = graders.reference(framed, files, envelope);
const oracle = ref.oracle;
let asset: Network;
beforeAll(() => {
  asset = project();
});
const syntheticClaim = (
  document: string,
  sentence: number,
  op: string,
  extraBody = '',
): { text: string; clauses: string[] } => {
  const r = (n: number): string => gid(document, sentence, 'ref', n);
  const b = gid(document, sentence, 'box', 1);
  const body = extraBody === '' ? '' : ` :- ${extraBody}`;
  const clause = (name: string, ...args: string[]): string =>
    fact(name, ...args).slice(0, -1) + body + '.';
  return {
    text: 'It is recommended that an opioid-therapy treats a chronic-pain.',
    clauses: [
      clause('operator', 'actual', b, op),
      clause('entity', b, r(1), "'opioid-therapy'", 'countable'),
      clause('entity', b, r(2), "'chronic-pain'", 'countable'),
      clause('event', b, r(3), 'treat'),
      clause('arg', b, r(3), '1', r(1)),
      clause('arg', b, r(3), '2', r(2)),
    ],
  };
};

describe('clinical network contract', () => {
  it('N1 every bag sentence has exactly one coverage record and the asset keeps its input envelope', () => {
    graders.N1(asset, ref, tables);
    expect(NETWORK_PATH).toBe('graph/clinical-network.json');
  });

  it('N2 every main event has one bucket and embedded events remain in the parent payload', () => {
    graders.N2(asset, ref, tables);
    for (const [suffix, n, embeddedVerb] of [
      ['rec05-imp25', 7, 'taper'],
      ['s60-07', 2, 'need'],
    ] as const) {
      const f = oracle.find((o) => o.frame.document.endsWith(suffix) && o.frame.sentence === n);
      expect(f).toBeDefined();
      expect(f?.events.some((e) => e.verb === embeddedVerb)).toBe(true);
      expect(f?.main.some((e) => e.verb === embeddedVerb)).toBe(false);
    }
    const instruction = oracle.find(
      (o) => o.frame.document.endsWith('s18-07') && o.frame.sentence === 1,
    );
    expect(instruction?.main.map((e) => e.verb)).toContain('misapply');
    const document = 'network-cycle';
    const b = gid(document, 1, 'box', 1);
    const r = (n: number): string => gid(document, 1, 'ref', n);
    const cycle = project(
      synthetic(document, [
        {
          text: 'It is recommended that an opioid-therapy treats a chronic-pain that worsens the opioid-therapy.',
          clauses: [
            fact('operator', 'actual', b, 'should'),
            fact('entity', b, r(1), "'opioid-therapy'", 'countable'),
            fact('entity', b, r(2), "'chronic-pain'", 'countable'),
            fact('event', b, r(3), 'treat'),
            fact('arg', b, r(3), '1', r(1)),
            fact('arg', b, r(3), '2', r(2)),
            fact('event', b, r(4), 'worsen'),
            fact('arg', b, r(4), '1', r(2)),
            fact('arg', b, r(4), '2', r(1)),
          ],
        },
      ]),
    );
    expect(cycle.coverage[0]?.form).toBe('fallback');
    expect(cycle.occurrences).toHaveLength(0);
    expect(cycle.statements).toHaveLength(1);
    expect(cycle.statements[0]?.form).toBe('fallback');
    expect(cycle.statements[0]?.concepts.slice().sort()).toEqual([
      'chronic-pain',
      'opioid-therapy',
    ]);
  });

  it('N3 every line loop and statement reading preserves its ordered chain and qualifiers', () => {
    graders.N3(asset, ref, tables);
    const document = 'network-finite';
    const claim = syntheticClaim(document, 1, 'should');
    claim.text = 'An opioid-therapy treats a chronic-pain.';
    claim.clauses = claim.clauses
      .slice(1)
      .map((line) => line.replaceAll(gid(document, 1, 'box', 1), 'actual'));
    expect(project(synthetic(document, [claim])).occurrences[0]?.reading).toBe('treats');
    claim.text = 'The source states something else.';
    expect(() => project(synthetic(document, [claim]))).toThrow('network-finite:1');
  });

  it('N4 neither a negation box nor negation-as-failure can supply a source', () => {
    graders.N4(asset, ref, tables);
    const document = 'network-negation';
    const b = gid(document, 1, 'box', 1);
    const r = (n: number): string => gid(document, 1, 'ref', n);
    const body = [
      'guideline_entity(actual,C,clinician,countable)',
      'guideline_entity(actual,P,patient,countable)',
      "guideline_entity(actual,X,'positive-pain',countable)",
      'guideline_event(actual,H,have)',
      'guideline_arg(actual,H,1,P)',
      'guideline_arg(actual,H,2,X)',
      'guideline_operator(actual,B,-)',
      "guideline_entity(B,Y,'negated-pain',countable)",
      'guideline_event(B,N,have)',
      'guideline_arg(B,N,1,P)',
      'guideline_arg(B,N,2,Y)',
      "\\+ (guideline_entity(actual,Z,'naf-pain',countable), guideline_event(actual,Q,have), guideline_arg(actual,Q,1,P), guideline_arg(actual,Q,2,Z))",
    ].join(', ');
    const clause = (name: string, ...args: string[]): string =>
      `${fact(name, ...args).slice(0, -1)} :- ${body}.`;
    const model = project(
      synthetic(document, [
        {
          text: 'If a patient has a positive-pain then it is recommended that a clinician considers an opioid-therapy.',
          clauses: [
            clause('operator', 'actual', b, 'should'),
            clause('entity', b, r(1), "'opioid-therapy'", 'countable'),
            clause('event', b, r(2), 'consider'),
            clause('arg', b, r(2), '1', 'C'),
            clause('arg', b, r(2), '2', r(1)),
          ],
        },
      ]),
    );
    expect(model.occurrences).toHaveLength(1);
    expect(model.occurrences[0]?.sources).toEqual(['positive-pain']);
  });

  it('N5 independent T1 T2 T3 and S1 S2 S3 S4 oracle reproduces every occurrence', () => {
    graders.N5(asset, ref, tables);
    // Generated claims move actor, object, starts, quantities and modal structure independently.
    holds(
      fc.property(
        fc.record({
          actor: fc.constantFrom('clinician', 'patient', 'opioid-therapy'),
          target: fc.constantFrom('chronic-pain', 'patient', 'duration', 'opioid-therapy'),
          starts: fc.uniqueArray(fc.constantFrom('acute-pain', 'chronic-pain', 'opioid-therapy'), {
            maxLength: 3,
          }),
          negative: fc.boolean(),
          quantity: fc.integer({ min: 2, max: 500 }),
        }),
        (claim) => {
          const document = 'network-generated';
          const r = (n: number): string => gid(document, 1, 'ref', n);
          const outer = gid(document, 1, 'box', 1);
          const context = claim.negative ? gid(document, 1, 'box', 2) : outer;
          const body = [
            'guideline_entity(actual,P,patient,countable)',
            ...claim.starts.flatMap((noun, i) => [
              `guideline_entity(actual,X${String(i)},'${noun}',countable)`,
              `guideline_event(actual,H${String(i)},have)`,
              `guideline_arg(actual,H${String(i)},1,P)`,
              `guideline_arg(actual,H${String(i)},2,X${String(i)})`,
            ]),
          ].join(', ');
          const h = (name: string, ...args: string[]): string =>
            `${fact(name, ...args).slice(0, -1)} :- ${body}.`;
          const input = synthetic(document, [
            {
              text: 'It is recommended that a clinician considers an opioid-therapy.',
              clauses: [
                h('operator', 'actual', outer, 'should'),
                ...(claim.negative ? [h('operator', outer, context, '-')] : []),
                h('entity', context, r(1), `'${claim.actor}'`, 'countable'),
                h('entity', context, r(2), `'${claim.target}'`, 'countable'),
                h('cardinality', context, r(2), 'na', 'geq', String(claim.quantity)),
                h('event', context, r(3), 'consider'),
                h('arg', context, r(3), '1', r(1)),
                h('arg', context, r(3), '2', r(2)),
              ],
            },
          ]);
          const reference = deriveFrames(input).frames.map(oracleFrame)[0];
          const event = reference?.main[0];
          if (reference === undefined || event === undefined)
            throw new Error('generated claim has no event');
          const actual = project(input).occurrences[0];
          const expected = roles(reference, event);
          expect(actual).toBeDefined();
          expect({
            actor: actual?.actor,
            target: actual?.target,
            sources: actual?.sources,
            rule: actual?.rule,
            bucket: actual?.bucket,
          }).toEqual({
            actor: expected.actor,
            target: expected.target,
            sources: expected.sources,
            rule: expected.rule,
            bucket: expected.bucket,
          });
          expect(actual?.reading).toBe(`${claim.negative ? 'should not' : 'should'} consider`);
          expect(
            actual?.payload.some(
              (p) => p.name === 'cardinality' && p.args.includes(String(claim.quantity)),
            ),
          ).toBe(true);
        },
      ),
    );
    for (const t of ['T1', 'T2', 'T3'])
      expect(asset.occurrences.some((o) => o.rule.target === t)).toBe(true);
    for (const s of ['S1', 'S2', 'S3', 'S4'])
      expect(asset.occurrences.some((o) => o.rule.sources === s)).toBe(true);
    const duration = asset.occurrences.filter((o) => o.document.endsWith('s47-16'));
    expect(duration.length).toBeGreaterThan(0);
    for (const o of duration)
      expect(
        o.sources.some((s) => tables.TIME_WORD.test(s)),
        o.key,
      ).toBe(false);
  });

  it('N6 owned consequent literals are consumed once or retained with their complete payload', () => {
    graders.N6(asset, ref, tables);
  });

  it('N7 joint negation or possibility becomes one shared statement rather than per-event lines', () => {
    graders.N7(asset, ref, tables);
    const document = 'network-shared';
    const cases = ['-', 'may', 'can', 'should', 'must'].map((op, i) => {
      const n = i + 1;
      const b = gid(document, n, 'box', 1);
      const r = (k: number): string => gid(document, n, 'ref', k);
      return {
        text:
          op === '-'
            ? 'It is false that an opioid-therapy treats a chronic-pain and prevents a severe-pain.'
            : `An opioid-therapy ${op} treat a chronic-pain and prevent a severe-pain.`,
        clauses: [
          fact('operator', 'actual', b, op),
          fact('entity', b, r(1), "'opioid-therapy'", 'countable'),
          fact('entity', b, r(2), "'chronic-pain'", 'countable'),
          fact('entity', b, r(3), "'severe-pain'", 'countable'),
          ...[
            ['treat', 4, 2],
            ['prevent', 5, 3],
          ].flatMap(([v, id, obj]) => [
            fact('event', b, r(Number(id)), String(v)),
            fact('arg', b, r(Number(id)), '1', r(1)),
            fact('arg', b, r(Number(id)), '2', r(Number(obj))),
          ]),
        ],
      };
    });
    const model = project(synthetic(document, cases));
    for (let sentence = 1; sentence <= 5; sentence += 1) {
      const os = model.occurrences.filter((o) => o.sentence === sentence);
      expect(os).toHaveLength(2);
      for (const o of os) expect(o.bucket).toBe(sentence <= 3 ? 'shared' : 'line');
      if (sentence <= 3) {
        const statements = model.statements.filter(
          (s) => s.sentence === `${document}:${String(sentence)}`,
        );
        expect(statements).toHaveLength(1);
        expect(statements[0]?.occurrences.slice().sort()).toEqual(os.map((o) => o.key).sort());
        expect(statements[0]?.concepts.slice().sort()).toEqual(
          ['opioid-therapy', 'chronic-pain', 'severe-pain'].sort(),
        );
        expect(
          model.lines.some((l) => l.occurrences.some((k) => os.some((o) => o.key === k))),
        ).toBe(false);
      }
    }
  });

  it('N8 guard supersession payload condition and document kind participate in complete line identity', () => {
    graders.N8(asset, ref, tables);
    // Equal ACE text + roles + reading. Only metadata or payload changes; guards must not vanish.
    const document = 'network-identity';
    const base = syntheticClaim(document, 1, 'should');
    const scope = syntheticClaim(document, 2, 'should', "\\+ guideline_exclusion('scope')");
    const dated = syntheticClaim(
      document,
      3,
      'should',
      'guideline_evaluation_date(D), guideline_satisfies(exactly,D,less,20221229)',
    );
    const superseded = syntheticClaim(document, 4, 'should');
    superseded.clauses.push(
      fact(
        'supersession',
        "'network-identity'",
        '4',
        "source('new-law','https://example.org/law')",
        '20221229',
      ),
    );
    const duplicate = syntheticClaim(document, 5, 'should');
    const payload = syntheticClaim(document, 6, 'should');
    payload.clauses.push(
      fact(
        'pp',
        gid(document, 6, 'box', 1),
        gid(document, 6, 'ref', 3),
        'with',
        gid(document, 6, 'ref', 4),
      ),
      fact(
        'entity',
        gid(document, 6, 'box', 1),
        gid(document, 6, 'ref', 4),
        "'naloxone'",
        'countable',
      ),
    );
    const condition = syntheticClaim(
      document,
      7,
      'should',
      "guideline_entity(actual,A,'patient',countable)",
    );
    condition.text =
      'If there is a patient then it is recommended that an opioid-therapy treats a chronic-pain.';
    const model = project(
      synthetic(document, [base, scope, dated, superseded, duplicate, payload, condition]),
    );
    const owner = (sentence: number): Network['lines'][number] => {
      const k = model.occurrences.find((o) => o.sentence === sentence)?.key;
      const line = model.lines.find((l) => k !== undefined && l.occurrences.includes(k));
      if (line === undefined) throw new Error(`N8 missing line for sentence ${String(sentence)}`);
      return line;
    };
    expect(owner(1).id).toBe(owner(5).id);
    expect(owner(1).occurrences).toHaveLength(2);
    expect(new Set([1, 2, 3, 4, 6, 7].map((n) => owner(n).id)).size).toBe(6);
  });

  it('N9 every exclusion supersession and guard survives without an evaluation-date exemption', () => {
    graders.N9(asset, ref, tables);
  });

  it('N10 every example stays sentence-reachable and item-searchable without becoming a concept', () => {
    graders.N10(asset, ref, tables);
    expect(asset.examples.some((x) => x.sentence === 'cdc2022-opioid-rec05:9')).toBe(true);
    expect(asset.examples.some((x) => x.sentence === 'cdc2022-opioid-rec05:10')).toBe(true);
  });

  it('N11 every condition is its own complete controlled-language sentence and concepts keep KB nouns', () => {
    graders.N11(asset, ref, tables);
  });

  it('N12 declared tables equal their independent census partition without overlaps or dual concept complements', () => {
    graders.N12(asset, ref, tables);
    const { subjects, complements, situations, time } = graders.tableCensus(ref, tables);
    const actual = tables;
    const publicCensus = census(framed.frames, tables);
    expect([...publicCensus.subjects.keys()].sort()).toEqual([...subjects].sort());
    expect([...publicCensus.complements.keys()].sort()).toEqual([...complements].sort());
    expect([...publicCensus.situations.keys()].sort()).toEqual([...situations].sort());
    expect([...publicCensus.targets.keys()].filter((n) => tables.TIME_WORD.test(n)).sort()).toEqual(
      [...time].sort(),
    );
    holds(
      fc.property(fc.constantFrom(...subjects), (noun) => {
        expect(
          actual.PATIENT_ROLES.has(noun) ||
            Object.values(actual.PATIENT_ROLE_EXCLUSIONS).flat().includes(noun),
          noun,
        ).toBe(true);
      }),
    );
  });
});
