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
pnpm gate = pnpm kb:verify && pnpm format:check && pnpm lint && pnpm check && pnpm test && pnpm build
```

Members: `kb:verify` (sha256 of the KB bag) · `format:check` (prettier) ·
`lint` (eslint) · `check` (svelte-check) · `test` (vitest) · `build` (vite).
Last run: `pnpm gate` → **rc=0**, all six green; vitest 1 file / 1 test passed,
vite built 112 modules → `dist/` 25.82 kB js + 0.92 kB css.

## Knowledge base

- Vendored bag = `kb/cnl-ckc-kb-g952cc950a0c6.tar.gz` (1.48 MB, 1047 members)
  + `.sha256` sidecar. BagIt 1.0; verify = `sha256sum -c manifest-sha256.txt
  tagmanifest-sha256.txt` inside the bag (1046 checksums OK).
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
- Probe branches survive their worktrees: `wt/res-m1-1` (`f636e2f`, swipl-wasm
  load/worker/terms/trace/perf/test/errors/deploy probes) and `wt/res-m1-2`
  (`6615e9d`, cytoscape layout/perf/test, axe, contrast, combobox probes).

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
