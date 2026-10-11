# Chat intake — request plan + measured findings

Open MAINTAIN request (user): free-text intake → chatbot. `gpt-6.1-sol`, effort `medium`, via a
persistent `codex app-server` (shape of `../live-stt/` `CodexTranslator`, `.claude/rules/translation-leg.md`
there). Typical LLM answer; any part the KB can answer → the model writes a Prolog goal, it runs,
its result enters the answer; every part labelled KB / web search / model knowledge.

Met when: request delivered end to end + `pnpm gate` green on a clean tree at the closing commit.

## User rulings (binding; mirrored in `.agent/spec.md` `Decisions`)

- **Replace** the TypeSafe rule-selection intake. The pick = deletion approval for: `worker/`,
  `wrangler.jsonc`, `wrangler` + `@typesafe-ai/sdk` deps, the intake vocabulary build
  (`tools/kb/intake.mjs`, `intake-vocabulary.json`), `src/intake/`, `tools/intake-{probe,live}.mjs`,
  `tests/intake-*` + `tests/intake/`, and their gate firing rows, census rows, binding entries,
  mutants. Built-in drop-down stays below the chat. Supersedes `Decisions` "Free-text patient
  intake is BUILT … SELECTS rules", "u16 delivery bindings", "Third outcome", "Selection model",
  "Stack", "Probe set" — they die in the unit that retires the TypeSafe intake.
- **Fix q1 now** (`.agent/deferred.md` `Browser WASM abort leaves a dead session`): an aborted
  runtime = its own terminal state; the client recreates the worker. Approved grader change:
  `pnpm engine:probe` R45 (pins today's dead engine + recovery by reset) moves to auto-recreation;
  record R45's original firing in the unit contract. q2 (`u3 heap limit is unit-tested only`)
  closes with it if the abort classifies as `limit: 'heap'`.
- **Provenance = inline labels**: prose answer, each segment tagged KB / Web / Model; KB tags link
  to query cards (goal + the engine's verbatim solutions); Web tags link to URLs the turn's search
  returned.

## MAIN decisions (made, not asked)

- Prolog runs IN THE BROWSER engine: server relays the tool call → browser guards + runs it
  through the demo's engine queue (`#exclusive`) → posts the result back. Model-written code never
  runs on the host; a KB card shows what the user's own engine returned.
- Web search on (`web_search="live"`); multi-turn (one codex thread per conversation);
  default service tier; model answers in the user's language, KB payload stays English.

## Measured — codex 0.162.1 (container `codex`, auth present, plan `pro`)

Probe scripts: `.scratch/probe/codex-probe.mjs` (dynamic tool + outputSchema + search),
`codex-probe2.mjs` (`CFG`/`BASE`/`ERRLOG` knobs), `tools-of.sh '<json cfg>'` (real request tool
list from `RUST_LOG=trace`), `run1.log` (one full event stream). Schema:
`codex app-server generate-json-schema --experimental --out .scratch/codex-schema-x`.

- `initialize{capabilities:{experimentalApi:true}}` unlocks `thread/start.dynamicTools`
  (`[{type:'function',name,description,inputSchema}]`). A call = server REQUEST
  `item/tool/call {threadId,turnId,callId,tool,arguments}` → reply
  `{contentItems:[{type:'inputText',text}],success}`.
- `turn/start.outputSchema` constrains the final `agentMessage` (`phase:'final_answer'`) → JSON.
  A `phase:'commentary'` agentMessage precedes tool use.
- `webSearch` item: `query`, `action{search{query,queries}|openPage{url}|findInPage{url,pattern}|other}`,
  `results[{type:'text_result',domain,ref_id,snippet,title,url}]` → web citations are checkable
  against the turn's own results.
- One turn (2 tool calls + 1 search, medium) = 16.7 s. Without a schema guide the model invents
  predicates (`recommendation/3`) and probes `current_predicate(P/A)`.
- **Isolation = a dedicated `CODEX_HOME` (user ruling).** Default `~/.config/cnl-ckc-demo/codex`
  (outside every Vite-served root), env override; the user runs `codex login` once under it —
  never copy `auth.json`: refresh-token rotation can invalidate the user's session. Measured: an
  empty home → `instructionSources []`, while the user's `~/.codex` loads its `AGENTS.md` (global
  instructions load from `CODEX_HOME`, no `-c` knob reaches them) plus `config.toml`, MCP servers
  and plugins. Rejected: `model_catalog_json` (patches a large, version-tied cache codex
  rewrites); `chatgptAuthTokens` login (marked internal-only). gpt-6.1-sol's catalog entry
  (`tool_mode:"code_mode_only"`, `multi_agent_version:"v2"`) kept `functions.{wait,
  request_user_input,request_user_input_async,exec}` + `collaboration.*` in the request under
  every `-c` `features.*=false` tried, `project_doc_max_bytes=0` and `mcp_servers={}`; `exec` =
  JS V8 isolate (no fs/network) nesting `prolog_query`, `web.run`, `apply_patch`, MCP resource
  tools, `clock`. Re-measured under the logged-in dedicated home: `instructionSources []`, and the
  same `functions.{wait,request_user_input,request_user_input_async,exec}` + `collaboration.*`
  remain. c3 contains them: an `item/tool/call` for an unknown tool, thread or turn is refused
  (a spawned sub-agent's thread is unknown to the bridge), every other server request answered
  with a refusal. Thread `cwd` = an empty temp dir; sandbox `read-only`, `approvalPolicy:'never'`.

## Measured — engine hazards (Node, `.scratch/probe/abort.mjs`, 64 MB stack, 1M inferences)

- 32-step `atom_concat` doubling → `FATAL: Could not allocate memory` → `Aborted()` in 401 ms;
  every later query aborts. Atoms live in the malloc heap, outside `stack_limit`.
- Stack-bounded, engine survives (`resource_error(stack)`): `findall` of 200 × 4M-cell lists,
  `findall` of 3000 `copy_term` 1M lists, `X is 7**(10**9)`, 30-step `string_concat` doubling.
- ⇒ guard excludes every atom-building builtin; q1 fix = defense in depth.

## KB surface for the model's guide (`.scratch/probe/kbq.mjs '<goal>' [max]`)

- 12 rec docs: `clinical_rule(Doc,S,rule(Conds,Agent,Modality,Actions))` (48 build records),
  `clinical_advice(QId,Src,clinical_answer(Doc,Rules,Passage))` (derived; 7 catalog QIds),
  `clinical_derive(Doc,S,Rule,Proof)`, `clinical_passage(Doc,Text)` (12),
  `clinical_source(QId,Doc,S)` (12), `clinical_premise/4` (346).
- 337 docs (12 `recNN`, 157 `recNN-impNN`, 168 `sNN-NN`) compiled to `guideline_*` universals;
  bare queries fail (domain law, `.claude/rules/proof.md`); structural search =
  `clause(guideline_entity(_,'$guideline_id'(_,Doc,S,_,_),Noun,_),_)` (1834 entity, 1254 event,
  1193 operator clauses).
- Closed image defines: `memberchk/2 length/2 msort/2 sort/2 sort/4 keysort/2 is_list/1
  max_list/2 forall/2 findall/3,4 bagof/3 setof/3 between/3 succ/2 plus/3 sub_string/5
  string_concat/3 split_string/4 string_lower/2 string_upper/2 string_code/3 string_chars/2
  string_codes/2 string_length/2 sub_atom_icasechk/3 atom_length/2 text_to_string/2
  number_string/2 copy_term/2 term_variables/2 functor/3 arg/3 =../2 clause/2
  '$member'/2 '$append'/3`. Absent: `member/2 append/3 nth0/3 nth1/3 aggregate_all/3,4
  maplist/* foldl/4 exclude/3 include/3 last/2 reverse/2 sum_list/2 limit/2`.

## Design

- **Guard (engine, kernel).** `query(goal, budget, signal?, onSolution?, {readonly:true})` →
  `session.solve`: parse `term_string(T,S,[variable_names(Vs)])` → JS allowlist walk over the
  decoded `T` (`src/engine/readonly.ts`, pure) → canonical re-render
  `[quoted(true),ignore_ops(true),numbervars(false),variable_names(Vs)]` → `meteredGoal`. The
  re-render closes text interpolation into `wrapGoal`. Default deny: var/module-qualified/
  `call/N>1` goals refused; control (`,` `;` `->` `*->` `\+` `not` `once` `ignore` `forall`
  `findall` `bagof`/`setof` with `^`) walks its goal args; KB entry points + the stack-bounded
  builtins above (minus atom builders) admitted with data args; `clause/2` only over a KB
  predicate head. Refusal = new `EngineErrorCode` `'guard'`. Goal text capped.
- **Wire (browser ↔ `server/chat.mjs`, NDJSON).** `POST /api/chat/turn` (form: `message`,
  `conversation?`) → events `conversation{id}`, `commentary{text}`, `query{call,goal}`,
  `search{query,action,results}`, `answer{text}`, `error{reason}`, `done`.
  `POST /api/chat/result` (form: `conversation`, `call`, `text`, `ok`). Browser numbers queries
  q1..qN per conversation and sources per URL. `src/` keeps no `JSON.stringify` (`kb:asset-check`).
  Server binds 127.0.0.1, requires `Origin` + `Host` ∈ the local dev/preview allowlist (cross-site
  form POST and DNS rebinding would spend the user's subscription); Vite proxies `/api/chat`.
- **Answer schema** `{segments:[{text,source:'kb'|'web'|'model',queries[],urls[]}]}`, plain text.
  Label `kb` iff every cited id ran in this conversation to a terminal outcome (0 solutions
  counts; refused/error does not); `web` iff every URL appeared in a search result/opened page;
  else shown `unverified` with the claimed source. Tool result to the model = capped rendering;
  the card discloses truncation.
- Security lens stays on MAIN (global `Subagents`: security vocabulary).

## Units (`.agent/spec.md` `Tasks` c1–c8)

c1 kernel guarded read-only query · c2 kernel q1 abort recovery (+ q2) · c3 kernel
`server/chat.mjs` bridge vs a fake app-server · c4 kernel browser chat client/controller/provenance
resolver + binding row · c5 visual ChatPanel replacing IntakePanel, i18n, dom tests, visual-qa ·
c6 retire the TypeSafe intake · c7 live `pnpm chat:probe` + `pnpm chat:live` (reported, never
gated) · c8 docs/spec/rules/README/claims + close review per lens.
