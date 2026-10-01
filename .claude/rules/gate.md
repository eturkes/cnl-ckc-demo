# Gate

`pnpm gate` = one `&&` chain in `package.json`; every step fails closed:

`audit:check → secret:check → kb:build → kb:asset-check → kb:export-check → engine:check →
copy:check → contrast:check → presentation:check → claims:check → spec:check → format:check →
lint → check → binding:check → build`

`package.json` is authoritative if that list ever diverges from it. The chain's per-run counts
(checked files, tests, modules, copy strings, contrast pairs) move on almost every commit →
**rerun the gate rather than quoting a total**; a durable exact total re-stales itself.

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
  remaining exception is one inline disable carrying its reason, except one per-file CONFIG
  exception: `security/detect-unsafe-regex` is off for `src/questions/advice.ts` in
  `eslint.config.js`, because T9 freezes that file's bytes against `22053ef` and an inline
  disable would change them; the config comment carries the regex's linearity argument.
- `kb:build` subsumes the retired `kb:verify` — it proves the vendored bag against its
  `.sha256` sidecar before parsing, in memory, never extracting.
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
  is what lets one suite carry four distinct claims. `gradeTable` refuses an EMPTY table by
  name, and the control feeds it the real table emptied.
- `engine:check` (`tools/engine-check.mjs`) decides budget-required signatures, `.query`/
  `.ask` call-site arity, exactly one `swipl-wasm` importer (`src/engine/worker.ts` — the
  pattern must admit a BARE side-effect import, which a `from`-anchored one missed), the
  undeclared-API allowlist, and a `terms.ts` export-surface pin.
- `copy:check` (`tools/copy-check.mjs`) runs two graders over `src/i18n/`: English on sentence
  length and banned filler, Japanese on key parity alone. Why the limits do not port, and what
  may stay untranslated, are in `.claude/rules/i18n.md`. A third grades every `.svelte` file it
  finds by walking `src/`: the literal prose a component renders — markup text nodes and
  human-facing attribute values, expressions stripped — at the 25-word limit plus the filler
  sweep, so prose written into a new component instead of the catalog cannot escape it. A
  `WORDMARK` table pins the accepted wordmark: both catalog values, the `<h1>` that renders it
  and the `CNL / CKC` brand mark.
- `claims:check` (`tools/claims-sweep.mjs`) grades COVERAGE of `docs/claims.md`, never truth.
  No tool here can decide whether a sentence is true, so judgment stays in the committed
  registry and the check owns what a tool can decide: it re-derives the claim set from the tree
  — u14's adjudicated shipped rows, `.agent/spec.md` `Artifacts`, `.claude/rules/`,
  `.agent/contracts/m5u*.md` acceptance rows — and refuses a registry that has drifted from it
  by row count, by row anchor, by a row whose `hash` no longer digests its claim, or by leaving
  a row unadjudicated. A claim unit is a bullet with
  its continuations, a table row or a paragraph; raw lines would split one assertion in two.
  Adding a claim to any of those sources therefore reddens the gate until the registry answers
  it, which is the whole point — and editing THIS file is itself such an addition, so the check
  is self-referential by construction. `pnpm claims:seed` re-derives the row set when a source
  moves and carries every adjudicated cell forward, keyed on a digest of the FULL claim text:
  ids and line anchors are re-issued on every run, so an id-keyed merge would hand one claim's
  verdict to its neighbour, and the shown cell stops at 150 characters, so a cell-keyed merge
  kept a verdict across an edit past the cut. Prettier owns `docs/`, so the row block ships under `prettier-ignore` — at a
  150-char claim cell, column padding rewrites every row and `format:check` never agrees with
  the seed again. A `deferred` disposition must cite its queue row as ``(queue row `<title>`)``
  naming a live `.agent/deferred.md` title (m5u15 R2), so pruning a row reddens the gate until
  every registry row citing it is re-adjudicated. It also grades the queue's `## Index` against
  the table `pnpm queue:index` derives from the rows (`tools/queue.mjs`): a `high`/`med` row
  added, re-ranked or pruned without a rewrite fails by its line. A command or disposition cell
  may hold an escaped `\|`; every run re-seeds a copy of the real registry whose first command
  carries one and requires that row back byte-identical.
- `spec:check` (`tools/spec-check.mjs`) grades `.agent/spec.md` `Tasks`: every open unit a
  `- [ ]` row, every ticked row a commit SHA in backticks, the last item pointing at
  `.agent/deferred.md`. Format alone — a shallow CI clone cannot resolve old SHAs. No commit can
  name its own hash, so a unit's closing commit leaves its row `- [ ]` and the next commit ticks
  it with that SHA.
- **The stable censuses the rules state are graded, not trusted.** `tests/census.test.ts` (run by
  `binding:check` with the rest of the suite, after `kb:build`) holds a `CENSUS` table: each row
  anchors one claim unit in `.claude/rules/`, parses each figure out of its text and compares it
  with a value derived from the verified bag, the live image, the twelve live proofs, the intake
  vocabulary or the projected graph model; a mismatch names the rules file and line. A figure
  added to those families belongs in that table. Its control re-grades the real `kb-build.md`
  with one figure altered, and refuses an emptied table.
- `presentation:check` (`tools/presentation-check.mjs`) grades four DECLARED tables against
  source alone — no build, no browser: `@font-face` rows, shipped OFL texts against each
  package `LICENSE`, the selectors rendering engine-authored text, and the three role tokens'
  font stacks family by family (`STACKS`) — plus each Japanese subset's cmap against the code
  points `ja.ts` reaches (`.claude/rules/i18n.md` `Fonts`). Rule bodies match
  brace-free ⇒ only leaf rules match and `@media` never matches alone; CSS comments strip
  first, so a documented rule carries its comment in its selector list.

## Firing inputs

**Every purpose-built check ships the input that makes it fail.** A check that cannot fail and
a clean tree emit the same green, so a step may not report a count until it has proved it can
still refuse one. `tools/control.mjs` is the shared seam: `requireFiring(check, {mutation,
expect}, grade)` runs the check's OWN grader over a deliberately broken copy of its REAL input,
requires the refusal to NAME what was broken, and exits 1 when the broken copy grades clean.
Breaking the real input rather than grading a synthetic fixture is what also catches the check
that silently stopped reading — an empty glob, a renamed region, a declared table that parsed
to nothing. Each step's success line ends with the control that fired, so a green run says so.

**The row a grader change edits in the table below is that change's record of the ORIGINAL
grader's firing.** That is how the approval clause lands here: this repo's graders are the
declared tables, allowlists and pinned surfaces those rows name, so widening an allowlist,
raising a timeout or dropping a declared row belongs in its own approved unit, never as a side
effect of the unit whose grader it loosens.

| step | broken input | how it runs |
|---|---|---|
| `secret:check` | a token-shaped literal planted in a temp dir; the `TREE_TARGETS` list emptied | secretlint spawned on the literal, must exit 1, before the tree pass; the emptied list must exit 1 naming `TREE_TARGETS` — without that guard secretlint exits 2 `Not found target files` and the wrapper mislabels it `secret found in the working tree` |
| `kb:build` | one digit changed in the bag `.sha256` sidecar | `readVerifiedBag(perturb)` re-run in process, before the real verify |
| `kb:asset-check` | seven planted `src/zz-forbidden-reach-control.ts` inputs — an oracle reached by static import, `import()` and `fs` read, an oracle path joined or concatenated from its two bare segments, a serializing call, a copied question sentence | `tests/kb-reach.test.ts` spawns the real checker per form and requires nonzero with the offending path named; `binding:check` names all eight cases, the clean baseline included |
| `kb:asset-check` intake | the REAL derived intake model with section `s2` emptied of documents | `validateIntakeVocabulary` re-run through `requireFiring`, refusing with `section s2 has no documents` and every rule of that section `lies in 0 sections`; a validator that stopped reading sections would pass the emptied model |
| `kb:export-check` | one declared query dropped from the verified bag | `exportedQueries` re-run on the short map, must refuse by name |
| `engine:check` | one perturbed pinned surface per predicate: the budget parameter dropped from `EngineClient.query`, a bare `swipl-wasm` import added outside the worker, a member added to `PrologConstructors`, an export added to `terms.ts` | the command re-runs itself once per row under `ENGINE_CHECK_CONTROL`; the perturbation rides the file reader, so each control drives the whole check and must exit 1 naming its predicate |
| `engine:check` `CONTROLS` | the `CONTROLS` table emptied | its own non-empty grader, in process — emptied, no child control runs at all and the summary would otherwise end `0 controls fired` |
| `kb:asset-check` answer-oracle reach | the real `kb/generated` tree with `question-catalog.json` read as carrying an oracle path | `answerReach` re-run in process over every production root, refusing with `answer-oracle reach in kb/generated/question-catalog.json`; a producer that wrote the path into an asset keeps its digests consistent, so only this scan names it |
| `kb:asset-check` root tables | each of `PRODUCTION_ROOTS`, `SERIALIZE_ROOTS` and `QUESTION_ROOTS` emptied | `gradeRootTable` re-run in process per table, refusing `<TABLE> table is empty` by the table's own name, and a root that walks to no path by entry; the success line names all three controls. A scan control over a table that already failed is skipped, so the table's own refusal is what prints |
| `kb:asset-check` `SCAN_ROOTS` | one declared root replaced by a path that does not exist | each root binds its paths and rejects zero files, so the refusal names `SCAN_ROOTS` and the root; `walk()` returning `[]` used to leave the success line reading `clean over 6 roots` |
| `kb:asset-check` `scopes` | the REAL emitted `scopes` table sliced to zero | `validateSemanticGraphAsset(model)` re-run on the emptied table through `requireFiring`, refusing with `scopes table is empty, so graph scope validation grades no record`; it also refuses an unresolvable `edge.scope` index and an operator edge carrying none |
| `copy:check` | the shipped English graded at limit 0 against a filler list holding `the`; one keyed `DESCRIPTIONS` value given a banned word; a component joining `LABELS.run` + `LABELS.cancel` added to the real set; `en.ts` read as the Japanese catalog; the shell `<title>` prefixed; the `FILLER` table emptied; a component carrying a 30-word sentence added to the real component set; that set emptied; the English wordmark with one letter changed | one per grader, in process, over the real catalogs and components; the keyed mutant must yield EXACTLY one failure, naming its key — a keyed value is blanked before the standalone-literal pass, which used to grade it a second time as `<literal>`; the emptied table must exit 1 naming `FILLER`, because the other controls survive on their own synthetic filler; the planted component must be refused by its path |
| `contrast:check` | `--text` collapsed onto `--surface` | the pair loop re-run on the perturbed token map, must report `1:1` |
| `presentation:check` | one `@font-face` renamed out of `app.css`; each shipped licence compared against the next package's; `overflow-wrap` stripped from every component style; `--font-code`'s generic family dropped from `app.css`; the `STACKS` table emptied; a kanji the subset lacks appended to the `ja.ts` text | one per declared table, in process; the planted kanji must be refused by its code point |
| `binding:check` | a required case no suite defines; a required suite the run never loaded; the `REQUIRED` table emptied; the `LIFECYCLE` table emptied; the `MEANING` table emptied | the inventory loop re-run over the gate's OWN suite report, so none costs a second vitest; the last three feed `gradeTable` the real table emptied, through the same function the real one goes through |
| `claims:check` | the claim set re-derived from ONE rules file, contracts dropped; the first rules claim the cell cuts short, lengthened past the cut; one `deferred` citation stripped; its queue row pruned; a `med` queue row planted with no index rewrite | its own `gradeRegistry` over the real registry, in process; the short set must be refused by row count, because a sweep that silently stopped reading would otherwise agree with any registry it could still match. The lengthened claim must be refused unseeded by its anchor, then come back `unknown` from the seed's own merge — the append the old text-keyed seed carried a verdict across. Then `gradeDeferrals` twice: the first cited `deferred` row with its citation stripped, and the queue with that row's title renamed — each must name the row id. Last, `gradeIndex` over the real queue with a planted `med` row and no rewrite must report the index lacking that row's line |
| `spec:check` | the first open unit written as a plain bullet; the first ticked row stripped of its SHA; the queue pointer dropped from the last item | `gradeTasks` re-run in process over the real spec, each refusal naming its defect |
| `smoke` | the same build served with its hashed `kb-*.pvm` removed; the manifest input digest altered; one served pvm byte flipped | the stripped copy loads in its own page and the lane's boot grader must name `boot-error instead of ready`; the two staleness controls run in process |
| `browser:check` | the same build served with its Japanese `woff2` files renamed; each weight cut again without `AUTOFIT`; a build copy with `sw.js` deleted; the PVM renamed under the old `sw.js` | the lane's face grader (`document.fonts.load` of a Japanese glyph) must report the face never loaded; the parity leg must see the bare cut rasterize differently from the original; the worker-less copy must fail to boot on a severed reload; the cache probe must still find the stale PVM cached |
| `kb:reproduce` | one asset digest changed in the second manifest | the equality seam re-run on the perturbed clone |
| `readme:check` | the real README with `## Run locally` renamed; the reference module count off by one | both graders re-run in process before the clone, the second over the measured counts; end to end, a committed README missing its `pnpm kb:build` line exits 1 at `pnpm build` |
| `graph:check` | one edge's `line-style` set to `dashed` in the mounted graph; `SEPARATION_PX` set to 0 | `dashControl` requires a 0 → 1 → 0 reading off the live renderer; R1 requires the probe-reported cutoff to be exactly 3 px AND a fixed absolute boundary pair where 2 px collapses and 3 px separates — at 0 every coincident midpoint reads distinct, so R1 passed vacuously while the renderer regressed |
| `graph:check` termination | a planted non-terminating page, `tools/graph-probe/hang.html` | `GRAPH_CHECK_CONTROL=non-terminating-page node tools/graph-check.mjs` drives the REAL campaign against that page and must exit 1 naming `control/non-terminating-page` — 10.252 s measured — so a lane that cannot finish is refused BY NAME instead of by wall clock, which is the whole distinction a timeout kill destroys |
| `graph:check` scope readings | one scope element dropped from a rendered label; the scope reordered; the negation dash removed; one scope element dropped from the fallback reading; each of `CANVAS_SCOPE_READINGS`, `FALLBACK_SCOPE_READINGS` and `SPANNING_SCOPE_READINGS` emptied; a spanning reading taken from another edge's row; the reverse spanning row removed | each refusal must NAME the case and the edge — a dropped canvas `may` reads `expected … ordered scope [should, may]`, a removed dash reads `dashed=false` — because a count alone cannot say WHICH reading regressed; each emptied table must refuse by its own table name, since the other controls survive on the two tables they do not empty and a vacuous `0 readings` would otherwise pass |
| `graph:check` component half | the component's selection callback detached; a `graphUrl` the server does not serve; every `--graph-*` token set to `initial` on the mount host | the interaction sweep re-runs under the detached callback and `gradeInteractions` must refuse it by naming C2 and C6; the other two are the product's own failure paths, graded as C9 and C10 |
| `binding:replay` | `pnpm binding:replay HEAD` | both differential arms go green, so the command exits 1 instead of accepting archived-red/current-green |

`audit:check`, `format:check`, `lint`, `check` and `build` are configured third-party
checkers, not purpose-built ones, and are absent from that table by rule rather than by
omission.

Out of the chain — each needs a real browser or two forced builds, and each reruns from
committed state:

| command | what it alone proves |
|---|---|
| `pnpm kb:reproduce` | byte-reproducibility of pvm + qlf + catalog across two forced builds |
| `pnpm engine:probe` | the engine lifecycle in a real browser: R38 cap + deadline end an unbounded goal; R39 a worker stuck in one step ended by the main-thread deadline with the main thread free; R41 five reset cycles each killing a hostile loop, dropping consulted state and booting the manifest's corpus; R42 a failing consult poisons its engine and a reset clears it; R45 the runaway-`assertz` abort, the dead engine and recovery by reset. Control: a cycle without its reset must be refused |
| `pnpm test:browser` | the combobox predicates jsdom can only stub — S1/S7 from Chromium's accessibility tree, K5 on the real clock, K8/K10/P2/P3 under real key and pointer input with focus read after each, B1 through the native `scrollIntoView`, B3 axe with real layout (`tests/question-combobox.browser.test.ts`) |
| `pnpm smoke` | built output answers in a real browser against bag bytes read at run time, and the served saved state is current with the bag's input digest |
| `pnpm readme:check` | the README's `## Run locally` path from a clean clone of HEAD: every non-keyed `sh` line rc 0, both servers answering, the booted preview engine, `kb:build` and the bag manifest agreeing on the document count, and the clone's module count equal to a reference build of the same tree. It refuses a dirty tree, and its one deviation from the README text is a sandbox `--install-directory` on `corepack enable` |
| `pnpm browser:check` | 337 documents on dev + built output, every 320 px interaction state in BOTH locales, that `unicode-range` keeps the Japanese face off an English page, browser cancel delivery, a hostile goal killed by the client deadline with exactly one respawn whose engine reports the manifest's document count, the rendered canonical answer byte-equal to `tools/answer-oracle.mjs` in BOTH locales, each shipped Japanese subset rasterizing the catalog's code points byte-identically to the package face it was cut from, a second visit booting with every request severed, and a renamed PVM leaving no stale copy in any cache once the regenerated `sw.js` activates |
| `pnpm visual-qa` | horizontal fit of every state at 320, 375 and 1280 px — idle, listbox open, every catalog question answered, the first answer with every disclosure open, a cancelled run, the graph and a failed boot — as JSON on stdout plus a PNG per state in `.probe/`; exit 1 names each overflowing state. Control: a box planted wider than the viewport must read as overflow at each width |
| `pnpm graph:check` | the renderer-neutral edge-view contract R1-R7 (`.agent/contracts/m5u8.md`) against the SHIPPED `mountGraphCanvas`, over 14 fixtures x 2 viewports, plus C1-C12 (`m5u10.md`) against the SHIPPED `SemanticGraph.svelte` over 2 devices x 2 views + both fallbacks |
| `pnpm mutate [substring]` | each fixed defect's closing check binds to its fix: every mutant in `tools/mutants.mjs` restores one pre-fix behaviour and its check must go red, after that check passed on the pristine tree; every touched file is restored and proven byte-equal. From a clean checkout: `pnpm install --frozen-lockfile && pnpm kb:build && pnpm mutate`. Run it alone — CPU contention turns a 5000 ms test timeout into a false kill |
| `pnpm binding:replay` | that `clinical-binding` E2 is load-bearing: the same erasure is invisible at `a944fca` and drops exactly one document now |
| `pnpm intake:probe` | live model accuracy on the 30 held-out intake descriptions: re-posts every recorded request, rewrites `tests/intake/replay.json`, re-derives `report.json`. Keyed (`~/.config/typesafe/key`) and billed, so it never runs in a gate; the gate replays the recording (`tests/intake-replay.test.ts`) |
| `pnpm intake:live` | the two-server intake path in a real browser: with `pnpm intake:dev` + `pnpm dev` up, a fixed description must come back `answered` with ≥1 Prolog-derived row, and "Show derivation" must reach the answer region with no page error. Keyed, so outside every gate |

**A server spawned through `pnpm exec` outlives `child.kill()`, and both browser lanes were
bitten by it.** `spawn('pnpm', ['exec', 'vite', ...])` builds a pnpm → vite tree, so signalling
the child reaps the wrapper and orphans vite; the orphan holds the inherited stdout and stderr
pipes open and Node's loop never drains. The lane prints its success line and then hangs
forever — so **a check that prints its success line is not a check that exited.** Two remedies
ship, and either is sound: `graph:check` runs Vite IN PROCESS with teardown awaited (below),
while `browser:check` keeps the child and fixes the signal, `detached: true` plus
`process.kill(-pid, 'SIGTERM')`. Prefer in-process for a new lane; a spawned server must name
its group kill. Untreated, `browser:check` sat at **rc 124 on a 600 s timeout** with a stray dev
server on 5173 and took `pnpm release:check` down with it — the composite had never once run
end to end. Fixed, it is rc 0 in 8 s with no strays.

`tools/answer-oracle.mjs` is the browser lanes' shared expectation — `clinicalArtifacts` answer
terms assembled in JavaScript from the bag, never scraped from the page and never a fixture
the page also loads. Its own credibility is second-hand and stays that way on purpose:
`clinical-differential` D4 grades it against an independent reassembly, `clinical-answer-live`
A2 against the live derivation.

`binding:replay` reads git history, so it needs a full clone; that is why it stays out of
`release:check` and out of CI. It varies the answer-path producer alone — `payloadSource` from
the ref under test, the bag, the image build and the loader from the working tree — and exits
1 unless the archived arm is red and the working arm green. Control: `pnpm binding:replay HEAD`
exits 1, both arms green.

`graph:check` mounts the shipped adapter and reads Cytoscape back off `container._cyreg.cy`;
the contract is renderer-neutral, its probe cannot be. Fixtures are derived, never committed —
cited documents from the bag through `answerDocuments`, sentences and lines from each
provenance chunk. Its summary counts are themselves required non-zero, so a campaign that
graded nothing fails instead of reporting green. Screenshots for a judgement pass:
`node tools/graph-check.mjs --shots <dir> --report <file>`; the report is
`{readings, components, fallbacks}`.

It drives TWO pages off one dev server. `tools/graph-probe/index.html` mounts the ADAPTER, and
sizes the viewport to the measured `.graph-shell .canvas` box. `app.html` mounts the whole
`SemanticGraph.svelte`, and sizes the viewport to the DEVICE, because the component computes
its own box from the page container copied there out of `src/App.svelte`. The component half is
the only grader of the seam between component state and rendered output:
`tests/semantic-graph.dom.test.ts` mocks `canvas.js` away, so a stub there cannot say whether
the path the panel lists is the path the canvas highlights. Runes live in `app.svelte.ts`
because C9 has to change `graphUrl` between a failed load and the retry click.

**A synthetic tap must be dispatched on a DESCENDANT of the canvas host, at a point inside the
layout viewport.** Cytoscape's `eventInContainer` discards any event whose `target` is the
container itself, and any whose client point falls outside the container rect — so the probe
scrolls the canvas into view, resolves the layer with `elementFromPoint`, and pans the victim
node under that point first. Pointer events reach nothing; `mousedown` + `mouseup` are the
pair that fires `tap`.

**The campaign owns a named budget and terminates on its own.** It formerly printed both
summaries and then hung forever, which made `release:check` unrunnable unattended and made a
finished campaign indistinguishable from a hung browser — the orphaned-Vite cause above. Vite
now runs IN PROCESS with browser and server teardown awaited. The budget is 120000 ms; on expiry the run prints
`graph-check: campaign exceeded 120000 ms during <phase>` and takes 2000 ms to clean up, and a
2000 ms unref'd post-summary guard names any residual liveness rather than hanging on it. A
healthy committed-state run is 43.916 s with no outer timeout, so the budget is roughly 3x
headroom, not a tight fit. **Never wrap this command in an outer `timeout` to paper over a
regression** — the budget message names the phase, and a wall-clock kill does not.

`pnpm release:check` = `gate && kb:reproduce && smoke && browser:check && graph:check &&
readme:check && test:browser && engine:probe`.

## CI

- `.github/workflows/ci.yml` — runs `pnpm gate` on every push to `main` and every pull
  request, and publishes nothing: the demo runs locally (user ruling). Scanners ride the gate,
  so CI covers them without a second definition.
- `.github/workflows/security.yml` — the scanners alone, on a daily schedule plus push and
  pull request. The schedule is the point: a new advisory has to redden something on a day
  nobody pushes.
- `.github/dependabot.yml` — weekly npm + github-actions updates. Its `ignore` list mirrors
  every version CAP in `.claude/rules/toolchain.md`; adding a cap there means adding it here,
  or Dependabot reopens the PR that breaks the gate every week. The exact pin stays
  unignored on purpose: Dependabot opens the `swipl-wasm` PR, and the gate plus the
  undeclared-API re-verification decide it.

**Never run MAIN's decisive `pnpm gate` while teammates run suites.** Three trees testing at
once starve the CPU into spurious `Test timed out in 5000ms` failures — `kb-reach`, which
spawns `kb:asset-check` subprocesses, and `demo-controller.dom`'s axe sweep. Nothing is
wrong with the tree. The decisive rerun follows `TaskStop`.

A gate backing a durable claim must rerun from committed state. A scratch-local validator is
a temporary encoding → record its regeneration path beside the gate invocation here, and
schedule the port as a `.agent/deferred.md` row.
