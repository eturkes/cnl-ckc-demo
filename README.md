# CNL CKC Demo

This demo answers questions about a clinical guideline by running Prolog in your
browser. Each answer is a live proof, never a stored result.

The knowledge base is compiled from CDC source material into a controlled natural
language, and then into Prolog. The demo boots that compiled knowledge base as a
SWI-Prolog saved state in a web worker. The engine reports the document count, and
that count is 337 for the vendored knowledge base.

## Limits

Read these limits before you read any answer.

- Do not use this demo to make clinical decisions. It gives no medical advice.
- Every compiled document carries the label `unreviewed`. No person has
  adjudicated any of them.
- The question list is fixed. A developer wrote the six questions, and the demo
  compiles each one to a Prolog goal before it runs.
- The demo does not reproduce guideline text unchanged. It runs a projection of
  that text.

Source: CDC. The Centers for Disease Control and Prevention developed the source
material. The source material is available on the agency website at no charge.
Use of this material does not imply endorsement by the Centers for Disease
Control and Prevention, the Department of Health and Human Services, or the
United States Government.

## Prerequisites

You must install these two tools first. The demo needs no other global tool.

- Node.js `^20.19.0 || >=22.12.0`
- pnpm 10, which `corepack enable` installs from the `packageManager` field

## Run the demo

Run these commands in order from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm kb:build
pnpm dev
```

`pnpm kb:build` compiles the vendored knowledge base into `kb/generated/`. Run it
once. Run it again after you change the bag in `kb/`.

`pnpm dev` prints a local URL. Open that URL. Wait for the engine to boot, select
a question, then select **Run**.

To serve the production build instead, run `pnpm build` and then `pnpm preview`.

## Verify the checkout

One command decides the whole project.

```sh
pnpm gate
```

`pnpm gate` compiles the knowledge base, verifies the shipped assets, checks the
engine boundaries, grades the copy and the colour contrast, checks the fonts and
the licences, formats, lints, type-checks, runs the tests, and builds. It must
exit 0.

Two more checks need a real browser, so they stay outside the gate. Run
`pnpm smoke` to prove that the built site answers a question. Run
`pnpm browser:check` to prove that the development server and the built site
agree, that five states fit a 320px viewport, and that a cancelled query stops
between solutions.

## Licences

The demo ships under Apache-2.0 WITH LLVM-exception. It sets text in Atkinson
Hyperlegible Next, Atkinson Hyperlegible Mono and Literata. Each typeface ships
under the SIL Open Font License 1.1, and the demo serves each licence from
`public/licenses/`.
