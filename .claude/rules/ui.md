---
paths:
  - "src/**/*.svelte"
  - "src/app.css"
  - "src/demo/**"
  - "index.html"
  - "tools/copy-check.mjs"
  - "tools/contrast.mjs"
  - "tools/presentation-check.mjs"
  - "tools/smoke.mjs"
  - "tools/browser.mjs"
  - "tools/browser-check.mjs"
  - "tests/*.dom.test.ts"
---

# Presentation and interaction

## Fonts

Self-hosted from `@fontsource-variable/{atkinson-hyperlegible-next,atkinson-hyperlegible-mono,
literata}` (OFL 1.1, no Reserved Font Name, zero transitive deps). Their CSS entrypoints are
**axis-scoped** (`wght.css`, `opsz.css`), never subset-scoped, so importing one emits every
unicode-range subset it carries — literata ships 1848120 B across 42 files. `src/app.css`
therefore hand-authors `@font-face` against the six latin/latin-ext woff2 files: **176732 B**
(`tests/census.test.ts` pins the byte and file figures here from the installed packages), with
family names dropping the packages' `Variable` suffix.

Japanese adds two static faces, committed subsets of `@fontsource/biz-udpgothic` under
`src/fonts/` — the cut, its grader and the ASCII-label rule are in `.claude/rules/i18n.md`.
Both are `@font-face` rows in the same hand-authored block, so `presentation:check` grades
**8** faces against a per-row `scope`, and every font stack ends `'BIZ UDPGothic', sans-serif`
after its latin face.

Vite resolves a bare package specifier inside CSS `url()`, so the latin rules need no relative
path into `node_modules`; the two Japanese rules name `./fonts/` relative to `src/app.css`.

## Colour

Role tokens: `--surface`, `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`,
`--border`, `--action`, `--action-text`, `--warn`, `--focus-ring`, plus the graph palette
`--graph-{label,document,entity,event,operator,value,edge,path}`. Every token must appear in
a declared contrast pair. `--border` must clear 3:1 against `--surface` in both themes;
`contrast:check` owns that ruling, so read the ratio from the check rather than the hex.

`tools/contrast.mjs` grades a DECLARED pair table, not the DOM — jsdom has no canvas, so
axe-core reports every `color-contrast` result as `incomplete` (`tests/axe-contrast.dom.test.ts`). It floors the ratio rather
than rounding, and it fails when a colour token appears in no pair.

The graph canvas draws its own text, so a node label takes NORMAL against its fill while the
fill takes LARGE against the canvas. A pair graded here is only the graph's if the renderer
paints that value — `graph:check`'s `palette` rule is what decides that half
(`.claude/rules/graph.md`).

## Copy

**Every human-facing string lives in `src/i18n/`** — `copy:check` refuses any literal text node
or labelling attribute a component renders, the `CNL / CKC` brand mark aside, and
`src/demo/copy.ts` retains invariant data alone. The locale seam, its consumer pattern and the payload boundary are in
`.claude/rules/i18n.md`.

`tools/copy-check.mjs` is static — there is no TS runner here. It grades `src/i18n/en.ts`
(`INSTRUCTIONS` ≤20 words/sentence, the other three buckets ≤25), holds `ja.ts` at key
parity, and grades the literal prose of every `.svelte` file under `src/` at ≤25. A period between digits is not a sentence boundary, so `License 1.1.` is one sentence;
the sentinel is `U+E000` because a control character trips ESLint `no-control-regex`.

**The seven question strings are payload, not copy.** They are generated from the compiled
goals, and rewriting one would make the displayed question differ from the question that runs.
The copy validator does not grade them.

**A guideline-id source label = `<DocId> — sentence <Sentence>, <locator functor> <n>`**,
built from the five fields of `'$guideline_id'(Role,DocId,Sentence,Locator,Deps)` alone
(`humanizeGuidelineId`, m1u4 D8 + P4): no CDC atom, prefix or token gloss. Any other shape
renders the engine's own display text. `tests/questions-live.test.ts` `answer humanizer` grades
a live answer against this grammar.

The bag labels all 337 documents `unreviewed`. Upstream counts
`approved`/`rejected`/`contested`/`stale`/`unreviewed`, so the label means **no adjudication
decision was recorded** — never that a check failed. Say so wherever it surfaces.

CDC's four reuse requirements for public-domain content: attribution naming the developing
agency; a nonendorsement disclaimer "prominently and unambiguously displayed"; no change to
substantive content; a statement that the material is free on the agency website. The second
is why attribution and nonendorsement cannot live inside the About disclosure.

## Run lifecycle

- **Run serialization chains on the ENGINE CALL, not on the state write.** Every engine call —
  query, proof, intake derivation — goes through the controller's one queue (`#exclusive`),
  which dispatches after the previous call SETTLED, aborted proofs included. A successor that
  awaited its predecessor's settle promise would add a microtask hop a 4-tick test drain
  misses, and the state write is guarded by run identity anyway.
- With nothing live the engine call must go out in `run()`'s own tick — an unconditional
  `await previous?.done` suspends even when `previous` is `undefined`.
- `$state.raw` carries the state union because every transition replaces the whole member, so
  proxying only adds per-read wrapping. Deep `$state` does NOT break result identity —
  measured. Do not re-derive this as a correctness question.
- **The answer region is mounted in EVERY state.** `aria-busy` has to be readable while a run
  is live, so a region that appears at `settled` cannot announce its own replacement. `busy`
  means `running`/`cancelling` alone — booting is not a run, and treating it as one also left
  Cancel enabled during boot.
- An existence question projects no columns, so `answerRows` returns `[]` for it regardless of
  solution count. Mapping its 12 solutions would emit 12 unlabelled radios.
- **A run shows its answers as they stream**: `running`/`cancelling` carry the answers streamed
  so far, and the busy answer region lists their statements without citations, which open once
  the run settles. Only the live run's stream writes; a retired run's late answer is dropped.
- **Booting announces each phase once**: the status line shows one status per reported phase —
  start, `fetch`, `load`, then `verify` and/or `fallback` + `verify`, `restart` before a hung
  boot's retry — then ready, a size only where the worker declared one, never a percentage
  (`.claude/rules/engine.md` `Boot phases`).
- Disabling a focused button drops focus to `body`, so whether Cancel held focus must be read
  in `$effect.pre` and acted on in `$effect`.

## Page viewer

- The ladder's guideline page is drawn by PDF.js (`src/provenance/pdf-viewer.ts`), never a
  browser's own PDF frame: the canvas paints the coverage row's physical page and PDF.js's
  transparent text layer carries the marks. Viewer and worker load through `import()` only when
  the reader selects Load page viewer, and both stay out of the offline precache.
- The passage is marked where the page's text items hold it (`src/provenance/locate.ts`), compared
  NFKC-folded with whitespace, soft hyphens and case removed. A passage whose start runs off the
  page end is marked as continuing; otherwise an unlocated passage marks nothing and says so —
  never a guess. `tests/passage-locate.test.ts` grades every shipped coverage row.
- `.page-viewer` carries `data-document`, `data-state`, `data-page` and `data-coverage`, the
  handles `pnpm browser:check` reads.
- `PageViewer.svelte` is the one viewer: the ladder and the corpus browser both mount it.

## Corpus browser

- The explore area's third view (`CorpusBrowser.svelte`), below the graph and its list: every
  document's coverage row, filterable by document, region or section. Opening one resolves its
  evidence through the ladder's `loadEvidenceDocument` and its page through `PageViewer`.
- Nothing loads until the reader selects Browse every document: the list
  (`corpus-index-*.json`) stays out of the answer path and the offline precache. Its passage note
  says the wording is the document's record — not a Prolog result's, as the answer panel's does.

## Deep links

- The URL carries the selected catalog id alone (`?q=`, `src/questions/link.ts`). Load and
  `popstate` SELECT and never run; an id outside `QUESTION_IDS` is dropped by `replaceState`,
  so it adds no history entry; each later selection pushes one. `tests/question-link.dom.test.ts`.
- App reads `?q=` on mount, so `tests/support/dom-setup.ts` resets the URL before every dom
  test; without it one suite's selection preselects the next suite's question.

## Accessibility

- `svelte-check --fail-on-warnings` is the a11y linter here.
- The compiler rejects a click handler on `role="listbox"`
  (`a11y_click_events_have_key_events`) because it cannot see that an aria-activedescendant
  widget keeps its keyboard path on the combobox. One scoped `svelte-ignore` carries that;
  delegating the click to the listbox also replaces six per-option handlers with one.
- **The combobox is hand-authored — keep it that way.** A component library was rejected for
  it.
- APG's select-only example commits the active option on blur. This widget **cancels**
  instead, matching a native `select`, because a selection starts a Prolog run.
- Svelte 5 `unmount()` returns a promise → `void unmount(app)` in tests.

## Smoke

`pnpm smoke` always runs `pnpm build`, copies `dist` under a nested path, serves it with a
request log, drives chromiumfish, and compares the rendered canonical text against the answer
read out of the vendored bag **at run time** through `verifyBag`.

- **Both browser lanes steer by locale-independent handles alone**: `data-action` on the
  `run`, `find-in-graph`, `load-page-viewer`, `explore-graph` and `language-switch` controls,
  the About count read from `data-documents`, and the boot phase read from `main`'s
  `data-boot-phase` (`start` until the worker reports one). An accessible name is copy, so a lane that
  selects by one breaks on a reworded string with a timeout instead of a diff.
- It keys on `[role="option"][id$="-option-<questionId>"]`; option ids are
  `${uid}-option-${questionId}` and render in `QUESTION_IDS` order.
- It must open the canonical-answer disclosure before reading it — a `<details>` body is not
  visible, so a visibility wait times out at 45 s.
- **Smoke refuses a build stale against the bag.** `pnpm build` copies whatever
  `kb/generated` holds, so a skipped `pnpm kb:build` ships a page that boots and answers from an
  older knowledge base. After its own build, smoke requires the manifest's input digest to equal
  the digest the verified bag yields now and the served saved state to hash to the manifest's pvm
  record. Its two in-process controls alter that digest and flip one served pvm byte, and its
  lane-level firing input serves the same build stripped of the hashed pvm, which the boot grader
  must refuse.

## Shipped bounds

| bound | value | why |
|---|---|---|
| `TYPEAHEAD_MS` (`QuestionCombobox.svelte`) | 500 ms | the typeahead buffer's life, the APG figure; `pnpm test:browser` K5 grades both sides of it |
| `DEMO_BUDGET` (`DemoController.svelte.ts`) | 5 000 000 inferences, 5 000 ms | one prepared question's request-wide budget; shipped catalog peaks sit orders of magnitude below it |
