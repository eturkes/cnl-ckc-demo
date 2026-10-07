# CNL CKC Demo

A static browser demo of an executable clinical-guideline knowledge base. It runs
SWI-Prolog in a web worker, combines matching recommendations into answers for seven
prepared clinical questions, traces each cited contribution back to its source, and
exposes the full semantic graph. You can also describe a clinical situation in your own
words, and the demo derives the recommendations whose guideline conditions that
description meets.

The shipped answers are produced at run time. They are not stored UI fixtures.

## What is included

- A bounded SWI-Prolog/WASM query engine with cancellation and worker recovery.
- One deterministic, cited answer assembled from every matching structured Prolog
  solution, with no separately authored summaries and an exact source-passage fallback.
- A six-step evidence ladder: live proof, compiled clause, controlled sentence,
  coverage region, aligned source passage, and physical guideline PDF page.
- Explicit projection-loss and `unreviewed` disclosures.
- A lazily loaded semantic graph with search, bounded neighborhoods, shortest
  paths, fCoSE layout, and complete keyboard-usable HTML navigation.
- A concept-first answer map that mechanically selects the question's primary
  clinical entity, places it at the center, and highlights the relationships in
  the sentences the live proof cites, over a bounded cross-source neighborhood.
- Parser, document, cardinality, and modality nodes stay in the provenance
  graph. The primary ontology view hides those nodes. It keeps modality and
  negation visible as state on the relationships themselves.
- Free-text intake. A language model judges which guideline conditions a description
  meets. Prolog then derives each matching recommendation, so the model selects rules
  but writes none of the text. Phrases that the knowledge base has no vocabulary for
  are listed as judged gaps.
- Light and dark themes, responsive layouts, local fonts, and relative asset
  paths for nested static hosting.
- An English and Japanese interface. The header toggle switches the interface
  language. The knowledge base does not translate: questions, controlled sentences,
  Prolog answers, document identifiers, and the guideline text stay in English.

## Important limits

- **Do not use this demo to make clinical decisions.** It gives no medical
  advice.
- Every compiled document is labelled `unreviewed`; no human adjudication is
  recorded.
- The seven questions are prepared examples.
- Free-text intake can only select from the 48 recommendations that the knowledge base
  compiles. A description that is not about opioid prescribing, pain care or opioid
  use disorder is refused.
- The language model judges which conditions apply. A judgment is not a proof: a gap
  phrase is judged absent, never proved absent, and at most 16 phrases are judged.
- The intake does not enforce the guideline's own exclusions, such as cancer-related
  pain, sickle cell disease, or palliative and end-of-life care.
- Intake is graded in English. The Japanese interface translates the controls, not
  the free-text matching.
- On 30 held-out descriptions, the live model matched the expected outcome in 27. The
  per-case results are in `tests/intake/report.json`. These numbers describe that set
  alone.
- The controlled language is a projection. The evidence ladder identifies
  material kept, changed, or omitted.

Source: CDC. The Centers for Disease Control and Prevention developed the source
material, which is available on the agency website at no charge. Use does not
imply endorsement by CDC, the Department of Health and Human Services, or the
United States Government.

## Prerequisites

- Node.js 24. pnpm downloads the pinned Node 24 runtime and runs every script on it.
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
question, and select **Run**. Select a numbered citation to inspect its proof and
source. **Find in graph** activates the lazy graph and moves directly to that
answer map. Orange paths come only from the selected source contribution; muted
branches show how its primary concept connects elsewhere in the knowledge base.

### Free-text intake

The intake sends the description to a local proxy, which holds the TypeSafe API key
and asks the language model one fixed question set. The browser never holds the key.

1. Put the key in a file named `.dev.vars` at the repository root:

   ```sh
   printf 'TYPESAFE_API_KEY=%s\n' "$(cat ~/.config/typesafe/key)" > .dev.vars
   ```

2. Start the proxy in one terminal. Start the demo in a second terminal:

   ```sh
   pnpm intake:dev
   pnpm dev
   ```

3. Type a description in **Clinical situation**.
4. Select **Match recommendations**.
5. To open a proof, select **Show derivation** on a row. The demo runs that row's prepared
   question and shows its derivation.

`.dev.vars` is ignored by git. Without the proxy, the intake reports that the matching
service failed. The prepared questions still work.

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

`pnpm intake:probe` reruns the held-out descriptions against the live model and needs
the key. The gate replays the recorded responses instead, so it needs no key. With
`pnpm intake:dev` and `pnpm dev` running, `pnpm intake:live` checks the whole intake path
in a real browser.

The release check adds byte-for-byte knowledge-base reproduction and real-browser
proofs for the nested production build, live answers, lazy graph, responsive
states, and cancellation:

```sh
pnpm release:check
```

Generated runtime files live under `kb/generated/` and are intentionally ignored.
`pnpm kb:reproduce` builds the tree twice and requires the two manifests to be identical.

Every durable claim this repository makes is listed in [the claim registry](docs/claims.md),
beside the command that re-derives it. Read a row as a promise and its receipt. A claim no
command re-derives says so in its own row, because a registry that hid those would be one more
claim to check.

## Static deployment

The prepared questions need no server-side runtime. Publish `dist/` at any static path;
Vite emits relative URLs. Free-text intake needs the judgment proxy in `worker/`. It runs
locally under `pnpm intake:dev`, and this repository does not deploy it. The included CI workflow runs the gate on every push to
`main` and on pull requests. It publishes nothing.

SWI-Prolog/WASM generates JavaScript functions, and the app starts a module
worker. A static host that sets CSP headers should begin with a policy equivalent
to:

```text
default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'
```

Validate the exact policy on the chosen host; this repository does not inject a
CSP meta tag because deployment headers are the authoritative boundary.

## Licences

The demo is Apache-2.0 WITH LLVM-exception. Atkinson Hyperlegible Next, Atkinson
Hyperlegible Mono, Literata, and BIZ UDPGothic are included under the SIL Open Font
License 1.1; their licence texts are served from `public/licenses/`.

The build bundles third-party JavaScript and removes its licence comments. Each build
therefore writes `licenses/third-party.txt`, which holds the licence file of each bundled
package. The build fails when a bundled package is missing from that file.
