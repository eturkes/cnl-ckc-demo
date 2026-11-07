# Graph overhaul ITERATE round 2 — content trial on the clinical concept network

User ruling (`.agent/spec.md` `Decisions`, "Round 1 → content trial"): the concept network goes
forward; versions differ in WHAT it shows — clinical relationships, never linguistic structure.
Both readings of "between the guidelines": relationships between the 12 recommendations, and
between clinical concepts across them. Network form = builder's choice per version (force, rings,
columns, small multiples …), whichever makes that content read best.

## Common contract (every builder)

- Dir: `prototype/graph-overhaul/variants/<id>/`; start from a copy of
  `variants/i1-clinical-network/` (or `i3-situation-rings/` if rings suit you). Write nothing
  outside your dir. A variant-local `model.ts` may derive your projection from `guideline.json`.
- Data (read-only): `shared/data.ts` types + `loadGuideline()`; `g.rules` (58 clinical rules:
  condition text, subject, modal, actions with verb/object/modifiers/qualifiers), `g.network`
  (MAIN's concept edges: situation —verb→ acted-on, `when` = rest of condition), `g.recommendations`
  (12, grade, implementation + supporting doc ids), `g.documents`, `g.questions`, `g.exclusions`,
  `g.supersessions`. `network.mjs` documents how `g.network` was read.
- **Clinical, not linguistic**: labels in clinical words (KB terms with hyphens dropped); never
  show ACE scaffolding (`there is a clinician`, `every`, `-example` nodes) as structure. The ACE
  sentence may appear as the cited source text.
- **Derived, never asserted**: every node and edge comes from KB data by a rule your
  `design.txt` states in one line each. A hand-made list (e.g. which terms count as a treatment, a
  harm, a care stage) is allowed ONLY if it is printed on the page as the prototype's reading, not
  the KB's, and listed in `design.txt` under `hand-made:`. No grouping presented as the KB's when
  the KB does not state it.
- **Every edge cites its rules**: selecting it lists each supporting rule (recommendation +
  sentence) with its verbatim condition and opens `#rule=<document>:<sentence>`. Polarity and
  modality are never lost: should / should not / can / fact readable on the edge or its list;
  qualifiers kept (`should not abruptly discontinue`).
- **The four jobs**, each through your premise: `#overview` = the guideline's shape in your
  content; `#trace=<question>` = the answer's statements lit in your network, each to its sentence
  + page; `#rule=<doc>:<s>` = one rule explained, condition verbatim; `#explore=<text>` = a search
  over your nodes. Unknown ids → a visible not-found message, still `markReady()`.
- Colours: reuse `--graph-{entity,event,operator,value,document}` (palette-gated); a new fill
  set → run `pnpm palette:check`-style ΔE yourself and state it, or stay on those five. Dashed =
  should not / negation only.
- Both themes legible; no horizontal overflow at 375 px; mobile = a real layout; visible focus;
  `prefers-reduced-motion` honored; English only. Exclusions + supersessions shown somewhere
  natural (never dashed).
- `design.txt`: premise, form + why it suits this content, `node =`, `edge =`, `model source =`,
  `hand-made:` (or `none`), 4–6 named colours, type roles, ASCII wireframe.
- Smoke: `pnpm exec vite --port <port> --strictPort` in the worktree (background, log to a file),
  `PROTO_ORIGIN=http://localhost:<port> node prototype/graph-overhaul/capture.mjs <shots> <id>` rc 0;
  Read every PNG and fix what reads badly; kill the server by PID at the end.

## Versions

| id | builder | premise |
|---|---|---|
| `j1-recommendation-map` | builder-30 | Between recommendations. Nodes = the 12 recommendations (grade shown); an edge joins two that apply to the same clinical situation or act on the same treatment, labelled by what they share, weighted by how many rules share it. Selecting a recommendation shows its neighbours and why. |
| `j2-care-pathway` | builder-31 | Between recommendations, as sequence: one rule's action meets another rule's condition (start an opioid therapy in rec 1/3 → a clinician continues an opioid therapy in rec 4/5/7 → taper/discontinue in rec 5 → OUD in rec 12). The care sequence the rules imply, from first prescription to tapering and OUD; each hand-off edge names the action and the condition it satisfies. |
| `j3-treatments-tests` | builder-32 | Between clinical concepts: nodes = interventions (therapies, medications, tests, checks the rules act on); edges = what the guideline states between them — preferred over, instead of, with caution together, increases risk of, weighed against — plus the situations each is recommended for as context. |
| `j4-do-vs-avoid` | builder-33 | Per patient situation, what to do against what to avoid: should vs should not (+ qualifiers) on two sides, the conditions that flip one into the other (continue vs taper; taper vs never abruptly discontinue) drawn as the hinge between them. |
| `j5-risks-safeguards` | builder-34 | Nodes = harms and risks the rules name (overdose, overdose death, opioid-related harm, high overdose risk, drug-use resumption, OUD) and the safeguards the same rules tie to them (naloxone, PDMP review, toxicology testing, tapering, evidence-based medication treatment, risk mitigation); an edge = a rule linking a safeguard to a risk, labelled by how. |
| `j6-cleaned-concepts` | builder-35 | Round 1's concept network with the linguistic leftovers removed: no `-example` nodes, no bare `benefit` / `risk` / `patient` hubs (fold them into the edge text or the condition), compound terms shown as the KB writes them; the relationships a clinician recognises at once. |
| `j7-patient-journeys` | builder-36 | One small network per patient situation (acute pain, subacute pain, chronic pain, long-term opioid therapy, OUD, co-prescribing with benzodiazepines / CNS depressants), each showing every recommendation that reaches that patient as a compact ego network; the overview = the small multiples side by side. |
