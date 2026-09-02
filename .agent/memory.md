# memory

Cross-session context beyond code/docs/git. Keep minimal.

## Stack (user-ruled; all three recommendations accepted)

- Runtime = **static site + SWI-Prolog WASM**, `swipl-wasm` 8.0.7 = SWI-Prolog
  10.1.13 in-browser. No server, no `swipl` install, deploys as static files.
  Free-text intake stays reachable later because APE is itself Prolog and loads
  into the same engine.
- Frontend = **Svelte 5** (5.57.0) + **Vite** (8.2.2) + TypeScript (5.9.3).
  Runes express the demo's real state (selected question, run status, chosen
  solution, focused trace node, graph selection); single-file components read
  well for agents.
- Entity graph = **Cytoscape.js** (3.34.2). ~1K nodes = analysis tier, not
  scale tier → layouts (fcose/cose-bilkent/dagre) + neighborhood expansion,
  shortest path and centrality matter more than a WebGL renderer.

Rejected: server-backed Python+native swipl, hybrid (runtime); SolidJS, vanilla
TS (frontend); Sigma.js+graphology, vis-network (graph).

## Install constraints (already encoded; do not re-derive)

- `typescript-eslint` stable caps at TypeScript <6.1 → TypeScript pinned to 5.x.
  Installing TS 7 breaks `pnpm lint`.
- `@types/cytoscape` is deprecated; `cytoscape` ships its own types → the types
  package must stay uninstalled.
- ESLint config needs `@types/node`, and svelte parsing needs
  `extraFileExtensions` — both wired.
- Prettier reformats `.claude/` + `.serena/` tool-owned files if unscoped →
  `.prettierignore` restricts it to first-party source. Keep that scoping.

## Gate

Single chain, `package.json` scripts:

```
pnpm gate = pnpm kb:build && pnpm kb:asset-check && pnpm format:check && pnpm lint && pnpm check && pnpm test && pnpm build
```

`kb:build` subsumes the old `kb:verify` (it proves the bag against its sidecar
before parsing). `kb:reproduce` stays OUT of the chain — two forced builds cost
10.5s — and is the rerunnable check behind the byte-reproducibility claim.
Last clean-cache run (`rm -rf kb/generated && pnpm gate`): **rc=0**, 13.9s;
svelte-check 319 files 0 errors; vitest 3 files / 38 tests; vite 112 modules.

`kb:asset-check`'s sibling-path scan matches `../cnl-ckc` only at a name
boundary — this project's own `cnl-ckc-demo` shares that prefix and must not
trip it.

Build scripts are `tools/**/*.mjs`, JSDoc-typed under `allowJs`+`checkJs`. No TS
runner is installed and none is needed: `svelte-check` type-checks `.mjs`,
ESLint applies type-aware rules to it (`.mjs` escapes the `**/*.js` →
`disableTypeChecked` override), and the gate executes the scripts for real.

## Knowledge base

- Vendored bag = `kb/cnl-ckc-kb-g952cc950a0c6.tar.gz` (1.48 MB, 1047 members)
  + `.sha256` sidecar. BagIt 1.0; verify = `pnpm kb:build` (in-memory, never
  extracts). 1041 payload + 5 tag entries + the tagmanifest = 1047.
- Archive dialect: POSIX ustar magic (`ustar\0` + `00`) that ALSO carries five
  GNU `././@LongLink` (`L`) headers for names over 100 chars. A resolving parser
  (Python `tarfile.getmembers`) hides those pseudo-entries — a raw reader must
  handle `L` or it refuses the real bag. Single root dir, all members regular
  files, mode 0644, uid/gid 0, one mtime, gzip mtime field 0.
- Regenerate: `python3 -P tools/dist.py build <outdir>` run in
  `../cnl-ckc`, then copy the tarball + sidecar into `kb/`. That repo must be
  left clean.
- Bag name tags the **last commit touching `guidelines/`**
  (`952cc950a0c6`), not repo HEAD. Payload is current: the commits between it
  and cnl-ckc HEAD `5318671` touch only `tests/ui/`, `tools/ui.*` and
  `release-manifest.tsv`. Bag's own provenance = `meta head` row in its
  `release-manifest.tsv`.
- Payload: 337 docs × 3 representations — `ace/` (source ACE), `pl/` (compiled
  Prolog, schema v1), `align/` (source↔ACE alignment, backs the trace view) —
  plus `queries/` (4 `.ace` questions, `pl/` compiled goals, `answers/`
  expected solutions, `traces/`), `source/`, `audit/`.
- Rights profile = `redistributable` (public-domain MMWR) → source passages may
  ship whole in the UI.
- Bag records `swipl 9.2.9` as the compiler; the 10.1.13 WASM runtime loads it
  fine (proven below).

## Generated runtime payload (u1)

- `pnpm kb:build` → `kb/generated/{kb.pvm,kb.qlf,kb-manifest.json}`, gitignored.
  Input = the 337 `pl/` payload files, sorted, joined with `% file:<path>`
  markers; the manifest records that concatenation's sha256 as the build input.
- **Byte-reproducible.** `qsave_program` writes a ZIP whose entry timestamps and
  whose embedded `state.qlf` source mtime both come from wall-clock reads.
  Pinning `Date.now` for the build phase (`withPinnedClock`) makes two forced
  builds byte-identical: `pnpm kb:reproduce` → pvm `3ae8d455d875`, qlf
  `62bc61cc7d0e`. Without the pin only ~4 bytes differ, but deflate amplifies
  them to ~389K differing bytes.
- Sizes: pvm 437132 B, qlf 2168708 B. Live load, measured outside vitest: image
  121 ms, qlf 238 ms, both schema 1 / 337 documents / SWI 10.1.13.
- Engine split: building needs `swipl-bundle` (6243055 B, carries the library);
  loading a saved state needs `swipl-bundle-no-data` (2616873 B). The QLF
  fallback cannot use the small engine, so choosing it costs the 6.2 MB bundle
  plus a 2.2 MB artifact against 2.6 MB + 0.44 MB — the fallback is insurance
  against image-format rot, never a size win.
- Do NOT use `generateImageBuffer`: it saves without checking the consult result
  and without capturing stderr, so a broken payload still yields an image.
  `tools/kb/produce.mjs` re-implements its four steps, asserts the contract
  inside the building engine, and fails closed on any diagnostic. `qsave_program`
  legitimately emits two `library(shlib)` warnings under WASM; that pair is the
  only tolerated noise, and it is tolerated at image load alone — the same text
  drained from a runtime consult is fatal and poisons its engine.
- All 9 schema predicates are multifile and **static** (dynamic=false). Clause
  counts: version 337, document 337, entity 1834, cardinality 1834, event 1254,
  arg 2513, pp 1003, property 16, operator 1193. A direct `assertz` raises a
  permission error → u4's overlay probe must call `dynamic/1` first; the overlay
  is visible to queries and gone after a fresh image load.

## Engine runtime (u2)

- Term boundary = JS-side decode INSIDE the worker. Native values never reach the
  protocol boundary and never re-enter a query; re-encoding rebuilds through the
  engine's own `Compound`/`List`/`Rational`/`String`/`Var` constructors.
- `JSON.stringify` over an engine value is the one measured corruption path:
  `'$guideline_id'/5` re-enters as arity 1 with `ref([1])`, and `1r3` serializes
  as `3r1`. Production code must never do it.
- Wrapper ABI (undocumented, read off the package): `$t:'s'` string, `'r'`
  rational, `'v'` variable, `'l'` improper list, `'t'` compound whose args sit in
  a ONE-ELEMENT envelope at `value[value.functor][0]`; `$tag` dicts. An
  unrecognized tag fails closed.
- A malformed goal yields NO solution rather than raising, so a zero-answer run
  and a broken goal are indistinguishable without a parse guard. `solve` parses
  the goal via `term_string/2` first.
- Integral floats decode as `integer`: SWI's `1.0` and `1` both arrive as JS `1`.
  The corpus has no floats.
- Display text = `term_string/3` with `[quoted(true),numbervars(true),ignore_ops(true)]`,
  which matched `write_canonical` on all 7 real answers at 0.0437 ms/binding.
  `print_message` renders `Unknown message:` and is diagnostic-only.
- Vite wiring: alias `@kb` → `kb/generated`, `base:'./'`, `worker.format:'es'`,
  `cacheDir:'.vite'`. The literal `new Worker(new URL('./worker.ts', import.meta.url),
  {type:'module'})` form is what makes Vite emit a separate worker bundle.
- `cacheDir` must resolve against the project root: worktrees reach the toolchain
  through a `node_modules` symlink, so the default `node_modules/.vite` is ONE
  physical directory shared by every tree. `.gitignore` spells `kb/generated`
  without a trailing slash for the same symlink reason.
- Node has no DOM `Worker`, so `EngineSession` holds the logic with an injected
  image loader and `worker.ts` is message plumbing only. Tests drive the session.
- Built output: main chunk carries 0 engine bytes; worker chunk plus a hashed
  `kb-<hash>.pvm` carry it. Gate rc=0 at 58 tests / 330 files.

## Budgets and cancellation (u3)

- Split enforcement: Prolog owns stack/depth/inference (`stack_limit` reducible
  1073741824 -> 8388608 B, catchable `error(resource_error(stack),stack_overflow{...})`
  in 0.681 ms; `depth_limit_exceeded`; `inference_limit_exceeded`), +0.346 ms / +0.30%.
- No in-Prolog wall clock: build reports `threads=false`; `library(time)` raises
  `existence_error(source_sink,library(time))`; `call_with_time_limit/2` and `alarm/4`
  raise procedure existence errors.
- Prolog limits do not bound a query: `repeat` under the full wrapper emitted 100000
  answers in 452.232 ms with `D=1`, `I=true`. The JS answer cap and deadline terminate it.
- `answer-cap` is reported only after the driver proves one solution past the cap and
  discards it: a run holding exactly `answerCap` answers is honest exhaustion and
  reports `solutions`. Hitting the cap therefore costs one extra solution step.
- A worker timer cannot fire inside a synchronous step: in-worker 25 ms never fired
  across 249.80 ms of `repeat,fail`; main-thread 25 ms fired at 25.97 ms. Hard deadline
  is main-thread only, at `wallClockMs + 500 ms`.
- `solve` yields a MACROTASK between solutions; a microtask yield admits no posted
  message and cannot deliver a cancel. Granularity = 50.11 ms worst step over 80 sampled
  Node steps on the real KB — a sample maximum, never benchmarked per catalog goal and
  never measured in a browser (M1 review R40/R44). The 62.00 ms figure had no source.
- Production calls THREE undeclared `swipl-wasm` APIs, all load-bearing and all
  ruled acceptable at M1 review R26: `query[Symbol.iterator]()` and `query.close?()`
  (`common.d.ts` `Query` declares `next`/`once` alone) and the
  `Compound`/`List`/`Rational`/`String`/`Var` constructors off `prolog` (`Prolog`
  declares `call`/`forEach`/`query` alone). The package under-declares its own
  surface, so `swipl-wasm` stays exact-pinned and every version bump must re-verify
  these three against the shipped `.d.ts`.
- `Query.close()` is load-bearing and undeclared (`.d.ts` declares only `next`/`once`).
  Abandoning an iterator on a cap, cancel or deadline leaves the frame open and every
  later query returns `failure` — measured as 8 cascading failures before it was wired.
- Wrapper reserves `BudgetDepth_`, `BudgetInference_`, `BudgetResource_`; a goal naming
  one is rejected. Goals arrive as whole clauses, so the wrapper strips the trailing full
  stop; leaving it in yields a syntax error that reads as zero answers.
- Runtime `consult` fails OPEN on its result: syntax error and failing directive both
  return `bindings success:true`, throw nothing, leave clauses loaded. Only drained
  stderr (`printErr` + `on_output`) reveals it, and the engine is already dirty, so a
  diagnostic poisons the session rather than the request.
- Hard cancel: terminate 2.7-3.5 ms; terminate->respawn->boot 181.75-223.96 ms in Node.
  **In a real browser the same cycle costs 526.4-1732.5 ms, median 641.6 over 5/5 cycles**
  (M1 review R41) — the Node figure is not a browser figure, and any UI claim must use the
  browser one. Each cycle drops the overlay and re-reads 337 from the replacement engine.
  Post-termination worker CPU stays unmeasured.
- Heap exhaustion **in Node** returns typed `assertz/1: Not enough resources: no_memory`,
  no throw, no abort, ~2222464 KiB peak RSS; engine still answers but must be recreated.
  **In a browser it does not.** A runaway `assertz` loop aborts the WASM runtime after
  12088 ms and reaches the client as `{code:'prolog', message:'Aborted(). Build with
  -sASSERTIONS for more info.'}` — never `limit:'heap'`, so D9's heap-triggered
  recreation never runs there (M1 review R45, open `fail(high)`).
  `EngineClient.query` awaits that recreation on `limit:'heap'`, so a caller never sees
  a heap outcome before its replacement engine re-verified the contract. The wall-clock
  deadline fires its reset instead, because there the caller is already settled.

## Measured (do not re-measure)

- Corpus via SWI-Prolog, authoritative: **800 noun atoms, 127 verbs, 337 docs**,
  0.6s co-load. Graph sizing ≈ 1K nodes.
- Counting vocabulary, kept distinct: **9** schema predicates; **1,834** static
  `guideline_entity/4` clause sites (a regex sweep hits the same number by
  coincidence); **316** entity solutions derivable after co-load; **1,254**
  event clause sites vs **232** derivable. Runtime predicate calls expose only
  the derivable minority — the full graph needs static `clause/2` extraction.
- Explicit edge schemas = 7: `entity/4`, `cardinality/5`, `event/3`, `arg/4`,
  `pp/4`, `property/4`, `operator/3`, plus 9,053 Horn body→head edges.
- Corpus load, measured: 337-file consult **2806ms** · concatenated source
  3299ms · `load_string` 3578ms · QLF **213ms** + 724ms boot · **saved PVM
  335ms** boot+load (437,132 B; `kb:reproduce` runs two forced builds in 8.741s).
  PVM is the shipping form, QLF
  the fallback. Concatenated `pl/` = 4,716,517 B raw, **169,571 B** gzip-9.
- Production build at u7 = 14 files / **3,773,949 B** raw: worker 3,074,247 B +
  PVM 437,132 B + 6 woff2 176,732 B + licences. The pre-u7 figure was 3,500,973 B
  raw / 1,339,723 B gzip, before fonts and licences joined `dist/`. Re-measure
  this whole line whenever a unit adds a shipped asset class.
  No COOP/COEP needed. `loadImageDefault` uses
  direct `eval` → a strict CSP host is a live risk, owned by M4.
- Engine: unified stack limit 1GiB (reducible), Emscripten heap ceiling 2GiB,
  RSS ~119MB steady; asserted state persists across queries in one engine.
- Oracle fidelity: live WASM **byte-matches all four** committed
  `queries/answers/*.pl` — category-A 7 rows in order, then 158/158, 79/79 and
  3/3 bytes. `tests/questions-live.test.ts` compares each with `toBe` against the
  `result/1` argument read out of the verified bag at test time. Committed
  answers and traces are regression oracles only, never response data.
- Anti-hard-coding recipe: vitest 4 Node env, one non-parallel worker, real
  saved image, inject a PID-unique overlay clause, assert the answer changes,
  import no answer fixture. Measured 796ms.
- Committed trace artifacts carry **no** proof-dependency edges (all sampled
  clause nodes have empty child lists) → a proof tree drawn from them would be
  fabricated. M2 derives proofs from a live meta-interpreter instead: measured
  4.03–5.09s for all solutions vs 0.14–0.22s for the plain query.

## Upstream reuse (`../cnl-ckc`, read-only, never linked)

- `tools/ui.py` already resolves coverage rows to source payloads and renders
  click/hover-linked source↔ACE span groups; `parse_evidence`, `hl_parse_align`
  and its model joins are TypeScript-port specifications for M2. Its
  `tests/ui/` fixture corpus (15 green + 84 red case families) is the
  adversarial oracle for provenance joins and hostile input.
- `tools/dist.py build <dest>` stays the release boundary; `goal.py` compiles
  ACE questions upstream. Both are regeneration inputs, never runtime deps.
- No graph command or graph artifact exists upstream — M3 builds it here.

## Scratch conventions

- Artifacts a later mode dispatches from live in `.agent/contracts/`, committed;
  `.scratch/` is gitignored and holds working state alone. Three files there are
  still an open polish entry's acceptance-check source and must survive until it
  closes: `agents/map-m1u1.md`, `agents/spike-m1u1-det.md`, `validate-report.py`,
  `verify-fixes.py`. Everything else below this bullet is regenerable.
- `.scratch/verify-fixes.py` = the mutation runner behind the `fixed` ledger rows: each
  mutant restores one pre-fix behaviour, reruns that fix's closing test, and must print
  RED. 18 mutants, 18/18 RED. Restores every file it touches. Rerun =
  `python3 -P .scratch/verify-fixes.py`.
- The M1 review browser harness is `tools/probe-u3.mjs` on `wt/rev-m1u3-4` `48008d3`,
  derived from `tools/smoke.mjs`. `node tools/probe-u3.mjs <ROW>` drives built output in
  a real browser and backs R38/R39/R41/R42/R45. Not in the gate; copy it into `tools/`
  to re-run.
- `.scratch/kb/` = the vendored bag extracted for agent reading:
  `tar xzf kb/cnl-ckc-kb-*.tar.gz -C .scratch/ && ln -sfn cnl-ckc-kb-* .scratch/kb`.
- `.scratch/validate-report.py` grades wave reports (`--units N`, `--verdict`).
  Scratch-local encoding; port it into the repo when a durable claim depends
  on it. Report rows are `| id | finding | evidence |` — `--verdict` folds the
  verdict into the finding cell, which must open `pass:` or `fail(low|med|high):`.
  Grading needs a sibling `<stem>.ids`; a seeded all-`unknown` skeleton exits 1,
  which is what makes it a usable deliverable-first counter.
- MILESTONE-REVIEW ledger `.agent/review-m1.md` is HAND-MAINTAINED from here.
  `.scratch/{seed,build}-ledger.py` generated its first shape from the committed
  check sets and carry MAIN's session-1 rulings inline; both are scratch-local, so
  treat the committed ledger as the source and re-derive a generator only if a
  later session needs a bulk reshape.
- Worktree toolchain env = symlink the primary `node_modules` into the worktree.
  `.gitignore` therefore spells `node_modules` without a trailing slash, since
  the slash form matches directories only and leaves the symlink untracked.
- A watcher that greps a subagent transcript for its own marker self-matches the
  brief's copy of it. Match assistant text only:
  `jq -r 'select(.message.role=="assistant")|.message.content[]?|select(.type=="text")|.text' "$t" | rg -q MARKER`.
- Probe branches survive their worktrees: `wt/res-m1-1` (`36cc56f`, swipl-wasm
  load/worker/terms/trace/perf/test/errors/deploy probes) and `wt/res-m1-2`
  (`5863141`, cytoscape layout/perf/test, axe, contrast, combobox probes).

## Read-exclusion set

Synced pair: `.claude/settings.json` `permissions.deny` (full set) +
`.serena/project.yml` `ignored_paths` (committed, non-gitignored only).
Gitignored caches go to `permissions.deny` alone. Grows with the tree.

## Serena

`language_servers: ['svelte', 'typescript', 'markdown', 'json', 'yaml']`; all
five start (typescript 0.26s, json 0.43s, yaml 0.59s, markdown 1.59s, svelte
2.36s). `.serena/` is committed.

An ambiguous MCP tool alias (`no unique request-local match`) is session-fatal
and survives `/resume`; a new session clears it.

## Question catalog and answers (u4)

- Catalog is GENERATED, not transcribed: `tools/kb/catalog.mjs` parses the bag's
  `queries/pl/*.pl` in memory during `kb:build` and emits
  `kb/generated/question-catalog.json`; `kb:asset-check` re-derives it and fails on any
  mismatch. Generation median 0.631 ms, artifact ~3.3 kB. The rejected alternative —
  repo-source goals policed by a bag-divergence gate step — measured 1036.812 ms.
- `tools/kb/catalog.mjs` declares the four exported query ids in `EXPORTED` and refuses
  any bag whose exported set differs. Goal text stays derived; which questions exist is
  declared, because an extra or renamed query file otherwise enlarges the catalog with
  both catalog gate steps agreeing with themselves. A bag exporting a different question
  set must edit that list.
- Bag `queries/` = 4 ids × 4 files (`.ace`, `pl/`, `answers/`, `traces/`). **None of it is
  in the PVM**: `payloadSource`'s `PAYLOAD` regex admits `data/guidelines/*/pl/*.pl` only.
  Query goals therefore reach the engine from the catalog, never from the image.
- Goal grammar: `'$guideline_query_projection'(goal(G),answers(As))`, `G` in canonical
  prefix `','/2` form. `answer(Var,noun(N,countable)|wh(what))` names a projected column;
  `answers([])` = existence question → `yes`/`no`, not an empty row set.
- Repo-authored goals derive from an exported analog by ONE token-exact single-hit atom
  substitution. Substring replace is unsafe: the corpus carries `'category-B-decision'`,
  `'evidence-type-2-recommendation'` and `'evidence-type-4-recommendation'`.
  `'category-B-recommendation'` = 24 sites / 5 ground facts; `'evidence-type-3-recommendation'`
  = 3 sites, all ground.
- Live solution counts, all six: category-A 7, dosage-reduction 2, evidence-type-1 1,
  recommendation-exists 12 (renders `yes`), category-B 5, evidence-type-3 3.
- All four exported ids reproduce their committed `result/1` argument **byte for byte**,
  not merely value-equal. Live yield order already equals committed order, so the sort
  changes nothing on this corpus — it is there for order-independence, not for this data.
- Sort = SWI standard order over decoded `PlTerm`, never a byte sort of rendered text.
  The two diverge on mixed shapes (`10` precedes `'2'` numerically, follows it lexically).
  Lists order as their `'[|]'/2` chain; `[]` orders as an atom.
- Overlay probe: the category-A goal is a seven-way join, so ONE asserted fact cannot
  move it. A working overlay declares `guideline_entity/4`, `guideline_cardinality/5`,
  `guideline_event/3` and `guideline_arg/4` dynamic and supplies a whole new proof.
- `EngineSession.consult` needs `SessionOptions.drain`, which returns `string[]`. Without
  it the consult is refused, and `handle` reports that as an error response a test that
  ignores the return value will silently pass over.
- Forbidden-reach check = byte scan over `src`, `tools`, `vite.config.ts`, `index.html`
  in `kb:asset-check`. ESLint cannot do it: core `no-restricted-imports` visits import and
  export declarations only, so `import()` and `fs.readFile` escape it. `tests/` is out of
  scope on purpose — reading committed answers is what makes them oracles.
- `MANIFEST_VERSION` 2 adds the `catalog` block; the bump is what stops a cached
  manifest from lacking it. `kb:reproduce` now also proves catalog byte-identity
  (`a38e74d9f518`).

## Question intake (u5)

- DOM component tests = a second vitest project. `tests/**/*.dom.test.ts` runs under
  jsdom with `resolve.conditions: ['browser']`; without that condition svelte resolves
  to `index-server.js` and `mount` throws `lifecycle_function_unavailable`. The node
  project excludes the glob so swipl-wasm keeps its node entry.
- jsdom is pinned to 29.1.1. jsdom 30 pulls undici 8, which assigns
  `webidl.util.markAsUncloneable` from `node:worker_threads`; Node v20.19.2 does not
  export it, so the vitest fork dies before any test runs.
- axe-core 4.13.0 runs in that project. `color-contrast` always lands in `incomplete`
  because jsdom has no canvas, so contrast is u7's own check, not axe's.
- `svelte-check --fail-on-warnings` is the ONLY a11y linter here: `eslint-plugin-svelte`
  3.23.0 ships 86 rules and zero `a11y-*` ones.
- The compiler rejects a click handler on `role="listbox"`
  (`a11y_click_events_have_key_events`) because it cannot see that an
  aria-activedescendant widget keeps its keyboard path on the combobox. One scoped
  `svelte-ignore` carries that; delegating the click to the listbox also replaces six
  per-option handlers with one.
- ESLint types a `.svelte` import as `any`, so a member access on a narrowed value
  inside a template reads as unsafe. Derive the value in the script instead.
- Svelte 5 `unmount()` returns a promise → `void unmount(app)` in tests.
- `bits-ui` 2.19.0 works and its own 21-case probe is green (`wt/spike-m1u5-lib`
  `dca4f87`), but it needs `@internationalized/date` as a required peer, ships 7
  runtime packages, portals the popup outside the app root, and costs the dom project
  10.06 s. The demo hand-authors its combobox instead.
- APG's select-only example commits the active option on blur. This widget cancels
  instead, matching a native `select`, because u6 turns a selection into a Prolog run.

## Run lifecycle and answer states (u6)

- Cancellation surface = trailing optional `AbortSignal` on `EngineClient.query` and
  `AnswerService.ask`. `EngineClient`'s correlation id stays private; `QueryOutcome`
  and `AnswerResult` are unchanged from u2/u4. Rationale + rejected run handle:
  `.agent/contracts/m1u6.md` D1.
- Run serialization chains on the ENGINE CALL, not on the state write. A successor
  that awaits its predecessor's settle promise adds a microtask hop that a 4-tick
  test drain misses, and the state write is guarded by run identity anyway, so its
  ordering is irrelevant. `ActiveRun` carries both promises for that reason.
- With nothing live the engine call must go out in `run()`'s own tick. An
  unconditional `await previous?.done` suspends even when `previous` is `undefined`.
- `$state` vs `$state.raw` for the state union: deep `$state` does NOT break result
  identity — measured, R3's `toBe(result)` passes either way. `$state.raw` is chosen
  because every transition replaces the whole member, so proxying only adds per-read
  wrapping. Do not re-derive this as a correctness question.
- The answer region is mounted in EVERY state. `aria-busy` has to be readable while a
  run is live, so a region that appears at `settled` cannot announce its own
  replacement. `busy` means `running`/`cancelling` alone — booting is not a run, and
  treating it as one also left Cancel enabled during boot.
- An existence question projects no columns, so `answerRows` returns `[]` for it
  regardless of solution count. Mapping its 12 solutions emits 12 unlabelled radios.
- Disabling a focused button drops focus to `body`, so whether Cancel held focus must
  be read in `$effect.pre` and acted on in `$effect`.
- `pnpm smoke` = `node tools/smoke.mjs`, deliberately OUTSIDE `pnpm gate` on the
  `kb:reproduce` precedent: it needs a real browser. It builds if `dist/` is missing,
  copies `dist` under a nested path, serves it with a request log, drives
  chromiumfish, and compares the rendered canonical text against the answer read out
  of the vendored bag at run time through `verifyBag`. Negative control: removing
  BOTH `kb/generated/kb.pvm` and `dist/` gives rc 1, thrown by the `pnpm build`
  step. Removing the pvm alone leaves rc 0, because the smoke rebuilds only when
  `dist/` is missing and otherwise serves the stale hashed asset — so the control
  proves the build path, never a `waitForSelector` timeout.
- The smoke keys on `[role="option"][id$="-option-<questionId>"]`; combobox option ids
  are `${uid}-option-${questionId}` and render in `QUESTION_IDS` order.
- The chromiumfish launcher is resolved from the pnpm global store and ships no types,
  so `tools/smoke.mjs` carries the file's one `no-unsafe-assignment` disable. A JSDoc
  cast does not clear it, because the awaited dynamic import is still `any`.

## Presentation and framing (u7)

- Fonts self-host from `@fontsource-variable/{atkinson-hyperlegible-next,
  atkinson-hyperlegible-mono,literata}@5.3.0` (OFL 1.1, no Reserved Font Name,
  zero transitive deps). Their CSS entrypoints are AXIS-scoped (`wght.css`,
  `opsz.css`), never subset-scoped, so importing one emits every unicode-range
  subset — literata alone is 1883680 B across 58 files. `src/app.css` therefore
  hand-authors `@font-face` against the six latin/latin-ext woff2 files:
  176732 B, and family names drop the packages' `Variable` suffix.
- Vite resolves a bare package specifier inside CSS `url()`, so the font rules
  need no relative path into `node_modules`.
- Role tokens: `--surface`, `--surface-raised`, `--surface-sunken`, `--text`,
  `--text-muted`, `--border`, `--action`, `--action-text`, `--warn`,
  `--focus-ring`. `--field` used to be consumed with an inline `#fff` fallback
  and defined nowhere. `--border` must be at least `#8f8270` to clear 3:1
  against `--surface`; the old `#ddd6c9` was 1.99:1.
- `tools/contrast.mjs` grades a DECLARED pair table, not the DOM: jsdom has no
  canvas, so axe-core reports every `color-contrast` result as `incomplete`. It
  floors the ratio rather than rounding, and it fails when a colour token
  appears in no pair.
- `tools/copy-check.mjs` is static — there is no TS runner here. It grades
  `src/demo/copy.ts` (`INSTRUCTIONS` ≤20 words/sentence, `DESCRIPTIONS` ≤25) and
  `src/demo/describe.ts`. A period between digits is not a sentence boundary, so
  `License 1.1.` is one sentence; the sentinel is `U+E000` because a control
  character trips ESLint `no-control-regex`.
- CDC's four reuse requirements for public-domain content: attribution naming
  the developing agency; a nonendorsement disclaimer "prominently and
  unambiguously displayed"; no change to substantive content; a statement that
  the material is free on the agency website. The second one is why attribution
  and nonendorsement cannot live inside the About disclosure.
- The bag labels all 337 documents `unreviewed`. Upstream `tools/goal.py:3140`
  counts `approved`/`rejected`/`contested`/`stale`/`unreviewed`, so the label
  means no adjudication decision was recorded, not that a check failed.
- The six question strings are payload, not copy: they are generated from the
  compiled goals, and rewriting them would make the displayed question differ
  from the one that runs. The copy validator does not grade them.
- `pnpm smoke` must open the canonical-answer disclosure before reading it. A
  `<details>` body is not visible, so a visibility wait times out at 45 s.
- Visual-QA walker = `tools/probe-u7.mjs` on branch `wt/map-m1u7` `124e34d`,
  548 lines, real browser at 320/375/1280 px. Regeneration: copy it into
  `tools/` and run it; it writes PNGs to `.probe/` and JSON to stdout. It is NOT
  in the gate — it fails `svelte-check` with 64 implicit-any errors, and the
  typed port is an open polish entry.
- New `.mjs` in `tools/` is type-checked by `svelte-check` AND type-aware
  linted, so regex capture groups and destructured array elements arrive as
  `string | undefined`. Prefer `exec(...)?.[1]` with an `undefined` guard over
  indexing a match, and default destructured numbers (`const [r = 0] = ...`).
