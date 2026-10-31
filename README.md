# CNL CKC Demo

A static browser demo of an executable clinical-guideline knowledge base. It runs
SWI-Prolog in a web worker, combines matching recommendations into answers for seven
prepared clinical questions, traces each cited contribution back to its source, and
exposes the full semantic graph. You can also ask a question in your own words. A GPT
model answers, and every part of the answer that the knowledge base supplies comes from a
Prolog query that ran in your browser.

The shipped answers are produced at run time. They are not stored UI fixtures.

## What is included

- A bounded SWI-Prolog/WASM query engine with cancellation and worker recovery.
- One deterministic, cited answer assembled from every matching structured Prolog
  solution, with no separately authored summaries and an exact source-passage fallback.
- A facts row under each answer statement that shows what the knowledge base marks on it: the
  grade of its recommendation in the guideline's own labels, its qualifiers such as
  `carefully`, the option it prefers, and its time bounds and orderings. A Prolog goal reads
  these marks when the answer is ready, and the answer lists that goal with the engine's
  solutions.
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
- Graph relationships for the annotations of the knowledge base: the grade of each
  recommendation, preferred options, qualifiers such as `carefully`, time limits with their
  bounds, and the numeric thresholds of conditions.
- A chat. The model writes Prolog goals, and the page runs each goal read-only in its own
  engine. Every part of an answer names its source. **KB** marks a query that ran, and its
  card shows the goal and the engine's solutions. **Web** marks a page that the turn's search
  returned. **Model** marks the model's own knowledge. A claimed source that this
  conversation's record does not hold shows as **Unverified**.
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
- The facts rows appear shortly after the answer is complete, together with the "Prolog goal
  behind these annotations" disclosure. If the annotations of a document could not be shown,
  a note under the answer says so. When that disclosure shows and no such note shows, a
  statement that has no facts row has no qualifier, preference or time bound in the knowledge
  base. A grade shows only on the first statement of each run of statements from the same
  documents.
- A **KB** tag shows that the cited query ran, not that the sentence restates its
  result. The wording is the model's. Compare the sentence with the solutions in the
  query's card.
- Model and web answers are not checked against the knowledge base.
- The chat sends your message to OpenAI through a bridge on your computer. It needs the
  `codex` CLI and a ChatGPT login.
- The controlled language is a projection. The evidence ladder identifies
  material kept, changed, or omitted.

Source: CDC. The Centers for Disease Control and Prevention developed the source
material, which is available on the agency website at no charge. Use does not
imply endorsement by CDC, the Department of Health and Human Services, or the
United States Government.

## Prerequisites

- Node.js 26. pnpm downloads the pinned Node 26 runtime and runs every script on it.
- pnpm 10 or later. pnpm reads the version that `package.json` pins, then downloads and runs
  that version. To install pnpm, see <https://pnpm.io/installation>.
- `chromiumfish` for the browser checks, for example `pnpm smoke` and `pnpm browser:check`.
  Install it with `pnpm add -g chromiumfish`. If pnpm reports that its global bin directory is
  not in `PATH`, run `pnpm setup`, open a new shell, and install it again. To use a copy in a
  different location, set `CHROMIUMFISH_DIR` to its package directory.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm kb:build
pnpm dev
```

Open the URL printed by Vite. Wait for the engine to report ready, select a
question, and select **Run**. Select a numbered citation to inspect its proof and
source. **Find in graph** activates the lazy graph and moves directly to that
answer map. Orange paths come only from the selected source contribution; muted
branches show how its primary concept connects elsewhere in the knowledge base.

Each statement shows its facts row: **Qualifier**, **Grade**, **Preferred** and **Time**. The
grade shows on the first statement from each source document. If the annotations from a source
document cannot be shown, a note under the answer says so. Open **Prolog goal behind these
annotations** to read the goal and the engine's solutions.

### Chat

The chat sends your message to a GPT model through a local bridge. The bridge runs the
`codex` CLI under its own home directory, so your personal Codex settings stay out of the
chat. Every Prolog goal that the model writes runs in the page's engine, read-only.

1. Log in once under the chat's home directory:

   ```sh
   mkdir -p ~/.config/cnl-ckc-demo/codex
   CODEX_HOME=~/.config/cnl-ckc-demo/codex codex login
   ```

2. Start the bridge in one terminal. Start the demo in a second terminal:

   ```sh
   pnpm chat:dev
   pnpm dev
   ```

3. Type a question in **Your question**.
4. Select **Send**.
5. Select a **KB** tag to open the query's card.

Without the bridge, the chat reports that the bridge did not respond. The prepared
questions still work.

For a production build:

```sh
pnpm build
pnpm preview
```

## Knowledge base

The knowledge base comes from a release of
[cnl-ckc](https://github.com/eturkes/cnl-ckc) on GitHub. `kb/` holds the release archive, its
checksum file and `kb/release.json`, which names the release. `vendor/cnl-ckc/` holds the
cnl-ckc specification sources and test fixtures at the commit of that release.

To take a new release, run this command with the release tag:

```sh
pnpm kb:fetch kb-2026-10-29-rc.1
```

The command checks the archive against the checksum file of the release and against the
digest that GitHub records, before it writes a file. `pnpm kb:build` refuses an archive that
`kb/release.json` does not name. `pnpm kb:fetch --verify` downloads the named release again and
compares each file with the files in `kb/` and `vendor/cnl-ckc/`.

## Verification

The normal deterministic gate rebuilds the vendored knowledge-base export and
checks generated assets, engine boundaries, copy, contrast, presentation,
formatting, lint, types, tests, and the production bundle:

```sh
pnpm gate
```

With `pnpm chat:dev` and `pnpm dev` running, `pnpm chat:live` checks the chat path in a real
browser. `pnpm chat:probe` reports the source labels the model earns on six fixed questions.
Both spend turns on your ChatGPT plan, so no gate runs them. The gate checks the bridge against
a scripted model instead.

The release check adds byte-for-byte knowledge-base reproduction, real-browser
proofs for the nested production build, live answers, lazy graph, responsive
states, and cancellation, and a new download of the knowledge-base release:

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
Vite emits relative URLs. The chat needs the local bridge in `server/`. It runs under
`pnpm chat:dev`, and this repository does not deploy it. The included CI workflow runs the gate on every push to
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

The demo is Apache-2.0 WITH LLVM-exception. `vendor/cnl-ckc/` holds files of cnl-ckc,
which keep their own licence: Apache-2.0 WITH LLVM-exception, with the licence and notice
files in that directory. Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono, Literata, and
BIZ UDPGothic are included under the SIL Open Font License 1.1; their licence texts are
served from `public/licenses/`.

The build bundles third-party JavaScript and removes its licence comments. Each build
therefore writes `licenses/third-party.txt`, which holds the licence file of each bundled
package. The build fails when a bundled package is missing from that file.
