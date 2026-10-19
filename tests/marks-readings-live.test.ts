// ann-u3 U1: exported heads → independent English readings; live answers → statement joins.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';

import { DEMO_BUDGET } from '../src/demo/DemoController.svelte.js';
import { answerRows, synthesizeAnswer, type AnswerPoint } from '../src/demo/describe.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { decodeTerm, type PlTerm } from '../src/engine/terms.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { marksView, type StatementMarks } from '../src/questions/marks.js';
import { verifyBag } from '../tools/kb/bag.mjs';
import { atomText, compiledText, rawClauses, type RawClause } from './support/marks-oracle.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb/generated');
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('vendored bag is missing');
const files = verifyBag(readFileSync(join(ROOT, 'kb', archive))).files;
const need = <T>(value: T | undefined, why: string): T => {
  if (value === undefined) throw new Error(why);
  return value;
};
const args = (term: PlTerm | undefined, functor: string): PlTerm[] => {
  if (term?.kind !== 'compound' || term.functor !== functor) throw new Error(`expected ${functor}`);
  return term.args;
};
const items = (term: PlTerm | undefined): PlTerm[] => {
  if (term?.kind !== 'list') throw new Error('expected proper list');
  return term.items;
};
const atom = (term: PlTerm | undefined): string => {
  if (term?.kind !== 'atom') throw new Error('expected atom');
  return term.value;
};
const normal = (text: string): string => text.replace(/[-_]/gu, ' ');
const unique = (texts: readonly string[]): string[] => [...new Set(texts)];
const boundWords = new Map([
  ['eq', ''],
  ['exactly', 'exactly '],
  ['geq', 'at least '],
  ['greater', 'more than '],
  ['leq', 'at most '],
  ['less', 'less than '],
  ['about', 'about '],
]);
type Pair = [label: string, value: string];
interface Readings {
  qualifiers: string[];
  preferences: string[];
  times: string[];
}
interface HeadReadings {
  grade: string;
  sentences: Map<number, Readings>;
}

// The parser is test support; no marks decoder or production reading supplies this oracle.
const readHeads = (document: string): HeadReadings => {
  const clauses = rawClauses(compiledText(files, document));
  const noun = (heads: RawClause[], reference: string | undefined): string => {
    const head =
      heads.find((entry) => entry.functor === 'guideline_entity' && entry.args[1] === reference) ??
      heads.find((entry) => entry.functor === 'guideline_property' && entry.args[1] === reference);
    return normal(atomText(need(head, `${document}: unresolved ${String(reference)}`).args[2]));
  };
  const preamble = clauses.filter(({ sentence }) => sentence === 1);
  const grade = ['strength', 'evidence']
    .flatMap((dimension) =>
      preamble
        .filter(
          (head) => head.functor === 'guideline_grade' && atomText(head.args[2]) === dimension,
        )
        .map((head) => {
          const label = noun(preamble, head.args[4]);
          return label.charAt(0).toUpperCase() + label.slice(1);
        }),
    )
    .join(', ');
  const sentences = new Map<number, Readings>();
  for (const sentence of new Set(clauses.map((head) => head.sentence).filter((n) => n > 1))) {
    const heads = clauses.filter((head) => head.sentence === sentence);
    const readings: Readings = { qualifiers: [], preferences: [], times: [] };
    for (const { functor, args: fields } of heads) {
      if (functor === 'guideline_qualifier') readings.qualifiers.push(normal(atomText(fields[3])));
      if (functor === 'guideline_preference') {
        const preferred = noun(heads, fields[2]);
        readings.preferences.push(
          fields[3] === 'none' ? preferred : `${preferred} over ${noun(heads, fields[3])}`,
        );
      }
      if (functor === 'guideline_order')
        readings.times.push(`${atomText(fields[2])} ${noun(heads, fields[3])}`);
      if (functor === 'guideline_interval') {
        const quantity = need(
          heads.find(
            (head) => head.functor === 'guideline_cardinality' && head.args[1] === fields[3],
          ),
          `${document}/${String(sentence)}: unresolved interval quantity`,
        );
        const count = Number(quantity.args[4]);
        if (!Number.isSafeInteger(count) || count < 0) throw new Error('invalid oracle count');
        const comparison = need(boundWords.get(atomText(quantity.args[3])), 'unknown comparison');
        const unit = normal(atomText(fields[4]));
        const bound = `${comparison}${String(count)} ${unit}${count === 1 ? '' : 's'}`;
        const anchor = noun(heads, fields[5]);
        const role = atomText(fields[2]);
        readings.times.push(
          role === 'within' ? `within ${bound} of ${anchor}` : `${bound} ${role} ${anchor}`,
        );
      }
    }
    sentences.set(sentence, readings);
  }
  return { grade, sentences };
};
const pairs = (marks: StatementMarks | undefined): Pair[] => {
  if (marks === undefined) return [];
  return [
    ['Qualifier', marks.qualifier],
    ['Grade', marks.grade],
    ['Preferred', marks.preferences.join('; ')],
    ['Time', marks.times.join('; ')],
  ].filter((pair): pair is Pair => pair[1] !== '');
};

let engine: Engine;
let session: EngineSession;
beforeAll(async () => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  const loadImage: ImageLoader = async (image) => {
    engine = await load(image)({ arguments: ['-q'] });
    return engine;
  };
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))));
}, 120_000);

describe('live statement marks readings', () => {
  it.each(QUESTION_IDS)(
    'U1 %s reads every statement from compiled heads with grade once per document run',
    async (id) => {
      const entry = QUESTION_CATALOG[id];
      const answer = await session.solve(entry.goal, DEMO_BUDGET, `u1-answer-${id}`);
      expect(answer.kind).toBe('solutions');
      if (answer.kind !== 'solutions') throw new Error(`${id}: answer ${answer.kind}`);
      const marks = await session.solve(entry.marksGoal, DEMO_BUDGET, `u1-marks-${id}`);
      expect(marks.kind).toBe('solutions');
      if (marks.kind !== 'solutions') throw new Error(`${id}: marks ${marks.kind}`);
      const rows = answerRows(id, answer.solutions);
      const points = synthesizeAnswer(rows);
      const view = marksView(
        { kind: 'settled', id, goal: entry.marksGoal, outcome: marks },
        points,
        rows,
        answer.solutions,
      );
      expect(points.length).toBeGreaterThan(0);
      expect(view).toMatchObject({ missing: 0, total: rows.length, notice: false });
      expect(view.statements).toHaveLength(points.length);

      const rules = [...engine.prolog.query('clinical_rule(Doc,S,Rule)')] as Record<
        string,
        unknown
      >[];
      const documents = rows.map((row, rowIndex) => {
        const document = need(row.document, `${id}: unstructured answer`);
        const heads = readHeads(document);
        const groups = items(
          args(answer.solutions[rowIndex]?.bindings.Answer, 'clinical_answer')[1],
        );
        const matched = new Set<number>();
        const readings = groups.map((group) => {
          const members = rules
            .filter(
              (rule) =>
                rule.Doc === document &&
                isDeepStrictEqual(
                  args(decodeTerm(rule.Rule), 'rule').slice(1),
                  args(group, 'rule').slice(1),
                ),
            )
            .map((rule) => Number(rule.S));
          expect(members.length, `${document}: group has no sentence`).toBeGreaterThan(0);
          return members.map((sentence) => {
            expect(
              matched.has(sentence),
              `${document}/${String(sentence)}: repeated sentence`,
            ).toBe(false);
            matched.add(sentence);
            return need(
              heads.sentences.get(sentence),
              `${document}/${String(sentence)}: missing heads`,
            );
          });
        });
        expect(
          [...matched].sort((a, b) => a - b),
          document,
        ).toEqual([...heads.sentences.keys()].sort((a, b) => a - b));
        expect(row.items, document).toHaveLength(readings.length);
        expect(atom(args(answer.solutions[rowIndex]?.bindings.Answer, 'clinical_answer')[0])).toBe(
          document,
        );
        return { document, grade: heads.grade, readings };
      });

      const reference = (order: readonly AnswerPoint[]): Pair[][] => {
        let priorDocuments: string[] = [];
        return order.map((point): Pair[] => {
          const contributors = point.sources.map((index) =>
            need(documents[index], 'missing contributor'),
          );
          const currentDocuments = contributors.map(({ document }) => document);
          const readings = point.sources.flatMap((index) =>
            (rows[index]?.items ?? []).flatMap((text, item) =>
              text === point.text ? need(documents[index]?.readings[item], 'missing group') : [],
            ),
          );
          expect(readings.length, `${id}: point has no source sentence`).toBeGreaterThan(0);
          const grade = isDeepStrictEqual(priorDocuments, currentDocuments)
            ? ''
            : contributors
                .map((document) => document.grade)
                .filter(Boolean)
                .join('; ');
          priorDocuments = currentDocuments;
          return pairs({
            qualifier: unique(readings.flatMap((reading) => reading.qualifiers)).join(', '),
            grade,
            preferences: unique(readings.flatMap((reading) => reading.preferences)),
            times: unique(readings.flatMap((reading) => reading.times)),
          });
        });
      };
      const expected = reference(points);
      expect(view.statements.map(pairs), id).toEqual(expected);
      expect(expected.flat().some(([label]) => label === 'Grade')).toBe(true);

      for (let seed = 0; seed < 24; seed += 1) {
        let random = seed + 1;
        const order = [...points];
        for (let index = order.length - 1; index > 0; index -= 1) {
          random = (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0;
          const other = random % (index + 1);
          [order[index], order[other]] = [
            need(order[other], 'generated point absent'),
            need(order[index], 'generated point absent'),
          ];
        }
        const generated = marksView(
          { kind: 'settled', id, goal: entry.marksGoal, outcome: marks },
          order,
          rows,
          answer.solutions,
        );
        expect(generated.statements.map(pairs), `${id}: generated order ${String(seed)}`).toEqual(
          reference(order),
        );
      }
    },
  );
});
