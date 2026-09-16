# Review ledger — IMPLEMENT

Adversarial-review rows for the IMPLEMENT phase, resumed across compactions and sessions.
A row lands when a judgment pass adjudicates one; the phase closes when every row is
adjudicated. u3-u10 closed with their mechanical checks alone, so the table below is still
empty and the judgment pass over them is outstanding.

Method, termination rule and the two-tier report shape → `CLAUDE.md` `Engineering`.
Wave mechanics → `.claude/rules/waves.md`.

Rows carry `| id | verdict | source | finding | evidence |`; a verdict opens `pass:` or
`fail(low|med|high):`. A ruling holds until new evidence reverses it. Findings bind to the
unit's acceptance contract in `.agent/contracts/`; anything outside it reports as a register
entry and becomes a `.agent/deferred.md` row or expires with the report.

The expedited-surface ledger this one succeeds — 46 rows, 11 pass / 35 fail, and the four
user rulings that opened the current unit set — is `.agent/archive/review-expedited.md`. The
M1 judgment ledger is `.agent/archive/review-m1.md`; it carries its own per-unit tallies,
which disagree with its row table, and nothing live depends on the total.

## Rows

Seeded from the fixed 32-row check set in `.agent/contracts/review-implement.md` — A architecture 8, S semantic 8, G graph 6, C assurance 10. The set is fixed BEFORE the diff is read, which is what makes the review terminate; every row is adjudicated and the count of rows adjudicated is the deliverable, so an all-`pass` table is a complete review. A row whose verdict cell is still the seeded placeholder is unadjudicated and blocks
the phase close, so `command grep -c '^| [A-Z][0-9]* | unknown' .agent/review.md` is the
progress counter and reads 32 at seed.

| id | verdict | source | finding | evidence |
|---|---|---|---|---|
| A1 | unknown | unknown | unknown | unknown |
| A2 | unknown | unknown | unknown | unknown |
| A3 | unknown | unknown | unknown | unknown |
| A4 | unknown | unknown | unknown | unknown |
| A5 | unknown | unknown | unknown | unknown |
| A6 | unknown | unknown | unknown | unknown |
| A7 | unknown | unknown | unknown | unknown |
| A8 | unknown | unknown | unknown | unknown |
| S1 | unknown | unknown | unknown | unknown |
| S2 | unknown | unknown | unknown | unknown |
| S3 | unknown | unknown | unknown | unknown |
| S4 | unknown | unknown | unknown | unknown |
| S5 | unknown | unknown | unknown | unknown |
| S6 | unknown | unknown | unknown | unknown |
| S7 | unknown | unknown | unknown | unknown |
| S8 | unknown | unknown | unknown | unknown |
| G1 | unknown | unknown | unknown | unknown |
| G2 | unknown | unknown | unknown | unknown |
| G3 | unknown | unknown | unknown | unknown |
| G4 | unknown | unknown | unknown | unknown |
| G5 | unknown | unknown | unknown | unknown |
| G6 | unknown | unknown | unknown | unknown |
| C1 | unknown | unknown | unknown | unknown |
| C2 | unknown | unknown | unknown | unknown |
| C3 | unknown | unknown | unknown | unknown |
| C4 | unknown | unknown | unknown | unknown |
| C5 | unknown | unknown | unknown | unknown |
| C6 | unknown | unknown | unknown | unknown |
| C7 | unknown | unknown | unknown | unknown |
| C8 | unknown | unknown | unknown | unknown |
| C9 | unknown | unknown | unknown | unknown |
| C10 | unknown | unknown | unknown | unknown |
