// M5 u4 acceptance — the live clinical proof, graded through the production RPC.
//
// Predicates B1-B7 and B9 from `.agent/contracts/m5u4.md`. Every case drives
// `EngineSession.prove` over the shipped image and grades the decoded steps against records
// parsed independently out of the build-time helper. No committed proof fixture is read.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PROOF_BUDGET_MAX, type ProofClause, type ProofStep } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';
import { PROOF_SOURCE } from '../tools/kb/proof.mjs';

import {
  artifacts,
  bagFiles,
  gateRecords,
  helperLines,
  parsePremiseRecords,
  ROOT,
} from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

const BOOT_TIMEOUT = 120_000;
const LIVE_TIMEOUT = 120_000;
const BUILD_TIMEOUT = 300_000;

let session: EngineSession;
/** A second, raw engine used only as an oracle; the session under test stays untouched. */
let oracle: Engine;
/** Every (question, document) selection, in shipped contribution order. */
const selections = CLINICAL_QUESTIONS.flatMap(({ id, sources }) =>
  sources.map(({ document }) => ({ id, document })),
);

/**
 * The goal the browser sends, constrained to one document.
 *
 * The constraint rides INSIDE the answer argument. A trailing `Answer = …` conjunct cannot
 * work: `resolve/3` whitelists the nine `guideline_*` predicates alone, so the interpreter
 * has no clause for `=`/2 and the conjunction fails before the proof is reached.
 */
const goalFor = (id: string, answer: string): string => `clinical_advice('${id}',_,${answer})`;

const flatten = (steps: readonly ProofStep[]): ProofStep[] =>
  steps.flatMap((step) => (step.kind === 'clause' ? [step, ...flatten(step.children)] : [step]));

const clausesOf = (steps: readonly ProofStep[]): ProofClause[] =>
  flatten(steps).filter((step): step is ProofClause => step.kind === 'clause');

/** Prove one document's answer through the production RPC, constraining the goal to it. */
const proveDocument = async (id: string, document: string): Promise<ProofStep[]> => {
  const constrainedGoal = goalFor(id, `clinical_answer('${document}',_,_)`);
  const result = await session.prove({ constrainedGoal }, PROOF_BUDGET_MAX);
  if (result.kind !== 'proof') throw new Error(`${id}/${document}: got ${result.kind}`);
  return result.steps;
};

beforeAll(async () => {
  const image = new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm')));
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
  oracle = await loadImage(image);
}, BOOT_TIMEOUT);

describe('live clinical proof', () => {
  it('B1 nothing precomputed survives: no advice_source record, no fabricated node builder', () => {
    expect(helperLines.filter((line) => line.startsWith('clinical_advice_source('))).toEqual([]);
    expect(artifacts.source).not.toContain('clinical_advice_source');
    expect(PROOF_SOURCE).not.toContain('advice_nodes');
    // The one arm that reaches a clinical answer hands its proof to the assembly clause.
    expect(PROOF_SOURCE).toContain(
      'derive(clinical_advice(Q,Source,Answer),_,_,P,proved) :- !, clinical_advice(Q,Source,Answer,P).',
    );
  });

  it(
    'B2/B4 every clause step cites a line from its own gate, and the union is the gate set',
    async () => {
      let graded = 0;
      for (const { id, document } of selections) {
        const steps = await proveDocument(id, document);
        const cited = new Set(
          gateRecords.filter((gate) => gate.document === document).flatMap(({ lines }) => lines),
        );
        expect(cited.size, document).toBeGreaterThan(0);
        const proven = clausesOf(steps);
        for (const step of proven)
          expect(cited.has(step.line), `${document}:${step.line}`).toBe(true);
        // Equality both ways: no cited line is skipped and no extra line is invented.
        expect(new Set(proven.map(({ line }) => line)), document).toEqual(cited);
        graded += 1;
      }
      expect(graded).toBe(12);
    },
    LIVE_TIMEOUT,
  );

  it(
    'B3 every clause step head unifies with the clause compiled at the line it names',
    async () => {
      // The engine itself decides this. The step head is ground and the compiled head keeps
      // its variables, so a text compare cannot settle it — `clause/3` unification can, and
      // it is the same lookup `resolve/3` performed to build the step.
      const linesUnifying = (head: string): number[] =>
        [
          ...oracle.prolog.query(
            'term_string(H,S), findall(L,(clause(H,_,R),' +
              "clause_property(R,file('/prolog.pl')),clause_property(R,line_count(L))),Ls)",
            { S: head },
          ),
        ].flatMap((row) => (row as { Ls?: unknown }).Ls as number[]);

      let graded = 0;
      for (const { id, document } of selections) {
        for (const step of clausesOf(await proveDocument(id, document))) {
          const lines = linesUnifying(step.head);
          expect(lines, `${document}: ${step.head}`).toContain(step.line);
          graded += 1;
        }
      }
      expect(graded).toBe(686);
    },
    LIVE_TIMEOUT,
  );

  it(
    'B6 assumption steps are exactly the document premises and carry no source line',
    async () => {
      const premises = parsePremiseRecords();
      let graded = 0;
      for (const { id, document } of selections) {
        const steps = flatten(await proveDocument(id, document));
        const assumed = steps.filter((step) => step.kind === 'assumption');
        expect(assumed.length, document).toBeGreaterThan(0);
        for (const step of assumed) expect(step).not.toHaveProperty('line');
        // The premise literals are skolemized per sentence, so grade the predicate shape
        // set: every assumed literal must be one this document actually declares.
        const declared = new Set(
          premises
            .filter((premise) => premise.document === document)
            .map(({ literal }) => `${literal.slice(0, literal.indexOf('('))}`),
        );
        for (const step of assumed) {
          expect(declared.has(step.predicate.split('/')[0] as string), step.predicate).toBe(true);
        }
        graded += assumed.length;
      }
      expect(graded).toBe(3930);
    },
    LIVE_TIMEOUT,
  );

  it(
    'B7 a wrong answer term yields no proof, so the proof is not fabricated from the answer',
    async () => {
      const first = selections[0];
      if (first === undefined) throw new Error('no clinical selection');
      const result = await session.prove(
        { constrainedGoal: goalFor(first.id, `clinical_answer('${first.document}',[],"")`) },
        PROOF_BUDGET_MAX,
      );
      expect(result.kind).toBe('failure');
    },
    LIVE_TIMEOUT,
  );

  it(
    'B5 erasing a cited clause line removes the proof it was cited by',
    async () => {
      const victim = gateRecords[0];
      if (victim === undefined) throw new Error('no gate records');
      const line = victim.lines[0];
      if (line === undefined) throw new Error('gate cites no line');
      const selection = selections.find(({ document }) => document === victim.document);
      if (selection === undefined) throw new Error(`no selection for ${victim.document}`);

      // Erase the cited clause at its own line, keeping every other line in place so the
      // gate's line list still points where it always did.
      const source = payloadSource(bagFiles).source.split('\n');
      const original = source[line - 1];
      expect(original, `line ${String(line)}`).toMatch(/^guideline_/u);
      source[line - 1] = `% erased:${original as string}`;
      const mutated = new EngineSession({ loadImage, expected: manifest.contract });
      await mutated.boot((await buildImage(source.join('\n'))).image);

      const goal = goalFor(selection.id, `clinical_answer('${victim.document}',_,_)`);
      // Positive control on the SAME goal and the SAME session shape: the erasure is what
      // moves the outcome, not the mutated-image path itself.
      expect((await session.prove({ constrainedGoal: goal }, PROOF_BUDGET_MAX)).kind).toBe('proof');
      const result = await mutated.prove({ constrainedGoal: goal }, PROOF_BUDGET_MAX);
      expect(result.kind).toBe('failure');
    },
    BUILD_TIMEOUT,
  );

  it(
    'B9 every selected proof settles inside the shipped proof budget',
    async () => {
      for (const { id, document } of selections) {
        const started = Date.now();
        const steps = await proveDocument(id, document);
        const elapsed = Date.now() - started;
        expect(steps.length, document).toBeGreaterThan(0);
        expect(elapsed, `${document} took ${String(elapsed)} ms`).toBeLessThan(
          PROOF_BUDGET_MAX.wallClockMs,
        );
      }
    },
    LIVE_TIMEOUT,
  );
});
