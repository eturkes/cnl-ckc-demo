// ann-u1 M1–M9 + A7: real saved image; independent pl/ oracle; compiled guideline_* mutants.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import generated from '@kb/question-catalog.json';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEMO_BUDGET } from '../src/demo/DemoController.svelte.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { decodeTerm, type PlTerm } from '../src/engine/terms.js';
import { QUESTION_IDS, QUESTION_CATALOG, type CatalogEntry } from '../src/questions/catalog.js';
import { decodeMarks, gradeReading, timeReading } from '../src/questions/marks.js';
import { catalogRecords } from '../tools/kb/catalog.mjs';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';
import {
  bagFiles,
  ROOT,
  gateRecords,
  mutatePlSentence,
  replaceFileText,
} from './clinical-test-support.js';
import { list, marksTerm } from './support/marks-terms.js';
import {
  compiledText,
  rawClauses,
  oracleMarks,
  withHead,
  type RawClause,
} from './support/marks-oracle.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;
const loadImage: ImageLoader = (image) => load(image)({ arguments: ['-q'] });
const manifest = JSON.parse(readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const BUILD_TIMEOUT = 300_000;
const documents = Array.from(
  { length: 12 },
  (_, index) => `cdc2022-opioid-rec${String(index + 1).padStart(2, '0')}`,
);
const expected = new Map(documents.map((document) => [document, oracleMarks(bagFiles, document)]));
const base = payloadSource(bagFiles).source;
const marker = `ann-u1-${String(process.pid)}`;
let engine: Engine;

const nativeRows = (target: Engine, goal: string): Record<string, unknown>[] =>
  [...target.prolog.query(goal)] as Record<string, unknown>[];
const compoundArgs = (term: PlTerm | undefined, functor: string): PlTerm[] => {
  if (term?.kind !== 'compound' || term.functor !== functor)
    throw new Error(`expected ${functor} compound`);
  return term.args;
};
const listItems = (term: PlTerm | undefined): PlTerm[] => {
  if (term?.kind !== 'list') throw new Error('expected proper list');
  return term.items;
};
const atomValue = (term: PlTerm | undefined): string => {
  if (term?.kind !== 'atom') throw new Error('expected atom');
  return term.value;
};
const numberValue = (term: PlTerm | undefined): number => {
  if (term?.kind !== 'integer' || typeof term.value !== 'number')
    throw new Error('expected numeric integer');
  return term.value;
};
interface MarkRow {
  document: string;
  term: PlTerm;
  source: PlTerm;
  grades: PlTerm;
  groups: PlTerm[][];
}
const markRows = (target: Engine): MarkRow[] =>
  nativeRows(
    target,
    '(current_predicate(clinical_marks/3) -> clinical_marks(_,Source,Marks) ; fail)',
  ).map((row) => {
    const term = decodeTerm(row.Marks);
    const args = compoundArgs(term, 'marks');
    const grades = args[1];
    if (grades === undefined) throw new Error('missing grades');
    return {
      document: atomValue(args[0]),
      term,
      source: decodeTerm(row.Source),
      grades,
      groups: listItems(args[2]).map((group) => listItems(compoundArgs(group, 'group')[0])),
    };
  });
const answerRows = (target: Engine): { document: string; term: PlTerm; source: PlTerm }[] =>
  nativeRows(target, 'clinical_advice(_,Source,Answer)').map((row) => {
    const term = decodeTerm(row.Answer);
    return {
      document: atomValue(compoundArgs(term, 'clinical_answer')[0]),
      term,
      source: decodeTerm(row.Source),
    };
  });
const baselineMarks = (): MarkRow[] => {
  const rows = markRows(engine);
  expect(rows.map(({ document }) => document).sort()).toEqual(documents);
  return rows;
};
const build = async (source: string): Promise<Engine> =>
  loadImage((await buildImage(source)).image);
const need = <T>(value: T | undefined, description: string): T => {
  if (value === undefined) throw new Error(description);
  return value;
};
const oracle = (document: string) => need(expected.get(document), `missing oracle ${document}`);
const firstClause = (
  files: Map<string, Uint8Array>,
  document: string,
  predicate: string,
  sentence?: number,
): RawClause =>
  need(
    rawClauses(compiledText(files, document)).find(
      (clause) =>
        clause.functor === predicate && (sentence === undefined || clause.sentence === sentence),
    ),
    `${document}: no ${predicate} clause`,
  );
const replaceClause = (
  files: Map<string, Uint8Array>,
  document: string,
  clause: RawClause,
  changed: string,
): Map<string, Uint8Array> =>
  replaceFileText(files, `/pl/${document}.pl`, (text) => {
    const lines = text.split('\n');
    expect(lines[clause.index]).toBe(clause.line);
    lines[clause.index] = changed;
    return lines.join('\n');
  });

beforeAll(async () => {
  engine = await loadImage(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))));
}, 120_000);
afterEach(() => {
  vi.doUnmock('@kb/question-catalog.json');
  vi.resetModules();
});

describe('compiled marks catalog and derivation', () => {
  it('M1 emits and pins catalog v4 with one bag-derived marks goal per entry', async () => {
    expect(generated.catalogVersion).toBe(4);
    const derived = catalogRecords(bagFiles);
    expect(derived.records).toEqual(QUESTION_IDS.map((id) => QUESTION_CATALOG[id]));
    for (const id of QUESTION_IDS)
      expect((QUESTION_CATALOG[id] as CatalogEntry & { marksGoal: string }).marksGoal).toBe(
        `clinical_marks('${id}',Source,Marks)`,
      );
    vi.resetModules();
    vi.doMock('@kb/question-catalog.json', () => ({
      default: { ...generated, catalogVersion: generated.catalogVersion + 1 },
    }));
    await expect(import('../src/questions/catalog.js')).rejects.toThrow(
      `question catalog version ${String(generated.catalogVersion + 1)} is unsupported`,
    );
  });
  it('M2 every marks goal settles solutions under DEMO_BUDGET in answer document and Source order', async () => {
    let raw: Engine | undefined;
    const session = new EngineSession({
      loadImage: async (image) => {
        raw = await loadImage(image);
        return raw;
      },
      expected: manifest.contract,
    });
    await session.boot(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))));
    const readings: { id: string; ms: number; inferences: number; documents: number }[] = [];
    for (const id of QUESTION_IDS) {
      const answer = await session.solve(QUESTION_CATALOG[id].goal, DEMO_BUDGET, `answer-${id}`);
      expect(answer.kind).toBe('solutions');
      const before = Number(
        nativeRows(need(raw, 'session raw image'), 'statistics(inferences,N)')[0]?.N,
      );
      const started = performance.now();
      const marks = await session.solve(
        `clinical_marks('${id}',Source,Marks)`,
        DEMO_BUDGET,
        `marks-${id}`,
      );
      const ms = performance.now() - started;
      const inferences =
        Number(nativeRows(need(raw, 'session raw image'), 'statistics(inferences,N)')[0]?.N) -
        before;
      readings.push({
        id,
        ms: Number(ms.toFixed(3)),
        inferences,
        documents: marks.kind === 'solutions' ? marks.solutions.length : 0,
      });
      expect.soft(marks.kind, id).toBe('solutions');
      if (marks.kind !== 'solutions' || answer.kind !== 'solutions') continue;
      expect(
        marks.solutions.map(({ display }) => display.Source),
        id,
      ).toEqual(answer.solutions.map(({ display }) => display.Source));
      expect(
        marks.solutions.map(({ bindings }) => atomValue(compoundArgs(bindings.Marks, 'marks')[0])),
      ).toEqual(
        answer.solutions.map(({ bindings }) =>
          atomValue(compoundArgs(bindings.Answer, 'clinical_answer')[0]),
        ),
      );
    }
    console.info('ann-u1 marks measurements', readings);
    expect(readings).toHaveLength(7);
    expect(readings.reduce((count, row) => count + row.documents, 0)).toBe(12);
  });
  it('M3 groups partition every content sentence by its answer consequent, in gate order', () => {
    const rows = baselineMarks();
    const answers = answerRows(engine);
    const rules = nativeRows(engine, 'clinical_rule(Doc,S,Rule)').map(({ Doc, S, Rule }) => ({
      document: String(Doc),
      sentence: Number(S),
      rule: decodeTerm(Rule),
    }));
    let groups = 0;
    let sentences = 0;
    for (const row of rows) {
      const answer = need(
        answers.find(({ document }) => document === row.document),
        'answer absent',
      );
      const answerGroups = listItems(compoundArgs(answer.term, 'clinical_answer')[1]);
      expect(row.groups, row.document).toHaveLength(answerGroups.length);
      const expectedIds = oracle(row.document).sentences.map(({ sentence }) => sentence);
      const ids = row.groups.flat().map((term) => numberValue(compoundArgs(term, 'sentence')[0]));
      expect(
        [...ids].sort((a, b) => a - b),
        row.document,
      ).toEqual(expectedIds);
      expect(new Set(ids).size, row.document).toBe(ids.length);
      for (const [index, group] of answerGroups.entries()) {
        const consequent = compoundArgs(group, 'rule').slice(1);
        const matching = rules
          .filter(
            (rule) =>
              rule.document === row.document &&
              JSON.stringify(compoundArgs(rule.rule, 'rule').slice(1)) ===
                JSON.stringify(consequent),
          )
          .map(({ sentence }) => sentence);
        expect(
          row.groups[index]?.map((term) => numberValue(compoundArgs(term, 'sentence')[0])),
          `${row.document}/${String(index)}`,
        ).toEqual(matching);
      }
      groups += row.groups.length;
      sentences += ids.length;
    }
    expect({ groups, sentences }).toEqual({ groups: 43, sentences: 53 });
  });
  it('M3 constructed grouping merges A,B,A and changed conditions but splits each changed consequent', () => {
    const a = 'rule(["one"],"subject",should,[action(positive,do,"object",[])])';
    const a2 = 'rule(["three"],"subject",should,[action(positive,do,"object",[])])';
    for (const b of [
      'rule(["two"],"other",should,[action(positive,do,"object",[])])',
      'rule(["two"],"subject",may,[action(positive,do,"object",[])])',
      'rule(["two"],"subject",should,[action(negative,do,"object",[])])',
      'rule(["two"],"subject",should,[action(positive,other,"object",[])])',
    ]) {
      const result = nativeRows(engine, `clinical_groups([${a},${b},${a2}],Groups)`);
      expect(result).toHaveLength(1);
      const groups = listItems(decodeTerm(result[0]?.Groups));
      expect(groups).toHaveLength(2);
      expect(compoundArgs(groups[0], 'rule')[0]).toEqual(
        list({ kind: 'string', value: 'one' }, { kind: 'string', value: 'three' }),
      );
      expect(compoundArgs(groups[1], 'rule')[0]).toEqual(list({ kind: 'string', value: 'two' }));
    }
    for (let seed = 0; seed < 32; seed += 1) {
      const inputs: string[] = [];
      const reference = new Map<string, string[]>();
      for (let index = 0; index < 3 + (seed % 17); index += 1) {
        const key = `s${String((seed + index * 7) % 4)},should,[a${String((seed + index) % 3)}]`;
        const conditions = index % 5 === 0 ? [] : [`c${String(index)}`];
        inputs.push(`rule([${conditions.join(',')}],${key})`);
        reference.set(key, [...(reference.get(key) ?? []), ...conditions]);
      }
      const expectedGroups = [...reference].map(
        ([key, conditions]) => `rule([${conditions.join(',')}],${key})`,
      );
      expect(
        nativeRows(
          engine,
          `clinical_groups([${inputs.join(',')}],Groups), Groups == [${expectedGroups.join(',')}]`,
        ),
        `seed ${String(seed)}`,
      ).toHaveLength(1);
    }
  });
  it('M4 every grade and its entity label equal the independent ordered bag-head parse', () => {
    expect([...expected.values()].reduce((count, value) => count + value.grades.length, 0)).toBe(
      24,
    );
    for (const row of baselineMarks()) {
      const expectedTerm = marksTerm({
        document: row.document,
        grades: oracle(row.document).grades,
        groups: [],
      });
      expect(row.grades, row.document).toEqual(compoundArgs(expectedTerm, 'marks')[1]);
    }
  });
  it('M5 every sentence keeps the bag-head annotation order, repetitions and empty lists', () => {
    const totals = { qualifiers: 0, preferences: 0, intervals: 0, orders: 0 };
    for (const item of [...expected.values()].flatMap(({ sentences }) => sentences)) {
      totals.qualifiers += item.qualifiers.length;
      totals.preferences += item.preferences.length;
      totals.intervals += item.times.filter(({ kind }) => kind === 'interval').length;
      totals.orders += item.times.filter(({ kind }) => kind === 'order').length;
    }
    expect(totals).toEqual({ qualifiers: 22, preferences: 5, intervals: 12, orders: 6 });
    for (const row of baselineMarks()) {
      const actual = [...row.groups.flat()].sort(
        (left, right) =>
          numberValue(compoundArgs(left, 'sentence')[0]) -
          numberValue(compoundArgs(right, 'sentence')[0]),
      );
      const expectedTerm = marksTerm({
        document: row.document,
        grades: [],
        groups: [oracle(row.document).sentences],
      });
      const group = listItems(compoundArgs(expectedTerm, 'marks')[2])[0];
      expect(actual, row.document).toEqual(listItems(compoundArgs(group, 'group')[0]));
    }
  });
  it('M9 every shipped marks solution decodes without losing any sentence or grade', () => {
    for (const row of baselineMarks()) {
      const decoded = decodeMarks(row.term);
      expect(decoded, row.document).toBeDefined();
      expect(decoded?.document).toBe(row.document);
      expect(decoded?.grades).toEqual(oracle(row.document).grades);
      expect(decoded?.groups.flat().sort((a, b) => a.sentence - b.sentence)).toEqual(
        oracle(row.document).sentences,
      );
    }
  });
});

describe('compiled guideline marks binding', () => {
  it(
    'M6 unprovable bodies remove exactly four documents; an unprovable grade drops only that grade',
    async () => {
      const victims = [
        ['cdc2022-opioid-rec04', 'guideline_qualifier'],
        ['cdc2022-opioid-rec03', 'guideline_preference'],
        ['cdc2022-opioid-rec07', 'guideline_interval'],
        ['cdc2022-opioid-rec01', 'guideline_order'],
      ] as const;
      const lines = base.split('\n');
      for (const [document, predicate] of victims) {
        const site = need(
          gateRecords.find(
            (gate) =>
              gate.document === document &&
              gate.heads.some((head) => head.startsWith(`${predicate}(`)),
          ),
          `${predicate}: no gate`,
        );
        const index = site.heads.findIndex((head) => head.startsWith(`${predicate}(`));
        const line = need(site.lines[index], 'gate line missing');
        const original = need(lines[line - 1], 'payload line missing');
        expect(original).toMatch(new RegExp(`^${predicate}\\(`, 'u'));
        lines[line - 1] =
          `${original.slice(0, -1)}, guideline_document('${marker}',missing,missing,missing).`;
      }
      const gradeDoc = 'cdc2022-opioid-rec12';
      const grade = firstClause(bagFiles, gradeDoc, 'guideline_grade');
      const gradeIndex = lines.indexOf(grade.line);
      expect(gradeIndex).toBeGreaterThan(-1);
      lines[gradeIndex] =
        `${grade.head} :- guideline_document('${marker}',missing,missing,missing).`;
      const changed = lines.join('\n');
      expect(changed.split('\n')).toHaveLength(base.split('\n').length);
      expect(
        changed.split('\n').filter((line) => /^clinical_(gate|premise)\(/u.test(line)),
      ).toEqual(base.split('\n').filter((line) => /^clinical_(gate|premise)\(/u.test(line)));
      const mutated = await build(changed);
      const refused = new Set<string>(victims.map(([document]) => document));
      expect(answerRows(mutated)).toEqual(
        answerRows(engine).filter(({ document }) => !refused.has(document)),
      );
      const before = baselineMarks();
      const after = markRows(mutated);
      expect(after.map(({ document }) => document)).toEqual(
        before.filter(({ document }) => !refused.has(document)).map(({ document }) => document),
      );
      for (const row of after) {
        const original = need(
          before.find(({ document }) => document === row.document),
          'missing baseline marks',
        );
        if (row.document !== gradeDoc) expect(row).toEqual(original);
        else {
          expect(row.groups).toEqual(original.groups);
          expect(listItems(row.grades)).toEqual(listItems(original.grades).slice(1));
        }
      }
    },
    BUILD_TIMEOUT,
  );
  it(
    'M6 a top-level assumed gate head cannot become a KB mark',
    async () => {
      const document = 'cdc2022-opioid-rec11';
      const gate = need(
        gateRecords.find(
          (record) =>
            record.document === document &&
            record.heads.some((head) => head.startsWith('guideline_qualifier(')),
        ),
        'no qualifier gate',
      );
      const head = need(
        gate.heads.find((value) => value.startsWith('guideline_qualifier(')),
        'no qualifier head',
      );
      const lines = base.split('\n');
      const lastPremise = lines.reduce(
        (found, line, index) => (line.startsWith('clinical_premise(') ? index : found),
        -1,
      );
      expect(lastPremise).toBeGreaterThan(-1);
      lines.splice(
        lastPremise + 1,
        0,
        `clinical_premise('${document}',${String(gate.sentence)},999,(${head})).`,
      );
      const mutated = await build(lines.join('\n'));
      expect(answerRows(mutated)).toEqual(answerRows(engine));
      expect(markRows(mutated)).toEqual(baselineMarks().filter((row) => row.document !== document));
    },
    BUILD_TIMEOUT,
  );
  it('M6 clinical_marks has no facts and refuses a direct static assertion', () => {
    expect(nativeRows(engine, 'current_predicate(clinical_marks/3)')).toHaveLength(1);
    expect(nativeRows(engine, 'clause(clinical_marks(_,_,_),true)')).toHaveLength(0);
    const result = nativeRows(
      engine,
      'catch(assertz(clinical_marks(q,s,m)),error(E,_),true),with_output_to(string(T),write_canonical(E))',
    );
    expect(String(result[0]?.T)).toBe(
      'permission_error(modify,static_procedure,/(clinical_marks,3))',
    );
  });
  it(
    'M7 bag-side label and quantity mutations move exactly their marks and readings',
    async () => {
      const gradeDoc = 'cdc2022-opioid-rec01';
      const timeDoc = 'cdc2022-opioid-rec07';
      const grade = firstClause(bagFiles, gradeDoc, 'guideline_grade');
      const entity = need(
        rawClauses(compiledText(bagFiles, gradeDoc)).find(
          (clause) => clause.functor === 'guideline_entity' && clause.args[1] === grade.args[4],
        ),
        'grade label entity absent',
      );
      const label = `${marker}-label`;
      const changedArgs = [...entity.args];
      changedArgs[2] = `'${label}'`;
      let files = replaceClause(bagFiles, gradeDoc, entity, withHead(entity, changedArgs));
      const interval = firstClause(files, timeDoc, 'guideline_interval');
      const quantity = need(
        rawClauses(compiledText(files, timeDoc)).find(
          (clause) =>
            clause.functor === 'guideline_cardinality' && clause.args[1] === interval.args[3],
        ),
        'interval quantity absent',
      );
      const count = 17 + (process.pid % 83);
      const quantityArgs = [...quantity.args];
      quantityArgs[4] = String(count);
      files = replaceClause(files, timeDoc, quantity, withHead(quantity, quantityArgs));
      // The contract's noun fallback must resolve a property node without an entity twin.
      const propertyDoc = 'cdc2022-opioid-rec03';
      const preference = firstClause(files, propertyDoc, 'guideline_preference');
      const preferred = need(
        rawClauses(compiledText(files, propertyDoc)).find(
          (clause) =>
            clause.functor === 'guideline_entity' && clause.args[1] === preference.args[2],
        ),
        'preferred entity absent',
      );
      files = replaceClause(
        files,
        propertyDoc,
        preferred,
        withHead({ ...preferred, functor: 'guideline_property' }, preferred.args),
      );
      const mutated = await build(payloadSource(files).source);
      expect(answerRows(mutated)).toEqual(answerRows(engine));
      const before = baselineMarks();
      const after = markRows(mutated);
      expect(after.map(({ document }) => document)).toEqual(before.map(({ document }) => document));
      for (const row of after) {
        const original = need(
          before.find(({ document }) => document === row.document),
          'baseline marks missing',
        );
        if (![gradeDoc, timeDoc].includes(row.document)) {
          expect(row).toEqual(original);
          continue;
        }
        const oracleAfter = oracleMarks(files, row.document);
        const decoded = need(decodeMarks(row.term), 'mutated marks did not decode');
        expect(decoded.grades).toEqual(oracleAfter.grades);
        expect(decoded.groups.flat().sort((a, b) => a.sentence - b.sentence)).toEqual(
          oracleAfter.sentences,
        );
        if (row.document === gradeDoc) {
          expect(row.groups).toEqual(original.groups);
          expect(gradeReading(decoded.grades)).toContain(
            label.replace(/[-_]/gu, ' ').replace(/^./u, (first) => first.toUpperCase()),
          );
        } else {
          expect(row.grades).toEqual(original.grades);
          const times = decoded.groups
            .flat()
            .flatMap(({ times }) => times)
            .filter((time) => time.kind === 'interval' && time.count === count);
          expect(times).toHaveLength(1);
          expect(times.map(timeReading)).toEqual([
            `at least ${String(count)} weeks after therapy start`,
          ]);
        }
      }
    },
    BUILD_TIMEOUT,
  );
  it(
    'M8 each unresolved or unsupported branch removes only its document marks, not its answer',
    async () => {
      const branches = [
        'preferred',
        'alternative',
        'quantity',
        'interval anchor',
        'order anchor',
        'grade label',
        'none anchor',
        'recurrence',
        'frequency',
        'recurrence window',
        'range',
      ] as const;
      let files = new Map(bagFiles);
      const assigned: { document: string; branch: string }[] = [];
      for (const [index, branch] of branches.entries()) {
        const document = need(documents[index], 'refusal document absent');
        assigned.push({ document, branch });
        if (branch === 'grade label') {
          const grade = firstClause(files, document, 'guideline_grade');
          const args = [...grade.args];
          args[4] = `'${marker}-unresolved-grade'`;
          files = replaceClause(files, document, grade, withHead(grade, args));
          continue;
        }
        const heads = rawClauses(compiledText(files, document));
        const entity = need(
          heads.find(
            (clause) =>
              clause.sentence > 1 &&
              clause.functor === 'guideline_entity' &&
              heads.some(
                (head) =>
                  head.functor === 'guideline_cardinality' &&
                  head.sentence === clause.sentence &&
                  head.args[1] === clause.args[1],
              ),
          ),
          `${document}: no content entity with cardinality`,
        );
        const context = need(entity.args[0], 'entity context absent');
        const reference = need(entity.args[1], 'entity reference absent');
        const missing = `'${marker}-unresolved'`;
        let head: string;
        if (branch === 'preferred')
          head = `guideline_preference(${context},${reference},${missing},none)`;
        else if (branch === 'alternative')
          head = `guideline_preference(${context},${reference},${reference},${missing})`;
        else if (branch === 'quantity')
          head = `guideline_interval(${context},${reference},after,${missing},week,${reference})`;
        else if (branch === 'interval anchor')
          head = `guideline_interval(${context},${reference},after,${reference},week,${missing})`;
        else if (branch === 'order anchor')
          head = `guideline_order(${context},${reference},before,${missing})`;
        else if (branch === 'none anchor')
          head = `guideline_interval(${context},${reference},after,${reference},week,none)`;
        else if (branch === 'recurrence')
          head = `guideline_recurrence(${context},${reference},${reference},week)`;
        else if (branch === 'frequency')
          head = `guideline_frequency(${context},${reference},${reference},${reference},week)`;
        else if (branch === 'recurrence window')
          head = `guideline_recurrence_window(${context},${reference},${reference},week,after,${reference},${reference})`;
        else head = `guideline_range(${context},${reference},${reference})`;
        let planted = 0;
        files = mutatePlSentence(files, document, entity.sentence, (line, ordinal) => {
          if (ordinal !== 0) return line;
          planted += 1;
          return `${line}\n${head}${entity.body === 'true' ? '' : ` :- ${entity.body}`}.`;
        });
        expect(planted, branch).toBe(1);
      }
      expect(new Set(assigned.map(({ document }) => document)).size).toBe(11);
      const mutated = await build(payloadSource(files).source);
      expect(answerRows(mutated)).toEqual(answerRows(engine));
      const before = baselineMarks();
      const after = markRows(mutated);
      for (const { document, branch } of assigned)
        expect(
          after.find((row) => row.document === document),
          branch,
        ).toBeUndefined();
      expect(after).toEqual(
        before.filter(({ document }) => !assigned.some((row) => row.document === document)),
      );
      expect(after).toHaveLength(1);
    },
    BUILD_TIMEOUT,
  );
  it(
    'A7 a duplicate S2 clause cannot stand in for missing S3; only rec03 loses answer and marks',
    async () => {
      const document = 'cdc2022-opioid-rec03';
      const first = need(
        gateRecords.find((record) => record.document === document && record.sentence === 2)
          ?.lines[0],
        'S2 first clause absent',
      );
      const victim = need(
        gateRecords.find((record) => record.document === document && record.sentence === 3)
          ?.lines[0],
        'S3 first clause absent',
      );
      const lines = base.split('\n');
      expect(lines[first - 1]).toMatch(/^guideline_operator\(/u);
      expect(lines[victim - 1]).toMatch(/^guideline_operator\(/u);
      lines[victim - 1] = need(lines[first - 1], 'S2 clause absent');
      const changed = lines.join('\n');
      expect(changed.split('\n')).toHaveLength(base.split('\n').length);
      expect(
        changed.split('\n').filter((line) => /^clinical_(gate|premise)\(/u.test(line)),
      ).toEqual(base.split('\n').filter((line) => /^clinical_(gate|premise)\(/u.test(line)));
      const mutated = await build(changed);
      expect(answerRows(mutated)).toEqual(
        answerRows(engine).filter((row) => row.document !== document),
      );
      expect(markRows(mutated)).toEqual(baselineMarks().filter((row) => row.document !== document));
    },
    BUILD_TIMEOUT,
  );
});
