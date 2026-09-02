# rev-m1u7-1 — adversarial review of M1.u7, demo presentation + honest framing

Check set = `.agent/contracts/m1u7-rev-checkset.md` (fixed, 26 rows). Verdict table below; detail sections keyed by row id.
Fill every row IN PLACE; never renumber.
Grade: `python3 -P .scratch/validate-report.py .agent/review-m1/rev-m1u7-1.md --verdict`

| id | finding | evidence |
| --- | --- | --- |
| U7-01 | pass: All three font packages are exact 5.3.0 pins; source and built scans found no remote font fetch marker. | `package.json`; `src/app.css`; `dist/` |
| U7-02 | pass: The clean generated build contains exactly six woff2 files, 176732 bytes total, and no other font format. | `pnpm kb:build && pnpm build`; `dist/assets/` |
| U7-03 | pass: Six faces omit the Variable suffix, and all three role tokens retain named system and generic fallback stacks. | `src/app.css` |
| U7-04 | pass: Each of six face rules declares swap and one of the paired latin or latin-ext ranges, with no other subset source. | `src/app.css` |
| U7-05 | fail(low): Used and defined token sets match, but D2's specifically required `--field` token is absent rather than defined and consumed. | `src/app.css:94-109`; `src/questions/QuestionCombobox.svelte:258` |
| U7-06 | pass: The checker parses `:root`, implements WCAG sRGB luminance and ratio math, floors results, and grades a declared table. | `tools/contrast.mjs:31-126` |
| U7-07 | pass: All 17 declared pairs pass category-specific thresholds; independent samples include border on surface at a floored 3.41:1. | `pnpm contrast:check`; `tools/contrast.mjs:31-60` |
| U7-08 | pass: Undefined, malformed, empty-table, and orphan-token mutants each exited 1 with a cause-specific diagnostic, then restored byte-exactly. | `node tools/contrast.mjs`; `tools/contrast.mjs:104-120` |
| U7-09 | pass: A muted-text mutant exited 1 and named all three failing pairs; restoration returned 17 passing pairs and the original hash. | `pnpm contrast:check`; `src/app.css:99` |
| U7-10 | pass: The h1 resolves to D7 byte-for-byte, while the visible-copy census found no milestone, unit, TODO, filename, or catalog-id leak. | `src/App.svelte:48`; `src/demo/copy.ts:23` |
| U7-11 | pass: The lede states current Prolog execution and live answers; no visible copy claims traces, provenance, graphs, or networks. | `src/demo/copy.ts:25-28`; `src/App.svelte` |
| U7-12 | pass: U7 prose is centralized in the two copy records; the validator covers every record plus describe.ts at distinct limits and preserves 1.1. | `src/demo/copy.ts`; `tools/copy-check.mjs:23-126` |
| U7-13 | pass: Each banned filler mutant failed by name, while a 19-word-plus-interpolation sentence passed at the 20-word limit. | `node tools/copy-check.mjs`; `tools/copy-check.mjs:19,82-94,115-119` |
| U7-14 | pass: Separate 30-word instruction and description mutants each exited 1 and named copy.ts, the record key, and count 30. | `node tools/copy-check.mjs`; `src/demo/copy.ts` |
| U7-15 | pass: A jsdom probe rendered every projected descriptor humanized, preserved raw fallback, and byte-matched all six option labels to generated catalog questions. | `src/demo/descriptor.ts`; `src/demo/AnswerPanel.svelte:59-63` |
| U7-16 | pass: The always-visible footer carries developing-agency attribution, nonendorsement, and free availability outside the closed About disclosure. | `src/App.svelte:79-83`; `src/demo/copy.ts:54-63` |
| U7-17 | pass: About states projection, universal unreviewed status with the exact five-value vocabulary, fixed questions, and no clinical use. | `src/demo/copy.ts:31-50`; `/run/host/home/eturkes/Projects/cnl-ckc/tools/goal.py:3125-3147` |
| U7-18 | pass: All three shipped OFL files compare byte-equal to package licences, and every disclosure href resolves in the built dist. | `dist/licenses/`; `src/demo/copy.ts:70-74` |
| U7-19 | fail(low): The historical 11-state walker evidence is credible, but it was not rerun after presentation changes, so current-commit overflow remains unmeasured. | `.agent/contracts/m1u7.md:202`; `git diff 672f334..HEAD` |
| U7-20 | fail(med): Grid and padding adapt correctly, but question and live error/status surfaces lack the required overflow-wrap containment. | `src/questions/QuestionCombobox.svelte:252-303`; `src/demo/RunControls.svelte:89-104` |
| U7-21 | pass: The declared nine-step gate ran from absent generated assets at rc 0; check reported 361 files, 0 errors, and 0 warnings. | `rm -rf kb/generated && pnpm gate`; `package.json` |
| U7-22 | pass: The one authorized browser smoke opened the canonical disclosure and matched the rendered two-row answer to bytes read from the verified bag. | `pnpm smoke`; `tools/smoke.mjs:69-89,177-189` |
| U7-23 | fail(low): The recorded fail verdict is sound, but its 41-error count is wrong—64 reproduce—and the polish entry has no required priority. | `.agent/contracts/m1u7.md:208`; `.agent/polish.md:76-82` |
| U7-24 | fail(med): Four current measurements contradict durable u7 numbers: 81 copy strings, 361 checked files, 221 tests, and 3774068 dist bytes. | `.agent/roadmap.md:131-138`; `.agent/memory.md:214` |
| U7-25 | fail(low): Seven decisions hold, but D2 never defines its promised field token and D1 incorrectly says vendoring requires subsetting. | `.agent/contracts/m1u7.md:12-68`; `src/app.css:94-109` |
| U7-26 | fail(med): File style is strong, but the gate leaves mechanically decidable font, licence, copy-reach, descriptor, and responsive invariants unowned. | `package.json`; `tools/copy-check.mjs:23-34`; `.agent/polish.md:83-86` |

### U7-01

Checked the three dependency pins and scanned `index.html`, `src/**`, and built `dist/**` for `@import`, scheme-bearing `url(...)`, and Google font hosts. `package.json` pins all three packages to literal `5.3.0`; the Python byte/text scan reported `remote_font_markers 0`. Local package URLs in `src/app.css` are the only font sources.

Command: `pnpm kb:build && pnpm build`, followed by the documented Python source/build scan. Observed: build rc 0 after generation; zero remote font markers.

### U7-02

Built from the worktree after generating its absent `kb/generated` inputs, then censused `.woff2`, `.woff`, `.ttf`, `.otf`, and `.eot` recursively. The census reported six files and 176732 bytes: 10740, 17752, 19092, 33996, 42656, and 52496 bytes; every file was `.woff2` under `dist/assets/`.

Command: `pnpm kb:build && pnpm build`, then the Python font-extension census. Observed: build rc 0; `fonts 6 bytes 176732`; zero other font formats.

### U7-03

Read all six `@font-face` blocks and the three root font tokens in `src/app.css`. Families are `Atkinson Hyperlegible Next`, `Atkinson Hyperlegible Mono`, and `Literata`, with no `Variable` suffix. `--font-ui`, `--font-prose`, and `--font-code` select the required family and retain explicit system-family plus generic fallbacks.

Command: the Python face enumerator plus direct `src/app.css` inspection. Observed: six `variable-suffix=False` results and complete fallback tails for all three tokens.

### U7-04

Enumerated all six face blocks. Every block contains `font-display: swap` and `unicode-range`; each family has exactly one latin source and one latin-ext source, and the declared ranges match those two subsets only.

Command: the Python `@font-face` block enumerator. Observed: `font_face_blocks 6`; all six `swap=True` and `range=True`; three latin and three latin-ext sources.

### U7-05

**Severity: low.** Extracted the `:root` definition set and every `var(--...)` use across `src/**`. Both sets contain the same 13 properties; there are no undefined or unused properties and no inline hex fallback. However, `src/app.css:94-109` does not define `--field`, while `src/questions/QuestionCombobox.svelte:258,293` uses `--surface-raised` for fields. This diverges from D2 and the row's explicit requirement that `--field` be defined.

Breached predicate: U7-05/D2's `--field` definition requirement. Impact: no runtime styling defect, but the shipped token model does not implement its recorded field-role decision. **Acceptance check:** define `--field` in `:root`, consume it at each field background, declare its contrast pairs, and make the extracted definition/use diff empty with no inline fallback.

Command: the Python root-definition/use-set diff plus `/usr/bin/rg -n -- '--field|surface-raised|var\(--' src`. Observed: `defs 13`, `uses 13`, both set diffs empty, zero inline fallbacks, and zero `--field` hits.

### U7-06

Read `tools/contrast.mjs:31-126` against WCAG 2.x. It parses only the `:root` body, accepts explicit hex colours, linearizes sRGB at 0.04045, applies the 0.2126/0.7152/0.0722 weights, computes `(L1 + 0.05) / (L2 + 0.05)`, and floors to two decimals before comparison. `PAIRS` is a declared 17-row table with per-row minima; imports are file/path only, with no DOM or canvas path.

Command: direct source inspection. Observed: formula, fail-closed parser, floor operation, and declared-table loop all match the predicate.

### U7-07

Ran the checker and independently recomputed three representative ratios using a separate Python implementation. `pnpm contrast:check` reported `17 pairs pass`. Independent floored results were `--text`/`--surface` 15.10:1 (normal minimum 4.5), `--border`/`--surface` 3.41:1 (non-text minimum 3), and `--action-text`/`--action` 8.51:1 (normal minimum 4.5). The table assigns `NORMAL` or `LARGE` per use site rather than using one global threshold.

Command: `pnpm contrast:check` plus the independent Python WCAG calculation. Observed: rc 0 and all sampled ratios exceed their declared category minima.

### U7-08

Mutated one source at a time under a `try/finally` harness. An undefined `--missing` pair exited 1 with `not defined in :root`; `--text: banana` exited 1 with `not a hex colour`; an empty `PAIRS` table exited 1 with `the pair table is empty`; an added `--orphan` colour exited 1 with `colour tokens in no pair: --orphan`.

Command: four `node tools/contrast.mjs` mutant runs. Observed: rc 1 for all four with cause-specific messages. The harness restored `src/app.css` and `tools/contrast.mjs`; pre/post SHA-256 maps matched, `git status --porcelain` was empty with rc 0, and `git rev-parse --short HEAD` returned `8d8e2e2` as the positive control.

### U7-09

Changed `--text-muted` from `#545d66` to `#b0b0b0` under a `try/finally` harness. `pnpm contrast:check` exited 1 and named `--text-muted` on `--surface` (1.97:1), `--surface-raised` (2.13:1), and `--surface-sunken` (1.8:1). Restoring the token returned rc 0 with `contrast: 17 pairs pass`; the restored file matched its original SHA-256.

Command: the Python mutation harness invoking `pnpm contrast:check` before and after restoration. Observed: mutant rc 1, three named real pairs, restored rc 0, byte restoration true, and clean `git status --porcelain` rc 0.

### U7-10

Compared `src/demo/copy.ts:23` with D7 and followed `src/App.svelte:48` to the rendered h1. The bytes match `Controlled Natural Language - Clinical Knowledge Compiler (CNL CKC) Demo`. A source census for `M1`–`M4`, unit ids, `TODO`, filenames, and catalog ids found only implementation imports, ids, types, or comments; rendered components expose question text, not catalog ids.

Command: the Python wordmark equality check, `/usr/bin/rg` source census, and direct component inspection. Observed: `wordmark_exact True`; no banned marker occurs in `INSTRUCTIONS` or `DESCRIPTIONS`; raw-source hits are non-visible code/comments.

### U7-11

Read the lede and every panel-bound copy entry. It says the demo runs Prolog against a compiled knowledge base and that answers are live, not stored. Case-insensitive scans of the actual copy strings found zero `trace`, `provenance`, `graph`, or `network` terms. App, Answer, and About panels bind those copy records and add no future-feature claim.

Command: copy-record scan plus direct reads of `src/App.svelte`, `src/demo/AnswerPanel.svelte`, and `src/demo/AboutPanel.svelte`. Observed: no M2 trace or M3 graph claim on the shipped surface.

### U7-12

Censused u7's diff from `d5017dd` to `672f334` and current component literals. U7-added prose renders through `INSTRUCTIONS` or `DESCRIPTIONS`; existing short control labels remain in their components, generated questions remain catalog payload, and state wording remains in `src/demo/describe.ts` as the explicit validator exception. `tools/copy-check.mjs` lists both copy-record buckets at 20/25 words and `describe.ts` at 25, rejects an empty extraction, and replaces digit-dot-digit with a sentinel before sentence splitting.

Command: `pnpm copy:check`, source/diff census, and validator inspection. Observed: rc 0 with `copy: 81 strings pass`; four instruction keys and 15 description keys were present; `1.1.` stays one sentence by the `U+E000` path.

### U7-13

Injected `simply`, `robust`, `seamlessly`, and `leverage` separately into `INSTRUCTIONS.selectQuestion`. Each `node tools/copy-check.mjs` run exited 1 and named both the banned word and source key. A template sentence with 19 literal words plus `${'many words here'}` exited 0, demonstrating that the interpolation substitutes one word at the 20-word boundary.

Command: six isolated copy mutations under byte-restoring `try/finally`. Observed: four banned-word rc 1 results; interpolation rc 0 with `copy: 80 strings pass`; restored SHA-256 matched and `git status --porcelain` was empty with rc 0.

### U7-14

Replaced one value in each record, in turn, with a 30-word sentence. The instruction mutant exited 1 with `src/demo/copy.ts INSTRUCTIONS.selectQuestion: 30 words, limit 20`; the description mutant exited 1 with `src/demo/copy.ts DESCRIPTIONS.purpose: 30 words, limit 25`. Both therefore name the file, key, and measured count.

Command: two `node tools/copy-check.mjs` mutation runs. Observed: rc 1 for both; the harness restored the source hash and left no worktree change.

### U7-15

Authored and ran a temporary jsdom test that passed every `QUESTION_ID` through `answerRows` and mounted `AnswerPanel`. The five projected questions rendered `<dt>` values `Recommendation`, `Recommendation`, `What`, `Recommendation`, `Recommendation`; the existential question correctly rendered no descriptor. No `<dt>` began with `noun(` or `wh(`. `describeDescriptor('adjective(unrecognized)')` returned that raw input. A mounted `QuestionCombobox` produced six option labels byte-equal to `kb/generated/question-catalog.json` questions.

Command: `pnpm exec vitest run tests/review-u7.dom.test.ts --reporter=dot`. Observed: the first harness version failed before assertions because jsdom rewrote `import.meta.url` to a non-file scheme; after changing the probe's read path to `process.cwd()`, 1 file / 1 test passed. The temporary test was removed; clean status rc 0.

### U7-16

Read the complete `App.svelte` markup and its bound copy. The footer explicitly names CDC as the developing agency, states that use does not imply endorsement, and states no-charge agency-site availability. It is a sibling after `AboutPanel`, not a descendant of any `<details>`. `AboutPanel` itself has no `open` attribute, so it starts closed without hiding any footer requirement.

Command: direct markup/copy inspection. Observed: all three requirements render unconditionally on first render and none is in a disclosure.

### U7-17

Read every About-bound string. It states that the demo runs a compiled projection rather than unchanged CDC text; every compiled document is `unreviewed`; the other values are `approved`, `rejected`, `contested`, and `stale`; the six-question list is fixed; and the demo is not for clinical decisions. A direct bag scan found 337 `label` rows, all `unreviewed`. Upstream `tools/goal.py:3125-3147` derives exactly the same five counters.

Command: direct copy inspection, tarfile label-row census, and upstream source read. Observed: `label_rows 337`, `Counter({'unreviewed': 337})`, and vocabulary equality.

### U7-18

Compared each built licence to its package source with `cmp -s`. Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono, and Literata each returned rc 0; shipped sizes were 4599, 4609, and 4506 bytes. The three `FONT_LICENCES` hrefs each resolve to a regular file below `dist/`, and `AboutPanel` renders the complete array.

Command: three `cmp -s` calls plus href-resolution census. Observed: three rc 0 comparisons and three `exists True` links.

### U7-19

**Severity: low.** The contract records a real-browser walker at commit `124e34d`: 11 states at 320, 375, and 1280 CSS px, all `overflow=false`. I did not rerun that browser-only walker because it is absent from this branch and outside the authorized command set. Current HEAD changed `App.svelte`, `AboutPanel.svelte`, `copy.ts`, and combobox logic after u7, including a newly rendered corpus line. Thus the historical measurement has clear provenance but does not measure the current commit.

Breached predicate: U7-19/R1 current-commit measurement. Impact: no overflow is observed, but the three-width, every-state guarantee is unsupported after the later presentation diff. **Acceptance check:** run the typed/current walker over every reachable state at 320/375/1280 and require `scrollWidth <= clientWidth` for every row.

### U7-20

**Severity: medium.** `AnswerPanel.svelte:126-139` uses one grid column below 34rem and two above; `App.svelte:107` uses viewport-scaled `clamp` padding. Binding labels, values, and canonical code carry `overflow-wrap:anywhere`. However, the census found no containment on `.box` or `.list li`, which render generated question strings, and none on `.status` or `.alert`, which can render a question or engine-authored error. Only three answer selectors define the property.

Breached predicate: U7-20/R4. Impact: a long unbroken catalog or engine error token can force horizontal overflow on narrow viewports despite the adaptive grid. **Acceptance check:** add explicit inherited or per-surface `overflow-wrap:anywhere` covering combobox value/options and live status/alert, then render adversarial unbroken strings at 320 px with `scrollWidth <= clientWidth`.

### U7-21

Removed `kb/generated` and ran the complete gate. It regenerated 337 inputs, verified 3 assets, passed copy (81), contrast (17), format, lint, type-check, 221 tests, and build at rc 0. A separate `pnpm check` reported `361 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`. `package.json` orders `kb:build`, `kb:asset-check`, `copy:check`, `contrast:check`, `format:check`, `lint`, `check`, `test`, `build`, matching the contract identity.

Command: `rm -rf kb/generated && pnpm gate`, then `pnpm check`. Observed: gate rc 0, 3 assets, 221 tests, and 361/0/0 check result.

### U7-22

Ran the single authorized real-browser smoke. It reported rc 0 at a nested URL, answered `dosage-reduction-content` with two rows, matched the bag, and served eight requests. `tools/smoke.mjs:78` invokes `verifyBag` over the archive at run time; lines 177-185 click `.canonical summary` before reading the code and compare it to the unwrapped committed answer.

Command: `pnpm smoke`. Observed: `smoke: ok ... 2 rows matching the bag, 8 nested requests served`.

### U7-23

**Severity: low.** The walker is absent from current `tools/` and `package.json` has no `visual-qa` script. Materializing commit `124e34d` temporarily at its original path reproduced 548 lines and `pnpm check` rc 1 with `362 FILES 64 ERRORS ... 1 FILES_WITH_PROBLEMS`; it was removed and status returned clean. Thus the fail(low) outcome is sound, but `.agent/contracts/m1u7.md:208` records 41 errors while memory and the run show 64. The polish entry has an acceptance check but no `pri` field.

Breached predicate: U7-23 recorded-evidence accuracy and polish shape. Impact: the deferral is actionable, but its durable count conflicts and its scheduling priority is undefined. **Acceptance check:** change the contract count to 64, add an explicit `pri` to the typed-walker polish entry, and retain the current 64-error reproduction command.

### U7-24

**Severity: medium.** Re-ran every number. Fonts remain 6/176732 B; contrast remains 17 pairs; assets remain 3; walker remains 548 lines and 64 errors. Four durable u7 measurements are stale at current HEAD: copy is 81, not 79; `svelte-check` is 361 files, not 355; tests are 221, not 171; `dist/` is 14 files / 3774068 B, not 3773949 B. The contract's 41 walker errors also conflicts with the reproduced 64 recorded elsewhere.

Breached predicate: U7-24 claim reproducibility. Impact: product gates pass, but the roadmap, contract, and memory no longer honestly describe the reviewed artifact. **Acceptance check:** refresh all current-commit counts in their canonical durable locations, resolve 41 versus 64 to the reproduced 64, and rerun the same census from the resulting commit.

### U7-25

**Severity: low.** Walked D1–D9 to current use sites. D3–D9 hold: catalog questions remain generated bytes; descriptors humanize with raw fallback; CDC requirements remain outside disclosures; canonical Prolog uses its own disclosure; D7 is exact; u7 prose is record-backed and graded; contrast uses a declared table because jsdom cannot supply a complete canvas contrast result. Two decision details fail. D2 says the rewrite defines `--field`, but the token is absent and fields consume `--surface-raised`. D1 rejects vendored woff2 because it “needs manual subsetting,” yet the six package files referenced by `app.css` are already latin/latin-ext subsets and could be vendored byte-for-byte; regeneration and update ownership are real costs, subsetting is not.

Breached predicate: U7-25 decision accuracy for D1 and D2. Impact: the implementation remains functional, but the durable rationale misstates one alternative and one promised token outcome. **Acceptance check:** either define and consume `--field` or revise D2 to record deliberate reuse of `--surface-raised`; revise D1's rejected-route cost to regeneration/update/read-exclusion without claiming required subsetting.

### U7-26

**Severity: medium.** Per-file ledger: `src/app.css` is dense and its comments explain subset/token constraints; `copy.ts` keeps human prose direct and gate-limited; `descriptor.ts` is a small structural fallback; `AboutPanel.svelte`, `App.svelte`, and `AnswerPanel.svelte` are modular with why-only comments; `contrast.mjs` is fail-closed and independently checkable; `copy-check.mjs` is compact but path-fixed. The ledger fails Engineering's deterministic-ownership rule. No gate step decides exact font pins/assets/ranges/family/swap/network absence, OFL byte equality and links, exact D7/framing copy, descriptor rendering/fallback, browser overflow, or full long-text containment. The committed polish register itself concedes that new-component prose escapes `copy-check`; the descriptor probe and responsive walker are also outside the gate.

Breached predicate: U7-26/CLAUDE.md deterministic checks own every tool-decidable rule. Impact: a green gate can ship regressions in u7's core delivery and honesty claims; this review found missing `--field`, missing wrap coverage, and stale measurements under that gap. **Acceptance check:** add committed gate checks for font/licence/framing/descriptor/static-responsive invariants, derive copy-check's source set from the tree, and add a typed browser check for state/width overflow; prove one negative control per checker.

## Register

- **REG-01 · low — copy diagnostics/counts double-grade keyed literals.** Each banned-word and 30-word mutant produced one keyed failure plus an identical `<literal>` failure, and a template substitution changed the passing count from 81 to 80 without removing prose. Evidence: `tools/copy-check.mjs:37-62`; mutation outputs in U7-13/U7-14. **Acceptance check:** identify literals by source span and grade each once while retaining full `copy.ts` and `describe.ts` coverage; require one failure and a stable unique-string count per one-string mutant.
