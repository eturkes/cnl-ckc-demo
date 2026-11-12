# Graph overhaul — ITERATE

Closed rows (moved from `.agent/spec.md` `Tasks` at the ITERATE close):

- [x] 8797da9 i1 seam: `network.mjs` projects the 58 rules → 55 concepts, 95 relationships
  (`guideline.json` `.network`); i1 force-layout view.
- [x] 529eb6d r1 layout spread: `i2-situation-columns` (builder-28), `i3-situation-rings`
  (builder-29), navigator-4's edge-model + view fixes, capture 180/180; showing → the user ruled a
  content trial (`Decisions`).
- [x] 87856b9 r2 content trial: seven versions `j1`…`j7` built, screened by navigator-5, shown; the
  user picked `j6` + ruled examples beside their rule.
- [x] 6771c73 r3 `j6` rulings: several starts per rule, one KB-kind fill, layout untangled, every
  other variant retired; showing → the user withdrew the one-fill ruling + asked for an entry point.
- [x] b3ce635 r4 entry points × colourings: k1 pain anchors, k2 left to right, k3 guided start,
  screened by navigator-7 (all shortlisted); the user picked k3 + k1, clinical category.
- [x] ee33a1d r5 combined pick `m1-guided-anchors` (k3 + k1, clinical category alone),
  screened by navigator-7 (R1–R3 pass); showing → the user ruled self-loops out.
- [x] f17d08f r6 action leaves withdrawn; m1 back at round 5, whole-KB scope recorded.
- Close = the commit adding this file: review L1–L7 (`.agent/contracts/graph-iterate-close.md`);
  approved prototype `m1-guided-anchors`; next phase IMPLEMENT with n30 rejoined.

Phase history: PROTOTYPE closed `021d22c` (pick: clinical concept network) → ITERATE rounds 1–6
(i1–i3 layouts; j1–j7 content, pick j6; j6 rulings; k1–k3 entry points × colourings, pick k3 + k1
by clinical category; m1; action leaves withdrawn, whole-KB scope for IMPLEMENT) → IMPLEMENT.
