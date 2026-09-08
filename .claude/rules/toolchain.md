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

## Dependency pins

- `typescript-eslint` stable caps at TypeScript <6.1 → TypeScript stays on 5.x. Installing
  TS 7 breaks `pnpm lint`.
- `@types/cytoscape` is deprecated and `cytoscape` ships its own types → that types package
  must stay uninstalled.
- `swipl-wasm` stays **exact-pinned**: production calls three undeclared APIs off it
  (`.claude/rules/engine.md`), so every version bump re-verifies them against the shipped
  `.d.ts`.
- jsdom is capped at `^29.1.1`, exact only in the lockfile. jsdom 30 pulls undici 8, which
  assigns `webidl.util.markAsUncloneable` from `node:worker_threads`; Node 20 does not export
  it, so the vitest fork dies before any test runs.
- `secretlint` and every `@secretlint/*` package are capped at `^12`. Version 13 declares
  `engines.node >= 22`; this project runs Node 20 (`engines`, and the CI `setup-node` pin).
  Lifting the cap means moving the whole runtime, which also lifts the jsdom cap above.
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
  `tools/smoke.mjs` carries one `no-unsafe-assignment` disable. A JSDoc cast does not clear
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
