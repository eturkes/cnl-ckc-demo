# Graph overhaul — variant fan-out (PROTOTYPE)

User request (`.agent/spec.md` `Phase`): overhaul the graph; today it looks generic, its purpose
is unclear, and its model may be wrong. Jobs, all four per variant: **trace an answer** back to its
guideline source, **explore the KB**, **see the guideline's shape** at a glance, **explain one
rule's logic**. Everything open: model, renderer, layout, look. `Intent` binds (KB by export only;
answers = real Prolog execution, never hard-coding — a prototype stub must SAY it is one).

Diagnosis behind the fan-out: the shipped graph projects the ACE discourse layer (entities, verbs:
`acute pain opioid therapy → carry`), not the clinical one. The KB also holds a clinical layer —
12 graded recommendations, their implementation + supporting documents, rules (condition →
actor + modal + actions), exclusions, supersessions, the 7 catalog questions' cited statements.
Each variant = one answer to "what is a node, what is an edge, what is the reader looking at".

## Common contract (every builder)

- Dir: `prototype/graph-overhaul/variants/<id>/` = `index.html` + `main.ts` + `App.svelte` + any
  other files; start by copying `prototype/graph-overhaul/template/`. Write nothing outside it.
- Data: `shared/data.ts` (read-only) → `loadGuideline()` + `indexGuideline()`; types there are the
  data dictionary. Also readable: `/kb/generated/graph/semantic-graph.json` (16 MB, the shipped
  discourse graph: nodes/edges/scopes) and `/kb/generated/provenance/guideline.pdf`.
- No new package. Available: Svelte 5 runes, `cytoscape` + `cytoscape-fcose`, `pdfjs-dist`,
  hand-written SVG / canvas / HTML. TypeScript.
- Harness (`shared/data.ts`): read the URL hash at load + on `hashchange` — `#overview`,
  `#trace=<question id>`, `#rule=<document>:<sentence>`, `#explore=<search text>` — render that
  state, then `markReady()`; `writeHash()` when the reader navigates. `applyTheme()` in `main.ts`
  (`?theme=dark`). Unknown ids → a visible not-found message, still `markReady()`.
- `#rule` targets ANY document sentence; `rules` (58) carries the clinical parse for the 12
  recommendation documents, other sentences carry the text split (`condition`/`conclusion`/`modal`/
  `negated`) — label that split as a text reading wherever it shows.
- Trace view: the question, its statements in order, each linked to its sentence, document, page
  (+ source text). State plainly on the page that this prototype reads statements derived offline
  from the bag and the demo derives them live by Prolog (`g.derivation`).
- Show, somewhere natural to the premise: the 3 superseded statements (`supersessions`: citation +
  date) and the 12 scope exclusions (`exclusions`, `ace`), never as dashed lines (dashes = negation).
- Page chrome uses `src/app.css` tokens + fonts (imported by `main.ts`); the graph's own look is
  open. Both themes legible. No horizontal overflow at 320/375 px; mobile gets a real layout, not a
  shrunk desktop. Visible keyboard focus; `prefers-reduced-motion` honored. English only.
- Design plan first (`CLAUDE.md` `Execution` UI design): `design.txt` in the dir = 4–6 named hex
  colours, type roles, ASCII wireframe, the principles that make it THIS page, and one line each:
  `node =`, `edge =`, `model source =` (which `guideline.json` / semantic-graph fields).
  Avoid the generated-UI defaults that clause lists.
- On-page: a one-line legend of what nodes and edges mean.
- Smoke: own dev server `pnpm exec vite --port <port> --strictPort` in the worktree (background,
  log to a file), then `PROTO_ORIGIN=http://localhost:<port> node
  prototype/graph-overhaul/capture.mjs <shots dir> <id>` → rc 0 required; inspect every PNG; fix
  what looks wrong; kill your server by PID at the end.

## Variants

Conventional (proven forms, each with a distinct model):

| id | premise |
|---|---|
| `c01-rec-hub` | Recommendation hub map: 12 recommendation nodes, sized by document count, coloured by grade; implementation + supporting documents orbit their recommendation; recommendations link where they share clinical concepts (weight = shared mentions, generic words like patient/clinician/be/have excluded). Force layout (Cytoscape). |
| `c02-provenance-layers` | Layered provenance DAG, left → right: question → answer statement → rule (condition / actor / action) → sentence → document → PDF page. Tidy columns, curved links; selecting any item lights its full upstream + downstream chain. |
| `c03-rule-flowchart` | Rule as flowchart: one rule drawn as condition boxes (AND) → modal gate (should / may / must / not) → action box(es), exclusions as a guard box above. Neighbouring rules that share a condition phrase or action verb listed as next steps; overview = all 58 recommendation rules as a compact flowchart grid. |
| `c04-concept-network` | Clinical concept network: concepts (entity + event, minus generic function words) as nodes sized by mention count; edge = co-mention in one sentence (weight); community colouring by dominant recommendation; ego network on selection with the sentences behind each edge. |
| `c05-matrix` | Adjacency matrix: recommendations × top clinical concepts heatmap (cell = mentions), reorderable; second view recommendation × recommendation shared-concept matrix; click a cell → the sentences. |
| `c06-area-swimlanes` | Swimlanes by the guideline's four clinical areas (`AREAS`): lanes left → right in care order, recommendations as nodes in their lane, their rules + documents nested; answer trace = a lit path across lanes. |
| `c07-sunburst` | Zoomable radial hierarchy: guideline → 4 areas → 12 recommendations → documents → sentences; arc size = sentences, colour = modal mix; answer trace lights arcs; centre shows the focused item's text. |
| `c08-clinical-triples` | Clinical knowledge graph from the rules: nodes = actor, action (verb + object), condition phrase, recommendation; typed edges `requires`, `should do`, `should not do`, `may do`, `stated by`, with a schema legend. Force or layered layout. One rule = its triples isolated. |
| `c09-arc-timeline` | Arc diagram: all documents along one axis in guideline page order, grouped by recommendation; arcs = shared concepts or one question's citations; the guideline's shape = where arcs cluster. |
| `c10-outline-ego` | IDE-style split: a collapsible guideline outline (areas → recommendations → documents → sentences) left, an ego graph of the selection right (its rule, concepts, sibling documents, citing questions), breadcrumbs on top. |

Deliberately unconventional (premise departs from node-link norms):

| id | premise |
|---|---|
| `u01-transit-map` | Transit map: each clinical area a coloured line, recommendations the stations in order, shared clinical concepts the interchanges; an answer trace = a route drawn across the lines; octilinear lines, station labels at 45°. |
| `u02-trace-scroll` | No canvas: one vertical reading column where an answer unfolds statement by statement, each statement connected by a drawn rule line to its sentence, its document passage, and a cropped PDF page; overview = the guideline as a long scroll of recommendation blocks with margin threads joining related ones. |
| `u03-page-canvas` | The guideline PDF IS the canvas: page thumbnails laid out as a sheet, each document a marker at its page, links drawn over the pages between documents sharing concepts or cited by one answer; zoom into a page to read the passage. |
| `u04-logic-circuit` | Logic circuit: rules as gates (AND over conditions, NOT for negated actions, gate shape by modal) wired from condition inputs on the left to action outputs on the right; shared conditions = shared wires. Toggling a condition highlights the wires it reaches — label this STRUCTURE (which rules mention it), never that a rule fires. |
| `u05-hive-plot` | Hive plot: three radial axes — conditions, recommendations, actions — nodes placed along each by a stable order; curved edges between axes; one rule = a lit triple of points; shape at a glance from edge bundles. |
