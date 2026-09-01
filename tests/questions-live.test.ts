// Live contract for the question catalog and the answer service.
//
// Every answer here comes out of the real saved image. The committed oracle is
// read from the vendored bag at test time, never transcribed, and an injected
// overlay proves the displayed result tracks the engine rather than a fixture.

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import type { PlTerm } from '../src/engine/terms.js';
import {
  QUESTION_CATALOG,
  QUESTION_IDS,
  isQuestionId,
  type QuestionId,
} from '../src/questions/catalog.js';
import { humanizeGuidelineId } from '../src/questions/humanize.js';
import { compareTerms, serializeAnswer } from '../src/questions/serialize.js';
import { verifyBag } from '../tools/kb/bag.mjs';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const BOOT_TIMEOUT = 120_000;

/** Fails rather than skips when the payload is missing; `pnpm kb:build` produces it. */
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));

const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

/** The overlay probe consults at runtime, and a consult without a diagnostic sink is refused. */
const diagnostics: string[] = [];
const drain = (): string[] => diagnostics.splice(0);

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({ printErr: (line: string) => diagnostics.push(line) });
};

/** Committed answers read straight out of the bag, so no expectation is a transcription. */
const bagFiles = ((): Map<string, Uint8Array> => {
  const kb = join(ROOT, 'kb');
  const archive = readdirSync(kb).filter((name) => name.endsWith('.tar.gz'))[0] as string;
  return verifyBag(readFileSync(join(kb, archive))).files;
})();

const committedResult = (id: string): string => {
  const path = [...bagFiles.keys()].find((name) => name.endsWith(`/answers/${id}.pl`));
  const text = Buffer.from(bagFiles.get(path as string) as Uint8Array).toString('utf8');
  // `result(` opens the recorded answer; its balanced argument is what a live run reproduces.
  const open = text.indexOf('result(') + 'result('.length;
  let depth = 1;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(open, i);
    }
  }
  throw new Error(`${id}: no balanced result/1 term`);
};

let session: EngineSession;
const answers = new Map<QuestionId, PlSolution[]>();
const atom = (value: string): PlTerm => ({ kind: 'atom', value });

const run = async (id: QuestionId): Promise<PlSolution[]> => {
  const result = await session.solve(QUESTION_CATALOG[id].goal, BUDGET_MAX, id);
  if (result.kind !== 'solutions' && result.kind !== 'failure') {
    throw new Error(`${id}: ${result.kind}`);
  }
  return result.kind === 'solutions' ? result.solutions : [];
};

beforeAll(async () => {
  session = new EngineSession({ loadImage, drain, expected: manifest.contract });
  await session.boot(new Uint8Array(readGenerated('kb.pvm')));
  for (const id of QUESTION_IDS) answers.set(id, await run(id));
}, BOOT_TIMEOUT);

describe('question catalog', () => {
  it('holds exactly the six declared ids, each with a compiled goal', () => {
    expect(QUESTION_IDS).toHaveLength(6);
    expect(Object.keys(QUESTION_CATALOG).sort()).toEqual([...QUESTION_IDS].sort());
    for (const id of QUESTION_IDS) {
      const entry = QUESTION_CATALOG[id];
      expect(entry.goal, id).not.toBe('');
      expect(entry.question, id).not.toBe('');
    }
  });

  it('carries each entry the bag exported byte for byte', () => {
    for (const id of QUESTION_IDS) {
      const entry = QUESTION_CATALOG[id];
      if (entry.provenance !== 'bag-exported') continue;
      const path = [...bagFiles.keys()].find((name) =>
        name.endsWith(`/queries/pl/${id}.pl`),
      ) as string;
      const source = Buffer.from(bagFiles.get(path) as Uint8Array).toString('utf8');
      expect(source, id).toContain(entry.goal);
    }
  });

  it('derives each repo-authored goal from an exported analog by one atom', () => {
    const authored = QUESTION_IDS.filter(
      (id) => QUESTION_CATALOG[id].provenance === 'repo-authored',
    );
    expect(authored).toEqual(['category-b-recommendations', 'evidence-type-3-recommendation']);
    expect(QUESTION_CATALOG['category-b-recommendations'].goal).toBe(
      QUESTION_CATALOG['category-a-recommendations'].goal.replace(
        "'category-A-recommendation'",
        "'category-B-recommendation'",
      ),
    );
    expect(QUESTION_CATALOG['evidence-type-3-recommendation'].goal).toBe(
      QUESTION_CATALOG['evidence-type-1-recommendation'].goal.replace(
        "'evidence-type-1-recommendation'",
        "'evidence-type-3-recommendation'",
      ),
    );
  });

  it('rejects every input that is not one of the six ids', () => {
    const rejected: unknown[] = [
      'Which recommendation is a category-A-recommendation?',
      'true',
      'guideline_entity(actual,A,recommendation,countable)',
      'Category-A-Recommendations',
      'category-a-recommendations.',
      '',
      ' ',
      '__proto__',
      'constructor',
      'toString',
      42,
      null,
      undefined,
      {},
    ];
    for (const [index, value] of rejected.entries()) {
      expect(isQuestionId(value), `rejected input ${index}`).toBe(false);
    }
    for (const id of QUESTION_IDS) expect(isQuestionId(id), id).toBe(true);
  });
});

describe('live answers', () => {
  it('runs all six ids against the real image', () => {
    for (const id of QUESTION_IDS) expect(answers.get(id), id).toBeDefined();
    // Counts are read, not asserted as literals; the catalog must simply answer.
    const counts = QUESTION_IDS.map((id) => (answers.get(id) as PlSolution[]).length);
    expect(counts.every((count) => count > 0)).toBe(true);
  });

  it('reproduces the committed category-A answer bytes', () => {
    const entry = QUESTION_CATALOG['category-a-recommendations'];
    const live = serializeAnswer(entry, answers.get('category-a-recommendations') as PlSolution[]);
    expect(live).toBe(committedResult('category-a-recommendations'));
  });

  it.each([
    'dosage-reduction-content',
    'evidence-type-1-recommendation',
    'recommendation-exists',
  ] as const)('is canonical value-equal to the committed answer for %s', (id) => {
    const live = serializeAnswer(QUESTION_CATALOG[id], answers.get(id) as PlSolution[]);
    expect(live).toBe(committedResult(id));
  });

  it('answers an existence question yes or no rather than with rows', () => {
    const entry = QUESTION_CATALOG['recommendation-exists'];
    expect(entry.projection).toHaveLength(0);
    expect(serializeAnswer(entry, answers.get('recommendation-exists') as PlSolution[])).toBe(
      'yes',
    );
    expect(serializeAnswer(entry, [])).toBe('no');
  });

  it('serializes independently of the order the engine yielded', () => {
    const entry = QUESTION_CATALOG['category-a-recommendations'];
    const live = answers.get('category-a-recommendations') as PlSolution[];
    expect(serializeAnswer(entry, [...live].reverse())).toBe(serializeAnswer(entry, live));
  });

  it(
    'tracks an injected overlay clause rather than a fixture',
    async () => {
      const marker = `probe-${process.pid}-overlay`;
      const entry = QUESTION_CATALOG['category-a-recommendations'];
      const before = serializeAnswer(
        entry,
        answers.get('category-a-recommendations') as PlSolution[],
      );
      expect(before).not.toContain(marker);

      // Schema predicates ship static, so the overlay declares them dynamic first.
      // The goal is a seven-way join, so one fact cannot move it: the overlay
      // supplies a whole new proof rather than a single clause.
      const id = (n: number): string => `'$guideline_id'(product,'${marker}',${n},ref(1),[])`;
      const loaded = await session.handle(
        {
          id: 'overlay',
          kind: 'consult',
          source:
            ':- dynamic(guideline_entity/4).\n:- dynamic(guideline_cardinality/5).\n' +
            ':- dynamic(guideline_event/3).\n:- dynamic(guideline_arg/4).\n' +
            `guideline_entity(actual,${id(1)},recommendation,countable).\n` +
            `guideline_cardinality(actual,${id(1)},na,eq,1).\n` +
            `guideline_entity(actual,${id(2)},'category-A-recommendation',countable).\n` +
            `guideline_cardinality(actual,${id(2)},na,eq,1).\n` +
            `guideline_event(actual,${id(3)},be).\n` +
            `guideline_arg(actual,${id(3)},1,${id(1)}).\n` +
            `guideline_arg(actual,${id(3)},2,${id(2)}).\n`,
        },
        new Uint8Array(readGenerated('kb.pvm')),
      );
      expect(loaded, JSON.stringify(loaded)).toMatchObject({ kind: 'consulted' });

      const after = serializeAnswer(entry, await run('category-a-recommendations'));
      expect(after).not.toBe(before);
      expect(after).toContain(marker);
    },
    BOOT_TIMEOUT,
  );
});

describe('canonical order', () => {
  it('orders by type before value, unlike a byte sort', () => {
    // `10` sorts before `'2'` numerically and after it lexically.
    expect(compareTerms({ kind: 'integer', value: 10 }, atom('2'))).toBeLessThan(0);
    expect(
      compareTerms({ kind: 'integer', value: 10 }, { kind: 'integer', value: 2 }),
    ).toBeGreaterThan(0);
    expect(compareTerms(atom('b'), { kind: 'string', value: 'a' })).toBeLessThan(0);
    expect(compareTerms({ kind: 'variable', id: 1 }, { kind: 'integer', value: 0 })).toBeLessThan(
      0,
    );
  });

  it('orders compounds by arity, then name, then arguments', () => {
    const f2: PlTerm = { kind: 'compound', functor: 'f', args: [atom('a'), atom('a')] };
    const z1: PlTerm = { kind: 'compound', functor: 'z', args: [atom('a')] };
    expect(compareTerms(z1, f2)).toBeLessThan(0);
    expect(compareTerms({ kind: 'compound', functor: 'a', args: [atom('z')] }, z1)).toBeLessThan(0);
    expect(compareTerms({ kind: 'compound', functor: 'z', args: [atom('b')] }, z1)).toBeGreaterThan(
      0,
    );
  });

  it('is total over the real answer terms', () => {
    const terms = (answers.get('category-a-recommendations') as PlSolution[]).map(
      (solution) => solution.bindings['A'] as PlTerm,
    );
    for (const [i, left] of terms.entries()) {
      for (const [j, right] of terms.entries()) {
        expect(Math.sign(compareTerms(left, right)), `${i}/${j}`).toBe(
          i === j ? 0 : Math.sign(i - j),
        );
      }
    }
  });

  it('treats the empty list as an atom and a list as its compound chain', () => {
    expect(compareTerms({ kind: 'list', items: [] }, atom('[]'))).toBe(0);
    expect(
      compareTerms({ kind: 'list', items: [atom('a')] }, { kind: 'list', items: [atom('b')] }),
    ).toBeLessThan(0);
    expect(compareTerms({ kind: 'list', items: [atom('a')] }, atom('[]'))).toBeGreaterThan(0);
  });
});

describe('guideline id humanizer', () => {
  it('formats a real binding structurally', () => {
    const solution = (answers.get('category-a-recommendations') as PlSolution[])[0] as PlSolution;
    const term = solution.bindings['A'] as PlTerm;
    const text = humanizeGuidelineId(term, solution.display['A'] as string);
    expect(text).not.toBe(solution.display['A']);
    expect(text).toMatch(/^\S+ — sentence \d+, \w+ \d+$/u);
    // Generic over guidelines: no corpus vocabulary is glossed into the label.
    for (const gloss of ['Recommendation', 'Implementation', 'CDC', 'Opioid']) {
      expect(text).not.toContain(gloss);
    }
  });

  it('degrades to the engine text for any other shape', () => {
    const display = 'whatever the engine wrote';
    for (const term of [
      { kind: 'atom', value: 'x' } as PlTerm,
      { kind: 'compound', functor: '$guideline_id', args: [atom('product')] } as PlTerm,
      {
        kind: 'compound',
        functor: 'other',
        args: Array.from({ length: 5 }, () => atom('a')),
      } as PlTerm,
      {
        kind: 'compound',
        functor: '$guideline_id',
        args: [
          atom('product'),
          { kind: 'integer', value: 1 },
          { kind: 'integer', value: 1 },
          atom('r'),
          { kind: 'list', items: [] },
        ],
      } as PlTerm,
    ]) {
      expect(humanizeGuidelineId(term, display)).toBe(display);
    }
  });
});
