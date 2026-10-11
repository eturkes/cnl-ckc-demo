// chat-c1 G10: independent grammar from the committed contract, not production tables.
import { describe, expect, it } from 'vitest';

import { guardGoal, READONLY_GOAL_MAX } from '../src/engine/readonly.js';
import type { PlTerm } from '../src/engine/terms.js';

const KB = `guideline_arg/4 guideline_cardinality/5 guideline_document/3
  guideline_entity/4 guideline_event/3 guideline_operator/3 guideline_pp/4
  guideline_property/4 guideline_schema_version/1 clinical_advice/3 clinical_advice/4
  clinical_rule/3 clinical_premise/4 clinical_gate/4 clinical_source/3 clinical_passage/2
  clinical_context/3 clinical_derive/4`.split(/\s+/u);
const DATA = String.raw`=/2 \=/2 ==/2 \==/2 @</2 @>/2 @=</2 @>=/2 compare/3
  is/2 =:=/2 =\=/2 </2 >/2 =</2 >=/2 succ/2 plus/3 between/3
  var/1 nonvar/1 atom/1 number/1 integer/1 float/1 atomic/1 compound/1 callable/1
  is_list/1 string/1 ground/1 memberchk/2 length/2 msort/2 sort/2 sort/4 keysort/2
  max_list/2 min_list/2 '$member'/2 '$append'/3 sub_string/5 string_concat/3
  split_string/4 string_lower/2 string_upper/2 string_code/3 string_codes/2
  string_length/2 sub_atom_icasechk/3 atom_length/2 text_to_string/2 copy_term/2
  term_variables/2 arg/3 =../2`
  .replaceAll("'", '')
  .split(/\s+/u);
const CONTROL: ReadonlyArray<readonly [string, readonly number[]]> = [
  [',/2', [0, 1]],
  [';/2', [0, 1]],
  ['->/2', [0, 1]],
  ['*->/2', [0, 1]],
  ['\\+/1', [0]],
  ['not/1', [0]],
  ['once/1', [0]],
  ['ignore/1', [0]],
  ['forall/2', [0, 1]],
  ['findall/3', [1]],
  ['findall/4', [1]],
  ['bagof/3', [1]],
  ['setof/3', [1]],
  ['^/2', [1]],
];
const ATOMS = ['true', 'fail', 'false', '!'];
const REFUSED = `assertz/1 retract/1 nb_setval/2 set_prolog_flag/2 consult/1 halt/0
  atom_concat/3 atom_string/2 atom_codes/2 atom_chars/2 atom_number/2 sub_atom/5
  upcase_atom/2 term_to_atom/2 char_code/2 number_codes/2 number_string/2 string_chars/2 functor/3
  member/2 append/3 nth0/3 nth1/3 last/2 sum_list/2 aggregate_all/3
  call/0 call/1 call/2 call/3 call/4 call/8 catch/3 freeze/2 :/2
  clinical_derive/5 clinical_advice_source/4 guideline_entity/3 not_in_contract/2`.split(/\s+/u);
const atom = (value: string): PlTerm => ({ kind: 'atom', value });
const variable = (id = 1): PlTerm => ({ kind: 'variable', id });
const compound = (functor: string, ...args: PlTerm[]): PlTerm => ({
  kind: 'compound',
  functor,
  args,
});
const indicator = (term: PlTerm): string | undefined =>
  term.kind === 'atom'
    ? `${term.value}/0`
    : term.kind === 'compound'
      ? `${term.functor}/${String(term.args.length)}`
      : undefined;
const fromIndicator = (pi: string, fill: () => PlTerm = variable): PlTerm => {
  const slash = pi.lastIndexOf('/');
  const name = pi.slice(0, slash);
  const arity = Number(pi.slice(slash + 1));
  return arity === 0 ? atom(name) : compound(name, ...Array.from({ length: arity }, fill));
};

// Reference = expand only declared goal slots into a DFS queue; data never enters the queue.
function reference(goal: PlTerm, names: readonly string[] = []): boolean {
  if (names.some((name) => /^_(?:G)?[0-9]+$/u.test(name))) return false;
  const pending: PlTerm[] = [goal];
  let readsKB = false;
  while (pending.length > 0) {
    const term = pending.shift();
    if (term === undefined) throw new Error('empty reference work item');
    if (term.kind === 'atom') {
      if (!ATOMS.includes(term.value)) return false;
      continue;
    }
    if (term.kind !== 'compound') return false;
    const pi = indicator(term) ?? '';
    if (pi === 'clause/2') {
      const head = term.args[0];
      if (head === undefined || !KB.includes(indicator(head) ?? '')) return false;
      readsKB = true;
      continue;
    }
    if (KB.includes(pi)) {
      readsKB = true;
      continue;
    }
    if (DATA.includes(pi)) continue;
    const slots = CONTROL.find(([signature]) => signature === pi)?.[1];
    if (slots === undefined) return false;
    pending.unshift(
      ...slots.map((index) => {
        const child = term.args[index];
        if (child === undefined) throw new Error('reference control has no declared slot');
        return child;
      }),
    );
  }
  return readsKB;
}

const DATA_SHAPES: PlTerm[] = [
  atom('assertz'),
  atom(''),
  atom('[]'),
  { kind: 'string', value: 'call(X)' },
  { kind: 'integer', value: 0 },
  { kind: 'integer', value: 9007199254740993n },
  { kind: 'float', value: 1.5 },
  { kind: 'rational', numerator: 3, denominator: 4 },
  variable(),
  { kind: 'list', items: [] },
  { kind: 'list', items: [compound('assertz', atom('x')), variable()] },
  { kind: 'improper-list', items: [atom('x')], tail: variable(2) },
  { kind: 'dict', tag: 'q', entries: { body: compound('halt') } },
  compound(':', atom('user'), compound('assertz', atom('x'))),
];

const anchored = (goal: PlTerm): PlTerm =>
  compound(',', compound('guideline_schema_version', variable(99999)), goal);
const compare = (goal: PlTerm, names: readonly string[] = [], withKB = true): boolean => {
  const input = withKB ? anchored(goal) : goal;
  const expected = reference(input, names);
  const actual = guardGoal(input, names);
  expect(actual.ok, `${indicator(goal) ?? goal.kind}; names=${names.join(',')}`).toBe(expected);
  if (!actual.ok) expect(actual.reason.length).toBeGreaterThan(0);
  return expected;
};

describe('independent read-only grammar', () => {
  it('G10 exports the contracted text bound', () => {
    expect(READONLY_GOAL_MAX).toBe(2048);
  });

  it('G10 admits every declared data predicate and refuses neighboring arities', () => {
    expect(KB).toHaveLength(18);
    for (const pi of [...KB, ...DATA]) {
      expect(compare(fromIndicator(pi)), pi).toBe(true);
      const term = fromIndicator(pi);
      if (term.kind !== 'compound') throw new Error(`data predicate has no args: ${pi}`);
      for (const delta of [-1, 1]) {
        const other = compound(
          term.functor,
          ...Array.from({ length: term.args.length + delta }, () => variable()),
        );
        compare(other);
      }
    }
    for (const value of ATOMS) expect(compare(atom(value))).toBe(true);
  });

  it('G10 refuses every excluded family and every non-callable goal shape', () => {
    for (const pi of REFUSED) expect(compare(fromIndicator(pi)), pi).toBe(false);
    for (const term of DATA_SHAPES) expect(compare(term), term.kind).toBe(false);
    for (let arity = 0; arity <= 64; arity += 1)
      expect(compare(fromIndicator(`call/${String(arity)}`))).toBe(false);
    for (let i = 0; i < 64; i += 1)
      expect(compare(compound(`unlisted_${String(i)}`, atom('true')))).toBe(false);
  });

  it('G10 inspects every control goal slot and no data slot', () => {
    for (const [pi, slots] of CONTROL) {
      const template = fromIndicator(pi, () => atom('true'));
      if (template.kind !== 'compound') throw new Error(`control lacks args: ${pi}`);
      expect(compare(template), pi).toBe(true);
      for (let index = 0; index < template.args.length; index += 1) {
        for (const bad of [variable(), compound('assertz', atom('x')), ...DATA_SHAPES]) {
          const args = [...template.args];
          args[index] = bad;
          expect(
            compare(compound(template.functor, ...args)),
            `${pi} arg ${String(index + 1)}`,
          ).toBe(!slots.includes(index));
        }
      }
    }
  });

  it('G10 data replacement cannot change admission for any data-only predicate', () => {
    let graded = 0;
    for (const pi of [...KB, ...DATA]) {
      for (const data of DATA_SHAPES) {
        expect(compare(fromIndicator(pi, () => structuredClone(data))), pi).toBe(true);
        graded += 1;
      }
    }
    expect(graded).toBe((KB.length + DATA.length) * DATA_SHAPES.length);
    expect(graded).toBeGreaterThan(1000);
  });

  it('G10 restricts clause heads to the eighteen KB indicators and leaves bodies as data', () => {
    for (const pi of KB)
      expect(
        compare(compound('clause', fromIndicator(pi), compound('assertz', atom('x')))),
        pi,
      ).toBe(true);
    for (const head of [
      variable(),
      ...DATA_SHAPES,
      ...DATA.map((pi) => fromIndicator(pi)),
      ...REFUSED.map((pi) => fromIndicator(pi)),
    ])
      expect(compare(compound('clause', head, variable(2)))).toBe(false);
  });

  it('G10 rejects reserved variable names but preserves neighboring names', () => {
    const allowed = ['_', '_G', '_g123', '_G123x', '_123x', 'A123', '__123', '_Ｇ123'];
    const refused = ['_0', '_123', '_000', '_G0', '_G123', '_G000'];
    for (const name of allowed) expect(compare(atom('true'), [name]), name).toBe(true);
    for (const name of refused)
      expect(compare(compound('=', variable(), atom('x')), ['X', name, 'Y']), name).toBe(false);
  });

  it('G10 requires a KB read in goal position, never a KB-shaped datum', () => {
    for (const pi of KB) {
      const kb = fromIndicator(pi);
      expect(compare(kb, [], false), pi).toBe(true);
      expect(compare(compound('clause', kb, variable()), [], false), pi).toBe(true);
      expect(compare(compound('=', variable(), kb), [], false), pi).toBe(false);
    }
    for (const goal of [...DATA.map((pi) => fromIndicator(pi)), ...ATOMS.map(atom)]) {
      expect(compare(goal, [], false)).toBe(false);
      const verdict = guardGoal(goal, []);
      if (verdict.ok) throw new Error('goal without KB read admitted');
      expect(verdict.reason).toBe('the goal reads no KB predicate');
    }
    for (const [pi, slots] of CONTROL) {
      const template = fromIndicator(pi, () => atom('true'));
      if (template.kind !== 'compound') throw new Error('control lacks arguments');
      expect(compare(template, [], false), pi).toBe(false);
      for (let index = 0; index < template.args.length; index += 1) {
        const args = [...template.args];
        args[index] = compound('guideline_schema_version', variable());
        expect(
          compare(compound(template.functor, ...args), [], false),
          `${pi} arg ${String(index + 1)}`,
        ).toBe(slots.includes(index));
      }
    }
  });

  it('G10 names the first refused goal in depth-first left-to-right order', () => {
    const bad = compound(
      ',',
      compound('once', compound(';', atom('true'), compound('assertz', atom('x')))),
      compound('atom_concat', atom('a'), atom('b'), variable()),
    );
    const first = guardGoal(anchored(bad), []);
    expect(first.ok).toBe(false);
    if (first.ok) throw new Error('refused tree admitted');
    expect(first.reason).toContain('assertz/1');
    const swapped = guardGoal(
      anchored(compound(',', compound('atom_concat', atom('a'), atom('b'), variable()), bad)),
      [],
    );
    expect(swapped.ok).toBe(false);
    if (swapped.ok) throw new Error('refused tree admitted');
    expect(swapped.reason).toContain('atom_concat/3');
  });

  it('G10 agrees with the independent oracle over seeded control trees of depth six to nine', () => {
    let state = 0xc1a110;
    const choose = (size: number): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % size;
    };
    const pick = <T>(items: readonly T[]): T => {
      const item = items[choose(items.length)];
      if (item === undefined) throw new Error('empty generator domain');
      return item;
    };
    const wrap = (leaf: PlTerm, depth: number): PlTerm => {
      if (depth === 0) return leaf;
      const [pi, slots] = pick(CONTROL);
      const template = fromIndicator(pi, () => structuredClone(pick(DATA_SHAPES)));
      if (template.kind !== 'compound') throw new Error('generated control is not compound');
      for (const index of slots) template.args[index] = atom(pick(ATOMS));
      template.args[pick(slots)] = wrap(leaf, depth - 1);
      return template;
    };
    let yes = 0;
    let no = 0;
    for (let index = 0; index < 600; index += 1) {
      const leaf =
        index % 3 === 0
          ? fromIndicator(pick([...KB, ...DATA]), () => structuredClone(pick(DATA_SHAPES)))
          : index % 3 === 1
            ? fromIndicator(pick(REFUSED))
            : variable();
      const goal = wrap(leaf, 6 + (index % 4));
      if (compare(goal)) yes += 1;
      else no += 1;
    }
    expect({ yes, no }).toEqual({ yes: 200, no: 400 });
  });
});
