// M5 u3 acceptance — the runtime `clinical_advice/3` derivation, against the real image.
//
// Predicates A1-A6 from `.agent/contracts/m5u3.md`. Every case runs the shipped goal on a
// loaded PVM and grades it against u1's build-time oracle; none imports an answer fixture.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';
import { CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';

import { artifacts, bagFiles, helperLines, ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;

const BOOT_TIMEOUT = 120_000;
const BUILD_TIMEOUT = 300_000;

let engine: Engine;

const solutions = (target: Engine, goal: string): Record<string, unknown>[] =>
  [...target.prolog.query(goal)] as Record<string, unknown>[];

/** Documents whose answer derives on `target`, in solution order. */
const derivedDocuments = (target: Engine): string[] =>
  solutions(target, 'clinical_advice(_,_,clinical_answer(Doc,_,_))').map(({ Doc }) => String(Doc));

beforeAll(async () => {
  engine = await load(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))))({
    arguments: ['-q'],
  });
}, BOOT_TIMEOUT);

describe('runtime clinical answers', () => {
  it('A1 twelve answers derive from the shipped goal', () => {
    expect(derivedDocuments(engine)).toEqual(
      CLINICAL_QUESTIONS.flatMap(({ sources }) => sources.map(({ document }) => document)),
    );
  });

  it('A2/A3 every derived answer and source id is term-identical to u1 oracle', () => {
    // `==` inside Prolog, not a rendered-string compare: the grading must not depend on how
    // either side writes a term.
    let graded = 0;
    for (const question of CLINICAL_QUESTIONS) {
      const statements = artifacts.answers.get(question.id) ?? [];
      expect(statements, question.id).toHaveLength(question.sources.length);
      for (const [index, selection] of question.sources.entries()) {
        const statement = statements[index] as string;
        const first = helperLines.find((line) =>
          line.startsWith(`clinical_source('${question.id}','${selection.document}',`),
        );
        expect(first, `${question.id}/${selection.document}`).toBeDefined();
        const sentence = /,(\d+)\)\.$/u.exec(first as string)?.[1];
        expect(sentence, `${question.id}/${selection.document}`).toBeDefined();
        const sourceId =
          `'$guideline_id'(product,'${selection.document}',` + `${sentence as string},ref(1),[])`;
        const matched = solutions(
          engine,
          `clinical_advice('${question.id}',S,A), S == ${sourceId}, A == (${statement}), !`,
        );
        expect(matched, `${question.id}/${selection.document}`).toHaveLength(1);
        graded += 1;
      }
    }
    expect(graded).toBe(12);
  });

  it('A4 the payload carries no clinical_advice fact, only the derivation rule', () => {
    const clauses = helperLines.filter((line) => line.startsWith('clinical_advice('));
    expect(clauses).toHaveLength(1);
    expect(clauses[0]).toContain(':- clinical_source(');
    expect(clauses[0]).toContain('findall(R,clinical_derive(Doc,_,R,_),Rules)');
  });

  it('A5 clinical_advice/3 is static, so no assertz can fabricate an answer', () => {
    // The refusal is read from `catch/3` INSIDE Prolog: a permission error prints to real
    // stderr rather than surfacing as `$error`, so a JS-side catch sees a normal return.
    const [outcome] = solutions(
      engine,
      'catch(assertz(clinical_advice(q,s,a)),error(E,_),true), ' +
        'with_output_to(string(Refusal),write_canonical(E))',
    );
    expect(String(outcome?.Refusal)).toBe(
      'permission_error(modify,static_procedure,/(clinical_advice,3))',
    );
  });

  it(
    'A6 withholding one document premises drops exactly that answer',
    async () => {
      // The control's grain is the DOCUMENT: erase a document's premises and its universal
      // no longer applies, so its whole answer stops deriving while the other eleven hold.
      const [victim] = CLINICAL_QUESTIONS.flatMap(({ sources }) =>
        sources.map(({ document }) => document),
      );
      expect(victim).toBeDefined();
      const withheld = artifacts.helper
        .split('\n')
        .filter((line) => !line.startsWith(`clinical_premise('${victim as string}',`))
        .join('\n');
      expect(withheld.length).toBeLessThan(artifacts.helper.length);

      const source = payloadSource(bagFiles).source.replace(artifacts.helper, withheld);
      expect(source).not.toBe(payloadSource(bagFiles).source);
      const mutated = await load((await buildImage(source)).image)({ arguments: ['-q'] });

      const documents = derivedDocuments(mutated);
      expect(documents).not.toContain(victim);
      expect(documents).toHaveLength(11);
    },
    BUILD_TIMEOUT,
  );
});
