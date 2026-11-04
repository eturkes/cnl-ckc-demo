// Property tests (`CLAUDE.md` `Engineering` test form) run through `holds`, which fixes
// fast-check's seed so a red reruns from committed state and its shrunk counterexample stays the
// same. Exploration raises `PROPERTY_RUNS` while authoring; the gate runs the default.

import fc from 'fast-check';

export const SEED = 20261104;
const RUNS = Number(process.env['PROPERTY_RUNS'] ?? 200);

export const holds = <Ts extends [unknown, ...unknown[]]>(property: fc.IProperty<Ts>): void => {
  fc.assert(property, { seed: SEED, numRuns: RUNS });
};
