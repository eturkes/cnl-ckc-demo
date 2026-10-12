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

## Verdicts

Read at `c5c4b81`. One `reviewer` per lens; security = MAIN.

| id | verdict | ruling |
|---|---|---|
| P1 | pass, conflict fixed | `chat-close-product`: passes under c1's accepted syntactic rule; its register witness `once((X = "an invented claim" ; guideline_schema_version(_)))` earned a KB tag on the real image. User ruling at the close: a KB read on EVERY success path. Fixed (`chat-c1.md` `KB read on every path`); the reviewer's probe rc 1 at `c5c4b81`, rc 0 after; G10's new case red under the old rule. The literal row text was MAIN's drafting, now matched by the tree. |
| P2 | pass | 172/172 focused chat cases; retired-turn writes, turn-scoped Web URLs, labels. |
| P3 | fail(med) → fixed | F1: `#ensure` handed an alive but uninitialized child to the second of two first turns; its `thread/start` reached codex before `initialized` (`Not initialized`). Fix: a start in flight is joined first. Witness: the reviewer's `handshake-red.mjs` rc 1 at `c5c4b81`, rc 0 after; new `tests/chat-server.test.ts` `B1 two first turns share one handshake…` (slow-initialize fake) red without the fix (`expected true to be false` + a fake schema violation), green with it. Re-review = that witness alone. |
| P4 | pass | 159/159 engine + catalog + ladder regressions; real-browser `engine:probe` incl. R45. |
| G1 | pass | Every red witness reproduced at its recorded base (c1 72 RED/194 green at `e430ab9`; c2 20 RED/6 green at `4dd9328`; c3 collection; c4 six collection + D7 9/9 RED at `2c84e74`); current 279/279, 26/26, 27/27, 154/154, c5 19/19. Corrections (register RG1/RG2, commit bodies cannot change): c4's body names its base and suite commit but no literal command — it is `pnpm exec vitest run tests/chat-binding.test.ts tests/chat-client.test.ts tests/chat-controller.test.ts tests/chat-engine.test.ts tests/chat-events.test.ts tests/chat-provenance.test.ts tests/chat-result.test.ts tests/chat-queue.dom.test.ts`; c5's suite cannot collect at `f30b351`, but its first error is `EN.TEXT.chatNetwork is not a function`, not the absent `ChatPanel` its body names. |
| G2 | pass | Each approved grader change reproduced its recorded original firing and changed only its approval's scope. |
| G3 | pass | Nine new binding names match live passing reports, 11 inventory refusal controls fire; `kb:asset-check` roots walk real files; 49 mutant anchors live; chat-c2 + R09 killed. Unrun: R45's historical browser firing, B7's historical full-load timing. |
| R1 | fail(low) → fixed | Five record defects: the retired Worker queue row (deleted, q3 ticked); the stale RESUME (deleted at the closing commit); 45 claim rows commanding deleted u16 suites (now `historical`); a 40-word README sentence (split); `stack.md`'s "every answer" (now the answers presented as the KB's). |
| R2 | pass | Focused offline counts and stated bounds re-derive; live figures are labelled reported, never reproduced. |
| S | pass (MAIN) | The bridge behind the real Vite proxy: a cross-site or missing `Origin` → 403, a rebinding `Host` → Vite's own 403, a direct rebinding `Host` or `null` origin → 403, `text/plain` → 415; only the allowlisted origin reaches a turn. Found + fixed: a search result URL with a `javascript:` scheme became a live link; the panel now links only `http(s)` URLs (`V2 … not http(s)` red with `javascript:` admitted). The trust boundary stays the machine (`chat-c3.md`). |
