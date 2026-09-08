# Gate

`pnpm gate` = one `&&` chain in `package.json`; every step fails closed:

`audit:check → secret:check → kb:build → kb:asset-check → engine:check → copy:check →
contrast:check → presentation:check → format:check → lint → check → test → build`

`package.json` is authoritative if that list ever diverges from it. The chain's per-run counts
(checked files, tests, modules, copy strings, contrast pairs) move on almost every commit →
**rerun the gate rather than quoting a total**; a durable exact total re-stales itself.

Step semantics a reader cannot get from the script name:

- `audit:check` = `pnpm audit --audit-level=moderate`, live against the registry advisory
  feed. **User ruling: no allowlist.** An advisory published against an unchanged tree
  reddens the gate, and the fix is the upgrade or an explicit user ruling — never a
  suppression file. It needs network; that is the accepted cost of a live feed.
- `secret:check` (`tools/secret-check.mjs`) runs secretlint twice: once on a planted control
  token in a temp dir, which must exit 1, and once over the tree, which must exit 0. The
  control is what keeps a silently-dead detector from reading as a clean tree. The control
  literal is assembled from fragments so it cannot match itself in the tree pass.
- `lint` carries the static-analysis layer and runs at `--max-warnings=0`, so a security
  finding fails the gate rather than scrolling past. ESLint is the only analyzer in the stack
  that parses `.svelte`, which is why the sink rules live there rather than in a separate
  SAST step: `svelte/no-at-html-tags`, `no-unsanitized/*`, `eslint-plugin-security`.
  `security/detect-object-injection` is off project-wide (150 findings, all typed lookups it
  cannot see the index signature for); the fs/regexp/require path rules are off for
  `tools/**` and `tests/**`, which take no untrusted input, and stay on for `src/**`. Every
  remaining exception is one inline disable carrying its reason.
- `kb:build` subsumes the retired `kb:verify` — it proves the vendored bag against its
  `.sha256` sidecar before parsing, in memory, never extracting.
- `engine:check` (`tools/engine-check.mjs`) decides budget-required signatures, `.query`/
  `.ask` call-site arity, exactly one `swipl-wasm` importer (`src/engine/worker.ts` — the
  pattern must admit a BARE side-effect import, which a `from`-anchored one missed), the
  undeclared-API allowlist, and a `terms.ts` export-surface pin.
- `copy:check` (`tools/copy-check.mjs`) runs two graders over `src/i18n/`: English on sentence
  length and banned filler, Japanese on key parity alone. Why the limits do not port, and what
  may stay untranslated, are in `.claude/rules/i18n.md`.
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
| `pnpm browser:check` | 337 documents on dev + built output, every 320 px interaction state incl. Japanese, that `unicode-range` keeps the Japanese face off an English page, browser cancel delivery |

`pnpm release:check` = `gate && kb:reproduce && smoke && browser:check`.

## CI

- `.github/workflows/pages.yml` — runs `pnpm gate` on every push to `main`, then publishes
  `dist/` to Pages. Scanners ride the gate, so CI covers them without a second definition.
- `.github/workflows/security.yml` — the scanners alone, on a daily schedule plus push and
  pull request. The schedule is the point: a new advisory has to redden something on a day
  nobody pushes.
- `.github/dependabot.yml` — weekly npm + github-actions updates. Its `ignore` list mirrors
  the version constraints in `.claude/rules/toolchain.md`; adding a constraint there means
  adding it here, or Dependabot reopens the PR that breaks the gate every week.

**Never run MAIN's decisive `pnpm gate` while teammates run suites.** Three trees testing at
once starve the CPU into spurious `Test timed out in 5000ms` failures — `kb-reach`, which
spawns `kb:asset-check` subprocesses, and `demo-controller.dom`'s axe sweep. Nothing is
wrong with the tree. The decisive rerun follows `TaskStop`.

A gate backing a durable claim must rerun from committed state. A scratch-local validator is
a temporary encoding → record its regeneration path beside the gate invocation here, and
schedule the port as a `.agent/spec.md` `Deferred` row.
