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
- Non-negotiable: every answer traces to a genuine Prolog solution.
- **Demo tier = no formal verification.** User ruling. The demo serves no clinical purpose: it
  demonstrates `../cnl-ckc`'s utility, and `cnl-ckc` carries the clinical-grade rigor, so its
  formal-verification tier stays out of this repo. Every other `CLAUDE.md` `Engineering` and
  `Session flow` clause binds the whole repo: verification integrity on and off the answer
  path, the assurance tiers, and the IMPLEMENT + MAINTAIN teammate dispatch. On the answer
  path, integrity costs the overlay recipe in `.claude/rules/proof.md`. Checks the retired
  integrity waiver excused → `.agent/deferred.md` row `Off-path checks the retired demo-tier
  waiver excused`.
- **No prototype tree** — `CLAUDE.md` `Session flow` PROTOTYPE + IMPLEMENT, inapplicable by
  user ruling. The expedited M2–M4 surfaces played the PROTOTYPE role in place and were
  redeveloped under M5's gates (`.agent/spec.md` `Decisions`), so `Artifacts` records no
  prototype path and IMPLEMENT's retire-at-close has nothing to retire.

Package versions live in `package.json` + `pnpm-lock.yaml` — read them there. Constraints
that bind a version are in `.claude/rules/toolchain.md`.
