# chat-c3 — the local chat bridge

Tier `kernel`: the seam between the model and the browser engine. No downstream check re-reads
what crosses it: a goal it forwards is what runs, a result it relays is what the model reads, a
source it reports is what the browser checks citations against. Source = `.agent/spec.md`
`Tasks` c3 + `.agent/contracts/chat-plan.md` `Design` `Wire` + `Isolation`.

`server/chat.mjs` = a local Node HTTP server holding ONE persistent `codex app-server` child
(newline-delimited JSON-RPC 2.0 on stdio, the shape of `../live-stt/` `CodexTranslator`). It
never runs a goal: the browser runs every goal in its own engine and posts the result back.

## Seam

- Start: `pnpm chat:dev` = `node server/chat.mjs`. Binds `127.0.0.1:8792` (`CHAT_PORT`). The child
  = `codex app-server` + the `-c` set below, env `CODEX_HOME` = `CHAT_CODEX_HOME` else
  `~/.config/cnl-ckc-demo/codex`; the binary = `CHAT_CODEX_BIN` else `codex` (tests point it at a
  fake). `-c`: `web_search="live"`, `project_doc_max_bytes=0`, `mcp_servers={}`, and `false` for
  `features.{shell_tool,unified_exec,view_image,multi_agent,image_generation,browser_use,
  browser_use_external,computer_use,apps,plugins,tool_suggest,sleep_tool,goals,hooks,
  skill_search,memories}`.
- Handshake: `initialize` with `capabilities.experimentalApi: true`, then `initialized`. A child
  that exits is respawned at the next turn, once; its conversations are gone.
- Conversation = one ephemeral thread: `thread/start` `{model:'gpt-6.1-sol', cwd:<empty temp
  dir>, sandbox:'read-only', approvalPolicy:'never', ephemeral:true, personality:'none',
  developerInstructions:<server/chat-guide.md>, dynamicTools:[prolog_query]}`;
  `prolog_query` input = `{goal: string}`, `additionalProperties: false`. Turn = `turn/start`
  `{threadId, input:[{type:'text', text}], effort:'medium', summary:'none', outputSchema}`;
  `outputSchema` = `{segments:[{text, source:'kb'|'web'|'model', queries:[string], urls:[string]}]}`,
  every property required, no others.
- `POST /api/chat/turn`, form `message` (1–4000 chars) + optional `conversation`, answers
  `200 application/x-ndjson`, one JSON object per line, discriminated by its `type` field (`{type:'query', call, goal}`), in order:
  `conversation{id}` (always first) · `commentary{text}` · `query{call, goal}` ·
  `search{query, action, results:[{url, title, domain, snippet}]}` · `answer{text}` ·
  `error{reason, message}` · `done` (always last). `reason` ∈ `auth` · `busy` · `expired` ·
  `codex` · `timeout` · `interrupted`.
- `POST /api/chat/result`, form `conversation`, `call`, `text` (≤ 16384 chars), `ok`
  (`true`|`false`) — a malformed field on either path answers `400` — replies to that call's pending `item/tool/call` with
  `{contentItems:[{type:'inputText', text}], success}`; `204` once relayed, `404` for an unknown
  or already answered call.
- Call ids = `q1…qN` per conversation, minted by the bridge in arrival order; the browser keeps
  them as the KB card ids.
- Module surface, for tests: `server/chat.mjs` exports `startChatServer(options)` →
  `Promise<{ port: number, close(): Promise<void> }>`, options all optional — `port` (0 = any
  free port), `origins: string[]`, `codexHome: string`, `codexCommand: string[]` (argv prefix;
  the child runs `[...codexCommand, 'app-server', ...flags]`, default `['codex']`, env
  `CHAT_CODEX_BIN` overrides its first element), `deadlines: { callMs, turnMs, controlMs }`
  (defaults 30000 / 180000 / 30000; `controlMs` bounds `initialize` and `thread/start`). Running
  the file directly starts it from env. `close()` ends the child and every open turn.
- Vite `server` + `preview` proxy `/api/chat` to the bridge with `changeOrigin: true`, so the
  page stays same-origin (`connect-src 'self'`) and the bridge sees its own `Host`; Vite's own
  `server.allowedHosts` guards the page's port against DNS rebinding.

## Refusals

- Every request: `Host` ∈ {`127.0.0.1:<port>`, `localhost:<port>`} and `Origin` ∈ the allowlist
  `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173`,
  `http://127.0.0.1:4173` (`CHAT_ORIGINS` overrides), else `403` before the body is read. A
  missing `Origin` is refused. Method `POST` on the two paths alone (`405`/`404` otherwise),
  `Content-Type` `application/x-www-form-urlencoded` alone (`415`), body ≤ 262144 B (`413`) —
  room for 16384 result characters at their worst form encoding, 9 B each.
- One turn per conversation at a time: a second → `error{reason:'busy'}` + `done`; an unknown
  `conversation` → `error{reason:'expired'}` + `done`.
- Server requests from the child — all 11 methods of the schema's `ServerRequest`:
  `item/tool/call` for `prolog_query` on the thread's open turn = forwarded; for any other tool,
  thread or turn = answered `success:false` with a refusal text. The rest get the
  schema-valid answer that grants nothing: `item/commandExecution/requestApproval` +
  `item/fileChange/requestApproval` → `{decision:'decline'}`; `execCommandApproval` +
  `applyPatchApproval` → `{decision:{denied:{rejection}}}`; `item/permissions/requestApproval`
  → `{permissions:{}}`; `item/tool/requestUserInput` → `{answers:{}}`;
  `mcpServer/elicitation/request` → `{action:'decline'}`; `currentTime/read` → the current Unix
  second; `account/chatgptAuthTokens/refresh`, `attestation/generate` and any unknown method →
  JSON-RPC error `-32601`. Nothing is ever approved.
- The model reads `<call>\n<posted text>`, so every result names its call id whatever the page
  wrote.

## Lifecycle

- A thread runs one turn at a time: a turn ends ONLY on its `turn/completed`, on child exit, or
  on child retirement, and the conversation stays busy until then. Events and tool calls naming
  another turn id are dropped (calls answered `success:false`).
- Every child wait is bounded by `controlMs`: `initialize`, `thread/start`, `turn/start`,
  `turn/interrupt`. A turn reported failed (timeout past `turnMs`, client disconnect, auth,
  a `willRetry:false` error) gets `turn/interrupt`; a child that sends no `turn/completed`
  within `controlMs` after it is RETIRED — killed, every conversation on it expired, every open
  turn ended — so a straggler can never reach a later turn. The next turn respawns it.
- Every terminal path — completion, failure, exit, retirement, `close()` — answers each open
  call of that turn `success:false` once, ends the HTTP stream with `done`, and leaves no timer.
- Errors: `error` with `willRetry:false`, or `turn/completed` status `failed` →
  `error{reason:'codex'}`, or `'auth'` when the error names `unauthorized` or HTTP 401 (then
  without waiting for the child's retries); status `interrupted` with no earlier error →
  `error{reason:'interrupted'}`; a timeout → `error{reason:'timeout'}`. At most one `error` per
  turn.

## Trust boundary

Declared: the machine. `Host` + `Origin` refuse every browser page that is not the demo's own,
including DNS-rebinding pages, but any local process can send both headers and spend a turn. The
dev machine is single-user, and that same user's processes can already run `codex` under the
same home.

## Acceptance

Graded against `tests/support/fake-codex.mjs`, a scripted app-server that validates every
request it receives against the protocol schema shapes named here; no network, no model.

| id | predicate |
|---|---|
| B1 | Handshake + start: the fake records `initialize` (`clientInfo.name` + `.version`, `experimentalApi: true`), then `initialized`, then `thread/start` with exactly the parameters above and a guide byte-equal to `server/chat-guide.md`, then `turn/start` with `effort:'medium'`, `summary:'none'` and an `outputSchema` deep-equal to the contract's; a fake that drops a turn whose request lacks `outputSchema` makes B2 fail. The child's env carries the resolved `CODEX_HOME`; its argv carries every `-c` above. |
| B2 | A scripted turn (commentary → tool call → web search → final answer) streams `conversation`, `commentary`, `query{call:'q1', goal}`, `search`, `answer`, `done` in that order; the `answer` text is the fake's final message byte for byte; a `webSearch` whose `results` is `null` or holds a non-object yields `results` of the object entries alone. The fake also sends the `turn/start` response and the first event in ONE stdout write, and the event still streams. |
| B3 | `/api/chat/result` for `q1` reaches the fake as that call's response: text = `q1\n` + the posted text, `success` = the posted `ok`; a second post for `q1` → `404`; a post for another conversation's call → `404`. |
| B4 | A second turn on the same conversation reuses its thread (no second `thread/start`); call ids continue `q2…`. A turn on an unknown conversation → `error{reason:'expired'}`, `done`. A concurrent second turn → `error{reason:'busy'}`, `done`, and the first completes. |
| B5 | Refusals: wrong `Host` (raw `node:http`, since `fetch` cannot set it), foreign or missing `Origin`, `GET`, a JSON body, a 262145 B body, an empty `message`, a 4001-char `message`, a result `text` of 16385 chars, an `ok` other than `true`/`false` — each refused with its status and no request reaching the fake. A 16384-char Japanese result is accepted. |
| B6 | Child requests: one per method of the 11 — each answered with the shape above, checked by the fake; a tool call for an unknown tool, for a thread with no open turn, and for another turn id each answered `success:false` with no `query` event. |
| B7 | Bounds (deadlines injected; each bound fires at its own injected value, while the defaults the suite injects stay generous because a child Node process takes hundreds of milliseconds to start under the gate's full-suite load — amended from "suite < 5 s", which those starts broke): an unanswered call is answered `success:false` at the call deadline; a turn past the turn deadline gets `turn/interrupt`, `error{reason:'timeout'}`, then `done` after the fake's `turn/completed`; a client disconnect mid-turn interrupts the turn and its open call is answered `success:false`; a fake that ignores the interrupt is retired within `controlMs` and the stream still ends with `done`. Every case ends with zero pending calls. `close()` resolves only once every child the bridge spawned has exited, a retired one included (added at mnt5 m18). |
| B8 | Child failure: a fake that exits mid-turn ends that turn with `error{reason:'codex'}` + `done`; a later result post for that turn's call → `404`; the next turn respawns the child under a new conversation, and the old conversation id → `expired`. A fake whose error names `unauthorized`, and one that names HTTP 401, each yield `error{reason:'auth'}` before the fake's retries end. Stragglers: after a retired turn, events the old child sends never reach the next turn. |
| B9 | The server listens on `127.0.0.1` alone, and `pnpm lint` + `pnpm check` cover `server/`. |

Amended before code from `chat-consultant-2` K1–K6: the refusal table, the lifecycle bindings,
the 262144 B body bound (was 65536: 16384 Japanese characters encode to 147493 B), the call id
in the model's text, the trust boundary, and B1–B8's witnesses.
