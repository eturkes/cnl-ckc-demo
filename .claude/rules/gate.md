# Gate

`pnpm gate` = `tools/gate.mjs` over `package.json` `gate:chain`, one `&&` chain run step by step;
every step fails closed:

`audit:check → secret:check → kb:build → kb:asset-check → kb:export-check → engine:check →
copy:check → contrast:check → palette:check → presentation:check → claims:check → spec:check →
spec:lint → shell:check → format:check → lint → check → binding:check → build`

`gate:chain` is authoritative if that list ever diverges from it; `tests/inventory.test.ts`
rosters the steps from the same text, and the runner refuses a segment other than
`pnpm <declared script>`. The runner prints each step's wall-clock, `binding:check` its 10
slowest cases, and the first red step ends the run with that step's status, naming the steps it
left unrun. `pnpm gate:chain` runs the chain untimed. The chain's per-run counts
(checked files, tests, modules, copy strings, contrast pairs) move on almost every commit →
**rerun the gate rather than quoting a total**; a durable exact total re-stales itself.

**Fast gate = `pnpm gate:fast`, for iteration**: `kb:build`, then every other step at once —
`lint` and `format:check` on content-keyed caches under `.vite/`, `audit:check` only when
`package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml` changed — then `vitest run --changed`
alone in place of `binding:check`, every red step reported. Its reach ends at vitest's module
graph and ESLint's per-file cache: a suite reading a changed file through `fs` (rules, contracts,
`kb/generated`) and a type-aware finding that moves with an imported file wait for
`pnpm gate`, which alone decides a commit.

**`pnpm gate` green is not `release:check` green.** A report of a gate-only run names
`kb:reproduce`, `smoke`, `browser:check`, `graph:check`, `readme:check`, `test:browser` and
`engine:probe` as not-run, by name — the seven `release:check` adds — and `binding:replay`, which is out of both. A step that a diff cannot
reach is still reported that way (`a0d43e2` names `pnpm gate` itself not-run, with the reason
each step misses the edited files). `none` is the sentinel when nothing was skipped, which is
what keeps an omitted category distinguishable from an empty one.

Step semantics a reader cannot get from the script name:

- `audit:check` = `pnpm audit --audit-level=moderate`, live against the registry advisory
  feed. **User ruling: no allowlist.** An advisory published against an unchanged tree
  reddens the gate, and the fix is the upgrade or an explicit user ruling — never a
  suppression file. It needs network; that is the accepted cost of a live feed.
- `secret:check` (`tools/secret-check.mjs`) runs secretlint twice: the planted control below,
  then the tree, which must exit 0. The control literal is assembled from fragments so it
  cannot match itself in the tree pass.
- `lint` carries the static-analysis layer and runs at `--max-warnings=0`, so a security
  finding fails the gate rather than scrolling past. ESLint is the only analyzer in the stack
  that parses `.svelte`, which is why the sink rules live there rather than in a separate
  SAST step: `svelte/no-at-html-tags`, `no-unsanitized/*`, `eslint-plugin-security`.
  `security/detect-object-injection` is off project-wide (150 findings, all typed lookups it
  cannot see the index signature for); the fs/regexp/require path rules are off for
  `tools/**` and `tests/**`, which take no untrusted input, and stay on for `src/**`. Every
  remaining exception is one inline disable stating its reason after `--`, which
  `@eslint-community/eslint-comments/require-description` enforces (its firing input:
  `tests/lint-directives.test.ts` lints a bare disable through the real config), except one
  per-file CONFIG exception: `security/detect-unsafe-regex` is off for `src/questions/advice.ts` in
  `eslint.config.js`, because T9 freezes that file's bytes against `22053ef` and an inline
  disable would change them; the config comment carries the regex's linearity argument.
- `kb:build` proves the vendored bag against its `.sha256` sidecar before parsing, in memory,
  never extracting.
- `kb:export-check` (`tools/kb/export-check.mjs`) is the legacy export lane's `EXPORTED`
  preflight: it refuses a bag whose exported query set drifted, early and without booting
  anything. Its byte oracle is graded by `binding:check`. Design → `.claude/rules/kb-build.md`.
- `binding:check` (`tools/binding-check.mjs`) **replaces `pnpm test` in the chain.** It runs
  the whole suite once, then requires every case in its DECLARED inventory to have PASSED in
  that same run — a rename, a deletion or an `it.skip` fails the gate, which is what turns a
  binding check from present into required. Grading a separate run would execute every live
  suite twice and grade a run the gate did not use; grading an earlier report raises a
  staleness question no cheap check settles. `pnpm test` stays for development.
  It holds **three** declared tables, graded by one inventory loop: `REQUIRED` = the
  answer-path roll call, each row naming the part of the non-negotiable it holds up,
  `LIFECYCLE` = claims the VIEW makes on its own, currently that a run reaches a terminal
  state and says so, and `MEANING` = the user's graph-polarity ruling, that negation and
  modality ride the EDGES so no projected edge reads as a claim the source denies. User
  ruling: the registers stay apart so neither a lifecycle nor a meaning row dilutes the
  non-negotiable one. `MEANING` declares all nine cases of
  `tests/graph-semantics.review.test.ts` across four `why` rows naming the same suite, which
  is what lets one suite carry four distinct claims, a fifth row holding the four
  `tests/graph-orphan-scopes.test.ts` cases (mnt-d49 O1–O4), and a sixth holding three
  `tests/graph-annotations.test.ts` cases (sync-u2 A1, A2, A4). `gradeTable` refuses an EMPTY table by
  name, and the control feeds it the real table emptied.
- `engine:check` (`tools/engine-check.mjs`) decides budget-required signatures, `.query`/
  `.ask`/`.marks` call-site arity, exactly one `swipl-wasm` importer (`src/engine/worker.ts` — the
  pattern must admit a BARE side-effect import, which a `from`-anchored one missed), the
  undeclared-API allowlist, and a `terms.ts` export-surface pin.
- `copy:check` (`tools/copy-check.mjs`) runs two graders over `src/i18n/`: English on banned
  filler, Japanese on key parity plus the J2–J4 register rules. What may stay untranslated, and
  why sentence length is no check, are in `.claude/rules/i18n.md`. A third walks `src/`
  and refuses any literal a `.svelte` file renders — markup text nodes and human-facing
  attribute values, expressions stripped — bar the brand mark, so prose written into a
  component instead of the catalog cannot ship. A
  `WORDMARK` table pins the accepted wordmark: both catalog values, the `<h1>` that renders it
  and the `CNL / CKC` brand mark. `INTERNAL_ID` refuses any catalog string, in either locale,
  that names a milestone, unit, claim-registry row or review row (`M1`–`M5`, `u12`, `R045`,
  `U7-26`; user ruling). Components render catalog values alone, and `index.html` mirrors
  `DESCRIPTIONS`, so the two catalogs hold every shipped string.
- `palette:check` (`tools/palette-check.mjs`) = `CLAUDE.md` `Execution` palette safety for the
  graph's five node fills `--graph-{document,entity,event,operator,value}`: every pair in both
  themes at OKLab ΔE×100 ≥ 15 plain and ≥ 8 under Machado protan + deutan. The method is
  coloraide's, ported so the gate needs no Python; `tests/palette-check.test.ts` holds the port
  to coloraide's own figures. `contrast:check` keeps each fill's 3:1 against the canvas.
- `claims:check` (`tools/claims-sweep.mjs`) grades COVERAGE of `docs/claims.md`, never truth.
  No tool here can decide whether a sentence is true, so judgment stays in the committed
  registry and the check owns what a tool can decide: it re-derives the claim set from the tree
  — u14's adjudicated shipped rows, `.agent/spec.md` `Artifacts` (each bullet whole, with its
  continuation lines), `.claude/rules/`,
  `.agent/contracts/m5u*.md` acceptance rows — and refuses a registry that has drifted from it
  by row count, by row anchor, by a row whose `hash` no longer digests its claim, or by leaving
  a row unadjudicated. A claim unit is a bullet with
  its continuations, a table row or a paragraph; raw lines would split one assertion in two.
  A rules unit enters only when it states a digit or a `pnpm` command (`claimlike`), a rules
  file's leading frontmatter never enters, and a
  contract unit only as an id-keyed acceptance row, so a plain-language rule stays outside the
  registry. Adding a claim that passes those filters to any of those sources therefore reddens
  the gate until the registry answers it, which is the whole point — and editing THIS file is itself such an addition, so the check
  is self-referential by construction. `pnpm claims:seed` re-derives the row set when a source
  moves and carries every adjudicated cell forward, keyed on a digest of the FULL claim text:
  ids and line anchors are re-issued on every run, so an id-keyed merge would hand one claim's
  verdict to its neighbour, and the shown cell stops at 150 characters, so a cell-keyed merge
  would carry a verdict across an edit past the cut. Prettier owns `docs/`, so the row block ships under `prettier-ignore` — at a
  150-char claim cell, column padding rewrites every row and `format:check` never agrees with
  the seed again. A `deferred` disposition must cite its queue row as ``(queue row `<title>`)``
  naming a live `.agent/deferred.md` title (m5u15 R2), so pruning a row reddens the gate until
  every registry row citing it is re-adjudicated. It also grades the queue's `## Index` against
  the table `pnpm queue:index` derives from the rows (`tools/queue.mjs`): a `high`/`med` row
  added, re-ranked or pruned without a rewrite fails by its line. A command or disposition cell
  may hold an escaped `\|`; every run re-seeds a copy of the real registry whose first command
  carries one and requires that row back byte-identical.
- `spec:check` (`tools/spec-check.mjs`) grades `.agent/spec.md` `Tasks`: every open unit a
  `- [ ]` row, every ticked row `- [x] <sha>`, the last item pointing at
  `.agent/deferred.md`. Format alone — a shallow CI clone cannot resolve old SHAs. No commit can
  name its own hash, so a unit's closing commit leaves its row `- [ ]` and the next commit ticks
  it with that SHA.
- `spec:lint` (`tools/spec-lint.mjs`) runs `.agent/spec-lint`, the template's shape check over the
  whole spec: a template file, copied in whole at each template refresh and never edited here,
  because its cases live with the template. The wrapper owns this repo's controls alone.
- `shell:check` (`tools/shell-check.mjs`) runs ShellCheck over every tracked shell script — a `.sh`
  name or a POSIX-family shebang, found through `git ls-files` so a new script joins unasked. The
  binary is one pinned release fetched by its `.tar.gz` digest into `node_modules/.cache/shellcheck/`,
  so the gate, CI and the pool hosts run the same ShellCheck whatever the host carries; it needs
  network on first use, like `audit:check`. Pin → `.claude/rules/toolchain.md` `Dependency pins`.
- **The stable censuses the rules state are graded, not trusted.** `tests/census.test.ts` (run by
  `binding:check` with the rest of the suite, after `kb:build`) holds a `CENSUS` table: each row
  anchors one claim unit in `.claude/rules/`, parses each figure out of its text and compares it
  with a value derived from the verified bag, the live image, the twelve live proofs or the
  projected graph model; a mismatch names the rules file and line. A figure
  added to those families belongs in that table. Its control re-grades the real `kb-build.md`
  with one figure altered, and refuses an emptied table.
- `presentation:check` (`tools/presentation-check.mjs`) grades four DECLARED tables against
  source alone — no build, no browser: `@font-face` rows, shipped OFL texts against each
  package `LICENSE`, the selectors rendering engine-authored text, and the three role tokens'
  font stacks family by family (`STACKS`) — plus each Japanese subset's cmap against the code
  points `ja.ts` reaches (`.claude/rules/i18n.md` `Fonts`). Rule bodies match
  brace-free ⇒ only leaf rules match and `@media` never matches alone; CSS comments strip
  first, so a documented rule carries its comment in its selector list.

Firing law + the per-step firing-input table → `.claude/rules/firing.md`, loaded on touching a
check's files.

## Lanes

Out of the chain — each needs a real browser or two forced builds, and each reruns from
committed state:

| command | what it alone proves |
|---|---|
| `pnpm kb:reproduce` | byte-reproducibility of pvm + qlf + catalog across two forced builds |
| `pnpm engine:probe` | the engine lifecycle in a real browser: R38 cap + deadline end an unbounded goal; R39 a worker stuck in one step ended by the main-thread deadline with the main thread free; R41 five reset cycles each killing a hostile loop, dropping consulted state and booting the manifest's corpus; R42 a failing consult poisons its engine and a reset clears it; R45 the runaway-`assertz` abort settling `limit` `'heap'` or error `aborted`, and the next query — no reset — answering the manifest's corpus on the recreated worker. Control: a cycle without its reset must be refused; it fires only while a run ends AT its final record (`.claude/rules/engine.md`) |
| `pnpm test:browser [file]` | the combobox predicates jsdom can only stub — S1/S7 from Chromium's accessibility tree, K5 on the real clock, K8/K10/P2/P3 under real key and pointer input with focus read after each, B1 through the native `scrollIntoView`, B3 axe with real layout (`tests/question-combobox.browser.test.ts`); and that axe decides the jsdom contrast pin's unreadable pair a violation here (`tests/axe-contrast.browser.test.ts`), the environment that pin would turn red in |
| `pnpm smoke` | built output answers in a real browser against bag bytes read at run time, the served saved state is current with the bag's input digest, and no request takes the lazy QLF fallback |
| `pnpm readme:check` | the README's `## Run locally` path from a clean clone of HEAD: every non-keyed `sh` line rc 0, both servers answering, the booted preview engine, `kb:build` and the bag manifest agreeing on the document count, and the clone's module count equal to a reference build of the same tree. It refuses a dirty tree and runs the README text verbatim, with the host's pnpm on `PATH` |
| `pnpm browser:check` | the manifest's document count on dev + built output, the built boot's status line changing once per phase — start, `fetch` with the served size, `load`, `verify`, ready — PDF.js unrequested until a page opens, then the drawn page equal to the coverage row's physical page and the marked text holding its passage (both read from the DOM, checked against the asset on disk), the corpus browser's list unrequested until opened, then listing the manifest's document count and opening one document's own passage and page, every 320 px interaction state in BOTH locales, that `unicode-range` keeps the Japanese face off an English page, browser cancel delivery, a hostile goal killed by the client deadline with exactly one respawn whose engine reports the manifest's document count, the rendered canonical answer byte-equal to `tools/answer-oracle.mjs` in BOTH locales, each shipped Japanese subset rasterizing the catalog's code points byte-identically to the package face it was cut from, a second visit booting with every request severed, and a renamed PVM leaving no stale copy in any cache once the regenerated `sw.js` activates, and a truncated saved state booting the QLF fallback to a byte-equal canonical answer |
| `pnpm visual-qa` | horizontal fit of every state at 320, 375 and 1280 px — each phase of a sound boot held, a run held after its second streamed answer, idle, listbox open, every catalog question answered with its facts rows settled, the first answer with every disclosure open, a cancelled run, the graph, the corpus list and one corpus document open, and a failed boot — as JSON on stdout plus a PNG per state in `.probe/`; exit 1 names each overflowing state. Control: a box planted wider than the viewport must read as overflow at each width |
| `pnpm graph:check` | the renderer-neutral edge-view contract R1-R7 (`.agent/contracts/m5u8.md`) against the SHIPPED `mountGraphCanvas`, over 14 fixtures x 2 viewports, plus C1-C12 (`m5u10.md`) against the SHIPPED `SemanticGraph.svelte` over 2 devices x 2 views + both fallbacks |
| `pnpm mutate [substring]` | each fixed defect's closing check binds to its fix, and each inventoried check fires: every mutant in `tools/mutants.mjs` restores one pre-fix behaviour, or (`inv`) plants a wrong implementation or input, and its check must go red, after that check passed on the pristine tree; every touched file is restored and proven byte-equal. Only exit status 1 kills, and from a vitest check only with a failure other than a timeout behind it: a signal, another status, or a vitest check failing by timeout alone (its JUnit report holds `timed out` failures and nothing else) reads `INCONCLUSIVE` and fails the run; control: `tests/spec-check.test.ts` at `--testTimeout=1` must read as timed out alone before any mutant runs. Every anchor is graded inside the gate by `tests/mutant-anchors.test.ts`, so a refactor that moves one reddens the gate, not the next mutate run. From a clean checkout: `pnpm install --frozen-lockfile && pnpm kb:build && pnpm mutate`. Run it alone — CPU contention turns a 5000 ms test timeout into an `INCONCLUSIVE` run |
| `pnpm stryker` | the default-operator credit `CLAUDE.md` `Engineering` grants a base-green suite — by default the legacy export lane's: Stryker mutates the three modules that suite imports and runs it alone per mutant (`STRYKER_SUITE`, `STRYKER_TESTNAME` and `STRYKER_MUTATE` select another suite, one case in it and its modules — ann-u2's Q3 over `src/questions/advice.ts`), then `tools/mutation/survivors.mjs` lists every mutant left alive, splitting Stryker's `Survived` by whether a test ran — a mutant that fails the suite at collection is replayed by hand and never credited. Reported, never graded; the record is `.agent/contracts/mnt5-stryker.md`. Run it alone |
| `pnpm chat:live` | the chat path in a real browser: with `pnpm chat:dev` + `pnpm dev` up and the user's login under `~/.config/cnl-ckc-demo/codex`, one fixed KB question must settle answered with a KB part whose card holds the goal and an engine solution, and no page error (`.agent/contracts/chat-c7.md` L1). Keyed and billed to the user's ChatGPT plan, so outside every gate; its firing input calls no model (table above) |
| `pnpm chat:probe` | live model behaviour on six fixed questions, one JSON report of every part's label, card and source (L2). Reported, never graded: the model has no determinism control; the gate grades the bridge against a scripted fake (`tests/chat-server.test.ts`) and the page against recorded turns |
| `pnpm binding:replay` | that `clinical-binding` E2 is load-bearing: erasing the first clause line a tree's helper cites is invisible at `a944fca` and drops exactly that document now |

**A server spawned through `pnpm exec` outlives `child.kill()`.** `spawn('pnpm', ['exec', 'vite', ...])` builds a pnpm → vite tree, so signalling
the child reaps the wrapper and orphans vite; the orphan holds the inherited stdout and stderr
pipes open and Node's loop never drains. The lane prints its success line and then hangs
forever — so **a check that prints its success line is not a check that exited.** Two remedies
ship, and either is sound: `graph:check` runs Vite IN PROCESS with teardown awaited
(`.claude/rules/graph.md`),
while `browser:check` keeps the child and fixes the signal, `detached: true` plus
`process.kill(-pid, 'SIGTERM')`. Prefer in-process for a new lane; a spawned server must name
its group kill.

`tools/answer-oracle.mjs` is the browser lanes' shared expectation — `clinicalArtifacts` answer
terms assembled in JavaScript from the bag, never scraped from the page and never a fixture
the page also loads. Its own credibility is second-hand and stays that way on purpose:
`clinical-differential` D4 grades it against an independent reassembly, `clinical-answer-live`
A2 against the live derivation.

`binding:replay` reads git history, so it needs a full clone; that is why it stays out of
`release:check` and out of CI. Each arm runs its own tree whole — the bag that tree vendored,
its producer and image build, the first line its own helper cites — because a schema-changing
re-vendor leaves one build machinery unable to read both bags (`a944fca`'s reads
`guideline_document/3`, the 19-indicator bag's `/4`); the swipl-wasm loader is the one shared
piece. It exits 1 unless the archived arm is red and the working arm green. Control: `pnpm
binding:replay HEAD` exits 1, both arms green.

`pnpm release:check` = `gate && kb:reproduce && smoke && browser:check && graph:check &&
readme:check && test:browser && engine:probe`.

## CI

- `.github/workflows/ci.yml` — runs `pnpm gate` on every push to `main` and every pull
  request, and publishes nothing: the demo runs locally (user ruling). Scanners ride the gate,
  so CI covers them without a second definition.
- `.github/workflows/security.yml` — the scanners alone, on a daily schedule plus push and
  pull request. The schedule is the point: a new advisory has to redden something on a day
  nobody pushes.
- `renovate.json` — the user's Mend Renovate GitHub app opens weekly PRs for the npm
  dependencies, the `packageManager` pnpm pin, the `devEngines.runtime` Node pin and the Actions,
  and raises vulnerability alerts from osv.dev. Dependabot never bumps `packageManager`, and its
  alerts miss pnpm 12's two-document lockfile. Its `allowedVersions` rules mirror every version
  CAP in `.claude/rules/toolchain.md`; adding a cap there means adding it here, or Renovate
  reopens the PR that breaks the gate every week. The exact pins stay unrestricted on purpose:
  Renovate opens the `swipl-wasm` and `pdfjs-dist` PRs with their re-verification in the PR
  body, and the gate plus that re-verification decide them. npm updates wait out pnpm's
  `minimumReleaseAge`, which otherwise fails the PR's lockfile update. Validate it with
  `npx --yes --package renovate -- renovate-config-validator --strict` at the repo root, with no
  argument: a path argument grades it as global config.
- **`CLAUDE.md` `Execution` `CI gate` is not in force here**: its precondition, a green `main` CI,
  fails — `Verify` reddens at T9, whose `git show 22053ef` the depth-1 checkout cannot resolve,
  and `Security scan` at `lint`, which runs with no `kb:build` before it, each a
  `.agent/deferred.md` row — and `ci.yml` runs one job, on `main` and pull requests alone. So
  `pnpm gate` runs locally and `ci/*` pushes wait for the fan-out, its own queue row, re-opened
  once both runs are green; that unit records the workflow and its commands here.

**Never run MAIN's decisive `pnpm gate` while teammates run suites.** Three trees testing at
once starve the CPU into spurious `Test timed out in 5000ms` failures — `kb-reach`, which
spawns `kb:asset-check` subprocesses, and `demo-controller.dom`'s axe sweep. Nothing is
wrong with the tree. The decisive rerun follows `TaskStop`.

**The suite's load envelope (user ruling).** 20 consecutive full runs passed 1014/1014 at load
avg 4.6–23.5 on 8 cores (`4dc9179` body); runs at 27–33 timed out 1–20 live tests. That
measured envelope is the accepted bar — ≤ 2.9× cores — and no per-test timeout was raised
for load. A red gate under heavier external load is load, not the tree: rerun it once the load
falls. A slower host's CPU is not load: a case that exceeds vitest's 5000 ms default there from a
1-min load below 2 takes an explicit timeout, approved by the user like any grader change
(`tests/graph-live.test.ts` answer maps, 30 s: red at 5480 / 5962 ms on an i7-8650U).
