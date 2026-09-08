---
paths:
  - "tools/kb/proof.mjs"
  - "tools/kb/clinical.mjs"
  - "tools/clinical-reference.mjs"
  - "src/engine/session.ts"
  - "src/questions/**"
  - "src/provenance/**"
  - "tests/clinical-*.ts"
  - "tests/proof-*.ts"
---

# Inference and proof

## The domain law

A guideline clause is universally quantified over clinicians —
`guideline_operator(actual,$gid(…,box(1),[A]),should) :- guideline_entity(actual,A,clinician,
countable), guideline_cardinality(…)` — and the `actual` world contains no clinician
instance. **`guideline_operator(actual,C,should)` failing on the bare KB is therefore
CORRECT, not a KB defect.** Supplying the instance as a premise is how a universal gets
applied. This is the whole basis of the clinical inference path; do not re-derive it as a
defect.

Real inference over the compiled clauses is measured feasible: asserting one hypothetical
clinician entity + cardinality makes `should` operators, `maximize` events (7),
`nonopioid-therapy` entities (3) and the full operator→event→arg→entity join all derive. The
blocker was ever a missing clinical context premise, never a missing KB.

## The closed saved state

The loaded `swipl-bundle-no-data` image is CLOSED: `autoload=false`, `unknown=error`, no
`library(lists)` — `append/3`, `member/2`, `maplist/2` and `sub_term/2` are all absent.
**Any Prolog helper must be builtin-only.** A test that traverses a proof tree must assert
its own helpers over the shipped `app/3`, and must spell `forall(C,A)` as `\+ (C, \+ A)`.

`clause/2` and `clause/3` reach every static schema predicate (`dynamic=no` throughout).
Rules dominate: arg 2351/2513, cardinality 1693/1834, entity 1693/1834, event 1170/1254,
operator 1158/1193, pp 981/1003, property 7/16; `document` and `schema_version` are all facts.

The interpreter compiles INTO the image (+964 B, boot 116.977 ms vs 123.216 ms for
boot+consult). Runtime `consult` buys nothing and is fail-open — it is rejected.

## Meta-interpreter design

- An unbounded naive meta-interpreter exhausts the 1 GiB stack in ~8.5 s on the corpus's
  recursive rule-head chains. The shipping design is **depth-capped**: conjunction preserves
  the cap, each `clause/2` expansion decrements it, cap 0 fails closed before head expansion.
- **Cap 1 is complete for plain queries** — projected-value multisets equal the plain query
  for all six catalog goals and hold to cap 20. Cap-1 live `sentence(Doc,S)` multisets equal
  all four committed trace oracles exactly, zero divergences.
- Re-proving the SELECTED solution returns the byte-identical proof from the all-solutions
  run for all 18 slots; medians 0.097–291.419 ms. MI over ALL solutions costs 0.518–2.914 s
  on the four broad goals against 0.017–0.096 ms plain — **never put it in the UI path.**
- Selected-proof budget: cap 1, stack 16 MiB, outer depth 100, 100000 inferences, answer cap
  1; deterministic maxima 6403 inferences and outer depth ≥20. Worst synchronous proof step
  291.419 ms, so a cooperative cancel cannot interrupt mid-proof and the main-thread watchdog
  is mandatory. Node figures only.
- `resolve/3` whitelists the nine `guideline_*` predicates alone.

## Clause identity

Identity = `clause/3` reference → `clause_property(Ref, file(…) + line_count(L))`. All 10321
`L` values are unique against the deterministic concatenated payload, exact clause text
recovers 10321/10321, and the line+newline hash resolves all 68 committed trace nodes.

**Rendering `clause/2` output reproduces the committed `clause_sha256` 0/10321 times**:
`clause/2` injects `user:` into rule bodies, `fullstop(true)` adds a trailing space, and
operator handling compacts either way. Ship no bespoke canonical renderer.

Committed trace artifacts carry **no** proof-dependency edges — every sampled clause node has
an empty child list, so a proof tree drawn from them would be fabricated. Proofs come from
the live meta-interpreter.

## Source-fragment / antecedent records (`clinical.mjs`)

Emitted beside `clinical_advice/3,4`: `clinical_rule(Doc,S,Rule)`
(48, one per selected content sentence), `clinical_premise(Doc,S,N,Literal)` (346), and
`clinical_gate(Doc,S,Rule,[Lines])` (48, covering all **686** content sites), over one
`clinical_use(Line,Head)` exact-site helper.

- **A build-time GROUND head still drives `clause/3`.** It unifies against the stored head's
  variables, and `call(Body)` then demands exactly the grounded premises. One head form
  serves data AND execution — no raw/ground split, and no runtime grounding pass.
- Heads and premises share ONE skolem map per sentence
  (`'$clinical_hypothetical'(Doc,S,N)`), which is what keeps a premise applying to its own
  clause.
- Census: 12 documents, 48 content sentences, **686 sites / 686 unique lines**, 0
  multi-antecedent violations, 46/48 antecedents non-`true`, exactly 1 NAF (`rec05:S5`).
- **Exactly 2 gates prove on the bare KB** — the two `true`-antecedent sentences. The other
  46 correctly fail until premises apply the universal.
- **44 gates resolve natively**; 4 exhaust 200,000 inferences with only their own premises
  asserted (`rec01:3`, `rec02:3`, `rec02:8`, `rec05:4`) on the corpus's recursive rule-head
  chains. 44 + 4 = 48. That is not contamination — the control proves under the identical
  shape — and the assumption evaluator terminates all four.
- **An independent site enumerator must close the open sentence at a `% file:` boundary.**
  Without that reset each document's 2 preamble facts count as content sites and the total
  reads 710 instead of 686 — a plausible-looking wrong number.
- **48 fragments and 38 groups are one dataset at two granularities.** Reassembling the 48
  per-sentence `clinical_rule/3` by consequent — conditions concatenated in sentence order —
  reproduces all 38 shipped `clinical_answer` group terms byte for byte over 12 documents, 0
  divergences.
- `clinical.mjs:325` is `groupTerm`, **not** a second byte guard. The single fail-closed
  rebuild-equality guard is at `:261-266`.
- The exact shipped passage is aligned ENGLISH prose from the provenance model, not ACE.

## Query-local assumption evaluator (`proof.mjs`)

`derive/5` threads an assumption list through the existing interpreter, with an
`assumption(H)` leaf placed **before** the depth cap and before `resolve/3`; plus `assumed/2`,
`derive_all/4`, `gate_heads/2`, `clinical_depth(2)`, `clinical_context/3` and
`clinical_derive/4,5`. `mi/3` and `mi_limited/2` keep arity and behaviour by passing `[]`, so
the shipped proof RPC is untouched. No write path ships; a direct `assertz` is still refused.

- **`PROOF_SOURCE` is LAST in `payloadSource`** (payload → clinical helper → proof), so no
  edit to it can move a content-site line or a `clinical_gate/4` line list. That is what makes
  proof-source work line-safe by construction.
- **Read cited heads from the STORED gate body, never by calling the gate.**
  `clinical_use/2` runs `call(Body)`, which demands the very premises the evaluator supplies,
  so executing `clinical_gate/4` is circular. `clause(clinical_gate(D,S,_,_),Body,_)` plus a
  conjunction walk yields all ground heads without executing anything.
- Measured on the shipped image, reproduced independently with 0 divergences: cap 2 → **48/48
  sentences and 12/12 documents**; cap 1 → 47/48, failing `cdc2022-opioid-rec05:5` alone; cap
  3 adds nothing. **686/686** single-site erasures fail their sentence, 0 survivors, ~5 s, all
  48 re-deriving after `snapshot/1` rolls back. **3,930** assumption leaves over 346 unique
  premises, none carrying a source line; every proof's line set is exactly its gate's list.
  Worst step 11.8 ms of a 1000 ms envelope.
- Negative controls: premises-withheld → **0 of 12 documents** (2 of 48 sentences survive —
  the two `true`-antecedent gates — so **the control's grain is the DOCUMENT**);
  schema-erased → 0 of 48 sentences.

## The clinical answer and its proof are ONE clause

`clinical_advice/3` projects `clinical_advice/4`, whose fourth argument is the proof; the
interpreter's arm is `derive(clinical_advice(Q,S,A),_,_,P,proved) :- !, clinical_advice(Q,S,A,P)`.
Answer and proof therefore come from the same derivation and cannot drift. Nothing
precomputed is left for a proof request to read back — `clinical_advice_source/4` and
`advice_nodes/2` are gone.

- The arm sits before the depth cap and cuts, so the outer `mi/3` depth of 1 still reaches
  it; `clinical_depth(2)` governs inside.
- Measured over the shipped image: **686 clause nodes** — exactly the cited-site census, all
  at top level with their bodies as children — **3,930 assumption leaves** and **15 NAF
  marks**, all 15 in `rec05`. Per document 9–144 clause nodes and 76–1,026 assumptions.
  All 12 proofs cost 430 ms total, 7–72 ms each, against a 1,000 ms budget.
- **A constrained proof goal must bind INSIDE the answer argument**
  (`clinical_advice('q',_,clinical_answer('doc',_,_))`). A trailing `Answer = …` conjunct
  fails: `resolve/3` whitelists the nine `guideline_*` predicates alone, so the interpreter
  has no clause for `=`/2 and the conjunction dies before the proof is reached.
- A wrong answer term yields `failure`, not a proof: the arm cuts, `clinical_advice/4` fails,
  and no fallback can fabricate one.

## Binding a test to real execution

Anti-hard-coding recipe: vitest node project, one non-parallel worker, real saved image,
inject a PID-unique overlay clause, assert the answer changes, import no answer fixture.

**A binding overlay must perturb `guideline_*` and require the line-keyed proof to change
too** — an overlay that asserts a `clinical_advice/3` fact mutates the very predicate the
goal queries and stays green while the answer bypasses the KB. The category-A goal is a
seven-way join, so ONE asserted fact cannot move it: a working overlay declares
`guideline_entity/4`, `guideline_cardinality/5`, `guideline_event/3` and `guideline_arg/4`
dynamic and supplies a whole new proof.

Three probe traps, each producing a **vacuous pass**:

- `assertz((Head) :- Body)` parses as a `:-`/2 term rather than a clause → write
  `assertz((Head :- Body))`.
- A failed query makes `.once()` return `false`, so `String(missing.State)` reads
  `"undefined"` and the row silently skips → make the probe's `once` throw on a failed query,
  and count the rows it actually graded.
- An `assertz` permission error never reaches JS as `$error` — it prints to real stderr,
  outside the `printErr` drain, and the call returns normally → read the refusal from
  `catch/3` inside Prolog.
