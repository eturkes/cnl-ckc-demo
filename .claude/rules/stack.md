# Stack posture

User-ruled, binding on every role.

- Runtime = **static site + SWI-Prolog WASM** (`swipl-wasm`, exact-pinned). No server, no
  host `swipl` install, deploys as static files. Free-text intake stays reachable later
  because APE is itself Prolog and loads into the same engine.
- Frontend = **Svelte 5** runes + **Vite** + TypeScript. Runes carry the demo's real state
  (selected question, run status, chosen solution, focused trace node, graph selection);
  single-file components read well for agents.
- Entity graph ≈ 1K nodes = **analysis tier, not scale tier** → layout quality, neighborhood
  expansion, shortest path and centrality outrank renderer throughput.
- **The KB enters by export only.** `../cnl-ckc` is read-only, never linked, never a runtime
  dependency; the vendored bag under `kb/` is the whole interface.
- Non-negotiable: every answer traces to a genuine Prolog solution. Demo-tier rigor is
  waived everywhere else.

Package versions live in `package.json` + `pnpm-lock.yaml` — read them there. Constraints
that bind a version are in `.claude/rules/toolchain.md`.
