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

- Corpus via SWI-Prolog, authoritative: **800 noun atoms, 127 verbs, 337 docs,
  316 predicates**, 0.6s co-load. A regex count gives 1834 predicates and is
  wrong — operator contexts contain commas. Graph sizing ≈ 1K nodes.
- WASM path on the real corpus: boot **233ms**, consult of all 337 compiled
  docs (4.5 MiB) **2.08s**, query **125ms**, 7 solutions.
- Live WASM output **byte-matched** cnl-ckc's committed
  `queries/answers/category-a-recommendations.pl` — all 7 rows, in order. This
  is the evidence that answers are genuine Prolog, and the pattern to reuse for
  any "no hard-coding" claim.

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
