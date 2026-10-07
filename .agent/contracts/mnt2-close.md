# mnt2 Close-2 — closing review check set

Fixed before dispatch. Target = the shipped surface that `git diff 70c8507..ddab59a` touched, read
at `ddab59a` (`.agent/spec.md` Decisions: judgment review reads the shipped surface). One
`reviewer` covers every lens (MAINTAIN). Findings bind to these rows; anything outside them is a
register entry. The security lens stays on MAIN.

Reviewed per unit before commit — re-read where a row asks for cross-unit effects: cap-one
`9ade964` (mnt2-reviewer-1), d5 `d6714d7` (-2), d17 `04ada8c` (-3), d41 `9056d3d` (-4), d43
`db0736f` (-5), dict `8a8a21e` (-6), failed reset `935b287` (-7), probe-control `e8f7cab` (-8).
Never reviewed: `64fb0cc`, `114ad49`, `337aeba`, `d107a16`, `f862574`, `ce75b11`, `5fd1588`,
`d2744cb`, `995e333`, `417f501`, `9d11b44`, `ddab59a`.

| id | lens | check |
| --- | --- | --- |
| A1 | engine | Every request kind (boot, solve, prove, reset, consult) reaches exactly one terminal record under normal finish, cancel, wall-clock deadline, heap exhaustion, boot failure and a reset arriving mid-flight — with d5 progress, d17 streaming, the reset retirement and the probe-control break composed. No promise stranded, no second terminal. |
| A2 | engine | Streamed answers (d17) equal the batch answer set, in order; the meter charges the goal alone; a run ends at its final record; the proof cache invalidates on solve, consult and poison, so no stale proof is shown. |
| A3 | engine | Term codec: the dict refusal (`8a8a21e`) fails closed at every encoding entry point; the integral-float declared limit (`114ad49`) matches the code and its pinned test. |
| B1 | gate | Every check added or changed in range ships a firing input that the gate or its named lane actually runs, whose refusal names the defect, and whose success line says it fired. |
| B2 | gate | No grader loosened in range — threshold, timeout, case, assertion, allowlist, tier, skip, or a frozen clock hiding a real defect — without a recorded user ruling plus the original firing. The frozen-clock cases (cap-one, selected-row) still prove the property their rows name. |
| B3 | gate | `.claude/rules/gate.md`'s chain, firing table and out-of-chain table agree with `package.json` scripts and with the code each row names. |
| C1 | product | Non-negotiable: every answer, streamed row, proof rung, intake row and corpus-browser passage shown comes from Prolog execution or the exported bag at run time — nothing hard-coded, nothing served from a cache past its invalidation. |
| C2 | product | d5/d17/d41/d43 surfaces: lazy loads as claimed (PDF.js and the corpus index unrequested until opened); every string through the catalog in both locales; one status announcement per boot phase; accepted surfaces (answer panel, ladder, combobox, theme, type, copy layout) unchanged beyond the user-approved changes. |
| C3 | product | Page viewer + corpus browser: the drawn page = the coverage row's physical page; failure paths (PDF fetch fails, passage not found, page out of range) reach a visible, recoverable state. |
| D1 | records | Each commit body in range: measurements and red-witness commands + revisions reproducible or labeled; each closed queue row closed by its own acceptance check or a recorded user ruling; each `Tasks` tick names the commit that closed it. |
| D2 | records | Rules and docs text changed in range (`.claude/rules/*.md`, `README.md`, the `docs/claims.md` dispositions of changed rows, `.agent/deferred.md`) states what the code does; no overclaim. |
