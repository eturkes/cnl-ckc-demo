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
node tools/claims-sweep.mjs          # grade the registry against the tree
node tools/claims-sweep.mjs --seed   # rewrite the row set, every cell `unknown`
```

Four sources, in registry order:

| source | what it covers | unit |
|---|---|---|
| `shipped` | the surfaces a user reads — `src/i18n/en.ts`, `src/i18n/ja.ts`, `README.md`, `src/questions/service.ts` | one adjudicated row of `.agent/contracts/m5u14.md`, `not a claim` excluded |
| `spec` | the run commands `.agent/spec.md` `Artifacts` promises | one bullet |
| `rules` | project law under `.claude/rules/` | one bullet, table row or paragraph carrying a measured number or a `pnpm` command |
| `contract` | what each closed unit promised it had done | one acceptance row or predicate of `.agent/contracts/m5u*.md` |

A claim-bearing unit is a bullet with its continuation lines, a table row, or a paragraph —
never a raw line, which would split one assertion across two rows and count its tail as a new
claim. Prose carrying neither a number nor a command asserts no checkable property and takes no
row.

## Dispositions

| disposition | meaning |
|---|---|
| `true` | the command runs from committed state and re-derives the claim |
| `deferred` | no committed command re-derives it; the row names the `.agent/deferred.md` row that would |
| `historical` | a measurement of something not shipped — a rejected alternative, a superseded figure — kept as a decision record, not asserted of the tree |
| `false` | the tree does not honor it; fix the claim or the tree |

`command` names a command that reruns from committed state, or `none`. A scratch-local
validator, a `wt/` branch suite or an uncommitted path does not satisfy that and takes
`deferred` instead.

Three commands are outside `pnpm gate` and a row resting on one says so, because a gate-green
report never covers them: `pnpm smoke`, `pnpm browser:check`, `pnpm graph:check`. `pnpm
kb:reproduce` and `pnpm binding:replay` are outside it too.

## Rows

<!-- rows -->
| R001 | shipped | `src/i18n/en.ts:4` | u14 A01 | unknown | unknown |
| R002 | shipped | `src/i18n/en.ts:6` | u14 A02 | unknown | unknown |
| R003 | shipped | `src/i18n/en.ts:9` | u14 A03 | unknown | unknown |
| R004 | shipped | `src/i18n/en.ts:28` | u14 A04 `graphCompareRun` | unknown | unknown |
| R005 | shipped | `src/i18n/en.ts:38` | u14 A05 | unknown | unknown |
| R006 | shipped | `src/i18n/en.ts:44` | u14 A06 | unknown | unknown |
| R007 | shipped | `src/i18n/en.ts:59` | u14 A07 | unknown | unknown |
| R008 | shipped | `src/i18n/en.ts:65` | u14 A08 | unknown | unknown |
| R009 | shipped | `src/i18n/en.ts:67` | u14 A09 `sourcePassage` | unknown | unknown |
| R010 | shipped | `src/i18n/en.ts:74` | u14 A10 | unknown | unknown |
| R011 | shipped | `src/i18n/en.ts:76` | u14 A11 | unknown | unknown |
| R012 | shipped | `src/i18n/en.ts:80` | u14 A12 | unknown | unknown |
| R013 | shipped | `src/i18n/en.ts:88` | u14 A13 | unknown | unknown |
| R014 | shipped | `src/i18n/en.ts:90` | u14 A14 `graphLoadNote` | unknown | unknown |
| R015 | shipped | `src/i18n/en.ts:103` | u14 A15 | unknown | unknown |
| R016 | shipped | `src/i18n/en.ts:173` | u14 A16 `liveProof` | unknown | unknown |
| R017 | shipped | `src/i18n/en.ts:175` | u14 A17 `proofAbsent` | unknown | unknown |
| R018 | shipped | `src/i18n/en.ts:234` | u14 A19 | unknown | unknown |
| R019 | shipped | `src/i18n/en.ts:238` | u14 A20 `answerYesSummary` | unknown | unknown |
| R020 | shipped | `src/i18n/en.ts:280` | u14 A21 `traceFailure` | unknown | unknown |
| R021 | shipped | `src/i18n/en.ts:286` | u14 A22 | unknown | unknown |
| R022 | shipped | `src/i18n/en.ts:290` | u14 A23 `proofNegationCount` | unknown | unknown |
| R023 | shipped | `src/i18n/en.ts:292` | u14 A24 `clauseJoin` | unknown | unknown |
| R024 | shipped | `src/i18n/en.ts:303` | u14 A25 | unknown | unknown |
| R025 | shipped | `src/i18n/en.ts:313` | u14 A26 | unknown | unknown |
| R026 | shipped | `src/i18n/en.ts:346` | u14 A27 | unknown | unknown |
| R027 | shipped | `src/i18n/ja.ts:99` | u14 A28 | unknown | unknown |
| R028 | shipped | `src/i18n/ja.ts:159` | u14 A29 `liveProof` | unknown | unknown |
| R029 | shipped | `README.md:8` | u14 A30 | unknown | unknown |
| R030 | shipped | `README.md:13` | u14 A31 | unknown | unknown |
| R031 | shipped | `README.md:14` | u14 A32 | unknown | unknown |
| R032 | shipped | `README.md:15` | u14 A33 | unknown | unknown |
| R033 | shipped | `README.md:22` | u14 A34 | unknown | unknown |
| R034 | shipped | `README.md:23` | u14 A35 | unknown | unknown |
| R035 | shipped | `README.md:24` | u14 A36 | unknown | unknown |
| R036 | shipped | `README.md:65` | u14 A38 | unknown | unknown |
| R037 | shipped | `README.md:86` | u14 A39 | unknown | unknown |
| R038 | shipped | `README.md:93` | u14 A40 | unknown | unknown |
| R039 | shipped | `README.md:94` | u14 A41 | unknown | unknown |
| R040 | shipped | `README.md:110` | u14 A42 | unknown | unknown |
| R041 | shipped | `src/questions/service.ts:1` | u14 A43 | unknown | unknown |
| R042 | shipped | `src/questions/service.ts:4` | u14 A44 | unknown | unknown |
| R043 | shipped | `src/questions/service.ts:5` | u14 A45 | unknown | unknown |
| R044 | shipped | `src/questions/service.ts:16` | u14 A46 | unknown | unknown |
| R045 | shipped | `src/questions/service.ts:24` | u14 A47 | unknown | unknown |
| R046 | spec | `.agent/spec.md Artifacts` | - `src/` + `index.html` — the demo. `pnpm dev`; production `pnpm build && pnpm preview`. | unknown | unknown |
| R047 | rules | `.claude/rules/engine.md:15` | - **`JSON.stringify` over an engine value is a measured corruption path**: `'$guideline_id'/5` re-enters as arity 1 with `ref([1])`, and `1r3` seriali | unknown | unknown |
| R048 | rules | `.claude/rules/engine.md:18` | - Wrapper ABI, undocumented and read off the package: `$t:'s'` string, `'r'` rational, `'v'` variable, `'l'` improper list, `'t'` compound whose args  | unknown | unknown |
| R049 | rules | `.claude/rules/engine.md:21` | - Integral floats decode as `integer`: SWI's `1.0` and `1` both arrive as JS `1`. The corpus has no floats. | unknown | unknown |
| R050 | rules | `.claude/rules/engine.md:23` | - Display text = `term_string/3` with `[quoted(true),numbervars(true),ignore_ops(true)]`, which matched `write_canonical` on all 7 real answers at 0.0 | unknown | unknown |
| R051 | rules | `.claude/rules/engine.md:29` | - **A malformed goal yields NO solution rather than raising**, so a zero-answer run and a broken goal are indistinguishable without a parse guard. `so | unknown | unknown |
| R052 | rules | `.claude/rules/engine.md:51` | **`Query.close()` is load-bearing.** Abandoning an iterator on a cap, cancel or deadline leaves the frame open and every later query returns `failure` | unknown | unknown |
| R053 | rules | `.claude/rules/engine.md:57` | - Split enforcement. Prolog owns stack/depth/inference: `stack_limit` reducible 1073741824 → 8388608 B, catchable `error(resource_error(stack),stack_o | unknown | unknown |
| R054 | rules | `.claude/rules/engine.md:60` | - **No in-Prolog wall clock.** The build reports `threads=false`; `library(time)` raises `existence_error(source_sink,library(time))`; `call_with_time | unknown | unknown |
| R055 | rules | `.claude/rules/engine.md:63` | - Prolog limits do not bound a query: `repeat` under the full wrapper emitted 100000 answers in 452.232 ms with `D=1`, `I=true`. The JS answer cap and | unknown | unknown |
| R056 | rules | `.claude/rules/engine.md:70` | - Engine ceilings: unified stack limit 1 GiB (reducible), Emscripten heap ceiling 2 GiB, RSS ~119 MB steady. Asserted state persists across queries in | unknown | unknown |
| R057 | rules | `.claude/rules/engine.md:75` | - **A worker timer cannot fire inside a synchronous step**: an in-worker 25 ms timer never fired across 249.80 ms of `repeat,fail`, while a main-threa | unknown | unknown |
| R058 | rules | `.claude/rules/engine.md:78` | - `solve` yields a MACROTASK between solutions; a microtask yield admits no posted message and cannot deliver a cancel. Granularity = 50.11 ms worst s | unknown | unknown |
| R059 | rules | `.claude/rules/engine.md:84` | - Hard cancel: terminate 2.7–3.5 ms; terminate→respawn→boot 181.75–223.96 ms **in Node**. In a real browser the same cycle costs 526.4–1732.5 ms, medi | unknown | unknown |
| R060 | rules | `.claude/rules/engine.md:88` | - **Heap exhaustion diverges by host.** In Node it returns a typed `assertz/1: Not enough resources: no_memory`, no throw, no abort, ~2222464 KiB peak | unknown | unknown |
| R061 | rules | `.claude/rules/engine.md:103` | The main chunk carries 0 engine bytes; the worker chunk plus a hashed `kb-<hash>.pvm` carry it. No COOP/COEP is needed, but `loadImageDefault` uses di | unknown | unknown |
| R062 | rules | `.claude/rules/gate.md:3` | `pnpm gate` = one `&&` chain in `package.json`; every step fails closed: | unknown | unknown |
| R063 | rules | `.claude/rules/gate.md:13` | **`pnpm gate` green is not `release:check` green.** A report of a gate-only run names `kb:reproduce`, `smoke`, `browser:check` and `graph:check` as no | unknown | unknown |
| R064 | rules | `.claude/rules/gate.md:22` | - `audit:check` = `pnpm audit --audit-level=moderate`, live against the registry advisory feed. **User ruling: no allowlist.** An advisory published a | unknown | unknown |
| R065 | rules | `.claude/rules/gate.md:26` | - `secret:check` (`tools/secret-check.mjs`) runs secretlint twice: the planted control below, then the tree, which must exit 0. The control literal is | unknown | unknown |
| R066 | rules | `.claude/rules/gate.md:29` | - `lint` carries the static-analysis layer and runs at `--max-warnings=0`, so a security finding fails the gate rather than scrolling past. ESLint is  | unknown | unknown |
| R067 | rules | `.claude/rules/gate.md:37` | - `kb:build` subsumes the retired `kb:verify` — it proves the vendored bag against its `.sha256` sidecar before parsing, in memory, never extracting. | unknown | unknown |
| R068 | rules | `.claude/rules/gate.md:42` | - `binding:check` (`tools/binding-check.mjs`) **replaces `pnpm test` in the chain.** It runs the whole suite once, then requires every case in its DEC | unknown | unknown |
| R069 | rules | `.claude/rules/gate.md:62` | - `copy:check` (`tools/copy-check.mjs`) runs two graders over `src/i18n/`: English on sentence length and banned filler, Japanese on key parity alone. | unknown | unknown |
| R070 | rules | `.claude/rules/gate.md:73` | **Every purpose-built check ships the input that makes it fail.** A check that cannot fail and a clean tree emit the same green, so a step may not rep | unknown | unknown |
| R071 | rules | `.claude/rules/gate.md:90` | \| `secret:check` \| a token-shaped literal planted in a temp dir; the `TREE_TARGETS` list emptied \| secretlint spawned on the literal, must exit 1,  | unknown | unknown |
| R072 | rules | `.claude/rules/gate.md:91` | \| `kb:build` \| one digit changed in the bag `.sha256` sidecar \| `readVerifiedBag(perturb)` re-run in process, before the real verify \| | unknown | unknown |
| R073 | rules | `.claude/rules/gate.md:94` | \| `engine:check` \| one perturbed pinned surface per predicate: the budget parameter dropped from `EngineClient.query`, a bare `swipl-wasm` import ad | unknown | unknown |
| R074 | rules | `.claude/rules/gate.md:95` | \| `engine:check` `CONTROLS` \| the `CONTROLS` table emptied \| its own non-empty grader, in process — emptied, no child control runs at all and the s | unknown | unknown |
| R075 | rules | `.claude/rules/gate.md:96` | \| `kb:asset-check` `SCAN_ROOTS` \| one declared root replaced by a path that does not exist \| each root binds its paths and rejects zero files, so t | unknown | unknown |
| R076 | rules | `.claude/rules/gate.md:98` | \| `copy:check` \| the shipped English graded at limit 0 against a filler list holding `the`; `en.ts` read as the Japanese catalog; the shell `<title> | unknown | unknown |
| R077 | rules | `.claude/rules/gate.md:99` | \| `contrast:check` \| `--text` collapsed onto `--surface` \| the pair loop re-run on the perturbed token map, must report `1:1` \| | unknown | unknown |
| R078 | rules | `.claude/rules/gate.md:103` | \| `graph:check` \| one edge's `line-style` set to `dashed` in the mounted graph; `SEPARATION_PX` set to 0 \| `dashControl` requires a 0 → 1 → 0 readi | unknown | unknown |
| R079 | rules | `.claude/rules/gate.md:104` | \| `graph:check` termination \| a planted non-terminating page, `tools/graph-probe/hang.html` \| `GRAPH_CHECK_CONTROL=non-terminating-page node tools/ | unknown | unknown |
| R080 | rules | `.claude/rules/gate.md:105` | \| `graph:check` scope readings \| one scope element dropped from a rendered label; the scope reordered; the negation dash removed; one scope element  | unknown | unknown |
| R081 | rules | `.claude/rules/gate.md:106` | \| `graph:check` component half \| the component's selection callback detached; a `graphUrl` the server does not serve; every `--graph-*` token set to | unknown | unknown |
| R082 | rules | `.claude/rules/gate.md:107` | \| `binding:replay` \| `pnpm binding:replay HEAD` \| both differential arms go green, so the command exits 1 instead of accepting archived-red/current | unknown | unknown |
| R083 | rules | `.claude/rules/gate.md:109` | `audit:check`, `format:check`, `lint`, `check` and `build` are configured third-party checkers, not purpose-built ones, and are absent from that table | unknown | unknown |
| R084 | rules | `.claude/rules/gate.md:119` | \| `pnpm kb:reproduce` \| byte-reproducibility of pvm + qlf + catalog across two forced builds \| | unknown | unknown |
| R085 | rules | `.claude/rules/gate.md:120` | \| `pnpm smoke` \| built output answers in a real browser against bag bytes read at run time \| | unknown | unknown |
| R086 | rules | `.claude/rules/gate.md:121` | \| `pnpm browser:check` \| 337 documents on dev + built output, every 320 px interaction state incl. Japanese, that `unicode-range` keeps the Japanese | unknown | unknown |
| R087 | rules | `.claude/rules/gate.md:122` | \| `pnpm graph:check` \| the renderer-neutral edge-view contract R1-R7 (`.agent/contracts/m5u8.md`) against the SHIPPED `mountGraphCanvas`, over 14 fi | unknown | unknown |
| R088 | rules | `.claude/rules/gate.md:123` | \| `pnpm binding:replay` \| that `clinical-binding` E2 is load-bearing: the same erasure is invisible at `a944fca` and drops exactly one document now  | unknown | unknown |
| R089 | rules | `.claude/rules/gate.md:125` | `tools/answer-oracle.mjs` is the browser lanes' shared expectation — `clinicalArtifacts` answer terms assembled in JavaScript from the bag, never scra | unknown | unknown |
| R090 | rules | `.claude/rules/gate.md:131` | `binding:replay` reads git history, so it needs a full clone; that is why it stays out of `release:check` and out of CI. It varies the answer-path pro | unknown | unknown |
| R091 | rules | `.claude/rules/gate.md:145` | It drives TWO pages off one dev server. `tools/graph-probe/index.html` mounts the ADAPTER, and sizes the viewport to the measured `.graph-shell .canva | unknown | unknown |
| R092 | rules | `.claude/rules/gate.md:161` | **The campaign owns a named budget and terminates on its own.** It formerly printed both summaries and then hung forever, which made `release:check` u | unknown | unknown |
| R093 | rules | `.claude/rules/gate.md:173` | `pnpm release:check` = `gate && kb:reproduce && smoke && browser:check && graph:check`. | unknown | unknown |
| R094 | rules | `.claude/rules/gate.md:177` | - `.github/workflows/pages.yml` — runs `pnpm gate` on every push to `main`, then publishes `dist/` to Pages. Scanners ride the gate, so CI covers them | unknown | unknown |
| R095 | rules | `.claude/rules/gate.md:188` | **Never run MAIN's decisive `pnpm gate` while teammates run suites.** Three trees testing at once starve the CPU into spurious `Test timed out in 5000 | unknown | unknown |
| R096 | rules | `.claude/rules/graph.md:19` | **Cytoscape is isolated behind one adapter.** It appears nowhere outside `src/graph/canvas.ts` — `model.ts`, `SemanticGraph.svelte`, `index.ts` and `t | unknown | unknown |
| R097 | rules | `.claude/rules/graph.md:27` | **The stale dependency is the layout engine, not the renderer.** `cytoscape-fcose` 2.2.0 ships no types (hence `src/graph/cytoscape-fcose.d.ts`); `cyt | unknown | unknown |
| R098 | rules | `.claude/rules/graph.md:31` | **Renderer ruling (user, binding): Cytoscape stays; `vis-network` is rejected.** The u8 spike measured it at half the label size at both viewports, wi | unknown | unknown |
| R099 | rules | `.claude/rules/graph.md:41` | **Measure at the CANVAS box, never the device size.** `.graph-shell .canvas` is **1152×558** inside a 1280×900 viewport and **296×384** inside 320×720 | unknown | unknown |
| R100 | rules | `.claude/rules/graph.md:46` | **Fit is clamped to a zoom floor (user, binding), so fit-zoom label size is no longer a layout-selection metric.** Below the floor the graph pans inst | unknown | unknown |
| R101 | rules | `.claude/rules/graph.md:53` | **A passing DOM suite proves nothing about rendered labels.** `tests/graph-semantics.review.test.ts` asserts `model.ts` output and `tests/semantic-gra | unknown | unknown |
| R102 | rules | `.claude/rules/graph.md:60` | **The component's own interactions are graded there too, not in jsdom.** `graph:check`'s `app.html` page mounts `SemanticGraph.svelte` whole and reads | unknown | unknown |
| R103 | rules | `.claude/rules/graph.md:70` | - **One layout for every view: fcose with the answer's subject pinned at the origin.** The `concentric` branch that used to run whenever a proof highl | unknown | unknown |
| R104 | rules | `.claude/rules/graph.md:80` | - **A node label carries a 2 px outline in the node's own colour.** The overflow is otherwise near-white text on a near-white canvas: `nonopioid thera | unknown | unknown |
| R105 | rules | `.claude/rules/graph.md:84` | - **`autounselectify: true`.** Cytoscape's built-in stylesheet paints anything `:selected` `#0169D9`, so a tap repainted a plain edge in the proof hig | unknown | unknown |
| R106 | rules | `.claude/rules/graph.md:87` | - **The canvas resolves every colour from an `src/app.css` token** (`--graph-*`, plus `--action` for the selected node and `--surface-sunken`/`--surfa | unknown | unknown |
| R107 | rules | `.claude/rules/graph.md:100` | - Base edges are **opaque**: `--graph-edge` clears 3:1 against the canvas as a colour, and a faded stroke does not. De-emphasis lives in `.context` al | unknown | unknown |
| R108 | rules | `.claude/rules/graph.md:106` | - The graph carries **0 self-edges of 20,964**, so `canvas.ts` filters none. | unknown | unknown |
| R109 | rules | `.claude/rules/graph.md:110` | - Deterministic full graph = **2,901 typed nodes / 20,964 typed edges**, extracted by static `clause/2` sweep. Runtime predicate calls expose only the | unknown | unknown |
| R110 | rules | `.claude/rules/graph.md:112` | - Explicit edge schemas = 7 (`entity/4`, `cardinality/5`, `event/3`, `arg/4`, `pp/4`, `property/4`, `operator/3`), plus **9,804 `implies` edges**. Tha | unknown | unknown |
| R111 | rules | `.claude/rules/graph.md:119` | The concept projection still filters `operator` edges and non-`condition supports` `implies` edges, and `operator-context` is still absent from `CONCE | unknown | unknown |
| R112 | rules | `.claude/rules/graph.md:124` | - Projection = **1,300 nodes / 2,668 grouped edges** out of 2,901 / 20,964. The nodes are 1,084 entity + 151 event + 65 value; the headline counts the | unknown | unknown |
| R113 | rules | `.claude/rules/graph.md:127` | - **1,912 of the 2,668 groups carry an ordered scope**, and **372 of them carry a far scope** (737 edge occurrences). Grouping keys on both sequences  | unknown | unknown |
| R114 | rules | `.claude/rules/graph.md:133` | - u13's `farScopeOperators` is what moved the group count off 2,630 and the scoped count off 1,584: a far end that differs splits what used to be one  | unknown | unknown |
| R115 | rules | `.claude/rules/graph.md:136` | - Scope-keyed dedup split 2,381 → 2,615 groups; the remaining 15 are the non-unit cardinality edges the projection now admits (`relation !== 'na eq 1' | unknown | unknown |
| R116 | rules | `.claude/rules/graph.md:138` | - Modal census, unchanged by u12: 156 `-` (negation), 857 `should`, 156 `may`, 85 `can`, 9 `must` = **1,263 operator contexts**, of which 71 carry no  | unknown | unknown |
| R117 | rules | `.claude/rules/graph.md:142` | **u13 closed the SHOWN edge.** `EdgeView` (`src/graph/view.ts`) carries `scope`, `farScope` and the composed `label`, and both renderers show them. `m | unknown | unknown |
| R118 | rules | `.claude/rules/graph.md:147` | **A spanning shortcut now shows both ends.** A synthesized `condition supports` edge records the producer's single `edge.scope` for its SOURCE end; th | unknown | unknown |
| R119 | rules | `.claude/rules/graph.md:162` | One shared helper composes both surfaces — `scopeReading(scope, farScope, atTarget)` exported from `src/graph/model.ts`, called by `graphRelationLabel | unknown | unknown |
| R120 | rules | `.claude/rules/graph.md:171` | Four forms on the resolved pair: `<rel> · <near>`, `<rel>`, `<rel> · <near> → <far>`, `<rel> → <far>`. `→` means one thing everywhere: the end AWAY fr | unknown | unknown |
| R121 | rules | `.claude/rules/i18n.md:3` | - "src/i18n/**" | unknown | unknown |
| R122 | rules | `.claude/rules/i18n.md:20` | - `src/i18n/en.ts` = the KEY SCHEMA. Four buckets: `INSTRUCTIONS` (≤20 words per sentence), `DESCRIPTIONS`, `LABELS`, `TEXT`. It also exports `Message | unknown | unknown |
| R123 | rules | `.claude/rules/i18n.md:27` | - `src/i18n/ja.ts` = the same keys in Japanese, です・ます register. Terminology is fixed and reused: 知識ベース, コンパイル済み, 制御自然言語, 証明, 出典 (a citation), 原文 (the  | unknown | unknown |
| R124 | rules | `.claude/rules/i18n.md:33` | - `src/i18n/locale.svelte.ts` = the `locale` rune plus `messages`, a **getter**. Exporting the resolved bundle would capture it once and freeze the UI | unknown | unknown |
| R125 | rules | `.claude/rules/i18n.md:56` | `BIZ UDPGothic` (`@fontsource`, **not** `@fontsource-variable`) ships as two static weights, 400 and 700 — 1,319,288 B + 1,335,452 B, the monolithic ` | unknown | unknown |
| R126 | rules | `.claude/rules/i18n.md:63` | Rejected: the 30-slice `unicode-range` partition (401 KB for a 160-character vocabulary, 30 `@font-face` rows, and tofu on any glyph outside the pinne | unknown | unknown |
| R127 | rules | `.claude/rules/i18n.md:68` | **Nothing in the header may carry a Japanese glyph.** `LABELS.languageSwitch` is ASCII in BOTH locales — `日本語` would make an English visitor fetch 1.3 | unknown | unknown |
| R128 | rules | `.claude/rules/i18n.md:81` | - `presentation:check` `FACES` rows carry a per-row `scope` and a filename `marker`, because the Japanese face is not a `-wght-` variable file. 8 face | unknown | unknown |
| R129 | rules | `.claude/rules/i18n.md:84` | - `tests/i18n.dom.test.ts` reads RENDERED text, never the catalog. A locale seam passes key parity and still ships English; only rendered output decid | unknown | unknown |
| R130 | rules | `.claude/rules/kb-build.md:14` | - `kb/cnl-ckc-kb-g<sha>.tar.gz` + a `.sha256` sidecar. BagIt 1.0; verify = `pnpm kb:build`, in memory, never extracting. 1041 payload + 5 tag entries  | unknown | unknown |
| R131 | rules | `.claude/rules/kb-build.md:16` | - **Archive dialect**: POSIX ustar magic (`ustar\0` + `00`) that ALSO carries five GNU `././@LongLink` (`L`) headers for names over 100 chars. A resol | unknown | unknown |
| R132 | rules | `.claude/rules/kb-build.md:23` | - Payload = 337 docs × 3 representations — `ace/` (source ACE), `pl/` (compiled Prolog, schema v1), `align/` (source↔ACE alignment, backs the trace vi | unknown | unknown |
| R133 | rules | `.claude/rules/kb-build.md:27` | - Rights profile = `redistributable` (public-domain MMWR) → source passages may ship whole in the UI. The bag records `swipl 9.2.9` as its compiler; t | unknown | unknown |
| R134 | rules | `.claude/rules/kb-build.md:29` | - Regenerate: `python3 -P tools/dist.py build <outdir>` run in `../cnl-ckc`, then copy the tarball + sidecar into `kb/`. Leave that repo clean. `tools | unknown | unknown |
| R135 | rules | `.claude/rules/kb-build.md:38` | `../cnl-ckc/tools/ui.py` resolves coverage rows to source payloads and renders click/hover -linked source↔ACE span groups; `parse_evidence`, `hl_parse | unknown | unknown |
| R136 | rules | `.claude/rules/kb-build.md:46` | `pnpm kb:build` → `kb/generated/{kb.pvm,kb.qlf,kb-manifest.json}`, gitignored. Input = the 337 `pl/` payload files, sorted, joined with `% file:<path> | unknown | unknown |
| R137 | rules | `.claude/rules/kb-build.md:50` | - **Byte-reproducible.** `qsave_program` writes a ZIP whose entry timestamps and whose embedded `state.qlf` source mtime both come from wall-clock rea | unknown | unknown |
| R138 | rules | `.claude/rules/kb-build.md:55` | - **Engine split**: building needs `swipl-bundle` (6.2 MB, carries the library); loading a saved state needs `swipl-bundle-no-data` (2.6 MB). The QLF  | unknown | unknown |
| R139 | rules | `.claude/rules/kb-build.md:68` | - Corpus load, measured: 337-file consult 2806 ms · concatenated source 3299 ms · `load_string` 3578 ms · QLF 213 ms + 724 ms boot · **saved PVM 335 m | unknown | unknown |
| R140 | rules | `.claude/rules/kb-build.md:74` | All 9 are multifile and **static** (`dynamic=false`): `schema_version`, `document`, `guideline_entity/4`, `guideline_cardinality/5`, `guideline_event/ | unknown | unknown |
| R141 | rules | `.claude/rules/kb-build.md:80` | Clause counts: version 337, document 337, entity 1834, cardinality 1834, event 1254, arg 2513, pp 1003, property 16, operator 1193. | unknown | unknown |
| R142 | rules | `.claude/rules/kb-build.md:83` | **Counting vocabulary, kept distinct.** Static clause SITES ≠ derivable SOLUTIONS: 1,834 `guideline_entity/4` sites yield 316 derivable entity solutio | unknown | unknown |
| R143 | rules | `.claude/rules/kb-build.md:91` | - The catalog is **GENERATED, not transcribed**: `tools/kb/catalog.mjs` re-exports `clinicalArtifacts`, so `kb:build` emits `kb/generated/question-cat | unknown | unknown |
| R144 | rules | `.claude/rules/kb-build.md:97` | - The shipped catalog is the **clinical** one. `CLINICAL_QUESTIONS` owns the curated topics and every answer statement and source coordinate is re-rea | unknown | unknown |
| R145 | rules | `.claude/rules/kb-build.md:102` | - `MANIFEST_VERSION` is 5. Bumping it is what stops a cached manifest from lacking a block a new build writes. | unknown | unknown |
| R146 | rules | `.claude/rules/kb-build.md:107` | `pnpm kb:export-check` (`tools/kb/export-check.mjs`) proves the compiled KB still answers the upstream export exactly. It is a diagnostic lane, separa | unknown | unknown |
| R147 | rules | `.claude/rules/kb-build.md:118` | - Goal grammar: `'$guideline_query_projection'(goal(G),answers(As))`, `G` in canonical prefix `','/2` form. `answer(Var,noun(N,countable)\|wh(what))`  | unknown | unknown |
| R148 | rules | `.claude/rules/kb-build.md:121` | - The comparison covers the WHOLE `'$guideline_answers'` envelope, not its solution list alone: `query_sha256` is the sha256 of the query file itself, | unknown | unknown |
| R149 | rules | `.claude/rules/kb-build.md:125` | - Live yield: category-A 7 solutions, dosage-reduction 2, evidence-type-1 1, recommendation-exists `yes`. | unknown | unknown |
| R150 | rules | `.claude/rules/kb-build.md:127` | - Sort = SWI standard order over decoded terms, never a byte sort of rendered text. The two diverge on mixed shapes (`10` precedes `'2'` numerically,  | unknown | unknown |
| R151 | rules | `.claude/rules/kb-build.md:131` | - The byte comparison lives in `tests/legacy-export-lane.test.ts` because `kb:asset-check` bans `queries/answers` reach over `tools/` — a comment mere | unknown | unknown |
| R152 | rules | `.claude/rules/proof.md:17` | A guideline clause is universally quantified over clinicians — `guideline_operator(actual,$gid(…,box(1),[A]),should) :- guideline_entity(actual,A,clin | unknown | unknown |
| R153 | rules | `.claude/rules/proof.md:25` | Real inference over the compiled clauses is measured feasible: asserting one hypothetical clinician entity + cardinality makes `should` operators, `ma | unknown | unknown |
| R154 | rules | `.claude/rules/proof.md:32` | The loaded `swipl-bundle-no-data` image is CLOSED: `autoload=false`, `unknown=error`, no `library(lists)` — `append/3`, `member/2`, `maplist/2` and `s | unknown | unknown |
| R155 | rules | `.claude/rules/proof.md:37` | `clause/2` and `clause/3` reach every static schema predicate (`dynamic=no` throughout). Rules dominate: arg 2351/2513, cardinality 1693/1834, entity  | unknown | unknown |
| R156 | rules | `.claude/rules/proof.md:41` | The interpreter compiles INTO the image (+964 B, boot 116.977 ms vs 123.216 ms for boot+consult). Runtime `consult` buys nothing and is fail-open — it | unknown | unknown |
| R157 | rules | `.claude/rules/proof.md:46` | - An unbounded naive meta-interpreter exhausts the 1 GiB stack in ~8.5 s on the corpus's recursive rule-head chains. The shipping design is **depth-ca | unknown | unknown |
| R158 | rules | `.claude/rules/proof.md:49` | - **Cap 1 is complete for plain queries** — projected-value multisets equal the plain query for all six catalog goals and hold to cap 20. Cap-1 live ` | unknown | unknown |
| R159 | rules | `.claude/rules/proof.md:52` | - Re-proving the SELECTED solution returns the byte-identical proof from the all-solutions run for all 18 slots; medians 0.097–291.419 ms. MI over ALL | unknown | unknown |
| R160 | rules | `.claude/rules/proof.md:55` | - Selected-proof budget: cap 1, stack 16 MiB, outer depth 100, 100000 inferences, answer cap 1; deterministic maxima 6403 inferences and outer depth ≥ | unknown | unknown |
| R161 | rules | `.claude/rules/proof.md:59` | - `resolve/3` whitelists the nine `guideline_*` predicates alone. | unknown | unknown |
| R162 | rules | `.claude/rules/proof.md:63` | Identity = `clause/3` reference → `clause_property(Ref, file(…) + line_count(L))`. All 10321 `L` values are unique against the deterministic concatena | unknown | unknown |
| R163 | rules | `.claude/rules/proof.md:67` | **Rendering `clause/2` output reproduces the committed `clause_sha256` 0/10321 times**: `clause/2` injects `user:` into rule bodies, `fullstop(true)`  | unknown | unknown |
| R164 | rules | `.claude/rules/proof.md:77` | Emitted beside `clinical_advice/3,4`: `clinical_rule(Doc,S,Rule)` (48, one per selected content sentence), `clinical_premise(Doc,S,N,Literal)` (346),  | unknown | unknown |
| R165 | rules | `.claude/rules/proof.md:82` | - **A build-time GROUND head still drives `clause/3`.** It unifies against the stored head's variables, and `call(Body)` then demands exactly the grou | unknown | unknown |
| R166 | rules | `.claude/rules/proof.md:88` | - Census: 12 documents, 48 content sentences, **686 sites / 686 unique lines**, 0 multi-antecedent violations, 46/48 antecedents non-`true`, exactly 1 | unknown | unknown |
| R167 | rules | `.claude/rules/proof.md:90` | - **Exactly 2 gates prove on the bare KB** — the two `true`-antecedent sentences. The other 46 correctly fail until premises apply the universal. | unknown | unknown |
| R168 | rules | `.claude/rules/proof.md:92` | - **44 gates resolve natively**; 4 exhaust 200,000 inferences with only their own premises asserted (`rec01:3`, `rec02:3`, `rec02:8`, `rec05:4`) on th | unknown | unknown |
| R169 | rules | `.claude/rules/proof.md:96` | - **An independent site enumerator must close the open sentence at a `% file:` boundary.** Without that reset each document's 2 preamble facts count a | unknown | unknown |
| R170 | rules | `.claude/rules/proof.md:99` | - **48 fragments and 38 groups are one dataset at two granularities.** Reassembling the 48 per-sentence `clinical_rule/3` by consequent — conditions c | unknown | unknown |
| R171 | rules | `.claude/rules/proof.md:103` | - `clinical.mjs:325` is `groupTerm`, **not** a second byte guard. The single fail-closed rebuild-equality guard is at `:261-266`. | unknown | unknown |
| R172 | rules | `.claude/rules/proof.md:109` | `derive/5` threads an assumption list through the existing interpreter, with an `assumption(H)` leaf placed **before** the depth cap and before `resol | unknown | unknown |
| R173 | rules | `.claude/rules/proof.md:115` | - **`PROOF_SOURCE` is LAST in `payloadSource`** (payload → clinical helper → proof), so no edit to it can move a content-site line or a `clinical_gate | unknown | unknown |
| R174 | rules | `.claude/rules/proof.md:118` | - **Read cited heads from the STORED gate body, never by calling the gate.** `clinical_use/2` runs `call(Body)`, which demands the very premises the e | unknown | unknown |
| R175 | rules | `.claude/rules/proof.md:122` | - Measured on the shipped image, reproduced independently with 0 divergences: cap 2 → **48/48 sentences and 12/12 documents**; cap 1 → 47/48, failing  | unknown | unknown |
| R176 | rules | `.claude/rules/proof.md:128` | - Negative controls: premises-withheld → **0 of 12 documents** (2 of 48 sentences survive — the two `true`-antecedent gates — so **the control's grain | unknown | unknown |
| R177 | rules | `.claude/rules/proof.md:134` | `clinical_advice/3` projects `clinical_advice/4`, whose fourth argument is the proof; the interpreter's arm is `derive(clinical_advice(Q,S,A),_,_,P,pr | unknown | unknown |
| R178 | rules | `.claude/rules/proof.md:140` | - The arm sits before the depth cap and cuts, so the outer `mi/3` depth of 1 still reaches it; `clinical_depth(2)` governs inside. | unknown | unknown |
| R179 | rules | `.claude/rules/proof.md:142` | - Measured over the shipped image: **686 clause nodes** — exactly the cited-site census, all at top level with their bodies as children — **3,930 assu | unknown | unknown |
| R180 | rules | `.claude/rules/proof.md:146` | - **A constrained proof goal must bind INSIDE the answer argument** (`clinical_advice('q',_,clinical_answer('doc',_,_))`). A trailing `Answer = …` con | unknown | unknown |
| R181 | rules | `.claude/rules/proof.md:150` | - A wrong answer term yields `failure`, not a proof: the arm cuts, `clinical_advice/4` fails, and no fallback can fabricate one. | unknown | unknown |
| R182 | rules | `.claude/rules/proof.md:163` | **A binding overlay must perturb `guideline_*` and require the line-keyed proof to change too** — an overlay that asserts a `clinical_advice/3` fact m | unknown | unknown |
| R183 | rules | `.claude/rules/proof.md:172` | - `assertz((Head) :- Body)` parses as a `:-`/2 term rather than a clause → write `assertz((Head :- Body))`. | unknown | unknown |
| R184 | rules | `.claude/rules/proof.md:177` | - An `assertz` permission error never reaches JS as `$error` — it prints to real stderr, outside the `printErr` drain, and the call returns normally → | unknown | unknown |
| R185 | rules | `.claude/rules/stack.md:8` | - Frontend = **Svelte 5** runes + **Vite** + TypeScript. Runes carry the demo's real state (selected question, run status, chosen solution, focused tr | unknown | unknown |
| R186 | rules | `.claude/rules/stack.md:11` | - Entity graph ≈ 1K nodes = **analysis tier, not scale tier** → layout quality, neighborhood expansion, shortest path and centrality outrank renderer  | unknown | unknown |
| R187 | rules | `.claude/rules/toolchain.md:17` | - `typescript-eslint` stable caps at TypeScript <6.1 → TypeScript stays on 5.x. Installing TS 7 breaks `pnpm lint`. | unknown | unknown |
| R188 | rules | `.claude/rules/toolchain.md:24` | - jsdom is capped at `^29.1.1`, exact only in the lockfile. jsdom 30 pulls undici 8, which assigns `webidl.util.markAsUncloneable` from `node:worker_t | unknown | unknown |
| R189 | rules | `.claude/rules/toolchain.md:27` | - `secretlint` and every `@secretlint/*` package are capped at `^12`. Version 13 declares `engines.node >= 22`; this project runs Node 20 (`engines`,  | unknown | unknown |
| R190 | rules | `.claude/rules/toolchain.md:43` | - Regex capture groups and destructured array elements arrive as `string \| undefined` → prefer `exec(…)?.[1]` with an `undefined` guard over indexing | unknown | unknown |
| R191 | rules | `.claude/rules/toolchain.md:48` | - The chromiumfish launcher resolves from the pnpm global store and ships no types, so `tools/browser.mjs` carries one `no-unsafe-assignment` disable. | unknown | unknown |
| R192 | rules | `.claude/rules/ui.md:20` | Self-hosted from `@fontsource-variable/{atkinson-hyperlegible-next,atkinson-hyperlegible-mono, literata}` (OFL 1.1, no Reserved Font Name, zero transi | unknown | unknown |
| R193 | rules | `.claude/rules/ui.md:27` | Japanese adds two static faces from `@fontsource/biz-udpgothic` — sizing, the rejected alternatives and the ASCII-label rule are in `.claude/rules/i18 | unknown | unknown |
| R194 | rules | `.claude/rules/ui.md:37` | Role tokens: `--surface`, `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`, `--border`, `--action`, `--action-text`, `--warn`, `--focu | unknown | unknown |
| R195 | rules | `.claude/rules/ui.md:54` | **Every human-facing string lives in `src/i18n/`** — `src/demo/copy.ts` retains invariant data alone. The locale seam, its consumer pattern and the pa | unknown | unknown |
| R196 | rules | `.claude/rules/ui.md:58` | `tools/copy-check.mjs` is static — there is no TS runner here. It grades `src/i18n/en.ts` (`INSTRUCTIONS` ≤20 words/sentence, the other three buckets  | unknown | unknown |
| R197 | rules | `.claude/rules/ui.md:67` | The bag labels all 337 documents `unreviewed`. Upstream counts `approved`/`rejected`/`contested`/`stale`/`unreviewed`, so the label means **no adjudic | unknown | unknown |
| R198 | rules | `.claude/rules/ui.md:78` | - **Run serialization chains on the ENGINE CALL, not on the state write.** A successor that awaits its predecessor's settle promise adds a microtask h | unknown | unknown |
| R199 | rules | `.claude/rules/ui.md:91` | - An existence question projects no columns, so `answerRows` returns `[]` for it regardless of solution count. Mapping its 12 solutions would emit 12  | unknown | unknown |
| R200 | rules | `.claude/rules/ui.md:98` | - `svelte-check --fail-on-warnings` is the ONLY a11y linter here: `eslint-plugin-svelte` ships 86 rules and zero `a11y-*` ones. | unknown | unknown |
| R201 | rules | `.claude/rules/ui.md:100` | - The compiler rejects a click handler on `role="listbox"` (`a11y_click_events_have_key_events`) because it cannot see that an aria-activedescendant w | unknown | unknown |
| R202 | rules | `.claude/rules/ui.md:104` | - **The combobox is hand-authored — keep it that way.** A component library was measured working and rejected: a required `@internationalized/date` pe | unknown | unknown |
| R203 | rules | `.claude/rules/ui.md:109` | - Svelte 5 `unmount()` returns a promise → `void unmount(app)` in tests. | unknown | unknown |
| R204 | rules | `.claude/rules/ui.md:113` | `pnpm smoke` always runs `pnpm build`, copies `dist` under a nested path, serves it with a request log, drives chromiumfish, and compares the rendered | unknown | unknown |
| R205 | rules | `.claude/rules/ui.md:119` | - It must open the canonical-answer disclosure before reading it — a `<details>` body is not visible, so a visibility wait times out at 45 s. | unknown | unknown |
| R206 | rules | `.claude/rules/ui.md:121` | - Negative control, run by hand and NOT shipped: removing BOTH `kb/generated/kb.pvm` and `dist/` gives rc 1, thrown by the `pnpm build` step. Removing | unknown | unknown |
| R207 | rules | `.claude/rules/upstream-sync.md:16` | - **The `@.agent/spec.md` import on line 1 is repo-owned.** The template does carry it, but a refresh from an older copy drops it and the attached sta | unknown | unknown |
| R208 | rules | `.claude/rules/upstream-sync.md:50` | - The `≤ 8 KB` cap on `.agent/spec.md` → the liveness rule above. Byte pressure rewarded compressing prose over deleting dead rows, which is the entro | unknown | unknown |
| R209 | rules | `.claude/rules/upstream-sync.md:52` | - The milestone vocabulary (M1-M5, MODE, WORK-UNIT, PLANNING, MILESTONE-REVIEW) → the four phases in `CLAUDE.md` `Session flow`. Archived text still u | unknown | unknown |
| R210 | rules | `.claude/rules/upstream-sync.md:54` | - The sizing model (`M = 45 + 2·I`, the 1.77 multiplier, the 223K one-window aim) → retired by user ruling. A `/goal` phase runs across compactions, s | unknown | unknown |
| R211 | rules | `.claude/rules/waves.md:8` | - `.agent/contracts/` = committed. Anything a later unit dispatches from lands there — acceptance contracts, fixed check sets, verdict tables. The M1  | unknown | unknown |
| R212 | rules | `.claude/rules/waves.md:22` | - **`kb/generated` must be a real directory in the worktree, never a symlink.** Vite resolves a symlinked id to its real path and then refuses it for  | unknown | unknown |
| R213 | rules | `.claude/rules/waves.md:35` | - Research probe branches held as evidence, worktrees removed: `wt/res-m1-1` `36cc56f` (swipl-wasm load/worker/terms/trace/perf/test/errors/deploy), ` | unknown | unknown |
| R214 | rules | `.claude/rules/waves.md:43` | - **Every commit carries a `dispatch:` trailer in its body**, not units alone — roles + scope (`dispatch: map-controls — firing-input census; MAIN aut | unknown | unknown |
| R215 | rules | `.claude/rules/waves.md:49` | - **A check ships with its red witness in the unit's acceptance row, cited from the commit body.** The form is already in the tree: `19/20 RED at base | unknown | unknown |
| R216 | rules | `.claude/rules/waves.md:65` | - Lagging teammate → send a **cost** directive at the FIRST flat poll, not a flush directive: cap each finding at ~250 chars, ship no detail sections, | unknown | unknown |
| R217 | rules | `.claude/rules/waves.md:75` | `.scratch/validate-report.py` grades wave reports: `--units N`, `--verdict`. Rows are `\| id \| finding \| evidence \|`, and `--verdict` folds the ver | unknown | unknown |
| R218 | contract | `.agent/contracts/m5u10.md:39` | \| P1 \| Every canvas colour resolves from an `src/app.css` token \| `graph:check` `palette`, per node kind, edge, path and selection \| pass \| | unknown | unknown |
| R219 | contract | `.agent/contracts/m5u10.md:40` | \| P2 \| A theme flip restyles a MOUNTED graph: colours change, the palette stays on-token, no node moves \| `graph:check` `theme`, `themeFlip()` \| p | unknown | unknown |
| R220 | contract | `.agent/contracts/m5u10.md:41` | \| P3 \| The legend swatches read the same tokens the canvas paints \| `src/graph/SemanticGraph.svelte` style block \| pass \| | unknown | unknown |
| R221 | contract | `.agent/contracts/m5u10.md:42` | \| C1 \| The SHIPPED component mounts against the real graph asset and the real renderer \| `window.componentProbe` boots `SemanticGraph.svelte`; `con | unknown | unknown |
| R222 | contract | `.agent/contracts/m5u10.md:43` | \| C2 \| Search: an unmatched query reports no matches, a matched one lists results, and choosing one moves the selection card, emits `onSelect`, and  | unknown | unknown |
| R223 | contract | `.agent/contracts/m5u10.md:44` | \| C3 \| Path: a path action fills the panel, and the canvas carries EXACTLY the panel's edges as `.path`; Clear empties both \| probe diffs the panel | unknown | unknown |
| R224 | contract | `.agent/contracts/m5u10.md:45` | \| C4 \| Expand: the control raises the canvas node count, and goes disabled at the cap \| probe clicks to the cap, reading `cy.nodes().length` each r | unknown | unknown |
| R225 | contract | `.agent/contracts/m5u10.md:46` | \| C5 \| Recenter: the control moves the rendered viewport without re-running the layout \| probe reads zoom + model positions before and after \| pas | unknown | unknown |
| R226 | contract | `.agent/contracts/m5u10.md:47` | \| C6 \| Canvas tap: a tap on a canvas node moves the component's selection \| probe taps a non-selected node, reads the selection card \| pass \| | unknown | unknown |
| R227 | contract | `.agent/contracts/m5u10.md:48` | \| C7 \| Node index: it lists exactly the canvas's nodes, marks the selected one `aria-current`, and selects from it \| probe compares the index to `c | unknown | unknown |
| R228 | contract | `.agent/contracts/m5u10.md:49` | \| C8 \| Every predicate C2-C7 holds with an answer focus applied, where `expand` and `recenter` take their other branch \| the whole sweep runs twice | unknown | unknown |
| R229 | contract | `.agent/contracts/m5u10.md:50` | \| C9 \| Fallback — a bad `graphUrl` announces an alert naming the cause, and the retry control reloads to `ready` \| probe mounts on a 404 URL, reads | unknown | unknown |
| R230 | contract | `.agent/contracts/m5u10.md:51` | \| C10 \| Fallback — the graph palette set to `initial` before mount leaves `canvasError` naming every missing token, no renderer instance, and the HT | unknown | unknown |
| R231 | contract | `.agent/contracts/m5u10.md:52` | \| C11 \| C1-C10 hold at both devices \| the sweep runs at 1280x900 and 320x720 \| pass \| | unknown | unknown |
| R232 | contract | `.agent/contracts/m5u10.md:53` | \| C12 \| A campaign that graded nothing fails \| every count in the summary is required non-zero \| pass \| | unknown | unknown |
| R233 | contract | `.agent/contracts/m5u10.md:62` | \| C9 \| `graphUrl` pointed at a path the dev server does not serve \| the load path must reach `[role=alert]`; a silent `ready` fails \| | unknown | unknown |
| R234 | contract | `.agent/contracts/m5u10.md:63` | \| C10 \| every `--graph-*` token set to `initial` on the mount host \| `mountGraphCanvas` must throw and the component must keep the HTML view \| | unknown | unknown |
| R235 | contract | `.agent/contracts/m5u10b.md:31` | - **P1 terminal state.** After a run whose `ask()` rejects, `controller.state.kind` is `'settled'` and `state.result.kind` is `'error'`. The carried ` | unknown | unknown |
| R236 | contract | `.agent/contracts/m5u10b.md:35` | - **P2 no rejection escapes.** The promise returned by `run()` fulfils. A test that awaits it without a `catch` passes, and no `unhandledrejection` is | unknown | unknown |
| R237 | contract | `.agent/contracts/m5u10b.md:37` | - **P3 the view is not busy.** The answer region reports `aria-busy="false"`, the Cancel control is disabled, and Retry is present — the same renderin | unknown | unknown |
| R238 | contract | `.agent/contracts/m5u10b.md:40` | - **P4 the failure is announced.** The rendered error text is `TEXT.runFailed(code, message)` and the summary is `TEXT.runFailedSummary()`, in an elem | unknown | unknown |
| R239 | contract | `.agent/contracts/m5u10b.md:43` | - **P5 no poisoning.** A run started after a rejected run dispatches its own `ask()` and settles on its own result. At base `query = previous.query.th | unknown | unknown |
| R240 | contract | `.agent/contracts/m5u10b.md:46` | - **P6 a superseded rejection writes nothing.** When run A is superseded by run B and A's `ask()` then rejects, the state stays B's. The rejection arm | unknown | unknown |
| R241 | contract | `.agent/contracts/m5u10b.md:49` | - **P7 cancel after a rejection is inert.** `cancel()` called once the rejected run has settled fulfils and leaves `state.kind === 'settled'` — it nev | unknown | unknown |
| R242 | contract | `.agent/contracts/m5u10c.md:25` | - **G1 `binding:check` `REQUIRED`.** Literal `Object.freeze([…])`. Emptied, the inventory grades 0 while the controls still fire and the step prints ` | unknown | unknown |
| R243 | contract | `.agent/contracts/m5u10c.md:29` | - **G2 `engine:check` `CONTROLS`** (`tools/engine-check.mjs:61`). Literal four-object array. Emptied, no child control runs and an otherwise-green sum | unknown | unknown |
| R244 | contract | `.agent/contracts/m5u10c.md:32` | - **G3 `copy:check` `FILLER`** (`tools/copy-check.mjs:25`). Literal four-word array, passed only to the REAL English grade. Emptied, the controls surv | unknown | unknown |
| R245 | contract | `.agent/contracts/m5u10c.md:36` | - **G4 `secret:check` tree targets** (`tools/secret-check.mjs:54`, inline `['**/*']`). Emptied, secretlint 12.3.1 exits **2** with `Not found target f | unknown | unknown |
| R246 | contract | `.agent/contracts/m5u10c.md:41` | - **G5 `kb:asset-check` `SCAN_ROOTS`** (`tools/kb/check.mjs:16`). Point one root at a path that does not exist and `walk()` returns `[]` for it (`:60` | unknown | unknown |
| R247 | contract | `.agent/contracts/m5u10c.md:45` | - **C7 `PREPOSITIONS` owner** (`tools/kb/clinical.mjs:102`, a 13-token complement grammar). Read only by `splitComplement` (`:126`, `:133`); drift rep | unknown | unknown |
| R248 | contract | `.agent/contracts/m5u10c.md:52` | - **C8 `SEPARATION_PX` owner** (`tools/graph-probe/probe.ts:134`, value 3). Sole cutoff in `distinct()` (`:136-143`) for R1 midpoint collisions; the r | unknown | unknown |
| R249 | contract | `.agent/contracts/m5u10c.md:79` | \| G1 \| `REQUIRED` \| 1 \| `the REQUIRED table is empty, so it grades no case` \| | unknown | unknown |
| R250 | contract | `.agent/contracts/m5u10c.md:80` | \| G2 \| `CONTROLS` \| 1 \| `CONTROLS table is empty, so no engine control can fire` \| | unknown | unknown |
| R251 | contract | `.agent/contracts/m5u10c.md:81` | \| G3 \| `FILLER` \| 1 \| `FILLER table is empty, so the English register grades no banned word` \| | unknown | unknown |
| R252 | contract | `.agent/contracts/m5u10c.md:82` | \| G4 \| `TREE_TARGETS` \| 1 \| `TREE_TARGETS table is empty, so secretlint has no working-tree target` \| | unknown | unknown |
| R253 | contract | `.agent/contracts/m5u10c.md:83` | \| G5 \| `SCAN_ROOTS` \| 1 \| `SCAN_ROOTS entry "zz-missing-scan-root" yielded no paths` \| | unknown | unknown |
| R254 | contract | `.agent/contracts/m5u10c.md:84` | \| C7 \| `PREPOSITIONS` \| 1 \| `clinicalGrammar` `aecf97b1fe03` → `4d083a2e3904`, on `with` removed \| | unknown | unknown |
| R255 | contract | `.agent/contracts/m5u10c.md:85` | \| C8 \| `SEPARATION_PX` \| 1 \| `midpoint separation cutoff is 0 px, expected 3`; boundary `2/2`, expected `1/2` \| | unknown | unknown |
| R256 | contract | `.agent/contracts/m5u11.md:78` | - **S2 needs NO new export.** `deriveSemanticGraph(files, parsedClauses = parseClauseSites(files))` references `files` in its DEFAULT PARAMETER ONLY — | unknown | unknown |
| R257 | contract | `.agent/contracts/m5u11.md:83` | - **S7 = `validateSemanticGraphAsset(model)`**, exported from `tools/kb/graph.mjs`, returning `string[]`: empty = clean, and each entry NAMES the offe | unknown | unknown |
| R258 | contract | `.agent/contracts/m5u11.md:90` | - **S1 census.** The emitted `scopes` table represents **1,263** operator contexts, of which **156** carry `-` (negation) and **857** carry `should`.  | unknown | unknown |
| R259 | contract | `.agent/contracts/m5u11.md:94` | - **S2 ordered scope.** Every scope record preserves its outer context as an ORDERED sequence, not a set. Two edges whose contexts share members in a  | unknown | unknown |
| R260 | contract | `.agent/contracts/m5u11.md:102` | - **S3 edge linkage — ONE-WAY, user-ruled.** Every operator-bearing edge references exactly one scope record and every `edge.scope` index resolves. An | unknown | unknown |
| R261 | contract | `.agent/contracts/m5u11.md:116` | - **S4 no new node kind.** `stats.byNodeKind` gains no key. Scope rides the EDGES — user ruling, `.claude/rules/graph.md`: no `operator-context` node  | unknown | unknown |
| R262 | contract | `.agent/contracts/m5u11.md:118` | - **S5 budget.** The emitted asset, compressed by node `zlib.gzipSync` at **default options**, is at most **508,572 B** — today's 325,989 B plus the r | unknown | unknown |
| R263 | contract | `.agent/contracts/m5u11.md:122` | - **S6 versioned.** `GRAPH_SCHEMA_VERSION` rises 1 → 2 in the producer and the reader together, and a reader pinned to version 1 refuses the new asset | unknown | unknown |
| R264 | contract | `.agent/contracts/m5u11.md:127` | - **S7 structural validator.** One validator grades the emitted asset's shape — every scope record well-formed, every reference resolvable, every coun | unknown | unknown |
| R265 | contract | `.agent/contracts/m5u11.md:173` | \| S1 \| RED \| `semantic graph scopes table is missing` \| | unknown | unknown |
| R266 | contract | `.agent/contracts/m5u11.md:174` | \| S2 \| RED \| `constructed semantic graph scopes table is missing` \| | unknown | unknown |
| R267 | contract | `.agent/contracts/m5u11.md:175` | \| S3 \| RED \| `operator edge edge:25:0 must reference exactly one scope index` \| | unknown | unknown |
| R268 | contract | `.agent/contracts/m5u11.md:176` | \| S4 \| base-GREEN, declared \| `byNodeKind` is already the five existing kinds; the no-new-key bound passes vacuously \| | unknown | unknown |
| R269 | contract | `.agent/contracts/m5u11.md:177` | \| S5 \| base-GREEN, declared \| 325,989 B ≤ 508,572 B before scopes ship \| | unknown | unknown |
| R270 | contract | `.agent/contracts/m5u11.md:178` | \| S6 \| RED \| `semantic graph producer schema 1, expected 2` \| | unknown | unknown |
| R271 | contract | `.agent/contracts/m5u11.md:179` | \| S7 \| RED \| `semantic graph structural validator export is missing` \| | unknown | unknown |
| R272 | contract | `.agent/contracts/m5u12.md:49` | - **P1 parse.** `parseSemanticGraph` accepts the v2 asset's `scopes` table and `parseEdge` preserves `edge.scope`, both validated at the boundary the  | unknown | unknown |
| R273 | contract | `.agent/contracts/m5u12.md:53` | - **P2 ordered scope survives projection.** Every projected edge preserves its relation AND its ordered scope. Grouping and dedup key on the scope seq | unknown | unknown |
| R274 | contract | `.agent/contracts/m5u12.md:56` | - **P3 the six in-scope review reds go GREEN.** `tests/graph-semantics.review.test.ts` merges into the primary tree from branch `wt/rev-sem-2` and the | unknown | unknown |
| R275 | contract | `.agent/contracts/m5u12.md:58` | - **P4 the two accepted-open reds are measured, then FIXED.** User ruling: u12 closes S9 and S13+ rather than shipping them red or xfailed, because `b | unknown | unknown |
| R276 | contract | `.agent/contracts/m5u12.md:63` | - **P5 no `operator-context` node in the concept view.** The user ruling holds after the change: scope rides the edges. `CONCEPT_NODE_KINDS` gains no  | unknown | unknown |
| R277 | contract | `.agent/contracts/m5u12.md:65` | - **P6 fail-closed at the boundary, not silently in the projection.** Whatever the projection cannot represent is refused where it is read, never drop | unknown | unknown |
| R278 | contract | `.agent/contracts/m5u12.md:68` | - **P7 S9 — the headline counts what it names.** The concept view's headline calls its node total "concepts/actions" while value/attribute nodes sit i | unknown | unknown |
| R279 | contract | `.agent/contracts/m5u12.md:75` | - **P8 S13+ — predicate-role validity is refused at the boundary.** `parseEdge` refuses an edge whose source violates its predicate's role rule (an ar | unknown | unknown |
| R280 | contract | `.agent/contracts/m5u13.md:140` | - **V1 one seam.** `EdgeView` exists with exactly the declared shape, is produced once, and is what both renderers read. `model.ts` keeps ZERO imports | unknown | unknown |
| R281 | contract | `.agent/contracts/m5u13.md:143` | - **V2 the canvas shows scope.** A shown edge label is exactly `relation` + ordered `scope` — never a substring, never reordered (R2) — and `dashed` i | unknown | unknown |
| R282 | contract | `.agent/contracts/m5u13.md:146` | - **V3 the fallback shows scope.** The HTML relation view carries the same relation + ordered scope for the same edge, including the reversed reading  | unknown | unknown |
| R283 | contract | `.agent/contracts/m5u13.md:149` | - **V4 the conjunction is graded WHOLE against the shipped renderer.** `pnpm graph:check` runs R1–R7 over its 14 fixtures × 2 viewports AND C1–C12 ove | unknown | unknown |
| R284 | contract | `.agent/contracts/m5u13.md:154` | - **V5 `graph:check` terminates on its own.** The campaign completes both readings and both summaries, then hangs; `test-owners` killed it at 600 s (r | unknown | unknown |
| R285 | contract | `.agent/contracts/m5u13.md:161` | - **V6 a spanning edge shows BOTH endpoint scopes. USER-RULED.** Measured independently by `prod-view` and `orc-view`, agreeing: **736 of 751 synthesi | unknown | unknown |
| R286 | contract | `.agent/contracts/m5u13.md:179` | - **V7 no silent loss, at the renderer this time.** Whatever a view cannot show is disclosed or refused where it is dropped. u12's P6 bound the model; | unknown | unknown |
| R287 | contract | `.agent/contracts/m5u13.md:206` | - **V8 the accepted surfaces are untouched.** The graph's LOOK is open to change by user ruling; answer panel, ladder, combobox, theme, type and copy  | unknown | unknown |
| R288 | contract | `.agent/contracts/m5u13.md:273` | - **V2 admitted `label: null`.** `{relation:'condition supports', scope:['should'], label:null}` satisfied "every shown label is exact" while the moda | unknown | unknown |
| R289 | contract | `.agent/contracts/m5u13.md:279` | - **V3 could certify a partial reading.** A model-derived expected value reproduces the model's own defect: `edge:512:12` renders `supported by condit | unknown | unknown |
| R290 | contract | `.agent/contracts/m5u13.md:283` | - **V4 covers 66 of 333 affected spanning groups.** The 12 answer fixtures plus `worst-bounded` reach 66; 267 can regress unread. First uncovered: `ed | unknown | unknown |
| R291 | contract | `.agent/contracts/m5u13.md:289` | - **V6 named no all-asset inventory.** A check covering `edge:512:12` alone satisfied the named witness while 332 other affected groups survived. Rule | unknown | unknown |
| R292 | contract | `.agent/contracts/m5u3.md:44` | \| A1 \| All 12 answers derive: `clinical_advice(Q,S,A)` yields exactly 12 solutions over the shipped image \| live query, node project \| | unknown | unknown |
| R293 | contract | `.agent/contracts/m5u3.md:45` | \| A2 \| Every derived `Answer` is byte-identical to u1's `artifacts.answers` oracle, in raw contribution order \| rendered-term compare, 12/12 \| | unknown | unknown |
| R294 | contract | `.agent/contracts/m5u3.md:46` | \| A3 \| Every derived `Source` is byte-identical to the retired fact's `SourceId` \| same \| | unknown | unknown |
| R295 | contract | `.agent/contracts/m5u3.md:47` | \| A4 \| Zero `clinical_advice/3` **facts** remain in the payload; the only clause is the rule \| helper-source scan \| | unknown | unknown |
| R296 | contract | `.agent/contracts/m5u3.md:48` | \| A5 \| `clinical_advice/3` is **static**: `assertz(clinical_advice(…))` raises a permission error \| live `catch/3` inside Prolog \| | unknown | unknown |
| R297 | contract | `.agent/contracts/m5u3.md:49` | \| A6 \| All 48 sentences participate — withholding any one document's premises drops exactly that document's answer \| premise-erasure control, 12→11 | unknown | unknown |
| R298 | contract | `.agent/contracts/m5u3.md:50` | \| A7 \| Erasing any one of the 686 cited clause lines fails its sentence and therefore its document's answer \| reuses u2's 686-site campaign shape,  | unknown | unknown |
| R299 | contract | `.agent/contracts/m5u3.md:51` | \| A8 \| The 38 group terms reassemble in Prolog exactly as u1 reassembles them in JS \| differential over 12 documents \| | unknown | unknown |
| R300 | contract | `.agent/contracts/m5u3.md:52` | \| A9 \| `pnpm gate` rc 0, and the answer bytes reaching the browser are unchanged \| gate + `serializeAnswer` compare \| | unknown | unknown |
| R301 | contract | `.agent/contracts/m5u3.md:53` | \| A10 \| An answer is all-or-nothing: a document with any underivable sentence yields NO answer, never a truncated one \| A6's control, which found t | unknown | unknown |
| R302 | contract | `.agent/contracts/m5u4.md:65` | \| B1 \| The image emits ZERO `clinical_advice_source/4` clauses and zero `advice_nodes/2` clauses \| helper + proof-source scan \| | unknown | unknown |
| R303 | contract | `.agent/contracts/m5u4.md:66` | \| B2 \| Each of the 12 proofs is the concatenation of its document's per-sentence `clinical_derive/4` proofs, in gate order \| live compare against ` | unknown | unknown |
| R304 | contract | `.agent/contracts/m5u4.md:67` | \| B3 \| Every `clause` step names a line that resolves to a real compiled clause whose stored head unifies with the step head \| `clause/3` + `clause | unknown | unknown |
| R305 | contract | `.agent/contracts/m5u4.md:68` | \| B4 \| Every `clause` step's line is in its sentence's `clinical_gate/4` line list; the union over a document equals that document's cited-line set  | unknown | unknown |
| R306 | contract | `.agent/contracts/m5u4.md:69` | \| B5 \| Erasing any cited clause line changes the proof: the document's answer stops deriving \| site-erasure control, sampled over documents \| | unknown | unknown |
| R307 | contract | `.agent/contracts/m5u4.md:70` | \| B6 \| Assumption steps carry no line and their heads are exactly the document's `clinical_premise/4` literals \| live compare, 0 extras \| | unknown | unknown |
| R308 | contract | `.agent/contracts/m5u4.md:71` | \| B7 \| The proof is not fabricated from the answer: constraining `clinical_advice/3` to a WRONG answer term yields no proof \| live negative control | unknown | unknown |
| R309 | contract | `.agent/contracts/m5u4.md:72` | \| B8 \| `limit`, `cancelled`, `failure` and `error` stay distinct proof outcomes \| session tests, unchanged surface \| | unknown | unknown |
| R310 | contract | `.agent/contracts/m5u4.md:73` | \| B9 \| The whole selected proof runs inside `PROOF_BUDGET_MAX` (1000 ms, 100000 inferences) \| live timing over all 12 \| | unknown | unknown |
| R311 | contract | `.agent/contracts/m5u4.md:74` | \| B10 \| `pnpm gate` rc 0 \| gate \| | unknown | unknown |
| R312 | contract | `.agent/contracts/m5u5.md:50` | \| C1 \| The rendered premise list is the derivation's DISTINCT assumed literals in first-appearance order, no repeats \| dom test over a fixture carr | unknown | unknown |
| R313 | contract | `.agent/contracts/m5u5.md:51` | \| C2 \| Every premise row shows the hypothetical badge and renders no line text \| dom test, both locales \| | unknown | unknown |
| R314 | contract | `.agent/contracts/m5u5.md:52` | \| C3 \| A negation renders with its own badge, never the premise badge \| dom test \| | unknown | unknown |
| R315 | contract | `.agent/contracts/m5u5.md:53` | \| C4 \| The clause list and the graph-focus line set stay clause-only under a proof carrying all three arms \| dom test asserts the `lines` payload \ | unknown | unknown |
| R316 | contract | `.agent/contracts/m5u5.md:54` | \| C5 \| `limit`, `cancelled`, `failure`, `error` and `unavailable` still render their own summary and no rungs \| dom test, existing cases \| | unknown | unknown |
| R317 | contract | `.agent/contracts/m5u5.md:55` | \| C6 \| The ladder `<ol>` still has the same rungs and the same summary \| dom test counts `<ol> > li` \| | unknown | unknown |
| R318 | contract | `.agent/contracts/m5u5.md:56` | \| C7 \| Both locales render every new string; `copy:check` key parity holds \| `copy:check` + dom test \| | unknown | unknown |
| R319 | contract | `.agent/contracts/m5u5.md:57` | \| C8 \| `presentation:check` grades the ladder's engine-text selectors \| gate step, new rows \| | unknown | unknown |
| R320 | contract | `.agent/contracts/m5u5.md:58` | \| C9 \| axe reports no violation with the proof and premise disclosures open \| dom axe sweep \| | unknown | unknown |
| R321 | contract | `.agent/contracts/m5u5.md:59` | \| C10 \| `pnpm gate` rc 0 \| gate \| | unknown | unknown |
| R322 | contract | `.agent/contracts/m5u6.md:51` | \| D1 \| The lane names exactly 4 exported ids and they equal the bag's `queries/pl/*.pl` set \| preflight, live \| | unknown | unknown |
| R323 | contract | `.agent/contracts/m5u6.md:52` | \| D2 \| A bag with a renamed or extra exported query is REFUSED with that id named \| mutant over the in-memory file map \| | unknown | unknown |
| R324 | contract | `.agent/contracts/m5u6.md:53` | \| D3 \| Every exported goal's live solutions byte-match `queries/answers/<id>.pl` \| live run, 4/4 \| | unknown | unknown |
| R325 | contract | `.agent/contracts/m5u6.md:54` | \| D4 \| The lane is GREEN on the shipped image at base \| gate step \| | unknown | unknown |
| R326 | contract | `.agent/contracts/m5u6.md:55` | \| D5 \| The lane goes RED when a payload dependency of an exported goal is removed \| erasure control \| | unknown | unknown |
| R327 | contract | `.agent/contracts/m5u6.md:56` | \| D6 \| Deleting the lane, or skipping it, fails `pnpm gate` \| gate-mutant control \| | unknown | unknown |
| R328 | contract | `.agent/contracts/m5u6.md:57` | \| D7 \| The lane compiles nothing new into the PVM: the image bytes are unchanged \| `kb:build` output compare \| | unknown | unknown |
| R329 | contract | `.agent/contracts/m5u6.md:58` | \| D8 \| `.claude/rules/kb-build.md` `## Question catalog` describes the shipped design \| consistency pass \| | unknown | unknown |
| R330 | contract | `.agent/contracts/m5u6.md:59` | \| D9 \| `pnpm gate` rc 0 \| gate \| | unknown | unknown |
| R331 | contract | `.agent/contracts/m5u7.md:58` | \| E1 \| An additive `guideline_*` overlay supplying a whole new proof changes the live export-lane statement and adds its marker solution \| live ove | unknown | unknown |
| R332 | contract | `.agent/contracts/m5u7.md:59` | \| E2 \| Erasing one cited `guideline_*` clause drops exactly that document from the answer set and turns its proof to `failure`; the unmutated sessio | unknown | unknown |
| R333 | contract | `.agent/contracts/m5u7.md:60` | \| E3 \| Relocating a cited `guideline_*` clause leaves the answer byte-identical and moves the line-keyed proof \| live relocate, same session \| | unknown | unknown |
| R334 | contract | `.agent/contracts/m5u7.md:61` | \| E4 \| Both negative controls hold at their recorded grain \| inventory names `clinical-inference` P5 \| | unknown | unknown |
| R335 | contract | `.agent/contracts/m5u7.md:62` | \| E5 \| The 686-site campaign is exhaustive: 686 erasures, 0 survivors \| inventory names `clinical-inference` P4 \| | unknown | unknown |
| R336 | contract | `.agent/contracts/m5u7.md:63` | \| E6 \| Every declared required case ran and PASSED in the gate's own suite run \| `binding:check` \| | unknown | unknown |
| R337 | contract | `.agent/contracts/m5u7.md:64` | \| E7 \| Deleting a required suite, renaming a required case, or skipping one each fails `pnpm gate` \| three gate-mutant controls \| | unknown | unknown |
| R338 | contract | `.agent/contracts/m5u7.md:65` | \| E8 \| Missing image, failed consult and nonterminal solve each have a named required case \| inventory rows, live \| | unknown | unknown |
| R339 | contract | `.agent/contracts/m5u7.md:66` | \| E9 \| The browser's rendered canonical answer equals bytes derived independently in Node from the bag \| `browser:check` \| | unknown | unknown |
| R340 | contract | `.agent/contracts/m5u7.md:67` | \| E10 \| Each of C2's five retired classes is restored naming its check, or carries a rationale \| disposition table below \| | unknown | unknown |
| R341 | contract | `.agent/contracts/m5u7.md:68` | \| E11 \| The clinical binding checks are RED at `a944fca` and GREEN at HEAD \| replay in a worktree \| | unknown | unknown |
| R342 | contract | `.agent/contracts/m5u7.md:69` | \| E12 \| `pnpm gate` rc 0 \| gate \| | unknown | unknown |
| R343 | contract | `.agent/contracts/m5u7.md:89` | \| E6 \| `binding:check ok — 29 required binding cases passed across 10 suites` \| | unknown | unknown |
| R344 | contract | `.agent/contracts/m5u7.md:90` | \| E7 \| rc 1 each: required suite deleted (`never ran`), T15 renamed (`names 0 cases`), T2 skipped (`skipped`) \| | unknown | unknown |
| R345 | contract | `.agent/contracts/m5u7.md:91` | \| E9 \| `browser:check` rc 0 — `when-to-use-opioids` rendered the bag's 2-row 2,899 B canonical answer byte for byte in English and in Japanese, at 3 | unknown | unknown |
| R346 | contract | `.agent/contracts/m5u7.md:92` | \| E11 \| `pnpm binding:replay` rc 0 — erasing `cdc2022-opioid-rec01` line 496 leaves all 12 answer documents at `a944fca` and drops exactly that one  | unknown | unknown |
| R347 | contract | `.agent/contracts/m5u7.md:93` | \| E12 \| `pnpm gate` rc 0 \| | unknown | unknown |
| R348 | contract | `.agent/contracts/m5u8.md:128` | \| R1 \| Two edges between the same ordered node pair render as distinguishable curves \| probe counts separated pairs; the fixtures above give 9 / 6  | unknown | unknown |
| R349 | contract | `.agent/contracts/m5u8.md:129` | \| R2 \| A shown edge label is exactly `relation` + the reader's NEAR end + the reader's FAR end, in that order — never a substring, never reordered,  | unknown | unknown |
| R350 | contract | `.agent/contracts/m5u8.md:130` | \| R3 \| Selection changes `state` for no edge; the proof highlight is the only writer of `highlight` \| select a node, diff the highlighted-edge set  | unknown | unknown |
| R351 | contract | `.agent/contracts/m5u8.md:131` | \| R4 \| `dashed` is per-edge and carries scope polarity alone \| set one edge dashed, diff the canvas, restore, compare bytes \| | unknown | unknown |
| R352 | contract | `.agent/contracts/m5u8.md:132` | \| R5 \| A node label at the settled zoom is at least the measured floor, on every fixture and viewport \| probe reads `10 × zoom` against the floor \ | unknown | unknown |
| R353 | contract | `.agent/contracts/m5u8.md:133` | \| R6 \| The seam stays `mountGraphCanvas(container, onSelect) → {update, recenter, destroy}` and `model.ts` keeps zero imports \| `rg` census, as in  | unknown | unknown |
| R354 | contract | `.agent/contracts/m5u8.md:134` | \| R7 \| A node label is fully readable — wrapped, never ellipsis-truncated \| probe asserts no `…` in rendered label text \| | unknown | unknown |
| R355 | contract | `.agent/contracts/m5u8.md:140` | \| E1 \| The spike measures all 12 contribution views \| sweep, `n=12` per arm per viewport \| pass \| | unknown | unknown |
| R356 | contract | `.agent/contracts/m5u8.md:141` | \| E2 \| …plus the worst bounded view and an opposite-scope parallel fixture \| `worst-bounded`, `parallel-opposite` rows \| pass \| | unknown | unknown |
| R357 | contract | `.agent/contracts/m5u8.md:142` | \| E3 \| …at both viewports, light and dark \| sweep at 1152×558 + 296×384; shots in both themes \| pass \| | unknown | unknown |
| R358 | contract | `.agent/contracts/m5u8.md:143` | \| E4 \| Capability 1 (parallel separation) carries a measured verdict \| table above \| pass \| | unknown | unknown |
| R359 | contract | `.agent/contracts/m5u8.md:144` | \| E5 \| Capability 2 (`drawThreshold`) carries a measured verdict \| table above, with a `drawThreshold:100` positive control \| pass \| | unknown | unknown |
| R360 | contract | `.agent/contracts/m5u8.md:145` | \| E6 \| Capability 3 (`selectNodes` isolation) carries a measured verdict \| table above \| pass \| | unknown | unknown |
| R361 | contract | `.agent/contracts/m5u8.md:146` | \| E7 \| Capability 4 (per-edge dashes) carries a measured verdict \| table above \| pass \| | unknown | unknown |
| R362 | contract | `.agent/contracts/m5u8.md:147` | \| E8 \| Capability 5 (bundle delta, six peers resolved) carries a measured verdict \| two single-entry `vite build --lib` runs \| pass \| | unknown | unknown |
| R363 | contract | `.agent/contracts/m5u8.md:148` | \| E9 \| The renderer choice is committed \| this file, `.claude/rules/graph.md` \| pass \| | unknown | unknown |
| R364 | contract | `.agent/contracts/m5u8.md:149` | \| E10 \| The edge-view contract is committed \| R1–R7 above \| pass \| | unknown | unknown |
| R365 | contract | `.agent/contracts/m5u8.md:150` | \| E11 \| Rejecting vis leaves no trace in the dependency set \| `pnpm remove vis-network`; `git diff --stat` empty \| pass \| | unknown | unknown |
| R366 | contract | `.agent/contracts/m5u9.md:98` | \| F1 \| R1: every parallel pair renders as distinguishable curves \| 34/34 over 28 views \| pass \| | unknown | unknown |
| R367 | contract | `.agent/contracts/m5u9.md:99` | \| F2 \| R2: a shown edge label is exactly `graphRelationLabel`, and only the proof path shows one \| per-edge compare against the model \| pass \| | unknown | unknown |
| R368 | contract | `.agent/contracts/m5u9.md:100` | \| F3 \| R3: no element can be selected, and a tap moves the app's selection without moving the highlight \| `:selected` empty, highlight set equal ac | unknown | unknown |
| R369 | contract | `.agent/contracts/m5u9.md:101` | \| F4 \| R4: `line-style` is per-edge, and no edge dashes yet \| 0 → 1 → 0 control per viewport \| pass \| | unknown | unknown |
| R370 | contract | `.agent/contracts/m5u9.md:102` | \| F5 \| R5: a settled node label is at least 11 px \| 11.00-24.38 px over 28 views \| pass \| | unknown | unknown |
| R371 | contract | `.agent/contracts/m5u9.md:103` | \| F6 \| R6: the seam holds — three files name no renderer, `model.ts` imports nothing, the mount signature is unmoved \| source census \| pass \| | unknown | unknown |
| R372 | contract | `.agent/contracts/m5u9.md:104` | \| F7 \| R7: every node label renders wrapped and whole \| 690/690 labels, wrap mode `wrap` alone \| pass \| | unknown | unknown |
| R373 | contract | `.agent/contracts/m5u9.md:105` | \| F8 \| The probe reddens when each rule is broken \| four controls, `canvas.ts` restored byte-identical after each \| pass \| | unknown | unknown |
| R374 | contract | `.agent/contracts/m5u9.md:106` | \| F9 \| `pnpm gate` rc 0 \| gate \| pass \| | unknown | unknown |
| R375 | contract | `.agent/contracts/m5u9.md:107` | \| F10 \| The app still activates the graph and answers in both locales \| `pnpm browser:check` rc 0 \| pass \| | unknown | unknown |
<!-- rows -->