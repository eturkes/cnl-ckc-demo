// chat-c1 G8/G11: only the public client seam + the existing checker; no engine mock verdicts.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type { BudgetSpec, EngineRequest, PlSolution } from '../src/engine/protocol.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import { AnswerService } from '../src/questions/service.js';

// The contract's fifth argument is absent at the red base; this keeps runtime assertions reachable.
type ReadonlyQuery = (
  goal: string,
  budget: BudgetSpec,
  signal?: AbortSignal,
  onSolution?: (solution: PlSolution) => void,
  options?: { readonly?: boolean },
) => ReturnType<EngineClient['query']>;

class PostedWorker {
  readonly seen: EngineRequest[] = [];
  #onMessage: ((event: { data: unknown }) => void) | undefined;

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    if (type === 'message') this.#onMessage = listener;
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }

  terminate(): void {}

  get last(): EngineRequest {
    const request = this.seen.at(-1);
    if (request === undefined) throw new Error('client posted no request');
    return request;
  }

  reply(response: unknown): void {
    this.#onMessage?.({ data: response });
  }
}

const harness = (): { client: EngineClient; worker: PostedWorker; query: ReadonlyQuery } => {
  const worker = new PostedWorker();
  const client = new EngineClient({ spawn: () => worker as unknown as Worker });
  return { client, worker, query: client.query.bind(client) };
};

describe('read-only client contract', () => {
  it('G8 posts readonly true only when explicitly selected', async () => {
    const { client, worker, query } = harness();
    try {
      const pending = query('true', BUDGET_MAX, undefined, undefined, { readonly: true });
      const posted = worker.last;
      worker.reply({ id: posted.id, kind: 'failure' });
      await pending;
      expect(posted).toMatchObject({ kind: 'query', goal: 'true', readonly: true });
      expect(Object.hasOwn(posted, 'readonly')).toBe(true);
    } finally {
      client.dispose();
    }
  });

  it.each([undefined, {}, { readonly: false }])(
    'G8 omits the readonly key for options %j',
    async (options) => {
      const { client, worker, query } = harness();
      try {
        const pending = query('true', BUDGET_MAX, undefined, undefined, options);
        const posted = worker.last;
        worker.reply({ id: posted.id, kind: 'failure' });
        await pending;
        expect(posted.kind).toBe('query');
        expect(Object.hasOwn(posted, 'readonly')).toBe(false);
      } finally {
        client.dispose();
      }
    },
  );

  it('G8 keeps AnswerService.ask unflagged', async () => {
    const { client, worker } = harness();
    try {
      const service = new AnswerService(client);
      const pending = service.ask(QUESTION_IDS[0], BUDGET_MAX);
      const posted = worker.last;
      worker.reply({ id: posted.id, kind: 'failure' });
      await pending;
      expect(posted.kind).toBe('query');
      expect(Object.hasOwn(posted, 'readonly')).toBe(false);
    } finally {
      client.dispose();
    }
  });

  it('G8 delivers a guard error unchanged and preserves structured-clone requests', async () => {
    const { client, worker, query } = harness();
    try {
      const pending = query('assertz(x)', BUDGET_MAX, undefined, undefined, { readonly: true });
      const posted = worker.last;
      const cloned = structuredClone(posted);
      const error = { code: 'guard', message: 'read-only query refused: assertz/1' };
      worker.reply({ id: posted.id, kind: 'error', error });
      expect(await pending).toEqual({ kind: 'error', error });
      expect(cloned).toEqual(posted);
      expect(cloned).not.toBe(posted);
    } finally {
      client.dispose();
    }
  });

  it('G11 keeps the existing engine:check green without changing its checks', () => {
    const result = spawnSync(process.execPath, ['tools/engine-check.mjs'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
