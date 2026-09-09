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

_(none yet)_
