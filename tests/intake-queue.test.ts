import { afterEach, describe, expect, it } from 'vitest';

import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { IntakeDerivation } from '../src/intake/service.js';
import {
  clinicalAnswer,
  deferred,
  DeferredDemoEngine,
  derived,
  ENGINE_CONTRACT,
  NEXT_QUESTION,
  QUESTION,
  turn,
} from './intake-ui-support.js';

const controllers: DemoController[] = [];
const ready = async (engine: DemoEngine): Promise<DemoController> => {
  const controller = new DemoController(engine);
  controllers.push(controller);
  await turn();
  controller.select(QUESTION);
  return controller;
};
const trace = async (controller: DemoController, engine: DeferredDemoEngine): Promise<void> => {
  const run = controller.run();
  await turn();
  engine.asks[0]!.result.resolve(clinicalAnswer(QUESTION, ['doc-first', 'doc-target']));
  await run;
  await turn();
  expect(engine.proofs).toHaveLength(1);
};

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

describe('D5 one queue for built-in queries, proofs and intake', () => {
  it('D5 forwards exact ids, signal and the derivation result', async () => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    const abort = new AbortController();
    const ids = ['doc-beta:2', 'doc-alpha:1'];
    const result = derived(ids);
    const run = controller.derive(ids, abort.signal);
    expect(run).toBeInstanceOf(Promise);
    await turn();
    expect(engine.derivations).toHaveLength(1);
    expect(engine.derivations[0]?.ids).toEqual(ids);
    expect(engine.derivations[0]?.signal).toBe(abort.signal);
    engine.derivations[0]!.result.resolve(result);
    expect(await run).toEqual(result);
  });

  it('D5 returns undefined when the injected engine has no intake path', async () => {
    const engine: DemoEngine = {
      boot: () => Promise.resolve({ kind: 'booted', contract: ENGINE_CONTRACT }),
      ask: () => Promise.resolve(clinicalAnswer()),
      dispose: () => undefined,
    };
    const controller = await ready(engine);
    expect(controller.derive(['doc-alpha:1'])).toBeUndefined();
  });

  it('D5 returns undefined after disposal without dispatching intake', async () => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    controller.dispose();
    expect(controller.derive(['doc-alpha:1'])).toBeUndefined();
    await turn();
    expect(engine.derivations).toHaveLength(0);
  });

  it.each(['fulfilled', 'rejected'] as const)(
    'D5 waits for an intake predecessor to be %s before another intake',
    async (settlement) => {
      const engine = new DeferredDemoEngine();
      const controller = await ready(engine);
      const first = controller.derive(['doc-alpha:1'])!;
      const observed = first.catch(() => undefined);
      const second = controller.derive(['doc-beta:2'])!;
      await turn();
      expect(engine.derivations).toHaveLength(1);
      const pending = engine.derivations[0]!.result;
      if (settlement === 'fulfilled') pending.resolve(derived(['doc-alpha:1']));
      else pending.reject(new Error('first-intake-failed'));
      await observed;
      await turn();
      expect(engine.derivations).toHaveLength(2);
      expect(engine.derivations[1]?.ids).toEqual(['doc-beta:2']);
      engine.derivations[1]!.result.resolve(derived(['doc-beta:2']));
      await second;
      expect(engine.peak).toBe(1);
      expect(engine.events).toEqual([
        'start:derive',
        'settled:derive',
        'start:derive',
        'settled:derive',
      ]);
    },
  );

  it.each(['fulfilled', 'rejected'] as const)(
    'D5 keeps a built-in query behind a %s intake call',
    async (settlement) => {
      const engine = new DeferredDemoEngine();
      const controller = await ready(engine);
      const intake = controller.derive(['doc-alpha:1'])!;
      const observed = intake.catch(() => undefined);
      const run = controller.run();
      await turn();
      expect(engine.asks).toHaveLength(0);
      if (settlement === 'fulfilled') engine.derivations[0]!.result.resolve(derived([]));
      else engine.derivations[0]!.result.reject(new Error('intake-rejected'));
      await observed;
      await turn();
      expect(engine.asks).toHaveLength(1);
      engine.asks[0]!.result.resolve(clinicalAnswer());
      await run;
      expect(engine.peak).toBe(1);
    },
  );

  it.each(['fulfilled', 'rejected'] as const)(
    'D5 keeps intake behind a %s built-in query',
    async (settlement) => {
      const engine = new DeferredDemoEngine();
      const controller = await ready(engine);
      const run = controller.run();
      const intake = controller.derive(['doc-alpha:1'])!;
      await turn();
      expect(engine.derivations).toHaveLength(0);
      if (settlement === 'fulfilled') engine.asks[0]!.result.resolve(clinicalAnswer());
      else engine.asks[0]!.result.reject(new Error('ask-rejected'));
      await run;
      await turn();
      expect(engine.derivations).toHaveLength(1);
      engine.derivations[0]!.result.resolve(derived(['doc-alpha:1']));
      await intake;
      expect(engine.peak).toBe(1);
    },
  );

  it.each(['fulfilled', 'rejected'] as const)(
    'D5 keeps intake behind a %s selected-solution proof',
    async (settlement) => {
      const engine = new DeferredDemoEngine();
      const controller = await ready(engine);
      await trace(controller, engine);
      const intake = controller.derive(['doc-alpha:1'])!;
      await turn();
      expect(engine.derivations).toHaveLength(0);
      if (settlement === 'fulfilled') engine.proofs[0]!.result.resolve({ kind: 'failure' });
      else engine.proofs[0]!.result.reject(new Error('proof-rejected'));
      await turn();
      expect(engine.derivations).toHaveLength(1);
      engine.derivations[0]!.result.resolve(derived(['doc-alpha:1']));
      await intake;
      expect(engine.peak).toBe(1);
    },
  );

  it.each(['fulfilled', 'rejected'] as const)(
    'D5 an aborted proof must be %s before the replacement query starts',
    async (settlement) => {
      const engine = new DeferredDemoEngine();
      const controller = await ready(engine);
      await trace(controller, engine);
      controller.select(NEXT_QUESTION);
      const next = controller.run();
      expect(engine.proofs[0]?.signal?.aborted).toBe(true);
      await turn();
      expect(engine.asks).toHaveLength(1);
      if (settlement === 'fulfilled') engine.proofs[0]!.result.resolve({ kind: 'cancelled' });
      else engine.proofs[0]!.result.reject(new DOMException('aborted', 'AbortError'));
      await turn();
      expect(engine.asks).toHaveLength(2);
      expect(engine.asks[1]?.id).toBe(NEXT_QUESTION);
      engine.asks[1]!.result.resolve(clinicalAnswer(NEXT_QUESTION));
      await next;
      expect(engine.peak).toBe(1);
    },
  );

  it('D5 a replacement proof waits for the aborted proof and ignores its stale state', async () => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    await trace(controller, engine);
    controller.selectSolution(1);
    expect(engine.proofs[0]?.signal?.aborted).toBe(true);
    await turn();
    expect(engine.proofs).toHaveLength(1);
    engine.proofs[0]!.result.resolve({ kind: 'failure' });
    await turn();
    expect(engine.proofs).toHaveLength(2);
    expect(engine.proofs[1]?.input).toMatchObject({
      selected: { Answer: "clinical_answer('doc-target',[],marker)" },
    });
    expect(controller.provenance).toEqual({ kind: 'loading', solution: 1 });
    engine.proofs[1]!.result.resolve({ kind: 'proof', steps: [] });
    await turn();
    expect(controller.provenance).toEqual({ kind: 'ready', solution: 1, steps: [] });
    expect(engine.peak).toBe(1);
  });

  it('D5 an automatic proof queues behind intake already waiting on its query', async () => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    const run = controller.run();
    const intake = controller.derive(['doc-alpha:1'])!;
    await turn();
    engine.asks[0]!.result.resolve(clinicalAnswer(QUESTION, ['doc-target']));
    await run;
    await turn();
    expect(engine.derivations).toHaveLength(1);
    expect(engine.proofs).toHaveLength(0);
    engine.derivations[0]!.result.resolve(derived(['doc-alpha:1']));
    await intake;
    await turn();
    expect(engine.proofs).toHaveLength(1);
    engine.proofs[0]!.result.resolve({ kind: 'failure' });
    await turn();
    expect(engine.peak).toBe(1);
    expect(engine.events).toEqual([
      'start:ask',
      'settled:ask',
      'start:derive',
      'settled:derive',
      'start:proof',
      'settled:proof',
    ]);
  });

  it('D5 proof selection waits for a currently running intake derivation', async () => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    await trace(controller, engine);
    engine.proofs[0]!.result.resolve({ kind: 'failure' });
    await turn();
    const intake = controller.derive(['doc-alpha:1'])!;
    controller.selectSolution(1);
    await turn();
    expect(engine.proofs).toHaveLength(1);
    engine.derivations[0]!.result.resolve(derived(['doc-alpha:1']));
    await intake;
    await turn();
    expect(engine.proofs).toHaveLength(2);
    expect(engine.peak).toBe(1);
  });
});

describe('U3 owned built-in reveal run', () => {
  it.each([0, 1, 2, 3])('U3 selects the document binding at solution index %i', async (index) => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    const run = controller.reveal(NEXT_QUESTION, 'doc-target');
    await turn();
    expect(controller.selected).toBe(NEXT_QUESTION);
    expect(engine.asks).toHaveLength(1);
    expect(engine.asks[0]?.id).toBe(NEXT_QUESTION);
    const documents = Array.from({ length: 4 }, (_, i) =>
      i === index ? 'doc-target' : `doc-target-decoy-${String(i)}`,
    );
    engine.asks[0]!.result.resolve(clinicalAnswer(NEXT_QUESTION, documents));
    expect(await run).toBe('shown');
    expect(controller.solutionIndex).toBe(index);
  });

  it('U3 waits for its own run rather than an earlier settled answer', async () => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    controller.state = {
      kind: 'settled',
      id: QUESTION,
      result: clinicalAnswer(QUESTION, ['doc-target']),
    };
    const blocker = controller.derive(['doc-alpha:1'])!;
    let settled = false;
    const reveal = controller.reveal(NEXT_QUESTION, 'doc-target').then((outcome) => {
      settled = true;
      return outcome;
    });
    await turn();
    expect(settled).toBe(false);
    expect(engine.asks).toHaveLength(0);
    engine.derivations[0]!.result.resolve(derived(['doc-alpha:1']));
    await blocker;
    await turn();
    expect(engine.asks).toHaveLength(1);
    expect(settled).toBe(false);
    engine.asks[0]!.result.resolve(clinicalAnswer(NEXT_QUESTION, ['doc-other', 'doc-target']));
    expect(await reveal).toBe('shown');
    expect(controller.solutionIndex).toBe(1);
  });

  it('U3 a newer run of the same question supersedes reveal ownership', async () => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    const reveal = controller.reveal(QUESTION, 'doc-target');
    await turn();
    const successor = controller.run();
    engine.asks[0]!.result.resolve(clinicalAnswer(QUESTION, ['doc-target']));
    expect(await reveal).toBe('superseded');
    await turn();
    expect(engine.asks).toHaveLength(2);
    engine.asks[1]!.result.resolve(clinicalAnswer(QUESTION, ['doc-other']));
    await successor;
    expect(controller.state).toMatchObject({ kind: 'settled', id: QUESTION });
  });

  it.each(['empty', 'other-document'] as const)(
    'U3 returns missing for %s answers',
    async (kind) => {
      const engine = new DeferredDemoEngine();
      const controller = await ready(engine);
      const reveal = controller.reveal(QUESTION, 'doc-target');
      await turn();
      engine.asks[0]!.result.resolve(
        clinicalAnswer(QUESTION, kind === 'empty' ? [] : ['doc-other']),
      );
      expect(await reveal).toBe('missing');
    },
  );

  it.each(['booting', 'disposed'] as const)('U3 returns unavailable while %s', async (kind) => {
    const engine = new DeferredDemoEngine();
    const controller = await ready(engine);
    if (kind === 'booting') controller.state = { kind: 'booting' };
    else controller.dispose();
    expect(await controller.reveal(QUESTION, 'doc-target')).toBe('unavailable');
    expect(engine.asks).toHaveLength(0);
  });

  it('D5 releases a synchronously rejected intake queue entry', async () => {
    const pending = deferred<IntakeDerivation>();
    let calls = 0;
    const engine: DemoEngine = {
      boot: () => Promise.resolve({ kind: 'booted', contract: ENGINE_CONTRACT }),
      ask: () => Promise.resolve(clinicalAnswer()),
      derive: () => {
        calls += 1;
        if (calls === 1) throw new Error('synchronous-intake-rejection');
        return pending.promise;
      },
      dispose: () => undefined,
    };
    const controller = await ready(engine);
    const first = Promise.resolve().then(() => controller.derive(['doc-alpha:1']));
    await expect(first).rejects.toThrow('synchronous-intake-rejection');
    const second = controller.derive(['doc-beta:2']);
    await turn();
    expect(calls).toBe(2);
    pending.resolve(derived(['doc-beta:2']));
    expect(await second).toEqual(derived(['doc-beta:2']));
  });
});
