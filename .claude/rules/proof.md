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
  - "src/engine/readonly.ts"
  - "src/chat/**"
  - "server/**"
  - "tests/chat-*.ts"
  - "tests/engine-readonly-*.ts"
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
clinician entity + cardinality makes `should` operator contexts derive, and a sentence whose
antecedent names more — a patient with a pain, as the `maximize` recommendations do — derives
once its own premises apply. The blocker was ever a missing clinical context premise, never a
missing KB.

## Premises are scaffolding, not patient facts

A clinical premise is universal-instantiation scaffolding, not a patient fact: 451 raw
`clinical_premise` facts normalize to 51 shapes once the per-sentence skolem is removed, and
the two commonest (`guideline_cardinality(actual,_H,na,eq,1)`,
`guideline_entity(actual,_H,clinician,countable)`) sit in 51 and 48 of the 51 sentences.
Matching a patient description to premises therefore cannot pick a recommendation; the
discriminator is the rule's own condition in `clinical_rule/3`.

## Model-written goals

The chat's model writes goal text, and the engine runs it read-only (`src/engine/readonly.ts`,
`.agent/contracts/chat-c1.md`): the parsed term is checked, the engine's own rendering of it
runs, and a goal with any way to succeed that reads no KB predicate is refused. A `kb` label in the chat certifies that
its cited query ran over the KB in this conversation, not that the sentence restates it; the
card beside the sentence shows the goal and the engine's verbatim solutions
(`.agent/contracts/chat-c4.md` `Declared limit`).

## The closed saved state

The loaded `swipl-bundle-no-data` image is CLOSED: `autoload=false`, `unknown=error`, no
`library(lists)` — `append/3`, `member/2`, `maplist/2` and `sub_term/2` are all absent.
**Any Prolog helper must be builtin-only.** A test that traverses a proof tree must assert
its own helpers over the shipped `app/3`, and must spell `forall(C,A)` as `\+ (C, \+ A)`.

`clause/2` and `clause/3` reach every static schema predicate (`dynamic=no` throughout).
Rules dominate: arg 2777/2949, cardinality 1897/2052, entity 1897/2052, event 1399/1492,
operator 1388/1431, pp 1160/1190, property 36/45, interval 32/33, recurrence 10/11,
frequency 1/1, order 83/87, recurrence_window 4/4, range 8/8, preference 26/26, qualifier
269/273, unit 57/59; `document`, `schema_version` and `grade` are all facts.

The interpreter compiles INTO the image. Runtime `consult` buys nothing and is fail-open — it
is rejected.

## Meta-interpreter design

- An unbounded naive meta-interpreter exhausts the 1 GiB stack in ~8.5 s on the corpus's
  recursive rule-head chains. The shipping design is **depth-capped**: conjunction preserves
  the cap, each `clause/2` expansion decrements it, cap 0 fails closed before head expansion.
- **Cap 1 is complete for plain queries**, measured over the retired M2 legacy catalog — projected-value multisets equal the plain query
  for all six catalog goals and hold to cap 20. Cap-1 live `sentence(Doc,S)` multisets equal
  all four committed trace oracles exactly, zero divergences.
- Over that legacy catalog, re-proving the SELECTED solution returns the byte-identical proof from the all-solutions
  run for all 18 slots; medians 0.097–291.419 ms. MI over ALL solutions costs 0.518–2.914 s
  on the four broad goals against 0.017–0.096 ms plain — **never put it in the UI path.**
- Selected-proof budget: cap 1, stack 16 MiB, outer depth 100, 100000 inferences, answer cap
  1; deterministic maxima 6403 inferences and outer depth ≥20. Worst synchronous proof step
  291.419 ms, so a cooperative cancel cannot interrupt mid-proof and the main-thread watchdog
  is mandatory. Node figures only.
- `resolve/3` whitelists the 19 schema indicators alone; a comparison built-in
  (`guideline_satisfies/4,6`) has no arm, so a derivation through one fails closed.

## Clause identity

Identity = `clause/3` reference → `clause_property(Ref, file(…) + line_count(L))`. All 12507
`L` values are unique, and the provenance chunks' exact clause text recovers 12507/12507 of them
(`tests/proof-identity.test.ts`; the census pins both counts).

**Rendering `clause/2` output reproduces the committed `clause_sha256` 0/10321 times**:
`clause/2` injects `user:` into rule bodies, `fullstop(true)` adds a trailing space, and
operator handling compacts either way. Ship no bespoke canonical renderer.

Proofs come from the live meta-interpreter, never from committed trace artifacts.

## Source-fragment / antecedent records (`clinical.mjs`)

Emitted beside `clinical_advice/3,4`: `clinical_rule(Doc,S,Rule)`
(53, one per selected content sentence), `clinical_premise(Doc,S,N,Literal)` (451), and
`clinical_gate(Doc,S,Rule,[Lines])` (53, covering all **723** content sites), over one
`clinical_use(Line,Head)` exact-site helper.

- **A build-time GROUND head still drives `clause/3`.** It unifies against the stored head's
  variables, and `call(Body)` then demands exactly the grounded premises. One head form
  serves data AND execution — no raw/ground split, and no runtime grounding pass.
- Heads and premises share ONE skolem map per sentence
  (`'$clinical_hypothetical'(Doc,S,N)`), which is what keeps a premise applying to its own
  clause.
- Census: 12 documents, 53 content sentences, **723 sites / 723 unique lines**, 0
  multi-antecedent violations, 51/53 antecedents non-`true`, exactly 2 NAF (`rec05:S7`,
  `rec05:S8`).
- **Exactly 2 gates prove on the bare KB** — the two `true`-antecedent sentences. The other
  51 correctly fail until premises apply the universal.
- **52 gates resolve natively**; 1 exhausts 200,000 inferences with only its own premises
  asserted (`rec05:6`) on the corpus's recursive rule-head chains. 52 + 1 = 53. That is not
  contamination — the control proves under the identical shape — and the assumption evaluator
  terminates it.
- **An independent site enumerator must close the open sentence at a `% file:` boundary.**
  Without that reset each document's 2 preamble facts count as content sites and the total
  reads 747 instead of 723 — a plausible-looking wrong number.
- **53 fragments and 43 groups are one dataset at two granularities.** Reassembling the 53
  per-sentence `clinical_rule/3` by consequent — conditions concatenated in sentence order —
  reproduces all 43 shipped `clinical_answer` group terms byte for byte over 12 documents, 0
  divergences.
- `clinical.mjs:357` is `groupTerm`, **not** a second byte guard. The single fail-closed
  rebuild-equality guard is at `:293-298`.
- **A recommendation to refrain renders `should not`.** The corpus writes it `it is
  recommended that X does not V` — SHOULD over a negation, which English writes `X should not
  V` — so the parser reads it as `should` with a negative action and keeps the surface form
  only to rebuild the sentence. `X is preferred for Y` reads as a fact with a positive copula.
  An antecedent comparison (`guideline_satisfies`) refuses the build: a premise may never
  assume a threshold.
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
- Measured on the shipped image, reproduced independently with 0 divergences: cap 2 → **53/53
  sentences and 12/12 documents**; cap 1 → 51/53, failing the two NAF sentences
  `cdc2022-opioid-rec05:7` and `:8`; cap 3 adds nothing. **723/723** single-site erasures fail
  their sentence, 0 survivors, ~5 s, all 53 re-deriving after `snapshot/1` rolls back.
  **4,491** assumption leaves over 451 unique premises, none carrying a source line; every
  proof's line set is exactly its gate's list. Worst step 8.2 ms of a 1000 ms envelope.
- Negative controls: premises-withheld → **0 of 12 documents** (2 of 53 sentences survive —
  the two `true`-antecedent gates — so **the control's grain is the DOCUMENT**);
  schema-erased → 0 of 53 sentences.

## The clinical answer and its proof are ONE clause

`clinical_advice/3` projects `clinical_advice/4`, whose fourth argument is the proof; the
interpreter's arm is `derive(clinical_advice(Q,S,A),_,_,P,proved) :- !, clinical_advice(Q,S,A,P)`.
Answer and proof therefore come from the same derivation and cannot drift. Nothing
precomputed is left for a proof request to read back — `clinical_advice_source/4` and
`advice_nodes/2` are gone.

- The arm sits before the depth cap and cuts, so the outer `mi/3` depth of 1 still reaches
  it; `clinical_depth(2)` governs inside.
- Measured over the shipped image: **723 clause nodes** — exactly the cited-site census, all
  at top level with their bodies as children — **4,491 assumption leaves** and **19 NAF
  marks**, all 19 in `rec05`. Per document 9–154 clause nodes and 76–1,086 assumptions.
  All 12 proofs cost 584 ms total, 11–88 ms each, against a 1,000 ms budget.
- **A constrained proof goal must bind INSIDE the answer argument**
  (`clinical_advice('q',_,clinical_answer('doc',_,_))`). A trailing `Answer = …` conjunct
  fails: `resolve/3` whitelists the 19 schema indicators alone, so the interpreter
  has no clause for `=`/2 and the conjunction dies before the proof is reached.
- A wrong answer term yields `failure`, not a proof: the arm cuts, `clinical_advice/4` fails,
  and no fallback can fabricate one.

## Binding a test to real execution

`CLAUDE.md` `Engineering` verification integrity in domain form. A returned fixture value is a
defect anywhere and the non-negotiable itself breaking here, which is why this surface gets an
overlay probe rather than an assertion.

Anti-hard-coding recipe: vitest node project, one non-parallel worker, real saved image,
inject a PID-unique overlay clause, assert the answer changes, import no answer fixture.

**A binding overlay must perturb `guideline_*` and require the line-keyed proof to change
too** — an overlay that asserts a `clinical_advice/3` fact mutates the very predicate the
goal queries and stays green while the answer bypasses the KB. The category-A goal is a
seven-way join, so ONE asserted fact cannot move it: a working overlay declares
`guideline_entity/4`, `guideline_cardinality/5`, `guideline_event/3` and `guideline_arg/4`
dynamic and supplies a whole new proof.

Three probe traps, each producing a **vacuous pass**:

- `assertz((Head) :- A, B)` splits at the body comma into `assertz/2`, so nothing is asserted
  → write `assertz((Head :- A, B))`.
- A failed query makes `.once()` return `{success: false}` with no bindings, so
  `String(missing.State)` reads `"undefined"` and the row silently skips → make the probe's
  `once` throw on a failed query, and count the rows it actually graded.
- An `assertz` permission error comes back from `.once()` as a plain `{error: true}` object —
  never thrown, never `$error` — and also prints to stderr → read the refusal from `catch/3`
  inside Prolog.

`tests/proof-identity.test.ts` pins all three.
