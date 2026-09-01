// Red suite for M1.u2, written diff-blind from `.scratch/contract-m1u2.md`.
// Every case names the contract predicate it binds to. A case that cannot fail
// against a wrong implementation is not a test — replace it, never weaken it.
//
// SEED STATE: every body throws. Replace each with a real assertion driving the
// u2 surface. Keep the names and the predicate tags.

import { describe, it } from 'vitest';

const todo = (): never => {
  throw new Error('unimplemented');
};

describe('P3 term decode/encode', () => {
  it('P3.2 decodes foo(bar,7) distinctly from foo([bar,7])', todo);
  it('P3.2 preserves compound arity against the argument-vector ambiguity', todo);
  it('P3.3 decodes 1r3 as a rational without flipping to 3r1', todo);
  it('P3.3 decodes 3r1 as the integer 3', todo);
  it('P3.4 distinguishes an atom from a Prolog string carrying identical text', todo);
  it('P3.5 decodes an integer above 2^53 without precision loss', todo);
  it('P3.5 decodes negative and zero integers', todo);
  it('P3.5 decodes a float distinctly from an integer', todo);
  it('P3.6 decodes an unbound variable to an explicit variable value', todo);
  it('P3.6 preserves variable identity shared across two arguments', todo);
  it('P3.1 decodes an empty list distinctly from an empty compound', todo);
  it('P3.1 decodes an improper list with its tail intact', todo);
  it('P3.1 decodes a nested compound ref(1)', todo);
  it('P3.1 decodes a deeply nested compound', todo);
  it('P3.1 decodes an operator term', todo);
  it('P3.1 decodes the empty atom and an atom containing a quote', todo);
  it('P3.8 round-trips the real guideline_id answer shape exactly', todo);
  it('P3.7 round-trips decode to encode to re-query as an identity', todo);
  it('P3.10 never re-enters a native engine value into a query', todo);
  it('P3.11 fails closed with a typed decode error on an unrecognized tag', todo);
  it('P3.12 keeps production code free of JSON.stringify over engine values', todo);
});

describe('P4 canonical display text', () => {
  it('P4.1 renders display text that re-reads as the same term', todo);
  it('P4.2 quotes $-prefixed, hyphenated and mixed-case atoms so they re-read', todo);
  it('P4.3 derives display text rather than templating it per predicate', todo);
});

describe('P2 protocol', () => {
  it('P2.1 sends only structured-clone-safe payloads', todo);
  it('P2.2 echoes the request id on every response', todo);
  it('P2.2 reports an unmatched response id as a typed protocol violation', todo);
  it('P2.3 terminates every request in exactly one terminal outcome', todo);
  it('P2.3 leaves no request pending after its terminal response', todo);
  it('P2.5 rejects every in-flight request when the worker fails', todo);
  it('P2.3 keeps two concurrent requests correlated', todo);
});

describe('P1/P5 live contract', () => {
  it('P1.3 reads schema version and document count out of the booted engine', todo);
  it('P1.3 fails typed when the engine contract mismatches the manifest', todo);
  it('P1.4 surfaces boot failure as a typed terminal state', todo);
  it('P1.5 serves a second query without re-booting the engine', todo);
  it('P5.2 executes a real KB goal and returns the 7 category-A solutions', todo);
  it('P5.3 changes its result when a dynamic overlay clause is injected', todo);
  it('P5.5 fails rather than skips when kb/generated is absent', todo);
});
