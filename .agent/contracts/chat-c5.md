# chat-c5 — the chat panel replaces the intake panel

Tier `visual`: the free-text surface above the built-in drop-down. What a reader sees is
graded twice downstream — `tests/chat-panel.dom.test.ts` here and the user's live review — so
this unit carries dom predicates + `visual-qa` states, not a red-first battery. Source =
`.agent/spec.md` `Tasks` c5 + `Decisions` User `Chat intake REPLACES the TypeSafe intake`
(inline labels; KB tags open query cards holding the goal and the engine's verbatim solutions;
Web tags open the URLs the turn's own search returned). Lands with c6 in one commit: the App
stops mounting `IntakePanel`, which the intake suites c6 deletes still mount.

## Acceptance

| id | predicate |
|---|---|
| V1 | `App` mounts `ChatPanel` (`form[data-chat]`, `textarea#chat-message`) above the built-in combobox, and no intake surface (`form[data-intake]`). |
| V2 | An answered turn shows each segment with its tag: `kb` → one `a.tag.kb` per call, text `KB qN`, linking its card; `web` → `a.tag.web` `Web N` linking the turn's numbered source, which opens the URL in a new tab with `rel="noreferrer"`; `model` → `Model`; `unverified` → `Unverified` plus the claimed source. The status reads the answer as ready. |
| V3 | A KB card shows the call id, the outcome, the goal text as sent, and one line per solution built from the engine's `display` strings alone; a refused goal shows the engine's message; a card whose result the model read in part says how much it read. Selecting a KB tag opens the closed card list. |
| V4 | Streaming: `aria-busy` on the conversation, the latest commentary shown, Stop enabled and Send disabled; Stop lands the turn cancelled. Failure: one `role="alert"` in the panel names the reason (each of the 9), and a `codex` failure carries the bridge's message. New conversation empties the transcript. |
| V5 | Both locales render the panel's copy from the catalogs (`ja`: `送信`, `知識ベース q1`); `copy:check` passes; the Japanese subset is recut (`pnpm font:subset`) and `presentation:check` passes. |
| V6 | axe reports no violation on the idle, answered and failed states (jsdom `color-contrast` excepted, as the house dom suites do). |
| V7 | `pnpm visual-qa` gains the chat's idle, answered and failed states at 320, 375 and 1280 px, none overflowing. |
| V8 | User live review owed (`.claude/rules/ui.md` `User review`). |
