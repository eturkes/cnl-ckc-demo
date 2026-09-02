// Adversarial review probes for M1.u3 — real-PVM half (`rev-m1u3-3`).
//
// Review artifact, not shipped coverage. Each block names the check-set row it
// decides. Blocks expected RED against e3ef450 are marked `RED:` in their title.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import type {
  BudgetSpec,
  EngineContract,
  EngineRequest,
  EngineResponse,
} from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: EngineContract;
};

const loaderWith = (options: Record<string, unknown>): ImageLoader => {
  return async (image) => {
    const factory = require('swipl-wasm/dist/loadImageDefault.js') as
      | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
      | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
    const load = typeof factory === 'function' ? factory : factory.default;
    return load(image)(options);
  };
};

const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';

const DOCUMENT_COUNT = 'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).';

const budget = (overrides: Partial<BudgetSpec> = {}): BudgetSpec => ({
  ...BUDGET_MAX,
  wallClockMs: 30_000,
  answerCap: 1000,
  ...overrides,
});

const delay = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let image: Uint8Array;
let session: EngineSession;

beforeAll(async () => {
  image = new Uint8Array(readGenerated('kb.pvm'));
  session = new EngineSession({ loadImage: loaderWith({}), expected: manifest.contract });
  await session.boot(image);
}, 180_000);

/** Worker-shaped adapter owning its own session, so a respawn really rebuilds. */
class GenerationWorker {
  static built: GenerationWorker[] = [];
  static loads = 0;
  static sink: string[] = [];
  readonly seen: EngineRequest[] = [];
  terminated = false;
  readonly #session: EngineSession;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor() {
    GenerationWorker.built.push(this);
    this.#session = new EngineSession({
      loadImage: async (bytes) => {
        GenerationWorker.loads += 1;
        return loaderWith({
          print: () => undefined,
          printErr: (line: string) => GenerationWorker.sink.push(line),
          on_output: (line: string, stream: string) => {
            if (stream === 'stderr') GenerationWorker.sink.push(line);
          },
        })(bytes);
      },
      drain: () => GenerationWorker.sink.splice(0, GenerationWorker.sink.length),
      expected: manifest.contract,
    });
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  postMessage(request: EngineRequest): void {
    this.seen.push(request);
    if (request.kind === 'cancel') {
      this.#deliver({
        id: request.id,
        kind: 'ack',
        accepted: this.#session.requestCancel(request.target),
      });
      return;
    }
    setTimeout(() => {
      if (this.terminated) return;
      void this.#session.handle(request, image).then((response) => {
        this.#deliver(response);
      });
    }, 0);
  }

  #deliver(response: EngineResponse): void {
    if (this.terminated) return;
    for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }

  terminate(): void {
    this.terminated = true;
  }
}

const generationClient = (options: Partial<{
  schedule: (fn: () => void, ms: number) => unknown;
  cancelSchedule: (handle: unknown) => void;
}> = {}): EngineClient => {
  GenerationWorker.built = [];
  GenerationWorker.loads = 0;
  GenerationWorker.sink = [];
  return new EngineClient({ spawn: () => new GenerationWorker() as unknown as Worker, ...options });
};

// ---------------------------------------------------------------- R01

describe('R01 the consult surface executes goals with no budget', () => {
  it('runs a `:- Goal.` directive through the public client with no budget argument', async () => {
    const client = generationClient();
    try {
      expect((await client.boot()).kind).toBe('booted');
      const probe = `r01_probe_${process.pid}`;
      // Nothing in the request carries a stack, depth, inference, wall-clock or cap
      // bound, yet the directive executes an arbitrary goal inside the live engine.
      expect(EngineClient.prototype.consult).toHaveLength(1);
      const consulted = await client.consult(
        `:- dynamic(${probe}/1).\n:- ( between(1,200000,_), fail ; assertz(${probe}(ran)) ).\n`,
      );
      expect(consulted.kind).toBe('consulted');
      const ran = await client.query(`${probe}(V).`, budget());
      expect(ran).toMatchObject({ kind: 'solutions' });
      if (ran.kind === 'solutions') {
        expect(ran.solutions[0]?.bindings.V).toEqual({ kind: 'atom', value: 'ran' });
      }
      // The bound the equivalent query surface would have carried, for contrast.
      expect(EngineClient.prototype.query).toHaveLength(3);
    } finally {
      client.dispose();
    }
  }, 240_000);
});

// ---------------------------------------------------------------- R07

describe('R07 wall-clock covers dispatch through display, soft then hard', () => {
  it('counts display rendering inside the accounted window', async () => {
    // Same solution count, same iteration cost; only the rendered term size differs.
    const cheap = await session.solve('between(1,60,X),length(L,0).', budget({ wallClockMs: 400 }));
    const costly = await session.solve(
      'between(1,60,X),length(L,20000).',
      budget({ wallClockMs: 400 }),
    );
    expect(cheap.kind).toBe('solutions');
    expect(costly).toMatchObject({ kind: 'limit', limit: 'wall-clock' });
    if (costly.kind === 'limit') expect(costly.solutions.length).toBeLessThan(60);
  }, 120_000);

  it('soft expiry reports wall-clock and keeps the same engine and worker', async () => {
    const client = generationClient();
    try {
      expect((await client.boot()).kind).toBe('booted');
      const outcome = await client.query(
        'between(1,100000000,X).',
        budget({ wallClockMs: 60, answerCap: BUDGET_MAX.answerCap }),
      );
      expect(outcome).toMatchObject({ kind: 'limit', limit: 'wall-clock' });
      // Soft expiry is the worker's own between-solutions check: no replacement.
      expect(GenerationWorker.built).toHaveLength(1);
      expect(GenerationWorker.loads).toBe(1);
      expect(GenerationWorker.built[0]?.terminated).toBe(false);
      const sound = await client.query(CATEGORY_A_GOAL, budget());
      expect(sound.kind).toBe('solutions');
      if (sound.kind === 'solutions') expect(sound.solutions).toHaveLength(7);
    } finally {
      client.dispose();
    }
  }, 240_000);

  it('hard expiry terminates and recreates, and arms one dispatch-to-terminal timer', async () => {
    const armed = new Map<number, { fn: () => void; ms: number }>();
    let next = 0;
    const client = generationClient({
      schedule: (fn, ms) => {
        const handle = ++next;
        armed.set(handle, { fn, ms });
        return handle;
      },
      cancelSchedule: (handle) => void armed.delete(handle as number),
    });
    try {
      expect((await client.boot()).kind).toBe('booted');
      const running = client.query('between(1,100000000,X).', budget({ wallClockMs: 9_000 }));
      await delay(0);
      // One timer, armed at dispatch, covering the whole request plus the soft grace.
      expect(armed.size).toBe(1);
      expect([...armed.values()][0]?.ms).toBe(9_500);
      for (const entry of [...armed.values()]) entry.fn();
      expect(await running).toEqual({ kind: 'limit', limit: 'wall-clock', solutions: [] });
      await delay(0);
      expect(GenerationWorker.built[0]?.terminated).toBe(true);
      expect(GenerationWorker.built.length).toBeGreaterThan(1);
    } finally {
      client.dispose();
    }
  }, 240_000);
});

// ---------------------------------------------------------------- R08

describe('R08 cancellation is its own state, received mid-run', () => {
  it('cancels between later solutions and settles typed, bounded, and not as a limit', async () => {
    const client = generationClient();
    try {
      expect((await client.boot()).kind).toBe('booted');
      const controller = new AbortController();
      const started = Date.now();
      const running = client.query(
        'between(1,100000000,X).',
        budget({ answerCap: BUDGET_MAX.answerCap }),
        controller.signal,
      );
      await delay(50);
      const cancelledAt = Date.now();
      controller.abort();
      const outcome = await running;
      expect(outcome.kind).toBe('cancelled');
      if (outcome.kind !== 'cancelled') return;
      expect(outcome.solutions.length).toBeGreaterThan(0);
      // Mid-run receipt: it stopped far short of the goal's 100000000 solutions.
      expect(outcome.solutions.length).toBeLessThan(100_000_000);
      // Bounded settlement, measured from the abort rather than from dispatch.
      expect(Date.now() - cancelledAt).toBeLessThan(2_000);
      expect(Date.now() - started).toBeLessThan(10_000);
    } finally {
      client.dispose();
    }
  }, 240_000);

  it('RED: a cancel queued before the first solution is dropped, not applied', async () => {
    const client = generationClient();
    try {
      expect((await client.boot()).kind).toBe('booted');
      const controller = new AbortController();
      const running = client.query(
        'between(1,20000,X).',
        budget({ answerCap: BUDGET_MAX.answerCap }),
        controller.signal,
      );
      // The query is dispatched but `solve` has not started, so `#active` is unset.
      // A browser worker sits in exactly this window while it fetches and boots.
      controller.abort();
      const outcome = await running;
      expect(outcome.kind).toBe('cancelled');
    } finally {
      client.dispose();
    }
  }, 240_000);

  it('keeps cancelled distinct from every limit and from an error', async () => {
    const client = generationClient();
    try {
      expect((await client.boot()).kind).toBe('booted');
      const controller = new AbortController();
      const running = client.query(
        'between(1,100000000,X).',
        budget({ answerCap: BUDGET_MAX.answerCap }),
        controller.signal,
      );
      await delay(40);
      controller.abort();
      const outcome = await running;
      expect(outcome.kind).not.toBe('limit');
      expect(outcome.kind).not.toBe('error');
      expect(outcome.kind).toBe('cancelled');
      const documents = await client.query(DOCUMENT_COUNT, budget());
      expect(documents.kind).toBe('solutions');
      if (documents.kind === 'solutions') {
        expect(documents.solutions[0]?.bindings.N).toEqual({
          kind: 'integer',
          value: manifest.contract.documents,
        });
      }
    } finally {
      client.dispose();
    }
  }, 240_000);
});
