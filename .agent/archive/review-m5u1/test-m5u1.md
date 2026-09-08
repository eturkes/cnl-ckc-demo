# test-m5u1 — diff-blind red suite for M5 u1

Gate: `python3 -P .scratch/validate-report.py .scratch/agents/test-m5u1.md` → rc 0.
Fill each row IN PLACE. Never renumber, never drop, never add a row.
`finding` ≥40 chars, dense/telegraphic, `→`/`=` notation, no prose padding, ≤400
chars. `evidence` = `path`, `path:line`, or `` `cmd` `` that reproduces it, ≥8
chars — a bare `` `cmd` `` placeholder fails the gate.
Keep `|` out of cell text (escape as `\|`); one physical line per row.
Detail sections below the table are keyed by row id; write one only where MAIN
needs more than the row to rule. MAIN reads the table first — it is the budget.

**Phase 1** fills `finding` with the proposed probe + your contract reading +
the OUTCOME YOU EXPECT, so MAIN can batch-rule it. **Phase 2** encodes every
ruled row as a red test and rewrites the row's `evidence` to name the test.

## Rows

| id | finding | evidence |
| --- | --- | --- |
| T1 | Probe = ordered UTF-8 arrays for 7 strings, 12 canonical terms and 12 flattened contributions. Expect hashes `dacbfac1c8b4`, `59a516ba9989`, `ba17af72c3d2`; order = rec01,02,03,04,06,07,08,09,10,11,05,12. Sorting, reversal or any per-index drift fails. | `.agent/contracts/m5u1.md` |
| T2 | Probe = independently map `(Doc,S)` to ordered lines and grounded heads; execute each gate under its premises, then erase or relocate named sites. Reading = “gated on” means every exact-line body runs. Expect baseline success; deletion/new-line reassertion fails, so metadata-only gates fail. | `git show wt/res-m5-2:tests/m5-fragment-binding.probe.test.ts` |
| T3 | Probe = scan verified `payloadDocuments` plus a frozen 12-document selection, never `clinicalArtifacts`; compare keyed gate lists, flattened multiset and reverse difference. Reading = P3 means an exact partition, not set-only coverage. Expect 48 gates, 686 unique expected/actual lines, with no missing, invented, duplicated or misassigned line. | `git show wt/res-m5-1:tests/m5-inference-support.mjs` |
| T4 | Probe = a second raw-member scanner reconstructs sorted `/prolog.pl` framing and cross-checks ACE S2+ markers; compare its keyed digest/count to ported `CASES` and the dynamic erasure census. Reading = P4 needs an independent oracle. Expect 48 sentences, the exact line multiset, 686 sites and rec01:S2 = 9. | `git show wt/res-m5-1:tests/m5-inference-binding.test.ts` |
| T5 | Probe = census every real sentence’s distinct raw-body set, then mutate one of rec07:S2’s 42 clauses to `true`. Reading = D3 uses exact body bytes per sentence. Expect all 48 real sets are singleton; the mutant throws `cdc2022-opioid-rec07:2: multiple antecedents` before emission. | `.agent/contracts/m5u1.md` |
| T6 | Probe = independent Prolog-term oracle over real NAF/facts plus synthetic nested `(A,(B,C))`, repeated `A`, a ground literal and `true`; compare ordered `clinical_premise/4` facts. Reading = recursively flatten positive conjunctions, drop each `\+ G` subtree, preserve ground terms. Expect exact literals; `true` and NAF-only bodies emit none. | `.agent/contracts/m5u1.md` |
| T7 | Probe = compare all grounded records across reruns and reversed file-map insertion. Reading = D5 gives one map per sentence. Expect repeated names across heads/premises share `(Doc,S,N)`, adjacent sentences/docs differ, and ordinals stay deterministic; global or per-record maps fail. | `.agent/contracts/m5u1.md` |
| T8 | Probe = synthetic repeated `A` across heads/premises, adjacent sentences/docs, and quoted `'acute-pain'`. Reading = D5 requires one tokenizing skolem map per sentence. Expect shared head/premise skolem, isolated scopes, intact atom bytes; global, per-term or substring maps fail. | `.agent/contracts/m5u1.md` |
| T9 | Probe = frozen-base snapshots for 48 parsed clauses, 12 canonical presentations and 12 `deriveProvenance(...).source.text` byte strings. Reading = helper/dependency drift can change behavior while named function spans stay text-identical. Expect deep/UTF-8 equality plus new predicates present; PREPOSITIONS, words or alignment mutations fail. | `tools/kb/clinical.mjs` |
| T10 | Probe = valid corpus plus sentinel `If then every clinician should consider opioid-therapy.`; require valid parses and the sentinel’s exact `not lossless` throw. Reading = compare direct bytes, without normalization. Expect deletion, constant-false or whitespace-normalized guards to accept the sentinel and fail; inverted equality rejects valid corpus and fails. | `tools/kb/clinical.mjs:260` |
| T11 | Probe = derive twice and with reversed file-map insertion; compare rule/premise/gate tuples, then compare two in-memory `buildImage` outputs. Expect advice order stays question/source, new rows stay payload/sentence/literal/site order, and bytes match; MAIN confirms full `pnpm kb:reproduce`. | `tools/kb/produce.mjs` |
| T12 | Probe = same-file/toolchain in-memory base→u1 builds; baseline helper = 39,063 B, hash `4a40e521d277`. Record full UTF-8 payload, PVM and QLF `new-base` via `Buffer.byteLength`, `buildImage`, `buildQlf`. Expect reproducible signed integers; P10 states no failure ceiling. | `tools/kb/paths.mjs` |
| T13 | Probe = mutate verified files in memory for each fault: remove a selected PL S marker, leave metadata-only ACE, break a quoted head atom, inject CR into ACE, and add an empty ACE line. Reading = malformed source must abort before artifact use. Expect each `clinicalArtifacts` or `buildImage` call rejects with fault-specific diagnostics, never partial records. | `tools/kb/clinical.mjs` |
| T14 | Probe = MAIN rules the remaining keyed inventory below. D5 now settles singleton fragments, no `clinical_site/4`, and one ground map. Expect explicit outcomes for multiplicity/order, map traversal/ordinals, malformed-source scope, P7 pins and budget recording before encoding. | `.agent/contracts/m5u1.md` |
| T15 | Probe = full-corpus exact-site mutation: under emitted premises every gate succeeds, erasing each of 686 original clauses makes its gate fail, and same-head/body reassertion at a new line stays natively callable but the gate stays failed. Reading = metadata is not binding. Expect fake `clinical_use`, Doc/S lookup, precomputed success or unexecuted lines fail. | `git show wt/res-m5-2:tests/m5-fragment-binding.probe.test.ts` |

## Details

### T14 — contract rulings requested

1. **Multiplicity/ownership.** P3’s union admits duplicate gates or one site under
   several gates. Proposed = exactly 48 rules + 48 gates; all 686 unique lines occur
   once, only under their owning `(Doc,S)`, in payload order.
2. **P4 identity.** “Line multiset” is weaker than D2’s `{line,head,body}` recipe.
   Proposed = compare the full keyed source vector; P3 alone projects its lines.
3. **New-record order.** Question/source order differs from payload order at rec05.
   Proposed = old facts retain question/source order; new rule, premise and gate rows use
   payload-document, sentence, antecedent and site order. Inter-kind source layout is not
   contractual beyond deterministic bytes.
4. **Marker/domain errors.** D2 prose admits `% S2:` while reference `CASES` requires
   `% S2: <text>`; ACE↔PL missing/extra sentences are unspecified. Proposed = exact
   reference regex plus a bijection of selected ACE S2+ and PL content sentences.
5. **Shared-map traversal.** D5 requires one map but does not order first sightings
   across body and 686 heads. Proposed = seed from positive premises left-to-right after
   dropping NAF, then visit heads in payload order; reset per `(Doc,S)`.
6. **Two ordinals.** `clinical_premise(...,N,...)` and skolem `(...,N)` overload N.
   Proposed = independent zero-based counters: premise N = literal position; skolem N =
   shared-map first-occurrence position.
7. **Anonymous/duplicate leaves.** `_` freshness and repeated positive literals are not
   stated. Proposed = each `_` occurrence is fresh; preserve duplicate literals and
   order. Emit a ground positive leaf unchanged and emit none for `true`.
8. **Unsupported controls.** Only conjunction, `\+` and `true` have semantics. Proposed =
   fail closed on other control forms instead of treating them as assumable literals.
9. **Malformed/error scope.** T13 does not locate CR, no-content or quoted-atom faults.
   Proposed = reject CR in selected ACE/PL, metadata-only ACE, zero-site PL sentence and
   unterminated head/body atoms. Pin P5’s full category; regex-grade other diagnostics.
10. **P7/budget evidence.** “Unchanged” and “payload delta recorded” omit mechanics.
    Proposed = base-span hashes + behavioral snapshots; measure full `payloadSource`,
    PVM and QLF deltas from `22053ef`, no ceiling, recorded in the unit verdict table.

## Row prompts

- **T1** — P1 byte identity. Exactly WHAT bytes get compared, and every divergent
  reading of "raw contribution order". Name the comparison that would catch a
  reordering a naive set-equality misses.
- **T2** — P2 "every fragment names the content-bearing clause line it is gated on".
  What does this admit and exclude? What gate would satisfy the letter and break the
  intent (e.g. naming lines it never executes)?
- **T3** — P3 total coverage, 686 lines, equality BOTH ways. How do you enumerate the
  site set WITHOUT importing MAIN's producer? A coverage check that reuses the
  producer proves nothing.
- **T4** — P4 reference-recipe equality. Risk that `wt/res-m5-1`'s `CASES` is itself
  wrong. What independent evidence confirms 686 is the right number?
- **T5** — P5 one-antecedent-per-sentence. Does any real sentence in the 12 selected
  documents come close to violating it? What synthetic input must fail the build?
- **T6** — P6 premise decomposition edge cases: `\+` subgoals, nested conjunction,
  repeated variables, an antecedent that is already ground, `true` bodies (facts).
- **T7** — D4 skolem grounding: collisions between documents/sentences, ordinal
  stability, determinism across runs, and what a wrong sharing rule would break.
- **T8** — D5 one shared ground-head/premise skolem map. What detects cross-sentence
  collisions, broken head↔premise sharing, or atom-corrupting substring replacement?
- **T9** — P7 frozen surfaces. What change to `parseAdviceSentence`/renderer/aligned
  passage would evade a plain diff check? Propose the behavioural pin.
- **T10** — P8 lossless guard fails closed. Enumerate mutants of the rebuild-equality
  check that must be caught, and the sentence input that catches each.
- **T11** — determinism: emitted record ORDER, and `pnpm kb:reproduce` byte identity
  with the new records present.
- **T12** — P10 budget: exact measurement recipe for the payload/PVM/QLF delta, and
  what threshold (if any) should fail the build.
- **T13** — fail-closed on malformed payload: missing `% S<n>:` marker, document with
  no content sentence, unterminated quoted atom, `\r` in source, empty ACE sentence.
- **T14** — divergent contract readings. Every place `.agent/contracts/m5u1.md` is
  ambiguous enough that two implementers would build different things. **MAIN rules
  each; this row is the one most likely to change the contract.**
- **T15** — adversarial: describe an implementation that passes P1-P3 and still fails
  u1's intent — the exact failure mode that produced M5 (green gate, no real binding).
  Propose the probe that kills it.
