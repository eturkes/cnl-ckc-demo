// d5 phased boot: the session's load / fallback / verify phases over the real image, the
// declared image size the worker reports, and the client routing non-terminal progress to
// `boot(onProgress)` alone.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient, type BootProgress } from '../src/engine/client.js';
import { declaredBytes, fetchAsset } from '../src/engine/image.js';
import {
  isTerminal,
  type BootPhase,
  type EngineContract,
  type EngineError,
  type EngineRequest,
  type EngineResponse,
} from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const pvm = new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm')));
const { contract } = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: EngineContract;
};
const TIMEOUT = 120_000;

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

/** The real image with one extra document, so it disagrees with the manifest. */
const drifted: ImageLoader = async (image) => {
  const engine = await loadImage(image);
  engine.prolog
    .query(
      "dynamic(guideline_document/3),assertz(guideline_document('$d5-extra',probe,unreviewed)).",
    )
    .once();
  return engine;
};

const bootPhases = async (
  options: ConstructorParameters<typeof EngineSession>[0],
): Promise<{ seen: EngineResponse[]; response: EngineResponse }> => {
  const session = new EngineSession(options);
  const seen: EngineResponse[] = [];
  const response = await session.handle({ id: 'b1', kind: 'boot' }, pvm, (progress) => {
    seen.push(progress);
  });
  return { seen, response };
};

const progress = (...phases: BootPhase[]): EngineResponse[] =>
  phases.map((phase) => ({ id: 'b1', kind: 'progress', phase }));

describe('session boot phases', () => {
  it(
    'a sound saved state reports load, then verify, before its booted response',
    async () => {
      const { seen, response } = await bootPhases({ loadImage, expected: contract });
      expect(seen).toEqual(progress('load', 'verify'));
      expect(response).toEqual({ id: 'b1', kind: 'booted', contract });
    },
    TIMEOUT,
  );

  it(
    'a rejected saved state reports load, fallback, verify',
    async () => {
      const { seen, response } = await bootPhases({
        loadImage: () => Promise.reject(new Error('d5 saved state refused')),
        loadFallback: () => loadImage(pvm),
        expected: contract,
      });
      expect(seen).toEqual(progress('load', 'fallback', 'verify'));
      expect(response).toEqual({ id: 'b1', kind: 'booted', contract });
    },
    TIMEOUT,
  );

  it(
    'a saved state that disagrees with the manifest reports load, verify, fallback, verify',
    async () => {
      const { seen, response } = await bootPhases({
        loadImage: drifted,
        loadFallback: () => loadImage(pvm),
        expected: contract,
      });
      expect(seen).toEqual(progress('load', 'verify', 'fallback', 'verify'));
      expect(response).toEqual({ id: 'b1', kind: 'booted', contract });
    },
    TIMEOUT,
  );

  it(
    'a failed boot reports the phases it reached and settles an error',
    async () => {
      const { seen, response } = await bootPhases({ loadImage: drifted, expected: contract });
      expect(seen).toEqual(progress('load', 'verify'));
      expect(response).toMatchObject({ id: 'b1', kind: 'error', error: { code: 'contract' } });
    },
    TIMEOUT,
  );

  it(
    'a throwing phase listener changes no boot outcome',
    async () => {
      const throwing = (): void => {
        throw new Error('d5 telemetry sink failed');
      };
      const session = new EngineSession({
        loadImage,
        loadFallback: () => Promise.reject(new Error('d5 fallback must not run')),
        expected: contract,
      });
      expect(await session.boot(pvm, throwing)).toEqual(contract);
      expect(
        await new EngineSession({ loadImage, expected: contract }).handle(
          { id: 'b3', kind: 'boot' },
          pvm,
          throwing,
        ),
      ).toEqual({ id: 'b3', kind: 'booted', contract });
    },
    TIMEOUT,
  );

  it(
    'a booted session and a non-boot request report no phase',
    async () => {
      const session = new EngineSession({ loadImage, expected: contract });
      await session.boot(pvm);
      const seen: EngineResponse[] = [];
      const record = (response: EngineResponse): void => {
        seen.push(response);
      };
      expect(await session.handle({ id: 'b2', kind: 'boot' }, pvm, record)).toMatchObject({
        kind: 'booted',
      });
      const query: EngineRequest = { id: 'q1', kind: 'query', goal: 'true.', budget: BUDGET_MAX };
      expect(await session.handle(query, pvm, record)).toMatchObject({ kind: 'solutions' });
      // A query streams its answers (d17), never a boot phase.
      expect(seen.filter((response) => response.kind === 'progress')).toEqual([]);
    },
    TIMEOUT,
  );
});

describe('declared image size', () => {
  it.each([
    [{ 'content-length': '457930' }, 457930],
    [{ 'content-length': ' 457930 ', 'content-encoding': 'identity' }, 457930],
    [{}, undefined],
    [{ 'content-length': '457930', 'content-encoding': 'gzip' }, undefined],
    [{ 'content-length': '457930', 'content-encoding': 'br, identity' }, undefined],
    [{ 'content-length': '' }, undefined],
    [{ 'content-length': '45e3' }, undefined],
    [{ 'content-length': '-1' }, undefined],
    [{ 'content-length': '99999999999999999999' }, undefined],
  ])('%j declares %s bytes', (headers, bytes) => {
    expect(declaredBytes(new Headers(headers))).toBe(bytes);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchAsset reports the declared size once, after the status check', async () => {
    const body = new Uint8Array([1, 2, 3]);
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response(body, { headers: { 'content-length': '3' } })),
    );
    const sizes: (number | undefined)[] = [];
    expect(
      await fetchAsset('kb.pvm', (size) => {
        sizes.push(size);
      }),
    ).toEqual(body);
    expect(sizes).toEqual([3]);

    vi.stubGlobal('fetch', () => Promise.resolve(new Response('missing', { status: 404 })));
    await expect(
      fetchAsset('kb.pvm', (size) => {
        sizes.push(size);
      }),
    ).rejects.toThrow('kb.pvm returned HTTP 404');
    expect(sizes).toEqual([3]);
  });
});

/** Answers a boot with scripted progress, one macrotask apart, then `booted`. */
class PhasedWorker {
  readonly seen: EngineRequest[] = [];
  #listener: ((event: MessageEvent<EngineResponse>) => void) | undefined;

  constructor(readonly script: (id: string) => EngineResponse[]) {}

  addEventListener(type: string, listener: (event: MessageEvent<EngineResponse>) => void): void {
    if (type === 'message') this.#listener = listener;
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    const replies = this.script(request.id);
    void (async () => {
      for (const data of replies) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        this.#listener?.({ data } as MessageEvent<EngineResponse>);
      }
    })();
  }

  terminate(): void {}
}

const clientOver = (worker: PhasedWorker): EngineClient =>
  new EngineClient({ spawn: () => worker as unknown as Worker });

describe('client progress routing', () => {
  it('boot(onProgress) hears every phase in order and settles on booted alone', async () => {
    const worker = new PhasedWorker((id) => [
      { id, kind: 'progress', phase: 'fetch', bytes: 457930 },
      { id, kind: 'progress', phase: 'load' },
      { id, kind: 'progress', phase: 'verify' },
      { id, kind: 'booted', contract },
    ]);
    const client = clientOver(worker);
    const heard: BootProgress[] = [];
    const outcome = await client.boot((step) => heard.push(step));
    expect(heard).toEqual([
      { phase: 'fetch', bytes: 457930 },
      { phase: 'load' },
      { phase: 'verify' },
    ]);
    expect(outcome).toEqual({ kind: 'booted', contract });
    client.dispose();
  });

  it("a hung boot's retry opens with restart, then reports its own phases", async () => {
    const workers = [
      new PhasedWorker((id) => [{ id, kind: 'progress', phase: 'fetch', bytes: 457930 }]),
      new PhasedWorker((id) => [
        { id, kind: 'progress', phase: 'fetch', bytes: 457930 },
        { id, kind: 'progress', phase: 'load' },
        { id, kind: 'progress', phase: 'verify' },
        { id, kind: 'booted', contract },
      ]),
    ];
    const deadlines: (() => void)[] = [];
    const client = new EngineClient({
      spawn: () => workers.shift() as unknown as Worker,
      schedule: (fn) => {
        deadlines.push(fn);
        return fn;
      },
      cancelSchedule: () => undefined,
    });
    const heard: BootProgress[] = [];
    const booting = client.boot((step) => heard.push(step));
    await vi.waitFor(() => {
      expect(heard).toHaveLength(1);
    });
    deadlines.shift()?.();
    expect(await booting).toEqual({ kind: 'booted', contract });
    expect(heard.map(({ phase }) => phase)).toEqual([
      'fetch',
      'restart',
      'fetch',
      'load',
      'verify',
    ]);
    client.dispose();
  });

  it('a throwing progress listener still settles booted', async () => {
    const worker = new PhasedWorker((id) => [
      { id, kind: 'progress', phase: 'load' },
      { id, kind: 'booted', contract },
    ]);
    const client = clientOver(worker);
    const outcome = await client.boot(() => {
      throw new Error('d5 telemetry sink failed');
    });
    expect(outcome).toEqual({ kind: 'booted', contract });
    client.dispose();
  });

  it('a fetch without a declared size carries no byte count', async () => {
    const worker = new PhasedWorker((id) => [
      { id, kind: 'progress', phase: 'fetch' },
      { id, kind: 'booted', contract },
    ]);
    const client = clientOver(worker);
    const heard: BootProgress[] = [];
    await client.boot((step) => heard.push(step));
    expect(heard).toEqual([{ phase: 'fetch' }]);
    expect(heard[0]).not.toHaveProperty('bytes');
    client.dispose();
  });

  it('progress for a request that reports none is a protocol violation, never a settlement', async () => {
    const worker = new PhasedWorker((id) =>
      id === 'r1'
        ? [
            { id, kind: 'progress', phase: 'load' },
            { id, kind: 'solutions', solutions: [] },
          ]
        : [],
    );
    const client = clientOver(worker);
    const violations: EngineError[] = [];
    client.onProtocolViolation = (error) => violations.push(error);
    expect(await client.query('true.', BUDGET_MAX)).toEqual({ kind: 'solutions', solutions: [] });
    expect(violations).toEqual([
      { code: 'protocol', message: 'progress for r1, which reports none' },
    ]);
    client.dispose();
  });

  it('progress is non-terminal', () => {
    expect(isTerminal({ id: 'r1', kind: 'progress', phase: 'fetch' })).toBe(false);
  });
});
