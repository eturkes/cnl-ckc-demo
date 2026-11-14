// gi characterization: observed undated outputs; snapshots are regression pins, not answer oracles.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import fc from 'fast-check';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';
import { BUDGET_MAX } from '../src/engine/budget.js';
import {
  PROOF_BUDGET_MAX,
  type EngineRequest,
  type PlSolution,
  type ProofStep,
} from '../src/engine/protocol.js';
import { guardGoal } from '../src/engine/readonly.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import type { PlTerm } from '../src/engine/terms.js';
import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import { marksView } from '../src/questions/marks.js';
import { serializeAnswer } from '../src/questions/serialize.js';

import { holds } from './support/property.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
const manifest = JSON.parse(
  readFileSync(new URL('../kb/generated/kb-manifest.json', import.meta.url), 'utf8'),
) as { contract: { schemaVersion: number; documents: number } };
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({ printErr: () => undefined });
};
let session: EngineSession;
const answers = new Map<QuestionId, PlSolution[]>();
const need = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('required observed result missing');
  return value;
};
const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

// n1 changes call shapes: keep the undated admission in this one adapter.
const undated = {
  solve: (goal: string) => session.solve(goal, BUDGET_MAX),
  prove: async (goal: string, selected: Readonly<Record<string, string>>) => {
    // Characterize structure, not host speed; deterministic proof caps stay active.
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    try {
      return await session.prove({ goal, selected }, PROOF_BUDGET_MAX);
    } finally {
      clock.mockRestore();
    }
  },
  readonly: (goal: string) =>
    session.handle(
      {
        id: 'characterization',
        kind: 'query',
        goal,
        budget: BUDGET_MAX,
        readonly: true,
      } satisfies EngineRequest,
      new Uint8Array(),
    ),
};

// Alpha-normalize one goal, preserving quoted atoms/strings and within-goal variable sharing.
const goalShape = (goal: string): string => {
  const variables = new Map<string, string>();
  let next = 0;
  return goal.replace(
    /'(?:\\.|''|[^'\\])*'|"(?:\\.|""|[^"\\])*"|[A-Za-z_][A-Za-z0-9_]*/gu,
    (word) => {
      if (!/^[A-Z_]/u.test(word)) return word;
      if (word === '_') return `V${String(next++)}`;
      let name = variables.get(word);
      if (name === undefined) {
        name = `V${String(next++)}`;
        variables.set(word, name);
      }
      return name;
    },
  );
};
const shape = (step: ProofStep): unknown => {
  if (step.kind === 'clause')
    return [step.kind, step.line, step.predicate, goalShape(step.head), step.children.map(shape)];
  if (step.kind === 'assumption') return [step.kind, step.predicate, goalShape(step.head)];
  return [step.kind, goalShape(step.goal)];
};
const flatten = (steps: readonly ProofStep[]): ProofStep[] =>
  steps.flatMap((step) => (step.kind === 'clause' ? [step, ...flatten(step.children)] : [step]));

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
  for (const id of QUESTION_IDS) {
    const result = await undated.solve(QUESTION_CATALOG[id].goal);
    if (result.kind !== 'solutions') throw new Error(`${id}: ${JSON.stringify(result)}`);
    answers.set(id, result.solutions);
  }
}, 120_000);

describe('undated prepared answers', () => {
  it.each(QUESTION_IDS)('C1 %s keeps canonical bytes and statement order', (id) => {
    const solutions = need(answers.get(id));
    const points = synthesizeAnswer(answerRows(id, solutions));
    expect({
      canonical: digest(serializeAnswer(QUESTION_CATALOG[id], solutions)),
      points,
    }).toMatchSnapshot();
  });

  it.each(QUESTION_IDS)(
    'C2 %s keeps the facts-row labels and values',
    async (id) => {
      const entry = QUESTION_CATALOG[id];
      const solutions = need(answers.get(id));
      const rows = answerRows(id, solutions);
      const outcome = await undated.solve(entry.marksGoal);
      expect(outcome.kind).toBe('solutions');
      const view = marksView(
        { kind: 'settled', id, goal: entry.marksGoal, outcome },
        synthesizeAnswer(rows),
        rows,
        solutions,
      );
      expect({
        ...view,
        statements: view.statements.map((marks) =>
          marks === undefined
            ? []
            : [
                ['Qualifier', marks.qualifier],
                ['Grade', marks.grade],
                ['Preferred', marks.preferences.join('; ')],
                ['Time', marks.times.join('; ')],
              ].filter(([, value]) => value !== ''),
        ),
      }).toMatchSnapshot();
    },
    60_000,
  );

  it.each(QUESTION_IDS)(
    'C3 %s keeps every selected proof up to variable renaming',
    async (id) => {
      const readings = [];
      for (const selected of need(answers.get(id))) {
        const outcome = await undated.prove(QUESTION_CATALOG[id].goal, selected.display);
        expect(outcome.kind).toBe('proof');
        if (outcome.kind !== 'proof') throw new Error(`${id}: ${JSON.stringify(outcome)}`);
        const steps = flatten(outcome.steps);
        readings.push({
          structure: digest(outcome.steps.map(shape)),
          kinds: Object.fromEntries(
            [...new Set(steps.map((step) => step.kind))]
              .sort()
              .map((kind) => [kind, steps.filter((step) => step.kind === kind).length]),
          ),
          lines: [
            ...new Set(steps.flatMap((step) => (step.kind === 'clause' ? [step.line] : []))),
          ].sort((a, b) => a - b),
        });
      }
      expect(readings).toMatchSnapshot();
    },
    60_000,
  );
});

const REFUSED = [
  'X = "an invented claim"',
  'once((X = "an invented claim" ; guideline_schema_version(_)))',
  'msort([b,a],L)',
  'assertz(probe_c1(1))',
  'string_chars("ab",Cs)',
  'functor(f(a),F,N)',
  'X = functor(a,b,c)',
  'X = [functor(a)]',
  'X = f(functor(a,b))',
  '',
  'clinical_rule(',
  'true. false.',
  'retract(_)',
  'nb_setval(k,1)',
  'set_prolog_flag(double_quotes,codes)',
  'consult(f)',
  'user:clinical_rule(D,S,R)',
  'lists:append(X,Y,Z)',
  'G',
  'G = true, G',
  'findall(X,G,L)',
  '\\+ G',
  'call(clinical_rule(D,S,R))',
  'call(clinical_rule(D),S,R)',
  'call(G,X)',
  '[f]',
  '"text"',
  '42',
  'clause(H,B)',
  'clause(assertz(_),B)',
  'catch(true,_,true)',
  '(true;assertz(x))',
  'forall(true,assertz(x))',
  'findall(X,(clinical_rule(X,_,_),assertz(y)),L)',
  'once(atom_concat(a,b,C))',
  'setof(D,S^R^(clinical_rule(D,S,R),atom_concat(D,x,_)),L)',
  ...['_123', '_0', '_G123', '_G0'].map((name) => `${name} = 1`),
];

describe('read-only goal admission', () => {
  it('C7 generated nested goal positions cannot hide a forbidden write', () => {
    const compound = (functor: string, ...args: PlTerm[]): PlTerm => ({
      kind: 'compound',
      functor,
      args,
    });
    const atom = (value: string): PlTerm => ({ kind: 'atom', value });
    holds(
      fc.property(
        fc.constantFrom('assertz', 'retract', 'consult', 'nb_setval', 'set_prolog_flag'),
        fc.integer(),
        fc.array(fc.constantFrom('once', 'ignore', 'not'), { maxLength: 8 }),
        (functor, value, wrappers) => {
          const data: PlTerm = { kind: 'integer', value };
          const arity = functor === 'nb_setval' || functor === 'set_prolog_flag' ? 2 : 1;
          let goal = compound(
            functor,
            ...(arity === 1 ? [data] : [atom('characterization'), data]),
          );
          for (const wrapper of wrappers) goal = compound(wrapper, goal);
          const verdict = guardGoal(
            compound(',', compound('guideline_schema_version', { kind: 'variable', id: 1 }), goal),
            [],
          );
          expect(verdict.ok).toBe(false);
          if (verdict.ok) throw new Error('forbidden write admitted');
          expect(verdict.reason).toContain(`${functor}/${String(arity)}`);
        },
      ),
    );
  });

  it.each(['a', '😀'])(
    'C7 preserves the 2048-code-unit boundary with %s padding',
    async (glyph) => {
      const prefix = 'once(guideline_schema_version(_))/*';
      const room = 2048 - prefix.length - 2;
      const goal = `${prefix}${glyph.repeat(Math.floor(room / glyph.length))}${'a'.repeat(room % glyph.length)}*/`;
      expect(goal.length).toBe(2048);
      expect(await undated.readonly(goal)).toMatchObject({ kind: 'solutions', solutions: [{}] });
      expect(await undated.readonly(`${goal} `)).toMatchObject({
        kind: 'error',
        error: { code: 'guard' },
      });
    },
  );

  it.each(REFUSED)('C7 keeps refusing %s', async (goal) => {
    expect(await undated.readonly(goal)).toMatchObject({ kind: 'error', error: { code: 'guard' } });
  });

  it('C7 a permitted document goal still returns all 492 solutions after refusals', async () => {
    const outcome = await undated.readonly('guideline_document(D,_,_,_)');
    expect(outcome.kind).toBe('solutions');
    if (outcome.kind !== 'solutions') throw new Error(JSON.stringify(outcome));
    expect(outcome.solutions).toHaveLength(492);
    expect(new Set(outcome.solutions.map((solution) => solution.display.D)).size).toBe(492);
  }, 30_000);
});
