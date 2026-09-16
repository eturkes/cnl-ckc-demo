# Gate

`pnpm gate` = one `&&` chain in `package.json`; every step fails closed:

`audit:check → secret:check → kb:build → kb:asset-check → kb:export-check → engine:check →
copy:check → contrast:check → presentation:check → claims:check → format:check → lint → check →
binding:check → build`

`package.json` is authoritative if that list ever diverges from it. The chain's per-run counts
(checked files, tests, modules, copy strings, contrast pairs) move on almost every commit →
**rerun the gate rather than quoting a total**; a durable exact total re-stales itself.

**`pnpm gate` green is not `release:check` green.** A report of a gate-only run names
`kb:reproduce`, `smoke`, `browser:check` and `graph:check` as not-run, by name — the four
`release:check` adds — and `binding:replay`, which is out of both. A step that a diff cannot
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
  remaining exception is one inline disable carrying its reason.
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
  may stay untranslated, are in `.claude/rules/i18n.md`.
- `claims:check` (`tools/claims-sweep.mjs`) grades COVERAGE of `docs/claims.md`, never truth.
  No tool here can decide whether a sentence is true, so judgment stays in the committed
  registry and the check owns what a tool can decide: it re-derives the claim set from the tree
  — u14's adjudicated shipped rows, `.agent/spec.md` `Artifacts`, `.claude/rules/`,
  `.agent/contracts/m5u*.md` acceptance rows — and refuses a registry that has drifted from it
  by row count, by row anchor, or by leaving a row unadjudicated. A claim unit is a bullet with
  its continuations, a table row or a paragraph; raw lines would split one assertion in two.
  Adding a claim to any of those sources therefore reddens the gate until the registry answers
  it, which is the whole point — and editing THIS file is itself such an addition, so the check
  is self-referential by construction. `pnpm claims:seed` re-derives the row set when a source
  moves and carries every adjudicated cell forward, keyed on the claim TEXT: ids and line
  anchors are re-issued on every run, so an id-keyed merge would hand one claim's verdict to
  its neighbour. Prettier owns `docs/`, so the row block ships under `prettier-ignore` — at a
  150-char claim cell, column padding rewrites every row and `format:check` never agrees with
  the seed again.
- `presentation:check` (`tools/presentation-check.mjs`) grades three DECLARED tables against
  source alone — no build, no browser: `@font-face` rows, shipped OFL texts against each
  package `LICENSE`, and the selectors rendering engine-authored text. Rule bodies match
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
| `kb:asset-check` | five planted `src/zz-forbidden-reach-control.ts` inputs — an oracle reached by static import, `import()` and `fs` read, a serializing call, a copied question sentence | `tests/kb-reach.test.ts` spawns the real checker per form and requires nonzero with the offending path named; `binding:check` names all six cases, the clean baseline included |
| `kb:export-check` | one declared query dropped from the verified bag | `exportedQueries` re-run on the short map, must refuse by name |
| `engine:check` | one perturbed pinned surface per predicate: the budget parameter dropped from `EngineClient.query`, a bare `swipl-wasm` import added outside the worker, a member added to `PrologConstructors`, an export added to `terms.ts` | the command re-runs itself once per row under `ENGINE_CHECK_CONTROL`; the perturbation rides the file reader, so each control drives the whole check and must exit 1 naming its predicate |
| `engine:check` `CONTROLS` | the `CONTROLS` table emptied | its own non-empty grader, in process — emptied, no child control runs at all and the summary would otherwise end `0 controls fired` |
| `kb:asset-check` `SCAN_ROOTS` | one declared root replaced by a path that does not exist | each root binds its paths and rejects zero files, so the refusal names `SCAN_ROOTS` and the root; `walk()` returning `[]` used to leave the success line reading `clean over 6 roots` |
| `kb:asset-check` `scopes` | the REAL emitted `scopes` table sliced to zero | `validateSemanticGraphAsset(model)` re-run on the emptied table through `requireFiring`, refusing with `scopes table is empty, so graph scope validation grades no record`; it also refuses an unresolvable `edge.scope` index and an operator edge carrying none |
| `copy:check` | the shipped English graded at limit 0 against a filler list holding `the`; `en.ts` read as the Japanese catalog; the shell `<title>` prefixed; the `FILLER` table emptied | one per grader, in process, over the real catalogs; the emptied table must exit 1 naming `FILLER`, because the other three controls survive on their own synthetic filler |
| `contrast:check` | `--text` collapsed onto `--surface` | the pair loop re-run on the perturbed token map, must report `1:1` |
| `presentation:check` | one `@font-face` renamed out of `app.css`; each shipped licence compared against the next package's; `overflow-wrap` stripped from every component style | one per declared table, in process |
| `binding:check` | a required case no suite defines; a required suite the run never loaded; the `REQUIRED` table emptied; the `LIFECYCLE` table emptied; the `MEANING` table emptied | the inventory loop re-run over the gate's OWN suite report, so none costs a second vitest; the last three feed `gradeTable` the real table emptied, through the same function the real one goes through |
| `claims:check` | the claim set re-derived from ONE rules file, contracts dropped | its own `gradeRegistry` over the real registry, in process; the short set must be refused by row count, because a sweep that silently stopped reading would otherwise agree with any registry it could still match |
| `kb:reproduce` | one asset digest changed in the second manifest | the equality seam re-run on the perturbed clone |
| `graph:check` | one edge's `line-style` set to `dashed` in the mounted graph; `SEPARATION_PX` set to 0 | `dashControl` requires a 0 → 1 → 0 reading off the live renderer; R1 requires the probe-reported cutoff to be exactly 3 px AND a fixed absolute boundary pair where 2 px collapses and 3 px separates — at 0 every coincident midpoint reads distinct, so R1 passed vacuously while the renderer regressed |
| `graph:check` termination | a planted non-terminating page, `tools/graph-probe/hang.html` | `GRAPH_CHECK_CONTROL=non-terminating-page node tools/graph-check.mjs` drives the REAL campaign against that page and must exit 1 naming `control/non-terminating-page` — 10.252 s measured — so a lane that cannot finish is refused BY NAME instead of by wall clock, which is the whole distinction a timeout kill destroys |
| `graph:check` scope readings | one scope element dropped from a rendered label; the scope reordered; the negation dash removed; one scope element dropped from the fallback reading; each of `CANVAS_SCOPE_READINGS`, `FALLBACK_SCOPE_READINGS` and `SPANNING_SCOPE_READINGS` emptied | each refusal must NAME the case and the edge — a dropped canvas `may` reads `expected … ordered scope [should, may]`, a removed dash reads `dashed=false` — because a count alone cannot say WHICH reading regressed; each emptied table must refuse by its own table name, since the other controls survive on the two tables they do not empty and a vacuous `0 readings` would otherwise pass |
| `graph:check` component half | the component's selection callback detached; a `graphUrl` the server does not serve; every `--graph-*` token set to `initial` on the mount host | the interaction sweep re-runs under the detached callback and `gradeInteractions` must refuse it by naming C2 and C6; the other two are the product's own failure paths, graded as C9 and C10 |
| `binding:replay` | `pnpm binding:replay HEAD` | both differential arms go green, so the command exits 1 instead of accepting archived-red/current-green |

`audit:check`, `format:check`, `lint`, `check` and `build` are configured third-party
checkers, not purpose-built ones, and are absent from that table by rule rather than by
omission. `pnpm smoke` and `pnpm browser:check` are the two open rows —
`.agent/deferred.md` carries them as one row with its acceptance check.

Out of the chain — each needs a real browser or two forced builds, and each reruns from
committed state:

| command | what it alone proves |
|---|---|
| `pnpm kb:reproduce` | byte-reproducibility of pvm + qlf + catalog across two forced builds |
| `pnpm smoke` | built output answers in a real browser against bag bytes read at run time |
| `pnpm browser:check` | 337 documents on dev + built output, every 320 px interaction state incl. Japanese, that `unicode-range` keeps the Japanese face off an English page, browser cancel delivery, and the rendered canonical answer byte-equal to `tools/answer-oracle.mjs` in BOTH locales |
| `pnpm graph:check` | the renderer-neutral edge-view contract R1-R7 (`.agent/contracts/m5u8.md`) against the SHIPPED `mountGraphCanvas`, over 14 fixtures x 2 viewports, plus C1-C12 (`m5u10.md`) against the SHIPPED `SemanticGraph.svelte` over 2 devices x 2 views + both fallbacks |
| `pnpm binding:replay` | that `clinical-binding` E2 is load-bearing: the same erasure is invisible at `a944fca` and drops exactly one document now |

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

`pnpm release:check` = `gate && kb:reproduce && smoke && browser:check && graph:check`.

## CI

- `.github/workflows/pages.yml` — runs `pnpm gate` on every push to `main`, then publishes
  `dist/` to Pages. Scanners ride the gate, so CI covers them without a second definition.
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
