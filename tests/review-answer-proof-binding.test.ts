import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_CATALOG } from '../src/questions/catalog.js';
import { serializeAnswer } from '../src/questions/serialize.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const diagnostics: string[] = [];
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((value: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | {
        default: (value: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
      };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({ printErr: (line: string) => diagnostics.push(line) });
};

const eraseGuidelineSemantics = [
  ['guideline_arg', 4],
  ['guideline_cardinality', 5],
  ['guideline_entity', 4],
  ['guideline_event', 3],
  ['guideline_operator', 3],
  ['guideline_pp', 4],
  ['guideline_property', 4],
]
  .map(([predicate, arity]) => {
    const variables = Array.from({ length: Number(arity) }, (_, index) => `_${String(index)}`);
    return `:- dynamic(${String(predicate)}/${String(arity)}).\n:- retractall(${String(predicate)}(${variables.join(',')})).`;
  })
  .join('\n');

let session: EngineSession;
const solve = async (): Promise<PlSolution[]> => {
  const entry = QUESTION_CATALOG['when-to-use-opioids'];
  const result = await session.solve(entry.goal, BUDGET_MAX);
  if (result.kind !== 'solutions') throw new Error(`expected solutions, got ${result.kind}`);
  return result.solutions;
};

beforeAll(async () => {
  session = new EngineSession({
    loadImage,
    drain: () => diagnostics.splice(0),
    expected: manifest.contract,
  });
  await session.boot(image);
}, 120_000);

describe('expedited semantic binding review', () => {
  it('S1 removes an answer after every guideline semantic clause is removed', async () => {
    const entry = QUESTION_CATALOG['when-to-use-opioids'];
    const before = serializeAnswer(entry, await solve());

    const loaded = await session.handle(
      { id: 'erase-guideline-semantics', kind: 'consult', source: eraseGuidelineSemantics },
      image,
    );
    expect(loaded).toMatchObject({ kind: 'consulted' });
    expect(await session.solve('guideline_event(_,_,_).', BUDGET_MAX)).toEqual({ kind: 'failure' });

    const after = serializeAnswer(entry, await solve());
    expect(after).not.toBe(before);
  });

  it('S3 rejects a stored proof after its named clauses are removed', async () => {
    const proofSession = new EngineSession({
      loadImage,
      drain: () => diagnostics.splice(0),
      expected: manifest.contract,
    });
    await proofSession.boot(image);
    const entry = QUESTION_CATALOG['when-to-use-opioids'];
    const solved = await proofSession.solve(entry.goal, BUDGET_MAX);
    if (solved.kind !== 'solutions' || solved.solutions[0] === undefined) {
      throw new Error(`expected a selected answer, got ${solved.kind}`);
    }
    const input = { goal: entry.goal, selected: solved.solutions[0].display };
    const before = await proofSession.prove(input, BUDGET_MAX);
    if (before.kind !== 'proof' || before.steps[0] === undefined) {
      throw new Error(`expected a proof, got ${before.kind}`);
    }

    const loaded = await proofSession.handle(
      { id: 'erase-proof-clauses', kind: 'consult', source: eraseGuidelineSemantics },
      image,
    );
    expect(loaded).toMatchObject({ kind: 'consulted' });
    const first = before.steps[0];
    expect(
      await proofSession.solve(
        `clause((${first.head}),_,Ref),clause_property(Ref,line_count(${String(first.line)})).`,
        BUDGET_MAX,
      ),
    ).toEqual({ kind: 'failure' });

    const after = await proofSession.prove(input, BUDGET_MAX);
    expect(after).not.toEqual(before);
  });
});
