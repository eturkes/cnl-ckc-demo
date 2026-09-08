# test-m5u2 — u2 red suite

| id | finding | evidence |
| --- | --- | --- |
| T1 | pass: GREEN at base by invariance — seven `mi/3` proof bags and `mi_limited/2` semantics stay fixed | 7/7 SHA-12 snapshots match; arities + cap-0/cap-1 control match |
| T2 | pass: GREEN at base by invariance — content sites and gate line lists stay fixed | 686 sites + 48 live gates; ordered hashes `211e14164a47` / `4a9aa7427273` |
| T3 | pass: RED at base — cap declaration and evaluator are absent | `Unknown procedure: clinical_depth/1` |
| T4 | pass: RED at base — single-site erasure cannot call the absent evaluator | `Unknown procedure: clinical_derive/4` at first site `rec01:2:496` |
| T5 | pass: RED at base — withheld-premise traversal is absent | `Unknown procedure: gate_heads/2`; survivor set is empty instead of the ruled 2 |
| T6 | pass: RED at base — no clinical proof exposes assumption leaves | `Unknown procedure: clinical_derive/4` at `rec01:2` |
| T7 | pass: GREEN at base by invariance — shipped source is write-free and schema stays static | 7/7 clause-count/static snapshots stable; direct `assertz` returns `permission` |
| T8 | pass: RED at base — explicit-cap evaluator is absent | `Unknown procedure: clinical_derive/5` at `rec01:2@1` |

## T1

Canonicalizes every existing `mi/3` `(goal,proof)` solution, sorts each bag, and pins the seven base hashes. Also pins `mi/3`, `mi_limited/2`, cap-0 limit success, and cap-1 non-limit failure. Base run: GREEN.

## T2

Pins the independently scanned content-line vector and the keyed gate-line-list vector, proves set equality, then reads all 48 lists from the real image. Base run: GREEN.

## T3

Queries every sentence at caps 1/2/3 plus ruled `/4`; pins 47/48, the sole `rec05:5` cap-1 failure, 48/48 at caps 2/3, and 12 complete cap-2 documents. Base run: RED, `Unknown procedure: clinical_depth/1`.

## T4

Converts the seven schema predicates to dynamic in a second real-image engine. Erases each of 686 exact file/line clause references inside `snapshot/1`; each derivation must fail with `Rule` and `Proof` unbound. Re-derives all 48 afterward. Base run: RED, `Unknown procedure: clinical_derive/4` at `rec01:2:496`.

## T5

With empty assumptions, pins the exact two sentence survivors (`rec10:4`, `rec12:3`) and zero complete documents. In a single schema-erasure snapshot, pins 0/48 sentences and 0/12 complete documents. Base run: RED, `Unknown procedure: gate_heads/2`.

## T6

For all 48 proofs, checks bidirectional premise↔assumption membership, ground leaves, no same literal under `node(line(...))`, sentence-line containment, and exact document-line union. Base run: RED, `Unknown procedure: clinical_derive/4`.

## T7

Scans executable mutation-token forms in `PROOF_SOURCE`; snapshots all seven schema predicates before any derivation and compares counts/static state afterward. A rollback-wrapped direct `assertz` must raise `permission_error(modify,static_procedure,...)`. Base run: GREEN.

## T8

Runs all 48 sentences at each cap 1/2/3 under depth 100 and 100,000 inferences. Every step must terminate as `proved` or `failed` in under the declared 1000 ms, including the four u1 handoffs. Base run: RED, `Unknown procedure: clinical_derive/5`.

## Divergent contract readings

1. **P1 output identity.** Encoded = sorted canonical `(goal,proof)` bags for all seven catalog goals. Alternative = compare projected solutions only. Canonical proof bags pin the stated output invariant, not only extensional answers.
2. **P2 base identity.** Encoded = hermetic ordered SHA-12 pins plus live-image equality. Alternative = invoke `git show` during the test. Fixed hashes keep the suite independent of repository history while preserving byte-sensitive order.
3. **P5 document completion.** Encoded = every sentence gate in a selected document derives. Alternative = reconstruct canonical answer terms. u3 owns reconstruction; u2's finest available full-document predicate is conjunction over its sentence fragments.
4. **P6 assumption multiplicity.** Encoded = bidirectional premise/assumption membership, with no multiplicity constraint. Alternative = require one leaf per premise. One antecedent can recur once per cited head, so the contract constrains honesty and coverage rather than repetition count.
5. **P8 wall time.** Encoded = wall time of each synchronous bounded query. Alternative = time the 144-query campaign. `PROOF_BUDGET_MAX.wallClockMs` applies per proof request, so per-step timing matches the production envelope.
