# Claim registry

Every durable claim this repository makes, and the command that re-derives it.

A gate step cannot decide whether a sentence is true — no tool in this stack can. So judgment
lives here, in a committed table, and the mechanical half is `pnpm claims:check`: it re-derives
the claim set from the tree and fails when a claim has no row, a row has no claim, or a row is
still unadjudicated. Truth is the reader's to check; coverage is the check's.

Read a row as a promise plus its receipt. If the `command` column names something, run it: that
command re-derives the claim from committed state. If it says `none`, the `disposition` column
says why, and that is an honest answer rather than a pass.

## How the set is derived

```sh
pnpm claims:check                                    # grade the registry against the tree
pnpm claims:seed                                     # re-derive the row set in place
node tools/claims-sweep.mjs --seed <partition.md>... # re-derive, folding harvested rows in
```

`--seed` re-derives the row set from the tree and carries every adjudicated cell forward. It
keys on the claim TEXT, never on the row id or the line number, because editing any source file
renumbers every row below it and an id-keyed merge would hand one claim's verdict to its
neighbour. A claim whose text is unchanged keeps its ruling; a claim whose text moved, or a
genuinely new one, arrives `unknown` and reddens the gate until someone answers it.

The check reads `.claude/rules/`, so it is self-referential by construction: documenting a
check in project law adds a row to that check's own input. That is the intended behaviour —
new law arrives unadjudicated rather than silently uncovered.

Four sources, in registry order:

| source     | what it covers                                                                                          | unit                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `shipped`  | the surfaces a user reads — `src/i18n/en.ts`, `src/i18n/ja.ts`, `README.md`, `src/questions/service.ts` | one adjudicated row of `.agent/contracts/m5u14.md`, `not a claim` excluded        |
| `spec`     | the run commands `.agent/spec.md` `Artifacts` promises                                                  | one bullet                                                                        |
| `rules`    | project law under `.claude/rules/`                                                                      | one bullet, table row or paragraph carrying a measured number or a `pnpm` command |
| `contract` | what each closed unit promised it had done                                                              | one acceptance row or predicate of `.agent/contracts/m5u*.md`                     |

A claim-bearing unit is a bullet with its continuation lines, a table row, or a paragraph —
never a raw line, which would split one assertion across two rows and count its tail as a new
claim. Prose carrying neither a number nor a command asserts no checkable property and takes no
row.

## Dispositions

| disposition  | meaning                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `true`       | the command runs from committed state and re-derives the claim                                                                             |
| `deferred`   | no committed command re-derives it; the row names the `.agent/deferred.md` row that would                                                  |
| `historical` | a measurement of something not shipped — a rejected alternative, a superseded figure — kept as a decision record, not asserted of the tree |
| `false`      | the tree does not honor it; fix the claim or the tree                                                                                      |

`command` names a command that reruns from committed state, or `none`. A scratch-local
validator, a `wt/` branch suite or an uncommitted path does not satisfy that and takes
`deferred` instead.

Three commands are outside `pnpm gate` and a row resting on one says so, because a gate-green
report never covers them: `pnpm smoke`, `pnpm browser:check`, `pnpm graph:check`. `pnpm
kb:reproduce` and `pnpm binding:replay` are outside it too.

## Rows

<!-- rows -->

<!-- prettier-ignore -->
| id | source | at | claim | command | disposition |
| --- | --- | --- | --- | --- | --- |
| R001 | shipped | `src/i18n/en.ts:4` | u14 A01 | `pnpm copy:check` | true |
| R002 | shipped | `src/i18n/en.ts:6` | u14 A02 | `pnpm copy:check` | true |
| R003 | shipped | `src/i18n/en.ts:9` | u14 A03 | none | deferred — no checker owns catalog-fragment composition |
| R004 | shipped | `src/i18n/en.ts:28` | u14 A04 `graphCompareRun` | `pnpm release:check` | true |
| R005 | shipped | `src/i18n/en.ts:38` | u14 A05 | `pnpm release:check` | true |
| R006 | shipped | `src/i18n/en.ts:44` | u14 A06 | `pnpm release:check` | true |
| R007 | shipped | `src/i18n/en.ts:59` | u14 A07 | `pnpm binding:check` | true |
| R008 | shipped | `src/i18n/en.ts:65` | u14 A08 | `pnpm binding:check` | true |
| R009 | shipped | `src/i18n/en.ts:67` | u14 A09 `sourcePassage` | `pnpm binding:check` | true |
| R010 | shipped | `src/i18n/en.ts:74` | u14 A10 | `pnpm binding:check` | true |
| R011 | shipped | `src/i18n/en.ts:76` | u14 A11 | `pnpm binding:check` | true |
| R012 | shipped | `src/i18n/en.ts:80` | u14 A12 | `pnpm binding:check` | true |
| R013 | shipped | `src/i18n/en.ts:88` | u14 A13 | `pnpm graph:check` | true |
| R014 | shipped | `src/i18n/en.ts:90` | u14 A14 `graphLoadNote` | `pnpm graph:check` | true |
| R015 | shipped | `src/i18n/en.ts:103` | u14 A15 | `pnpm binding:check` | true |
| R016 | shipped | `src/i18n/en.ts:173` | u14 A16 `liveProof` | `pnpm binding:check` | true |
| R017 | shipped | `src/i18n/en.ts:175` | u14 A17 `proofAbsent` | `pnpm binding:check` | true |
| R018 | shipped | `src/i18n/en.ts:234` | u14 A19 | `pnpm binding:check` | true |
| R019 | shipped | `src/i18n/en.ts:238` | u14 A20 `answerYesSummary` | `pnpm binding:check` | true |
| R020 | shipped | `src/i18n/en.ts:280` | u14 A21 `traceFailure` | none | deferred — no test drives the proof-RPC failure copy |
| R021 | shipped | `src/i18n/en.ts:286` | u14 A22 | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R022 | shipped | `src/i18n/en.ts:290` | u14 A23 `proofNegationCount` | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R023 | shipped | `src/i18n/en.ts:292` | u14 A24 `clauseJoin` | `pnpm binding:check` | true |
| R024 | shipped | `src/i18n/en.ts:303` | u14 A25 | `pnpm graph:check` | true |
| R025 | shipped | `src/i18n/en.ts:313` | u14 A26 | `pnpm release:check` | true |
| R026 | shipped | `src/i18n/en.ts:346` | u14 A27 | `pnpm copy:check` | true |
| R027 | shipped | `src/i18n/ja.ts:99` | u14 A28 | `pnpm binding:check` | true |
| R028 | shipped | `src/i18n/ja.ts:159` | u14 A29 `liveProof` | `pnpm binding:check` | true |
| R029 | shipped | `README.md:8` | u14 A30 | `pnpm binding:replay` | true |
| R030 | shipped | `README.md:13` | u14 A31 | `pnpm binding:check` | true |
| R031 | shipped | `README.md:14` | u14 A32 | `pnpm binding:check` | true |
| R032 | shipped | `README.md:15` | u14 A33 | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R033 | shipped | `README.md:22` | u14 A34 | `pnpm graph:check` | true |
| R034 | shipped | `README.md:23` | u14 A35 | `pnpm graph:check` | true |
| R035 | shipped | `README.md:24` | u14 A36 | `pnpm graph:check` | true |
| R036 | shipped | `README.md:65` | u14 A38 | `pnpm graph:check` | true |
| R037 | shipped | `README.md:86` | u14 A39 | `pnpm release:check` | true |
| R038 | shipped | `README.md:93` | u14 A40 | `git check-ignore -q kb/generated` | true |
| R039 | shipped | `README.md:94` | u14 A41 | `pnpm kb:reproduce` | true |
| R040 | shipped | `README.md:110` | u14 A42 | `! /usr/bin/rg -qF 'http-equiv="Content-Security-Policy"' index.html` | true |
| R041 | shipped | `src/questions/service.ts:1` | u14 A43 | `pnpm binding:check` | true |
| R042 | shipped | `src/questions/service.ts:4` | u14 A44 | `pnpm binding:check` | true |
| R043 | shipped | `src/questions/service.ts:5` | u14 A45 | `pnpm binding:check` | true |
| R044 | shipped | `src/questions/service.ts:16` | u14 A46 | `pnpm binding:check` | true |
| R045 | shipped | `src/questions/service.ts:24` | u14 A47 | `pnpm binding:check` | true |
| R046 | spec | `.agent/spec.md Artifacts` | - `src/` + `index.html` — the demo. `pnpm dev`; production `pnpm build && pnpm preview`. | `pnpm browser:check` | true |
| R047 | rules | `.claude/rules/engine.md:15` | - **`JSON.stringify` over an engine value is a measured corruption path**: `'$guideline_id'/5` re-enters as arity 1 with `ref([1])`, and `1r3` seriali | none | deferred — measured probe has no committed rerun |
| R048 | rules | `.claude/rules/engine.md:18` | - Wrapper ABI, undocumented and read off the package: `$t:'s'` string, `'r'` rational, `'v'` variable, `'l'` improper list, `'t'` compound whose args | `npx vitest run tests/engine-session.test.ts` | true |
| R049 | rules | `.claude/rules/engine.md:21` | - Integral floats decode as `integer`: SWI's `1.0` and `1` both arrive as JS `1`. The corpus has no floats. | `npx vitest run tests/engine-session.test.ts` | true |
| R050 | rules | `.claude/rules/engine.md:23` | - Display text = `term_string/3` with `[quoted(true),numbervars(true),ignore_ops(true)]`, which matched `write_canonical` on all 7 real answers at 0.0 | `npx vitest run tests/engine-session.test.ts` | true |
| R051 | rules | `.claude/rules/engine.md:29` | - **A malformed goal yields NO solution rather than raising**, so a zero-answer run and a broken goal are indistinguishable without a parse guard. | `npx vitest run tests/engine-budgets.test.ts` | true |
| R052 | rules | `.claude/rules/engine.md:51` | **`Query.close()` is load-bearing.** Abandoning an iterator on a cap, cancel or deadline leaves the frame open and every later query returns `failure` | none | deferred — Query.close removal was measured only by hand |
| R053 | rules | `.claude/rules/engine.md:57` | - Split enforcement. Prolog owns stack/depth/inference: `stack_limit` reducible 1073741824 → 8388608 B, catchable | `npx vitest run tests/engine-budgets.test.ts` | true |
| R054 | rules | `.claude/rules/engine.md:60` | - **No in-Prolog wall clock.** The build reports `threads=false`; `library(time)` raises `existence_error(source_sink,library(time))`; | none | deferred — runtime-capability probe is not committed |
| R055 | rules | `.claude/rules/engine.md:63` | - Prolog limits do not bound a query: `repeat` under the full wrapper emitted 100000 answers in 452.232 ms with `D=1`, `I=true`. The JS answer cap and | none | deferred — throughput timing has no committed benchmark |
| R056 | rules | `.claude/rules/engine.md:70` | - Engine ceilings: unified stack limit 1 GiB (reducible), Emscripten heap ceiling 2 GiB, RSS ~119 MB steady. Asserted state persists across queries in | none | deferred — host ceilings and RSS have no committed probe |
| R057 | rules | `.claude/rules/engine.md:75` | - **A worker timer cannot fire inside a synchronous step**: an in-worker 25 ms timer never fired across 249.80 ms of `repeat,fail`, while a main-threa | none | deferred — timer-starvation measurement has no committed probe |
| R058 | rules | `.claude/rules/engine.md:78` | - `solve` yields a MACROTASK between solutions; a microtask yield admits no posted message and cannot deliver a cancel. Granularity = 50.11 ms worst s | none | deferred — yield-latency measurement has no committed benchmark |
| R059 | rules | `.claude/rules/engine.md:84` | - Hard cancel: terminate 2.7–3.5 ms; terminate→respawn→boot 181.75–223.96 ms **in Node**. In a real browser the same cycle costs 526.4–1732.5 ms, medi | none | deferred — Node/browser restart timings have no committed benchmark |
| R060 | rules | `.claude/rules/engine.md:88` | - **Heap exhaustion diverges by host.** In Node it returns a typed `assertz/1: Not enough resources: no_memory`, no throw, no abort, ~2222464 KiB peak | none | deferred — host-divergence measurement has no committed probe |
| R061 | rules | `.claude/rules/engine.md:103` | The main chunk carries 0 engine bytes; the worker chunk plus a hashed `kb-<hash>.pvm` carry it. No COOP/COEP is needed, but `loadImageDefault` uses di | none | deferred — bundle-byte and header inspection has no committed grader |
| R062 | rules | `.claude/rules/gate.md:3` | `pnpm gate` = one `&&` chain in `package.json`; every step fails closed: | `pnpm gate` | true |
| R063 | rules | `.claude/rules/gate.md:13` | **`pnpm gate` green is not `release:check` green.** A report of a gate-only run names `kb:reproduce`, `smoke`, `browser:check` and `graph:check` as no | `node -p "require('./package.json').scripts['release:check']"` | true |
| R064 | rules | `.claude/rules/gate.md:22` | - `audit:check` = `pnpm audit --audit-level=moderate`, live against the registry advisory feed. **User ruling: no allowlist.** An advisory published a | `pnpm audit:check` | true |
| R065 | rules | `.claude/rules/gate.md:26` | - `secret:check` (`tools/secret-check.mjs`) runs secretlint twice: the planted control below, then the tree, which must exit 0. The control literal is | `pnpm secret:check` | true |
| R066 | rules | `.claude/rules/gate.md:29` | - `lint` carries the static-analysis layer and runs at `--max-warnings=0`, so a security finding fails the gate rather than scrolling past. ESLint is | `pnpm lint` | true |
| R067 | rules | `.claude/rules/gate.md:37` | - `kb:build` subsumes the retired `kb:verify` — it proves the vendored bag against its `.sha256` sidecar before parsing, in memory, never extracting. | `pnpm kb:build` | true |
| R068 | rules | `.claude/rules/gate.md:42` | - `binding:check` (`tools/binding-check.mjs`) **replaces `pnpm test` in the chain.** It runs the whole suite once, then requires every case in its DEC | `pnpm binding:check` | true |
| R069 | rules | `.claude/rules/gate.md:62` | - `copy:check` (`tools/copy-check.mjs`) runs two graders over `src/i18n/`: English on sentence length and banned filler, Japanese on key parity alone. | `pnpm copy:check` | true |
| R070 | rules | `.claude/rules/gate.md:65` | - `claims:check` (`tools/claims-sweep.mjs`) grades COVERAGE of `docs/claims.md`, never truth. No tool here can decide whether a sentence is true, so j | `pnpm claims:check` | true |
| R071 | rules | `.claude/rules/gate.md:88` | **Every purpose-built check ships the input that makes it fail.** A check that cannot fail and a clean tree emit the same green, so a step may not rep | `pnpm release:check && ! pnpm binding:replay HEAD` | true |
| R072 | rules | `.claude/rules/gate.md:105` | \| `secret:check` \| a token-shaped literal planted in a temp dir; the `TREE_TARGETS` list emptied \| secretlint spawned on the literal, must exit 1, | `pnpm secret:check` | true |
| R073 | rules | `.claude/rules/gate.md:106` | \| `kb:build` \| one digit changed in the bag `.sha256` sidecar \| `readVerifiedBag(perturb)` re-run in process, before the real verify \| | `pnpm kb:build` | true |
| R074 | rules | `.claude/rules/gate.md:109` | \| `engine:check` \| one perturbed pinned surface per predicate: the budget parameter dropped from `EngineClient.query`, a bare `swipl-wasm` import ad | `pnpm engine:check` | true |
| R075 | rules | `.claude/rules/gate.md:110` | \| `engine:check` `CONTROLS` \| the `CONTROLS` table emptied \| its own non-empty grader, in process — emptied, no child control runs at all and the s | `pnpm engine:check` | true |
| R076 | rules | `.claude/rules/gate.md:111` | \| `kb:asset-check` `SCAN_ROOTS` \| one declared root replaced by a path that does not exist \| each root binds its paths and rejects zero files, so t | `pnpm kb:asset-check` | true |
| R077 | rules | `.claude/rules/gate.md:113` | \| `copy:check` \| the shipped English graded at limit 0 against a filler list holding `the`; `en.ts` read as the Japanese catalog; the shell | `pnpm copy:check` | true |
| R078 | rules | `.claude/rules/gate.md:114` | \| `contrast:check` \| `--text` collapsed onto `--surface` \| the pair loop re-run on the perturbed token map, must report `1:1` \| | `pnpm contrast:check` | true |
| R079 | rules | `.claude/rules/gate.md:119` | \| `graph:check` \| one edge's `line-style` set to `dashed` in the mounted graph; `SEPARATION_PX` set to 0 \| `dashControl` requires a 0 → 1 → 0 readi | `pnpm graph:check` | true |
| R080 | rules | `.claude/rules/gate.md:120` | \| `graph:check` termination \| a planted non-terminating page, `tools/graph-probe/hang.html` \| | `pnpm graph:check` | true |
| R081 | rules | `.claude/rules/gate.md:121` | \| `graph:check` scope readings \| one scope element dropped from a rendered label; the scope reordered; the negation dash removed; one scope element | `pnpm graph:check` | true |
| R082 | rules | `.claude/rules/gate.md:122` | \| `graph:check` component half \| the component's selection callback detached; a `graphUrl` the server does not serve; every `--graph-*` token set to | `pnpm graph:check` | true |
| R083 | rules | `.claude/rules/gate.md:123` | \| `binding:replay` \| `pnpm binding:replay HEAD` \| both differential arms go green, so the command exits 1 instead of accepting archived-red/current | `pnpm binding:replay HEAD` | true |
| R084 | rules | `.claude/rules/gate.md:125` | `audit:check`, `format:check`, `lint`, `check` and `build` are configured third-party checkers, not purpose-built ones, and are absent from that table | none | deferred — checker-taxonomy prose has no committed validator |
| R085 | rules | `.claude/rules/gate.md:135` | \| `pnpm kb:reproduce` \| byte-reproducibility of pvm + qlf + catalog across two forced builds \| | `pnpm kb:reproduce` | true |
| R086 | rules | `.claude/rules/gate.md:136` | \| `pnpm smoke` \| built output answers in a real browser against bag bytes read at run time \| | `pnpm smoke` | true |
| R087 | rules | `.claude/rules/gate.md:137` | \| `pnpm browser:check` \| 337 documents on dev + built output, every 320 px interaction state incl. Japanese, that `unicode-range` keeps the Japanese | `pnpm browser:check` | true |
| R088 | rules | `.claude/rules/gate.md:138` | \| `pnpm graph:check` \| the renderer-neutral edge-view contract R1-R7 (`.agent/contracts/m5u8.md`) against the SHIPPED `mountGraphCanvas`, over 14 fi | `pnpm graph:check` | true |
| R089 | rules | `.claude/rules/gate.md:139` | \| `pnpm binding:replay` \| that `clinical-binding` E2 is load-bearing: the same erasure is invisible at `a944fca` and drops exactly one document now | `pnpm binding:replay` | true |
| R090 | rules | `.claude/rules/gate.md:141` | **A server spawned through `pnpm exec` outlives `child.kill()`, and both browser lanes were bitten by it.** `spawn('pnpm', ['exec', 'vite', ...])` bui | `pnpm browser:check` | true |
| R091 | rules | `.claude/rules/gate.md:153` | `tools/answer-oracle.mjs` is the browser lanes' shared expectation — `clinicalArtifacts` answer terms assembled in JavaScript from the bag, never scra | `npx vitest run tests/clinical-differential.test.ts tests/clinical-answer-live.test.ts` | true |
| R092 | rules | `.claude/rules/gate.md:159` | `binding:replay` reads git history, so it needs a full clone; that is why it stays out of `release:check` and out of CI. It varies the answer-path pro | `pnpm binding:replay` | true |
| R093 | rules | `.claude/rules/gate.md:173` | It drives TWO pages off one dev server. `tools/graph-probe/index.html` mounts the ADAPTER, and sizes the viewport to the measured | `pnpm graph:check` | true |
| R094 | rules | `.claude/rules/gate.md:189` | **The campaign owns a named budget and terminates on its own.** It formerly printed both summaries and then hung forever, which made `release:check` u | `pnpm graph:check` | true |
| R095 | rules | `.claude/rules/gate.md:199` | `pnpm release:check` = `gate && kb:reproduce && smoke && browser:check && graph:check`. | `pnpm release:check` | true |
| R096 | rules | `.claude/rules/gate.md:203` | - `.github/workflows/pages.yml` — runs `pnpm gate` on every push to `main`, then publishes `dist/` to Pages. Scanners ride the gate, so CI covers them | `git grep -n -e 'pnpm gate' -e 'deploy-pages' HEAD -- .github/workflows/pages.yml` | true |
| R097 | rules | `.claude/rules/gate.md:214` | **Never run MAIN's decisive `pnpm gate` while teammates run suites.** Three trees testing at once starve the CPU into spurious | none | deferred — contention timing has no committed concurrency probe |
| R098 | rules | `.claude/rules/graph.md:19` | **Cytoscape is isolated behind one adapter.** It appears nowhere outside `src/graph/canvas.ts` — `model.ts`, `SemanticGraph.svelte`, `index.ts` and | `git grep -n -e "from 'cytoscape'" -e "import('cytoscape')" HEAD -- src` | true |
| R099 | rules | `.claude/rules/graph.md:27` | **The stale dependency is the layout engine, not the renderer.** `cytoscape-fcose` 2.2.0 ships no types (hence `src/graph/cytoscape-fcose.d.ts`); | `pnpm check` | true |
| R100 | rules | `.claude/rules/graph.md:31` | **Renderer ruling (user, binding): Cytoscape stays; `vis-network` is rejected.** The u8 spike measured it at half the label size at both viewports, wi | none | historical — rejected-renderer spike records a superseded comparison |
| R101 | rules | `.claude/rules/graph.md:41` | **Measure at the CANVAS box, never the device size.** `.graph-shell .canvas` is **1152×558** inside a 1280×900 viewport and **296×384** inside 320×720 | `pnpm graph:check` | true |
| R102 | rules | `.claude/rules/graph.md:46` | **Fit is clamped to a zoom floor (user, binding), so fit-zoom label size is no longer a layout-selection metric.** Below the floor the graph pans inst | `pnpm graph:check` | true |
| R103 | rules | `.claude/rules/graph.md:53` | **A passing DOM suite proves nothing about rendered labels.** `tests/graph-semantics.review.test.ts` asserts `model.ts` output and | `pnpm graph:check` | true |
| R104 | rules | `.claude/rules/graph.md:60` | **The component's own interactions are graded there too, not in jsdom.** `graph:check`'s `app.html` page mounts `SemanticGraph.svelte` whole and reads | `pnpm graph:check` | true |
| R105 | rules | `.claude/rules/graph.md:70` | - **One layout for every view: fcose with the answer's subject pinned at the origin.** The `concentric` branch that used to run whenever a proof highl | `pnpm graph:check` | true |
| R106 | rules | `.claude/rules/graph.md:80` | - **A node label carries a 2 px outline in the node's own colour.** The overflow is otherwise near-white text on a near-white canvas: | `/usr/bin/rg -n -e text-outline-width -e text-outline-color src/graph/canvas.ts` | true |
| R107 | rules | `.claude/rules/graph.md:84` | - **`autounselectify: true`.** Cytoscape's built-in stylesheet paints anything `:selected` `#0169D9`, so a tap repainted a plain edge in the proof hig | `/usr/bin/rg -n 'autounselectify: true' src/graph/canvas.ts` | true |
| R108 | rules | `.claude/rules/graph.md:87` | - **The canvas resolves every colour from an `src/app.css` token** (`--graph-*`, plus `--action` for the selected node and `--surface-sunken`/ | `pnpm graph:check` | true |
| R109 | rules | `.claude/rules/graph.md:100` | - Base edges are **opaque**: `--graph-edge` clears 3:1 against the canvas as a colour, and a faded stroke does not. De-emphasis lives in `.context` al | `pnpm contrast:check` | true |
| R110 | rules | `.claude/rules/graph.md:106` | - The graph carries **0 self-edges of 20,964**, so `canvas.ts` filters none. | `npx vitest run tests/graph-model.test.ts` | true |
| R111 | rules | `.claude/rules/graph.md:110` | - Deterministic full graph = **2,901 typed nodes / 20,964 typed edges**, extracted by static `clause/2` sweep. Runtime predicate calls expose only the | `npx vitest run tests/graph-model.test.ts` | true |
| R112 | rules | `.claude/rules/graph.md:112` | - Explicit edge schemas = 7 (`entity/4`, `cardinality/5`, `event/3`, `arg/4`, `pp/4`, `property/4`, `operator/3`), plus **9,804 `implies` edges**. Tha | `npx vitest run tests/kb-derived-assets.test.ts` | true |
| R113 | rules | `.claude/rules/graph.md:119` | The concept projection still filters `operator` edges and non-`condition supports` `implies` edges, and `operator-context` is still absent from | `npx vitest run tests/graph-model.test.ts` | true |
| R114 | rules | `.claude/rules/graph.md:124` | - Projection = **1,300 nodes / 2,668 grouped edges** out of 2,901 / 20,964. The nodes are 1,084 entity + 151 event + 65 value; the headline counts the | `npx vitest run tests/graph-model.test.ts` | true |
| R115 | rules | `.claude/rules/graph.md:127` | - **1,912 of the 2,668 groups carry an ordered scope**, and **372 of them carry a far scope** (737 edge occurrences). Grouping keys on both sequences | `npx vitest run tests/graph-model.test.ts tests/graph-scope.test.ts` | true |
| R116 | rules | `.claude/rules/graph.md:133` | - u13's `farScopeOperators` is what moved the group count off 2,630 and the scoped count off 1,584: a far end that differs splits what used to be one | none | historical — u13 records the before/after group-count delta |
| R117 | rules | `.claude/rules/graph.md:136` | - Scope-keyed dedup split 2,381 → 2,615 groups; the remaining 15 are the non-unit cardinality edges the projection now admits ( | none | historical — pre-scope counts document a superseded projection |
| R118 | rules | `.claude/rules/graph.md:138` | - Modal census, unchanged by u12: 156 `-` (negation), 857 `should`, 156 `may`, 85 `can`, 9 `must` = **1,263 operator contexts**, of which 71 carry no | `npx vitest run tests/graph-scope.test.ts` | true |
| R119 | rules | `.claude/rules/graph.md:142` | **u13 closed the SHOWN edge.** `EdgeView` (`src/graph/view.ts`) carries `scope`, `farScope` and the composed `label`, and both renderers show them. | `pnpm graph:check` | true |
| R120 | rules | `.claude/rules/graph.md:147` | **A spanning shortcut now shows both ends.** A synthesized `condition supports` edge records the producer's single `edge.scope` for its SOURCE end; th | `pnpm graph:check` | true |
| R121 | rules | `.claude/rules/graph.md:162` | One shared helper composes both surfaces — `scopeReading(scope, farScope, atTarget)` exported from `src/graph/model.ts`, called by | `pnpm graph:check` | true |
| R122 | rules | `.claude/rules/graph.md:171` | Four forms on the resolved pair: `<rel> · <near>`, `<rel>`, `<rel> · <near> → <far>`, `<rel> → <far>`. `→` means one thing everywhere: the end AWAY fr | `pnpm graph:check` | true |
| R123 | rules | `.claude/rules/i18n.md:3` | - "src/i18n/**" | `git grep -nF 'src/i18n/**' HEAD -- .claude/rules/i18n.md` | true |
| R124 | rules | `.claude/rules/i18n.md:20` | - `src/i18n/en.ts` = the KEY SCHEMA. Four buckets: `INSTRUCTIONS` (≤20 words per sentence), `DESCRIPTIONS`, `LABELS`, `TEXT`. It also exports | `pnpm copy:check` | true |
| R125 | rules | `.claude/rules/i18n.md:27` | - `src/i18n/ja.ts` = the same keys in Japanese, です・ます register. Terminology is fixed and reused: 知識ベース, コンパイル済み, 制御自然言語, 証明, 出典 (a citation), 原文 (the | `pnpm copy:check` | true |
| R126 | rules | `.claude/rules/i18n.md:33` | - `src/i18n/locale.svelte.ts` = the `locale` rune plus `messages`, a **getter**. Exporting the resolved bundle would capture it once and freeze the UI | `npx vitest run tests/i18n.dom.test.ts` | true |
| R127 | rules | `.claude/rules/i18n.md:56` | `BIZ UDPGothic` (`@fontsource`, **not** `@fontsource-variable`) ships as two static weights, 400 and 700 — 1,319,288 B + 1,335,452 B, the monolithic | none | deferred — exact font-byte census has no committed size check |
| R128 | rules | `.claude/rules/i18n.md:63` | Rejected: the 30-slice `unicode-range` partition (401 KB for a 160-character vocabulary, 30 `@font-face` rows, and tofu on any glyph outside the pinne | none | historical — rejected font-partition spike is a one-off comparison |
| R129 | rules | `.claude/rules/i18n.md:68` | **Nothing in the header may carry a Japanese glyph.** `LABELS.languageSwitch` is ASCII in BOTH locales — `日本語` would make an English visitor fetch 1.3 | `pnpm browser:check` | true |
| R130 | rules | `.claude/rules/i18n.md:81` | - `presentation:check` `FACES` rows carry a per-row `scope` and a filename `marker`, because the Japanese face is not a `-wght-` variable file. 8 face | `pnpm presentation:check` | true |
| R131 | rules | `.claude/rules/i18n.md:84` | - `tests/i18n.dom.test.ts` reads RENDERED text, never the catalog. A locale seam passes key parity and still ships English; only rendered output decid | `npx vitest run tests/i18n.dom.test.ts` | true |
| R132 | rules | `.claude/rules/kb-build.md:14` | - `kb/cnl-ckc-kb-g<sha>.tar.gz` + a `.sha256` sidecar. BagIt 1.0; verify = `pnpm kb:build`, in memory, never extracting. 1041 payload + 5 tag entries | `pnpm kb:build` | true |
| R133 | rules | `.claude/rules/kb-build.md:16` | - **Archive dialect**: POSIX ustar magic (`ustar\0` + `00`) that ALSO carries five GNU `././@LongLink` (`L`) headers for names over 100 chars. A resol | `npx vitest run tests/kb-bag.test.ts` | true |
| R134 | rules | `.claude/rules/kb-build.md:23` | - Payload = 337 docs × 3 representations — `ace/` (source ACE), `pl/` (compiled Prolog, schema v1), `align/` (source↔ACE alignment, backs the trace vi | `pnpm kb:build` | true |
| R135 | rules | `.claude/rules/kb-build.md:27` | - Rights profile = `redistributable` (public-domain MMWR) → source passages may ship whole in the UI. The bag records `swipl 9.2.9` as its compiler; t | `pnpm kb:build` | true |
| R136 | rules | `.claude/rules/kb-build.md:29` | - Regenerate: `python3 -P tools/dist.py build <outdir>` run in `../cnl-ckc`, then copy the tarball + sidecar into `kb/`. Leave that repo clean. | none | deferred — external upstream export recipe has no in-repo rerun |
| R137 | rules | `.claude/rules/kb-build.md:38` | `../cnl-ckc/tools/ui.py` resolves coverage rows to source payloads and renders click/hover -linked source↔ACE span groups; `parse_evidence`, | none | deferred — sibling upstream UI code is outside the committed interface |
| R138 | rules | `.claude/rules/kb-build.md:46` | `pnpm kb:build` → `kb/generated/{kb.pvm,kb.qlf,kb-manifest.json}`, gitignored. Input = the 337 `pl/` payload files, sorted, joined with | `pnpm kb:build` | true |
| R139 | rules | `.claude/rules/kb-build.md:50` | - **Byte-reproducible.** `qsave_program` writes a ZIP whose entry timestamps and whose embedded `state.qlf` source mtime both come from wall-clock rea | `pnpm kb:reproduce` | true |
| R140 | rules | `.claude/rules/kb-build.md:55` | - **Engine split**: building needs `swipl-bundle` (6.2 MB, carries the library); loading a saved state needs `swipl-bundle-no-data` (2.6 MB). The QLF | none | deferred — exact engine-package sizes have no committed budget |
| R141 | rules | `.claude/rules/kb-build.md:68` | - Corpus load, measured: 337-file consult 2806 ms · concatenated source 3299 ms · `load_string` 3578 ms · QLF 213 ms + 724 ms boot · **saved PVM 335 m | none | historical — corpus-load timings are a one-off benchmark |
| R142 | rules | `.claude/rules/kb-build.md:74` | All 9 are multifile and **static** (`dynamic=false`): `schema_version`, `document`, `guideline_entity/4`, `guideline_cardinality/5`, | `npx vitest run tests/clinical-inference.test.ts` | true |
| R143 | rules | `.claude/rules/kb-build.md:80` | Clause counts: version 337, document 337, entity 1834, cardinality 1834, event 1254, arg 2513, pp 1003, property 16, operator 1193. | `npx vitest run tests/kb-live.test.ts` | true |
| R144 | rules | `.claude/rules/kb-build.md:83` | **Counting vocabulary, kept distinct.** Static clause SITES ≠ derivable SOLUTIONS: 1,834 `guideline_entity/4` sites yield 316 derivable entity solutio | `npx vitest run tests/kb-live.test.ts tests/legacy-export-lane.test.ts` | true |
| R145 | rules | `.claude/rules/kb-build.md:91` | - The catalog is **GENERATED, not transcribed**: `tools/kb/catalog.mjs` re-exports `clinicalArtifacts`, so `kb:build` emits | `pnpm kb:asset-check` | true |
| R146 | rules | `.claude/rules/kb-build.md:97` | - The shipped catalog is the **clinical** one. `CLINICAL_QUESTIONS` owns the curated topics and every answer statement and source coordinate is re-rea | `npx vitest run tests/questions-live.test.ts` | true |
| R147 | rules | `.claude/rules/kb-build.md:102` | - `MANIFEST_VERSION` is 5. Bumping it is what stops a cached manifest from lacking a block a new build writes. | `pnpm kb:build` | true |
| R148 | rules | `.claude/rules/kb-build.md:107` | `pnpm kb:export-check` (`tools/kb/export-check.mjs`) proves the compiled KB still answers the upstream export exactly. It is a diagnostic lane, separa | `pnpm kb:export-check` | true |
| R149 | rules | `.claude/rules/kb-build.md:118` | - Goal grammar: `'$guideline_query_projection'(goal(G),answers(As))`, `G` in canonical prefix `','/2` form. `answer(Var,noun(N,countable)\|wh(what))` | `pnpm kb:export-check` | true |
| R150 | rules | `.claude/rules/kb-build.md:121` | - The comparison covers the WHOLE `'$guideline_answers'` envelope, not its solution list alone: `query_sha256` is the sha256 of the query file itself, | `pnpm kb:export-check` | true |
| R151 | rules | `.claude/rules/kb-build.md:125` | - Live yield: category-A 7 solutions, dosage-reduction 2, evidence-type-1 1, recommendation-exists `yes`. | `pnpm kb:export-check` | true |
| R152 | rules | `.claude/rules/kb-build.md:127` | - Sort = SWI standard order over decoded terms, never a byte sort of rendered text. The two diverge on mixed shapes (`10` precedes `'2'` numerically, | `npx vitest run tests/legacy-export-lane.test.ts` | true |
| R153 | rules | `.claude/rules/kb-build.md:131` | - The byte comparison lives in `tests/legacy-export-lane.test.ts` because `kb:asset-check` bans `queries/answers` reach over `tools/` — a comment mere | `pnpm binding:check` | true |
| R154 | rules | `.claude/rules/proof.md:17` | A guideline clause is universally quantified over clinicians — | `npx vitest run tests/clinical-inference.test.ts` | true |
| R155 | rules | `.claude/rules/proof.md:25` | Real inference over the compiled clauses is measured feasible: asserting one hypothetical clinician entity + cardinality makes `should` operators, | `npx vitest run tests/clinical-inference.test.ts` | true |
| R156 | rules | `.claude/rules/proof.md:32` | The loaded `swipl-bundle-no-data` image is CLOSED: `autoload=false`, `unknown=error`, no `library(lists)` — `append/3`, `member/2`, `maplist/2` and | `npx vitest run tests/proof-live.test.ts` | true |
| R157 | rules | `.claude/rules/proof.md:37` | `clause/2` and `clause/3` reach every static schema predicate (`dynamic=no` throughout). Rules dominate: arg 2351/2513, cardinality 1693/1834, entity | `npx vitest run tests/clinical-records.test.ts` | true |
| R158 | rules | `.claude/rules/proof.md:41` | The interpreter compiles INTO the image (+964 B, boot 116.977 ms vs 123.216 ms for boot+consult). Runtime `consult` buys nothing and is fail-open — it | none | historical — compile/consult byte and timing comparison was one-off |
| R159 | rules | `.claude/rules/proof.md:46` | - An unbounded naive meta-interpreter exhausts the 1 GiB stack in ~8.5 s on the corpus's recursive rule-head chains. The shipping design is **depth-ca | none | historical — naive-interpreter exhaustion probe was superseded |
| R160 | rules | `.claude/rules/proof.md:49` | - **Cap 1 is complete for plain queries** — projected-value multisets equal the plain query for all six catalog goals and hold to cap 20. Cap-1 live | `npx vitest run tests/proof-live.test.ts` | true |
| R161 | rules | `.claude/rules/proof.md:52` | - Re-proving the SELECTED solution returns the byte-identical proof from the all-solutions run for all 18 slots; medians 0.097–291.419 ms. MI over ALL | `npx vitest run tests/proof-live.test.ts` | true |
| R162 | rules | `.claude/rules/proof.md:55` | - Selected-proof budget: cap 1, stack 16 MiB, outer depth 100, 100000 inferences, answer cap 1; deterministic maxima 6403 inferences and outer depth ≥ | `npx vitest run tests/clinical-inference.test.ts` | true |
| R163 | rules | `.claude/rules/proof.md:59` | - `resolve/3` whitelists the nine `guideline_*` predicates alone. | `npx vitest run tests/clinical-inference.test.ts` | true |
| R164 | rules | `.claude/rules/proof.md:63` | Identity = `clause/3` reference → `clause_property(Ref, file(…) + line_count(L))`. All 10321 `L` values are unique against the deterministic concatena | none | deferred — full 10,321-clause identity census has no committed grader |
| R165 | rules | `.claude/rules/proof.md:67` | **Rendering `clause/2` output reproduces the committed `clause_sha256` 0/10321 times**: `clause/2` injects `user:` into rule bodies, `fullstop(true)` | none | historical — clause-render hash mismatch was a one-off census |
| R166 | rules | `.claude/rules/proof.md:77` | Emitted beside `clinical_advice/3,4`: `clinical_rule(Doc,S,Rule)` (48, one per selected content sentence), `clinical_premise(Doc,S,N,Literal)` (346), | `npx vitest run tests/clinical-records.test.ts` | true |
| R167 | rules | `.claude/rules/proof.md:82` | - **A build-time GROUND head still drives `clause/3`.** It unifies against the stored head's variables, and `call(Body)` then demands exactly the grou | `npx vitest run tests/clinical-gate-live.test.ts` | true |
| R168 | rules | `.claude/rules/proof.md:88` | - Census: 12 documents, 48 content sentences, **686 sites / 686 unique lines**, 0 multi-antecedent violations, 46/48 antecedents non-`true`, exactly 1 | `npx vitest run tests/clinical-records.test.ts` | true |
| R169 | rules | `.claude/rules/proof.md:90` | - **Exactly 2 gates prove on the bare KB** — the two `true`-antecedent sentences. The other 46 correctly fail until premises apply the universal. | `npx vitest run tests/clinical-inference.test.ts` | true |
| R170 | rules | `.claude/rules/proof.md:92` | - **44 gates resolve natively**; 4 exhaust 200,000 inferences with only their own premises asserted (`rec01:3`, `rec02:3`, `rec02:8`, `rec05:4`) on th | none | historical — native gate-exhaustion census predates the assumption path |
| R171 | rules | `.claude/rules/proof.md:96` | - **An independent site enumerator must close the open sentence at a `% file:` boundary.** Without that reset each document's 2 preamble facts count a | `npx vitest run tests/clinical-differential.test.ts` | true |
| R172 | rules | `.claude/rules/proof.md:99` | - **48 fragments and 38 groups are one dataset at two granularities.** Reassembling the 48 per-sentence `clinical_rule/3` by consequent — conditions c | `npx vitest run tests/clinical-differential.test.ts` | true |
| R173 | rules | `.claude/rules/proof.md:103` | - `clinical.mjs:325` is `groupTerm`, **not** a second byte guard. The single fail-closed rebuild-equality guard is at `:261-266`. | `npx vitest run tests/clinical-records.test.ts` | true |
| R174 | rules | `.claude/rules/proof.md:109` | `derive/5` threads an assumption list through the existing interpreter, with an `assumption(H)` leaf placed **before** the depth cap and before | `npx vitest run tests/clinical-inference.test.ts` | true |
| R175 | rules | `.claude/rules/proof.md:115` | - **`PROOF_SOURCE` is LAST in `payloadSource`** (payload → clinical helper → proof), so no edit to it can move a content-site line or a | `npx vitest run tests/clinical-inference.test.ts` | true |
| R176 | rules | `.claude/rules/proof.md:118` | - **Read cited heads from the STORED gate body, never by calling the gate.** `clinical_use/2` runs `call(Body)`, which demands the very premises the e | `npx vitest run tests/clinical-gate-live.test.ts` | true |
| R177 | rules | `.claude/rules/proof.md:122` | - Measured on the shipped image, reproduced independently with 0 divergences: cap 2 → **48/48 sentences and 12/12 documents**; cap 1 → 47/48, failing | `npx vitest run tests/clinical-inference.test.ts` | true |
| R178 | rules | `.claude/rules/proof.md:128` | - Negative controls: premises-withheld → **0 of 12 documents** (2 of 48 sentences survive — the two `true`-antecedent gates — so **the control's grain | `npx vitest run tests/clinical-inference.test.ts` | true |
| R179 | rules | `.claude/rules/proof.md:134` | `clinical_advice/3` projects `clinical_advice/4`, whose fourth argument is the proof; the interpreter's arm is | `npx vitest run tests/clinical-proof-live.test.ts` | true |
| R180 | rules | `.claude/rules/proof.md:140` | - The arm sits before the depth cap and cuts, so the outer `mi/3` depth of 1 still reaches it; `clinical_depth(2)` governs inside. | `npx vitest run tests/proof-live.test.ts` | true |
| R181 | rules | `.claude/rules/proof.md:142` | - Measured over the shipped image: **686 clause nodes** — exactly the cited-site census, all at top level with their bodies as children — **3,930 assu | `npx vitest run tests/clinical-proof-live.test.ts` | true |
| R182 | rules | `.claude/rules/proof.md:146` | - **A constrained proof goal must bind INSIDE the answer argument** (`clinical_advice('q',_,clinical_answer('doc',_,_))`). A trailing `Answer = …` con | `npx vitest run tests/proof-live.test.ts` | true |
| R183 | rules | `.claude/rules/proof.md:150` | - A wrong answer term yields `failure`, not a proof: the arm cuts, `clinical_advice/4` fails, and no fallback can fabricate one. | `npx vitest run tests/proof-live.test.ts` | true |
| R184 | rules | `.claude/rules/proof.md:163` | **A binding overlay must perturb `guideline_*` and require the line-keyed proof to change too** — an overlay that asserts a `clinical_advice/3` fact m | `npx vitest run tests/clinical-binding.test.ts` | true |
| R185 | rules | `.claude/rules/proof.md:172` | - `assertz((Head) :- Body)` parses as a `:-`/2 term rather than a clause → write `assertz((Head :- Body))`. | none | deferred — malformed assertz form has no committed negative control |
| R186 | rules | `.claude/rules/proof.md:177` | - An `assertz` permission error never reaches JS as `$error` — it prints to real stderr, outside the `printErr` drain, and the call returns normally → | none | deferred — permission-error stderr behavior has no committed probe |
| R187 | rules | `.claude/rules/stack.md:8` | - Frontend = **Svelte 5** runes + **Vite** + TypeScript. Runes carry the demo's real state (selected question, run status, chosen solution, focused tr | `pnpm check` | true |
| R188 | rules | `.claude/rules/stack.md:11` | - Entity graph ≈ 1K nodes = **analysis tier, not scale tier** → layout quality, neighborhood expansion, shortest path and centrality outrank renderer | none | deferred — design priority is not mechanically graded |
| R189 | rules | `.claude/rules/toolchain.md:17` | - `typescript-eslint` stable caps at TypeScript <6.1 → TypeScript stays on 5.x. Installing TS 7 breaks `pnpm lint`. | none | deferred — TypeScript 7 failure mutant is not committed |
| R190 | rules | `.claude/rules/toolchain.md:24` | - jsdom is capped at `^29.1.1`, exact only in the lockfile. jsdom 30 pulls undici 8, which assigns `webidl.util.markAsUncloneable` from | none | deferred — jsdom 30/Node 20 failure mutant is not committed |
| R191 | rules | `.claude/rules/toolchain.md:27` | - `secretlint` and every `@secretlint/*` package are capped at `^12`. Version 13 declares `engines.node >= 22`; this project runs Node 20 (`engines`, | none | deferred — secretlint 13/Node 20 failure mutant is not committed |
| R192 | rules | `.claude/rules/toolchain.md:43` | - Regex capture groups and destructured array elements arrive as `string \| undefined` → prefer `exec(…)?.[1]` with an `undefined` guard over indexing | `pnpm check` | true |
| R193 | rules | `.claude/rules/toolchain.md:48` | - The chromiumfish launcher resolves from the pnpm global store and ships no types, so `tools/browser.mjs` carries one `no-unsafe-assignment` disable. | `pnpm lint` | true |
| R194 | rules | `.claude/rules/ui.md:20` | Self-hosted from `@fontsource-variable/{atkinson-hyperlegible-next,atkinson-hyperlegible-mono, literata}` (OFL 1.1, no Reserved Font Name, zero transi | `pnpm presentation:check` | true |
| R195 | rules | `.claude/rules/ui.md:27` | Japanese adds two static faces from `@fontsource/biz-udpgothic` — sizing, the rejected alternatives and the ASCII-label rule are in | `pnpm presentation:check` | true |
| R196 | rules | `.claude/rules/ui.md:37` | Role tokens: `--surface`, `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`, `--border`, `--action`, `--action-text`, `--warn`, | `pnpm contrast:check` | true |
| R197 | rules | `.claude/rules/ui.md:54` | **Every human-facing string lives in `src/i18n/`** — `src/demo/copy.ts` retains invariant data alone. The locale seam, its consumer pattern and the pa | none | deferred — copy check cannot prove every source string routes through i18n |
| R198 | rules | `.claude/rules/ui.md:58` | `tools/copy-check.mjs` is static — there is no TS runner here. It grades `src/i18n/en.ts` (`INSTRUCTIONS` ≤20 words/sentence, the other three buckets | `pnpm copy:check` | true |
| R199 | rules | `.claude/rules/ui.md:67` | The bag labels all 337 documents `unreviewed`. Upstream counts `approved`/`rejected`/`contested`/`stale`/`unreviewed`, so the label means **no adjudic | `npx vitest run tests/kb-derived-assets.test.ts` | true |
| R200 | rules | `.claude/rules/ui.md:78` | - **Run serialization chains on the ENGINE CALL, not on the state write.** A successor that awaits its predecessor's settle promise adds a microtask h | `npx vitest run tests/demo-lifecycle.test.ts` | true |
| R201 | rules | `.claude/rules/ui.md:91` | - An existence question projects no columns, so `answerRows` returns `[]` for it regardless of solution count. Mapping its 12 solutions would emit 12 | `npx vitest run tests/questions-live.test.ts` | true |
| R202 | rules | `.claude/rules/ui.md:98` | - `svelte-check --fail-on-warnings` is the ONLY a11y linter here: `eslint-plugin-svelte` ships 86 rules and zero `a11y-*` ones. | `pnpm check` | true |
| R203 | rules | `.claude/rules/ui.md:100` | - The compiler rejects a click handler on `role="listbox"` (`a11y_click_events_have_key_events`) because it cannot see that an aria-activedescendant w | none | deferred — rejected click-handler mutant is not committed |
| R204 | rules | `.claude/rules/ui.md:104` | - **The combobox is hand-authored — keep it that way.** A component library was measured working and rejected: a required `@internationalized/date` pe | none | historical — component-library spike records a rejected alternative |
| R205 | rules | `.claude/rules/ui.md:109` | - Svelte 5 `unmount()` returns a promise → `void unmount(app)` in tests. | `pnpm check` | true |
| R206 | rules | `.claude/rules/ui.md:113` | `pnpm smoke` always runs `pnpm build`, copies `dist` under a nested path, serves it with a request log, drives chromiumfish, and compares the rendered | `pnpm smoke` | true |
| R207 | rules | `.claude/rules/ui.md:119` | - It must open the canonical-answer disclosure before reading it — a `<details>` body is not visible, so a visibility wait times out at 45 s. | `pnpm smoke` | true |
| R208 | rules | `.claude/rules/ui.md:121` | - Negative control, run by hand and NOT shipped: removing BOTH `kb/generated/kb.pvm` and `dist/` gives rc 1, thrown by the `pnpm build` step. Removing | none | deferred — negative control was hand-run and not shipped |
| R209 | rules | `.claude/rules/upstream-sync.md:16` | - **The `@.agent/spec.md` import on line 1 is repo-owned.** The template does carry it, but a refresh from an older copy drops it and the attached sta | `git grep -nF '@.agent/spec.md' HEAD -- CLAUDE.md` | true |
| R210 | rules | `.claude/rules/upstream-sync.md:50` | - The `≤ 8 KB` cap on `.agent/spec.md` → the liveness rule above. Byte pressure rewarded compressing prose over deleting dead rows, which is the entro | none | historical — the spec-size cap was retired |
| R211 | rules | `.claude/rules/upstream-sync.md:52` | - The milestone vocabulary (M1-M5, MODE, WORK-UNIT, PLANNING, MILESTONE-REVIEW) → the four phases in `CLAUDE.md` `Session flow`. Archived text still u | none | historical — milestone vocabulary was superseded by phases |
| R212 | rules | `.claude/rules/upstream-sync.md:54` | - The sizing model (`M = 45 + 2·I`, the 1.77 multiplier, the 223K one-window aim) → retired by user ruling. A `/goal` phase runs across compactions, s | none | historical — the sizing model was retired by user ruling |
| R213 | rules | `.claude/rules/waves.md:8` | - `.agent/contracts/` = committed. Anything a later unit dispatches from lands there — acceptance contracts, fixed check sets, verdict tables. The M1 | `git ls-tree -r --name-only HEAD .agent/contracts .agent/archive` | true |
| R214 | rules | `.claude/rules/waves.md:22` | - **`kb/generated` must be a real directory in the worktree, never a symlink.** Vite resolves a symlinked id to its real path and then refuses it for | none | deferred — worktree symlink failure probe is not committed |
| R215 | rules | `.claude/rules/waves.md:35` | - Research probe branches held as evidence, worktrees removed: `wt/res-m1-1` `36cc56f` (swipl-wasm load/worker/terms/trace/perf/test/errors/deploy), | `git show --no-patch 36cc56f 5863141 0a48b79 24d027e ae608ff 490dfcf` | true |
| R216 | rules | `.claude/rules/waves.md:44` | - A probe branch also carries probe code `main` cannot hold. `wt/res-nl-intake`'s four `.mjs` probes fail `pnpm lint` under the typescript-eslint proj | `git archive wt/res-nl-intake probes/nl-intake -o /tmp/p.tar && mkdir -p .agent/_lp && tar -xf /tmp/p.tar -C .agent/_lp && pnpm lint; rc=$?; rm -rf .agent/_lp /tmp/p.tar; test $rc -ne 0` | true |
| R217 | rules | `.claude/rules/waves.md:51` | - **Every commit carries a `dispatch:` trailer in its body**, not units alone — roles + scope ( | `git log --format='%H%x09%(trailers:key=dispatch,valueonly)' 2592828..HEAD` | true |
| R218 | rules | `.claude/rules/waves.md:57` | - **A check ships with its red witness in the unit's acceptance row, cited from the commit body.** The form is already in the tree: | `git grep -n 'RED at base' HEAD -- .agent` | true |
| R219 | rules | `.claude/rules/waves.md:73` | - Lagging teammate → send a **cost** directive at the FIRST flat poll, not a flush directive: cap each finding at ~250 chars, ship no detail sections, | none | historical — cost-directive result is an orchestration experiment |
| R220 | rules | `.claude/rules/waves.md:77` | - **A seeded progress counter must not contain the token it counts.** u15 seeded each partition with a header line quoting its own `grep -c 'unknown'` | none | historical — u15 wave measurement, not a property of the shipped tree |
| R221 | rules | `.claude/rules/waves.md:81` | - **An agent that reads for a whole window and writes nothing is replaced, not steered.** u15's first `map-rules` burned 153K across five flat polls w | none | historical — u15 wave measurement, not a property of the shipped tree |
| R222 | rules | `.claude/rules/waves.md:94` | `.scratch/validate-report.py` grades wave reports: `--units N`, `--verdict`. Rows are `\| id \| finding \| evidence \|`, and `--verdict` folds the ver | none | deferred — validator is gitignored scratch, not a committed command |
| R223 | contract | `.agent/contracts/m5u10.md:39` | \| P1 \| Every canvas colour resolves from an `src/app.css` token \| `graph:check` `palette`, per node kind, edge, path and selection \| pass \| | `pnpm graph:check` | true |
| R224 | contract | `.agent/contracts/m5u10.md:40` | \| P2 \| A theme flip restyles a MOUNTED graph: colours change, the palette stays on-token, no node moves \| `graph:check` `theme`, `themeFlip()` \| p | `pnpm graph:check` | true |
| R225 | contract | `.agent/contracts/m5u10.md:41` | \| P3 \| The legend swatches read the same tokens the canvas paints \| `src/graph/SemanticGraph.svelte` style block \| pass \| | `/usr/bin/rg -n -- '--graph-' src/graph/SemanticGraph.svelte src/graph/canvas.ts` | true |
| R226 | contract | `.agent/contracts/m5u10.md:42` | \| C1 \| The SHIPPED component mounts against the real graph asset and the real renderer \| `window.componentProbe` boots `SemanticGraph.svelte`; | `pnpm graph:check` | true |
| R227 | contract | `.agent/contracts/m5u10.md:43` | \| C2 \| Search: an unmatched query reports no matches, a matched one lists results, and choosing one moves the selection card, emits `onSelect`, and | `pnpm graph:check` | true |
| R228 | contract | `.agent/contracts/m5u10.md:44` | \| C3 \| Path: a path action fills the panel, and the canvas carries EXACTLY the panel's edges as `.path`; Clear empties both \| probe diffs the panel | `pnpm graph:check` | true |
| R229 | contract | `.agent/contracts/m5u10.md:45` | \| C4 \| Expand: the control raises the canvas node count, and goes disabled at the cap \| probe clicks to the cap, reading `cy.nodes().length` each r | `pnpm graph:check` | true |
| R230 | contract | `.agent/contracts/m5u10.md:46` | \| C5 \| Recenter: the control moves the rendered viewport without re-running the layout \| probe reads zoom + model positions before and after \| pas | `pnpm graph:check` | true |
| R231 | contract | `.agent/contracts/m5u10.md:47` | \| C6 \| Canvas tap: a tap on a canvas node moves the component's selection \| probe taps a non-selected node, reads the selection card \| pass \| | `pnpm graph:check` | true |
| R232 | contract | `.agent/contracts/m5u10.md:48` | \| C7 \| Node index: it lists exactly the canvas's nodes, marks the selected one `aria-current`, and selects from it \| probe compares the index to | `pnpm graph:check` | true |
| R233 | contract | `.agent/contracts/m5u10.md:49` | \| C8 \| Every predicate C2-C7 holds with an answer focus applied, where `expand` and `recenter` take their other branch \| the whole sweep runs twice | `pnpm graph:check` | true |
| R234 | contract | `.agent/contracts/m5u10.md:50` | \| C9 \| Fallback — a bad `graphUrl` announces an alert naming the cause, and the retry control reloads to `ready` \| probe mounts on a 404 URL, reads | `pnpm graph:check` | true |
| R235 | contract | `.agent/contracts/m5u10.md:51` | \| C10 \| Fallback — the graph palette set to `initial` before mount leaves `canvasError` naming every missing token, no renderer instance, and the HT | `pnpm graph:check` | true |
| R236 | contract | `.agent/contracts/m5u10.md:52` | \| C11 \| C1-C10 hold at both devices \| the sweep runs at 1280x900 and 320x720 \| pass \| | `pnpm graph:check` | true |
| R237 | contract | `.agent/contracts/m5u10.md:53` | \| C12 \| A campaign that graded nothing fails \| every count in the summary is required non-zero \| pass \| | `pnpm graph:check` | true |
| R238 | contract | `.agent/contracts/m5u10.md:62` | \| C9 \| `graphUrl` pointed at a path the dev server does not serve \| the load path must reach `[role=alert]`; a silent `ready` fails \| | `pnpm graph:check` | true |
| R239 | contract | `.agent/contracts/m5u10.md:63` | \| C10 \| every `--graph-*` token set to `initial` on the mount host \| `mountGraphCanvas` must throw and the component must keep the HTML view \| | `pnpm graph:check` | true |
| R240 | contract | `.agent/contracts/m5u10b.md:31` | - **P1 terminal state.** After a run whose `ask()` rejects, `controller.state.kind` is `'settled'` and `state.result.kind` is `'error'`. The carried | `pnpm binding:check` | true |
| R241 | contract | `.agent/contracts/m5u10b.md:35` | - **P2 no rejection escapes.** The promise returned by `run()` fulfils. A test that awaits it without a `catch` passes, and no `unhandledrejection` is | `pnpm binding:check` | true |
| R242 | contract | `.agent/contracts/m5u10b.md:37` | - **P3 the view is not busy.** The answer region reports `aria-busy="false"`, the Cancel control is disabled, and Retry is present — the same renderin | `pnpm binding:check` | true |
| R243 | contract | `.agent/contracts/m5u10b.md:40` | - **P4 the failure is announced.** The rendered error text is `TEXT.runFailed(code, message)` and the summary is `TEXT.runFailedSummary()`, in an elem | `pnpm binding:check` | true |
| R244 | contract | `.agent/contracts/m5u10b.md:43` | - **P5 no poisoning.** A run started after a rejected run dispatches its own `ask()` and settles on its own result. At base | `pnpm binding:check` | true |
| R245 | contract | `.agent/contracts/m5u10b.md:46` | - **P6 a superseded rejection writes nothing.** When run A is superseded by run B and A's `ask()` then rejects, the state stays B's. The rejection arm | `pnpm binding:check` | true |
| R246 | contract | `.agent/contracts/m5u10b.md:49` | - **P7 cancel after a rejection is inert.** `cancel()` called once the rejected run has settled fulfils and leaves `state.kind === 'settled'` — it nev | `pnpm binding:check` | true |
| R247 | contract | `.agent/contracts/m5u10c.md:25` | - **G1 `binding:check` `REQUIRED`.** Literal `Object.freeze([…])`. Emptied, the inventory grades 0 while the controls still fire and the step prints | `pnpm binding:check` | true |
| R248 | contract | `.agent/contracts/m5u10c.md:29` | - **G2 `engine:check` `CONTROLS`** (`tools/engine-check.mjs:61`). Literal four-object array. Emptied, no child control runs and an otherwise-green sum | `pnpm engine:check` | true |
| R249 | contract | `.agent/contracts/m5u10c.md:32` | - **G3 `copy:check` `FILLER`** (`tools/copy-check.mjs:25`). Literal four-word array, passed only to the REAL English grade. Emptied, the controls surv | `pnpm copy:check` | true |
| R250 | contract | `.agent/contracts/m5u10c.md:36` | - **G4 `secret:check` tree targets** (`tools/secret-check.mjs:54`, inline `['**/*']`). Emptied, secretlint 12.3.1 exits **2** with | `pnpm secret:check` | true |
| R251 | contract | `.agent/contracts/m5u10c.md:41` | - **G5 `kb:asset-check` `SCAN_ROOTS`** (`tools/kb/check.mjs:16`). Point one root at a path that does not exist and `walk()` returns `[]` for it (`:60` | `pnpm kb:asset-check` | true |
| R252 | contract | `.agent/contracts/m5u10c.md:45` | - **C7 `PREPOSITIONS` owner** (`tools/kb/clinical.mjs:102`, a 13-token complement grammar). Read only by `splitComplement` (`:126`, `:133`); drift rep | `npx vitest run tests/clinical-records.test.ts` | true |
| R253 | contract | `.agent/contracts/m5u10c.md:52` | - **C8 `SEPARATION_PX` owner** (`tools/graph-probe/probe.ts:134`, value 3). Sole cutoff in `distinct()` (`:136-143`) for R1 midpoint collisions; the r | `pnpm graph:check` | true |
| R254 | contract | `.agent/contracts/m5u10c.md:79` | \| G1 \| `REQUIRED` \| 1 \| `the REQUIRED table is empty, so it grades no case` \| | `pnpm binding:check` | true |
| R255 | contract | `.agent/contracts/m5u10c.md:80` | \| G2 \| `CONTROLS` \| 1 \| `CONTROLS table is empty, so no engine control can fire` \| | `pnpm engine:check` | true |
| R256 | contract | `.agent/contracts/m5u10c.md:81` | \| G3 \| `FILLER` \| 1 \| `FILLER table is empty, so the English register grades no banned word` \| | `pnpm copy:check` | true |
| R257 | contract | `.agent/contracts/m5u10c.md:82` | \| G4 \| `TREE_TARGETS` \| 1 \| `TREE_TARGETS table is empty, so secretlint has no working-tree target` \| | `pnpm secret:check` | true |
| R258 | contract | `.agent/contracts/m5u10c.md:83` | \| G5 \| `SCAN_ROOTS` \| 1 \| `SCAN_ROOTS entry "zz-missing-scan-root" yielded no paths` \| | `pnpm kb:asset-check` | true |
| R259 | contract | `.agent/contracts/m5u10c.md:84` | \| C7 \| `PREPOSITIONS` \| 1 \| `clinicalGrammar` `aecf97b1fe03` → `4d083a2e3904`, on `with` removed \| | `npx vitest run tests/clinical-records.test.ts` | true |
| R260 | contract | `.agent/contracts/m5u10c.md:85` | \| C8 \| `SEPARATION_PX` \| 1 \| `midpoint separation cutoff is 0 px, expected 3`; boundary `2/2`, expected `1/2` \| | `pnpm graph:check` | true |
| R261 | contract | `.agent/contracts/m5u11.md:78` | - **S2 needs NO new export.** `deriveSemanticGraph(files, parsedClauses = parseClauseSites(files))` references `files` in its DEFAULT PARAMETER ONLY — | `test "$(/usr/bin/rg -c '^export ' tools/kb/graph.mjs)" -eq 4 && npx vitest run tests/graph-scope.test.ts` | true |
| R262 | contract | `.agent/contracts/m5u11.md:83` | - **S7 = `validateSemanticGraphAsset(model)`**, exported from `tools/kb/graph.mjs`, returning `string[]`: empty = clean, and each entry NAMES the offe | `pnpm kb:asset-check` | true |
| R263 | contract | `.agent/contracts/m5u11.md:90` | - **S1 census.** The emitted `scopes` table represents **1,263** operator contexts, of which **156** carry `-` (negation) and **857** carry `should`. | `npx vitest run tests/graph-scope.test.ts` | true |
| R264 | contract | `.agent/contracts/m5u11.md:94` | - **S2 ordered scope.** Every scope record preserves its outer context as an ORDERED sequence, not a set. Two edges whose contexts share members in a | `npx vitest run tests/graph-scope.test.ts` | true |
| R265 | contract | `.agent/contracts/m5u11.md:102` | - **S3 edge linkage — ONE-WAY, user-ruled.** Every operator-bearing edge references exactly one scope record and every `edge.scope` index resolves. An | `npx vitest run tests/graph-scope.test.ts` | true |
| R266 | contract | `.agent/contracts/m5u11.md:116` | - **S4 no new node kind.** `stats.byNodeKind` gains no key. Scope rides the EDGES — user ruling, `.claude/rules/graph.md`: no `operator-context` node | `npx vitest run tests/graph-scope.test.ts` | true |
| R267 | contract | `.agent/contracts/m5u11.md:118` | - **S5 budget.** The emitted asset, compressed by node `zlib.gzipSync` at **default options**, is at most **508,572 B** — today's 325,989 B plus the r | `npx vitest run tests/graph-scope.test.ts` | true |
| R268 | contract | `.agent/contracts/m5u11.md:122` | - **S6 versioned.** `GRAPH_SCHEMA_VERSION` rises 1 → 2 in the producer and the reader together, and a reader pinned to version 1 refuses the new asset | `npx vitest run tests/graph-scope.test.ts` | true |
| R269 | contract | `.agent/contracts/m5u11.md:127` | - **S7 structural validator.** One validator grades the emitted asset's shape — every scope record well-formed, every reference resolvable, every coun | `pnpm kb:asset-check` | true |
| R270 | contract | `.agent/contracts/m5u11.md:173` | \| S1 \| RED \| `semantic graph scopes table is missing` \| | none | historical |
| R271 | contract | `.agent/contracts/m5u11.md:174` | \| S2 \| RED \| `constructed semantic graph scopes table is missing` \| | none | historical |
| R272 | contract | `.agent/contracts/m5u11.md:175` | \| S3 \| RED \| `operator edge edge:25:0 must reference exactly one scope index` \| | none | historical |
| R273 | contract | `.agent/contracts/m5u11.md:176` | \| S4 \| base-GREEN, declared \| `byNodeKind` is already the five existing kinds; the no-new-key bound passes vacuously \| | none | historical |
| R274 | contract | `.agent/contracts/m5u11.md:177` | \| S5 \| base-GREEN, declared \| 325,989 B ≤ 508,572 B before scopes ship \| | none | historical |
| R275 | contract | `.agent/contracts/m5u11.md:178` | \| S6 \| RED \| `semantic graph producer schema 1, expected 2` \| | none | historical |
| R276 | contract | `.agent/contracts/m5u11.md:179` | \| S7 \| RED \| `semantic graph structural validator export is missing` \| | none | historical |
| R277 | contract | `.agent/contracts/m5u12.md:49` | - **P1 parse.** `parseSemanticGraph` accepts the v2 asset's `scopes` table and `parseEdge` preserves `edge.scope`, both validated at the boundary the | `npx vitest run tests/graph-model.test.ts` | true |
| R278 | contract | `.agent/contracts/m5u12.md:53` | - **P2 ordered scope survives projection.** Every projected edge preserves its relation AND its ordered scope. Grouping and dedup key on the scope seq | `npx vitest run tests/graph-model.test.ts` | true |
| R279 | contract | `.agent/contracts/m5u12.md:56` | - **P3 the six in-scope review reds go GREEN.** `tests/graph-semantics.review.test.ts` merges into the primary tree from branch `wt/rev-sem-2` and the | `pnpm binding:check` | true |
| R280 | contract | `.agent/contracts/m5u12.md:58` | - **P4 the two accepted-open reds are measured, then FIXED.** User ruling: u12 closes S9 and S13+ rather than shipping them red or xfailed, because | none | historical |
| R281 | contract | `.agent/contracts/m5u12.md:63` | - **P5 no `operator-context` node in the concept view.** The user ruling holds after the change: scope rides the edges. `CONCEPT_NODE_KINDS` gains no | `npx vitest run tests/graph-model.test.ts` | true |
| R282 | contract | `.agent/contracts/m5u12.md:65` | - **P6 fail-closed at the boundary, not silently in the projection.** Whatever the projection cannot represent is refused where it is read, never drop | `npx vitest run tests/graph-model.test.ts` | true |
| R283 | contract | `.agent/contracts/m5u12.md:68` | - **P7 S9 — the headline counts what it names.** The concept view's headline calls its node total "concepts/actions" while value/attribute nodes sit i | `pnpm binding:check` | true |
| R284 | contract | `.agent/contracts/m5u12.md:75` | - **P8 S13+ — predicate-role validity is refused at the boundary.** `parseEdge` refuses an edge whose source violates its predicate's role rule (an ar | `pnpm binding:check` | true |
| R285 | contract | `.agent/contracts/m5u13.md:140` | - **V1 one seam.** `EdgeView` exists with exactly the declared shape, is produced once, and is what both renderers read. `model.ts` keeps ZERO imports | `pnpm graph:check` | true |
| R286 | contract | `.agent/contracts/m5u13.md:143` | - **V2 the canvas shows scope.** A shown edge label is exactly `relation` + ordered `scope` — never a substring, never reordered (R2) — and `dashed` i | `pnpm graph:check` | true |
| R287 | contract | `.agent/contracts/m5u13.md:146` | - **V3 the fallback shows scope.** The HTML relation view carries the same relation + ordered scope for the same edge, including the reversed reading | `pnpm graph:check` | true |
| R288 | contract | `.agent/contracts/m5u13.md:149` | - **V4 the conjunction is graded WHOLE against the shipped renderer.** `pnpm graph:check` runs R1–R7 over its 14 fixtures × 2 viewports AND C1–C12 ove | `pnpm graph:check` | true |
| R289 | contract | `.agent/contracts/m5u13.md:154` | - **V5 `graph:check` terminates on its own.** The campaign completes both readings and both summaries, then hangs; `test-owners` killed it at 600 s (r | `pnpm graph:check` | true |
| R290 | contract | `.agent/contracts/m5u13.md:161` | - **V6 a spanning edge shows BOTH endpoint scopes. USER-RULED.** Measured independently by `prod-view` and `orc-view`, agreeing: **736 of 751 synthesi | `pnpm graph:check` | true |
| R291 | contract | `.agent/contracts/m5u13.md:179` | - **V7 no silent loss, at the renderer this time.** Whatever a view cannot show is disclosed or refused where it is dropped. u12's P6 bound the model; | `pnpm graph:check` | true |
| R292 | contract | `.agent/contracts/m5u13.md:206` | - **V8 the accepted surfaces are untouched.** The graph's LOOK is open to change by user ruling; answer panel, ladder, combobox, theme, type and copy | `git diff --quiet 3c4c17c..0d5f4c1 -- src/{App.svelte,app.css,demo,provenance,questions}` | true |
| R293 | contract | `.agent/contracts/m5u13.md:273` | - **V2 admitted `label: null`.** `{relation:'condition supports', scope:['should'], label:null}` satisfied "every shown label is exact" while the moda | none | historical |
| R294 | contract | `.agent/contracts/m5u13.md:279` | - **V3 could certify a partial reading.** A model-derived expected value reproduces the model's own defect: `edge:512:12` renders | none | historical |
| R295 | contract | `.agent/contracts/m5u13.md:283` | - **V4 covers 66 of 333 affected spanning groups.** The 12 answer fixtures plus `worst-bounded` reach 66; 267 can regress unread. First uncovered: | none | historical |
| R296 | contract | `.agent/contracts/m5u13.md:289` | - **V6 named no all-asset inventory.** A check covering `edge:512:12` alone satisfied the named witness while 332 other affected groups survived. Rule | none | historical |
| R297 | contract | `.agent/contracts/m5u3.md:44` | \| A1 \| All 12 answers derive: `clinical_advice(Q,S,A)` yields exactly 12 solutions over the shipped image \| live query, node project \| | `pnpm binding:check` | true |
| R298 | contract | `.agent/contracts/m5u3.md:45` | \| A2 \| Every derived `Answer` is byte-identical to u1's `artifacts.answers` oracle, in raw contribution order \| rendered-term compare, 12/12 \| | `pnpm binding:check` | true |
| R299 | contract | `.agent/contracts/m5u3.md:46` | \| A3 \| Every derived `Source` is byte-identical to the retired fact's `SourceId` \| same \| | `pnpm binding:check` | true |
| R300 | contract | `.agent/contracts/m5u3.md:47` | \| A4 \| Zero `clinical_advice/3` **facts** remain in the payload; the only clause is the rule \| helper-source scan \| | `pnpm binding:check` | true |
| R301 | contract | `.agent/contracts/m5u3.md:48` | \| A5 \| `clinical_advice/3` is **static**: `assertz(clinical_advice(…))` raises a permission error \| live `catch/3` inside Prolog \| | `pnpm binding:check` | true |
| R302 | contract | `.agent/contracts/m5u3.md:49` | \| A6 \| All 48 sentences participate — withholding any one document's premises drops exactly that document's answer \| premise-erasure control, 12→11 | `pnpm binding:check` | true |
| R303 | contract | `.agent/contracts/m5u3.md:50` | \| A7 \| Erasing any one of the 686 cited clause lines fails its sentence and therefore its document's answer \| reuses u2's 686-site campaign shape, | `pnpm binding:check` | true |
| R304 | contract | `.agent/contracts/m5u3.md:51` | \| A8 \| The 38 group terms reassemble in Prolog exactly as u1 reassembles them in JS \| differential over 12 documents \| | `npx vitest run tests/clinical-differential.test.ts` | true |
| R305 | contract | `.agent/contracts/m5u3.md:52` | \| A9 \| `pnpm gate` rc 0, and the answer bytes reaching the browser are unchanged \| gate + `serializeAnswer` compare \| | `pnpm release:check` | true |
| R306 | contract | `.agent/contracts/m5u3.md:53` | \| A10 \| An answer is all-or-nothing: a document with any underivable sentence yields NO answer, never a truncated one \| A6's control, which found t | `pnpm binding:check` | true |
| R307 | contract | `.agent/contracts/m5u4.md:65` | \| B1 \| The image emits ZERO `clinical_advice_source/4` clauses and zero `advice_nodes/2` clauses \| helper + proof-source scan \| | `pnpm binding:check` | true |
| R308 | contract | `.agent/contracts/m5u4.md:66` | \| B2 \| Each of the 12 proofs is the concatenation of its document's per-sentence `clinical_derive/4` proofs, in gate order \| live compare against | `pnpm binding:check` | true |
| R309 | contract | `.agent/contracts/m5u4.md:67` | \| B3 \| Every `clause` step names a line that resolves to a real compiled clause whose stored head unifies with the step head \| `clause/3` + | `pnpm binding:check` | true |
| R310 | contract | `.agent/contracts/m5u4.md:68` | \| B4 \| Every `clause` step's line is in its sentence's `clinical_gate/4` line list; the union over a document equals that document's cited-line set | `pnpm binding:check` | true |
| R311 | contract | `.agent/contracts/m5u4.md:69` | \| B5 \| Erasing any cited clause line changes the proof: the document's answer stops deriving \| site-erasure control, sampled over documents \| | `pnpm binding:check` | true |
| R312 | contract | `.agent/contracts/m5u4.md:70` | \| B6 \| Assumption steps carry no line and their heads are exactly the document's `clinical_premise/4` literals \| live compare, 0 extras \| | `npx vitest run tests/clinical-proof-live.test.ts` | true |
| R313 | contract | `.agent/contracts/m5u4.md:71` | \| B7 \| The proof is not fabricated from the answer: constraining `clinical_advice/3` to a WRONG answer term yields no proof \| live negative control | `pnpm binding:check` | true |
| R314 | contract | `.agent/contracts/m5u4.md:72` | \| B8 \| `limit`, `cancelled`, `failure` and `error` stay distinct proof outcomes \| session tests, unchanged surface \| | `pnpm binding:check` | true |
| R315 | contract | `.agent/contracts/m5u4.md:73` | \| B9 \| The whole selected proof runs inside `PROOF_BUDGET_MAX` (1000 ms, 100000 inferences) \| live timing over all 12 \| | `npx vitest run tests/clinical-proof-live.test.ts` | true |
| R316 | contract | `.agent/contracts/m5u4.md:74` | \| B10 \| `pnpm gate` rc 0 \| gate \| | `pnpm gate` | true |
| R317 | contract | `.agent/contracts/m5u5.md:50` | \| C1 \| The rendered premise list is the derivation's DISTINCT assumed literals in first-appearance order, no repeats \| dom test over a fixture carr | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R318 | contract | `.agent/contracts/m5u5.md:51` | \| C2 \| Every premise row shows the hypothetical badge and renders no line text \| dom test, both locales \| | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R319 | contract | `.agent/contracts/m5u5.md:52` | \| C3 \| A negation renders with its own badge, never the premise badge \| dom test \| | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R320 | contract | `.agent/contracts/m5u5.md:53` | \| C4 \| The clause list and the graph-focus line set stay clause-only under a proof carrying all three arms \| dom test asserts the `lines` payload | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R321 | contract | `.agent/contracts/m5u5.md:54` | \| C5 \| `limit`, `cancelled`, `failure`, `error` and `unavailable` still render their own summary and no rungs \| dom test, existing cases \| | `pnpm binding:check` | true |
| R322 | contract | `.agent/contracts/m5u5.md:55` | \| C6 \| The ladder `<ol>` still has the same rungs and the same summary \| dom test counts `<ol> > li` \| | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R323 | contract | `.agent/contracts/m5u5.md:56` | \| C7 \| Both locales render every new string; `copy:check` key parity holds \| `copy:check` + dom test \| | `pnpm gate` | true |
| R324 | contract | `.agent/contracts/m5u5.md:57` | \| C8 \| `presentation:check` grades the ladder's engine-text selectors \| gate step, new rows \| | `pnpm presentation:check` | true |
| R325 | contract | `.agent/contracts/m5u5.md:58` | \| C9 \| axe reports no violation with the proof and premise disclosures open \| dom axe sweep \| | `npx vitest run tests/provenance-ladder.dom.test.ts` | true |
| R326 | contract | `.agent/contracts/m5u5.md:59` | \| C10 \| `pnpm gate` rc 0 \| gate \| | `pnpm gate` | true |
| R327 | contract | `.agent/contracts/m5u6.md:51` | \| D1 \| The lane names exactly 4 exported ids and they equal the bag's `queries/pl/*.pl` set \| preflight, live \| | `pnpm binding:check` | true |
| R328 | contract | `.agent/contracts/m5u6.md:52` | \| D2 \| A bag with a renamed or extra exported query is REFUSED with that id named \| mutant over the in-memory file map \| | `pnpm binding:check` | true |
| R329 | contract | `.agent/contracts/m5u6.md:53` | \| D3 \| Every exported goal's live solutions byte-match `queries/answers/<id>.pl` \| live run, 4/4 \| | `pnpm binding:check` | true |
| R330 | contract | `.agent/contracts/m5u6.md:54` | \| D4 \| The lane is GREEN on the shipped image at base \| gate step \| | `pnpm binding:check` | true |
| R331 | contract | `.agent/contracts/m5u6.md:55` | \| D5 \| The lane goes RED when a payload dependency of an exported goal is removed \| erasure control \| | `pnpm binding:check` | true |
| R332 | contract | `.agent/contracts/m5u6.md:56` | \| D6 \| Deleting the lane, or skipping it, fails `pnpm gate` \| gate-mutant control \| | `pnpm binding:check` | true |
| R333 | contract | `.agent/contracts/m5u6.md:57` | \| D7 \| The lane compiles nothing new into the PVM: the image bytes are unchanged \| `kb:build` output compare \| | none | deferred — pre-lane byte comparison was a one-off hand run |
| R334 | contract | `.agent/contracts/m5u6.md:58` | \| D8 \| `.claude/rules/kb-build.md` `## Question catalog` describes the shipped design \| consistency pass \| | none | deferred — catalog consistency pass lacks a committed semantic validator |
| R335 | contract | `.agent/contracts/m5u6.md:59` | \| D9 \| `pnpm gate` rc 0 \| gate \| | `pnpm gate` | true |
| R336 | contract | `.agent/contracts/m5u7.md:58` | \| E1 \| An additive `guideline_*` overlay supplying a whole new proof changes the live export-lane statement and adds its marker solution \| live ove | `pnpm binding:check` | true |
| R337 | contract | `.agent/contracts/m5u7.md:59` | \| E2 \| Erasing one cited `guideline_*` clause drops exactly that document from the answer set and turns its proof to `failure`; the unmutated sessio | `pnpm binding:check` | true |
| R338 | contract | `.agent/contracts/m5u7.md:60` | \| E3 \| Relocating a cited `guideline_*` clause leaves the answer byte-identical and moves the line-keyed proof \| live relocate, same session \| | `pnpm binding:check` | true |
| R339 | contract | `.agent/contracts/m5u7.md:61` | \| E4 \| Both negative controls hold at their recorded grain \| inventory names `clinical-inference` P5 \| | `pnpm binding:check` | true |
| R340 | contract | `.agent/contracts/m5u7.md:62` | \| E5 \| The 686-site campaign is exhaustive: 686 erasures, 0 survivors \| inventory names `clinical-inference` P4 \| | `pnpm binding:check` | true |
| R341 | contract | `.agent/contracts/m5u7.md:63` | \| E6 \| Every declared required case ran and PASSED in the gate's own suite run \| `binding:check` \| | `pnpm binding:check` | true |
| R342 | contract | `.agent/contracts/m5u7.md:64` | \| E7 \| Deleting a required suite, renaming a required case, or skipping one each fails `pnpm gate` \| three gate-mutant controls \| | `pnpm binding:check` | true |
| R343 | contract | `.agent/contracts/m5u7.md:65` | \| E8 \| Missing image, failed consult and nonterminal solve each have a named required case \| inventory rows, live \| | `pnpm binding:check` | true |
| R344 | contract | `.agent/contracts/m5u7.md:66` | \| E9 \| The browser's rendered canonical answer equals bytes derived independently in Node from the bag \| `browser:check` \| | `pnpm browser:check` | true |
| R345 | contract | `.agent/contracts/m5u7.md:67` | \| E10 \| Each of C2's five retired classes is restored naming its check, or carries a rationale \| disposition table below \| | `pnpm release:check` | true |
| R346 | contract | `.agent/contracts/m5u7.md:68` | \| E11 \| The clinical binding checks are RED at `a944fca` and GREEN at HEAD \| replay in a worktree \| | `pnpm binding:replay` | true |
| R347 | contract | `.agent/contracts/m5u7.md:69` | \| E12 \| `pnpm gate` rc 0 \| gate \| | `pnpm gate` | true |
| R348 | contract | `.agent/contracts/m5u7.md:89` | \| E6 \| `binding:check ok — 29 required binding cases passed across 10 suites` \| | none | historical |
| R349 | contract | `.agent/contracts/m5u7.md:90` | \| E7 \| rc 1 each: required suite deleted (`never ran`), T15 renamed (`names 0 cases`), T2 skipped (`skipped`) \| | none | deferred — three gate mutants were hand-run and restored |
| R350 | contract | `.agent/contracts/m5u7.md:91` | \| E9 \| `browser:check` rc 0 — `when-to-use-opioids` rendered the bag's 2-row 2,899 B canonical answer byte for byte in English and in Japanese, at 3 | `pnpm browser:check` | true |
| R351 | contract | `.agent/contracts/m5u7.md:92` | \| E11 \| `pnpm binding:replay` rc 0 — erasing `cdc2022-opioid-rec01` line 496 leaves all 12 answer documents at `a944fca` and drops exactly that one | `pnpm binding:replay` | true |
| R352 | contract | `.agent/contracts/m5u7.md:93` | \| E12 \| `pnpm gate` rc 0 \| | `pnpm gate` | true |
| R353 | contract | `.agent/contracts/m5u8.md:128` | \| R1 \| Two edges between the same ordered node pair render as distinguishable curves \| probe counts separated pairs; the fixtures above give 9 / 6 | `pnpm graph:check` | true |
| R354 | contract | `.agent/contracts/m5u8.md:129` | \| R2 \| A shown edge label is exactly `relation` + the reader's NEAR end + the reader's FAR end, in that order — never a substring, never reordered, | `pnpm graph:check` | true |
| R355 | contract | `.agent/contracts/m5u8.md:130` | \| R3 \| Selection changes `state` for no edge; the proof highlight is the only writer of `highlight` \| select a node, diff the highlighted-edge set | `pnpm graph:check` | true |
| R356 | contract | `.agent/contracts/m5u8.md:131` | \| R4 \| `dashed` is per-edge and carries scope polarity alone \| set one edge dashed, diff the canvas, restore, compare bytes \| | `pnpm graph:check` | true |
| R357 | contract | `.agent/contracts/m5u8.md:132` | \| R5 \| A node label at the settled zoom is at least the measured floor, on every fixture and viewport \| probe reads `10 × zoom` against the floor | `pnpm graph:check` | true |
| R358 | contract | `.agent/contracts/m5u8.md:133` | \| R6 \| The seam stays `mountGraphCanvas(container, onSelect) → {update, recenter, destroy}` and `model.ts` keeps zero imports \| `rg` census, as in | `pnpm graph:check` | true |
| R359 | contract | `.agent/contracts/m5u8.md:134` | \| R7 \| A node label is fully readable — wrapped, never ellipsis-truncated \| probe asserts no `…` in rendered label text \| | `pnpm graph:check` | true |
| R360 | contract | `.agent/contracts/m5u8.md:140` | \| E1 \| The spike measures all 12 contribution views \| sweep, `n=12` per arm per viewport \| pass \| | none | historical |
| R361 | contract | `.agent/contracts/m5u8.md:141` | \| E2 \| …plus the worst bounded view and an opposite-scope parallel fixture \| `worst-bounded`, `parallel-opposite` rows \| pass \| | none | historical |
| R362 | contract | `.agent/contracts/m5u8.md:142` | \| E3 \| …at both viewports, light and dark \| sweep at 1152×558 + 296×384; shots in both themes \| pass \| | none | historical |
| R363 | contract | `.agent/contracts/m5u8.md:143` | \| E4 \| Capability 1 (parallel separation) carries a measured verdict \| table above \| pass \| | none | historical |
| R364 | contract | `.agent/contracts/m5u8.md:144` | \| E5 \| Capability 2 (`drawThreshold`) carries a measured verdict \| table above, with a `drawThreshold:100` positive control \| pass \| | none | historical |
| R365 | contract | `.agent/contracts/m5u8.md:145` | \| E6 \| Capability 3 (`selectNodes` isolation) carries a measured verdict \| table above \| pass \| | none | historical |
| R366 | contract | `.agent/contracts/m5u8.md:146` | \| E7 \| Capability 4 (per-edge dashes) carries a measured verdict \| table above \| pass \| | none | historical |
| R367 | contract | `.agent/contracts/m5u8.md:147` | \| E8 \| Capability 5 (bundle delta, six peers resolved) carries a measured verdict \| two single-entry `vite build --lib` runs \| pass \| | none | historical |
| R368 | contract | `.agent/contracts/m5u8.md:148` | \| E9 \| The renderer choice is committed \| this file, `.claude/rules/graph.md` \| pass \| | `/usr/bin/rg -n 'Cytoscape stays' .claude/rules/graph.md` | true |
| R369 | contract | `.agent/contracts/m5u8.md:149` | \| E10 \| The edge-view contract is committed \| R1–R7 above \| pass \| | `/usr/bin/rg -n 'Renderer-neutral edge-view contract' .agent/contracts/m5u8.md` | true |
| R370 | contract | `.agent/contracts/m5u8.md:150` | \| E11 \| Rejecting vis leaves no trace in the dependency set \| `pnpm remove vis-network`; `git diff --stat` empty \| pass \| | `/usr/bin/rg -q '"cytoscape"' package.json && ! /usr/bin/rg -q 'vis-network' package.json pnpm-lock.yaml` | true |
| R371 | contract | `.agent/contracts/m5u9.md:98` | \| F1 \| R1: every parallel pair renders as distinguishable curves \| 34/34 over 28 views \| pass \| | none | historical |
| R372 | contract | `.agent/contracts/m5u9.md:99` | \| F2 \| R2: a shown edge label is exactly `graphRelationLabel`, and only the proof path shows one \| per-edge compare against the model \| pass \| | `pnpm graph:check` | true |
| R373 | contract | `.agent/contracts/m5u9.md:100` | \| F3 \| R3: no element can be selected, and a tap moves the app's selection without moving the highlight \| `:selected` empty, highlight set equal ac | `pnpm graph:check` | true |
| R374 | contract | `.agent/contracts/m5u9.md:101` | \| F4 \| R4: `line-style` is per-edge, and no edge dashes yet \| 0 → 1 → 0 control per viewport \| pass \| | none | historical |
| R375 | contract | `.agent/contracts/m5u9.md:102` | \| F5 \| R5: a settled node label is at least 11 px \| 11.00-24.38 px over 28 views \| pass \| | `pnpm graph:check` | true |
| R376 | contract | `.agent/contracts/m5u9.md:103` | \| F6 \| R6: the seam holds — three files name no renderer, `model.ts` imports nothing, the mount signature is unmoved \| source census \| pass \| | `pnpm graph:check` | true |
| R377 | contract | `.agent/contracts/m5u9.md:104` | \| F7 \| R7: every node label renders wrapped and whole \| 690/690 labels, wrap mode `wrap` alone \| pass \| | none | historical |
| R378 | contract | `.agent/contracts/m5u9.md:105` | \| F8 \| The probe reddens when each rule is broken \| four controls, `canvas.ts` restored byte-identical after each \| pass \| | none | deferred — source mutation controls were hand-run and restored |
| R379 | contract | `.agent/contracts/m5u9.md:106` | \| F9 \| `pnpm gate` rc 0 \| gate \| pass \| | `pnpm gate` | true |
| R380 | contract | `.agent/contracts/m5u9.md:107` | \| F10 \| The app still activates the graph and answers in both locales \| `pnpm browser:check` rc 0 \| pass \| | `pnpm browser:check` | true |

<!-- rows -->
