# rel-u1 — re-vendor release `kb-2026-10-29-rc.1`

Base `4b8b8b3`, bag `g8a51bf0c8722` (385 documents, 19 indicators). Target = release
`kb-2026-10-29-rc.1` (tag at producer `27a0e355`): archive
`cnl-ckc-kb-only-2026-10-29-rc.1.tar.gz` sha256 `c8cc65d6…eb50a5` (sidecar = GitHub asset digest),
bag `g673b3c1f3bfd` — 492 documents, 22 indicators, a scope guard `\+
guideline_exclusion('cdc-2022-opioid')` on 1220 `should`/`must`/`may` edges over 340
documents, a supersession guard on `cdc2022-opioid-rec12-imp08`, `guideline_product/6` +
`guideline_quotient/6` in `schema.pl`, singletons written `_`, binding-first bodies, all 12
catalog documents rewritten. Tier `kernel` (answer path). Queue row: `.agent/deferred.md` `KB
intake reads a sibling cnl-ckc checkout, not a release`; the intake tool is rel-u2.

## User rulings

- Round 1: full sync this session; T9 declared edits (`provenance.mjs` ARITIES +3,
  BODY_BUILTINS +2; `clinical.mjs` fact verbs {includes, increases, shows}); read-only allowlist
  +3 indicators +2 built-ins; new semantics carried through, UI surfacing queued; upstream's
  spec sources vendored (rel-u2).
- Round 2: proof depth bound 100 → 256; S5 graph gzip cap 508,572 → 786,955 B by its own recipe
  (604,372 B without scopes + the ruled 182,583 B); marks nouns fall back to the entity premise
  (ann-u1 amended); oracle edits — scope-guard reading, fact verbs + evaluation-date exemption, A4
  planted input.
- Round 3: X1, X2, X3 and X5 below approved; X4 reported as a finding and queued. Round 4: X6
  approved.

## Acceptance

| id | predicate | witness |
|---|---|---|
| A1 | `pnpm kb:build` is green on the release bag | red at base, in order as plumbing landed: `prolog-body-arity: guideline_exclusion/1`; `controlled sentence 2 uses an unsupported clause form` (rec01 S2); `cdc2022-opioid-rec01:3: 2 distinct antecedents, expected one`; `graph: line 15247: comparison constrains no cardinality` |
| A2 | every scope guard is a real search: `resolve/3` names every indicator the bag declares, the guard ends at a limit below depth 2, and an exclusion the premises satisfy blocks its recommendation (`tests/proof-guard.test.ts` G1–G3) | 5/5 RED at base: `git show 4b8b8b3:tools/kb/proof.mjs > tools/kb/proof.mjs && pnpm kb:build && pnpm exec vitest run tests/proof-guard.test.ts` → G1 `[ [ 'guideline_exclusion', 1 ], …(2) ]` unnamed, G2 `[ 'proved', 'proved', 'proved' ]`, G3 `'derived'` for `'blocked'`, G4 `{ interpreter: 'in_scope' }` for `'excluded'`, G5 `'blocked'` for `'derived'` at 20221228. The base interpreter proved the guard at every depth in 0 ms |
| A3 | every catalog sentence derives at `clinical_depth(4)`, the least sufficient cap (`tests/clinical-inference.test.ts` P3) | per-sentence probe over the image: cap 2 → 7/58, cap 3 → 32/58, cap 4 → 58/58, cap 5 → 58/58 |
| A4 | every catalog document carries marks (`tests/marks-readings-live.test.ts` U1) | red before the noun fallback: `expected 'failure' to be 'solutions'` (rec01 S6, rec02 S2–S3, S10–S13 anchors are antecedent referents) |
| A5 | every corpus figure in the rules, `Decisions` and the pinned checks is re-derived and re-pinned | `tests/census.test.ts` 92 rules figures drifted on the new bag; the suite's red record on the new bag with plumbing alone: 94 of 1,701 failed in 31 files |
| A7 | the guard reads an exclusion and its exception as native Prolog does, in either premise order (`tests/proof-guard.test.ts` G4), and a superseded statement derives only under an earlier evaluation date (G5) | G4 red under the first-choice assumption arm: `expected { interpreter: 'excluded', …(1) } to deeply equal { interpreter: 'in_scope', …(1) }` (consultant-1 C5); G5 red on the base interpreter, which names no `guideline_evaluation_date/1` (A2's 5/5) |
| A6 | the read-only guard admits the new indicators and built-ins, each driven with hostile data (`tests/engine-readonly-guard.test.ts` G10, `tests/engine-readonly-session.test.ts` G3, `tests/engine-readonly-budget.test.ts` G9) | G10 `expected 31` against the base list of 28 |

## Grader edits, each with the original check's red on the new bag

| id | check | edit | original red |
|---|---|---|---|
| E1 | T9 frozen surfaces | declared edits: ARITIES +3, BODY_BUILTINS +2 with its comment; fact-verb arm | `parseAdviceSentence: d108a28730a4` → `078a98ce9083` |
| E2 | chat-c1 allowlist, G10 | +`guideline_evaluation_date/1`, `guideline_exclusion/1`, `guideline_supersession/4`, `guideline_product/6`, `guideline_quotient/6` | `expected 28` |
| E3 | T5, T6, `tools/clinical-reference.mjs`, marks-admitted G3 | a sentence's antecedent read without the scope guard, its key from `vocabulary.tsv` | T5/T6 `rec01:3 … length 1 but got 2`; D1 `cdc2022-opioid-rec01:S3 has 2 antecedents`; G3 `cdc2022-opioid-rec03:2: 2 distinct antecedents` |
| E4 | qualifier oracle | fact verbs {includes, increases, shows} | `oracle: unrecognized consequent Every nonopioid-therapy shows …` |
| E5 | graph-annotations A1 | the evaluation-date comparison exempt | `line 15247 not shown: cdc2022-opioid-rec12-imp08\|1\|threshold\|<no cardinality>` |
| E6 | graph-annotations A4 | grades a copy whose s31-04 S2 states its condition under `-` | `expected 0 to be greater than 0` |
| E7 | marks oracle, U1 oracle | noun from the clause's own entity literal | `oracle unresolved noun E`; `cdc2022-opioid-rec01: unresolved E` |
| E8 | P8, `bounded` | `PROOF_BUDGET_MAX.depth` 100 → 256 | `cdc2022-opioid-rec05:6@1: expected [ 'proved', 'failed' ] to include 'depth'` |
| E9 | S5 | gzip cap 786,955 B | `expected 655789 to be less than or equal to 508572` |
| X1 | P7 `schemaState` | `number_of_clauses(N)` read as 0 when absent | `expected false to be true` (`guideline_evaluation_date/1` declared, no clause) |
| X2 | `PROOF_BUDGET_MAX.wallClockMs`, P8 | 1000 → 3000 | B2/B4 `when-to-use-opioids/cdc2022-opioid-rec02: got limit` at suite load 7 (rec02 257 ms, rec09 218 ms idle) |
| X5 | `PROOF_BUDGET_MAX.inferences`, the controller's `PROOF_BUDGET`, P8, `bounded` | 100,000 → 300,000 | B2/B4 `when-to-use-opioids/cdc2022-opioid-rec02: got limit` once the arm enumerates (rec02 127,819 inferences) |
| X3 | P3, M2, M3 | explicit 30 s timeouts | P3 9,680 ms, M2 5,244 ms, M3 5,623 ms at suite load; P3 5,074 ms alone |

| X6 | `graph:check` C6 tap leg (`tools/graph-probe/app.svelte.ts`) | the victim = the first unselected node whose centre no other node's body covers | `C6: desktop/concept: tapped be, card reads absolute boundary` and the mobile twin, two runs: on the 492-document graph `absolute boundary` covers `be`, and card, canvas and emitted selection all named the node the tap hit |
X4 (finding, no edit): `guideline_quotient/6`'s Euclid loop holds one step 38 s on a 25,000-digit
operand, which `is/2` builds in milliseconds; `X is 7**(10**7)` already holds one step 12.5 s.
The client's hard deadline ends both by recreating the worker.

Fixture re-anchors (figure law): T8's quoted-atom witness → rec01 S2; the `,hour).` unit plant →
the `guideline_unit/3` head; MEANING fixtures rec01 S3 → S5 (`edge:658:0` → `edge:755:0`,
`edge:657:13` → `edge:754:22`, `edge:6094:11` → `edge:6901:27`), rec02-imp21 line 2401 → 2615;
graph-live focus lines 645,651 → 738,750; the `proof-identity` mutant line 42 → 48; the census
anchor and its altered figure.

## Measurements (Node 26, swipl-wasm 8.0.7, idle host)

Selected proof of each clinical document through `mi/3` at cap 1 — Prolog depth reached,
inferences, wall time: rec01 106 / 41,505 / 72 ms; rec02 109 / 127,819 / 241 ms; rec03 55 / 8,221 /
19 ms; rec04 81 / 38,580 / 70 ms; rec06 59 / 3,163 / 7 ms; rec07 73 / 16,911 / 73 ms; rec08 46 /
5,612 / 46 ms; rec09 96 / 78,426 / 201 ms; rec10 60 / 8,297 / 38 ms; rec11 54 / 4,668 / 16 ms;
rec05 152 / 100,890 / 170 ms; rec12 63 / 9,946 / 43 ms. Total 996 ms. Under the first-choice
assumption arm the same proofs took 2,427–78,823 inferences: enumerating every unifying premise
costs inferences, not time. Per document 9–154 clause nodes, 108–2,192 assumptions, 1–31
negations. The same depths under a fixed negation budget of 3 at cap 2: the guard's inner search
sets them, so that design saves no depth. SWI counts last calls too:
`call_with_depth_limit(p(500),…)` over `p(N) :- N1 is N-1, p(N1)` reports 501.

Per-sentence `clinical_derive/5` at cap 4: worst 60 ms, all 58 in about 1.2 s; P4's 863 erasures
about 26 s. A scope guard under a sentence's premises costs about 2,500 inferences (rec02 S4) or
400 (clinician-only rec07 S2); a status-only inner search saves 2% of inferences, so proof terms
are not the cost.

consultant-1 (fresh context, `consultant` role): A over B — the cap keeps its termination
across nested negation: two mutually negated schema clauses at cap 4 end at `[limit]` in 2 ms
under the remaining depth and exhaust 200,000 inferences in 98 ms under a fixed budget of 3.
Proof shape at cap 4: all 863 clause nodes top level, each sentence's line list equal to its
gate's, first proofs byte-equal after renumbering for the 7 cap-2/cap-4 overlaps and all 58
cap-4/cap-5 pairs.
