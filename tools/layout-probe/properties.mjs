import fc from 'fast-check';
import { failedPredicate } from './failure.mjs';

/**
 * @param {import('playwright').Page} page
 * @param {(page: import('playwright').Page, expression: string, arg?: unknown) => Promise<unknown>} run
 * @param {{ width: number, height: number }} viewport
 * @param {{ readonly concepts: readonly {readonly id:string}[], readonly lines: readonly {readonly id:string}[] }} network
 * @param {boolean} failFast
 * @param {(ok:boolean,rule:string,detail:string)=>void} require_
 */
export const checkProperties = async (page, run, viewport, network, failFast, require_) => {
  /** @template T @param {import('fast-check').Arbitrary<T>} arbitrary @param {string} rule */
  const exercise = async (arbitrary, rule) => {
    const details = await fc.check(
      fc.asyncProperty(arbitrary, async (trial) => {
        const reading = /** @type {{ok:boolean,detail:string}} */ (
          await run(page, '(trial) => window.layoutProbe.propertyCase(trial)', trial)
        );
        if (!reading.ok) throw new Error(reading.detail);
      }),
      { seed: 0x47b, numRuns: 16, endOnFailure: failFast },
    );
    if (details.failed) {
      const error =
        details.errorInstance instanceof Error
          ? details.errorInstance
          : new Error(fc.stringify(details.errorInstance));
      const predicate = failedPredicate(error);
      if (failFast && predicate) throw error;
      require_(
        false,
        predicate?.rule ?? rule,
        `generated property: ${fc.stringify(details.counterexample)}; ${predicate?.detail ?? error.message}`,
      );
    }
  };
  const concepts = new Set(network.concepts.map((n) => n.id));
  const lines = new Set(network.lines.map((l) => l.id));
  await exercise(
    fc.record({
      kind: fc.constant('zoom'),
      zoom: fc.double({ min: -1, max: 2, noNaN: true }),
      x: fc.double({ min: -viewport.width, max: 2 * viewport.width, noNaN: true }),
      y: fc.double({ min: -viewport.height, max: 2 * viewport.height, noNaN: true }),
    }),
    'R3',
  );
  if (network.lines.length)
    await exercise(
      fc.constantFrom(...network.lines).map((line) => ({ kind: 'leaving', id: line.id })),
      'R6',
    );
  for (const kind of ['concept', 'line', 'subject'])
    await exercise(
      fc.record({
        kind: fc.constant(kind),
        id: fc.string().filter((id) => !(kind === 'line' ? lines : concepts).has(id)),
      }),
      'R6',
    );
};
