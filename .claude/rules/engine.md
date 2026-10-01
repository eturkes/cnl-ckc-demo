---
paths:
  - "src/engine/**"
  - "tools/engine-check.mjs"
  - "tests/engine-*.ts"
---

# Engine runtime

## Term boundary

- Decode happens **JS-side, inside the worker**. Native values never reach the protocol
  boundary and never re-enter a query; re-encoding rebuilds through the engine's own
  `Compound`/`List`/`Rational`/`String`/`Var` constructors.
- **`JSON.stringify` over an engine value is a measured corruption path**: `'$guideline_id'/5`
  re-enters as arity 1 with `ref([1])`, and `1r3` serializes as `3r1`. Production code must
  never do it.
- Wrapper ABI, undocumented and read off the package: `$t:'s'` string, `'r'` rational, `'v'`
  variable, `'l'` improper list, `'t'` compound whose args sit in a ONE-ELEMENT envelope at
  `value[value.functor][0]`; `$tag` dicts. An unrecognized tag fails closed.
- Integral floats decode as `integer`: SWI's `1.0` and `1` both arrive as JS `1`. The corpus
  has no floats.
- Display text = `term_string/3` with `[quoted(true),numbervars(true),ignore_ops(true)]`,
  which matched `write_canonical` on all 7 real answers at 0.0437 ms/binding.
  `print_message` renders `Unknown message:` and is diagnostic-only.

## Failure modes that read as success

- **A malformed goal yields NO solution rather than raising**, so a zero-answer run and a
  broken goal are indistinguishable without a parse guard. `solve` parses the goal via
  `term_string/2` first.
- Goals arrive as whole clauses, so the wrapper strips the trailing full stop; leaving it in
  yields a syntax error that reads as zero answers.
- **Runtime `consult` fails OPEN on its result**: a syntax error and a failing directive both
  return `bindings success:true`, throw nothing, and leave clauses loaded. Only drained
  stderr (`printErr` + `on_output`) reveals it, and the engine is already dirty by then — so
  a diagnostic poisons the session rather than the request.
- `EngineSession.consult` needs `SessionOptions.drain`, which returns `string[]`. Without it
  the consult is refused, and `handle` reports that as an error response a test ignoring the
  return value passes straight over.

## Undeclared APIs

Production calls three undeclared `swipl-wasm` surfaces, all load-bearing and all ruled
acceptable: `query[Symbol.iterator]()` and `query.close?()` (`common.d.ts` `Query` declares
`next`/`once` alone), and the `Compound`/`List`/`Rational`/`String`/`Var` constructors off
`prolog` (`Prolog` declares `call`/`forEach`/`query` alone). The package under-declares its
own surface → the package stays exact-pinned and every bump re-verifies these against the
shipped `.d.ts`. `engine:check` pins the allowlist.

**`Query.close()` is load-bearing.** Abandoning an iterator on a cap, cancel or deadline
leaves the frame open and every later query returns `failure` — measured as 8 cascading
failures before it was wired.

## Budgets

- Split enforcement. Prolog owns stack, depth and each step's inferences: `stack_limit` reducible
  1073741824 → 8388608 B, catchable `error(resource_error(stack),stack_overflow{…})` in
  0.681 ms; `depth_limit_exceeded`; `inference_limit_exceeded`. Cost +0.346 ms / +0.30%.
- **No in-Prolog wall clock.** The build reports `threads=false`; `library(time)` raises
  `existence_error(source_sink,library(time))`; `call_with_time_limit/2` and `alarm/4` raise
  procedure existence errors.
- Prolog limits do not bound a query: `repeat` under the full wrapper emitted 100000 answers
  in 452.232 ms with `D=1`, `I=true`. The JS answer cap and deadline terminate it — `pnpm
  engine:probe` R38 re-derives both in a real browser.
- `answer-cap` is reported only after the driver proves one solution past the cap and
  discards it: a run holding exactly `answerCap` answers is honest exhaustion and reports
  `solutions`. Hitting the cap therefore costs one extra solution step.
- **The inference budget bounds the whole request.** `call_with_inference_limit/3` re-arms on
  backtracking, so alone it bounds one step. `meteredGoal` reports the request's running total
  (`BudgetSpent_`) with every answer and once more after exhaustion (`BudgetFinal_ = true`),
  and the driver stops at the first record past the budget with `limit:'inference'`,
  discarding that record. The total counts the goal plus the wrapper's few inferences; answers
  are rendered only after the query closes, so no display call enters it. Proofs keep the
  per-step `wrapGoal`.
- **The wall-clock deadline bounds display rendering too** (m1u3 P3.3), answers and proof steps
  alike: the first display that ends past it stops rendering, only solutions rendered whole
  before it return, and the request reports `limit:'wall-clock'` unless an earlier stop already
  holds — that stop keeps its kind, because `heap` is what makes the client recreate the
  worker. `tests/engine-render-deadline.test.ts`.
- The wrapper reserves `BudgetDepth_`, `BudgetInference_`, `BudgetResource_`,
  `BudgetStart_`, `BudgetNow_`, `BudgetSpent_` and `BudgetFinal_`; a goal naming one is
  rejected.
- Engine ceilings: unified stack limit 1 GiB (reducible), Emscripten heap ceiling 2 GiB, RSS
  ~119 MB steady. Asserted state persists across queries in one engine.

## Cancellation

- **A worker timer cannot fire inside a synchronous step**: an in-worker 25 ms timer never
  fired across 249.80 ms of `repeat,fail`, while a main-thread 25 ms one fired at 25.97 ms.
  The hard deadline is main-thread only, at `wallClockMs + 500 ms`: `pnpm engine:probe` R39
  ends a worker stuck in one step at that deadline while a 25 ms main-thread interval keeps
  firing.
- `solve` yields a MACROTASK between solutions; a microtask yield admits no posted message
  and cannot deliver a cancel. Granularity = 50.11 ms worst step over 80 sampled Node steps
  on the real KB — a sample maximum, never benchmarked per catalog goal. Browser delivery is
  proven by `pnpm browser:check`; per-step granularity in a browser stays unmeasured.
- Cancellation surface = a trailing optional `AbortSignal` on `EngineClient.query` and
  `AnswerService.ask`. `EngineClient`'s correlation id stays private.
- Hard cancel: terminate 2.7–3.5 ms; terminate→respawn→boot 181.75–223.96 ms **in Node**. In
  a real browser the same cycle costs several hundred ms, and any UI claim must use the browser
  figure: `pnpm engine:probe` R41 runs five cycles each time and prints their range. Each cycle
  drops the overlay and re-reads the manifest's documents from the replacement engine. Post-termination worker CPU stays unmeasured. `pnpm
  browser:check` kills a hostile `repeat,fail` through the client deadline in a real browser on
  every run: exactly one respawn by the time the caller resumes, and the replacement reports the
  manifest's document count.
- **Heap exhaustion aborts the runtime in BOTH hosts.** A runaway `assertz` never raises
  `resource_error(memory)`: the allocator prints FATAL `Could not allocate memory: Out of
  memory` and the WASM runtime aborts, reaching the caller as `{code:'prolog', message:
  'Aborted(). Build with -sASSERTIONS for more info.'}` — ~6.3 s from a fresh engine in Node,
  ~10–12 s in a browser (`pnpm engine:probe` R45, which also pins the dead engine and its
  recovery by reset). That engine never answers again: the next query aborts again or, when the
  runtime survived with no memory, raises `resource_error(memory)` and reports `limit:'heap'` —
  which one varies run to run. The runaway itself never reports `heap`, so the recreation that
  outcome triggers never runs for it. `readOutcome` still maps
  `resource_error(memory)` for a build that raises it. `pnpm exec vitest run
  tests/engine-heap.test.ts` pins both halves, ~1 s alone, by reserving 1900 MB with one
  untouched `_malloc` first. Open `pri high` row in `.agent/deferred.md`.
- **A failed boot retires its worker.** The worker caches its image fetch, so a rejected fetch
  stays rejected and a retry on that worker can only fail again; `EngineClient.boot()` resolving
  an error terminates the worker, and the next `boot()` — the UI's Retry — spawns a fresh one.
  The hung-boot watchdog keeps its own single automatic recreation.
- `EngineClient.query` awaits that recreation on `limit:'heap'`, so a caller never sees a heap
  outcome before its replacement engine re-verified the contract. The wall-clock deadline
  fires its reset instead, because there the caller is already settled.

## Hosting

Node has no DOM `Worker`, so `EngineSession` holds the logic behind an injected image loader
and `worker.ts` is message plumbing only. Tests drive the session.

The main chunk carries 0 engine bytes; the worker chunk plus a hashed `kb-<hash>.pvm` carry
it. No COOP/COEP is needed, but `loadImageDefault` uses direct `eval` → a strict CSP host is
a live risk.

## Shipped bounds

| bound | value | why |
|---|---|---|
| `HARD_GRACE_MS` (`client.ts`) | 500 ms | slack between the worker's soft deadline and the client's hard one, so a soft trip reports with its engine intact before termination answers |
| `BOOT_DEADLINE_MS` (`client.ts`) | 30 000 ms | per boot attempt; one automatic recreate on a hung boot, then a typed `boot` error |
| `DEFERRED_CANCELS` (`session.ts`) | 8 | held early cancels; one query runs at a time, so only the newest can still be in flight |
