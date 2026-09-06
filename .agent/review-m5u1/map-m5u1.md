# map-m5u1 — M5 u1 surface map + normative checklist + archaeology

Gate: `python3 -P .scratch/validate-report.py .scratch/agents/map-m5u1.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, dense/telegraphic, `→`/`=` notation, no prose padding, ≤400
chars. `evidence` = `path`, `path:line`, or `` `cmd` `` that reproduces it, ≥8
chars — a bare `` `cmd` `` placeholder fails the gate.
Keep `|` out of cell text (escape as `\|`); one physical line per row.
Detail sections below the table are keyed by row id; write one only where MAIN
needs more than the row to rule. MAIN reads the table first — it is the budget.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| M1 | `clinicalArtifacts` emits `clinical_advice/3`; graph=`payloadDocuments→sourceClauses`, `deriveProvenance`, then ACE parse→`parseAdviceSentence`→`answerTerm`→group/action/modifier terms. u1 seam is after frozen clause parsing/group rendering: compile premises + keyed source fragments before helper emission. Full spans below. | tools/kb/clinical.mjs:424 |
| M2 | `clinicalArtifacts` emits finished advice/source facts; `payloadSource` appends that helper after sorted documents; `kb:build` hashes the full text, `buildImage` writes it as `/prolog.pl`, consults+saves, then writes `kb.pvm`. Generated goal→`AnswerService.ask`→engine fact lookup; payload text shape below. | tools/kb/clinical.mjs:481; tools/kb/paths.mjs:27; tools/kb/produce.mjs:185; tools/kb/build.mjs:61; src/questions/service.ts:43 |
| M3 | 12 terms originate from nested `CLINICAL_QUESTIONS` source order→`answerTerm`; 7 topic strings originate from frozen term rendering→`synthesizeAnswer`; raw contributions preserve engine/source order and exact-duplicate merges. Wave-1 fixture pins canonical terms+AST+points; main tests pin shape/document order but no independent full byte baseline. | tools/kb/clinical.mjs:449; src/questions/advice.ts:163; src/demo/describe.ts:196; `git show wt/res-m5-2:tests/fixtures/m5-answer-targets.json` |
| M4 | Single byte guard=`clauseSource(parsed)===original`; mismatch throws before grouping/emission. `groupTerm` is only a total serializer of an already-validated `AdviceGroup`; it rejects nothing. Separate `groupClauses` rejects duplicate/mixed consequences and count loss. A3's `:325` citation is not a guard. | tools/kb/clinical.mjs:261; tools/kb/clinical.mjs:271; tools/kb/clinical.mjs:325 |
| M5 | FROZEN: lossless parser 198-268; answer renderer parse+word/render+fallback 44-189; aligned passage derivation 531-600 and clinical join 427-436,475-479. Wave-1 term/point fixture plus current structural/fallback tests pin parser+renderer; `kb:asset-check` freshly byte-compares provenance assets and live tests require exact passage. | tools/kb/clinical.mjs:198; src/questions/advice.ts:44; tools/kb/provenance.mjs:531; tests/questions-live.test.ts:163; tools/kb/check.mjs:106 |
| M6 | `CASES`: selected 12 docs→scan canonical payload by `% file`/`% S`; skip S1; collect EVERY `guideline_` line as exact 1-based line+head+body; require one shared antecedent body per sentence. Result=48 cases/686 sites. Build-time reproduction is direct: `clinical.mjs` already has selected docs+payload; replace its first-line map with this exhaustive scan. | `git show wt/res-m5-1:tests/m5-inference-support.mjs`; `git show wt/res-m5-1:tests/m5-inference-binding.test.ts` |
| M7 | unknown | unknown |
| M8 | unknown | unknown |
| M9 | unknown | unknown |
| M10 | unknown | unknown |
| M11 | unknown | unknown |
| M12 | unknown | unknown |
| M13 | unknown | unknown |
| M14 | unknown | unknown |

## Row prompts

- **M1** — `tools/kb/clinical.mjs` structure: every top-level symbol with its line
  span, the call graph, and which function emits the `clinical_advice/3` facts.
  Name the seam between fragment rendering and premise/antecedent compilation.
- **M2** — build-time fact emission path end-to-end: `clinical.mjs` →
  `tools/kb/paths.mjs:payloadSource` → `tools/kb/produce.mjs` → `kb.pvm`. Exact
  `file:line` per hop; what text lands in the payload; how the runtime goal reaches it.
- **M3** — the 7 shipped topic strings + 12 canonical answer terms + raw contribution
  order: production site per class, and what mechanically byte-pins each today
  (test file:line or gate step). Order = whose definition?
- **M4** — the fail-closed rebuild-equality guard at `clinical.mjs:261-266` and
  `groupTerm` at :325: exact obligation of each, what input each rejects, and which
  of the two is the single byte guard (memory says A3 cites both; :325 is NOT a guard).
- **M5** — u1-FROZEN surfaces: `parseAdviceSentence` (`src/questions/advice.ts`), the
  renderer, aligned-passage metadata. Exact `file:line` extents, their contracts, and
  what mechanically detects an unintended change to each.
- **M6** — the 686 content sites: exact derivation recipe from `wt/res-m5-1`
  `tests/m5-inference-binding.test.ts` (`git show wt/res-m5-1:tests/m5-inference-binding.test.ts`).
  How is the set enumerated? Is it reproducible at build time inside `clinical.mjs`?
- **M7** — `wt/res-m5-2` `tests/m5-fragment-binding.probe.test.ts` distilled: the exact
  file+line+head gating mechanism that made rec01:S2 emit only after all nine clauses
  executed; what it proved, its measured numbers, and exactly what it left open.
- **M8** — clinical-context premises: the exact premise term shapes the probes supplied
  (clinician entity + cardinality per memory), per-question variance across the 7
  questions / 12 docs, and whether one premise set serves all or each question differs.
- **M9** — every existing test asserting `clinical.mjs` output or advice bytes:
  `file:line` per assertion class, and which would break under a u1 that changes the
  emitted term shape while holding rendered bytes identical.
- **M10** — gate steps that read clinical output: `tools/kb/check.mjs`,
  `kb:asset-check`, `kb:build`, `engine-check.mjs`, `copy-check.mjs`. Exact obligation
  per step with `file:line`; which fail closed and which are advisory.
- **M11** — the provenance / aligned-passage join inside `clinical.mjs`:
  `deriveProvenance` call sites, which metadata fields travel into the emitted term,
  and which are frozen by M5 u1's "aligned-passage metadata UNCHANGED" clause.
- **M12** — git archaeology: the commit that introduced `clinical.mjs`, plus the two
  nearest `prod`-tier analog units (M1 u1/u4 per memory). SHAs + what each teaches
  about the validator shape a `prod` teammate is graded by.
- **M13** — anchored normative checklist: one line per obligation u1's three acceptance
  clauses imply (byte identity of 7 strings + 12 terms + raw contribution order; every
  fragment names its gating content-bearing clause line; all 686 sites covered by a
  fragment or antecedent), each anchored to `file:line`.
- **M14** — payload/PVM budget: current `kb.pvm` + `kb.qlf` byte sizes, what the
  M2-M4 range added, and the measured marginal cost of carrying fragments +
  antecedents + premises (memory records 1,531 B for aligned English prose). State the
  headroom frame u1 must size against.

### M1

Top-level imports: `payloadDocuments` 12; `deriveProvenance` 13. Data/regex: `CLINICAL_QUESTIONS` 19-60; `ACE` 62; `ID` 63; `SIMPLE_ATOM` 64; `METADATA` 101; `PREPOSITIONS` 102-116. Functions: `encodedAtom` 67-70; `quotedString` 73-79; `aceSentences` 82-99; `splitComplement` 124-142; `parseAction` 145-158; `actionSource` 161-164; `clauseSource` 167-187; `parseAdviceSentence` 198-268; `groupClauses` 271-313; `modifierTerm` 316-317; `actionTerm` 320-322; `groupTerm` 325-327; `answerTerm` 330-332; `groundHead` 341-390; `sourceClauses` 393-418; `clinicalArtifacts` 424-502. Typedef-only symbols: `SourceSelection` 15; `ClinicalQuestion` 16; `AdviceModifier` 118; `AdviceAction` 119; `AdviceClause` 120; `AdviceGroup` 121. Emission: `clinicalArtifacts` builds `advice` at 480 and serializes facts at 497-500. Calls: `clinicalArtifacts→{payloadDocuments,sourceClauses,deriveProvenance,aceSentences,encodedAtom,parseAdviceSentence,answerTerm}`; `answerTerm→{encodedAtom,groupClauses,groupTerm,quotedString}`; `groupTerm→{quotedString,actionTerm}`; `actionTerm→{encodedAtom,quotedString,modifierTerm}`; parser side=`parseAdviceSentence→{parseAction,clauseSource}`, `parseAction→splitComplement`, `clauseSource→actionSource`; source-key side=`sourceClauses→groundHead`.

### M2

`clinicalArtifacts` serializes `clinical_advice(Q,Source,clinical_answer(Doc,Rules,Passage)).` at 481 and `clinical_advice_source(Q,Source,SameAnswer,[site(Line,GroundHead),...]).` at 482-483. Its helper starts with `multifile clinical_advice/3`, `dynamic clinical_advice/3`, `discontiguous clinical_advice_source/4`, then all advice facts followed by all source facts at 496-500. `payloadSource` appends those exact UTF-8 bytes after `payloadDocuments` and before `PROOF_SOURCE` at `tools/kb/paths.mjs:27-36`. `kb:build` obtains+hashes the combined source at `tools/kb/build.mjs:61-62`; `buildImage` writes it to engine file `prolog.pl`, consults, validates, and `qsave_program`s at `tools/kb/produce.mjs:185-196`; build writes the returned bytes to `kb/generated/kb.pvm` at `tools/kb/build.mjs:84,106`. Separately, `catalogRecords→clinicalArtifacts` emits the goal string from `clinical.mjs:487-493` into `question-catalog.json`; `src/questions/catalog.ts:46-75` loads it and `src/questions/service.ts:43-52` submits it. Because that goal is `clinical_advice(Q,Source,Answer)`, runtime resolution selects the compiled fact without traversing `guideline_*`.

### M3

Wave-1 byte targets in catalog order: term/rule counts `2/10,2/5,1/1,1/4,4/11,1/4,1/3`; LF-joined rendered point bytes `893,1415,113,811,1509,583,343`. Rerun `M5_DUMP=1 pnpm exec vitest run --project node tests/m5-answer-term.probe.test.ts` on `wt/res-m5-2`; fixture=`tests/fixtures/m5-answer-targets.json`. It freezes each of 12 decoded terms, canonical engine text, per-term presentation, and each topic's ordered `{text,sources}` points. Main's current suite independently pins only structure/source sequence and renderer invariants: `tests/questions-live.test.ts:106-126,163-219,359-405`.

Raw contribution order is not `serializeAnswer`'s canonical sort. It is nested declaration order: topic order + each `sources` array at `clinical.mjs:19-60`; map/loop + `advice.push` at 449-485; Prolog fact yield order; `answerRows`' solution map at `src/demo/describe.ts:163-194`; `synthesizeAnswer`'s row/statement iteration and first-seen insertion at 196-218. Exact duplicates retain all producing zero-based source indexes. Any u1 helper reordering can leave canonical sorted bytes equal while changing citations; compare the fixture's ordered `points` as well as its `canonical` fields.

### M5

- Parser=`tools/kb/clinical.mjs:198-268`: accepts only the selected controlled-sentence forms, preserves sentence number/original/condition/subject/mode/actions, and must rebuild the exact source bytes at 261-266. Current `tests/questions-live.test.ts:163-202` exercises it through rebuilt live terms; wave-1 `m5-answer-guard.probe.test.ts` mutates every output component and turns 12/12 red. Main has no direct full-parser fixture, so u1 must retain/port that oracle.
- Renderer=`src/questions/advice.ts:44-189`: strict `modifier/action/rule/clinical_answer/3` decoder; mechanical `words`, `renderAction`, `renderRule`; exact-passage fallback on malformed inner structure. Current checks=`tests/questions-live.test.ts:368-402` plus controller fixtures; wave-1 `m5-answer-term.probe.test.ts` freezes all 7 ordered point sequences and 12 term presentations.
- Aligned passage=`tools/kb/provenance.mjs:531-600` model fields and `clinical.mjs:427-436,475-479` document→`source.text` join. `tools/kb/check.mjs:106-163` re-derives and byte-compares every provenance asset; `tests/questions-live.test.ts:181-185,368-381` requires the exact bag-derived passage in each live term/presentation. u1 may change neither the model nor this join.

### M6

Authoritative enumeration lives at `wt/res-m5-1:tests/m5-inference-support.mjs:23-56`: selected map=`CLINICAL_QUESTIONS.flatMap(question.sources)`; scan `payloadDocuments(files).source` in physical order; `% file` sets document; `% S` sets current selected content case when `S>1`; every following `guideline_` line contributes `{line:index+1,head,bare-or-rule body}` until the next marker; each case must expose exactly one distinct body. `m5-inference-binding.test.ts:34-43,98-107` asserts each expected line participates and exact set equality; mechanism d/e/f erase 686/686.

This is reproducible inside `clinicalArtifacts`: it already obtains the identical canonical payload at `tools/kb/clinical.mjs:425` and selected document/sentence keys at 449-466. Current `sourceClauses` at 393-418 discards later lines via `if (bySentence.has(key)) continue` at 412, so it cannot be reused unchanged. Return ordered per-sentence clause arrays + shared antecedent, preserving physical line numbers; no runtime engine query is needed for compilation.
