# chat-c4 — the browser chat: client, controller, provenance

Tier `kernel`: the answer path of the chat. Every KB-labelled sentence the page shows is
admitted here, and nothing downstream re-checks it. Source = `.agent/spec.md` `Tasks` c4 +
`Decisions` User `Chat intake REPLACES the TypeSafe intake` + `.agent/contracts/chat-plan.md`
`Design` (`Wire`, `Answer schema`). Non-negotiable (`Intent`): **answers reflect real Prolog
execution over the exported KB, never hard-coding.**

## Seam

- `src/chat/events.ts` (pure): `parseEvent(line: string): ChatEvent | undefined` over the c3
  wire (`.agent/contracts/chat-c3.md` `Seam`), discriminated by `type`. A line that is not one
  well-formed event yields `undefined`.
- `src/chat/client.ts`: `HttpChatClient` — `turn(message, conversation | undefined, onEvent,
  signal)` posts the c3 form to `/api/chat/turn` and hands each parsed event to `onEvent` in
  order, resolving `'done' | 'network' | 'server' | 'protocol'` (`protocol` = a line
  `parseEvent` refused, or a stream that ends without `done`); `result(conversation, call,
  text, ok)` posts `/api/chat/result`. Form bodies only; `src/` stays free of `JSON.stringify`
  (`kb:asset-check`). A `ReplayChatClient` answers from recorded events, offline.
- `src/chat/result.ts` (pure): `toolResult(outcome: QueryOutcome): { text, ok, shown, total }`
  = the text the model reads for one call, built from the engine's own `display` strings
  alone: the outcome kind, then one line per solution `Name = <display>`, joined `, `. Capped at
  `TOOL_RESULT_MAX = 8000` characters at a solution boundary, with a closing line naming the
  solutions left out; a FIRST solution longer than the cap is cut inside itself and marked
  `[cut at <n> of <m> characters]`, so the model always reads something and knows it is partial. `ok` = the goal ran: `solutions`, `failure` or `limit`. A `guard`
  refusal and every other error read `refused`/`error` + the engine's message.
- `src/chat/provenance.ts` (pure): `parseAnswer(text)` reads the c3 `outputSchema` shape — anything
  else yields `undefined`. `resolveSegments(segments, ledger)` labels each segment:
  - `kb` iff its claimed source is `kb`, `queries` is non-empty, and every id names a call of
    THIS conversation whose goal ran (`ok`);
  - `web` iff its claimed source is `web`, `urls` is non-empty, and every URL equals a result
    `url` or an opened-page URL of THIS TURN's searches (the user's ruling: "Web tags open the URLs
    the turn's own search returned");
  - `model` iff its claimed source is `model`;
  - otherwise `unverified`, carrying the claimed source. A segment can never be upgraded.
- `src/chat/ChatController.svelte.ts`: one conversation. `submit(message)` runs a turn; each
  `query` event runs its goal READ-ONLY on the demo's engine queue (`DemoController.runGoal`,
  the same `#exclusive` as every catalog run), records a KB card — call id, goal text as sent,
  the outcome, the engine's solution `display` strings, `shown`/`total` — and posts
  `toolResult` back; `search` events are recorded as web sources; `answer` resolves through
  `parseAnswer` + `resolveSegments` (an unparsable answer shows as one `unverified` segment of
  its raw text). Labels land only when the turn ends `done` with no `error` event; a turn that
  fails, is cancelled or is disposed lands no segment, and no result is posted once its run
  token is retired. `cancel()` aborts the turn's fetch and its running goal. A turn while one is
  live is refused.
- `DemoController.runGoal(goal, signal)` → `Promise<QueryOutcome> | undefined` (`undefined` =
  no engine ready), dispatching `EngineClient.query(goal, CHAT_BUDGET, signal, undefined,
  { readonly: true })` through the queue. `CHAT_BUDGET` = `DEMO_BUDGET` with `answerCap: 50`.

## Public shapes

Stated to `chat-tester-4` before its suite, from the code's own declarations: `ChatEvent`
`search` = `{query, opened: string | undefined, results}` (an `openPage`/`findInPage` action's
URL; the action itself is dropped); `ChatClient.turn` awaits `onEvent` per event;
`ReplayChatClient.posted` records each result post; `parseAnswer` returns the segment array or
`undefined`; `Ledger` = `{ran, urls}`; `ChatController` exposes `messages` (whole-array
replacement), `busy`, `submit`, `cancel`, `reset`, `dispose`; an answer that is not the segment
shape lands as ONE `unverified` segment holding its text. `DemoController` gains `CHAT_BUDGET` +
`runGoal`, widening `tests/demo-api.test.ts`'s pinned surface by exactly those two names (user
ruling; the original pin fired on both).

## Declared limit

A `kb` label certifies CITATION, not entailment: every cited call ran over the KB in this
conversation, and its card shows the goal and the engine's verbatim solutions beside the
sentence. The sentence itself is the model's wording; no check here judges prose. c1 refuses a
goal that reads no KB predicate, which closes the pure echo (`X = "an invented claim"` ran and
returned its own literal, `chat-consultant-3` K6), but a goal that reads the KB can still bind a
constant the model wrote. The card is what lets the reader see that. Since the close fix, every
way a goal can succeed must read the KB (`chat-c1.md` `KB read on every path`), so only a
constant conjoined with a KB read remains.

## Acceptance

| id | predicate |
|---|---|
| D1 | `parseEvent`: each of the 7 event types round-trips its documented fields (`search` = `query`, `results`, and `opened` = the URL of an `openPage`/`findInPage` action); a line with an unknown `type`, a missing or mistyped field, invalid JSON, or a non-object yields `undefined`. |
| D2 | `toolResult` over real outcomes from the shipped image: solutions render `Name = <display>` from the engine's `display` text verbatim; a result over `TOOL_RESULT_MAX` is cut at a solution boundary, names how many solutions it left out, and stays ≤ the cap; `failure` reads as zero solutions and `ok`; a `guard` refusal reads `refused` with the engine's message and is not `ok`; a `limit` names its limit and is `ok`; a first solution over the cap is cut inside itself with its marker, and the text stays ≤ the cap. |
| D3 | `resolveSegments`: each rule above both ways — a `kb` segment citing an unknown id, an id from another conversation, an id whose goal was refused, or no id at all → `unverified`; a `web` segment with a URL no search returned, a URL only an EARLIER turn's search returned, or no URL → `unverified`; a `model` segment stays `model`; claimed `kb` citing a call that ran with zero solutions → `kb`. |
| D4 | Binding (non-negotiable, `binding:check` `REQUIRED`): the REAL `ChatController`, over a host that runs each goal read-only on a real `EngineSession` with the shipped image, fed one recorded `query` for a goal over `guideline_entity/4`: a PID-unique `guideline_entity/4` overlay (declared through `dynamic/1`, `.claude/rules/proof.md` `Binding a test to real execution`) changes the card's solutions AND the result text actually posted to the client, and retracting it restores both. Two controls in the same suite must fail the binding assertions: a host returning a fixed outcome, and a controller path that never dispatches to the host. |
| D5 | `ChatController` over a `ReplayChatClient` + a fake engine host: a recorded turn (commentary, two queries, one search, answer) produces two KB cards in call order, the posted results equal `toolResult` of the host's outcomes, and the final segments carry their resolved labels; the queries run read-only (the host sees `readonly: true`) and one at a time. |
| D6 | Lifecycle: `cancel()` mid-turn — before a goal settles, after it settles but before its post, and after the answer event but before `done` — posts nothing further and lands a cancelled message with no segments; an `error` event followed by an `answer` lands failed with no segments; `dispose()` mid-goal posts nothing; a `network`/`server`/`protocol` turn ends in a failed message naming its reason; a c3 `error` event names its reason; a second `submit` while live is refused; `dispose()` aborts the live turn. |
| D7 | Queue: a chat goal issued while a catalog run is live dispatches only after that run settles; one issued while a selected-solution proof runs, only after that proof settles; a catalog run issued while a chat goal runs, only after the goal settles; and no result reaches another's state (`DemoController` dom test). |
| D8 | `HttpChatClient` against a scripted `fetch`: form bodies with the c3 field names, events handed over in order across chunk boundaries that split a line, `protocol` for a stream ending without `done`, and an aborted signal ends the turn without a further event. |

Amended before code from `chat-consultant-3` K1–K6: the declared limit, turn-scoped web URLs,
the in-solution cut, the label-landing rule, and D4/D6/D7's witnesses.

## Out of scope

The panel and its copy (c5), the bridge (c3), the TypeSafe intake's removal (c6), and live model
behaviour (c7). Proofs for a model goal: the KB card shows the goal and its solutions; the
ladder stays the built-in questions' derivation view.
