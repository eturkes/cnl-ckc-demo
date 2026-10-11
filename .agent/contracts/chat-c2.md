# chat-c2 — an aborted runtime recreates its worker

Tier `kernel`: engine lifecycle, on the chat's answer path. Source = `.agent/deferred.md` rows
`Browser WASM abort leaves a dead session` (`pri` high) and `u3 heap limit is unit-tested only`
(`pri` med), whose acceptance this restates without widening: **an aborted runtime reaches the
client as its own terminal state that recreates the worker without a caller `reset()`, proven by
a browser probe whose next query reports 337 documents**; and **a committed test drives real heap
exhaustion and reads `limit: 'heap'` without adding 19 s to the gate.** User ruling: funded by the
chat request; the `pnpm engine:probe` R45 change is approved.

A WASM trap kills the Emscripten runtime: every later call into it throws again. Measured (Node,
`.scratch/probe/abort2.mjs`): the 32-step `atom_concat/3` chain throws `WebAssembly.RuntimeError`
`Aborted(). Build with -sASSERTIONS for more info.` after 783 ms, its stderr carries
`Could not allocate memory: Out of memory`, and the next two queries throw the same error. Today
`classify` reports it as `code: 'prolog'`, so the client keeps the dead worker.

## Seam

- `EngineSession`: a `WebAssembly.RuntimeError` thrown out of any engine call = the runtime
  aborted. The session becomes ABORTED for good, drains its diagnostics, and settles that
  request — query and proof as `limit` `'heap'` when a drained line names `Out of memory`, else
  as error `code: 'aborted'` (new `EngineErrorCode`). A query's `limit` carries every solution it
  had already rendered. An aborted session answers every later request — query, proof, consult,
  boot — with error `code: 'aborted'` and calls nothing in the runtime.
- `EngineClient`: on a `limit` `'heap'` (today) OR an error `code: 'aborted'`, `query`, `prove`
  and `consult` await one recreation before they resolve — the existing single-flighted
  `#recreate`, joined by a reset in flight.
- Unchanged: the heap branch's mutant anchor (`tools/mutants.mjs` R09), the boot fallback path
  (an abort during boot already fails over to the QLF), `HARD_GRACE_MS`, `BOOT_DEADLINE_MS`.

## Acceptance

| id | predicate |
|---|---|
| A1 | Node, real image, `tests/engine-heap.test.ts`'s runaway `assertz` behind its 1900 MB reserve, session given a `drain`: the request settles `{ kind: 'limit', limit: 'heap' }` — the q2 read — and the drained line named `Out of memory`. |
| A2 | Node, real image, a fresh session given a `drain`: the unflagged 32-step `atom_concat/3` chain settles `limit` `'heap'`. |
| A3 | Fake engine whose query step throws `new WebAssembly.RuntimeError('Aborted(probe)')` with no diagnostic: the request settles error `code: 'aborted'`; a fake that streams two solutions and then throws, with an `Out of memory` diagnostic, settles `limit` `'heap'` carrying both solutions. |
| A4 | After A3's abort, a query, a proof, a consult and a boot each settle error `code: 'aborted'`, `booted` reads false, and the fake records zero further runtime calls. |
| A5 | `EngineClient` over a fake worker: a query answered `limit` `'heap'`, a query answered error `aborted`, a proof answered error `aborted` and a consult answered error `aborted` each terminate that worker, spawn exactly one replacement and boot it before the caller's promise resolves; the next query is posted to the replacement. A query answered error `prolog` keeps its worker. |
| A6 | `pnpm engine:probe` R45, in a real browser: the runaway settles `limit` `'heap'` or error `aborted`, and the NEXT query — no `reset()` — reports the manifest's 337 documents. R45's original grader (below) is replaced in this unit; its firing is recorded here. |
| A7 | `DemoController`: a run whose engine call settles `limit` `'heap'` shows that limit, and the next run of a catalog question answers. |
| A8 | `pnpm mutate`: a new mutant that drops the `aborted` recreation (client) is killed by A5, and every existing mutant still binds — R09 included. |
| A9 | Unchanged and green: `tests/engine-budgets.test.ts`, `tests/engine-recovery.test.ts`, `tests/engine-boot-watchdog.test.ts`, `tests/engine-boot-recovery.test.ts`, `pnpm engine:check`. |

## R45's original grader

`tools/engine-probe.mjs` `gradeR45` at `e430ab9` required the runaway to settle error with a
message starting `Aborted()`, the next query on the SAME client to answer as a dead engine
(error `Aborted()` or `limit` `'heap'`), and then `client.reset()` to boot and report the
corpus. Its firing on today's tree: green, pinning the defect this unit fixes.

## Out of scope

The atom-table cost of an admitted read-only goal (c1 excludes every atom builder), a UI signal
that the engine was recreated, and an abort during `boot` (the QLF fallback owns it).
