// TEMPORARY evaluation probe — not committed.
// Does the displayed answer depend on the compiled guideline knowledge base?
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const read = (n: string): Buffer => readFileSync(join(GENERATED, n));
const manifest = JSON.parse(read('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const diagnostics: string[] = [];
const loadImage: ImageLoader = async (image) => {
  const f = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((i: Uint8Array) => (o?: Record<string, unknown>) => Promise<Engine>)
    | { default: (i: Uint8Array) => (o?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof f === 'function' ? f : f.default;
  return load(image)({ printErr: (line: string) => diagnostics.push(line) });
};

describe('probe3', () => {
  it(
    'answer survives deletion of the guideline clauses it cites',
    async () => {
      const session = new EngineSession({
        loadImage,
        expected: manifest.contract,
        drain: () => diagnostics.splice(0),
      });
      await session.boot(new Uint8Array(read('kb.pvm')));
      const id = QUESTION_IDS[0];
      const entry = QUESTION_CATALOG[id];

      const runAnswer = async (): Promise<string> => {
        const r = await session.solve(entry.goal, BUDGET_MAX);
        if (r.kind !== 'solutions') return `<${r.kind}>`;
        return synthesizeAnswer(answerRows(id, r.solutions))
          .map((p) => `${p.text} [${p.sources.join(',')}]`)
          .join('\n');
      };

      const before = await runAnswer();
      console.log('=== ANSWER BEFORE ===\n' + before);

      // Make the guideline schema predicates mutable, then delete every clause
      // belonging to the two documents this question cites.
      const decl = [
        'guideline_entity/4',
        'guideline_event/3',
        'guideline_arg/4',
        'guideline_pp/4',
        'guideline_cardinality/5',
        'guideline_operator/3',
        'guideline_property/4',
      ]
        .map((p) => `:- dynamic(${p}).`)
        .join('\n');
      session.consult(`${decl}\n`);

      const wipe = async (goal: string): Promise<void> => {
        const r = await session.solve(goal, BUDGET_MAX);
        console.log(`  ${goal.slice(0, 60)} -> ${r.kind}`);
      };
      for (const doc of ['cdc2022-opioid-rec01', 'cdc2022-opioid-rec02']) {
        await wipe(
          `forall((clause(guideline_entity(A,B,C,D),Bd),sub_term('${doc}',A-B)),retract((guideline_entity(A,B,C,D):-Bd)))`,
        );
      }
      // Blunter: drop every clause of every schema predicate outright.
      for (const [name, arity] of [
        ['guideline_entity', 4],
        ['guideline_event', 3],
        ['guideline_arg', 4],
        ['guideline_pp', 4],
        ['guideline_cardinality', 5],
        ['guideline_operator', 3],
        ['guideline_property', 4],
      ] as const) {
        const args = Array.from({ length: arity }, (_, i) => `A${String(i)}`).join(',');
        await wipe(`retractall(${name}(${args}))`);
      }
      const remaining = await session.solve(
        'findall(1,guideline_entity(_,_,_,_),L),length(L,N).',
        BUDGET_MAX,
      );
      console.log(
        'guideline_entity/4 clauses remaining =',
        remaining.kind === 'solutions' ? remaining.solutions[0]?.display.N : remaining.kind,
      );

      const after = await runAnswer();
      console.log('=== ANSWER AFTER WIPING THE KNOWLEDGE BASE ===\n' + after);
      console.log('IDENTICAL =', before === after);
      expect(true).toBe(true);
    },
    300_000,
  );
});
