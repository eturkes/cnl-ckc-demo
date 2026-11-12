# Graph overhaul ITERATE round 4 — j6 entry points × colourings

User ruling (round-3 showing): one fill for every node fails, and the layout gives no place to start
reading. Compare all three colour sources and all three entry points (`.agent/spec.md` `Decisions`).
Each version = one entry point; every version carries a switch over the three colourings, so the
user compares colours on one layout.

## Common contract (every builder)

- Start from a copy of `prototype/graph-overhaul/variants/j6-cleaned-concepts/` into
  `prototype/graph-overhaul/variants/<id>/`; write nothing outside that dir. Keep j6's content and
  rulings whole: example lists beside their rule, several starts per rule with the starts note, one
  node per KB term, bare patient/benefit/risk folded, every line citing its rules, dashed = should
  not only, the four hash states, wide-screen label declutter (0 overlapping label pairs at 1280 px).
- Colour: read `shared/colourings.ts` (`COLOURINGS`, `fillOf`) — never define fills of your own.
  A visible control switches role / clinical category / guideline area (default: clinical
  category); the legend lists the active colouring's classes and prints its `source` line verbatim,
  so the hand-made category reads as the prototype's reading. Choice persists in the URL query
  `?colour=<id>` (beside `?theme=`), so a link reproduces the view; the hash stays the state.
- Both themes, 375 px with no horizontal overflow, visible focus, reduced motion honoured, English.
- `design.txt` updated: entry point, how a first-time reader is led, form, `hand-made:` list.
- Smoke: `pnpm exec vite --host 127.0.0.1 --port <port> --strictPort` in the worktree (background,
  log to a file); `PROTO_ORIGIN=http://127.0.0.1:<port> node prototype/graph-overhaul/capture.mjs
  <shots> <id>` rc 0 (10/10); also capture `#overview` at 1280 px for each `?colour=`. Read every
  PNG, fix what reads badly, kill the server by PID.

## Versions

| id | builder | entry point |
|---|---|---|
| `k1-pain-anchors` | builder-37 | Acute, subacute and chronic pain pinned in one row as the entry, labelled by a short hint ("Start with the patient's pain"); the force layout arranges the rest around those fixed anchors. Other condition concepts (opioid use disorder) stay free. |
| `k2-left-to-right` | builder-38 | Lines read left to right as sentences: concepts a rule's condition names in the left band, what clinicians act on to the right, a concept in both roles placed by where most of its lines go. Layered layout (no new package: fcose with constraints, or computed positions). |
| `k3-guided-start` | builder-39 | The first view opens on one pain type's neighbourhood (default acute pain), with a clear control to switch pain type and one step to the full network; the full network keeps j6's force layout. Trace, rule and explore states open as in j6. |
