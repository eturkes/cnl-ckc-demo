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
unicode-range subset — literata alone is 1883680 B across 58 files. `src/app.css` therefore
hand-authors `@font-face` against the six latin/latin-ext woff2 files: **176732 B**, pinned by
`presentation:check`, with family names dropping the packages' `Variable` suffix.

Japanese adds two static faces from `@fontsource/biz-udpgothic` — sizing, the rejected
alternatives and the ASCII-label rule are in `.claude/rules/i18n.md`. Both are `@font-face`
rows in the same hand-authored block, so `presentation:check` grades **8** faces against a
per-row `scope`, and every font stack ends `'BIZ UDPGothic', sans-serif` after its latin face.

Vite resolves a bare package specifier inside CSS `url()`, so the font rules need no relative
path into `node_modules`.

## Colour

Role tokens: `--surface`, `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`,
`--border`, `--action`, `--action-text`, `--warn`, `--focus-ring`, plus the graph palette
`--graph-{label,document,entity,event,operator,value,edge,path}`. Every token must appear in
a declared contrast pair. `--border` must be at least `#8f8270` to clear 3:1 against
`--surface`.

`tools/contrast.mjs` grades a DECLARED pair table, not the DOM — jsdom has no canvas, so
axe-core reports every `color-contrast` result as `incomplete`. It floors the ratio rather
than rounding, and it fails when a colour token appears in no pair.

The graph canvas draws its own text, so a node label takes NORMAL against its fill while the
fill takes LARGE against the canvas. A pair graded here is only the graph's if the renderer
paints that value — `graph:check`'s `palette` rule is what decides that half
(`.claude/rules/graph.md`).

## Copy

**Every human-facing string lives in `src/i18n/`** — `src/demo/copy.ts` retains invariant data
alone. The locale seam, its consumer pattern and the payload boundary are in
`.claude/rules/i18n.md`.

`tools/copy-check.mjs` is static — there is no TS runner here. It grades `src/i18n/en.ts`
(`INSTRUCTIONS` ≤20 words/sentence, the other three buckets ≤25) and holds `ja.ts` at key
parity. A period between digits is not a sentence boundary, so `License 1.1.` is one sentence;
the sentinel is `U+E000` because a control character trips ESLint `no-control-regex`.

**The six question strings are payload, not copy.** They are generated from the compiled
goals, and rewriting one would make the displayed question differ from the question that runs.
The copy validator does not grade them.

The bag labels all 337 documents `unreviewed`. Upstream counts
`approved`/`rejected`/`contested`/`stale`/`unreviewed`, so the label means **no adjudication
decision was recorded** — never that a check failed. Say so wherever it surfaces.

CDC's four reuse requirements for public-domain content: attribution naming the developing
agency; a nonendorsement disclaimer "prominently and unambiguously displayed"; no change to
substantive content; a statement that the material is free on the agency website. The second
is why attribution and nonendorsement cannot live inside the About disclosure.

## Run lifecycle

- **Run serialization chains on the ENGINE CALL, not on the state write.** A successor that
  awaits its predecessor's settle promise adds a microtask hop a 4-tick test drain misses, and
  the state write is guarded by run identity anyway. `ActiveRun` carries both promises for
  that reason.
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
- Disabling a focused button drops focus to `body`, so whether Cancel held focus must be read
  in `$effect.pre` and acted on in `$effect`.

## Accessibility

- `svelte-check --fail-on-warnings` is the ONLY a11y linter here: `eslint-plugin-svelte` ships
  86 rules and zero `a11y-*` ones.
- The compiler rejects a click handler on `role="listbox"`
  (`a11y_click_events_have_key_events`) because it cannot see that an aria-activedescendant
  widget keeps its keyboard path on the combobox. One scoped `svelte-ignore` carries that;
  delegating the click to the listbox also replaces six per-option handlers with one.
- **The combobox is hand-authored — keep it that way.** A component library was measured
  working and rejected: a required `@internationalized/date` peer, 7 runtime packages, a popup
  portalled outside the app root, and +10 s on the dom project.
- APG's select-only example commits the active option on blur. This widget **cancels**
  instead, matching a native `select`, because a selection starts a Prolog run.
- Svelte 5 `unmount()` returns a promise → `void unmount(app)` in tests.

## Smoke

`pnpm smoke` builds if `dist/` is missing, copies `dist` under a nested path, serves it with a
request log, drives chromiumfish, and compares the rendered canonical text against the answer
read out of the vendored bag **at run time** through `verifyBag`.

- It keys on `[role="option"][id$="-option-<questionId>"]`; option ids are
  `${uid}-option-${questionId}` and render in `QUESTION_IDS` order.
- It must open the canonical-answer disclosure before reading it — a `<details>` body is not
  visible, so a visibility wait times out at 45 s.
- Negative control: removing BOTH `kb/generated/kb.pvm` and `dist/` gives rc 1, thrown by the
  `pnpm build` step. Removing the pvm alone leaves rc 0, because the smoke rebuilds only when
  `dist/` is missing and otherwise serves the stale hashed asset — so that control proves the
  build path, never a `waitForSelector` timeout.
