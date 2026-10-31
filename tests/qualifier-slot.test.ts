import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import type { PlTerm } from '../src/engine/terms.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { presentAnswerTerm } from '../src/questions/humanize.js';
import {
  clinicalArtifacts,
  CLINICAL_QUESTIONS,
  parseAdviceSentence,
} from '../tools/kb/clinical.mjs';
import {
  bagFiles,
  filePath,
  mutatePlSentence,
  replaceFileText,
  ROOT,
} from './clinical-test-support.js';
import {
  corpusSentences,
  groupedClauses,
  rebuildClause,
  vocabularyFor,
  vocabularyPath,
  type Action,
  type RebuildableClause,
} from './support/qualifier-oracle.js';

const documents = CLINICAL_QUESTIONS.flatMap(({ sources }) =>
  sources.map(({ document }) => document),
);
const corpus = corpusSentences(bagFiles, documents);
// The base's two-argument function is assignable here; every call exercises the contracted third input.
const parse: (original: string, sentence: number, vocabulary: Set<string>) => RebuildableClause =
  parseAdviceSentence;
const require = createRequire(import.meta.url);
const diagnostics: string[] = [];
const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({ printErr: (line: string) => diagnostics.push(line) });
};
const manifest = JSON.parse(readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
let session: EngineSession;
const liveAnswers: PlSolution[] = [];
const solve = async (goal: string): Promise<PlSolution[]> => {
  const result = await session.solve(goal, BUDGET_MAX, 'qualifier-contract');
  if (result.kind === 'failure') return [];
  if (result.kind !== 'solutions') throw new Error(`goal did not finish: ${result.kind}: ${goal}`);
  return result.solutions;
};

const compound = (term: PlTerm | undefined, functor: string, arity: number): PlTerm[] => {
  expect(term?.kind, functor).toBe('compound');
  if (term?.kind !== 'compound') throw new Error(`expected ${functor} compound`);
  expect(term.functor).toBe(functor);
  expect(term.args, functor).toHaveLength(arity);
  return term.args;
};
const list = (term: PlTerm | undefined): PlTerm[] => {
  expect(term?.kind, 'proper list').toBe('list');
  if (term?.kind !== 'list') throw new Error('expected a proper list');
  return term.items;
};
const scalar = (term: PlTerm | undefined, kind: 'atom' | 'string'): string => {
  expect(term?.kind).toBe(kind);
  if (term?.kind !== kind) throw new Error(`expected ${kind}`);
  return term.value;
};
const action = (term: PlTerm): Action => {
  const [polarity, verb, object, modifiers, qualifiers] = compound(term, 'action', 5);
  const sign = scalar(polarity, 'atom');
  if (sign !== 'positive' && sign !== 'negative') throw new Error(`unknown polarity ${sign}`);
  return {
    polarity: sign,
    verb: scalar(verb, 'atom'),
    object: scalar(object, 'string'),
    modifiers: list(modifiers).map((modifier) => {
      const [preposition, value] = compound(modifier, 'modifier', 2);
      return { preposition: scalar(preposition, 'atom'), value: scalar(value, 'string') };
    }),
    qualifiers: list(qualifiers).map((word) => scalar(word, 'atom')),
  };
};
const actions = (rule: PlTerm | undefined): PlTerm[] => list(compound(rule, 'rule', 4)[3]);
const atom = (value: string): PlTerm => ({ kind: 'atom', value });
const string = (value: string): PlTerm => ({ kind: 'string', value });
const terms = (items: PlTerm[]): PlTerm => ({ kind: 'list', items });
const actionTerm = (value: Action): PlTerm => ({
  kind: 'compound',
  functor: 'action',
  args: [
    atom(value.polarity),
    atom(value.verb),
    string(value.object),
    terms(
      value.modifiers.map(({ preposition, value: text }) => ({
        kind: 'compound',
        functor: 'modifier',
        args: [atom(preposition), string(text)],
      })),
    ),
    terms(value.qualifiers.map(atom)),
  ],
});
const quoteAtom = (value: string): string =>
  `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
const key = (document: string, sentence: number, index: number): string =>
  `${document}:${String(sentence)}:${String(index)}`;

const changeSentence = (
  files: Map<string, Uint8Array>,
  document: string,
  sentence: number,
  from: string,
  to: string,
): Map<string, Uint8Array> => {
  let original = '';
  let changed = '';
  let start = 0;
  const ace = replaceFileText(files, `/ace/${document}.ace`, (text) => {
    const lines = text.split('\n');
    original = lines[sentence - 1] ?? '';
    const needle = ` ${from} `;
    expect(original.split(needle)).toHaveLength(2);
    start =
      lines.slice(0, sentence - 1).reduce((offset, line) => offset + line.length + 1, 0) +
      original.indexOf(needle) +
      1;
    changed = original.replace(needle, ` ${to} `);
    lines[sentence - 1] = changed;
    return lines.join('\n');
  });
  const pl = replaceFileText(ace, `/pl/${document}.pl`, (text) => {
    const marker = `% S${String(sentence)}: ${original}`;
    expect(text.split(marker)).toHaveLength(2);
    return text.replace(marker, `% S${String(sentence)}: ${changed}`);
  });
  // Keep the bag mutant well-formed so its refusal reaches the contract check, not alignment.
  let moved = 0;
  const aligned = replaceFileText(pl, `/align/${document}.tsv`, (text) =>
    text
      .split('\n')
      .map((line) => {
        const [id, side, position, label] = line.split('\t');
        if (side !== 'ace') return line;
        const offset = Number(position);
        if (offset === start) {
          expect(label).toBe(from);
          moved += 1;
          return [id, side, position, to].join('\t');
        }
        if (offset >= start + from.length)
          return [id, side, String(offset + to.length - from.length), label].join('\t');
        expect(offset + (label?.length ?? 0)).toBeLessThanOrEqual(start);
        return line;
      })
      .join('\n'),
  );
  expect(moved).toBe(1);
  return aligned;
};
const removeHead = (
  predicate: 'guideline_qualifier' | 'guideline_event',
  ending: string,
): Map<string, Uint8Array> => {
  let removed = 0;
  const changed = mutatePlSentence(bagFiles, 'cdc2022-opioid-rec11', 2, (line) => {
    const head = line.split(' :- ')[0]?.replace(/\.$/u, '') ?? '';
    if (!head.startsWith(`${predicate}(`) || !head.endsWith(ending)) return line;
    removed += 1;
    return '';
  });
  expect(removed, `${predicate}${ending} in rec11 S2`).toBe(1);
  return changed;
};
const errorMessage = (files: Map<string, Uint8Array>): string => {
  try {
    clinicalArtifacts(files);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return error.message;
  }
  return '<accepted>';
};
const expectSentenceError = (message: string, document: string, sentence: number): void => {
  expect(message).toContain(document);
  expect(message).toMatch(
    new RegExp(`(?:[: ]S?${String(sentence)}\\b|sentence ${String(sentence)}\\b)`, 'u'),
  );
};
const guide = (): string => readFileSync(join(ROOT, 'server/chat-guide.md'), 'utf8');
const guideExample = (prefix: string, needle: string): string => {
  const matches = [...guide().matchAll(/`([^`]+)`/gu)]
    .map((match) => (match[1] ?? '').replace(/\s+/gu, ' ').trim())
    .filter((text) => text.startsWith(prefix) && text.includes(needle));
  expect(matches, `${prefix} example with ${needle}`).toHaveLength(1);
  return matches[0] ?? '';
};

beforeAll(async () => {
  session = new EngineSession({
    loadImage,
    drain: () => diagnostics.splice(0),
    expected: manifest.contract,
  });
  await session.boot(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))));
  for (const id of QUESTION_IDS) liveAnswers.push(...(await solve(QUESTION_CATALOG[id].goal)));
}, 120_000);

describe('qualifier slot', () => {
  it('Q1 every produced fragment action equals the independent keyed ACE oracle', () => {
    const expected = corpus.flatMap(({ document, clause }) =>
      clause.actions.map((value, index) => [key(document, clause.sentence, index), value] as const),
    );
    const produced = clinicalArtifacts(bagFiles).sentences.flatMap(({ document, clause }) =>
      clause.actions.map((value, index) => [key(document, clause.sentence, index), value] as const),
    );
    expect(corpus.every(({ vocabulary }) => vocabulary.size === 69)).toBe(true);
    expect(expected).toHaveLength(95);
    expect(expected.filter(([, value]) => value.qualifiers.length === 1)).toHaveLength(21);
    expect(expected.filter(([, value]) => value.qualifiers.length === 0)).toHaveLength(74);
    expect(produced).toHaveLength(95);
    const byKey = new Map(produced);
    expect(byKey.size).toBe(95);
    expect([...byKey.keys()].sort()).toEqual(expected.map(([id]) => id).sort());
    for (const [id, value] of expected) expect(byKey.get(id), id).toEqual(value);
  });

  it('Q1 live clinical_rule actions have all 95 keyed values and 21 atom qualifier lists', async () => {
    const rows = await solve('clinical_rule(Doc,Sentence,Rule)');
    expect(rows).toHaveLength(58);
    expect(rows.flatMap(({ bindings }) => actions(bindings.Rule))).toHaveLength(95);
    const expected = new Map(
      corpus.map(({ document, clause }) => [
        `${document}:${String(clause.sentence)}`,
        clause.actions,
      ]),
    );
    const observed: Action[] = [];
    const seen = new Set<string>();
    for (const { bindings } of rows) {
      const document = scalar(bindings.Doc, 'atom');
      expect(bindings.Sentence?.kind).toBe('integer');
      if (bindings.Sentence?.kind !== 'integer') throw new Error('missing sentence ordinal');
      const id = `${document}:${String(bindings.Sentence.value)}`;
      expect(seen.has(id), id).toBe(false);
      seen.add(id);
      const values = actions(bindings.Rule).map(action);
      expect(values, id).toEqual(expected.get(id));
      observed.push(...values);
    }
    expect([...seen].sort()).toEqual([...expected.keys()].sort());
    expect(observed.filter(({ qualifiers }) => qualifiers.length === 1)).toHaveLength(21);
    expect(observed.filter(({ qualifiers }) => qualifiers.length === 0)).toHaveLength(74);
  });

  it('Q1 live clinical_advice groups retain 74 oracle actions and 19 atom qualifier lists', () => {
    const expected = groupedClauses(corpus);
    const answers = liveAnswers.map(({ bindings }) => {
      const [document, groups] = compound(bindings.Answer, 'clinical_answer', 3);
      return { document: scalar(document, 'atom'), groups: list(groups) };
    });
    expect(answers.map(({ document }) => document)).toEqual(documents);
    expect(answers.flatMap(({ groups }) => groups)).toHaveLength(46);
    expect(answers.flatMap(({ groups }) => groups.flatMap(actions))).toHaveLength(74);
    const observed: Action[] = [];
    for (const { document, groups } of answers) {
      const values = groups.map((rule) => actions(rule).map(action));
      expect(values, document).toEqual(expected.get(document)?.map((clause) => clause.actions));
      observed.push(...values.flat());
    }
    expect(observed.filter(({ qualifiers }) => qualifiers.length === 1)).toHaveLength(19);
    expect(observed.filter(({ qualifiers }) => qualifiers.length === 0)).toHaveLength(55);
  });

  it('Q1 the renderer accepts action/5 and rejects every malformed qualifier-list shape', () => {
    const source = corpus.find(
      ({ document, clause }) => document.endsWith('rec11') && clause.sentence === 2,
    );
    if (source === undefined) throw new Error('rec11 S2 missing from the bag');
    const expected = source.clause.actions[0];
    if (expected === undefined) throw new Error('rec11 S2 has no action');
    const answer = liveAnswers.find(
      ({ bindings }) =>
        scalar(compound(bindings.Answer, 'clinical_answer', 3)[0], 'atom') === source.document,
    )?.bindings.Answer;
    const [document, groups, passage] = compound(answer, 'clinical_answer', 3);
    const ruleArgs = compound(list(groups)[0], 'rule', 4);
    const render = (candidate: PlTerm) =>
      presentAnswerTerm(
        {
          kind: 'compound',
          functor: 'clinical_answer',
          args: [
            document as PlTerm,
            terms([
              {
                kind: 'compound',
                functor: 'rule',
                args: [...ruleArgs.slice(0, 3), terms([candidate])],
              },
            ]),
            passage as PlTerm,
          ],
        },
        'engine display',
      );
    const valid = actionTerm(expected);
    expect(render(valid).structured).toBe(true);
    const validArgs = compound(valid, 'action', 5);
    const malformed: readonly [string, PlTerm | undefined][] = [
      ['missing fifth argument', undefined],
      ['atom instead of list', atom(expected.qualifiers[0] ?? '')],
      ['string instead of list', string(expected.qualifiers[0] ?? '')],
      ['string in list', terms([string(expected.qualifiers[0] ?? '')])],
      ['integer in list', terms([{ kind: 'integer', value: 1 }])],
      ['variable in list', terms([{ kind: 'variable', id: 1 }])],
      [
        'compound in list',
        terms([{ kind: 'compound', functor: 'qualifier', args: [atom('carefully')] }]),
      ],
      ['improper list', { kind: 'improper-list', items: [atom('carefully')], tail: atom('tail') }],
    ];
    for (const [name, fifth] of malformed) {
      const shown = render({
        kind: 'compound',
        functor: 'action',
        args: [...validArgs.slice(0, 4), ...(fifth === undefined ? [] : [fifth])],
      });
      expect(shown, name).toMatchObject({
        structured: false,
        text: scalar(passage, 'string'),
        items: [],
      });
    }
  });

  it('Q2 a missing vocabulary file is refused by its own name', () => {
    const missing = new Map(bagFiles);
    const path = vocabularyPath(bagFiles, documents[0] ?? '');
    expect(missing.delete(path)).toBe(true);
    const message = errorMessage(missing);
    expect(message).toContain('vocabulary.tsv');
    expect(message).toMatch(/missing|absent|found 0|no .*vocabulary/iu);
  });

  it('Q2 an empty qualifier vocabulary is refused by its own name', () => {
    const path = vocabularyPath(bagFiles, documents[0] ?? '');
    let removed = 0;
    const empty = replaceFileText(bagFiles, path, (text) =>
      text
        .split('\n')
        .filter((line) => {
          if (!line.startsWith('qualifier\t')) return true;
          removed += 1;
          return false;
        })
        .join('\n'),
    );
    expect(removed).toBe(69);
    const message = errorMessage(empty);
    expect(message).toContain('vocabulary.tsv');
    expect(message).toMatch(/qualifier/iu);
    expect(message).toMatch(/empty|no\b|0\b/iu);
  });

  it('Q2 rec11 S2 refuses a lifted particularly with its qualifier head erased', () => {
    const message = errorMessage(removeHead('guideline_qualifier', ',particularly)'));
    expectSentenceError(message, 'cdc2022-opioid-rec11', 2);
    expect(message).toMatch(/qualifier/iu);
    expect(message).toContain('particularly');
    expect(message).toMatch(/head/iu);
  });

  it('Q2 rec11 S2 refuses prescribe with its event head erased despite body occurrences', () => {
    const changed = removeHead('guideline_event', ',prescribe)');
    const pl = Buffer.from(
      changed.get(filePath(changed, '/pl/cdc2022-opioid-rec11.pl')) ?? [],
    ).toString('utf8');
    expect(pl).toContain('guideline_event(actual,D,prescribe)');
    const message = errorMessage(changed);
    expectSentenceError(message, 'cdc2022-opioid-rec11', 2);
    expect(message).toMatch(/event/iu);
    expect(message).toContain('prescribe');
    expect(message).toMatch(/head/iu);
  });

  it('Q2 a qualified copula is refused before the missing-event check', () => {
    const changed = changeSentence(bagFiles, 'cdc2022-opioid-rec11', 2, 'prescribe', 'is');
    const message = errorMessage(changed);
    expectSentenceError(message, 'cdc2022-opioid-rec11', 2);
    expect(message).toMatch(/copula/iu);
    expect(message).toMatch(/qualifier/iu);
  });

  it('Q2 a new vocabulary word propagates from ACE and its own head without moving the verb', () => {
    const word = 'attentively';
    const vocabulary = vocabularyFor(bagFiles, 'cdc2022-opioid-rec11');
    expect(vocabulary.has(word)).toBe(false);
    let changed = replaceFileText(
      bagFiles,
      vocabularyPath(bagFiles, 'cdc2022-opioid-rec11'),
      (text) => `${text.trimEnd()}\nqualifier\t${word}\tfocus\n`,
    );
    changed = changeSentence(changed, 'cdc2022-opioid-rec11', 2, 'particularly', word);
    let heads = 0;
    changed = mutatePlSentence(changed, 'cdc2022-opioid-rec11', 2, (line) => {
      if (
        !line.startsWith('guideline_qualifier(') ||
        !line.split(' :- ')[0]?.endsWith(',particularly)')
      )
        return line;
      heads += 1;
      return line.replace(',particularly)', `,${word})`);
    });
    expect(heads).toBe(1);
    const expected = corpusSentences(changed, ['cdc2022-opioid-rec11'])[0]?.clause.actions;
    const actual = clinicalArtifacts(changed).sentences.find(
      ({ document, clause }) => document === 'cdc2022-opioid-rec11' && clause.sentence === 2,
    )?.clause.actions;
    expect(expected?.[0]?.qualifiers).toEqual([word]);
    expect(expected?.[0]?.verb).toBe('prescribe');
    expect(actual).toEqual(expected);
  });

  it('Q2 a stacked leading pair parses and rebuilds in surface order', () => {
    const source = corpus.find(
      ({ document, clause }) => document.endsWith('rec11') && clause.sentence === 2,
    );
    if (source === undefined) throw new Error('rec11 S2 missing from the bag');
    const original = source.clause.original.replace(
      'particularly prescribe',
      'particularly carefully prescribe',
    );
    const parsed = parse(original, source.clause.sentence, source.vocabulary);
    expect(parsed.actions[0]).toEqual({
      ...source.clause.actions[0],
      qualifiers: ['particularly', 'carefully'],
    });
    expect(rebuildClause(parsed)).toBe(original);
  });

  it('Q2 generated qualifier sequences preserve order, duplicates, polarity and the remaining action', () => {
    const source = corpus.find(
      ({ document, clause }) => document.endsWith('rec11') && clause.sentence === 2,
    );
    if (source === undefined) throw new Error('rec11 S2 missing from the bag');
    const seed = source.clause.actions[0];
    if (seed === undefined) throw new Error('rec11 S2 action missing');
    const vocabulary = [...source.vocabulary];
    let graded = 0;
    for (const [index] of vocabulary.entries()) {
      for (const length of [0, 1, 2, 5, 8]) {
        const qualifiers = Array.from(
          { length },
          (_, offset) =>
            vocabulary[(index + Math.floor(offset / 2) * 17) % vocabulary.length] ?? '',
        );
        for (const mode of ['should', 'can'] as const) {
          for (const polarity of ['positive', 'negative'] as const) {
            const expected = { ...seed, polarity, qualifiers };
            const model = {
              sentence: 99,
              original: '',
              subject: source.clause.subject,
              mode,
              actions: [expected],
            };
            const original = rebuildClause(model);
            const parsed = parse(original, 99, source.vocabulary);
            expect(parsed.actions, original).toEqual([expected]);
            expect(rebuildClause(parsed), original).toBe(original);
            graded += 1;
          }
        }
      }
    }
    expect(graded).toBe(1380);
  });

  it('Q3 all 46 live rendered statements stay byte-identical in document/group order', () => {
    const presentations = liveAnswers.map(({ bindings, display }) => {
      if (bindings.Answer === undefined) throw new Error('live solution has no Answer binding');
      return presentAnswerTerm(bindings.Answer, display.Answer ?? '');
    });
    expect(presentations.map(({ document }) => document)).toEqual(documents);
    expect(presentations).toHaveLength(12);
    expect(presentations.every(({ structured }) => structured)).toBe(true);
    const items = presentations.flatMap((presentation) => presentation.items);
    expect(items).toHaveLength(46);
    expect(createHash('sha256').update(JSON.stringify(items)).digest('hex')).toBe(
      '3586cbfe6769d90abad67e9fb1f37e2a89ef38e7943681687e726848ee9da67e',
    );
  });

  it('Q4 all 58 ACE sentences rebuild byte for byte with their vocabulary', () => {
    expect(corpus).toHaveLength(58);
    for (const { document, vocabulary, clause } of corpus) {
      const parsed = parse(clause.original, clause.sentence, vocabulary);
      expect(rebuildClause(parsed), `${document}:${String(clause.sentence)}`).toBe(clause.original);
      expect(
        rebuildClause(clause),
        `independent oracle ${document}:${String(clause.sentence)}`,
      ).toBe(clause.original);
    }
  });

  it('Q4 a malformed sentence still fails the lossless guard by name', () => {
    const vocabulary = corpus[0]?.vocabulary;
    expect(vocabulary).toBeDefined();
    if (vocabulary === undefined) throw new Error('no corpus vocabulary');
    expect(() =>
      parse('If then every clinician should consider opioid-therapy.', 99, vocabulary),
    ).toThrowError(/^controlled sentence 99 is not lossless\n {2}source: /u);
  });

  it('Q6 the guide declares action/5 and the leading list without the retired verb-slot defect', () => {
    const text = guide().replace(/\s+/gu, ' ');
    expect(text).toContain('action(Polarity, Verb, Object, Modifiers, Qualifiers)');
    expect(text).toMatch(/Qualifiers[^.]*list/iu);
    expect(text).toMatch(/leading[^.]*qualifier|qualifier[^.]*leading/iu);
    expect(text).not.toContain("`Verb` is the action's first word");
    expect(text).not.toContain('can stand there with the verb opening `Object`');
  });

  it('Q6 the guide positive example is a well-formed action/5 term', async () => {
    const example = guideExample('rule(', 'action(positive');
    const parsed = await solve(`read_term_from_atom(${quoteAtom(example)},Example,[])`);
    expect(parsed).toHaveLength(1);
    const values = actions(parsed[0]?.bindings.Example).map(action);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(({ polarity }) => polarity === 'positive')).toBe(true);
  });

  it('Q6 the guide negative action/5 goal itself answers on the shipped image', async () => {
    const example = guideExample('clinical_rule(', 'action(negative');
    const returned = await solve(example);
    const negative = corpus.filter(({ clause }) => clause.actions[0]?.polarity === 'negative');
    expect(returned).toHaveLength(negative.length);
    expect(returned.length).toBeGreaterThan(0);
    const parsed = await solve(`read_term_from_atom(${quoteAtom(example)},Example,[])`);
    expect(parsed).toHaveLength(1);
    const [, , rule] = compound(parsed[0]?.bindings.Example, 'clinical_rule', 3);
    const pattern = compound(rule, 'rule', 4)[3];
    expect(pattern?.kind).toBe('improper-list');
    if (pattern?.kind !== 'improper-list') throw new Error('negative example has no action prefix');
    const [polarity] = compound(pattern.items[0], 'action', 5);
    expect(scalar(polarity, 'atom')).toBe('negative');
  });
});
