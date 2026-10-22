# n19 — a development page for the live review of n9's checked-comparisons list · dev tier

User ruling (this request's question round, on the owed n9 review): build a review page. n9's list
(`c7b9b7d`) renders only for a proof holding a comparison, no catalog question's proof holds one,
and `.claude/rules/ui.md` `User review` makes the user's review the live interface — so the live
app has no click path to the list.

Tier: dev. The page never ships, and a defect shows on the page itself the moment the user opens it;
the one silent defect — a goal whose proof stops passing a comparison, leaving a list-free ladder —
is V1's.

## The change

1. `review.html` (repo root) → `src/review/main.ts` → `src/review/ComparisonReview.svelte`: the
   real engine boots in its worker, proves `COMPARISON_GOAL` through the proof RPC a catalog trace
   takes (`EngineClient.prove({ constrainedGoal }, PROOF_BUDGET_MAX)`), and the shipped
   `ProvenanceLadder` renders the outcome beside the shipped `LanguageToggle` and `ThemeToggle`.
   The page renders no string of its own: every word is the catalog's or the engine's.
2. `src/review/goal.ts` `COMPARISON_GOAL` = upstream's `tablet-use-spacing` export goal in operator
   syntax; its proof passes `guideline_satisfies/6`.
3. `vite build` keeps its one input, `index.html`: the page and its modules stay out of `dist/`.

## Acceptance

| id | predicate | how it is decided |
| --- | --- | --- |
| V1 | `COMPARISON_GOAL` settles `proof` through the session's proof RPC; the ladder's own derivations over its steps hold a clause with a document (so the ladder's ready branch renders) and list exactly one comparison, `guideline_satisfies(geq,4,hour,geq,4,hour)` | `tests/proof-comparison.test.ts` V1; red on a planted input: `COMPARISON_GOAL` cut to its first literal, whose proof holds no comparison, fails by assertion |
| V2 | `pnpm dev` serves `/review.html`; in a real browser the ladder lists the comparison with its `checked by the schema` badge in English and Japanese, light and dark, at 1280 and 375 px, no horizontal overflow | captures, inspected by MAIN (visual QA, not a gate check) |
| V3 | `pnpm build` writes no review page: `dist/` holds no `review.html`, and no file carries the goal's text | one run after `pnpm build`, positive control on `src/review/goal.ts` first |
| V4 | `pnpm gate` rc 0: lint, check, format and copy:check reach the new files | gate |

The user's live review of the list stays owed until the user rules (`.agent/spec.md` Tasks).
