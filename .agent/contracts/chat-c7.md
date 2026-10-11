# chat-c7 — the live chat lanes

Tier `data`: two keyed, networked lanes over the shipped chat, reported and never gated — the
model has no determinism control, so a gate on its wording would grade the weather. Both need
`pnpm chat:dev` + `pnpm dev` running and the user's login under the chat's `CODEX_HOME`.

## Acceptance

| id | predicate |
|---|---|
| L1 | `pnpm chat:live` (`tools/chat-live.mjs`): one fixed KB question, in a real browser against the running page, bridge and model, settles `answered` with at least one KB part; every KB tag names a card of its turn that shows the goal; at least one card holds an engine solution; the page raises no error. Exit 1 names the first miss. |
| L2 | `pnpm chat:probe` (`tools/chat-probe.mjs`): six fixed questions (three KB, one web, two model-only) each answered in a fresh conversation; prints one JSON report — per question its state, every part's label, tags and text, every card, every source, and the time — plus how many earned their expected label. Never exits 1 on the model's answers. |
| L3 | The bridge creates its `CODEX_HOME` when absent: codex refuses a home that does not exist before it reads any login. |
| L4 | The results of the run that closes the request are recorded in its commit body, by question. |
