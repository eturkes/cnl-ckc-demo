// ann-review G2 + G3 (`.agent/contracts/ann-review.md`): inputs the build admits keep the marks'
// and the answer's guarantees. Each case builds its own planted image from the verified bag.
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';
import type { PlSolution } from '../src/engine/protocol.js';
import type { Engine } from '../src/engine/session.js';
import { decodeTerm } from '../src/engine/terms.js';
import { decodeMarks, marksView } from '../src/questions/marks.js';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';
import {
  bagFiles,
  mutatePlSentence,
  replaceFileText,
  scopeGuard,
} from './clinical-test-support.js';
import { compiledText, rawClauses, withHead } from './support/marks-oracle.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;
const document = 'cdc2022-opioid-rec03';
const id = 'starting-opioid-therapy';

const boot = async (files: typeof bagFiles) => {
  const built = await buildImage(payloadSource(files).source);
  expect(built.contract.documents).toBe(492);
  const engine = await load(built.image)({ arguments: ['-q'] });
  const rows = (goal: string): Record<string, unknown>[] =>
    [...engine.prolog.query(goal)] as Record<string, unknown>[];
  const solutions = (goal: string, variables: readonly string[]): PlSolution[] =>
    rows(goal).map((row) => ({
      bindings: Object.fromEntries(
        variables.map((variable) => [variable, decodeTerm(row[variable])]),
      ),
      display: {},
    }));
  return { rows, solutions };
};

it('G2 an alternative whose noun is the sentinel none leaves its document without marks', async () => {
  const clauses = rawClauses(compiledText(bagFiles, document));
  const preference = clauses.find(
    ({ functor, sentence }) => functor === 'guideline_preference' && sentence === 2,
  );
  if (preference === undefined) throw new Error('preference control absent');
  expect(preference.args[3]).not.toBe('none');
  const alternative = clauses.find(
    ({ functor, sentence, args }) =>
      functor === 'guideline_entity' && sentence === 2 && args[1] === preference.args[3],
  );
  if (alternative === undefined) throw new Error('alternative entity control absent');
  const changedArgs = [...alternative.args];
  changedArgs[2] = 'none';
  const files = replaceFileText(bagFiles, `/pl/${document}.pl`, (text) => {
    const lines = text.split('\n');
    expect(lines[alternative.index]).toBe(alternative.line);
    lines[alternative.index] = withHead(alternative, changedArgs);
    return lines.join('\n');
  });
  const { rows, solutions } = await boot(files);
  const native = rows(
    `clinical_derived('${document}',D),` +
      'mark_member(d(2,_,P),D),' +
      'mark_member(node(_,guideline_preference(_,_,_,A),_),P),' +
      'A \\== none,mark_noun(A,P,N)',
  );
  expect(native.map(({ N }) => N)).toEqual(['none']);

  const answers = solutions(`clinical_advice('${id}',Source,Answer)`, ['Source', 'Answer']);
  const marks = solutions(`clinical_marks('${id}',Source,Marks)`, ['Source', 'Marks']);
  expect(answers).toHaveLength(2);
  const returned = marks.map(({ bindings }) => decodeMarks(bindings['Marks']!)?.document);
  expect(returned).toHaveLength(1);
  expect(returned[0]).toMatch(/^cdc2022-opioid-rec\d+$/u);
  expect(returned[0]).not.toBe(document);
  const answerRowsShown = answerRows(id, answers);
  const view = marksView(
    {
      kind: 'settled',
      id,
      goal: `clinical_marks('${id}',Source,Marks)`,
      outcome: { kind: 'solutions', solutions: marks },
    },
    synthesizeAnswer(answerRowsShown),
    answerRowsShown,
    answers,
  );
  expect(view).toMatchObject({ missing: 1, total: 2, notice: true });
}, 300_000);

it('G3 a body literal that is no schema relation is never assumed', async () => {
  let changed = 0;
  // The literal joins the antecedent every clause of the sentence shares, ahead of the scope guard
  // a deontic edge ends with.
  const guard = scopeGuard();
  const files = mutatePlSentence(bagFiles, document, 2, (line) => {
    expect(line).toContain(' :- ');
    changed += 1;
    const body = line.slice(0, -1);
    return body.endsWith(guard)
      ? `${body.slice(0, -guard.length)}, fail${guard}.`
      : `${body}, fail.`;
  });
  expect(changed).toBeGreaterThan(1);
  const source = payloadSource(files).source;
  expect(source).toMatch(/clinical_premise\('cdc2022-opioid-rec03',2,\d+,\(fail\)\)/u);
  const { rows } = await boot(files);
  expect(rows('true')).toHaveLength(1);
  expect(rows(`clinical_context('${document}',2,As),assumed(fail,As)`)).toHaveLength(1);
  expect(rows(`clinical_advice(_,_,clinical_answer('${document}',_,_))`)).toHaveLength(0);
  expect(rows(`clinical_marks(_,_,marks('${document}',_,_))`)).toHaveLength(0);
}, 300_000);
