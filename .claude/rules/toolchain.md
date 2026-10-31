---
paths:
  - "package.json"
  - "pnpm-lock.yaml"
  - "pnpm-workspace.yaml"
  - "eslint.config.js"
  - "svelte.config.js"
  - "tsconfig.json"
  - "vite.config.ts"
  - "tools/**"
  - "tests/**"
---

# Toolchain constraints

## Runtime

- Node **26** = `package.json` `devEngines.runtime` (exact `26.13.0`, `onFail: download`) +
  `engines` (`>=26.0.0 <27`: every installed package admits 26.0.0) + CI `setup-node`, which
  reads it through `node-version-file: package.json`. pnpm installs that runtime into
  `node_modules/.bin`, so every `pnpm <script>` and `pnpm exec node` runs on it whatever the host
  carries. **Bare `node` is the host's** and is never a gate runner.
- The chat bridge needs the `codex` CLI on `PATH` (`CHAT_CODEX_BIN` overrides) and a login under
  its dedicated `CODEX_HOME` (`~/.config/cnl-ckc-demo/codex`, `CHAT_CODEX_HOME` overrides); it is
  not a package dependency.
- **Product prerequisites outside the tree stay** (user ruling on `CLAUDE.md` `Authoring`
  portability): the chat's `CODEX_HOME` is a per-user product path, the same on every machine;
  the browser lanes' Chromium = the public `chromiumfish` npm package, located by
  `CHROMIUMFISH_DIR` (its package directory), else the pnpm global store
  (`tools/browser.mjs` `resolveChromiumfish`). README `Prerequisites` + `Chat` name both.

## Package manager

- pnpm **12** = `package.json` `packageManager` (exact `12.16.1`; user ruling): any pnpm from 10
  on downloads and runs that version, and the lockfile's first YAML document pins its binaries
  by integrity. It stays the legacy field, never `devEngines.packageManager`: npm refuses every
  `npx` call inside a project whose `devEngines.packageManager` names pnpm (`EBADDEVENGINES`).
  npm also refuses wherever the host's Node is not `devEngines.runtime`'s exact pin, so the
  rules' recipes run `pnpm exec` and `pnpm dlx`, which use the pinned runtime. CI installs it
  through `pnpm/action-setup`. Corepack is retired: Node 25 and later ship without it.
- pnpm settings live in `pnpm-workspace.yaml`, because pnpm 11 and later ignore `package.json`
  `pnpm`. `allowBuilds` `esbuild: false` keeps esbuild's install script off, as pnpm 10 left it:
  pnpm 12 fails an install on any build script `allowBuilds` does not list.
  `verifyDepsBeforeRun: error` refuses `pnpm run` and `pnpm exec` over stale dependencies (user
  ruling): its default, `install`, installs behind the script and, when that install fails,
  warns and runs the script anyway, so a gate could grade a stale tree. It also refuses a tree
  whose `node_modules` another tree installed, which is why worktrees install their own
  (`.claude/rules/waves.md` `Worktrees`).
- `minimumReleaseAge` stays pnpm's default 1440 minutes (user ruling): an install refuses a
  version published under 24 h ago, so a fix for a fresh advisory installs a day after release
  and `audit:check` stays red until then.

## Dependency pins

- `typescript-eslint` stable caps at TypeScript <6.1 → TypeScript stays on 5.x. Installing
  TS 7 breaks `pnpm lint`.
- `@types/cytoscape` is deprecated and `cytoscape` ships its own types → that types package
  must stay uninstalled.
- `pdfjs-dist` is **exact-pinned** (the owned page viewer, `src/provenance/pdf-viewer.ts`): the
  viewer depends on its text-layer API (`TextLayer`, `textDivs`, `textContentItemsStr`) and on
  `--total-scale-factor` CSS the ladder re-states, so a bump re-runs `pnpm browser:check`'s page
  viewer leg. Its `legacy` build serves the Node census (`tests/passage-locate.test.ts`).
- `swipl-wasm` stays **exact-pinned**: production calls three undeclared APIs off it
  (`.claude/rules/engine.md`), so every version bump re-verifies them against the shipped
  `.d.ts`.
- Each cap here must also appear in `renovate.json` as an `allowedVersions` rule, or the weekly
  run reopens the same gate-breaking PR.
- ShellCheck is no package: `tools/shell-check.mjs` pins `VERSION` and each build's `.tar.gz`
  digest (GitHub's asset `digest`), so Renovate never sees it. A bump edits the version and every
  digest together; a digest left stale refuses the fetch by name, before any binary is cached.
- ESLint config needs `@types/node`, and svelte parsing needs `extraFileExtensions`.
- `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` move together: the runner peers on
  the EXACT core version, so Renovate's `stryker` group moves both in one PR, majors included.
  Stryker's default `@stryker-mutator/*` plugin glob searches
  beside core's own install, which pnpm's isolated layout leaves without the runner →
  `tools/mutation/stryker.config.mjs` resolves the runner itself. The runner forces threads and
  has no browser mode, so `pnpm stryker` grades node-project suites alone.
- `pnpm-workspace.yaml` `overrides` `typed-rest-client>qs` = the upgrade the audit ruling asks
  for: `typed-rest-client` 2.3.1, the HTTP client of Stryker's dashboard reporter and
  `stryker init` (`pnpm stryker` runs neither), pins `qs` 6.15.1, which four
  moderate advisories reach, and the patched `qs` is 6.16.1. Drop the override once Stryker's
  `typed-rest-client` pins a patched `qs`.
- Prettier reformats `.claude/` and `.agent/` tool-owned files if unscoped →
  `.prettierignore` restricts it to first-party source. Keep that scoping.

## Build scripts

Build scripts are `tools/**/*.mjs`, JSDoc-typed under `allowJs` + `checkJs`. **No TS runner
is installed and none is needed**: `svelte-check` type-checks `.mjs`, ESLint applies
type-aware rules to it (`.mjs` escapes the `**/*.js` → `disableTypeChecked` override), and
the gate executes the scripts for real. Consequences for new `.mjs`:

- Regex capture groups and destructured array elements arrive as `string | undefined` →
  prefer `exec(…)?.[1]` with an `undefined` guard over indexing a match, and default
  destructured numbers (`const [r = 0] = …`).
- A recursive `flatMap` infers `any[]` and fails `@typescript-eslint/no-unsafe-return` →
  give every recursive JSDoc'd helper an explicit `@returns`.
- `subset-font` and `fontverter` ship no types → `tools/font-modules.d.ts` declares the slice
  `tools/fonts.mjs` calls.
- The chromiumfish launcher resolves at run time and ships no types, so
  `tools/browser.mjs` carries one `no-unsafe-assignment` disable. A JSDoc cast does not clear
  it — the awaited dynamic import is still `any`.

ESLint types a `.svelte` import as `any`, so a member access on a narrowed value inside a
template reads as unsafe → derive the value in the script block instead.

## Vite

- Alias `@kb` → `kb/generated`; `base: './'`; `worker.format: 'es'`; `cacheDir: '.vite'`.
- The literal `new Worker(new URL('./worker.ts', import.meta.url), {type:'module'})` form is
  what makes Vite emit a separate worker bundle.
- **Offline caching = `dist/sw.js`, written by the `offlineCache` plugin in `closeBundle`** from
  the files on disk (`tools/offline-sw.mjs`) — `generateBundle` misses the worker-emitted PVM.
  The cache name hashes the whole file list, so any renamed asset (a changed KB input renames the
  PVM) activates a new cache and deletes the old. Install precaches the boot set: every
  `assets/` file outside `LAZY`, which holds the graph, renderer, PDF, the PDF.js viewer chunk and
  worker, the corpus index, provenance chunks, Japanese faces and the QLF fallback — precaching those would put the Japanese face on an
  English page and fetch the 6.2 MB fallback engine a sound session never takes. `src/main.ts`
  registers in production builds alone. `pnpm browser:check` grades the offline second visit and
  the invalidation.
- **Licence notice = `dist/licenses/third-party.txt`** (`tools/licences.mjs`): minification strips
  every licence comment, so the `licenceNotice` plugin lists each package with code in a bundled
  chunk (`renderedLength > 0`, the main AND worker builds) beside its licence file, verbatim.
  Worker builds run inside the main build's transform phase, so their packages are known before
  the main build emits; a bundler-injected `\0` module maps to its shipping package through
  `VIRTUAL`, and an unmapped one fails the build. `closeBundle` grades the written file.
- `cacheDir` must resolve against the project root. A tree that reaches the toolchain through
  a `node_modules` symlink — Stryker's sandbox, `binding:replay`'s archive — would otherwise
  share the primary's `node_modules/.vite`.

## Vitest

Two projects, plus a third that exists only under `VITEST_BROWSER=1`. `tests/**/*.dom.test.ts`
runs under jsdom with `resolve.conditions: ['browser']`; without that condition svelte resolves
to `index-server.js` and `mount` throws `lifecycle_function_unavailable`. The node project
excludes that glob and `tests/**/*.browser.test.ts`, so `swipl-wasm` keeps its node entry.

- `browser` = `tests/**/*.browser.test.ts` in real Chromium through `@vitest/browser-playwright`,
  run by `pnpm test:browser`, which points it at the chromiumfish binary — the gate and CI never
  load a browser driver, and `vite.config.ts` imports the provider only under that flag.
- `@vitest/browser-playwright` peers on the EXACT installed `vitest`; Renovate's `vitest` group
  moves `vitest` and every `@vitest/*` in one PR, majors included. `playwright` is exact-pinned
  and drives chromiumfish's Chromium in `pnpm test:browser`; chromiumfish's own launcher resolves
  its peer `playwright-core` (`>=1.40`) when it is installed, so the two versions can differ, and
  `pnpm test:browser` decides a bump of either.
- Server-side browser commands live in `tests/support/`; `axCombobox` reads Chromium's own
  accessibility tree over CDP.

Live-engine tests run in the node project: one non-parallel worker, real saved image.

## Built output

`dist/` totals drift on ANY source byte → report them with `du -sb dist` and
`jq '.assets|length' kb/generated/kb-manifest.json`; **never record a durable exact total**.
Re-derive the file count and the asset-class list whenever a unit ships a new asset class; a
census figure stated in these rules belongs in `tests/census.test.ts` `CENSUS`.
Two blobs neither the app nor a unit moves: the worker chunk (swipl-wasm) and the PVM.
