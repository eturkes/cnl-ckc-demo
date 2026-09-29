# Contract — u16 close review

Fixed check set for the judgment pass that gates the u16 IMPLEMENT close. Written BEFORE the
surface is read; rows are adjudicated into `.agent/review.md`, and the phase closes when every
row carries a verdict and none stays open.

## Scope

The SHIPPED u16 surface at the closing commit (user ruling: review reads the shipped surface,
not a commit range): `tools/kb/intake.mjs`, `src/intake/`, `src/demo/DemoController.svelte.ts`,
`src/App.svelte`, `src/i18n/`, `worker/`, `wrangler.jsonc`, `vite.config.ts`,
`tools/intake-probe.mjs`, `tools/binding-check.mjs`, `tools/kb/check.mjs`, `tests/intake*`,
`tests/intake/`, `README.md`, `.claude/rules/{proof,gate,kb-build}.md`,
`.agent/contracts/m5u16.md`, `.agent/deferred.md`, `docs/claims.md` u16 rows.

- Accepted, never a finding: visual design, layout, colour, type, spacing, copy layout of every
  pre-u16 surface (user ruling); the u16 layout rulings in `.agent/spec.md` `Decisions`.
- Out of scope, owned by MAIN (security lane): key custody, origin + rate-limit trust gate,
  scanner configuration — rows `M1`–`M2`.

## Authority

1. `.agent/spec.md` `Intent` — **"Answers reflect real Prolog execution over the exported KB,
   never hard-coding."**
2. `.agent/spec.md` `Decisions`, user rulings first.
3. `.agent/contracts/m5u16.md` predicates + `Rulings during the build`, as written.
4. `.claude/rules/` law.
5. Project `CLAUDE.md` `Engineering` + `Authoring`.

Demo-tier rigor applies off the answer path; report honesty is unwaived everywhere.

## Rows

| id | lens | check |
|---|---|---|
| X1 | correctness/spec | Every recommendation the intake shows is rendered from a `Rule` the engine derived for that id in this run; no path renders artifact, judgment or fixture text as a recommendation. |
| X2 | correctness/spec | The judgment can select only shipped rule ids and the user's own words; no provider-authored string reaches the page as a recommendation or a gap term. |
| X3 | correctness/spec | Cross-unit seams agree: browser digest ↔ Worker digest ↔ artifact; `buildRequest` in browser, Worker and probe is one function; the engine queue orders intake derivation against query + proof, and nothing runs before boot. |
| C1 | claim soundness | Every sentence the README, the en/ja intake copy and the new rule text states about intake is true of the shipped code and data. |
| C2 | claim soundness | Every number quoted about the live probe (README, `proof.md`, `deferred.md`, commit bodies) equals what `tests/intake/report.json` and `tests/intake/replay.json` hold. |
| G1 | guarantee-vs-claim | Each guarantee the u16 docs state has a check that can fail on its violation, run by `pnpm gate`, or the doc names it as unchecked. |
| G2 | guarantee-vs-claim | Each failure mode — proxy down, stale vocabulary, rate limit, engine not booted, a rule that fails to derive — reaches the user as its own honest state, never as a no-match or a recommendation. |
| I1 | verification integrity | Each kernel sub-unit commit (u16b–u16g) records a red witness with its revision + command, and the witness reproduces. |
| I2 | verification integrity | Every changed pre-existing grader case is equal-or-stronger on what it always graded, user-approved, with its original firing recorded; no case skipped, deleted or demoted. |
| I3 | verification integrity | `binding:check` `REQUIRED` + `LIFECYCLE` name the intake answer-path and terminal-state cases; each named case exists and can fail. |
| F1 | CLAUDE.md conformance | Agent-facing text (rules, contract, deferred rows, comments) is dense and states the why; human-facing text (README, copy) is ASD-STE100 register. |
| F2 | CLAUDE.md conformance | No dead code, no duplicated logic across browser/Worker/probe/tests, `.agent/spec.md` holds live law only, superseded text pruned. |
| M1 | security (MAIN) | The key reaches only the Worker's SDK client and the keyed probe; no response, log, commit or bundle carries it; the SDK stays out of `src/` and `dist/`. |
| M2 | security (MAIN) | `audit:check`, `secret:check` and ESLint's security layer cover `worker/` and stay green at the closing commit. |
