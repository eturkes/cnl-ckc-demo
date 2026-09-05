import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { EngineRequest } from '../src/engine/protocol.js';

class ScriptWorker {
  readonly seen: EngineRequest[] = [];
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }

  terminate(): void {}

  reply(value: unknown): void {
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: value });
  }
}

describe('A6 worker response boundary', () => {
  it('rejects a response whose typed payload is not structured protocol data', async () => {
    const worker = new ScriptWorker();
    const client = new EngineClient({ spawn: () => worker as unknown as Worker });
    try {
      const pending = client.query('true.', BUDGET_MAX);
      const request = worker.seen[0];
      if (request === undefined) throw new Error('client posted no request');
      worker.reply({ id: request.id, kind: 'solutions', solutions: 'not-an-array' });
      await expect(pending).resolves.toMatchObject({
        kind: 'error',
        error: { code: 'protocol' },
      });
    } finally {
      client.dispose();
    }
  });
});
