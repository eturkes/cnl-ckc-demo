# gi public interfaces — what the acceptance suite targets

Declared before the first unit so the `tester` acceptance suite (Intent + Decisions) can pin
behaviour at seams that exist once the units land. A unit may add members; renaming one is a
change to this file, its own commit, the acceptance tests moving with it. Locked: engine, scope +
superseded reads, page handles. Guarantees only (fields open until g2 rev. 2 is re-reviewed):
the network asset.

## Test tiers

Asset and engine tests run in the vitest node project (real saved image, one worker). DOM tests
run under jsdom with the canvas adapter `src/network/canvas.ts` mocked. Rendered output — labels,
overlap, fills — belongs to `pnpm graph:check` alone (`.claude/rules/graph.md`).

## Engine (n1)

- `RunContext = { readonly evaluationDate: string | null }` — `YYYY-MM-DD`, a real Gregorian
  day, or `null` (no date, the shipped default).
- The context is a REQUIRED argument of every engine call: `EngineClient.query(goal, budget,
  context, signal?, onSolution?, options?)`, `EngineClient.prove(input, budget, context,
  signal?)`; `engine:check` pins it at every `src` call site, as it pins budgets (user-approved
  re-pin). It is copied and frozen on admission.
- An invalid date settles `{ kind: 'error', error: { code: 'context' } }` before any Prolog runs;
  a request arriving while another is open settles `{ kind: 'error', error: { code: 'busy' } }`
  before parsing, leaving the open request's results and context untouched. Both join
  `EngineErrorCode`.
- A dated proof's first step is `{ kind: 'context', goal: 'evaluation_date(YYYYMMDD)' }`; an
  undated proof has none. An undated proof is the pre-change proof up to variable renaming
  (`=@=`) with identical source lines.
- `AnswerService.ask(id, budget, context, signal?, onSolution?)`, `.marks(id, budget, context,
  signal?)`.

## Scope + superseded reads (n2)

Fixed goal texts in `src/questions/`, never catalog fields (the catalog and its pinned figures
stay as they are); the compiled predicates read family membership from facts the clinical helper
emits from the coverage sections (a recommendation's family = it + its `Implementation
considerations` documents):

- `AnswerService.scope(budget, context, signal?)` — the exclusion conditions, each with every
  source sentence (12 records → 8 conditions).
- `AnswerService.superseded(id, budget, context, signal?)` — the superseded statements of the
  question's family, each with its record (law, URL, date) and whether it derives under the
  context; empty for a family that holds none.
- `AnswerService.supersessions(budget, signal?)` — every supersession record, date-independent
  (corpus browser, network marks).
- A chat query card shows the model's goal and, as its own field, the run's evaluation date; the
  pair (goal, date) reproduces the run through the trusted API. The wrapped text never shows.

## Network asset (g2, g4) — guarantees

`kb/generated/graph/clinical-network.json`, `schemaVersion: 1`: an `envelope` (bag input digest,
producer + table digests); exactly one coverage record per bag sentence; every occurrence's
`bucket` ∈ `line` | `loop` | `shared` | `statement` | `example` and document `kind` ∈
`recommendation` | `implementation` | `supporting`; `boundaries.conditions` = the 8 exclusion
conditions, each with its source sentences, equal to `AnswerService.scope`'s. Field names beyond
these land with g2.

## Page handles (n3–n5, g5, g6)

Locale-independent, like the shipped `data-action` handles (`.claude/rules/ui.md` `Smoke`):

- Date control: `[data-action="evaluation-date"]`; empty = no date. A settled answer carries
  `data-answer-date` (its own run's date, empty for none); the ladder's run-context step carries
  `[data-proof-context]`.
- Answer panel: `[data-scope-exclusions]` (compact line + its expansion); `[data-superseded-group]`
  with `data-derived="true|false"`, each statement carrying `[data-superseded-date]`.
- Chat: a turn with a KB part holds `[data-scope-exclusions]`; each turn carries
  `data-evaluation-date` (its captured date, empty for none).
- Corpus browser: a superseded sentence carries `[data-superseded-sentence]`.
- Network: root `[data-network]`; the first view `data-view="pain"` with `data-pain` ∈
  `acute-pain` | `subacute-pain` | `chronic-pain` (acute by default); `data-view="full"`;
  `data-view="boundaries"`; kind chips `[data-kind-filter="recommendation|implementation|
  supporting"]` with `aria-pressed`. A line's panel notes that the scope exclusions apply when its
  occurrence carries the scope guard (`guards.scope`), whatever its document kind.
