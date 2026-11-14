// `.agent/contracts/n2.md` R1, R4, R5 and the read decoders, over the real saved image (node
// project, one worker). R2, R3 and R7 are graded blind by the merged
// `tests/acceptance-gi-records.test.ts` (A2/A3).

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { QueryOutcome } from '../src/engine/client.js';
import { UNDATED } from '../src/engine/context.js';
import type { Engine } from '../src/engine/session.js';
import type { PlTerm } from '../src/engine/terms.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import {
  decodeConditions,
  decodeStatements,
  readOutcome,
  SCOPE_GOAL,
} from '../src/questions/records.js';
import { AnswerService } from '../src/questions/service.js';

import { liveClient } from './acceptance-gi-live.js';
import { CONTENT_PREDICATES } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const GENERATED = join(import.meta.dirname, '..', 'kb', 'generated');
const SUPERSEDED = "'cdc2022-opioid-rec12-imp08'";
const BUDGET = {
  stackBytes: 16_777_216,
  depth: 256,
  inferences: 300_000,
  wallClockMs: 3_000,
  answerCap: 100,
};

const loadImage = async (): Promise<Engine> => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))))({});
};

let engine: Engine;
beforeAll(async () => {
  engine = await loadImage();
}, 120_000);

/**
 * `yes` when `goal` succeeds under the run context `context`, else `no`; any other outcome (a
 * permission error comes back as a plain `{error: true}` object) throws.
 */
const holdsUnder = (context: string, goal: string, on: Engine = engine): string => {
  const result = on.prolog
    .query(`(clinical_run(${context},(${goal})) -> R = yes ; R = no).`)
    .once() as Record<string, unknown> | null;
  const verdict = result?.R;
  if (verdict !== 'yes' && verdict !== 'no') throw new Error(`${goal}: ${JSON.stringify(result)}`);
  return verdict;
};
/** The gate's cited heads and the sentence's own premises, as `derive_all/4` takes them. */
const derivation = (sentence: number, premises: string): string =>
  `clause(clinical_record_gate(${SUPERSEDED},${String(sentence)},_),Body,_), gate_heads(Body,Heads), ` +
  `clinical_record_context(${SUPERSEDED},${String(sentence)},As0), ${premises}, derive_all(Heads,4,As,_)`;

describe('scope and superseded records', () => {
  // The read equals the network asset's boundaries too: acceptance A7.4, merged with g2.
  it('R1 the live scope read is one record set under every context; unknown ids are errors', async () => {
    const client = liveClient();
    try {
      expect((await client.boot()).kind).toBe('booted');
      const service = new AnswerService(client);
      const reads = [];
      for (const evaluationDate of [null, '2022-12-28', '2022-12-29']) {
        const scope = await service.scope(BUDGET, { evaluationDate });
        if (scope.kind !== 'scope') throw new Error(`scope read ${scope.kind}`);
        reads.push(scope.conditions);
      }
      expect(reads[0]).toHaveLength(8);
      expect(reads[0]?.flatMap(({ sources }) => sources)).toHaveLength(12);
      expect(reads[1]).toEqual(reads[0]);
      expect(reads[2]).toEqual(reads[0]);
      expect(await service.superseded('nope' as never, BUDGET, UNDATED)).toMatchObject({
        kind: 'error',
        error: { code: 'protocol' },
      });
      for (const id of QUESTION_IDS) {
        expect((await service.superseded(id, BUDGET, UNDATED)).kind, id).toBe('superseded');
      }
    } finally {
      client.dispose();
    }
  });

  it('R4 a statement derives only through its gate under its own premises', () => {
    for (const sentence of [1, 2, 3]) {
      // The derivation walks every cited head: as many heads as the gate lists clause lines.
      const walked =
        `clause(clinical_record_gate(${SUPERSEDED},${String(sentence)},Lines),Body,_), ` +
        'gate_heads(Body,Heads), length(Lines,N), length(Heads,N), N > 0';
      expect(holdsUnder('none', walked), `S${String(sentence)} heads`).toBe('yes');
      const own = derivation(sentence, 'As = As0');
      expect(holdsUnder('date(20221228)', own), `S${String(sentence)}`).toBe('yes');
      expect(holdsUnder('date(20221229)', own), `S${String(sentence)}`).toBe('no');
      expect(holdsUnder('date(20221228)', derivation(sentence, 'As = []'))).toBe('no');
      expect(
        holdsUnder('date(20221228)', `clinical_record_derived(${SUPERSEDED},${String(sentence)})`),
      ).toBe('yes');
      expect(holdsUnder('none', `clinical_record_derived(${SUPERSEDED},${String(sentence)})`)).toBe(
        'no',
      );
    }
  });

  // A satisfied scope exclusion still blocks the statement before the boundary: the date guard
  // is one guard, never a replacement for the scope guard the stored clauses keep.
  it('R4 a satisfied scope exclusion blocks a superseded statement before its boundary', () => {
    const excluded =
      'guideline_entity(actual,x_patient,patient,countable), guideline_cardinality(actual,x_patient,na,eq,1), ' +
      "guideline_entity(actual,x_pain,'sickle-cell-disease-pain',countable), guideline_cardinality(actual,x_pain,na,eq,1), " +
      'guideline_event(actual,x_have,have), guideline_arg(actual,x_have,1,x_patient), guideline_arg(actual,x_have,2,x_pain)';
    expect(
      holdsUnder(
        'date(20221228)',
        `derive(guideline_exclusion('cdc-2022-opioid'),4,[${excluded}],_,proved)`,
      ),
    ).toBe('yes');
    for (const sentence of [1, 2, 3]) {
      const scoped = derivation(sentence, `As = [${excluded}|As0]`);
      expect(holdsUnder('date(20221228)', scoped), `S${String(sentence)}`).toBe('no');
    }
  });

  // The shown flag rests on the gate's KB clause sites, not on the date alone: erasing any one
  // cited site (rolled back by `snapshot/1`) turns the helper and the public statement false
  // before the boundary, while the supersession record itself stays.
  it('R4 erasing any one cited clause site turns derived false, the record kept', async () => {
    // `erase/1` refuses a static clause, so this case takes its own image with the content
    // predicates dynamic, as `tests/clinical-gate-live.test.ts` does.
    const erasable = await loadImage();
    for (const [name, arity] of CONTENT_PREDICATES) {
      erasable.prolog.query(`dynamic(${name}/${String(arity)}).`).once();
    }
    for (const sentence of [1, 2, 3]) {
      const s = String(sentence);
      const flag = (value: string): string =>
        `clinical_superseded_statement('opioid-use-disorder-treatment',statement(${SUPERSEDED},${s},_,_,_,_,${value}))`;
      expect(holdsUnder('date(20221228)', flag('true'), erasable), `S${s} intact`).toBe('yes');
      const everySite =
        `clause(clinical_record_gate(${SUPERSEDED},${s},Lines),Body,_), gate_heads(Body,Heads), ` +
        'Hs =.. [h|Heads], Ls =.. [l|Lines], length(Lines,N), N > 0, ' +
        '\\+ (between(1,N,I), arg(I,Hs,Head), arg(I,Ls,Line), \\+ snapshot((' +
        'clause(Head,_,Ref), clause_property(Ref,line_count(Line)), erase(Ref), ' +
        `\\+ clinical_record_derived(${SUPERSEDED},${s}), ${flag('false')}, ` +
        `guideline_supersession(${SUPERSEDED},${s},_,_))))`;
      expect(holdsUnder('date(20221228)', everySite, erasable), `S${s} erased`).toBe('yes');
    }
  }, 120_000);

  it('R5 no premise stands in for the evaluation date', () => {
    for (const sentence of [1, 2, 3]) {
      const assumed = derivation(sentence, 'As = [guideline_evaluation_date(20221228)|As0]');
      expect(holdsUnder('none', assumed), `S${String(sentence)}`).toBe('no');
    }
  });
});

describe('record decoders fail closed', () => {
  const atom = (value: string): PlTerm => ({ kind: 'atom', value });
  const solutions = (binding: PlTerm): QueryOutcome => ({
    kind: 'solutions',
    solutions: [{ bindings: { Conditions: binding, Statements: binding }, display: {} }],
  });

  it('decodes the compiled shapes and refuses any other as a decode error, never an empty read', () => {
    const source: PlTerm = {
      kind: 'compound',
      functor: 's',
      args: [atom('d'), { kind: 'integer', value: 3 }],
    };
    const condition: PlTerm = {
      kind: 'compound',
      functor: 'condition',
      args: [source, { kind: 'string', value: 'If X then Y.' }, { kind: 'list', items: [source] }],
    };
    expect(decodeConditions({ kind: 'list', items: [condition] })).toEqual([
      { id: 'd:3', text: 'If X then Y.', sources: [{ document: 'd', sentence: 3 }] },
    ]);
    const statement = (derived: string): PlTerm => ({
      kind: 'compound',
      functor: 'statement',
      args: [
        atom('d'),
        { kind: 'integer', value: 1 },
        { kind: 'string', value: 'S.' },
        atom('Law'),
        atom('https://x'),
        { kind: 'integer', value: 20221229 },
        atom(derived),
      ],
    });
    expect(decodeStatements({ kind: 'list', items: [statement('true')] })).toEqual([
      {
        document: 'd',
        sentence: 1,
        citation: 'Law',
        url: 'https://x',
        date: '2022-12-29',
        text: 'S.',
        derived: true,
      },
    ]);
    const refused = (outcome: { kind: string }): void => {
      expect(outcome).toMatchObject({ kind: 'error', error: { code: 'decode' } });
    };
    const statements = (bad: PlTerm): void => {
      refused(readOutcome(solutions(bad), 'g', 'superseded', 'Statements', decodeStatements));
    };
    const conditions = (bad: PlTerm): void => {
      refused(readOutcome(solutions(bad), SCOPE_GOAL, 'scope', 'Conditions', decodeConditions));
    };
    statements({ kind: 'list', items: [statement('maybe')] });
    conditions({ kind: 'list', items: [atom('condition')] });
    conditions(atom('[]'));
    const twice: QueryOutcome = {
      kind: 'solutions',
      solutions: [
        { bindings: { Conditions: { kind: 'list', items: [] } }, display: {} },
        { bindings: { Conditions: { kind: 'list', items: [] } }, display: {} },
      ],
    };
    expect(readOutcome(twice, SCOPE_GOAL, 'scope', 'Conditions', decodeConditions)).toMatchObject({
      kind: 'error',
      error: { code: 'decode' },
    });
  });
});
