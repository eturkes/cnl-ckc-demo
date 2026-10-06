---
paths:
  - "package.json"
  - "pnpm-lock.yaml"
  - "eslint.config.js"
  - "svelte.config.js"
  - "tsconfig.json"
  - "vite.config.ts"
  - "tools/**"
  - "tests/**"
---

# Toolchain constraints

## Runtime

- Node **24** = `package.json` `devEngines.runtime` (exact `24.21.0`, `onFail: download`) +
  `engines` (`>=24.15.0 <25`, jsdom 30's floor) + CI `setup-node`. pnpm installs that runtime
  into `node_modules/.bin`, so every `pnpm <script>` and `pnpm exec node` runs on it whatever
  the host carries. **Bare `node` is the host's** and is never a gate runner.
- `wrangler` (devDependency) and `@typesafe-ai/sdk` (exact, runtime) serve `worker/` alone;
  ESLint `no-restricted-imports` refuses the SDK outside it.

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
- `pnpm.overrides` lifts `undici@>=7.28.0 <7.29.1` to `^7.29.1`: `wrangler` → `miniflare`
  pins `undici` 7.29.0 exactly, inside GHSA-3wwx-pv8p-q78v, and `audit:check` takes no
  allowlist. Drop the override once `miniflare` pins ≥7.29.1 — `pnpm why undici` shows it.
- `pnpm.overrides` lifts `sharp@<0.35.5` to `^0.35.5`: `miniflare` pins `sharp` 0.35.4
  exactly, inside GHSA-wq5f-xc86-pv6w. Drop the override once `miniflare` pins ≥0.35.5 —
  `pnpm why sharp` shows it.
- Each cap here must also appear in `.github/dependabot.yml`'s `ignore` list, or the weekly
  run reopens the same gate-breaking PR.
- ESLint config needs `@types/node`, and svelte parsing needs `extraFileExtensions`.
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
- The chromiumfish launcher resolves from the pnpm global store and ships no types, so
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
  worker, provenance chunks, Japanese faces and the QLF fallback — precaching those would put the Japanese face on an
  English page and fetch the 6.2 MB fallback engine a sound session never takes. `src/main.ts`
  registers in production builds alone. `pnpm browser:check` grades the offline second visit and
  the invalidation.
- `cacheDir` must resolve against the project root. Worktrees reach the toolchain through a
  `node_modules` symlink, so the default `node_modules/.vite` is ONE physical directory
  shared by every tree.

## Vitest

Two projects, plus a third that exists only under `VITEST_BROWSER=1`. `tests/**/*.dom.test.ts`
runs under jsdom with `resolve.conditions: ['browser']`; without that condition svelte resolves
to `index-server.js` and `mount` throws `lifecycle_function_unavailable`. The node project
excludes that glob and `tests/**/*.browser.test.ts`, so `swipl-wasm` keeps its node entry.

- `browser` = `tests/**/*.browser.test.ts` in real Chromium through `@vitest/browser-playwright`,
  run by `pnpm test:browser`, which points it at the chromiumfish binary — the gate and CI never
  load a browser driver, and `vite.config.ts` imports the provider only under that flag.
- `@vitest/browser-playwright` peers on the EXACT installed `vitest`; the Dependabot
  `dev-toolchain` group moves both in one PR for minor and patch, and a major bump moves both by
  hand. `playwright` is exact-pinned to the `playwright-core` chromiumfish itself drives.
- Server-side browser commands live in `tests/support/`; `axCombobox` reads Chromium's own
  accessibility tree over CDP.

Live-engine tests run in the node project: one non-parallel worker, real saved image.

## Built output

`dist/` totals drift on ANY source byte → report them with `du -sb dist` and
`jq '.assets|length' kb/generated/kb-manifest.json`; **never record a durable exact total**.
Re-derive the file count and the asset-class list whenever a unit ships a new asset class; a
census figure stated in these rules belongs in `tests/census.test.ts` `CENSUS`.
Two blobs neither the app nor a unit moves: the worker chunk (swipl-wasm) and the PVM.
