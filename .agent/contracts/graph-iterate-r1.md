# Graph overhaul ITERATE round 1 — layout spread on the clinical network

User pick (`.agent/spec.md` `Decisions` "The overhauled graph is a clinical concept network"):
c04's network form, retargeted to clinical relationships. MAIN built the edge model
(`prototype/graph-overhaul/network.mjs` → `guideline.json` `.network`, 55 concepts, 95
relationships) and `i1-clinical-network` (force layout). i1's measured defect: the three pain
situations share most targets (recs 2–4, 7, 9, 10 repeat per pain type), so a force layout packs
them into one hub and their lit edge labels pile up. The open choice = layout, inside the approved
direction; each variant below answers it with one premise.

## Common contract (every builder)

- Start from a copy of `prototype/graph-overhaul/variants/i1-clinical-network/` into
  `variants/<id>/`; keep its data use, four hash states, sidebar semantics (relationship sentences,
  `when` lines, rule panel, implementation notes, trace list, explore lists, table view,
  boundaries) and copy unless the premise needs a change. Write nothing outside `variants/<id>/`.
- The edge model is fixed: `g.network` nodes + edges exactly as derived. No regrouping of concepts
  the KB does not state; no edge dropped; a compound condition is never split per concept.
- Node fills = the `--graph-entity` / `--graph-event` / `--graph-operator` tokens for situation /
  acted-on / both (palette-gated by `pnpm palette:check`); dashed = should not; dotted = fact.
- No new package. Cytoscape (+ fcose) or hand-written SVG. Both themes legible; no horizontal
  overflow at 375 px; visible focus; `prefers-reduced-motion` honored; English only.
- `design.txt` updated: premise, layout rule, `node =`, `edge =`.
- Smoke: `pnpm exec vite --port <port> --strictPort` in the worktree (background, log to a file),
  `PROTO_ORIGIN=http://localhost:<port> node prototype/graph-overhaul/capture.mjs <shots> <id>` rc
  0; inspect every PNG; kill the server by PID at the end.

## Variants

| id | premise |
|---|---|
| `i2-situation-columns` | Layered flow: patient situations in a left column, the things clinicians act on in a right column (subjects of fact sentences with the situations), every relationship a curve between them labelled with its verb; column order minimises crossings (barycentre), so the three pain types sit apart and their shared targets line up. |
| `i3-situation-rings` | Concentric: situations on an inner ring, acted-on concepts on an outer ring placed next to the situations that reach them; labels sit outside the ring, radially, so every label reads at the overview's zoom; a selection rotates nothing — it lights and labels its edges in place. |
