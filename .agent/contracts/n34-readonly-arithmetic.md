# n34 — read-only arithmetic twins: contract, red witness, firing record

Queue row `A loop of capped arithmetic holds one engine step past the wall clock` (`.agent/deferred.md`
at `9736d24`). User ruling: solve it here, else route to IMPLEMENT.

## Contract

- Accept (the row's own): the 400-byte quotient, 400-byte product and 250-byte remainder loops each
  end inside `wallClockMs + HARD_GRACE_MS` with the engine still answering, graded by a G9 row in
  `tests/engine-readonly-budget.test.ts`.
- Mechanism: the read-only parse rewrites each `is/2`, comparison and schema arithmetic or comparison
  built-in in a goal position (`src/engine/readonly.ts` `CONTROL`) to a twin compiled into the image
  (`tools/kb/readonly-arithmetic.mjs`) that evaluates one operation per inference over integers
  within 62 bits and floats, refusing past the bound with `resource_error(read_only_arithmetic)`.
- Value preservation: where a twin returns a value it is `is/2`'s value (A2); no data position is
  rewritten (A1); no expression holds a twin for long (A3).

## Red witness at base `9736d24` (the 1000-byte cap alone)

`pnpm exec vitest run tests/engine-readonly-budget.test.ts tests/readonly-arithmetic.test.ts -t
'G9 a loop|A1|A2|A3'` with this unit's two suites over the base tree → rc 1, 6 red:

- A1, A2, A3: the base image carries no twin.
- G9 a loop of a 400-byte quotient: `expected 18765.618715 to be less than 5500`.
- G9 a loop of a 400-byte product: `expected 61626.05183 to be less than 5500`.
- G9 a loop of a 250-byte remainder: `expected 71075.92715000002 to be less than 5500`.

Measured on the i7-8650U at a 1-min load of 8–15 from other sessions. Base-green and declared:
`G9 a loop of admitted arithmetic` — native `is/2` over small integers already ended on the
inference budget, so the row pins that the twins keep it so; no mutation tool reaches the Prolog
source, so it stays uncredited.

## Firing record

The suite over images built from a wrong twin, one edit of `tools/kb/readonly-arithmetic.mjs` each,
`pnpm kb:build` then `pnpm exec vitest run tests/readonly-arithmetic.test.ts` → rc 1:

- The rewrite entering a `findall/3` template: `findall/3: expected { rewritten: [ 1, 2 ], kept: [ 3
  ] } to deeply equal { rewritten: [ 2 ], kept: [ 1, 3 ] }`.
- The bound widened to 120 bits: `2**62: expected '4611686018427387904' to be 'error'`.
