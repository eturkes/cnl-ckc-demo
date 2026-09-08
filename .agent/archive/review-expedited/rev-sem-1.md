# rev-sem-1 — verdict table

| id | finding | evidence |
| --- | --- | --- |
| S1 | fail(high): deleting every guideline semantic clause leaves the displayed answer byte-identical | `tests/review-answer-proof-binding.test.ts:82`; `pnpm exec vitest run tests/review-answer-proof-binding.test.ts -t 'S1 removes'` |
| S2 | fail(med): proof and compiled-clause surfaces drop the source’s “should not consider” modality | `tests/review-answer-proof-binding.test.ts:97`; `.scratch/worktrees/rev-sem-1/.scratch/rendered-surfaces.log` |
| S3 | fail(high): every displayed proof survives removal of the clauses it claims participated | `tests/review-answer-proof-binding.test.ts:133`; `tools/kb/proof.mjs:31-39` |
| S4 | pass: every statement maps only to live rows whose Source and Answer document identifiers agree | `pnpm exec vitest run tests/review-answer-proof-binding.test.ts -t 'S4 maps'`; `tests/demo-controller.dom.test.ts:313-327` |
| S6 | pass: all evidence chunks rederive from bag text; code-point slices and paired input groups validate | `pnpm kb:asset-check`; `pnpm exec vitest run tests/kb-derived-assets.test.ts tests/provenance-model.test.ts`; `pnpm exec vitest run tests/provenance-ladder.dom.test.ts -t 'pairs pointer-'` |
| S7 | fail(med): a missing proof-line clause renders zero clauses and continues into unbound evidence | `tests/provenance-ladder.dom.test.ts:138`; `src/provenance/ProvenanceLadder.svelte:43` |
| S8 | pass: the UI states that the catalog is fixed and each prepared topic selects source-aligned clauses | `pnpm exec vitest run tests/about-copy.dom.test.ts -t 'S8 discloses'`; `src/demo/copy.ts:35-36`; `src/demo/AboutPanel.svelte:35` |
| S10 | pass: no-proof, limit, cancellation and error retain distinct protocol variants and visible terminal labels | `pnpm exec vitest run tests/demo-controller.dom.test.ts -t 'V[2-6]'`; `tests/proof-live.test.ts:178-183,229-258` |

## Register

- **Graph handoff:** the primary concept view intentionally hides modality nodes (`README.md:20-22`). S2 already fails on owned proof/clause surfaces; the graph lens must decide whether both graph views preserve equivalent polarity and scope.
- **Assurance handoff:** `5ed81a3^:tests/questions-live.test.ts:214-250` injected a complete `guideline_*` proof. The shipped replacement at `tests/questions-live.test.ts:258-278` injects `clinical_advice/3` directly, so its green result cannot bind the non-negotiable.
- **Claim wording:** `src/demo/copy.ts:25-27`, `src/demo/AnswerPanel.svelte:70`, and `src/provenance/ProvenanceLadder.svelte:109,152-153` say answers are proved or re-proved live against guideline clauses. S1/S3 show those claims are false until the helper-fact shortcut is removed.
- **Check note:** the pre-probe `pnpm test` run passed 291/293 but hit two unrelated 5-second timeouts. Isolated reruns of `V11 has zero axe` and `fails kb:asset-check on a static import` both passed.

## Detail

### S1

- Source ACE (`kb/cnl-ckc-kb-g952cc950a0c6.tar.gz`, `data/guidelines/cdc-2022-opioid/ace/cdc2022-opioid-rec01.ace`, sentence 2): `Every clinician should maximize a nonopioid-therapy for an acute-pain.`
- Rendered browser output: `Clinicians should maximize nonopioid therapy for acute pain.` Screenshot: `.scratch/worktrees/rev-sem-1/.scratch/rev-sem-pixel.png`.
- Backward trace: `AnswerPanel.svelte:79` renders `synthesizeAnswer`; `describe.ts:201` groups statements; `advice.ts:138` humanizes a structured `clinical_answer/3`; `service.ts:45` queries the generated catalog goal; `session.ts:307` executes it in the PVM. At build time, `clinical.mjs:424` reads the ACE and aligned passage, parses and losslessly rebuilds the ACE (`clinical.mjs:198`), emits independent `clinical_advice/3` facts plus stored site metadata, and `paths.mjs:33` appends those helpers to the image. No run-time transformation derives the answer from `guideline_*` clauses.
- Exact divergence: the red probe converts all seven semantic `guideline_*` predicates to dynamic predicates, retracts every clause, proves `guideline_event/3` has no solution, then receives the same serialized answer. Required close: derive `clinical_advice/3` through the compiled guideline schema, or reject the answer when its dependencies disappear; retain this mutation as a green differential.

### S2

- Source ACE (`cdc2022-opioid-rec01`, sentence 3): `If an opioid-benefit does not outweigh an opioid-risk then every clinician should not consider an opioid-therapy for an acute-pain.`
- Rendered answer: `If opioid benefit does not outweigh opioid risk, clinicians should not consider opioid therapy for acute pain.` The answer preserves both negations and `should`.
- Rendered proof step: `guideline_operator(actual,'$guideline_id'(context,'cdc2022-opioid-rec01',3,box(2),[clinical_variable_0,clinical_variable_1]),-)`.
- Rendered compiled clause: the matching `guideline_operator(...,-) :- ...` antecedent-context rule. It contains neither `should` nor `consider`; the later clauses that encode the negated recommendation are absent from both evidence surfaces.
- Exact divergence: `clinical.mjs:393-417` records only the first `guideline_*` clause after each ACE sentence marker. For this sentence that first clause encodes the negative antecedent context, so `proof.mjs:31-32` emits one incomplete leaf. Required close: trace every clause that derives the rendered rule and add a bag-derived all-selected-sentences polarity/modality oracle. Graph-only observations remain in the register per lens boundary.

### S3

- Source ACE: `Every clinician should maximize a nonopioid-therapy for an acute-pain.`
- Rendered proof step: `guideline_operator(actual,'$guideline_id'(context,'cdc2022-opioid-rec01',2,box(1),[clinical_variable_0]),should)`.
- Compiled clause at its displayed line: `guideline_operator(actual,'$guideline_id'(context,'cdc2022-opioid-rec01',2,box(1),[A]),should) :- guideline_entity(actual,A,clinician,countable), guideline_cardinality(actual,A,na,eq,1).`
- Exact divergence: after every semantic clause is retracted, the probe independently confirms that `clause(Head,_,Ref), clause_property(Ref,line_count(Line))` fails for the displayed head and line. `EngineSession.prove` still returns a deeply identical proof. `proof.mjs:37` cuts every shipped `clinical_advice/3` goal into a helper path; `proof.mjs:31-32` converts build-time `site(Line,Head)` records directly into leaf nodes. Therefore the general derivation path at `proof.mjs:39` is never reached by any shipped catalog question.
- Required close: remove the `clinical_advice/3` proof shortcut and derive the displayed answer through its schema clauses; make the live overlay differential require both the answer and line-keyed proof to change.

### S7

- Source ACE example: `Every clinician should maximize a nonopioid-therapy for an acute-pain.`
- Rendered failure-path output after deleting the selected proof-line clause from an otherwise valid evidence chunk: `0 exact clauses joined by source line.` The component then renders the controlled sentence, coverage region, source passage, and page as if the join succeeded.
- Exact divergence: `model.ts:85-170` validates each clause field but never validates uniqueness or the caller’s required proof lines. `ProvenanceLadder.svelte:43` silently filters to an empty array, and no state transition records the failed join. The red DOM test receives no alert and still carries the source passage.
- Required close: resolve every proof line exactly once before assigning `evidence`; make deletion, duplication, bad offset, and wrong-page mutants enter one explicit error state with no evidence or page rendering. Retain stale-run, limit, and cancel tests as separate passing paths.
