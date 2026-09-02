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
| U7-13 | unknown | unknown |
| U7-14 | unknown | unknown |
| U7-15 | unknown | unknown |
| U7-16 | unknown | unknown |
| U7-17 | unknown | unknown |
| U7-18 | unknown | unknown |
| U7-19 | unknown | unknown |
| U7-20 | unknown | unknown |
| U7-21 | unknown | unknown |
| U7-22 | unknown | unknown |
| U7-23 | unknown | unknown |
| U7-24 | unknown | unknown |
| U7-25 | unknown | unknown |
| U7-26 | unknown | unknown |

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

unknown

### U7-14

unknown

### U7-15

unknown

### U7-16

unknown

### U7-17

unknown

### U7-18

unknown

### U7-19

unknown

### U7-20

unknown

### U7-21

unknown

### U7-22

unknown

### U7-23

unknown

### U7-24

unknown

### U7-25

unknown

### U7-26

unknown
