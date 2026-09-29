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
- `swipl-wasm` stays **exact-pinned**: production calls three undeclared APIs off it
  (`.claude/rules/engine.md`), so every version bump re-verifies them against the shipped
  `.d.ts`.
- `pnpm.overrides` lifts `undici@>=7.28.0 <7.29.1` to `^7.29.1`: `wrangler` → `miniflare`
  pins `undici` 7.29.0 exactly, inside GHSA-3wwx-pv8p-q78v, and `audit:check` takes no
  allowlist. Drop the override once `miniflare` pins ≥7.29.1 — `pnpm why undici` shows it.
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
- The chromiumfish launcher resolves from the pnpm global store and ships no types, so
  `tools/browser.mjs` carries one `no-unsafe-assignment` disable. A JSDoc cast does not clear
  it — the awaited dynamic import is still `any`.

ESLint types a `.svelte` import as `any`, so a member access on a narrowed value inside a
template reads as unsafe → derive the value in the script block instead.

## Vite

- Alias `@kb` → `kb/generated`; `base: './'`; `worker.format: 'es'`; `cacheDir: '.vite'`.
- The literal `new Worker(new URL('./worker.ts', import.meta.url), {type:'module'})` form is
  what makes Vite emit a separate worker bundle.
- `cacheDir` must resolve against the project root. Worktrees reach the toolchain through a
  `node_modules` symlink, so the default `node_modules/.vite` is ONE physical directory
  shared by every tree.

## Vitest

Two projects. `tests/**/*.dom.test.ts` runs under jsdom with `resolve.conditions:
['browser']`; without that condition svelte resolves to `index-server.js` and `mount` throws
`lifecycle_function_unavailable`. The node project excludes that glob so `swipl-wasm` keeps
its node entry.

Live-engine tests run in the node project: one non-parallel worker, real saved image.

## Built output

`dist/` totals drift on ANY source byte → report them with `du -sb dist` and
`jq '.assets|length' kb/generated/kb-manifest.json`; **never record a durable exact total**.
Re-derive the file count and the asset-class list whenever a unit ships a new asset class.
Two blobs neither the app nor a unit moves: the worker chunk (swipl-wasm) and the PVM.
