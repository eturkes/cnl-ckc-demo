# polish register

Off-spine improvements. Each entry carries the acceptance check that closes it.

- **Phased boot telemetry** — replace the single boot spinner with ordered
  progress phases. Accept: each phase emits one accessible status event in
  order, and no percentage is reported that the runtime does not supply.
- **Question deep-links + history** — encode the selected catalog ID in the URL.
  Accept: reload and back/forward restore only a catalog ID, and never start a
  run without an explicit user action.
- **Offline asset caching** — service worker over the hashed runtime assets.
  Accept: a second visit boots with the network offline, and a changed KB input
  hash invalidates every stale PVM asset.
- **Four-query byte differential** — only category-A is byte-proven against its
  committed answer bundle. Accept: a committed script reproduces byte identity
  for all four exported queries, or records the exact canonical-form divergence
  for each of the other three.
