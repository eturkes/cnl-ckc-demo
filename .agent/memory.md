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
  only tolerated noise.
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
  335ms** boot+load (437,064 B; 10.8s to build). PVM is the shipping form, QLF
  the fallback. Concatenated `pl/` = 4,716,517 B raw, **169,571 B** gzip-9.
- Production build measured at 3,500,973 B raw / **1,339,723 B** gzip: worker
  3,062,652 B + PVM 437,064 B. No COOP/COEP needed. `loadImageDefault` uses
  direct `eval` → a strict CSP host is a live risk, owned by M4.
- Engine: unified stack limit 1GiB (reducible), Emscripten heap ceiling 2GiB,
  RSS ~119MB steady; asserted state persists across queries in one engine.
- Oracle fidelity: live WASM **byte-matched** committed
  `queries/answers/category-a-recommendations.pl` (7 rows, in order). The other
  three committed queries are **value-equal**, not byte-proven. Committed
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

## Scratch conventions (regenerable)

- `.scratch/kb/` = the vendored bag extracted for agent reading:
  `tar xzf kb/cnl-ckc-kb-*.tar.gz -C .scratch/ && ln -sfn cnl-ckc-kb-* .scratch/kb`.
- `.scratch/validate-report.py` grades wave reports (`--units N`, `--verdict`).
  Scratch-local encoding; port it into the repo when a durable claim depends
  on it.
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
