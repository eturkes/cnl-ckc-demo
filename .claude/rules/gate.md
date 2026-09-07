# Gate

`pnpm gate` = one `&&` chain in `package.json`; every step fails closed:

`kb:build → kb:asset-check → engine:check → copy:check → contrast:check →
presentation:check → format:check → lint → check → test → build`

`package.json` is authoritative if that list ever diverges from it. The chain's per-run counts
(checked files, tests, modules, copy strings, contrast pairs) move on almost every commit →
**rerun the gate rather than quoting a total**; a durable exact total re-stales itself.

Step semantics a reader cannot get from the script name:

- `kb:build` subsumes the retired `kb:verify` — it proves the vendored bag against its
  `.sha256` sidecar before parsing, in memory, never extracting.
- `engine:check` (`tools/engine-check.mjs`) decides budget-required signatures, `.query`/
  `.ask` call-site arity, exactly one `swipl-wasm` importer (`src/engine/worker.ts` — the
  pattern must admit a BARE side-effect import, which a `from`-anchored one missed), the
  undeclared-API allowlist, and a `terms.ts` export-surface pin.
- `presentation:check` (`tools/presentation-check.mjs`) grades three DECLARED tables against
  source alone — no build, no browser: `@font-face` rows, shipped OFL texts against each
  package `LICENSE`, and the selectors rendering engine-authored text. Rule bodies match
  brace-free ⇒ only leaf rules match and `@media` never matches alone; CSS comments strip
  first, so a documented rule carries its comment in its selector list.

Out of the chain — each needs a real browser or two forced builds, and each reruns from
committed state:

| command | what it alone proves |
|---|---|
| `pnpm kb:reproduce` | byte-reproducibility of pvm + qlf + catalog across two forced builds |
| `pnpm smoke` | built output answers in a real browser against bag bytes read at run time |
| `pnpm browser:check` | 337 documents on dev + built output, five 320 px interaction states, browser cancel delivery |

`pnpm release:check` = `gate && kb:reproduce && smoke && browser:check`.

**Never run MAIN's decisive `pnpm gate` while teammates run suites.** Three trees testing at
once starve the CPU into spurious `Test timed out in 5000ms` failures — `kb-reach`, which
spawns `kb:asset-check` subprocesses, and `demo-controller.dom`'s axe sweep. Nothing is
wrong with the tree. The decisive rerun follows `TaskStop`.

A gate backing a durable claim must rerun from committed state. A scratch-local validator is
a temporary encoding → record its regeneration path beside the gate invocation here, and
schedule the port in `.agent/polish.md`.
