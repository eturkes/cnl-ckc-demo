# rev-m1u4-3 — adversarial review of M1.u4, remaining rows

Check set = `.agent/contracts/m1u4-rev-checkset.md` (fixed, 24 rows). Session 1 adjudicated 18.
This report carries the 6 rows session 1 left `unknown`. Row text is in the check set; do not restate it.
Grade: `python3 -P .scratch/validate-report.py .scratch/agents/rev-m1u4-3.md --verdict`

Review target = `e3ef450`, extracted clean with `git archive` to
`.scratch/worktrees/rev-m1u4-3/.probes/clean` so the gate runs from committed state alone.
Probe paths below are relative to `.scratch/worktrees/rev-m1u4-3/`, branch `wt/rev-m1u4-3` at `d7d23a2`.

| id | finding | evidence |
| --- | --- | --- |
| c19 | fail(med): all three literal reach forms make `kb:asset-check` rc 1, but no committed control proves it — a never-matching `ANSWERS` pattern plus a planted production reach leaves the whole gate rc 0 at 171/171. | `.probes/c19-reach.log` (`RC[static-import]=1`, `RC[dynamic-import]=1`, `RC[fs-read]=1`); `.probes/c19-mutant2.log` (`MUTANT2_GATE_RC=0`); `tools/kb/check.mjs:21,29` |
| c20 | fail(low): expectation provenance is clean and both spikes replay — SRC is byte-identical on all six goals — but the byte-sort mutants c20 names stay green, the same unbound sort c12 already carries. | `.probes/c20-spike-src.log` (7 passed); `.probes/spike-gen-diff2.mjs` out (`4/4 sameTermAfterD4Flatten`); `.probes/mutate1.out:21-22` (`c12-rowsort-bytes` GREEN) |
| c21 | pass: from a clean `e3ef450` extraction `rm -rf kb/generated && pnpm gate` is rc 0 at 171/171, the catalog ships inside `kb:build` with no extra gate step, two forced builds are byte-identical and the sibling scan is clean. | `.probes/c21-gate.log` (`GATE_RC=0`); `.probes/c19-c21-c22.log:6` (`question-catalog.json a38e74d9f518`); `package.json:16-18` |
| c22 | pass: all six ids execute live against the real `kb.pvm` in `beforeAll` and are asserted per id, four also by name; with `kb/generated` removed `pnpm test` is rc 1 with 8 files failed and 0 skipped. | `tests/questions-live.test.ts:88-101`; `.probes/c19-c21-c22.log:214-220` (`Test Files 8 failed | 2 passed`, `ABSENT_TEST_RC=1`) |
| c23 | pass: `823ed4f` touches no `src/engine/*`, u4 imports only engine types plus the generated JSON, exports no query surface, stringifies no engine value and hard-codes no runtime count. | `git diff 9f00c97 823ed4f -- src/engine` empty; `src/questions/service.ts:46`; `src/kb/manifest.ts` `KbAssetKind` + `tests/kb-live.test.ts:73` |
| c24 | fail(low): the 14 touched durable files pass every authoring rule and `format:check`/`lint`/`check` clean, but the "deterministic checks own every mechanical rule" line fails at exactly the two spots c19 and c12 already carry. | `.probes/c21-gate.log` (`GATE_RC=0`); provenance scan over the 10 code files rc 1; `.probes/c19-mutant2.log`; `.probes/mutate1.out:21-22` |

## Details

One `### <row id>` section per row needing a ruling. Omit sections for clean `pass` rows.

### c19

**What holds.** `tools/kb/check.mjs:98-102` walks every file under `PRODUCTION_ROOTS` and tests
each one's `latin1` bytes against `ANSWERS`. I planted one file per reach form in `src/` and ran
`pnpm kb:asset-check` against each (`.probes/c19-reach.log`):

| form | planted source | rc | message |
| --- | --- | --- | --- |
| static import | `import x from '../kb/queries/answers/category-a-recommendations.pl'` | 1 | `answer-oracle reach in src/zz-reach-static.ts` |
| dynamic `import()` | `async () => import('../kb/queries/answers/...')` | 1 | `answer-oracle reach in src/zz-reach-dynamic.ts` |
| `fs` read | `readFileSync('kb/queries/answers/...')` | 1 | `answer-oracle reach in src/zz-reach-fs.ts` |

Baseline and post-restore runs are both rc 0, so the scan is not stuck failing. D7's claim that a
byte scan sees all three where an ESLint import rule sees one is measured true.

**The defect.** P5.2 requires the ban be "proven by a committed negative control that introduces the
reach", and the `I` list repeats it ("proven by a control that actually fails, not by an empty
scan"). No such control is committed: `/usr/bin/rg -n 'check\.mjs|asset-check|answer-oracle|queries/answers|PRODUCTION_ROOTS|forbidden' tests/`
returns nothing, and nothing under `tests/` or `tools/` spawns `check.mjs` (only `tools/smoke.mjs`
and `tools/kb/reproduce.mjs` use `child_process`, neither for this). The scan is therefore
self-attesting: its own success line reports `answer-oracle scan clean over 4 roots` whatever the
roots are.

Killing mutant, run as a full gate with a production module holding the literal
(`.probes/c19-mutant2.log`):

- `ANSWERS = new RegExp(['queries','answers'].join('/') + 'zzz')` — never matches.
- `src/zz-reach-under-mutant.ts` = `export const ORACLE = 'queries/answers/category-a-recommendations.pl';`
- Result: `kb:asset-check ok — … answer-oracle scan clean over 4 roots`, then `format:check`, `lint`,
  `check`, `test` 171/171 and `build` all pass. **`MUTANT2_GATE_RC=0`.**

A first mutant, `PRODUCTION_ROOTS = []`, did fail the gate — but at `eslint`
(`@typescript-eslint/no-unsafe-argument` on the now-`never[]` array at `check.mjs:100`), not on the
reach. That kill is an inference accident, not coverage; `PRODUCTION_ROOTS = ['public']` reproduces
the survival cleanly (`.probes/c19-red-c20-spike.log`, `ROOTS_CONTROL_RC=1` only once my control is
present).

**Red artifact.** `.probes/zz-reach.test.ts.src` is the missing control: it writes one file per
reach form into `src/`, spawns `node tools/kb/check.mjs`, and asserts a nonzero status plus the named
failure line. Measured: 4/4 pass at `e3ef450`; 3/4 fail under the `ANSWERS` mutant; 3/4 fail under
`PRODUCTION_ROOTS = ['public']`. Acceptance check for a fix: commit that file (or its equivalent) as
`tests/kb-reach.test.ts`, confirm `pnpm test` green at base, and confirm it goes red under either
mutant.

Severity is med rather than low because the roadmap's own accept clause is "a forbidden-import check
fails on any production import of `queries/answers`", and nothing downstream re-checks it — the same
reasoning that put c12 at med.

### c20

**Expectation provenance (P5.3).** Audited every assertion in `tests/questions-live.test.ts`:

| expectation | anchor |
| --- | --- |
| `committedResult(id)` for all four exported ids | bag read at test time through `verifyBag`, balanced `result/1` extraction — `tests/questions-live.test.ts:56-74` |
| `expect(source, id).toContain(entry.goal)` | bag `queries/pl/<id>.pl` read at test time |
| `toHaveLength(6)`, the six-id tuple | roadmap source clause "Six ID-only catalog entries" |
| `authored` pair and the two substitution atoms | D3 |
| `'yes'` / `'no'`, `solutions([sol([…])])` grammar | D6 / `m.answers`, and compared to the bag result for `recommendation-exists` |
| the 14 rejected inputs | contract Q corpus |
| solution counts | read, never asserted — `counts.every((count) => count > 0)` with the comment stating why |

One expectation has no external anchor: `expect(text).toMatch(/^\S+ — sentence \d+, \w+ \d+$/u)` at
`tests/questions-live.test.ts:294`. That grammar exists only in `src/questions/humanize.ts`, so the
test asserts a shape it took from the artifact under test. The contract never specifies the label
format (D8 constrains only what the humanizer may *not* know), so no better oracle exists; the
adjacent `not.toContain` gloss assertions are the part that carries real force. Reporting it because
P5.3 is stated absolutely; I do not think it is fixable without inventing a spec.

**D9 replay.** Both spike branches are present and rerunnable (`wt/spike-m1u4-gen` `65f496a`,
`wt/spike-m1u4-src` `c193a87`).

- SRC (`.probes/spike/src-catalog.ts`, replayed by `.probes/zz-spike-src.test.ts.src`): 7/7 green —
  the same six ids, and **all six shipped goals byte-identical** to the spike's independently
  hand-written bag-verbatim goals, projection variables equal. This is the strongest single piece of
  evidence for D4 and P1.5 in the unit.
- GEN (`.probes/spike/nested/gen-catalog.mjs`, replayed by `.probes/spike-gen-diff2.mjs`): 4/4
  exported ids agree on the goal *term* after flattening MAIN's `','(…)` prefix form, and on
  projection variables; goal bytes differ exactly as D4 rules, 281/182/286/91 B flattened against
  311/202/316/96 B prefix.

Correction to my predecessor's evidence: `.probes/spike-gen-diff.mjs` read `parsed.id`, but
`parseQueryFile` returns `{ record, sourceSha256 }`. Its four `UNMATCHED id=undefined` lines in
`.probes/spike-gen-diff.out` are a harness bug, not a catalog divergence. `spike-gen-diff2.mjs`
supersedes it. A second limit: the GEN spike record carries no question text, so the differential
covers goal and projection only. Question text is still re-derived and byte-compared every gate run
by `kb:asset-check`, which rebuilds the whole catalog from the bag, so it is not uncovered.

**Mutation matrix.** Taken from `.probes/mutate1.out` / `.probes/mutate2.out`, which I re-read rather
than re-ran:

| mutant | class c20 names | result |
| --- | --- | --- |
| `c20-wrong-goal` | wrong goal | RED, 9 tests |
| `c20-hardcoded-yes` / `c20-hardcoded-no` | hard-coded result | RED |
| `c20-service-ignores-id` | hard-coded result | RED |
| `c20-humanizer-corpus-gloss` | — | RED |
| `c13-expected-off-by-one` | transcribed byte | RED — the expected side really is bag-derived |
| `c12-rowsort-bytes`, `c12-comparerows-bytes` | **byte sort** | **GREEN, survived** |

The byte-sort clause of c20's close condition is therefore unmet, and that is the row's only failure.
The cause and the fix are c12's, already ruled `fail(med)`; c20 adds no separate work, so it ships at
`low` to avoid double-counting. `c13-expected-transcribed-substring` also survived, but that mutant
replaces a byte assertion with a weaker `startsWith` one — assertion removal cannot fail a suite, so
it is non-diagnostic and I do not count it.

### c22

P6.2 and P6.3 both hold; the row is `pass`. Recording the census because the coverage is uneven and
MAIN may want the asymmetry on record.

`beforeAll` boots `EngineSession` on `readGenerated('kb.pvm')` — the real generated image — and runs
every one of `QUESTION_IDS` through `session.solve`, throwing on any outcome that is not `solutions`
or `failure`. So all six ids are live-executed, not stubbed. Named coverage on top of that:

| id | named live test | serialization oracle |
| --- | --- | --- |
| `category-a-recommendations` | yes | bag bytes, `toBe` |
| `dosage-reduction-content` | yes (`it.each` `%s`) | bag bytes, `toBe` |
| `evidence-type-1-recommendation` | yes (`it.each` `%s`) | bag bytes, `toBe` |
| `recommendation-exists` | yes | bag bytes, `toBe`, plus `yes`/`no` |
| `category-b-recommendations` | loop only | count > 0 only |
| `evidence-type-3-recommendation` | loop only | count > 0 only |

The two repo-authored ids have no committed serialization oracle, which is correct — the bag exports
no answer for them, and D2's counts 5 and 3 are exactly the literals the `I` list forbids asserting.
They do carry a named live count assertion outside u4, in `tests/demo-lifecycle.test.ts` ("R10 returns
7 / 5 / 2 / 1 / 3 / 12 live PVM solutions"), so the gate does notice if either stops answering.

P6.3, measured: `rm -rf kb/generated && pnpm test` → `ABSENT_TEST_RC=1`, `Test Files 8 failed | 2
passed (10)`, `Tests 5 failed | 33 passed (38)`, no `skipped` anywhere in the output.
`questions-live.test.ts` dies at collection with `Failed to resolve import "@kb/question-catalog.json"`,
and `kb-live.test.ts` fails five assertions with `run pnpm kb:build first: expected undefined to be
defined`. Both are failures, neither is a skip.

### c24

Census of durable files u4 touched: ten code files in `823ed4f`, plus `.agent/memory.md`,
`.agent/polish.md`, `.agent/roadmap.md` in `450163b` and `.agent/memory.md` again in `8762f96`.

| ledger rule | verdict |
| --- | --- |
| dense, symbol-forward, human-sparse | pass — `.agent/memory.md` "Question catalog and answers (u4)" is telegraphic and `→`/`=` notated; code comments carry no filler |
| no provenance narrative | pass — a scan for dates and discovery verbs over all ten code files returns nothing (rc 1) |
| positive future instructions | pass — the actionable strings are imperative and positive (`run pnpm kb:build`, `question catalog is missing ${id}; run pnpm kb:build`), condition before command |
| ASD-STE100 for human-facing copy | pass by absence of surface — u4 ships no UI copy; question text comes from the bag. The one consumption-time surface is `kb:asset-check`'s CLI output, which is short, active and definite |
| tight, deduplicated modules | pass — catalog/serialize/humanize/service split cleanly; `closeQuote`/`balanced`/`splitArgs` are shared inside `catalog.mjs` |
| why-only comments | pass — comments carry the constraint (Prolog quote doubling, functor boundary, `latin1` byte mapping, `sort/2` not `msort/2`, null prototype) rather than the what |
| deterministic checks own mechanical rules | **fail** — see below |
| `format:check` / `lint` / `check` | pass — rc 0 from the clean `e3ef450` extraction |

The one failure is the CLAUDE.md Engineering line "Deterministic checks own every rule a tool can
decide … uncovered invariant → purpose-built check wired into the gate". Two u4 invariants are stated
as durable claims and owned by no check: the forbidden-reach ban (c19 — a never-matching pattern
survives the whole gate) and the standard-order binding (c12 — a byte sort survives at 171/171).
Severity `low` because both already carry their own rows and their own acceptance checks; c24 adds no
independent fix, only the observation that the gap is a repeated pattern rather than one accident.

Two deliberate non-deduplications I checked and accept: `committedResult` in
`tests/questions-live.test.ts:56-74` re-implements balanced-paren extraction that `catalog.mjs` also
has, and the humanizer re-derives display text the engine already rendered. The first is required by
P5.3 — a test must not share code with the artifact under test, and `balanced` is module-private
anyway — and the second is P4.3's presentation/logic split.

## Register

Out-of-contract observations, each with an evidence pointer and a concrete acceptance check.

- **`kb/generated` is outside the answer-oracle scan.** `PRODUCTION_ROOTS` is
  `['src','tools','vite.config.ts','index.html']` (`tools/kb/check.mjs:21`) while `SCAN_ROOTS` for the
  sibling ban does include `kb/generated`. The app imports `@kb/question-catalog.json` at runtime, so
  generated output is production-reachable. A file planted at `kb/generated/zz-reach-generated.mjs`
  holding the literal leaves `kb:asset-check` rc 0 (`.probes/c19-reach.log`, `RC[generated-root]=0`).
  Blast radius is small: generated content comes from `tools/`, which is scanned. Acceptance check:
  add `kb/generated` to `PRODUCTION_ROOTS` and confirm the planted file makes `kb:asset-check` rc 1
  while a clean tree stays rc 0.
- **A runtime-assembled path evades the ban by design.** `RC[assembled-evasion]=0` for a `tools/`
  module building the path with `String.fromCharCode(47)`. The code comment
  (`tools/kb/check.mjs:24-27`) states this limit and asserts nothing in the repo assembles one, which
  I confirmed. Recording it so the claim stays falsifiable. Acceptance check: the comment stays true —
  re-run `/usr/bin/rg -n "fromCharCode|join\('/'\)" src/ tools/` and confirm only `check.mjs` itself
  matches.
