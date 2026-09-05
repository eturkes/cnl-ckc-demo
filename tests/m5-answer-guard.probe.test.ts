// Independent FINAL-term inverse; source expectations come directly from bag ACE.
// This guards wording, not inference. Schema dependency probes own S1.
import { expect, it } from 'vitest';

import type { PlTerm } from '../src/engine/terms.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { bagFiles, bagText, boot, solve } from './m5-probe-support.js';

const fail = (): never => { throw new Error('unsupported final answer shape'); };
const scalar = (term: PlTerm | undefined, kind: 'string' | 'atom'): string =>
  term?.kind === kind ? term.value : fail();
const items = (term: PlTerm | undefined): PlTerm[] => term?.kind === 'list' ? [...term.items] : fail();
const args = (term: PlTerm | undefined, functor: string, arity: number): readonly PlTerm[] =>
  term?.kind === 'compound' && term.functor === functor && term.args.length === arity ? term.args : fail();
const action = (term: PlTerm): string => {
  const [p, v, o, ms] = args(term, 'action', 4);
  const polarity = scalar(p, 'atom');
  if (polarity !== 'positive' && polarity !== 'negative') return fail();
  const parts = [scalar(v, 'atom'), scalar(o, 'string'), ...items(ms).map((modifier) => {
    const [prep, value] = args(modifier, 'modifier', 2);
    return `${scalar(prep, 'atom')} ${scalar(value, 'string')}`;
  })].filter((part) => part !== '');
  return `${polarity === 'negative' ? 'not ' : ''}${parts.join(' ')}`;
};
const expand = (answer: PlTerm): { document: string; sentences: string[] } => {
  const [doc, rules] = args(answer, 'clinical_answer', 3);
  const sentences = items(rules).flatMap((rule) => {
    const [cs, sub, modeTerm, acts] = args(rule, 'rule', 4);
    const subject = scalar(sub, 'string');
    const mode = scalar(modeTerm, 'atom');
    const actions = items(acts).map(action);
    if (actions.length === 0) return fail();
    let predicate;
    if (mode === 'fact') {
      predicate = actions.length === 1 && actions[0]?.startsWith('not is ')
        ? `is not ${actions[0].slice('not is '.length)}`
        : actions.join(' and ');
    } else if (mode === 'should' || mode === 'can') {
      predicate = `${mode} ${actions.join(` and ${mode} `)}`;
    } else return fail();
    const main = `${subject} ${predicate}.`;
    const conditions = items(cs).map((condition) => scalar(condition, 'string'));
    return conditions.length === 0 ? [main] : conditions.map((condition) => `If ${condition} then ${main}`);
  });
  return { document: scalar(doc, 'atom'), sentences };
};
const files = bagFiles();
const check = (answer: PlTerm): void => {
  const { document, sentences } = expand(answer);
  const source = bagText(files, `/ace/${document}.ace`).trimEnd().split('\n').slice(1);
  expect([...sentences].sort(), `${document}:final-term ACE bytes`).toEqual([...source].sort());
};

it('ans.guard: final runtime term expands byte-for-byte to the original ACE multiset', async () => {
  const session = await boot();
  const live: PlTerm[] = [];
  for (const id of QUESTION_IDS) {
    for (const row of await solve(session, QUESTION_CATALOG[id].goal)) {
      const answer = row.bindings.Answer;
      if (answer === undefined) throw new Error('answer absent');
      check(answer);
      live.push(answer);
    }
  }
  expect(live).toHaveLength(12);
  const first = live[0] as PlTerm;
  const clone = (): Extract<PlTerm, { kind: 'compound' }> => structuredClone(first) as Extract<PlTerm, { kind: 'compound' }>;
  const rulesOf = (term: PlTerm) => items(args(term, 'clinical_answer', 3)[1]) as Extract<PlTerm, { kind: 'compound' }>[];
  const actionOf = (term: PlTerm) => items(rulesOf(term)[0]?.args[3])[0] as Extract<PlTerm, { kind: 'compound' }>;
  const mutations: [string, (term: Extract<PlTerm, { kind: 'compound' }>) => void][] = [
    ['mode', (term) => { rulesOf(term)[0]!.args[2] = { kind: 'atom', value: 'can' }; }],
    ['subject', (term) => { rulesOf(term)[0]!.args[1] = { kind: 'string', value: 'Every patient' }; }],
    ['condition', (term) => { rulesOf(term)[1]!.args[0] = { kind: 'list', items: [] }; }],
    ['polarity', (term) => { actionOf(term).args[0] = { kind: 'atom', value: 'negative' }; }],
    ['verb', (term) => { actionOf(term).args[1] = { kind: 'atom', value: 'avoid' }; }],
    ['object', (term) => { actionOf(term).args[2] = { kind: 'string', value: 'an opioid-therapy' }; }],
    ['modifier-preposition', (term) => {
      const modifier = items(actionOf(term).args[3])[0] as Extract<PlTerm, { kind: 'compound' }>;
      modifier.args[0] = { kind: 'atom', value: 'against' };
    }],
    ['modifier-value', (term) => {
      const modifier = items(actionOf(term).args[3])[0] as Extract<PlTerm, { kind: 'compound' }>;
      modifier.args[1] = { kind: 'string', value: 'a chronic-pain' };
    }],
    ['drop-action', (term) => {
      const rule = rulesOf(term)[2]!;
      rule.args[3] = { kind: 'list', items: items(rule.args[3]).slice(1) };
    }],
    ['reorder-modifiers', (term) => {
      const act = items(rulesOf(term)[2]!.args[3])[0] as Extract<PlTerm, { kind: 'compound' }>;
      act.args[3] = { kind: 'list', items: items(act.args[3]).reverse() };
    }],
    ['duplicate-rule', (term) => { term.args[1] = { kind: 'list', items: [...rulesOf(term), rulesOf(term)[0]!] }; }],
    ['wrong-document', (term) => { term.args[0] = { kind: 'atom', value: 'cdc2022-opioid-rec02' }; }],
  ];
  for (const [label, mutate] of mutations) {
    const mutant = clone();
    mutate(mutant);
    expect(() => check(mutant), `${label}:post-emission mutation must fail`).toThrow();
  }
  console.log(JSON.stringify({ terms: live.length, sentences: live.reduce((n, term) => n + expand(term).sentences.length, 0),
    negativeControls: mutations.map(([label]) => label), results: '12/12 RED', scope: 'wording equivalence only; S1 separate' }));
}, 120_000);
