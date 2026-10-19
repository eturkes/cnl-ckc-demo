// ann-review G2/G3: a real alternative noun must survive the marks projection.
import { createRequire } from 'node:module';
import { beforeAll, expect, it } from 'vitest';

import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';
import type { PlSolution } from '../src/engine/protocol.js';
import type { Engine } from '../src/engine/session.js';
import { decodeTerm } from '../src/engine/terms.js';
import { decodeMarks, marksView } from '../src/questions/marks.js';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';
import { bagFiles, replaceFileText } from './clinical-test-support.js';
import { compiledText, rawClauses, withHead } from './support/marks-oracle.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;
const document = 'cdc2022-opioid-rec03';
const id = 'starting-opioid-therapy';
let engine: Engine;

const rawRows = (goal: string): Record<string, unknown>[] =>
  [...engine.prolog.query(goal)] as Record<string, unknown>[];
const solutions = (goal: string, variables: readonly string[]): PlSolution[] =>
  rawRows(goal).map((row) => ({
    bindings: Object.fromEntries(
      variables.map((variable) => [variable, decodeTerm(row[variable])]),
    ),
    display: {},
  }));

beforeAll(async () => {
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
  // The production build admits the noun; generated gates and premises are not patched.
  const built = await buildImage(payloadSource(files).source);
  expect(built.contract.documents).toBe(385);
  engine = await load(built.image)({ arguments: ['-q'] });
}, 300_000);

it('G2/G3 keeps a referenced alternative named none instead of declaring it absent', () => {
  const native = rawRows(
    `clinical_derived('${document}',D),` +
      'mark_member(d(2,_,P),D),' +
      'mark_member(node(_,guideline_preference(_,_,_,A),_),P),' +
      'A \\== none,mark_noun(A,P,N)',
  );
  expect(native).toHaveLength(1);
  expect(native[0]?.N).toBe('none');

  const answers = solutions(`clinical_advice('${id}',Source,Answer)`, ['Source', 'Answer']);
  const marks = solutions(`clinical_marks('${id}',Source,Marks)`, ['Source', 'Marks']);
  expect(answers).toHaveLength(2);
  expect(marks).toHaveLength(2);
  const decoded = marks.map(({ bindings }) => decodeMarks(bindings.Marks!));
  expect(decoded.every((value) => value !== undefined)).toBe(true);
  const actual = decoded.find((value) => value?.document === document);
  const sentence = actual?.groups.flat().find((value) => value.sentence === 2);
  expect(sentence?.preferences).toHaveLength(1);

  const rows = answerRows(id, answers);
  const view = marksView(
    {
      kind: 'settled',
      id,
      goal: `clinical_marks('${id}',Source,Marks)`,
      outcome: { kind: 'solutions', solutions: marks },
    },
    synthesizeAnswer(rows),
    rows,
    answers,
  );
  expect(view).toMatchObject({ missing: 0, total: 2, notice: false });
  console.info(
    'referenced alternative',
    native[0]?.N,
    'decoded alternative',
    sentence?.preferences[0]?.alternative,
    'notice',
    view.notice,
  );
  expect(sentence?.preferences[0]?.alternative).toBe('none');
});
