# Stack posture

User-ruled, binding on every role.

- Runtime = **static site + SWI-Prolog WASM** (`swipl-wasm`, exact-pinned). No host `swipl`
  install; deploys as static files. The chat is the one local server: `server/chat.mjs` relays
  a `codex app-server` child and never runs a goal — every goal runs in the page's engine.
- Frontend = **Svelte 5** runes + **Vite** + TypeScript. Runes carry the demo's real state
  (selected question, run status, chosen solution, focused trace node, graph selection);
  single-file components read well for agents.
- Entity graph ≈ 1K nodes = **analysis tier, not scale tier** → layout quality, neighborhood
  expansion, shortest path and centrality outrank renderer throughput.
- **The KB enters by export only.** The producer project `cnl-ckc` is read-only, never linked,
  never a runtime dependency; the vendored bag under `kb/` is the whole interface.
- Non-negotiable: every answer the demo presents as the knowledge base's — a prepared question's
  answer, a chat part tagged KB — traces to a genuine Prolog solution. A chat part from the web
  or the model's own knowledge says so in its tag and claims no KB backing.
- **Demo tier = no formal verification** (`CLAUDE.md` `Engineering` formal methods). User
  ruling. The demo serves no clinical purpose: it demonstrates `cnl-ckc`'s utility, and
  `cnl-ckc` carries the clinical-grade rigor, so its formal-verification tier stays out of this
  repo. Every other `CLAUDE.md` `Engineering` and `Session flow` clause binds the whole repo:
  verification integrity on and off the answer path, the assurance tiers, and the IMPLEMENT +
  MAINTAIN teammate dispatch. On the answer path, integrity costs the overlay recipe in
  `.claude/rules/proof.md`. Every check the retired waiver excused sits beside its firing record
  in `.agent/contracts/mnt5-inventory.md`.
- **No prototype tree for the expedited M2–M4 surfaces** — `CLAUDE.md` `Session flow`
  PROTOTYPE, ITERATE + IMPLEMENT, inapplicable to them by user ruling. They played the
  PROTOTYPE role in place and were redeveloped under M5's gates (`.agent/spec.md`
  `Decisions`), so `Artifacts` records no prototype path, IMPLEMENT's retire-at-close has
  nothing to retire, and no `prototype-<scope>` tag exists. A future PROTOTYPE or ITERATE
  scope follows the template: its prototype lives at an isolated path and retires at its
  IMPLEMENT close (user ruling).

Package versions live in `package.json` + `pnpm-lock.yaml` — read them there. Constraints
that bind a version are in `.claude/rules/toolchain.md`.
