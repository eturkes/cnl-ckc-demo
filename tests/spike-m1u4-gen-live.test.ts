import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import type { Engine } from '../src/engine/session';
import { EngineSession, type ImageLoader } from '../src/engine/session';
import type { BudgetSpec } from '../src/engine/protocol';
import {
  firstByteDiff,
  parseAnswerArtifact,
  serializeAnswers,
} from '../tools/spikes/m1u4-gen/answers.mjs';
import { compileCatalog, ROOT } from '../tools/spikes/m1u4-gen/catalog.mjs';

const require = createRequire(import.meta.url);
const GENERATED = join(ROOT, 'kb', 'generated');
const RUNS = 5;
const BUDGET: BudgetSpec = {
  stackBytes: 67_108_864,
  depth: 100_000,
  inferences: 10_000_000,
  wallClockMs: 10_000,
  answerCap: 1_000,
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

const median = (samples: number[]) => {
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = sorted[Math.floor(sorted.length / 2)];
  if (middle === undefined) throw new Error('median needs at least one sample');
  return Number(middle.toFixed(3));
};

it('runs and serializes the six generated catalog goals through EngineSession', async () => {
  const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
    contract: { schemaVersion: number; documents: number };
  };
  const session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))));
  const compiled = compileCatalog();
  const samples: Record<string, number[]> = Object.fromEntries(
    compiled.records.map(({ id }) => [id, []]),
  );
  const solved = new Map<string, Awaited<ReturnType<EngineSession['solve']>>>();

  for (let run = 0; run < RUNS; run += 1) {
    for (const record of compiled.records) {
      const recordSamples = samples[record.id];
      if (recordSamples === undefined) throw new Error(`${record.id} has no timing bucket`);
      const started = performance.now();
      const result = await session.solve(record.goal, BUDGET, `${record.id}-${run}`);
      recordSamples.push(performance.now() - started);
      expect(result.kind).toBe('solutions');
      const previous = solved.get(record.id);
      if (previous?.kind === 'solutions' && result.kind === 'solutions') {
        expect(result.solutions.length).toBe(previous.solutions.length);
      }
      solved.set(record.id, result);
    }
  }

  const results = Object.fromEntries(
    compiled.records.map(({ id }) => {
      const result = solved.get(id);
      const idSamples = samples[id];
      if (result?.kind !== 'solutions') throw new Error(`${id} did not return solutions`);
      if (idSamples === undefined) throw new Error(`${id} has no timing samples`);
      return [
        id,
        {
          solutions: result.solutions.length,
          medianWallClockMs: median(idSamples),
          samplesMs: idSamples.map((sample) => Number(sample.toFixed(3))),
          outcome: result.kind,
        },
      ];
    }),
  );

  const comparisons: Record<
    string,
    {
      byteEqual: boolean;
      valueEqual: boolean;
      rawOrderMatchesCommitted: boolean;
      sortChanged: boolean;
      rawRows: number;
      projectedRows: number;
      duplicateRows: number;
      expectedBytes: number;
      generatedBytes: number;
      diff: string;
    }
  > = {};
  for (const record of compiled.records) {
    const querySha256 = compiled.querySha256[record.id];
    if (querySha256 === undefined) continue;
    const result = solved.get(record.id);
    if (result === undefined) throw new Error(`${record.id} has no live result`);
    const generated = serializeAnswers(record, result, querySha256);
    const path = `data/guidelines/cdc-2022-opioid/queries/answers/${record.id}.pl`;
    const member = compiled.files.get(path);
    if (member === undefined) throw new Error(`bag lacks ${path}`);
    const expectedBytes = Buffer.from(member);
    const actualBytes = Buffer.from(generated.bytes);
    const expected = parseAnswerArtifact(expectedBytes.toString('utf8'), path);
    expect(expected.id).toBe(record.id);
    expect(expected.querySha256).toBe(querySha256);
    comparisons[record.id] = {
      byteEqual: expectedBytes.equals(actualBytes),
      valueEqual: expected.resultText === generated.resultText,
      rawOrderMatchesCommitted: expected.resultText === generated.rawResultText,
      sortChanged: generated.sortChanged,
      rawRows: generated.rawRows,
      projectedRows: generated.projectedRows,
      duplicateRows: generated.duplicateRows,
      expectedBytes: expectedBytes.length,
      generatedBytes: actualBytes.length,
      diff: firstByteDiff(expectedBytes, actualBytes),
    };
  }

  const categoryA = compiled.records.find(({ id }) => id === 'category-a-recommendations');
  const categoryABefore = solved.get('category-a-recommendations');
  const categoryB = solved.get('category-b-recommendations');
  const overlayEntity =
    categoryB?.kind === 'solutions' ? categoryB.solutions[0]?.display.B : undefined;
  const categoryAHash = compiled.querySha256['category-a-recommendations'];
  if (
    categoryA === undefined ||
    categoryABefore === undefined ||
    overlayEntity === undefined ||
    categoryAHash === undefined
  ) {
    throw new Error('overlay probe lacks a category record, digest, or binding');
  }
  const overlayGoal =
    `dynamic(guideline_entity/4),` +
    `assertz(guideline_entity(actual,${overlayEntity},'category-A-recommendation',countable))`;
  const injected = await session.solve(overlayGoal, BUDGET, 'overlay-inject');
  expect(injected.kind).toBe('solutions');
  const categoryAAfter = await session.solve(categoryA.goal, BUDGET, 'overlay-observe');
  expect(categoryAAfter.kind).toBe('solutions');
  const beforeDisplay = serializeAnswers(categoryA, categoryABefore, categoryAHash).resultText;
  const afterDisplay = serializeAnswers(categoryA, categoryAAfter, categoryAHash).resultText;
  const beforeValues = new Set(
    categoryABefore.kind === 'solutions'
      ? categoryABefore.solutions.map(({ display }) => display.A)
      : [],
  );
  const addedDisplays =
    categoryAAfter.kind === 'solutions'
      ? categoryAAfter.solutions
          .map(({ display }) => display.A)
          .filter((display) => !beforeValues.has(display))
      : [];
  const overlay = {
    goal: overlayGoal,
    beforeSolutions: categoryABefore.kind === 'solutions' ? categoryABefore.solutions.length : 0,
    afterSolutions: categoryAAfter.kind === 'solutions' ? categoryAAfter.solutions.length : 0,
    displayedResultChanged: beforeDisplay !== afterDisplay,
    addedDisplays,
  };
  expect(overlay.displayedResultChanged).toBe(true);

  process.stdout.write(
    `GEN_LIVE ${JSON.stringify({ runs: RUNS, budget: BUDGET, results, comparisons, overlay })}\n`,
  );
}, 60_000);
