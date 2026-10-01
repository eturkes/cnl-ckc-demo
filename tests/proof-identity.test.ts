// `.claude/rules/proof.md` clause identity and the probe traps, re-derived against the shipped
// image: a clause is keyed by its `/prolog.pl` line, every key is unique, and the provenance
// chunks recover a text for exactly those lines. The traps are what turn a probe into a vacuous
// pass, so each is pinned here rather than remembered.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';

import { ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const GENERATED = join(ROOT, 'kb', 'generated');
const SCHEMA = [
  'guideline_document(_,_,_)',
  'guideline_entity(_,_,_,_)',
  'guideline_cardinality(_,_,_,_,_)',
  'guideline_event(_,_,_)',
  'guideline_arg(_,_,_,_)',
  'guideline_pp(_,_,_,_)',
  'guideline_property(_,_,_,_)',
  'guideline_operator(_,_,_)',
  'guideline_schema_version(_)',
];

let engine: Engine;

beforeAll(async () => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  engine = await load(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))))({});
}, 120_000);

const once = (goal: string): Record<string, unknown> =>
  engine.prolog.query(goal).once() as Record<string, unknown>;

describe('clause identity', () => {
  it('keys every schema clause by a unique /prolog.pl line the provenance chunks recover', () => {
    const heads = SCHEMA.map((head) => `H = ${head}`).join(' ; ');
    const found = once(
      `findall(L, ((${heads}), clause(H, _, R), clause_property(R, file('/prolog.pl')), ` +
        `clause_property(R, line_count(L))), Ls), length(Ls, N), sort(Ls, U), length(U, M), ` +
        `atomic_list_concat(U, ',', Joined).`,
    );
    expect(found.N).toBe(found.M);
    const lines = new Set(String(found.Joined).split(',').map(Number));
    const recovered = new Map<number, string>();
    for (const file of readdirSync(join(GENERATED, 'provenance', 'documents'))) {
      const chunk = JSON.parse(
        readFileSync(join(GENERATED, 'provenance', 'documents', file), 'utf8'),
      ) as { clauses: { line: number; text: string }[] };
      for (const clause of chunk.clauses) recovered.set(clause.line, clause.text);
    }
    expect([...recovered.keys()].sort((a, b) => a - b)).toEqual([...lines].sort((a, b) => a - b));
    expect([...recovered.values()].filter((text) => text.trim() === '')).toEqual([]);
  });
});

describe('probe traps', () => {
  /** A goal's `S` binding as text. */
  const text = (goal: string): string => String((once(goal).S as { v?: string } | undefined)?.v);

  it('splits `assertz((Head) :- A, B)` into assertz/2 at the body comma', () => {
    const arity = (source: string): unknown =>
      once(`term_string(T, "${source}"), functor(T, _, A).`).A;
    expect(arity('assertz((h) :- a, b)')).toBe(2);
    expect(arity('assertz((h :- a, b))')).toBe(1);
  });

  it('returns a binding-less record from .once() on a failed query', () => {
    expect(engine.prolog.query('X = 1, fail.').once()).toEqual({ success: false });
  });

  it('hands back an assertz permission error as a plain object; catch/3 reads it', () => {
    expect(engine.prolog.query('assertz(guideline_schema_version(2)).').once()).toMatchObject({
      error: true,
    });
    expect(
      text('catch(assertz(guideline_schema_version(2)), E, true), term_string(E, S).'),
    ).toContain('permission_error(modify,static_procedure,guideline_schema_version/1)');
  });
});
