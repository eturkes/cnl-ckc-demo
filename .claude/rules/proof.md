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

A clinical premise is universal-instantiation scaffolding, not a patient fact: 703 raw
`clinical_premise` facts normalize to 60 shapes once the per-sentence skolem is removed, and
the two commonest (`guideline_cardinality(actual,_H,na,eq,1)`,
`guideline_entity(actual,_H,clinician,countable)`) sit in 56 and 51 of the 56 sentences.
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
Rules dominate: arg 4028/4744, cardinality 2574/3126, entity 2574/3126, event 2055/2415,
operator 1820/1843, pp 1696/1715, property 60/69, interval 55/56, recurrence 9/15,
frequency 3/3, order 163/165, recurrence_window 4/4, range 8/8, preference 31/31, qualifier
404/414, unit 81/88, exclusion 12/12; `document`, `schema_version`, `grade` and
`supersession` are all facts.

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
- Selected-proof budget (`PROOF_BUDGET_MAX`): cap 1, stack 16 MiB, Prolog depth 256, 300000
  inferences, wall clock 3000 ms, answer cap 1 (user-approved re-pin). The twelve clinical
  proofs reach Prolog depth 46–152, 3,163–127,819 inferences and 7–241 ms: the scope guard's
  negation searches the exclusion records under each sentence's premises, and SWI counts every
  recursion level, last calls included, so no reshaping of the interpreter lowers the depth. A
  proof step is synchronous, so a cooperative cancel cannot interrupt mid-proof and the
  main-thread watchdog is mandatory. Node figures only.
- `resolve/3` names all 22 schema indicators, and it must: a goal it cannot resolve fails
  without a limit, so a negation over an unnamed indicator — the scope guard — succeeds by never
  looking (`tests/proof-guard.test.ts`). A schema built-in (the comparisons
  `guideline_satisfies/4,6`, the arithmetic `guideline_product/6`, `guideline_quotient/6`) has
  its own arm: `call/1` evaluates it where it stands, at any depth, and the proof records a
  line-free `builtin(G)` leaf, as upstream's traces do; no premise can stand in for it
  (`tests/proof-comparison.test.ts`).

## Clause identity

Identity = `clause/3` reference → `clause_property(Ref, file(…) + line_count(L))`. All 18845
`L` values are unique, and the provenance chunks' exact clause text recovers 18845/18845 of them
(`tests/proof-identity.test.ts`; the census pins both counts).

**Rendering `clause/2` output reproduces the committed `clause_sha256` 0/10321 times**:
`clause/2` injects `user:` into rule bodies, `fullstop(true)` adds a trailing space, and
operator handling compacts either way. Ship no bespoke canonical renderer.

Proofs come from the live meta-interpreter, never from committed trace artifacts.

## Source-fragment / antecedent records (`clinical.mjs`)

Emitted beside `clinical_advice/3,4`: `clinical_rule(Doc,S,Rule)`
(58, one per selected content sentence), `clinical_premise(Doc,S,N,Literal)` (703), and
`clinical_gate(Doc,S,Rule,[Lines])` (58, covering all **863** content sites), over one
`clinical_use(Line,Head)` exact-site helper.

- **A build-time GROUND head still drives `clause/3`.** It unifies against the stored head's
  variables, and `call(Body)` then demands exactly the grounded premises. One head form
  serves data AND execution — no raw/ground split, and no runtime grounding pass.
- Heads and premises share ONE skolem map per sentence
  (`'$clinical_hypothetical'(Doc,S,N)`), which is what keeps a premise applying to its own
  clause.
- Census: 12 documents, 58 content sentences, **863 sites / 863 unique lines**, 0
  multi-antecedent violations, 56/58 antecedents non-`true`, exactly 2 NAF (`rec05:S7`,
  `rec05:S8`) once the scope guard is read off.
- **Exactly 2 gates prove on the bare KB** — the two `true`-antecedent sentences, `rec05:9`
  and `rec05:10`. The other 56 correctly fail until premises apply the universal.
- **All 58 gates resolve natively** with only their own premises asserted, inside 200,000
  inferences.
- **An independent site enumerator must close the open sentence at a `% file:` boundary.**
  Without that reset each document's 2 preamble facts count as content sites and the total
  reads 887 instead of 863 — a plausible-looking wrong number.
- **58 fragments and 46 groups are one dataset at two granularities.** Reassembling the 58
  per-sentence `clinical_rule/3` by consequent — conditions concatenated in sentence order —
  reproduces all 46 shipped `clinical_answer` group terms byte for byte over 12 documents, 0
  divergences.
- `clinical.mjs:382` is `groupTerm`, **not** a second byte guard. The single fail-closed
  rebuild-equality guard is at `:317-322`.
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
`derive_all/4`, `gate_heads/2`, `clinical_depth(4)`, `clinical_context/3`,
`clinical_derive/4,5` and `clinical_derived/2`. `mi/3` and `mi_limited/2` keep arity and behaviour by passing `[]`, so
the shipped proof RPC is untouched. No write path ships; a direct `assertz` is still refused.

- **The assumption arm commits, then enumerates.** A goal some premise unifies with never also
  resolves against a KB clause, and every premise that unifies stays a candidate:
  `\+ \+ assumed(H,As), !, assumed(H,As)`. A scope guard's exception binds an existential
  event, and committing to the first premise that unified read s7-02's exclusion one way in one
  premise order and the other way in the other (`tests/proof-guard.test.ts` G4, against native
  Prolog over the same premises). Exhaustive guard searches visit every candidate, which is what
  the 300000-inference budget pays for.
- **An assumption stands in for a schema relation alone** (`schema_goal/1`). An antecedent
  literal the build carries into a premise without being one — `fail`, say — is never
  assumed, so a clause body that cannot hold derives no answer and no marks
  (`tests/marks-admitted.test.ts`).
- **`PROOF_SOURCE` follows every document and the clinical helper in `payloadSource`**
  (payload → clinical helper → proof → read-only arithmetic), so no edit to it, or to the
  read-only block after it, can move a content-site line or a `clinical_gate/4` line list. That
  is what makes proof-source work line-safe by construction.
- **Read cited heads from the STORED gate body, never by calling the gate.**
  `clinical_use/2` runs `call(Body)`, which demands the very premises the evaluator supplies,
  so executing `clinical_gate/4` is circular. `clause(clinical_gate(D,S,_,_),Body,_)` plus a
  conjunction walk yields all ground heads without executing anything.
- **Cap 4 is the least sufficient depth.** Every `should`, `must` and `may` edge ends with the
  scope guard `\+ guideline_exclusion(K)`, a negation proved only when its inner search
  finishes without a limit; the guard sits one level below its edge, and under a sentence's
  premises the exclusion bodies need three more. A negation keeps the remaining depth: a fixed
  negation budget loses the cap's termination across nested negations — two mutually negated
  clauses end at a limit in 2 ms under the remaining depth and exhaust 200,000 inferences under
  a fixed budget of 3.
- Measured on the shipped image, reproduced independently with 0 divergences: cap 4 → **58/58
  sentences and 12/12 documents**; cap 3 → 32/58, failing every guarded sentence whose
  exclusion search needs the fourth level; cap 5 adds nothing. **863/863** single-site erasures
  fail their sentence, 0 survivors, ~26 s, all 58 re-deriving after `snapshot/1` rolls back.
  **8,549** assumption leaves over 703 unique premises, none carrying a source line; every
  proof's line set is exactly its gate's list. Worst step 60 ms of a 3000 ms envelope.
- Negative controls: premises-withheld → **0 of 12 documents** (2 of 58 sentences survive —
  the two `true`-antecedent gates — so **the control's grain is the DOCUMENT**);
  schema-erased → 0 of 58 sentences.

## The clinical answer and its proof are ONE clause

`clinical_advice/3` projects `clinical_advice/4`, whose fourth argument is the proof; the
interpreter's arm is `derive(clinical_advice(Q,S,A),_,_,P,proved) :- !, clinical_advice(Q,S,A,P)`.
Answer and proof therefore come from the same derivation and cannot drift. Nothing
precomputed is left for a proof request to read back — `clinical_advice_source/4` and
`advice_nodes/2` are gone.

- The arm sits before the depth cap and cuts, so the outer `mi/3` depth of 1 still reaches
  it; `clinical_depth(4)` governs inside.
- Measured over the shipped image: **863 clause nodes** — exactly the cited-site census, all
  at top level with their bodies as children — **8,549 assumption leaves** and **101 NAF
  marks**, 1–31 per document, the scope guards beside rec05's own. Per document 9–154 clause
  nodes and 108–2,192 assumptions. All 12 proofs cost 996 ms total, 7–241 ms each, against a
  3,000 ms budget (Node, idle).
- **A constrained proof goal must bind INSIDE the answer argument**
  (`clinical_advice('q',_,clinical_answer('doc',_,_))`). A trailing `Answer = …` conjunct
  fails: `resolve/3` names the 22 schema indicators alone, so the interpreter
  has no clause for `=`/2 and the conjunction dies before the proof is reached.
- A wrong answer term yields `failure`, not a proof: the arm cuts, `clinical_advice/4` fails,
  and no fallback can fabricate one.
- **A document derives each gate sentence exactly once.** `clinical_derived/2` takes the FIRST
  derivation of every `clinical_gate/4` sentence, in gate order, and fails when one fails.
  Counting derivations against gates is unsound: a duplicated clause derives one sentence twice
  and stands in for a missing one, and the answer still reads complete
  (`tests/marks-live.test.ts` A7).

## The marks goal

`clinical_marks(Q,Source,Marks)` (end of `PROOF_SOURCE`, `.agent/contracts/ann-u1.md`) is the
answer panel's grade, qualifier, preference and time marks, one solution per answer document.

- It calls `clinical_derived/2`, the answer's own derivation, and reads each sentence's marks
  off the TOP-LEVEL items of that sentence's proof — the gate heads that derived under its
  premises. A top-level item that is not `node/3` fails the sentence, so an assumed head never
  reads as a KB mark. Grades derive through `derive/5` at depth 1; the S1 grade facts are no
  gate heads. A referent's noun comes from its entity or property node, else from the entity
  premise that typed it: a referent the sentence's condition introduces reaches the proof as an
  assumption alone (user ruling, ann-u1 amended).
- **All-or-nothing per document, and separate from the answer.** An unresolved referent,
  quantity, anchor or grade label, an anchorless interval, an alternative whose noun is `none`
  (the term's own no-alternative sentinel), or a time head no reading covers
  (recurrence, frequency, recurrence window, range) leaves the document without a marks
  solution, while its answer still derives: a marks failure costs the panel a notice, never an
  answer.
- Groups come from the answer's own `clinical_groups/2`; each takes the sentences whose rule
  has its consequent, so group i is the answer's group i.
- The marks goal runs on the answer path's engine queue after the answer settles and before the
  trace: every `solve` clears the proof cache, so a marks call queued behind the trace would
  evict the proof it just cached.

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
