# mnt-d21 — Boot-error recovery

Tier `kernel`: engine lifecycle. Source = `.agent/deferred.md` row `Boot-error recovery` (`pri`
med): **a failed boot offers a retry control that rebuilds the engine, and a second failure still
reports one alert rather than accumulating them.**

The retry control ships (`src/demo/RunControls.svelte`, `DemoController.retry()`), but it calls
`EngineClient.boot()` on the SAME worker, and `src/engine/worker.ts` caches the image fetch as
`image ??= fetchImage()` — a rejected fetch stays rejected, so after one transient PVM fetch
failure every retry fails again until the page reloads. "Rebuilds the engine" = the retry boots
on a freshly spawned worker.

## Acceptance

| id | predicate |
|---|---|
| B1 | `EngineClient.boot()` resolving `{ kind: 'error' }` leaves no worker behind: the failed worker is terminated, and the next `boot()` spawns a new one rather than re-posting to it. |
| B2 | Against a worker that fails every boot it is sent (the cached-rejection shape) while a freshly spawned worker boots, one failed `boot()` followed by one retry `boot()` resolves `booted` with exactly two spawns. |
| B3 | A response from the retired worker never settles a request of the new one. |
| B4 | `DemoController`: boot fails → `boot-error`; `retry()` → `booting` → a second failure → `boot-error` again; after each failure the run region holds exactly ONE `role="alert"` (the intake panel's own live regions excluded, as the house dom suite does) and the page-wide `role="alert"` count after the second failure equals the count after the first, so nothing accumulates; a third attempt that succeeds reaches the ready state. Amended from "the rendered page holds exactly ONE", which fired red at base on the intake panel's always-mounted alert region, not on accumulation. |
| B5 | The hung-boot watchdog keeps its bound: a worker that never answers still settles one typed `boot` error after exactly one recreate (`tests/engine-boot-watchdog.test.ts` unchanged and green). |
