# CNL CKC Demo

A static browser demo of an executable clinical-guideline knowledge base. It runs
SWI-Prolog in a web worker, answers seven prepared clinical questions from 337 compiled
documents, traces a selected solution back to its source, and exposes the full
semantic graph.

The shipped answers are produced at run time. They are not stored UI fixtures.

## What is included

- A bounded SWI-Prolog/WASM query engine with cancellation and worker recovery.
- A six-step evidence ladder: live proof, compiled clause, controlled sentence,
  coverage region, aligned source passage, and physical guideline PDF page.
- Explicit projection-loss and `unreviewed` disclosures.
- A lazily loaded semantic graph with search, bounded neighborhoods, shortest
  paths, fCoSE layout, and complete keyboard-usable HTML navigation.
- Light and dark themes, responsive layouts, local fonts, and relative asset
  paths for nested static hosting.

## Important limits

- **Do not use this demo to make clinical decisions.** It gives no medical
  advice.
- Every compiled document is labelled `unreviewed`; no human adjudication is
  recorded.
- The seven questions are prepared examples, not unrestricted natural-language
  input.
- The controlled language is a projection. The evidence ladder identifies
  material kept, changed, or omitted.

Source: CDC. The Centers for Disease Control and Prevention developed the source
material, which is available on the agency website at no charge. Use does not
imply endorsement by CDC, the Department of Health and Human Services, or the
United States Government.

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- pnpm 10, installed through Corepack
- `chromiumfish` for `pnpm smoke` and `pnpm browser:check`

## Run locally

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm kb:build
pnpm dev
```

Open the URL printed by Vite. Wait for the engine to report ready, select a
question, and select **Run**. Evidence data and the graph renderer load only when
their controls are activated.

For a production build:

```sh
pnpm build
pnpm preview
```

## Verification

The normal deterministic gate rebuilds the vendored knowledge-base export and
checks generated assets, engine boundaries, copy, contrast, presentation,
formatting, lint, types, tests, and the production bundle:

```sh
pnpm gate
```

The release check adds byte-for-byte knowledge-base reproduction and real-browser
proofs for the nested production build, live answers, lazy graph, responsive
states, and cancellation:

```sh
pnpm release:check
```

Generated runtime files live under `kb/generated/` and are intentionally ignored.
`pnpm kb:reproduce` derives a fresh tree and compares it with the current one.

## Static deployment

The application has no server-side runtime. Publish `dist/` at any static path;
Vite emits relative URLs. The included GitHub Pages workflow runs the gate and
deploys `dist/` on pushes to `main` or manual dispatch.

SWI-Prolog/WASM generates JavaScript functions, and the app starts a module
worker. A static host that sets CSP headers should begin with a policy equivalent
to:

```text
default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'none'
```

Validate the exact policy on the chosen host; this repository does not inject a
CSP meta tag because deployment headers are the authoritative boundary.

## Licences

The demo is Apache-2.0 WITH LLVM-exception. Atkinson Hyperlegible Next, Atkinson
Hyperlegible Mono, and Literata are included under the SIL Open Font License 1.1;
their licence texts are served from `public/licenses/`.
