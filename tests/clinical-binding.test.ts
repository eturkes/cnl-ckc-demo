// M5 u7 acceptance — the `guideline_*` perturbation battery.
//
// Predicates E1-E3 from `.agent/contracts/m5u7.md`, closing review row C3: the only overlay
// this project had mutated `clinical_advice/3`, the very predicate the goal queries, and
// asserted nothing about the line-keyed proof. Each case here perturbs a SCHEMA predicate and
// requires the derived answer, its proof, or both to follow.
//
// Every mutant is compiled: the shipped image declares its schema static, so an overlay that
// asserts at run time is refused (`clinical-answer-live` A5). Building the mutant is also
// what keeps the perturbation honest — a compiled clause is the same kind of clause the
// corpus ships, not a dynamic one the derivation could treat differently.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PROOF_BUDGET_MAX, type ProofStep } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { proofClauses } from '../src/provenance/model.js';
import { CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { exportedQueries, statementGoal } from '../tools/kb/exports.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';

import { bagFiles, gateRecords, ROOT } from './clinical-test-support.js';

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
const BUILD_TIMEOUT = 300_000;

/** A marker no corpus document can carry, so a solution naming it came from the overlay. */
const MARKER = `u7-overlay-${String(process.pid)}`;
const base = payloadSource(bagFiles).source;
const selections = CLINICAL_QUESTIONS.flatMap(({ id, sources }) =>
  sources.map(({ document }) => ({ id, document })),
);

let session: EngineSession;
let engine: Engine;

/** Every document whose answer derives on `target`, in solution order. */
const derivedDocuments = (target: Engine): string[] =>
  [...target.prolog.query('clinical_advice(_,_,clinical_answer(Doc,_,_))')].map((row) =>
    String((row as Record<string, unknown>).Doc),
  );

/** Every derived answer term, rendered canonically by the engine itself. */
const derivedAnswers = (target: Engine): string[] =>
  [...target.prolog.query('clinical_advice(_,_,A), with_output_to(string(T), writeq(A))')].map(
    (row) => String((row as Record<string, unknown>).T),
  );

/** The exported answer statement, live on `target`. */
const exportedStatement = (target: Engine, id: string): string => {
  const query = exportedQueries(bagFiles).find((entry) => entry.id === id);
  if (query === undefined) throw new Error(`${id} is not a declared export`);
  const rows = [...target.prolog.query(statementGoal(query))] as Record<string, unknown>[];
  if (rows.length !== 1) throw new Error(`${id}: the lane goal is not deterministic`);
  return String(rows[0]?.LaneText);
};

const proveOn = async (
  target: EngineSession,
  id: string,
  document: string,
): Promise<{ kind: string; steps: ProofStep[] }> => {
  const constrainedGoal = `clinical_advice('${id}',_,clinical_answer('${document}',_,_))`;
  const result = await target.prove({ constrainedGoal }, PROOF_BUDGET_MAX);
  return { kind: result.kind, steps: result.kind === 'proof' ? result.steps : [] };
};

const proofLines = (steps: readonly ProofStep[]): number[] =>
  proofClauses(steps)
    .map((step) => step.line)
    .sort((a, b) => a - b);

beforeAll(async () => {
  const image = new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm')));
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
  engine = await loadImage(image);
}, BOOT_TIMEOUT);

describe('guideline_* perturbation', () => {
  it(
    'E1 an additive schema overlay adds its own solution to a live exported answer',
    async () => {
      // The M1 recipe: the category-A goal is a seven-way join, so one fact cannot move it.
      // The overlay supplies a whole new proof across four schema predicates.
      const id = (n: number): string =>
        `'$guideline_id'(product,'${MARKER}',${String(n)},ref(1),[])`;
      const overlay =
        `guideline_entity(actual,${id(1)},recommendation,countable).\n` +
        `guideline_cardinality(actual,${id(1)},na,eq,1).\n` +
        `guideline_entity(actual,${id(2)},'category-A-recommendation',countable).\n` +
        `guideline_cardinality(actual,${id(2)},na,eq,1).\n` +
        `guideline_event(actual,${id(3)},be).\n` +
        `guideline_arg(actual,${id(3)},1,${id(1)}).\n` +
        `guideline_arg(actual,${id(3)},2,${id(2)}).\n`;

      const before = exportedStatement(engine, 'category-a-recommendations');
      expect(before).not.toContain(MARKER);

      // Appended, so no cited line moves; every schema predicate ships `discontiguous`.
      const mutated = await loadImage((await buildImage(`${base}\n${overlay}`)).image);
      const after = exportedStatement(mutated, 'category-a-recommendations');
      expect(after).not.toBe(before);
      expect(after).toContain(MARKER);
      // The overlay is additive: it adds a solution rather than replacing the corpus answer.
      expect(before.split('sol(').length).toBe(after.split('sol(').length - 1);
    },
    BUILD_TIMEOUT,
  );

  it(
    'E2 erasing one cited clause drops that document and its proof, and nothing else',
    async () => {
      const victim = gateRecords[0];
      const line = victim?.lines[0];
      if (victim === undefined || line === undefined) throw new Error('no cited gate line');
      const selection = selections.find(({ document }) => document === victim.document);
      if (selection === undefined) throw new Error(`no selection for ${victim.document}`);

      // Erased in place, so every other gate's line list still points where it did.
      const lines = base.split('\n');
      expect(lines[line - 1], `line ${String(line)}`).toMatch(/^guideline_/u);
      lines[line - 1] = `% erased:${String(lines[line - 1])}`;
      const image = (await buildImage(lines.join('\n'))).image;

      const raw = await loadImage(image);
      expect(derivedDocuments(engine)).toContain(victim.document);
      expect(derivedDocuments(raw)).toEqual(
        derivedDocuments(engine).filter((document) => document !== victim.document),
      );

      const mutated = new EngineSession({ loadImage, expected: manifest.contract });
      await mutated.boot(image);
      // Positive control on the same goal and the same session shape: the erasure moves the
      // outcome, not the mutated-image path.
      expect((await proveOn(session, selection.id, victim.document)).kind).toBe('proof');
      expect((await proveOn(mutated, selection.id, victim.document)).kind).toBe('failure');
    },
    BUILD_TIMEOUT,
  );

  it(
    'E3 shifting the compiled source moves every proof line and leaves the answers identical',
    async () => {
      // Every clause keeps its text and its order; only its LINE changes. A proof that
      // reported stored coordinates rather than the compiled ones would not notice.
      const marker = '% u7-line-shift';
      const first = [...bagFiles.keys()]
        .filter((name) => /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/u.test(name))
        .sort()[0];
      if (first === undefined) throw new Error('the bag carries no payload documents');
      const shifted = new Map(bagFiles).set(
        first,
        Buffer.from(`${marker}\n${Buffer.from(bagFiles.get(first) ?? []).toString('utf8')}`),
      );
      const source = payloadSource(shifted).source;
      expect(source.split('\n').length).toBe(base.split('\n').length + 1);

      const image = (await buildImage(source)).image;
      const raw = await loadImage(image);
      expect(derivedAnswers(raw)).toEqual(derivedAnswers(engine));

      const mutated = new EngineSession({ loadImage, expected: manifest.contract });
      await mutated.boot(image);
      let graded = 0;
      for (const { id, document } of selections) {
        const before = await proveOn(session, id, document);
        const after = await proveOn(mutated, id, document);
        expect(after.kind, document).toBe('proof');
        const cited = proofLines(before.steps);
        expect(cited.length, document).toBeGreaterThan(0);
        expect(proofLines(after.steps), document).toEqual(cited.map((value) => value + 1));
        graded += 1;
      }
      expect(graded).toBe(selections.length);
    },
    BUILD_TIMEOUT,
  );
});
