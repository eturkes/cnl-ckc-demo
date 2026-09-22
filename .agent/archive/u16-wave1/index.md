# u16 wave 1 — orientation harvest

Base `5fa418f`. Wave = 5 teammates, analysis-only, no worktrees, all 5 complete (0 unfilled
rows, marker each). **Nothing was built.** Session wound down at user request before the
contract was written.

Durable here: `res-proxy.md` + `res-judgment.md`, verbatim, because their web-derived API
shapes and code sketches do not re-derive from the tree. The three `map` reports stay in
`.scratch/agents/` — they re-derive from `src/` and `tools/` — at
`map-ui-1.md`, `map-kb-1.md`, `map-close-1.md`.

## Wave roster + verdict

| name | role | scope | verdict |
|---|---|---|---|
| map-ui-1 | map | shipped UI surface, controller, i18n, a11y, attachment point | 12/12 rows, accepted |
| map-kb-1 | map | `tools/kb/` producers, `clinical_rule/3` bytes, control seam, asset validation | 12/12 rows, accepted; remeasured the vocabulary independently |
| map-close-1 | map | contract/review/deferred/claims/rules/CI close surfaces | 12/12 rows, accepted |
| res-proxy-1 | res | Cloudflare Worker key-custody proxy | 10/10 rows, accepted |
| res-judgment-1 | res | Jev seam, SDK shape, stub, probe set | 10/10 rows, accepted; **found one blocking gap** |

## THE BLOCKING GAP — resume by asking the user

`.agent/spec.md` requires a third on-screen outcome naming *what the description asserts that
the KB has no vocabulary for*. **The ruled primitive set cannot produce that list.** A Noul
returns a probability alone; a Choice returns one of the options the caller supplied. Neither
emits an arbitrary phrase, and inventing `unsupportedTerms` in the response parser would be
exactly the fabrication the non-negotiable forbids.

Four ways out. Put them to the user before writing the contract:

- **B — deterministic candidate discovery, then judge.** Extract candidate noun phrases from
  the user's own description in code, then one Noul per candidate: *is this asserted by the
  description, and absent from the KB condition vocabulary?* Candidates come from the user's
  text, so nothing is generated. Most faithful to the Intent. **Recommended.**
- **A — fixed out-of-KB vocabulary.** Author a bounded list of known-absent clinical concepts
  (numeric dose thresholds, sleep-disordered breathing, …) and run Nouls over it. Bounded and
  cheap, but only names gaps somebody predicted.
- **D — name the nearest covered concept instead.** A Choice over the 24 conditions plus
  `none`, reporting what the KB *does* cover near the description. Inverts the story.
- **C — no naming.** Show "no guideline vocabulary matches" with no term list. Weakest; drops
  the anti-hallucination surface the Intent asks to make visible.

## User rulings from this session — binding, carry into `Decisions`

1. **Key handover = paste in chat.** The key had NOT arrived when the session wound down, so
   the live arm is still unfunded. It goes only to a gitignored `.dev.vars` and a Cloudflare
   secret; never a commit.
2. **MAIN deploys the Worker too**, not commit-only. Needs `CLOUDFLARE_API_TOKEN` (Workers
   Scripts:Edit) + `CLOUDFLARE_ACCOUNT_ID` from the user. The committed `connect-src` then
   names the real origin rather than a placeholder.
3. **Layout = free text first, drop-down below.** The textarea is the primary intake at the
   top of the ask section; `QuestionCombobox` keeps its exact look and moves under it as the
   "or pick a built-in question" path. Both always visible. This refines map-ui-1's U8, which
   proposed a sibling section — the ruling places it inside the same flow, above the combobox.
4. **Japanese = copy parity only.** `en.ts`/`ja.ts` key parity as `copy:check` already
   enforces. Japanese free-text intake is NOT graded; the probe set and its gold are English.
   No bilingual-intake claim is made in either direction.

## What the maps established that the build needs

**Producer side** (`map-kb-1`, remeasured independently, read-only, from the verified bag):

- `clinical_rule/3` is **not a bag member**. `tools/kb/clinical.mjs:631-638` derives it from
  the selected `ace/<Doc>.ace` sentences and matching `pl/<Doc>.pl` sites. Bag members
  containing `clinical_rule(` = 0; helper facts = 48.
- Shape:
  `clinical_rule(Doc,S,rule([Cond],Subject,Mode,[action(Polarity,Verb,Object,[modifier(Prep,Value)])])).`
  Example: `clinical_rule('cdc2022-opioid-rec01',2,rule([],"Every clinician",should,[action(positive,maximize,"a nonopioid-therapy",[modifier(for,"an acute-pain")])])).`
- Independent remeasurement **confirms the spec**: rules 48, documents 12, condition
  occurrences 26, distinct conditions 24, unconditional 22, modifier occurrences 74, distinct
  modifiers 27. Exact command in `map-kb-1.md` detail K4.
- New producer template = `tools/kb/catalog.mjs`. New asset obligations: a manifest
  `{kind,path,bytes,sha256}` entry, stable bytes from sorted verified inputs, a structural
  validator in `tools/kb/check.mjs`, and a `requireFiring` control mutating the REAL model.
- `requireFiring(check, { mutation, expect }, grade)` at `tools/control.mjs:21`.
- Typed-artifact convention: `import generated from '@kb/<name>.json'`, interfaces declared
  beside the consumer, schema version pinned and refused on mismatch, frozen typed export. No
  generated `.d.ts`.
- `binding:check` row = `{suite, why, cases:[exact full test names]}` in `REQUIRED` (answer
  path) / `LIFECYCLE` (view claims) / `MEANING` (graph polarity).

**UI side** (`map-ui-1`):

- Attachment: `src/App.svelte:127-177` `<section id="ask" class="workbench">`, whose
  `.query-area` at `:136` holds `QuestionCombobox` at `:137` and `RunControls` at `:144`.
  Ruling 3 puts the textarea above that combobox. `AnswerPanel` `:164`, ladder and CSS stay
  byte-unchanged.
- `DemoController.svelte.ts` owns `booting|boot-error|idle|running|cancelling|settled`
  (`:71-77`); the sole shipped query call is `src/questions/service.ts:58`.
- Async surface pattern to copy: pre-mounted `role="status"` + `role="alert"`
  (`RunControls.svelte:60-61`), `aria-busy` on the result region, abort stale work and
  suppress aborted errors, failure gets Retry plus focus restore.
- `copy:check` limits: English ≤20 words per instruction and ≤25 elsewhere plus a filler ban;
  Japanese is graded on key parity alone.

**Close side** (`map-close-1`):

- Contract format = `.agent/contracts/m5u15.md` heading order; `m5u16.md` does not exist yet.
- Acceptance row form, verbatim example at `.agent/archive/contracts/m5u1.md:232`: bind the
  RED count to a base SHA and put the byte-restoration plus grading command in the row.
- `.agent/review.md` columns `id/verdict/source/finding/evidence`; currently 32/32 ruled, 0
  open. `.agent/deferred.md` = 58 prose bullets, each `Accept: <check>` plus `pri`.
- `claims:check` close loop, in order: `pnpm claims:seed` → adjudicate every `unknown` row →
  `pnpm claims:seed` again → `pnpm claims:check`. Hazard: the seed keys on the stored
  150-character claim, so inspect any long u16 claim's carried cells even when no `unknown`
  remains.
- `.claude/rules/proof.md`: the new law attaches at the end of
  `Source-fragment / antecedent records (clinical.mjs)` or as a new H2 before
  `Query-local assumption evaluator`.
- CI: `pages.yml` and `security.yml` both pin Node `20.19.0`; the Wrangler lane must be its
  own Node 22 job and must not lift either pin, merge into the secretlint-capped gate job, or
  disturb the Pages `build → deploy` dependency.

## Inputs the user still owes

`TYPESAFE_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the account
subdomain or custom origin. The exact `README.md:113` `connect-src` value cannot be final
until that origin exists; the syntax is
`connect-src 'self' https://cnl-ckc-intake.<ACCOUNT>.workers.dev;`.

## Headline research rulings

Detail and code sketches → `res-proxy.md`, `res-judgment.md`.

- Wrangler 4.136.2 needs Node `>=22`; `cloudflare/wrangler-action@v4`; free Workers ceiling is
  100k requests/day and 10 ms CPU, and it **errors rather than throttles** (1027 at the daily
  cap, 1102 on CPU), so the browser must map that to "intake unavailable, retry" and never to
  "no match".
- Worker shape: one fixed POST route, secret binding, exact-origin CORS with `Vary: Origin`,
  64 KiB request and 256 KiB response bounds, 15 s abort, aggregate Rate Limiting binding.
  Origin pinning stops hostile browser pages, not raw clients, so rate limiting is mandatory.
- Jev = `jev-1.13.0` at `POST https://api.typesafe.ai/v1/systemone`; SDK `@typesafe-ai/sdk`
  0.6.0, `systemOne({state, model, questions})` with `noul()` / `choice()` builders.
- **No determinism promise.** No documented `temperature`, `seed` or `top_p`; pinning the
  model version is the only control. Plan the probe set around that.
- SDK casts any 2xx body without validating it, so a `parseJevResult` runtime validator is
  mandatory: resolved model, exactly the declared answer ids, finite values in [0,1], complete
  Choice distribution, allowed option.
- Cost ≈ $0.000133 per request at ~3,168 input tokens, ~0.75 s; input billed at $0.042/M,
  output free. Capture the first live `usage` rather than trusting that estimate.
- Gate stays offline: production posts to the Worker, the stub exact-matches committed
  fixtures and throws on a miss, and no gate test imports the provider SDK.

## Resume order

1. Put the blocking gap above to the user; collect the key and the Cloudflare inputs.
2. Write `.agent/contracts/m5u16.md` — tier `kernel`, testable predicates before code.
3. Producer first (condition/modifier/scope artifact + validator + firing input), then the
   `JudgmentClient` seam under the stub, then the Worker, then the UI, then the probe set with
   its forced-arm control.
4. `rev` per lens, `.agent/review.md`, then `Phase: MAINTAIN`.
