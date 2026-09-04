// Live contract for the clinician-facing catalog and answer service.
//
// Expected statements are re-read from the vendored controlled-language files;
// none of the clinical answer text is copied into this suite.

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
  type CatalogEntry,
  type QuestionId,
} from '../src/questions/catalog.js';
import { humanizeAnswerTerm, humanizeGuidelineId } from '../src/questions/humanize.js';
import { compareTerms, serializeAnswer } from '../src/questions/serialize.js';
import { verifyBag } from '../tools/kb/bag.mjs';
import { catalogRecords } from '../tools/kb/catalog.mjs';
import { CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { deriveProvenance } from '../tools/kb/provenance.mjs';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const BOOT_TIMEOUT = 120_000;

const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

const diagnostics: string[] = [];
const drain = (): string[] => diagnostics.splice(0);
const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({ printErr: (line: string) => diagnostics.push(line) });
};

const bagFiles = ((): Map<string, Uint8Array> => {
  const kb = join(ROOT, 'kb');
  const archive = readdirSync(kb).find((name) => name.endsWith('.tar.gz'));
  if (archive === undefined) throw new Error('vendored bag is missing');
  return verifyBag(readFileSync(join(kb, archive))).files;
})();

const sourcePassages = new Map(
  deriveProvenance(bagFiles).chunks.map(({ document, model }) => {
    const evidence = model as { source: { text: string } };
    return [document, evidence.source.text] as const;
  }),
);

const expectedStatements = (id: QuestionId): string[] => {
  const topic = CLINICAL_QUESTIONS.find((candidate) => candidate.id === id);
  if (topic === undefined) throw new Error(`missing clinical topic ${id}`);
  return topic.sources.map(({ document }) => {
    const passage = sourcePassages.get(document);
    if (passage === undefined) throw new Error(`${document} has no source passage`);
    return passage;
  });
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
  it('holds the seven declared clinical topics in generated order', () => {
    expect(QUESTION_IDS).toHaveLength(7);
    expect(CLINICAL_QUESTIONS.map(({ id }) => id)).toEqual(QUESTION_IDS);
    expect(Object.keys(QUESTION_CATALOG)).toEqual(QUESTION_IDS);
    for (const id of QUESTION_IDS) {
      const entry = QUESTION_CATALOG[id];
      expect(entry.question, id).not.toBe('');
      expect(entry.goal, id).toMatch(/^clinical_advice\('[a-z0-9-]+',Source,Answer\)$/u);
      expect(entry.projection).toEqual([
        { variable: 'Answer', descriptor: 'noun(guideline-passage,countable)' },
      ]);
      expect(entry.provenance).toBe('bag-derived');
    }
  });

  it('re-derives the generated catalog from the verified bag', () => {
    const derived = catalogRecords(bagFiles);
    expect(derived.records).toEqual(QUESTION_IDS.map((id) => QUESTION_CATALOG[id]));
    expect(derived.names.length).toBeGreaterThan(0);
    expect(derived.source).toContain('clinical_advice_source(');
  });

  it('refuses a bag missing a selected controlled source', () => {
    const first = CLINICAL_QUESTIONS[0]?.sources[0]?.document;
    if (first === undefined) throw new Error('clinical catalog has no source selection');
    const path = [...bagFiles.keys()].find((name) => name.endsWith(`/ace/${first}.ace`));
    if (path === undefined) throw new Error(`bag has no ACE source ${first}`);
    const incomplete = new Map(bagFiles);
    incomplete.delete(path);
    expect(() => catalogRecords(incomplete)).toThrow(/missing-file|expected one ACE source/u);
  });

  it('rejects every input that is not one of the seven ids', () => {
    const rejected: unknown[] = [
      QUESTION_CATALOG[QUESTION_IDS[0]].question,
      'true',
      'clinical_advice(_,_,_)',
      'When-To-Use-Opioids',
      'when-to-use-opioids.',
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

describe('live clinical answers', () => {
  it('returns every selected controlled sentence through the real image', () => {
    for (const id of QUESTION_IDS) {
      const rows = answers.get(id) as PlSolution[];
      const text = rows.map((solution) => {
        const answer = solution.bindings.Answer;
        expect(answer?.kind, id).toBe('string');
        return answer?.kind === 'string' ? answer.value : '';
      });
      expect(text, id).toEqual(expectedStatements(id));
    }
  });

  it('returns a source identifier beside every projected statement', () => {
    for (const id of QUESTION_IDS) {
      for (const solution of answers.get(id) as PlSolution[]) {
        const source = solution.bindings.Source;
        expect(source?.kind, id).toBe('compound');
        if (source?.kind === 'compound') {
          expect(source.functor).toBe('$guideline_id');
          expect(source.args).toHaveLength(5);
        }
      }
    }
  });

  it('serializes independently of the order the engine yielded', () => {
    for (const id of QUESTION_IDS) {
      const entry = QUESTION_CATALOG[id];
      const live = answers.get(id) as PlSolution[];
      expect(serializeAnswer(entry, [...live].reverse())).toBe(serializeAnswer(entry, live));
    }
  });

  it(
    'tracks an injected clinical-advice fact rather than a UI fixture',
    async () => {
      const id = QUESTION_IDS[0];
      const marker = `probe-${String(process.pid)}-overlay`;
      const entry = QUESTION_CATALOG[id];
      const before = serializeAnswer(entry, answers.get(id) as PlSolution[]);
      expect(before).not.toContain(marker);

      const loaded = await session.handle(
        {
          id: 'overlay',
          kind: 'consult',
          source: `clinical_advice('${id}','$guideline_id'(product,'${marker}',1,ref(1),[]),${JSON.stringify(marker)}).\n`,
        },
        new Uint8Array(readGenerated('kb.pvm')),
      );
      expect(loaded, JSON.stringify(loaded)).toMatchObject({ kind: 'consulted' });

      const after = serializeAnswer(entry, await run(id));
      expect(after).not.toBe(before);
      expect(after).toContain(marker);
    },
    BOOT_TIMEOUT,
  );
});

describe('canonical order', () => {
  it('orders by type before value, unlike a byte sort', () => {
    expect(compareTerms({ kind: 'integer', value: 10 }, atom('2'))).toBeLessThan(0);
    expect(
      compareTerms({ kind: 'integer', value: 10 }, { kind: 'integer', value: 2 }),
    ).toBeGreaterThan(0);
    expect(compareTerms(atom('b'), { kind: 'string', value: 'a' })).toBeLessThan(0);
    expect(compareTerms({ kind: 'variable', id: 1 }, { kind: 'integer', value: 0 })).toBeLessThan(
      0,
    );
  });

  it('orders compounds by arity, then name and arguments', () => {
    const f2: PlTerm = { kind: 'compound', functor: 'f', args: [atom('a'), atom('a')] };
    const z1: PlTerm = { kind: 'compound', functor: 'z', args: [atom('a')] };
    expect(compareTerms(z1, f2)).toBeLessThan(0);
    expect(compareTerms({ kind: 'compound', functor: 'a', args: [atom('z')] }, z1)).toBeLessThan(0);
    expect(compareTerms({ kind: 'compound', functor: 'z', args: [atom('b')] }, z1)).toBeGreaterThan(
      0,
    );
  });

  it('is antisymmetric over the real answer strings', () => {
    const terms = (answers.get(QUESTION_IDS[0]) as PlSolution[]).map(
      (solution) => solution.bindings.Answer as PlTerm,
    );
    for (const left of terms) {
      for (const right of terms) {
        const forward = Math.sign(compareTerms(left, right));
        const reverse = Math.sign(compareTerms(right, left));
        expect(forward === 0 ? reverse : forward + reverse).toBe(0);
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

  const ordinalEntry: CatalogEntry = {
    id: QUESTION_IDS[0],
    question: 'ordinal probe',
    goal: 'true',
    projection: [{ variable: 'S', descriptor: 'noun(sentence,countable)' }],
    provenance: 'bag-derived',
  };

  const ordinalRow = (ordinal: number): PlSolution => ({
    bindings: {
      S: {
        kind: 'compound',
        functor: '$guideline_id',
        args: [atom('doc'), atom('sentence'), { kind: 'integer', value: ordinal }],
      },
    },
    display: { S: `'$guideline_id'(doc,sentence,${ordinal})` },
  });

  it('sorts serialized rows by term order rather than rendered bytes', () => {
    expect(serializeAnswer(ordinalEntry, [ordinalRow(10), ordinalRow(2)])).toBe(
      "solutions([sol(['$guideline_id'(doc,sentence,2)]),sol(['$guideline_id'(doc,sentence,10)])])",
    );
  });

  it('collapses duplicate proofs of one fact into a single row', () => {
    expect(serializeAnswer(ordinalEntry, [ordinalRow(2), ordinalRow(2)])).toBe(
      "solutions([sol(['$guideline_id'(doc,sentence,2)])])",
    );
  });
});

describe('answer humanizer', () => {
  it('formats the source identifier structurally', () => {
    const solution = (answers.get(QUESTION_IDS[0]) as PlSolution[])[0] as PlSolution;
    const term = solution.bindings.Source as PlTerm;
    const display = solution.display.Source as string;
    const text = humanizeGuidelineId(term, display);
    expect(text).not.toBe(display);
    expect(text).toMatch(/^\S+ — sentence \d+, \w+ \d+$/u);
  });

  it('presents the exact source passage without Prolog string delimiters', () => {
    const solution = (answers.get(QUESTION_IDS[0]) as PlSolution[])[0] as PlSolution;
    const term = solution.bindings.Answer as PlTerm;
    const text = humanizeAnswerTerm(term, solution.display.Answer as string);
    expect(text).not.toContain('"');
    expect(term.kind).toBe('string');
    if (term.kind === 'string') expect(text).toBe(term.value);
    expect(text).toMatch(/[.]$/u);
  });

  it('degrades to engine text for an unknown term shape', () => {
    const display = 'whatever the engine wrote';
    for (const term of [
      { kind: 'atom', value: 'x' } as PlTerm,
      { kind: 'compound', functor: '$guideline_id', args: [atom('product')] } as PlTerm,
      {
        kind: 'compound',
        functor: 'other',
        args: Array.from({ length: 5 }, () => atom('a')),
      } as PlTerm,
    ]) {
      expect(humanizeGuidelineId(term, display)).toBe(display);
    }
  });
});
