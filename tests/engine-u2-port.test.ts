// Engine term, display and protocol predicates no other suite asserts. Expectations come
// from the contract, Prolog literals, or independent live re-reads — never from the code under test.

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineClient } from '../src/engine/client.js';
import {
  PROOF_BUDGET_MAX,
  WORKER_FAILURE_ID,
  type EngineError,
  type EngineRequest,
  type EngineResponse,
  type PlSolution,
} from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { createEncoder, decodeOnce, decodeTerm, type PlTerm } from '../src/engine/terms.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATED = join(ROOT, 'kb', 'generated');
const readGenerated = (name: string): Buffer => readFileSync(join(GENERATED, name));
const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const image = new Uint8Array(readGenerated('kb.pvm'));
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({});
};
const CATEGORY_A_GOAL =
  'guideline_entity(actual,A,recommendation,countable),guideline_cardinality(actual,A,na,eq,1),' +
  "guideline_entity(actual,B,'category-A-recommendation',countable)," +
  'guideline_cardinality(actual,B,na,eq,1),guideline_event(actual,C,be),' +
  'guideline_arg(actual,C,1,A),guideline_arg(actual,C,2,B).';
const nativeCompound = (functor: string, args: unknown[]): unknown => ({
  $t: 't',
  functor,
  [functor]: [args],
});
const atom = (text: string): string => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const delay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

let session: EngineSession;
let engine: Engine;
beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract, drain: () => [] });
  await session.boot(image);
  engine = await loadImage(image);
}, 120_000);

const termOf = (literal: string): PlTerm => {
  const result = decodeOnce(engine.prolog.query(`X = ${literal}.`).once());
  if (result.kind !== 'bindings' || result.bindings.X === undefined) {
    throw new Error(`literal bound no X: ${literal}`);
  }
  return result.bindings.X;
};
const solveOk = async (goal: string): Promise<PlSolution[]> => {
  const outcome = await session.solve(goal, BUDGET_MAX);
  if (outcome.kind !== 'solutions') throw new Error(`expected solutions, got ${outcome.kind}`);
  return outcome.solutions;
};
const requery = (term: PlTerm): PlTerm => {
  const result = decodeOnce(
    engine.prolog.query('Output = Input.', { Input: createEncoder(engine.prolog)(term) }).once(),
  );
  if (result.kind !== 'bindings' || result.bindings.Output === undefined) {
    throw new Error('re-query bound no Output');
  }
  return result.bindings.Output;
};
const displayReadsAs = (literal: string, display: string): boolean =>
  decodeOnce(engine.prolog.query(`term_string(T,S), T =@= (${literal}).`, { S: display }).once())
    .kind === 'bindings';

class ScriptWorker {
  readonly seen: EngineRequest[] = [];
  readonly listeners = new Map<string, ((event: unknown) => void)[]>();
  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  postMessage(request: EngineRequest): void {
    this.seen.push(request);
  }
  terminate(): void {}
  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  reply(response: EngineResponse): void {
    this.emit('message', { data: response });
  }
  get last(): EngineRequest {
    const request = this.seen.at(-1);
    if (request === undefined) throw new Error('worker received no request');
    return request;
  }
}
const scriptedClient = (): { client: EngineClient; worker: ScriptWorker; timers: Set<unknown> } => {
  const worker = new ScriptWorker();
  const timers = new Set<unknown>();
  const client = new EngineClient({
    spawn: () => worker as unknown as Worker,
    schedule: (fn) => {
      timers.add(fn);
      return fn;
    },
    cancelSchedule: (handle) => {
      timers.delete(handle);
    },
  });
  return { client, worker, timers };
};

const terminalQueries: Awaited<ReturnType<EngineClient['query']>>[] = [
  { kind: 'solutions', solutions: [] },
  { kind: 'failure' },
  { kind: 'limit', limit: 'depth', solutions: [] },
  { kind: 'cancelled', solutions: [] },
  { kind: 'error', error: { code: 'prolog', message: 'u2 terminal failure' } },
];

// Includes each u2 response kind and later budget/cancel/proof terminal arms.
const responseRequests = (): EngineRequest[] => [
  { id: 'u2-boot', kind: 'boot' },
  { id: 'u2-solutions', kind: 'query', goal: 'X = foo(bar,7).', budget: BUDGET_MAX },
  { id: 'u2-failure', kind: 'query', goal: 'fail.', budget: BUDGET_MAX },
  { id: 'u2-error', kind: 'query', goal: 'guideline_document(', budget: BUDGET_MAX },
  {
    id: 'u2-limit',
    kind: 'query',
    goal: 'between(1,3,X).',
    budget: { ...BUDGET_MAX, answerCap: 1 },
  },
  { id: 'u2-cancelled', kind: 'query', goal: 'true.', budget: BUDGET_MAX },
  { id: 'u2-ack', kind: 'cancel', target: 'u2-unknown' },
  { id: 'u2-consulted', kind: 'consult', source: 'u2_port_probe.\n' },
];

const proofResponse = async (): Promise<[EngineRequest, EngineResponse]> => {
  const { client, worker } = scriptedClient();
  try {
    const proving = client.prove(
      { constrainedGoal: 'guideline_schema_version(1).' },
      PROOF_BUDGET_MAX,
    );
    await delay();
    const request = worker.last;
    const response = await session.handle(request, image);
    worker.reply(response);
    expect(await proving).toMatchObject({ kind: 'proof' });
    return [request, response];
  } finally {
    client.dispose();
  }
};

const assertPlainDto = (value: unknown): void => {
  expect(typeof value).not.toBe('function');
  expect(typeof value).not.toBe('symbol');
  if (value === null || typeof value !== 'object') return;
  expect([Object.prototype, null, ...(Array.isArray(value) ? [Array.prototype] : [])]).toContain(
    Object.getPrototypeOf(value),
  );
  for (const child of Object.values(value)) assertPlainDto(child);
};

const containsNative = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') return false;
  if ('$t' in value || '$tag' in value) return true;
  return Object.values(value).some(containsNative);
};

describe('P3 term decode/encode port', () => {
  it('P3.1 decodes an empty list distinctly from an empty compound', () => {
    const list = decodeTerm([]);
    const compound = decodeTerm(nativeCompound('empty', []));
    expect(list).toEqual({ kind: 'list', items: [] });
    expect(compound).toEqual({ kind: 'compound', functor: 'empty', args: [] });
    expect(list).not.toEqual(compound);
  });

  it('P3.1 decodes an improper list with its tail intact', () => {
    expect(termOf('[a,2|tail]')).toEqual({
      kind: 'improper-list',
      items: [
        { kind: 'atom', value: 'a' },
        { kind: 'integer', value: 2 },
      ],
      tail: { kind: 'atom', value: 'tail' },
    });
  });

  it('P3.1 decodes the empty atom and an atom containing a quote', () => {
    expect(termOf(atom(''))).toEqual({ kind: 'atom', value: '' });
    expect(termOf(atom("reader's atom"))).toEqual({ kind: 'atom', value: "reader's atom" });
  });

  it('P3.8 round-trips the real guideline_id answer shape exactly', async () => {
    const answers = await solveOk(CATEGORY_A_GOAL);
    expect(answers).toHaveLength(7);
    const expected: PlTerm = {
      kind: 'compound',
      functor: '$guideline_id',
      args: [
        { kind: 'atom', value: 'product' },
        { kind: 'atom', value: 'cdc2022-opioid-rec02' },
        { kind: 'integer', value: 1 },
        { kind: 'compound', functor: 'ref', args: [{ kind: 'integer', value: 1 }] },
        { kind: 'list', items: [] },
      ],
    };
    const first = answers[0]?.bindings.A;
    if (first === undefined) throw new Error('category-A bound no A');
    expect(first).toEqual(expected);
    expect(requery(first)).toEqual(expected);
  });

  it('P3.10 never re-enters a native engine value into a query', () => {
    const names = ['Compound', 'List', 'Rational', 'String', 'Var'] as const;
    const helpers = engine.prolog as unknown as Record<
      (typeof names)[number],
      (...args: unknown[]) => unknown
    >;
    const spies = names.map((name) => vi.spyOn(helpers, name));
    try {
      const literal = 'pack(foo(bar,7),[a,b],[a|tail],1r3,"same",pair(A,A))';
      const row = engine.prolog.query(`X = ${literal}.`).once() as Record<string, unknown>;
      const native = row.X;
      expect(native).toBeDefined();
      const term = decodeTerm(native);
      const encoded = createEncoder(engine.prolog)(term);
      expect(encoded).not.toBe(native);
      expect(encoded).not.toBe(term);
      for (const [index, name] of names.entries()) {
        expect(spies[index], name).toHaveBeenCalled();
      }
      expect(
        decodeOnce(engine.prolog.query(`T =@= (${literal}).`, { T: encoded }).once()).kind,
      ).toBe('bindings');
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('P3.12 keeps production code free of JSON.stringify over engine values', async () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    try {
      // A detector that stopped recognizing the wrapper would make this check vacuous.
      const control = engine.prolog.query('X = foo(bar,7).').once() as Record<string, unknown>;
      JSON.stringify(control.X);
      expect(stringify.mock.calls.some(([value]) => containsNative(value))).toBe(true);
      stringify.mockClear();
      const answers = await solveOk(CATEGORY_A_GOAL);
      for (const answer of answers) {
        for (const term of Object.values(answer.bindings)) expect(requery(term)).toEqual(term);
      }
      await solveOk('X = pack([a|tail],1r3,"same",pair(A,A)).');
      expect(stringify.mock.calls.filter(([value]) => containsNative(value))).toEqual([]);
    } finally {
      stringify.mockRestore();
    }
  });
});

describe('P4 canonical display text port', () => {
  it('P4.1 renders display text that re-reads as the same term', async () => {
    const answers = await solveOk(CATEGORY_A_GOAL);
    expect(answers).toHaveLength(7);
    for (const answer of answers) {
      for (const [name, term] of Object.entries(answer.bindings)) {
        const display = answer.display[name];
        expect(display, name).toBeTypeOf('string');
        const reread = decodeOnce(engine.prolog.query('term_string(T,S).', { S: display }).once());
        if (reread.kind !== 'bindings') throw new Error(`display did not parse: ${name}`);
        expect(reread.bindings.T, name).toEqual(term);
      }
    }
  });

  it('P4.2 quotes $-prefixed, hyphenated and mixed-case atoms so they re-read', async () => {
    for (const value of [
      '$guideline_id',
      'category-A-recommendation',
      'MixedCase',
      '',
      "reader's atom",
    ]) {
      const literal = atom(value);
      const answer = (await solveOk(`X = ${literal}.`))[0];
      if (answer?.display.X === undefined) throw new Error('query bound no displayed X');
      expect(answer.bindings.X).toEqual({ kind: 'atom', value });
      expect(answer.display.X.startsWith("'")).toBe(true);
      expect(displayReadsAs(literal, answer.display.X), literal).toBe(true);
    }
  });

  it('P4.3 derives display text rather than templating it per predicate', async () => {
    for (let index = 0; index < 12; index += 1) {
      const literal = `${atom(`u2-display-${String(process.pid)}-${String(index)}`)}(ref(${String(index)}),['a-b',"same"],1r3)`;
      const answer = (await solveOk(`X = ${literal}.`))[0];
      if (answer?.display.X === undefined) throw new Error('query bound no displayed X');
      const expected = decodeOnce(
        engine.prolog
          .query(`X = ${literal},with_output_to(string(Text),write_canonical(X)).`)
          .once(),
      );
      if (expected.kind !== 'bindings') throw new Error('canonical oracle failed');
      expect(expected.bindings.Text).toEqual({ kind: 'string', value: answer.display.X });
      expect(displayReadsAs(literal, answer.display.X)).toBe(true);
    }
  });
});

describe('P2 protocol port', () => {
  it('P2.1 sends only structured-clone-safe payloads', async () => {
    class LeakedClass {
      value = 1;
    }
    for (const invalid of [new Error('u2 leaked error'), new LeakedClass(), { fn: () => 1 }]) {
      expect(() => assertPlainDto(invalid)).toThrow();
    }
    const frames: [EngineRequest, EngineResponse][] = [];
    for (const original of responseRequests()) {
      const request = { ...original, id: `clone-${original.id}` };
      if (original.id === 'u2-cancelled') session.requestCancel(request.id);
      frames.push([request, await session.handle(request, image)]);
    }
    frames.push(await proofResponse());
    for (const frame of frames.flat()) {
      expect(structuredClone(frame)).toEqual(frame);
      assertPlainDto(frame);
    }
    expect(new Set(frames.map(([, response]) => response.kind)).size).toBe(9);
  });

  it('P2.2 echoes the request id on every response', async () => {
    const kinds = new Set<string>();
    for (const request of responseRequests()) {
      if (request.id === 'u2-cancelled') session.requestCancel(request.id);
      const response = await session.handle(request, image);
      expect(response.id, request.kind).toBe(request.id);
      kinds.add(response.kind);
    }
    const [proofRequest, proofReply] = await proofResponse();
    expect(proofRequest.kind).toBe('proof');
    expect(proofReply.id).toBe(proofRequest.id);
    kinds.add(proofReply.kind);
    expect([...kinds].sort()).toEqual([
      'ack',
      'booted',
      'cancelled',
      'consulted',
      'error',
      'failure',
      'limit',
      'proof',
      'solutions',
    ]);
  });

  it('P2.2 reports an unmatched response id as a typed protocol violation', async () => {
    const { client, worker } = scriptedClient();
    const violations: EngineError[] = [];
    client.onProtocolViolation = (error) => {
      violations.push(error);
    };
    try {
      const pending = client.query('true.', BUDGET_MAX);
      await delay();
      worker.reply({ id: 'u2-unclaimed', kind: 'failure' });
      expect(violations).toEqual([
        { code: 'protocol', message: 'response u2-unclaimed matched no pending request' },
      ]);
      worker.reply({ id: worker.last.id, kind: 'failure' });
      expect(await pending).toEqual({ kind: 'failure' });
    } finally {
      client.dispose();
    }
  });

  it('P2.3 leaves no request pending after its terminal response', async () => {
    for (const outcome of terminalQueries) {
      const { client, worker, timers } = scriptedClient();
      const violations: EngineError[] = [];
      client.onProtocolViolation = (error) => {
        violations.push(error);
      };
      try {
        let settlements = 0;
        const pending = client.query('true.', BUDGET_MAX).then((result) => {
          settlements += 1;
          return result;
        });
        await delay();
        expect(timers.size).toBe(1);
        const response = { ...outcome, id: worker.last.id } as EngineResponse;
        worker.reply(response);
        expect(await pending).toEqual(outcome);
        expect(timers.size).toBe(0);
        worker.reply(response);
        await delay();
        expect(settlements).toBe(1);
        expect(violations).toEqual([
          { code: 'protocol', message: `response ${response.id} matched no pending request` },
        ]);
      } finally {
        client.dispose();
      }
    }
  });

  it('P2.5 rejects every in-flight request when the worker fails', async () => {
    for (const channel of ['error', 'messageerror', 'unhandled-rejection']) {
      const { client, worker, timers } = scriptedClient();
      try {
        const pending = [client.query('true.', BUDGET_MAX), client.query('fail.', BUDGET_MAX)];
        await delay();
        expect(worker.seen).toHaveLength(2);
        if (channel === 'unhandled-rejection') {
          worker.reply({
            id: WORKER_FAILURE_ID,
            kind: 'error',
            error: { code: 'worker', message: 'u2 rejection' },
          });
        } else worker.emit(channel, { message: 'u2 worker error' });
        for (const outcome of await Promise.all(pending)) {
          expect(outcome).toMatchObject({ kind: 'error', error: { code: 'worker' } });
        }
        expect(timers.size).toBe(0);
      } finally {
        client.dispose();
      }
    }
  });
});

describe('P1/P5 live contract port', () => {
  it('P1.5 serves a second query without re-booting the engine', async () => {
    let loads = 0;
    const counting = new EngineSession({
      loadImage: async (bytes) => {
        loads += 1;
        return loadImage(bytes);
      },
      expected: manifest.contract,
    });
    expect(await counting.boot(image)).toEqual(manifest.contract);
    expect((await counting.solve('X = first.', BUDGET_MAX)).kind).toBe('solutions');
    expect((await counting.solve('X = second.', BUDGET_MAX)).kind).toBe('solutions');
    expect(await counting.boot(new Uint8Array(0))).toEqual(manifest.contract);
    expect(loads).toBe(1);
  }, 120_000);

  it('P5.5 fails rather than skips when kb/generated is absent', () => {
    // The absence is staged in a private copy of the sources: renaming the shared
    // `kb/generated` would race every suite the gate runs beside this one.
    const copy = mkdtempSync(join(tmpdir(), 'u2-absent-'));
    try {
      for (const entry of ['src', 'tests']) {
        cpSync(join(ROOT, entry), join(copy, entry), { recursive: true });
      }
      for (const file of ['package.json', 'tsconfig.json', 'svelte.config.js', 'vite.config.ts']) {
        cpSync(join(ROOT, file), join(copy, file));
      }
      symlinkSync(join(ROOT, 'node_modules'), join(copy, 'node_modules'));
      mkdirSync(join(copy, 'kb'));
      const run = () =>
        spawnSync(
          process.execPath,
          [
            join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'),
            'run',
            'tests/engine-u2-port.test.ts',
            '--project',
            'node',
            '--maxWorkers',
            '1',
            '--no-file-parallelism',
            '-t',
            'P3.1 decodes an empty list distinctly from an empty compound',
          ],
          { cwd: copy, encoding: 'utf8', timeout: 60_000 },
        );
      const absent = run();
      expect(absent.error).toBeUndefined();
      expect(absent.status, absent.stdout + absent.stderr).toBe(1);
      expect(absent.stdout + absent.stderr).toMatch(/kb-manifest\.json|kb\.pvm/);
      // Same copy, same command, assets present: a broken staging is not an absence witness.
      symlinkSync(GENERATED, join(copy, 'kb', 'generated'));
      const present = run();
      expect(present.error).toBeUndefined();
      expect(present.status, present.stdout + present.stderr).toBe(0);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  }, 120_000);
});
