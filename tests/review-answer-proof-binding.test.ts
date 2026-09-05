import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';
import { BUDGET_MAX } from '../src/engine/budget.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { serializeAnswer } from '../src/questions/serialize.js';
import { verifyBag } from '../tools/kb/bag.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const image = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('vendored bag is missing');
const bagFiles = verifyBag(readFileSync(join(ROOT, 'kb', archive))).files;
const combinedLines = payloadSource(bagFiles).source.split('\n');
const aceSentence = (document: string, sentence: number): string => {
  const path = [...bagFiles.keys()].find((name) => name.endsWith(`/ace/${document}.ace`));
  if (path === undefined) throw new Error(`${document}: ACE source is missing`);
  const value = Buffer.from(bagFiles.get(path) as Uint8Array)
    .toString('utf8')
    .trimEnd()
    .split('\n')[sentence - 1];
  if (value === undefined) throw new Error(`${document}: sentence ${String(sentence)} is missing`);
  return value;
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

  it('S2 keeps a negated recommendation modal in its proof and clause surfaces', async () => {
    const document = 'cdc2022-opioid-rec01';
    const sentence = 3;
    expect(aceSentence(document, sentence)).toContain('should not consider');

    const proofSession = new EngineSession({ loadImage, expected: manifest.contract });
    await proofSession.boot(image);
    const entry = QUESTION_CATALOG['when-to-use-opioids'];
    const solved = await proofSession.solve(entry.goal, BUDGET_MAX);
    if (solved.kind !== 'solutions') throw new Error(`expected solutions, got ${solved.kind}`);
    const selected = solved.solutions.find((solution) => {
      const answer = solution.bindings.Answer;
      return (
        answer?.kind === 'compound' &&
        answer.functor === 'clinical_answer' &&
        answer.args[0]?.kind === 'atom' &&
        answer.args[0].value === document
      );
    });
    if (selected === undefined) throw new Error(`${document}: answer is missing`);
    const proof = await proofSession.prove(
      { goal: entry.goal, selected: selected.display },
      BUDGET_MAX,
    );
    if (proof.kind !== 'proof') throw new Error(`expected a proof, got ${proof.kind}`);
    const step = proof.steps.find(
      (candidate) => candidate.document === document && candidate.sentence === sentence,
    );
    if (step === undefined)
      throw new Error(`${document}: sentence ${String(sentence)} has no step`);
    const clause = combinedLines[step.line - 1];
    if (clause === undefined) throw new Error(`${document}: proof line is absent`);

    expect(`${step.head}\n${clause}`).toMatch(/\bshould\b[\s\S]*\bnot\b[\s\S]*\bconsider\b/u);
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

  it('S4 maps every statement to only its producing live source rows', async () => {
    for (const id of QUESTION_IDS) {
      const entry = QUESTION_CATALOG[id];
      const result = await session.solve(entry.goal, BUDGET_MAX);
      if (result.kind !== 'solutions')
        throw new Error(`${id}: expected solutions, got ${result.kind}`);
      const rows = answerRows(id, result.solutions);
      const points = synthesizeAnswer(rows);

      for (const [source, row] of rows.entries()) {
        const solution = result.solutions[source];
        if (solution === undefined) throw new Error(`${id}: source ${String(source)} is absent`);
        const sourceTerm = solution.bindings.Source;
        const answerTerm = solution.bindings.Answer;
        if (
          sourceTerm?.kind !== 'compound' ||
          sourceTerm.functor !== '$guideline_id' ||
          sourceTerm.args[1]?.kind !== 'atom' ||
          answerTerm?.kind !== 'compound' ||
          answerTerm.functor !== 'clinical_answer' ||
          answerTerm.args[0]?.kind !== 'atom'
        ) {
          throw new Error(`${id}: source ${String(source)} has malformed provenance`);
        }
        expect(answerTerm.args[0].value).toBe(sourceTerm.args[1].value);
        expect(row.document).toBe(sourceTerm.args[1].value);
        for (const text of row.items ?? [row.label]) {
          expect(points.find((point) => point.text === text)?.sources).toContain(source);
        }
      }

      for (const point of points) {
        expect(point.sources.length).toBeGreaterThan(0);
        for (const source of point.sources) {
          const row = rows[source];
          expect(row).toBeDefined();
          expect(row?.items ?? [row?.label]).toContain(point.text);
        }
      }
    }
  });
});
