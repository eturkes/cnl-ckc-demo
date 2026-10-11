# Chat request close — closing review check set

Fixed before dispatch. Target = the shipped surface that `git diff 9cf632c..e88a9db` touched, read
at `e88a9db` (`.agent/spec.md` Decisions: judgment review reads the shipped surface). One
`reviewer` per lens (MAINTAIN), each lens its full attention. Findings bind to these rows;
anything outside them is a register entry. The security lens — the bridge's local exposure and
the read-only allowlist as a boundary — stays on MAIN (global `Subagents`).

| id | lens | check |
|---|---|---|
| P1 | product | Non-negotiable (`Intent`): every KB-labelled chat part shows only a call whose goal ran read-only on this page's engine in this conversation, and its card shows the goal as sent plus the engine's own `display` text; no path lets a fixture, the model's text, a goal that read no KB predicate, or a refused/failed call stand behind a KB tag. |
| P2 | product | Web tags resolve only to URLs this turn's own search returned or opened; Model and Unverified render as stated; a cancelled, failed or disposed turn lands no tag; a late event or result from a retired turn changes nothing on screen. |
| P3 | product | The bridge relays exactly what the contract says: the model reads `qN` + the page's text; a page answer for another conversation's or turn's call is refused; every non-`prolog_query` server request is refused with its schema shape; no turn hangs (each child wait bounded; a child ignoring interrupt retired). |
| P4 | product | The engine: an aborted runtime is never called again, its trapping query reads `limit:'heap'` or `aborted`, and the client recreates the worker before that caller resumes; catalog questions, proofs and the ladder behave exactly as before the request. |
| G1 | gate | Each kernel unit's red witness (c1–c4, recorded in its commit body) reproduces by its recorded command at its recorded base, and each suite now passes; c5's dom suite cannot collect at `f30b351`. |
| G2 | gate | Every approved grader change (engine:probe R45, claims:check repeated-index control, `tests/demo-api.test.ts` pin, c3's B7 timing clause, the census and binding rows removed with the intake) changed only what its approval names, and its original firing is recorded where the change says. |
| G3 | gate | No check the request touched can no longer fail: `binding:check`'s new REQUIRED/LIFECYCLE rows each name a passing case that a wrong implementation would fail; `kb:asset-check`'s scan roots still walk real files; `mutate` table anchors stay live. |
| R1 | records | `.agent/spec.md`, `.agent/deferred.md`, `.claude/rules/*`, README and `docs/claims.md` state what the tree does: no sentence names a retired intake surface as live, every stated figure re-derives, every new queue row carries an acceptance check. |
| R2 | records | The request's commit bodies (`e430ab9`…`e88a9db`): every measurement, red witness, live-run result and quoted firing is reproducible or labelled as a live/reported figure, and no sentence claims beyond what it measured. |
