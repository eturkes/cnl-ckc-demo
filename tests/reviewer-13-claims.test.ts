// Review witness for README's no-facts-row ⇒ no-grade claim; not a product requirement.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, expect, it } from 'vitest';

import { DEMO_BUDGET } from '../src/demo/DemoController.svelte.js';
import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { decodeMarks, marksView } from '../src/questions/marks.js';

const require = createRequire(import.meta.url);
const generated = new URL('../kb/generated/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('kb-manifest.json', generated), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
let session: EngineSession;
beforeAll(async () => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  const loadImage: ImageLoader = (image) => load(image)({ arguments: ['-q'] });
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(new URL('kb.pvm', generated))));
}, 120_000);

it('CS1 README no facts row implies no KB grade, unless a missing notice appears', async () => {
  const claim = 'A statement without a facts row has no grade, qualifier, preference or time bound';
  expect(readFileSync(new URL('../README.md', import.meta.url), 'utf8')).toContain(claim);
  const counterexamples: {
    question: string;
    document: string;
    statement: number;
    grades: number;
  }[] = [];
  let documents = 0;
  for (const id of QUESTION_IDS) {
    const entry = QUESTION_CATALOG[id];
    const answer = await session.solve(entry.goal, DEMO_BUDGET, `cs1-answer-${id}`);
    const outcome = await session.solve(entry.marksGoal, DEMO_BUDGET, `cs1-marks-${id}`);
    expect(answer.kind).toBe('solutions');
    expect(outcome.kind).toBe('solutions');
    if (answer.kind !== 'solutions' || outcome.kind !== 'solutions')
      throw new Error('no solutions');
    const rows = answerRows(id, answer.solutions);
    const points = synthesizeAnswer(rows);
    const view = marksView(
      { kind: 'settled', id, goal: entry.marksGoal, outcome },
      points,
      rows,
      answer.solutions,
    );
    expect(view).toMatchObject({ missing: 0, notice: false });
    documents += rows.length;
    view.statements.forEach((marks, statement) => {
      if (
        marks === undefined ||
        marks.qualifier !== '' ||
        marks.grade !== '' ||
        marks.preferences.length !== 0 ||
        marks.times.length !== 0
      )
        return;
      for (const source of points[statement]?.sources ?? []) {
        const document = rows[source]?.document;
        if (document === undefined) throw new Error('document absent');
        const returned = outcome.solutions
          .map((solution) => {
            const term = solution.bindings.Marks;
            return term === undefined ? undefined : decodeMarks(term);
          })
          .find((value) => value?.document === document);
        if (returned === undefined) throw new Error('marks absent');
        if (returned.grades.length > 0)
          counterexamples.push({
            question: id,
            document,
            statement: statement + 1,
            grades: returned.grades.length,
          });
      }
    });
  }
  expect(documents).toBe(12);
  expect(counterexamples).toEqual([]);
}, 30_000);
