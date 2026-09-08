# Review ledger — IMPLEMENT

Adversarial-review rows for the IMPLEMENT phase, resumed across compactions and sessions.
Empty until the first unit closes; the phase closes when every row is adjudicated.

Method, termination rule and the two-tier report shape → `CLAUDE.md` `Engineering`.
Wave mechanics → `.claude/rules/waves.md`.

Rows carry `| id | verdict | source | finding | evidence |`; a verdict opens `pass:` or
`fail(low|med|high):`. A ruling holds until new evidence reverses it. Findings bind to the
unit's acceptance contract in `.agent/contracts/`; anything outside it reports as a register
entry and becomes a `.agent/spec.md` `Deferred` row or expires with the report.

The expedited-surface ledger this one succeeds — 46 rows, 11 pass / 35 fail, and the four
user rulings that opened the current unit set — is `.agent/archive/review-expedited.md`. The
M1 judgment ledger, 370 rows over 6 sessions, is `.agent/archive/review-m1.md`.

## Rows

_(none yet)_
