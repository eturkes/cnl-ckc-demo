// M5 u2 red suite — the query-local cap-2 assumption evaluator, against the real image.
//
// SEED: every case fails until it encodes its ruled predicate from
// `.agent/archive/contracts/m5u2.md`. One case per predicate P1-P8; P9/P10 are MAIN's own
// measurements and carry no case here.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PROOF_BUDGET_MAX } from '../src/engine/protocol.js';
import type { Engine } from '../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { PROOF_SOURCE } from '../tools/kb/proof.mjs';
import {
  CONTENT_PREDICATES,
  gateRecords,
  orderedHash,
  ROOT,
  scanContentSites,
  sha12,
} from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | {
      default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
    };
const load = typeof factory === 'function' ? factory : factory.default;
const diagnostics: string[] = [];
let engine: Engine;
let mutableEngine: Engine;
let initialSchema: string[];

const SCHEMA_PREDICATES = CONTENT_PREDICATES;
/** Every schema indicator, the record pair included, for the static-state reading. */
const STATIC_PREDICATES = [
  ['guideline_schema_version', 1],
  ['guideline_document', 4],
  ...CONTENT_PREDICATES,
] as const;

/**
 * The shipped image is closed — `autoload=false`, no `library(lists)` — so `sub_term/2`
 * and `member/2` do not exist. Proof-tree traversal is asserted test-side instead, over
 * the shipped `app/3`.
 */
const PROBE_CLAUSES = [
  'probe_lines([],[])',
  '(probe_lines([assumption(_)|T],L) :- probe_lines(T,L))',
  '(probe_lines([naf(_)|T],L) :- probe_lines(T,L))',
  '(probe_lines([node(line(N),_,C)|T],[N|R]) :- probe_lines(C,LC),probe_lines(T,LT),app(LC,LT,R))',
  'probe_assume([],[])',
  '(probe_assume([assumption(A)|T],[A|R]) :- probe_assume(T,R))',
  '(probe_assume([naf(_)|T],R) :- probe_assume(T,R))',
  '(probe_assume([node(_,_,C)|T],R) :- probe_assume(C,RC),probe_assume(T,RT),app(RC,RT,R))',
  'probe_heads([],[])',
  '(probe_heads([assumption(_)|T],R) :- probe_heads(T,R))',
  '(probe_heads([naf(_)|T],R) :- probe_heads(T,R))',
  '(probe_heads([node(_,H,C)|T],[H|R]) :- probe_heads(C,RC),probe_heads(T,RT),app(RC,RT,R))',
  'probe_member(X,[X|_])',
  '(probe_member(X,[_|T]) :- probe_member(X,T))',
] as const;

const atom = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** One deterministic solution, or a thrown Prolog error. */
export const row = (goal: string, target: Engine = engine): Record<string, unknown> => {
  const result = target.prolog.query(goal).once();
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`query returned no bindings: ${goal}`);
  }
  if ('$error' in result) throw new Error(JSON.stringify(result));
  return result as Record<string, unknown>;
};

/**
 * Runs `goal` under the reviewed proof envelope and reports which bound stopped it.
 * A bare success/failure cannot tell exhaustion from refutation, and P3/P8 both turn
 * on that difference.
 */
export const bounded = (
  goal: string,
  after = '',
  target: Engine = engine,
): Record<string, unknown> =>
  row(
    `(catch(call_with_inference_limit(call_with_depth_limit(once((${goal})),256,Depth),300000,Inf),` +
      `error(resource_error(stack),_),Inf=stack) -> ` +
      `(Inf==inference_limit_exceeded -> State=inferences ; Inf==stack -> State=stack ; ` +
      `Depth==depth_limit_exceeded -> State=depth ; State=proved) ; State=failed)` +
      (after === '' ? '.' : `,(State==proved -> (${after}) ; true).`),
    target,
  );

const schemaState = (target: Engine): string[] =>
  STATIC_PREDICATES.map(([name, arity]) => {
    const call = `${name}(${Array.from({ length: arity }, () => '_').join(',')})`;
    const result = row(
      // `guideline_evaluation_date/1` is declared and holds no clause: a program states it.
      `(predicate_property(${call},number_of_clauses(N))->true;N=0),` +
        `(predicate_property(${call},'dynamic')->Kind='dynamic';Kind='static').`,
      target,
    );
    return `${name}/${String(arity)}:${String(result.Kind)}:${String(result.N)}`;
  });

beforeAll(async () => {
  const image = new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm')));
  const options = {
    print: () => {},
    printErr: (line: unknown) => diagnostics.push(String(line)),
  };
  engine = await load(image)(options);
  initialSchema = schemaState(engine);
  mutableEngine = await load(image)(options);
  for (const [name, arity] of SCHEMA_PREDICATES) {
    row(`dynamic(${name}/${String(arity)}).`, mutableEngine);
  }
  for (const target of [engine, mutableEngine]) {
    for (const clause of PROBE_CLAUSES) row(`assertz(${clause}).`, target);
  }
}, 120_000);

describe('clinical assumption evaluator', () => {
  it('P1 pins the shipped proof path', () => {
    const shape = row(
      `(current_predicate(mi/3)->Mi=yes;Mi=no),` +
        `(current_predicate(mi_limited/2)->Limited=yes;Limited=no),` +
        `(mi_limited(guideline_schema_version(1),0)->AtZero=yes;AtZero=no),` +
        `(mi_limited(guideline_schema_version(1),1)->AtOne=yes;AtOne=no),` +
        // A comparison built-in derives as a line-free `builtin/1` leaf (`.agent/contracts/n9-comparison.md`).
        `(guideline_satisfies(exactly,60,geq,50)->Plain=yes;Plain=no),` +
        `(mi(guideline_satisfies(exactly,60,geq,50),5,_)->Derived=yes;Derived=no).`,
    );
    expect(shape).toMatchObject({
      Mi: 'yes',
      Limited: 'yes',
      AtZero: 'yes',
      AtOne: 'no',
      Plain: 'yes',
      Derived: 'yes',
    });

    const hashes = Object.fromEntries(
      QUESTION_IDS.map((id) => {
        const goal = QUESTION_CATALOG[id].goal;
        const result = row(
          `findall(T,(mi((${goal}),1,P),copy_term(((${goal}),P),C),numbervars(C,0,_),` +
            `term_string(C,T,[quoted(true),numbervars(true)])),Ts),msort(Ts,S),` +
            `atomic_list_concat(S,'\\n',Text).`,
        );
        return [id, sha12(String(result.Text))];
      }),
    );
    // Re-anchored at u4, which replaced the fabricated `clinical_advice` arm — flat nodes
    // with empty child lists read off a precomputed site list — with the live derivation.
    // The hashes are what catch any later drift in the rendered proof.
    expect(hashes).toEqual({
      'when-to-use-opioids': 'c43167eaaafd',
      'starting-opioid-therapy': '431d0b7c8016',
      'acute-pain-prescription-duration': '7bfd8f077ae4',
      'opioid-follow-up': '9262131cb7f4',
      'opioid-safety': '2e0cd050dba7',
      'continuing-or-tapering-opioids': '2979bf2e048d',
      'opioid-use-disorder-treatment': '2c8dae022dc9',
    });
  });

  it('P2 moves no content-site line and no gate line list', () => {
    const siteLines = scanContentSites().flatMap(({ sites }) => sites.map(({ line }) => line));
    expect(siteLines).toHaveLength(863);
    expect(orderedHash(siteLines.map(String))).toBe('ca7590401f70');

    const gateLines = gateRecords.flatMap(({ lines }) => lines);
    expect(gateRecords).toHaveLength(58);
    expect(
      orderedHash(
        gateRecords.map(
          ({ document, sentence, lines }) => `${document}:${String(sentence)}:${lines.join(',')}`,
        ),
      ),
    ).toBe('7e00452f5c48');
    expect([...gateLines].sort((left, right) => left - right)).toEqual(
      [...siteLines].sort((left, right) => left - right),
    );

    for (const gate of gateRecords) {
      const result = row(
        `clause(clinical_gate(${atom(gate.document)},${String(gate.sentence)},_,Lines),_,_),` +
          `atomic_list_concat(Lines,',',Text).`,
      );
      expect(
        String(result.Text).split(',').filter(Boolean).map(Number),
        `${gate.document}:${String(gate.sentence)}`,
      ).toEqual(gate.lines);
    }
  });

  // A 30 s timeout (rel-u1): cap 4's scope-guard searches carried this case past vitest's 5000 ms
  // default under the suite's own load.
  it('P3 derives all 58 sentences at cap 4 and exactly 32 at cap 3', () => {
    expect(String(row('clinical_depth(D).').D)).toBe('4');

    const states = new Map<number, Map<string, string>>();
    for (const cap of [3, 4, 5]) {
      states.set(
        cap,
        new Map(
          gateRecords.map((gate) => [
            `${gate.document}:${String(gate.sentence)}`,
            String(
              bounded(
                `clinical_derive(${atom(gate.document)},${String(gate.sentence)},${String(cap)},_,_)`,
              ).State,
            ),
          ]),
        ),
      );
    }

    // Below cap 4 every guarded sentence whose exclusion search needs three levels under its
    // premises fails: the scope guard's negation then ends at a limit, which proves nothing.
    expect([...states.get(3)!.entries()].filter(([, state]) => state !== 'proved')).toEqual([
      ['cdc2022-opioid-rec01:3', 'failed'],
      ['cdc2022-opioid-rec01:4', 'failed'],
      ['cdc2022-opioid-rec01:5', 'failed'],
      ['cdc2022-opioid-rec01:6', 'failed'],
      ['cdc2022-opioid-rec02:4', 'failed'],
      ['cdc2022-opioid-rec02:5', 'failed'],
      ['cdc2022-opioid-rec02:6', 'failed'],
      ['cdc2022-opioid-rec02:7', 'failed'],
      ['cdc2022-opioid-rec02:8', 'failed'],
      ['cdc2022-opioid-rec02:9', 'failed'],
      ['cdc2022-opioid-rec02:10', 'failed'],
      ['cdc2022-opioid-rec02:11', 'failed'],
      ['cdc2022-opioid-rec02:12', 'failed'],
      ['cdc2022-opioid-rec02:13', 'failed'],
      ['cdc2022-opioid-rec07:5', 'failed'],
      ['cdc2022-opioid-rec09:2', 'failed'],
      ['cdc2022-opioid-rec09:3', 'failed'],
      ['cdc2022-opioid-rec09:4', 'failed'],
      ['cdc2022-opioid-rec09:5', 'failed'],
      ['cdc2022-opioid-rec05:2', 'failed'],
      ['cdc2022-opioid-rec05:3', 'failed'],
      ['cdc2022-opioid-rec05:4', 'failed'],
      ['cdc2022-opioid-rec05:5', 'failed'],
      ['cdc2022-opioid-rec05:6', 'failed'],
      ['cdc2022-opioid-rec12:2', 'failed'],
      ['cdc2022-opioid-rec12:3', 'failed'],
    ]);
    expect([...states.get(4)!.values()].filter((state) => state !== 'proved')).toEqual([]);
    expect([...states.get(5)!.values()].filter((state) => state !== 'proved')).toEqual([]);

    const documents = [...new Set(gateRecords.map(({ document }) => document))];
    expect(documents).toHaveLength(12);
    for (const document of documents) {
      const keys = gateRecords
        .filter((gate) => gate.document === document)
        .map((gate) => `${gate.document}:${String(gate.sentence)}`);
      expect(
        keys.every((key) => states.get(4)!.get(key) === 'proved'),
        document,
      ).toBe(true);
    }

    const defaultFailures = gateRecords.filter(
      (gate) =>
        String(
          bounded(`clinical_derive(${atom(gate.document)},${String(gate.sentence)},_,_)`).State,
        ) !== 'proved',
    );
    expect(defaultFailures).toEqual([]);
  }, 30_000);

  it('P4 fails the derivation for every one of the 863 cited clauses erased alone', () => {
    let erased = 0;
    for (const gate of gateRecords) {
      const document = atom(gate.document);
      for (const [index, line] of gate.lines.entries()) {
        const head = gate.heads[index];
        if (head === undefined) {
          throw new Error(`${gate.document}:${String(gate.sentence)}:${String(line)} head missing`);
        }
        const result = bounded(
          `snapshot((clause((${head}),_,Ref),clause_property(Ref,file('/prolog.pl')),` +
            `clause_property(Ref,line_count(${String(line)})),erase(Ref),` +
            `(clinical_derive(${document},${String(gate.sentence)},Rule,Proof)->Derived=yes;Derived=no),` +
            `(var(Rule)->RuleState=unbound;RuleState=bound),` +
            `(var(Proof)->ProofState=unbound;ProofState=bound)))`,
          '',
          mutableEngine,
        );
        expect(result, `${gate.document}:${String(gate.sentence)}:${String(line)}`).toMatchObject({
          State: 'proved',
          Derived: 'no',
          RuleState: 'unbound',
          ProofState: 'unbound',
        });
        erased += 1;
      }
    }
    expect(erased).toBe(863);

    for (const gate of gateRecords) {
      expect(
        String(
          bounded(
            `clinical_derive(${atom(gate.document)},${String(gate.sentence)},_,_)`,
            '',
            mutableEngine,
          ).State,
        ),
        `${gate.document}:${String(gate.sentence)} rollback`,
      ).toBe('proved');
    }
  }, 120_000);

  it('P5 yields no full document recommendation under either negative control', () => {
    const withheld = new Map(
      gateRecords.map((gate) => [
        `${gate.document}:${String(gate.sentence)}`,
        String(
          bounded(
            `clause(clinical_gate(${atom(gate.document)},${String(gate.sentence)},_,_),Body,_),` +
              `gate_heads(Body,Heads),derive_all(Heads,4,[],_)`,
          ).State,
        ),
      ]),
    );
    expect(
      [...withheld.entries()].filter(([, state]) => state === 'proved').map(([key]) => key),
    ).toEqual(['cdc2022-opioid-rec05:9', 'cdc2022-opioid-rec05:10']);

    const documents = [...new Set(gateRecords.map(({ document }) => document))];
    expect(
      documents.filter((document) =>
        gateRecords
          .filter((gate) => gate.document === document)
          .every((gate) => withheld.get(`${document}:${String(gate.sentence)}`) === 'proved'),
      ),
    ).toEqual([]);

    const eraseSchema = SCHEMA_PREDICATES.map(
      ([name, arity]) =>
        `retractall(${name}(${Array.from({ length: arity }, () => '_').join(',')}))`,
    ).join(',');
    const documentList = `[${documents.map(atom).join(',')}]`;
    const erased = bounded(
      `snapshot((${eraseSchema},` +
        `findall(D-S,(clause(clinical_gate(D,S,_,_),_,_),clinical_derive(D,S,_,_)),Rows),` +
        `length(Rows,Sentences),` +
        `findall(D,(probe_member(D,${documentList}),` +
        `\\+ (clause(clinical_gate(D,S,_,_),_,_),\\+ clinical_derive(D,S,_,_))),Complete),` +
        `length(Complete,Documents)))`,
      '',
      mutableEngine,
    );
    expect(erased).toMatchObject({ State: 'proved', Sentences: 0, Documents: 0 });
  });

  it('P6 reports every hypothetical premise as a source-line-free assumption leaf', () => {
    const documentLines = new Map<string, Set<number>>();
    for (const gate of gateRecords) {
      const document = atom(gate.document);
      const result = bounded(
        `clinical_derive(${document},${String(gate.sentence)},_,Proof)`,
        `probe_lines(Proof,RawLines),sort(RawLines,Lines),` +
          `atomic_list_concat(Lines,',',LineText),probe_assume(Proof,Assumed),probe_heads(Proof,Heads),` +
          `(\\+ (clinical_premise(${document},${String(gate.sentence)},_,A),` +
          `\\+ probe_member(A,Assumed))->AllPremises=yes;AllPremises=no),` +
          `(\\+ (probe_member(A,Assumed),` +
          `\\+ clinical_premise(${document},${String(gate.sentence)},_,A))->OnlyPremises=yes;OnlyPremises=no),` +
          `(\\+ (probe_member(A,Assumed),\\+ ground(A))->Ground=yes;Ground=no),` +
          `(\\+ (probe_member(A,Assumed),probe_member(H,Heads),A==H)` +
          `->NoSourceLine=yes;NoSourceLine=no)`,
      );
      expect(result, `${gate.document}:${String(gate.sentence)}`).toMatchObject({
        State: 'proved',
        AllPremises: 'yes',
        OnlyPremises: 'yes',
        Ground: 'yes',
        NoSourceLine: 'yes',
      });

      const lines = String(result.LineText).split(',').filter(Boolean).map(Number);
      expect(
        lines.every((line) => gate.lines.includes(line)),
        `${gate.document}:${String(gate.sentence)} foreign proof line`,
      ).toBe(true);
      let seen = documentLines.get(gate.document);
      if (seen === undefined) {
        seen = new Set<number>();
        documentLines.set(gate.document, seen);
      }
      for (const line of lines) seen.add(line);
    }

    for (const [document, lines] of documentLines) {
      const expected = gateRecords
        .filter((gate) => gate.document === document)
        .flatMap(({ lines: gateLines }) => gateLines)
        .sort((left, right) => left - right);
      expect(
        [...lines].sort((left, right) => left - right),
        document,
      ).toEqual(expected);
    }
  });

  it('P7 mutates no world state and leaves every schema predicate static', () => {
    expect(PROOF_SOURCE).not.toMatch(
      /\b(?:assertz|asserta|retract|retractall|erase|dynamic)\s*(?:\(|\/)\s*/u,
    );
    expect(initialSchema).toHaveLength(22);
    expect(initialSchema.every((state) => state.includes(':static:'))).toBe(true);
    expect(schemaState(engine)).toEqual(initialSchema);

    const attemptedWrite = row(
      `snapshot(catch((assertz(guideline_entity(m5_u2_probe,m5_u2_probe,m5_u2_probe,m5_u2_probe)),` +
        `Result=written),E,(E=error(permission_error(modify,static_procedure,_),_)` +
        `->Result=permission;(term_string(E,Error,[quoted(true)]),Result=other)))).`,
    );
    expect(attemptedWrite, String(attemptedWrite.Error)).toMatchObject({ Result: 'permission' });
    expect(schemaState(engine)).toEqual(initialSchema);
  });

  it('P8 keeps every derivation inside the reviewed proof budget', () => {
    expect(PROOF_BUDGET_MAX).toMatchObject({
      depth: 256,
      inferences: 300_000,
      wallClockMs: 3000,
    });
    const capShipped = new Map<string, string>();
    let worst = { key: '', milliseconds: 0 };

    for (const cap of [1, 2, 3, 4, 5]) {
      for (const gate of gateRecords) {
        const key = `${gate.document}:${String(gate.sentence)}@${String(cap)}`;
        const started = performance.now();
        const state = String(
          bounded(
            `clinical_derive(${atom(gate.document)},${String(gate.sentence)},${String(cap)},_,_)`,
          ).State,
        );
        const milliseconds = performance.now() - started;
        expect(milliseconds, key).toBeLessThan(PROOF_BUDGET_MAX.wallClockMs);
        expect(['proved', 'failed'], key).toContain(state);
        if (cap === 4) capShipped.set(`${gate.document}:${String(gate.sentence)}`, state);
        if (milliseconds > worst.milliseconds) worst = { key, milliseconds };
      }
    }

    expect(worst.milliseconds, worst.key).toBeLessThan(PROOF_BUDGET_MAX.wallClockMs);
    // The one gate whose native resolution once exhausted its budget still proves here.
    expect(['cdc2022-opioid-rec05:6'].map((key) => [key, capShipped.get(key)])).toEqual([
      ['cdc2022-opioid-rec05:6', 'proved'],
    ]);
  }, 60_000);

  it('emits no engine diagnostic', () => {
    expect(diagnostics).toEqual([]);
  });
});
