# mnt-d63 — a per-rule judgment narrows section-triggered selection

Row: `.agent/deferred.md` "A section "yes" selects every pain-compatible unconditional rule of
that section" (`pri` low). User ruling: approve a request change plus ONE live billed
`pnpm intake:probe` run. The design below amends the `.agent/spec.md` Decisions
**Selection model**, so it needs approval before any production edit.
Tier: `kernel`, because selection decides which shipped recommendations a description reaches.

## Baseline (`tests/intake/report.json` at `70c8507`)

- Held-out set: 30 cases. Derived rules 240, gold 163, true positives 143. Precision 143/240,
  recall 143/163. Outcomes: 27/30 match gold (answered 16/18, no-match 5/6, refused 6/6).
- 95 of the 97 false positives are section-triggered. 22 of the 48 rules are unconditional and
  reach a description only through their CDC Box 3 section Noul.

## Request change (one request, as today)

- `buildRequest` adds one Noul per unconditional rule (22), keyed `r<rule ordinal>`. Its
  instructions are: "Does `description` raise a decision that `recommendation` addresses?",
  with `recommendation` = that rule's aligned English passage. `kb:build` writes the passage
  into `intake-vocabulary.json` as `rules[].text`, read from the provenance model the ladder
  already shows. Nothing is generated or composed at run time.
- Every other question stays byte-identical: 24 condition Nouls, the pain Choice with its
  `other` hatch, 4 section Nouls, candidate-term Nouls.
- No goal, predicate or executable surface is added. Each selected id still runs its build-time
  `clinical_derive/4` goal, unchanged.

## Selection (decided by the one billed run)

Two policies are scored offline over the SAME recorded responses:

- **A (AND):** an unconditional rule answers iff its section Noul AND its rule Noul are ≥ 0.5,
  and it is pain-compatible.
- **B (rule alone):** an unconditional rule answers iff its rule Noul is ≥ 0.5 and it is
  pain-compatible. The section Noul still feeds nothing else.

Conditional rules are unchanged under both.

## Acceptance (the row's own check)

- The shipped policy lifts precision above 143/240 and holds recall ≥ 143/163 on `pnpm
  intake:probe`, re-derived through `tests/intake-replay.test.ts` from the rewritten
  `tests/intake/replay.json`. A tie on both goes to A, the narrower change.
- The gate keeps grading the committed replay plus the forced-arm control. Live accuracy stays
  REPORTED per case, never gated.
- Reported, not gated: outcome agreement against today's 27/30, and request token totals
  against today's.
- If neither policy meets the check, the request change is reverted and both policies'
  figures land in the row. The row then stays open, owed to you. No second billed run without
  your approval.

## Records

- `.agent/spec.md` Decisions **Selection model**: the unconditional-rule clause is amended to the
  shipped policy, with the original text recorded in the commit body.
- `.claude/rules/proof.md` `Free-text intake selects`: the 95/97 figure is replaced by the new
  report's figures.
