// Selected-solution proof RPC against the real generated image.
//
// No committed trace is read here: the differential is live plain execution
// versus the compiled meta-interpreter, followed by cap-one re-proofs of the
// selected canonical bindings.

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import {
  PROOF_BUDGET_MAX,
  type BudgetSpec,
  type EngineRequest,
  type PlSolution,
  type ProofStep,
} from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS, type CatalogEntry } from '../src/questions/catalog.js';
import { verifyBag } from '../tools/kb/bag.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

const queryBudget: BudgetSpec = {
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 100_000,
};
const proofBudget: BudgetSpec = { ...PROOF_BUDGET_MAX };
const LIVE_TEST_TIMEOUT = 60_000;

const solved = async (goal: string): Promise<PlSolution[]> => {
  const result = await session.solve(goal, queryBudget);
  if (result.kind !== 'solutions') throw new Error(`expected solutions, got ${result.kind}`);
  return result.solutions;
};

const projectionKey = (entry: CatalogEntry, solution: PlSolution): string =>
  entry.projection.map(({ variable }) => solution.display[variable] ?? '<missing>').join('\u0000');

const selectionOf = (entry: CatalogEntry, solution: PlSolution): Readonly<Record<string, string>> =>
  Object.fromEntries(
    entry.projection.map(({ variable }) => {
      const value = solution.display[variable];
      if (value === undefined) throw new Error(`${entry.id} omitted projected ${variable}`);
      return [variable, value];
    }),
  );

const flatten = (steps: readonly ProofStep[]): ProofStep[] =>
  steps.flatMap((step) => [step, ...flatten(step.children)]);

let image: Uint8Array;
let session: EngineSession;
let combinedLines: string[];

beforeAll(async () => {
  image = new Uint8Array(readGenerated('kb.pvm'));
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);

  const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
  if (archive === undefined) throw new Error('vendored bag is missing');
  const { files } = verifyBag(readFileSync(join(ROOT, 'kb', archive)));
  combinedLines = payloadSource(files).source.split('\n');
}, 120_000);

describe('compiled proof interpreter', () => {
  it.each(QUESTION_IDS)(
    '%s has the same live solution multiset as plain execution',
    async (id) => {
      const entry = QUESTION_CATALOG[id];
      const plain = await solved(entry.goal);
      const derived = await solved(`mi((${entry.goal}),1,_).`);
      expect(derived.map((solution) => projectionKey(entry, solution)).sort()).toEqual(
        plain.map((solution) => projectionKey(entry, solution)).sort(),
      );
    },
    LIVE_TEST_TIMEOUT,
  );

  it.each(QUESTION_IDS)(
    '%s re-proves every selected answer at cap one',
    async (id) => {
      const entry = QUESTION_CATALOG[id];
      const plain = await solved(entry.goal);
      const selections = new Map<string, Readonly<Record<string, string>>>();
      if (entry.projection.length === 0) selections.set('existence', {});
      for (const solution of plain) {
        selections.set(projectionKey(entry, solution), selectionOf(entry, solution));
      }

      for (const selected of selections.values()) {
        const result = await session.prove({ goal: entry.goal, selected }, proofBudget);
        expect(result.kind).toBe('proof');
        if (result.kind !== 'proof') continue;
        const steps = flatten(result.steps);
        expect(steps.length).toBeGreaterThan(0);
        expect(steps.some((step) => step.document !== undefined)).toBe(true);
        for (const step of steps) {
          expect(step.line).toBeGreaterThan(0);
          expect(step.head).toMatch(/^guideline_/u);
          const predicate = step.predicate.split('/')[0] as string;
          expect(combinedLines[step.line - 1]).toMatch(new RegExp(`^${predicate}\\(`, 'u'));
        }
      }
    },
    LIVE_TEST_TIMEOUT,
  );
});

describe('selected constraint and typed RPC', () => {
  it(
    'binds the selected canonical row rather than returning the first proof',
    async () => {
      const entry = QUESTION_CATALOG['category-a-recommendations'];
      const plain = await solved(entry.goal);
      const second = plain[1];
      if (second === undefined) throw new Error('category A yielded fewer than two rows');
      const selected = selectionOf(entry, second);
      const result = await session.prove({ goal: entry.goal, selected }, proofBudget);
      expect(result.kind).toBe('proof');
      if (result.kind !== 'proof') return;
      expect(
        flatten(result.steps)
          .map((step) => step.head)
          .join('\n'),
      ).toContain(second.display.A);

      const absent = await session.prove(
        {
          goal: entry.goal,
          selected: { A: "'$guideline_id'(context,'m2-absent',1,ref(1),[])" },
        },
        proofBudget,
      );
      expect(absent).toEqual({ kind: 'failure' });
    },
    LIVE_TEST_TIMEOUT,
  );

  it('accepts a fully constructed constrained goal and preserves line metadata', async () => {
    const result = await session.prove(
      { constrainedGoal: 'guideline_schema_version(1).' },
      proofBudget,
    );
    expect(result).toMatchObject({
      kind: 'proof',
      steps: [{ predicate: 'guideline_schema_version/1' }],
    });
  });

  it('surfaces a proof budget trip as a typed limit', async () => {
    const result = await session.prove(
      { constrainedGoal: 'guideline_schema_version(1).' },
      { ...proofBudget, inferences: 1 },
    );
    expect(result).toEqual({ kind: 'limit', limit: 'inference' });
  });

  it('crosses EngineClient as plain structured data', async () => {
    const seen: EngineRequest[] = [];
    class LiveWorker {
      readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

      addEventListener(type: string, listener: (event: unknown) => void): void {
        this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
      }

      postMessage(request: EngineRequest): void {
        seen.push(request);
        setTimeout(() => {
          void session.handle(request, image).then((response) => {
            for (const listener of this.#listeners.get('message') ?? [])
              listener({ data: response });
          });
        }, 0);
      }

      terminate(): void {}
    }

    const client = new EngineClient({ spawn: () => new LiveWorker() as unknown as Worker });
    try {
      expect(await client.boot()).toMatchObject({ kind: 'booted' });
      const entry = QUESTION_CATALOG['dosage-reduction-content'];
      const answer = await client.query(entry.goal, queryBudget);
      if (answer.kind !== 'solutions' || answer.solutions[0] === undefined) {
        throw new Error(`expected a solution, got ${answer.kind}`);
      }
      const result = await client.prove(
        { goal: entry.goal, selected: answer.solutions[0].display },
        BUDGET_MAX,
      );
      expect(result.kind).toBe('proof');
      if (result.kind === 'proof') {
        expect(flatten(result.steps).length).toBeGreaterThan(0);
        expect(structuredClone(result)).toEqual(result);
      }
      const proofRequest = seen.find((request) => request.kind === 'proof');
      expect(proofRequest).toMatchObject({ budget: PROOF_BUDGET_MAX });

      const controller = new AbortController();
      const cancelling = client.prove(
        { constrainedGoal: 'guideline_schema_version(1).' },
        proofBudget,
        controller.signal,
      );
      controller.abort();
      await expect(cancelling).resolves.toEqual({ kind: 'cancelled' });
    } finally {
      client.dispose();
    }
  });

  it('settles an already-aborted proof without spawning a worker', async () => {
    let spawns = 0;
    const client = new EngineClient({
      spawn: () => {
        spawns += 1;
        throw new Error('an aborted proof must not spawn');
      },
    });
    const controller = new AbortController();
    controller.abort();
    try {
      await expect(
        client.prove(
          { constrainedGoal: 'guideline_schema_version(1).' },
          proofBudget,
          controller.signal,
        ),
      ).resolves.toEqual({ kind: 'cancelled' });
      expect(spawns).toBe(0);
    } finally {
      client.dispose();
    }
  });
});
