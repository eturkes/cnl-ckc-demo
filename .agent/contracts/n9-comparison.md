# n9 — the meta-interpreter derives through a comparison built-in · kernel

Queue row `The meta-interpreter fails closed on a comparison built-in` (MAINTAIN n9). Approved
(user): it flips a declared pin and adds a leaf the ladder (an accepted surface) shows.

## What ships today (measured at `b8dbff8`)

- `schema.pl` defines `guideline_satisfies/4,6` (over `guideline_within/4` + `guideline_scale/3`);
  rule bodies in 30 documents call it, and the `tablet-use-spacing` export calls it in its goal.
  Upstream's traces record each call as a line-free `builtin(G)` leaf
  (`queries/traces/tablet-use-spacing.pl`: `builtin(guideline_satisfies(geq,4,hour,geq,4,hour))`
  between `clause(…)` items).
- `derive/5` (`tools/kb/proof.mjs` `PROOF_SOURCE`) has arms for `true`, `user:`, `,`, `\+`,
  `clinical_advice/3`, an assumption, the depth cap and `resolve/3`; `resolve/3` whitelists the 19
  schema indicators. A comparison matches none, so any derivation through one FAILS while the
  plain goal succeeds. `tests/clinical-inference.test.ts` P1 pins that as a declared limit:
  `mi(guideline_satisfies(exactly,60,geq,50),5,_)` → `Derived: 'no'` beside `Plain: 'yes'`.
- No shipped proof reaches a comparison: every catalog goal derives through the 12
  recommendation documents, whose antecedents hold none (`clinical.mjs` refuses one at build), and
  the chat runs goals, never proofs. The session's proof RPC is `mi(Goal, 1, P)`
  (`src/engine/session.ts` `metaGoal`).
- The decoder (`EngineSession.#proofSteps`) knows `node/3`, `assumption/1`, `naf/1` and throws
  `DecodeError('proof tree contains an invalid node')` on anything else. The ladder lists clause
  steps, then two line-free lists: assumed premises and goals proved absent.

## The change

1. `PROOF_SOURCE`: `comparison_goal(guideline_satisfies(_,_,_,_)).`,
   `comparison_goal(guideline_satisfies(_,_,_,_,_,_)).`, and one `derive/5` arm placed after the
   `clinical_advice/3` arm and before the assumption arm:
   `derive(G,_,_,[builtin(G)],proved) :- comparison_goal(G), !, call(G).`
   The built-in is evaluated, never assumed and never resolved against a clause: no line, no depth
   cost, no premise can stand in for it (an assumption stands in for a schema relation alone,
   `schema_goal/1`). A false comparison fails the derivation, as it fails the plain goal. It sits
   last in the payload, so no content-site line moves.
2. Protocol: `ProofComparison { kind: 'comparison'; goal: string }` joins the `ProofStep` union;
   `#proofSteps` decodes `builtin/1` holding a compound into it, its goal rendered by the engine
   like a negation's. Any other `builtin` shape stays a `DecodeError`.
3. Model + ladder: `proofComparisons(steps)` (distinct goals, first-appearance order, like
   `proofNegations`); the ladder adds a third line-free list after goals proved absent — count
   summary, one origin sentence, each goal with a `checked` badge — rendered only when a proof holds
   a comparison. English + Japanese copy; `copy:check` grades both.
4. P1's declared limit flips to `Derived: 'yes'` (user approval; the original firing recorded here).

## Acceptance predicates

Amended before code from consultant-5's review (8/8 rows: C1 C2 C7 pass; C3–C6, C8 corrections
adopted, listed under the table).

| id | predicate | how it is decided |
| --- | --- | --- |
| K1 | `mi(guideline_satisfies(exactly,60,geq,50),D,P)` proves at depth 5 AND at depth 0 with `P = [builtin(guideline_satisfies(exactly,60,geq,50))]`; `guideline_satisfies(exactly,40,geq,50)` fails at both depths and `mi_limited/2` reads no limit; `\+` over the false comparison proves with a `naf/1` leaf and over the true one fails; `user:` unwraps to the same proof; another module keeps `limit` | live image, node project |
| K2 | `/6` converts through `guideline_scale/3`: `(exactly,240,minute,geq,4,hour)` proves, `(exactly,239,minute,geq,4,hour)` fails, `(exactly,1,month,geq,30,day)` fails (calendar and time never compare) | live image |
| K3 | `rec02-imp07` S1's `guideline_operator(actual,'$guideline_id'(context,'cdc2022-opioid-rec02-imp07',1,box(1),[n9_patient,n9_pain,n9_joint,n9_have,n9_clinician]),may)` derives at depth 2 under twelve ground premises (patient, osteoarthritis-pain, joint and clinician entities; their `na,eq,1` cardinalities, the joint's `na,exactly,3`; `have` event, args 1/2, pp `in` joint), its clause node holding `builtin(guideline_satisfies(exactly,3,geq,2))` among assumption leaves; the joint at `exactly 1` fails | `derive/5`, live image |
| K4 | No premise stands in for a comparison: an assumption list holding `guideline_satisfies(exactly,40,geq,50)` does not prove it | base-GREEN, declared: the base fails it too (no arm at all); uncredited |
| K5 | `EngineSession.prove` over the `tablet-use-spacing` goal settles `proof`: a nonempty clause set, every clause step a line, exactly one `comparison` step `guideline_satisfies(geq,4,hour,geq,4,hour)` and no line on it; at base the same request settles `limit` (recorded, consultant-5 probe) | node project |
| K7 | Given a source-bearing proof whose clause children hold comparisons, the ladder lists each distinct comparison once in first-appearance order with the `checked` badge and no line, both locales; the graph-focus payload stays clause lines alone; a proof without one renders no such list; a documentless proof keeps today's hidden ladder | dom test |
| K8 | Every shipped clinical proof and catalog answer is unchanged: P1's seven goal-and-proof digests, the 12 proofs, 43 statements, marks, clause-line identity, cold proof budgets | existing suites through `pnpm gate` |
| K9 | P1 reads `Derived: 'yes'`; its original firing (`Derived: 'no'`, pinned at `b8dbff8`) recorded in the closing commit | `tests/clinical-inference.test.ts` |
| K10 | The new list renders in a real browser from a genuine comparison proof — the ladder mounted with the steps K5's session returns — in both locales at desktop and mobile widths, inspected; shipped catalog views unchanged | scratch probe page + screenshots (visual QA, not a gate check) |
| K11 | `pnpm gate` rc 0 | gate |

Red witnesses: K1–K3, K5 and K7 RED on the unfixed tree (`b8dbff8`) by assertion, never by
import, timeout or a missing fixture. K4 is base-GREEN (declared above).

Amendments: K5 names `prove` and its real base state (`limit`, not `failure`); K2 crosses units
and dimensions; K1 adds depth 0, negation and module controls; K3 pins its exact head and twelve
premises; K6 (a decoder refusal of `builtin/1` over a non-compound) leaves the set — `derive/5`
cannot emit one, so the guard is defensive and has no reachable input; K7 needs a source-bearing
proof; K10 adds the browser path a catalog smoke cannot reach.

## Out of scope

`clinical_marks/3` reads top-level `node/3` items and fails a sentence on any other; no catalog
sentence holds a comparison, so marks stay as they are. The graph's `satisfies` threshold edges
(sync-u2) are untouched.
