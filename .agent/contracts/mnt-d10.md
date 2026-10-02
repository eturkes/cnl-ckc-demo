# mnt-d10 — QLF fallback delivery path

Tier `kernel`: engine boot, on the answer path. Source = `.agent/deferred.md` row `QLF fallback
delivery path` (`pri` med), whose acceptance this contract restates without widening:
**the fallback engine loads only when the saved state fails, and a production build that never
takes the fallback ships no bytes of it.**

"Ships" = transfers to the client. The QLF and its full engine (`swipl-bundle`, 6.2 MB) must
exist in `dist/` for the fallback to be takeable at all, so "no bytes" binds what a session
that never takes it FETCHES and what the eager chunks CONTAIN.

## Seam

`EngineSession` (`src/engine/session.ts`) gains an optional injected
`loadFallback: () => Promise<Engine>`, beside `loadImage`. `src/engine/worker.ts` supplies it as
a dynamic `import()` of `swipl-wasm/dist/swipl/swipl-bundle.js` plus a fetch of
`@kb/kb.qlf?url`, consulted the way `tools/kb/produce.mjs` `verifyQlf` does.

"The saved state fails" = the PVM boot path throws for ANY reason after the image bytes are in
hand: `loadImage` rejects (a corrupt or truncated image aborts the runtime with a FATAL
diagnostic), the loaded engine emits a non-tolerated diagnostic, or its contract disagrees with
the manifest. A failed `fetch` of the PVM itself stays a `boot` error and is out of scope.

## Acceptance

| id | predicate |
|---|---|
| F1 | A sound image boots without invoking `loadFallback` (zero calls) and reports the manifest contract. |
| F2 | An image whose load rejects, whose load emits a diagnostic, or whose contract disagrees with the manifest invokes `loadFallback` exactly once; when the fallback engine passes the SAME diagnostic and contract checks, boot resolves the manifest contract and later queries answer on that engine — a catalog goal returns solutions byte-equal (`display`) to the same goal on a sound PVM session. |
| F3 | Diagnostics the failed image emitted are drained before the fallback loads, so they never fail the fallback's own diagnostic check. |
| F4 | Saved state AND fallback both failing → `boot` rejects once, `handle` answers one `error` response, its message names BOTH failures, and no engine is retained (`booted` stays false; a later `solve` reports the engine is not booted). |
| F5 | A fallback whose contract disagrees with the manifest is refused exactly as an image's is: `handle` answers `code: 'contract'`. |
| F6 | `pnpm build`: no eager chunk — the entry chunk(s) and the PVM worker chunk — contains the full engine's bytes; the full engine sits in its own lazily imported chunk and the QLF in its own asset. Decided by a committed check over `dist/`, distinguishing the full bundle from `swipl-bundle-no-data` by a byte marker only the full bundle carries. |
| F7 | A real browser session that boots on a sound image requests neither the fallback chunk nor the QLF (`pnpm smoke` + `pnpm browser:check` request logs). |
| F8 | `pnpm engine:check` still finds exactly one `swipl-wasm` importer (`src/engine/worker.ts`). |

## Out of scope

The fallback's own wall-clock cost in a browser (unmeasured; the client's `BOOT_DEADLINE_MS`
still bounds the whole boot), a retry of a failed PVM fetch through the QLF, and any UI signal
that the fallback was taken.
