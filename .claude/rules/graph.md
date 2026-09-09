---
paths:
  - "src/graph/**"
  - "tools/kb/graph.mjs"
  - "tests/graph-*.ts"
  - "tests/semantic-graph.dom.test.ts"
---

# Semantic graph

## Meaning ruling (user, binding)

Keep the concept-first projection, and carry negation + modality as **edge state**. No
`operator-context` node returns to the concept view, and **no edge may read as a claim the
source denies**. The graph's look is open to change; every other accepted surface is not.

## Renderer seam

**Cytoscape is isolated behind one adapter.** It appears nowhere outside `src/graph/canvas.ts`
— `model.ts`, `SemanticGraph.svelte`, `index.ts` and `tools/kb/graph.mjs` return rc 1 on
`/usr/bin/rg -i 'cytoscape|fcose|\bcy\b'`, against 24 hits in `canvas.ts`. `model.ts` has ZERO
imports; it is a pure module. The whole seam is one line:
`import { mountGraphCanvas, type GraphCanvas } from './canvas.js'`. Renderer surface = 6,265 B
of 91,893 B graph surface = **6.8%**; 39 of 1,070 lines in `SemanticGraph.svelte` are
canvas-coupled. Keep that adapter shape — it is what makes a renderer swap cheap.

**The stale dependency is the layout engine, not the renderer.** `cytoscape-fcose` 2.2.0 ships
no types (hence `src/graph/cytoscape-fcose.d.ts`); `cytoscape` core is current, MIT, zero
dependencies.

**Renderer ruling (user, binding): Cytoscape stays; `vis-network` is rejected.** The u8 spike
measured it at half the label size at both viewports, with labels suppressed outright on the
densest view by `scaling.label.drawThreshold` and 10.2–12.3 s of layout there against
Cytoscape's 146–224 ms. Every legibility defect the swap was proposed to cure is Cytoscape-
side: `curve-style: 'straight'` separates 0 of 9 parallel pairs where `'bezier'` separates
9 of 9, and `text-max-width: 96px` ellipsis renders `category-B-recommendation` as
`gory B reco`. Measurements, the five capability verdicts and the renderer-neutral edge-view
contract R1–R7 are in `.agent/contracts/m5u8.md`; **that contract is what u9–u13 decide
against.** Do not re-open the renderer question without new measurement.

**Measure at the CANVAS box, never the device size.** `.graph-shell .canvas` is **1152×558**
inside a 1280×900 viewport and **296×384** inside 320×720. Any legibility number taken at the
device size overstates it by ~1.34–1.42×; the retired `5.03 px / 2.19 px` baseline was
measured that way and is void. `labelPx = 10 × zoom` exactly — the base node `font-size` is 10.

**Fit is clamped to a zoom floor (user, binding), so fit-zoom label size is no longer a
layout-selection metric.** Below the floor the graph pans instead of shrinking. What decides
a layout is overlaps, crossings and layout cost — where tuned fcose (`quality:'proof'`,
nodeRepulsion 24000, idealEdgeLength 150, nodeSeparation 180) beats the shipped params 32 vs
103 overlaps on the bounded worst case at equal cost. Node labels **wrap**; they must never
ellipsis-truncate.

**A passing DOM suite proves nothing about rendered labels.**
`tests/graph-semantics.review.test.ts` asserts `model.ts` output and
`tests/semantic-graph.dom.test.ts` MOCKS `canvas.js`, so both survive a renderer swap intact
— and changed label data can stay invisible to them. Rendered output needs a real-browser
probe.

## Data shape

- Deterministic full graph = **2,901 typed nodes / 20,964 typed edges**, extracted by static
  `clause/2` sweep. Runtime predicate calls expose only the derivable minority.
- Explicit edge schemas = 7 (`entity/4`, `cardinality/5`, `event/3`, `arg/4`, `pp/4`,
  `property/4`, `operator/3`), plus **9,804 `implies` edges**. That single figure hides two
  mechanisms: **9,053 rule-context implications + 751 synthesized event-support shortcuts**.
  The 751 are the defect site at `graph.mjs:398`.

## Projection scope loss

The concept projection filters `operator` edges and non-`condition supports` `implies` edges,
and `operator-context` is absent from `CONCEPT_NODE_KINDS` (`src/graph/model.ts`).

- Modal census, all hidden: 156 `-` (negation), 857 `should`, 156 `may`, 85 `can`, 9 `must`
  = **1,263 operator contexts**.
- **100% of the surviving projection is scope-stripped**: all 5,796 retained edge occurrences
  and all 2,381 groups belong to a scope-bearing source unit, so there is no small subset to
  repair.
- Projection = 1,288 nodes / 2,381 grouped edges out of 2,901 / 20,964; the filter drops
  15,168 occurrences and dedup removes another 3,415.

Consequence, and the reason for the ruling above: a negated recommendation renders as its
clinical inverse while the answer text keeps the negation.
