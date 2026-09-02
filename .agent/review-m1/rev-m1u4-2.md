# rev-m1u4-2 — adversarial review of M1.u4

Check set = `.agent/contracts/m1u4-rev-checkset.md` (fixed, 24 rows). Verdict table below; detail sections keyed by row id.
Grade: `python3 -P .scratch/validate-report.py .scratch/agents/rev-m1u4-2.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| c01 | pass: exactly 6 stable ids on a frozen null-prototype record; `__proto__`/`constructor`/`toString`/`hasOwnProperty`/`valueOf` all resolve `undefined`; a runtime-assembled id resolves. | `.probes/probe1.log` c01 block; `src/questions/catalog.ts:44-72` |
| c02 | pass: 25-value hostile corpus (empty, whitespace, ACE, raw goal, conjunction, case shifts, trailing dot, proto keys, non-strings) collapses to one variant with 0 engine calls. | `.probes/probe1.log` c02 block (`distinctResults` size 1, `engineCalls=0`) |
| c03 | pass: all six entries carry goal (96-316 B), declared projection and provenance; no goal contains its question text; service reads `entry.goal`, serializer reads `entry.projection`. | `.probes/probe1.log` c03 block; `src/questions/service.ts:47`; `src/questions/serialize.ts:186` |
| c04 | pass: an independent balanced-paren extractor over the bag's own bytes reproduces all four goals exactly (311/202/316/96 B) in canonical prefix form; generator consumes `verifyBag().files` in memory only. | `.probes/gen.out` c04 block; `tools/kb/catalog.mjs:184-206`; `tools/kb/build.mjs:53-55` |
| c05 | pass: the shared `replaceOnce` guard rejects zero-hit, two-hit and both named near-miss atoms; both authored ids run live at 5 and 3 solutions. | `.probes/gen.out` c05 block; `.probes/live.log` (`category-b`=5, `evidence-type-3`=3) |
| c06 | fail(low): generation is byte-deterministic and 13/14 structural mutants fail closed, but an extra well-formed query file with a new id silently emits 7 entries at `kb:build` rc 0. | `.probes/gen.out` c06 block ("extra query file with distinct id: NO THROW -> 7 records"); `pnpm kb:reproduce` = `a38e74d9f518` |
| c07 | pass: `ask` reaches the engine through one call site, `#client.query(entry.goal, budget, signal)`; the budget is forwarded by identity and `validateBudget` gates it; no `consult` path exists under `src/questions/` or `src/demo/`. | `src/questions/service.ts:46`; `src/engine/client.ts:190-201`; `.probes/probe1.log` c07 block |
| c08 | pass: an injected live DTO renders its own fabricated value, and `queries/answers`, `guideline_answers` and `query_sha256` are all absent from the built `dist/` while `guideline_entity` hits as a control. | `.probes/probe1.log` c08 block; `.probes/reach2.out` (answer-oracle scan clean over 4 roots); `/usr/bin/rg -al 'guideline_answers' dist/` rc 1 |
| c09 | pass: all 17 engine outcomes (solutions, failure, cancelled, 6 limits, 8 error codes) map to 17 distinct result tags; an honest zero-solution run stays `failure` and still serializes. | `.probes/probe1.log` c09 block (`distinctTags=17 of 17`, `honestZeroSerialized=no`) |
| c10 | pass: `recommendation-exists` has an empty projection, renders `yes` from 12 live proofs and `no` when exhausted; a row question with no solutions renders `solutions([])`, never `no`. | `.probes/live.log` (`proofs=12 serialized=yes`); `.probes/probe1.log` c10 block; `src/questions/serialize.ts:150` |
| c11 | pass: undeclared and extra bindings are dropped, the `1r3` rational and the `'$guideline_id'/5` compound keep engine text, no `JSON.stringify` touches an engine value, and a missing declared variable throws a named error. | `.probes/probe1.log` c11 block; `/usr/bin/rg -n 'JSON.stringify' src/` → only the comment at `src/engine/terms.ts:6` |
| c12 | fail(med): the comparator is a correct total SWI order that beats a byte sort on live data, but replacing the serializer's row sort with a byte sort leaves `pnpm test` at 171/171 — the sort is unbound to `compareTerms`. | `.probes/mutate1.out` (`c12-rowsort-bytes`, `c12-comparerows-bytes`, `c12-dedup-removed` all GREEN); `.probes/probe1.log` c12 block |
| c13 | pass: the expected bytes are the balanced `result/1` argument extracted at test time from the verified bag; three one-byte runtime mutants and a one-byte expected-offset mutant all turn the suite red. | `tests/questions-live.test.ts:58-72`; `.probes/mutate1.out` (`c13-runtime-separator`, `c13-runtime-functor`, `c13-runtime-sol-spacing`, `c13-expected-off-by-one` all RED) |
| c14 | pass: each of the three other ids has its own named case and its own bag-read comparison, and all three are byte-equal (158/158, 79/79, 3/3), not merely value-equal; injected divergences name the offending value. | `.probes/live.log` c13/c14 block; `.probes/live2.log` (`divergenceDetected=true namesValue=true`); `tests/questions-live.test.ts:239-246` |
| c15 | pass: every projected cell is `solution.display[variable]`, which `term_string/3` renders under `[quoted(true),numbervars(true),ignore_ops(true)]`; a trap display passes through verbatim into `solutions([sol([...])])`. | `src/engine/session.ts:73-74,327-334`; `src/questions/serialize.ts:150-186`; `.probes/probe1.log` c15 block |
| c16 | pass: the humanizer's only string literals are `'$guideline_id'` and `PlTerm` kind tags — `ref`/`box` come from `term.functor` — and it formats `product/ref`, `context/box`, a non-CDC id and a hyphen-free id alike. | `/usr/bin/rg -no "'[^']*'" src/questions/humanize.ts`; `.probes/probe1.log` c16 block (12 cases) |
| c17 | pass: eight malformed or unsupported shapes return the engine text without throwing, the label never reaches the serialized bytes, and the sort key stays the term rather than the display string. | `.probes/probe1.log` c16/c17 blocks (`labelInSerialized=false`, `sortKeyIsTermNotDisplay=true`); `src/demo/describe.ts:155` |
| c18 | pass: a per-process-unique marker is proven absent, the overlay is consulted, and the live result moves 7→8 rows carrying it; an independent replay adds that a fresh engine drops the marker and restores baseline bytes. | `tests/questions-live.test.ts:263-311`; `.probes/live.log` c18 block (`markerAbsentBefore=true`, `rowsAfter=8`, `freshEngineMarkerGone=true`) |
| c19 | unknown | unknown |
| c20 | unknown | unknown |
| c21 | unknown | unknown |
| c22 | unknown | unknown |
| c23 | unknown | unknown |
| c24 | unknown | unknown |

## Details

One `### <row id>` section per row needing a ruling. Omit sections for clean `pass` rows.

All probes ran in worktree `wt/rev-m1u4-2` at base `9020e62`. Probe sources + raw logs are committed
under `.scratch/worktrees/rev-m1u4-2/.probes/`; paths below are relative to that directory.

### c05

Behaviour is correct and P1.8/D2/D3 hold. Measured guard, driving `catalogRecords` with a patched
`AUTHORED` table (`.probes/gen.mjs`): zero-hit atom, `'category-B-decision'`, `'evidence-type-2-recommendation'`
and a two-hit token each throw `occurs N times, expected exactly 1`; an unknown base id throws
`derives from X, which the bag does not export`. Live counts through the real PVM = 5 and 3.

Two facts MAIN should rule on:

- **The guard is unguarded.** Mutant `c05-guard-relaxed-to-atleast-one` (`hits !== 1` → `hits < 1`)
  and mutant `c05-authored-goal-unquoted-token` (quoted token → bare substring) both leave the whole
  gate GREEN at 171/171. So the "token-exact, single-hit" property that `.agent/memory.md` states as
  a durable claim has no committed check. Killing test would be a unit case over `catalogRecords`
  with a two-hit and a substring-hazard `AUTHORED` row; it is green on `9020e62`, so it ships as
  coverage, not as a red test.
- **Identity substitution passes.** `was === now` replaces exactly one token and is accepted, emitting
  an authored entry whose goal equals its base goal. P1.8 counts occurrences only, so this is within
  the letter of the contract; flagging in case D3 meant the substitution to be value-changing.

### c06

`catalogJson` is byte-stable in process, and `pnpm kb:reproduce` reports two forced builds identical
(`kb.pvm 3ae8d455d875, kb.qlf 62bc61cc7d0e, question-catalog.json a38e74d9f518`). Thirteen structural
mutations of the in-memory bag map fail closed with a named error: mutated `goal/1`, missing query
file, duplicate ids, `answer/2`→`reply/2`, `answer/3`, non-variable projection, `answers/1` not a
list, missing question comment, missing `'$guideline_query'`, missing projection term, empty goal and
an empty query set.

The one survivor: **an extra, well-formed query file carrying a distinct id**. `catalogRecords` emits
7 records, `kb:build` exits 0, and `kb:asset-check` re-derives the same 7 and agrees with its own
manifest, so both catalog steps stay green. The failure surfaces one gate step later, in
`src/questions/catalog.ts:50` (`holds 7 entries, expected 6`), which turns `pnpm check` and `pnpm test`
red. P1.10 asks generation itself to fail closed on an *unexpected* clause, and the row's close clause
asks every malformed case to make `kb:build` nonzero; this case does neither.

Severity is low because the bag is digest-pinned against its committed sidecar
(`tools/kb/build.mjs:29-31`), so an extra query file cannot enter through the shipped path without
failing the digest check first. Acceptance check for a fix: `catalogRecords` throws when
`names.length` differs from the count the manifest/contract declares, and `pnpm kb:build` exits
nonzero for the extra-file case in `.probes/gen.mjs`.

### c12

The comparator itself is right. Measured over a mixed-shape corpus, `compareTerms` sorts
`variable < float(2.0) < integer(2) < rational(5/2) < integer(100) < atom < string < compound(f/1)
< list([a] = '[|]'/2)`: type before value, float before integer at equal value, compounds by arity
then name then arguments, `[]` equal to the atom `[]`. It is antisymmetric over that corpus, no two
distinct shapes tie, and the live category-A answer is permutation-invariant. On live-shaped rows it
genuinely disagrees with a byte sort: sentences 1, 2, 10 under one document id serialize as 1,2,10
by term order and 1,10,2 by byte order.

The defect is the binding, not the order. Two mutants that swap the serializer's row sort for a byte
sort of rendered text leave the entire gate GREEN at 171/171:

- `c12-rowsort-bytes` — `rows.sort(compareRows)` → `rows.sort((a,b) => compareText(a.text.join(','), b.text.join(',')))`.
- `c12-comparerows-bytes` — `compareRows` returns a byte comparison of the rendered row.

Nothing in the committed suite proves `serializeAnswer` consults `compareTerms`. The four
`canonical order` tests call `compareTerms` directly; the byte-reproduction tests pass under a byte
sort because, as D5 anticipated, this corpus is one uniform `'$guideline_id'/5` shape where the two
orders coincide; and the permutation test passes because a byte sort is order-independent too. Only
mutating `compareTerms` itself (`c12-compareterms-bytes`, `c12-arity-name-swapped`,
`c12-atom-string-rank-swapped`, `c12-number-atom-rank-swapped`) turns the suite red. D5's own
rationale — "nothing downstream re-checks a wrong sort" — is precisely why this binding needs a
check, so the severity is med rather than low even though the shipped bytes are correct today.

A third mutant, `c12-dedup-removed` (drop the `sort/2`-style duplicate collapse), is also GREEN. The
collapse does work on live data: an injected duplicate row for `dosage-reduction-content` was
absorbed, leaving the committed bytes intact. No committed test covers it.

Acceptance check for a fix: one test that serializes a two-row mixed-ordinal corpus (sentence 2 and
sentence 10 under the same document id) and asserts the ordinal-2 row first, plus one that
serializes a duplicated solution and asserts a single `sol([...])`. Both are green on `9020e62` and
red under `c12-rowsort-bytes` / `c12-dedup-removed` in `.probes/mutate.mjs`.

### c14

Ruling is `pass` and the row is stronger than P3.4 asks. P3.4 wants canonical value-equality per id;
the shipped test compares bytes with `toBe`, and all four exported ids match their bag `result/1`
argument exactly: category-A 481/481 B, `dosage-reduction-content` 158/158, `evidence-type-1-recommendation`
79/79, `recommendation-exists` 3/3 (`yes`). The three non-A ids ride an `it.each` whose `%s` puts the
id in each test name, so a verdict is per-id, not shared. This does not contradict `.agent/polish.md`
"Four-query byte differential", which defers reproducing the whole committed 734-byte artifact; the
`result/1` argument is byte-proven for all four, the envelope for none, exactly as D6 rules.

One reporting limit MAIN may want to close: an *extra* term is named in the one-line assertion
message (`zz-divergent` appears), but a *missing* term is not — both sides truncate to their shared
prefix, so only the reporter's full diff shows which solution is absent. The `I` line "a canonical
value-equal verdict names its comparison" is satisfied; "each divergence named exactly" holds for
extra and altered terms and holds only via the full diff for missing ones.

### c18

P5.1 is met, and I reproduced it independently: marker absent before, `consulted` after, live rows
7→8 carrying the marker, and — beyond the committed test — a freshly booted engine returns the
baseline 7-row bytes with the marker gone.

The premise MAIN should correct: **`dynamic/1` is not what makes the overlay work in this build.**
Consulting the same seven clauses with no `dynamic/1` preamble returns `{"kind":"consulted"}`, emits
no diagnostics, and moves the result to 8 rows with the marker present — identical to the declared
version. So the comment at `tests/questions-live.test.ts:277` ("Schema predicates ship static, so the
overlay declares them dynamic first") and the matching `.agent/memory.md` line describe a constraint
this build does not impose. The declarations are harmless belt-and-braces; the claim about why they
are there is unfalsified. Acceptance check: rerun `.probes/zz-live2.test.ts.src` case `c18b` and
confirm `consultWithoutDynamic` still reports `consulted` with `carriesMarker=true`, then either
drop the preamble or restate the comment as defensive rather than required.

## Register

Out-of-contract observations, each with an evidence pointer and a concrete acceptance check.
