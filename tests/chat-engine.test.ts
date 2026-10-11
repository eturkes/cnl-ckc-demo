import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDemoEngine, CHAT_BUDGET } from '../src/demo/DemoController.svelte.js';
import { EngineClient, type QueryOutcome } from '../src/engine/client.js';

class IdleWorker {
  addEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('demo chat engine adapter', () => {
  it('D7 createDemoEngine forwards model goal through EngineClient.query with readonly true', async () => {
    vi.stubGlobal('Worker', IdleWorker);
    const outcome: QueryOutcome = { kind: 'failure' };
    const query = vi.spyOn(EngineClient.prototype, 'query').mockResolvedValue(outcome);
    const engine = createDemoEngine();
    const signal = new AbortController().signal;
    const goal = 'guideline_document(no_such_document,_,_).';
    try {
      expect(typeof engine.runGoal).toBe('function');
      if (!engine.runGoal) throw new Error('chat engine adapter absent');
      expect(await engine.runGoal(goal, CHAT_BUDGET, signal)).toBe(outcome);
      expect(query).toHaveBeenCalledExactlyOnceWith(goal, CHAT_BUDGET, signal, undefined, {
        readonly: true,
      });
    } finally {
      engine.dispose();
    }
  });
});
