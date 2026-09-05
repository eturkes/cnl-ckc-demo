import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { PROOF_BUDGET_MAX } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_CATALOG } from '../src/questions/catalog.js';

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generated = join(root, 'kb/generated');
const manifest = JSON.parse(readFileSync(join(generated, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const image = new Uint8Array(readFileSync(join(generated, 'kb.pvm')));
const diagnostics: string[] = [];
const drain = (): string[] => diagnostics.splice(0, diagnostics.length);
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({
    printErr: (line: string) => diagnostics.push(line),
    on_output: (line: string, stream: string) => {
      if (stream === 'stderr') diagnostics.push(line);
    },
  });
};

const eraseSchema = `
:- dynamic guideline_arg/4.
:- dynamic guideline_cardinality/5.
:- dynamic guideline_document/3.
:- dynamic guideline_entity/4.
:- dynamic guideline_event/3.
:- dynamic guideline_operator/3.
:- dynamic guideline_pp/4.
:- dynamic guideline_property/4.
:- dynamic guideline_schema_version/1.
:- retractall(guideline_arg(_,_,_,_)).
:- retractall(guideline_cardinality(_,_,_,_,_)).
:- retractall(guideline_document(_,_,_)).
:- retractall(guideline_entity(_,_,_,_)).
:- retractall(guideline_event(_,_,_)).
:- retractall(guideline_operator(_,_,_)).
:- retractall(guideline_pp(_,_,_,_)).
:- retractall(guideline_property(_,_,_,_)).
:- retractall(guideline_schema_version(_)).
`;

describe('Register: live answer dependency on guideline schema', () => {
  it('changes both the projected answer and its proof when every supporting schema clause is deleted', async () => {
    const session = new EngineSession({ loadImage, drain, expected: manifest.contract });
    await session.boot(image);
    const goal = QUESTION_CATALOG['when-to-use-opioids'].goal;
    const before = await session.solve(goal, BUDGET_MAX);
    if (before.kind !== 'solutions' || before.solutions[0] === undefined) {
      throw new Error(`baseline answer is ${before.kind}`);
    }
    const selected = before.solutions[0];
    const proofBefore = await session.prove({ goal, selected: selected.display }, PROOF_BUDGET_MAX);

    session.consult(eraseSchema);
    const after = await session.solve(goal, BUDGET_MAX);
    const proofAfter = await session.prove({ goal, selected: selected.display }, PROOF_BUDGET_MAX);

    expect({
      answerChanged: after !== before && JSON.stringify(after) !== JSON.stringify(before),
      proofChanged: JSON.stringify(proofAfter) !== JSON.stringify(proofBefore),
    }).toEqual({
      answerChanged: true,
      proofChanged: true,
    });
  }, 120_000);
});
