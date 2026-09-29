import { afterEach, expect, it, vi } from 'vitest';

import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { BootOutcome } from '../src/engine/client.js';
import type { PlSolution, ProofOutcome } from '../src/engine/protocol.js';
import type { IntakeDerivation } from '../src/intake/service.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

const id = QUESTION_IDS[0];
const booted: BootOutcome = {
  kind: 'booted',
  contract: { schemaVersion: 1, documents: 337 },
};
const empty: IntakeDerivation = { kind: 'derived', rules: [] };
const failure: AnswerResult = { kind: 'failure', id, serialized: '' };
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
};
const solution = (document: string): PlSolution => ({
  bindings: {
    Answer: {
      kind: 'compound',
      functor: 'clinical_answer',
      args: [
        { kind: 'atom', value: document },
        { kind: 'list', items: [] },
        { kind: 'string', value: 'passage' },
      ],
    },
  },
  display: { Answer: document },
});
const answer = (...documents: string[]): AnswerResult => ({
  kind: 'answer',
  id,
  serialized: '',
  solutions: documents.map(solution),
});
const makeEngine = () => ({
  boot: vi.fn<DemoEngine['boot']>().mockResolvedValue(booted),
  ask: vi.fn<DemoEngine['ask']>().mockResolvedValue(failure),
  derive: vi.fn<NonNullable<DemoEngine['derive']>>().mockResolvedValue(empty),
  dispose: vi.fn<DemoEngine['dispose']>(),
});
let controller: DemoController | undefined;
afterEach(() => {
  controller?.dispose();
  controller = undefined;
});

it('D5 boot outside the queue still prevents derivation before boot settles', async () => {
  const boot = deferred<BootOutcome>();
  const engine = makeEngine();
  engine.boot.mockReturnValue(boot.promise);
  controller = new DemoController(engine);
  const result = controller.derive(['cdc2022-opioid-rec01:2']);
  const callsBeforeBoot = engine.derive.mock.calls.length;
  boot.resolve(booted);
  await tick();
  await result;
  expect(callsBeforeBoot).toBe(0);
});

it('D5 boot error prevents an intake call until boot succeeds', async () => {
  const engine = makeEngine();
  engine.boot.mockResolvedValue({ kind: 'error', error: { code: 'boot', message: 'offline' } });
  controller = new DemoController(engine);
  await tick();
  await controller.derive(['cdc2022-opioid-rec01:2']);
  expect(engine.derive).not.toHaveBeenCalled();
});

it('D5 built-in and intake calls wait for each other, including a rejected predecessor', async () => {
  const query = deferred<AnswerResult>();
  const intake = deferred<IntakeDerivation>();
  const engine = makeEngine();
  engine.ask.mockReturnValueOnce(query.promise);
  engine.derive.mockReturnValueOnce(intake.promise);
  controller = new DemoController(engine);
  await tick();
  controller.select(id);
  const first = controller.run();
  const second = controller.derive(['cdc2022-opioid-rec01:2']);
  expect(engine.ask).toHaveBeenCalledTimes(1);
  expect(engine.derive).not.toHaveBeenCalled();
  query.reject(new Error('first query failed'));
  await first;
  await tick();
  expect(engine.derive).toHaveBeenCalledTimes(1);
  const third = controller.run();
  expect(engine.ask).toHaveBeenCalledTimes(1);
  intake.resolve(empty);
  await second;
  await third;
  expect(engine.ask).toHaveBeenCalledTimes(2);
});

it('D5 an aborted proof settles before intake, which settles before its successor proof', async () => {
  const proof = deferred<ProofOutcome>();
  const intake = deferred<IntakeDerivation>();
  const engine = {
    ...makeEngine(),
    prove: vi.fn<NonNullable<DemoEngine['prove']>>().mockResolvedValue({ kind: 'failure' }),
  };
  engine.ask.mockResolvedValue(answer('a', 'b'));
  engine.prove.mockReturnValueOnce(proof.promise);
  engine.derive.mockReturnValueOnce(intake.promise);
  controller = new DemoController(engine);
  await tick();
  controller.select(id);
  await controller.run();
  await tick();
  expect(engine.prove).toHaveBeenCalledTimes(1);
  const pending = controller.derive(['cdc2022-opioid-rec01:2']);
  controller.selectSolution(1);
  expect(engine.prove.mock.calls[0]?.[2]?.aborted).toBe(true);
  expect(engine.derive).not.toHaveBeenCalled();
  expect(engine.prove).toHaveBeenCalledTimes(1);
  proof.resolve({ kind: 'proof', steps: [] });
  await tick();
  expect(engine.derive).toHaveBeenCalledTimes(1);
  expect(engine.prove).toHaveBeenCalledTimes(1);
  expect(controller.provenance).toEqual({ kind: 'loading', solution: 1 });
  intake.resolve(empty);
  await pending;
  await tick();
  expect(engine.prove).toHaveBeenCalledTimes(2);
  expect(engine.prove.mock.calls[1]?.[0]).toMatchObject({ selected: { Answer: 'b' } });
});

it('D5 reveal owns its run and selects the requested document', async () => {
  const query = deferred<AnswerResult>();
  const engine = makeEngine();
  engine.ask.mockReturnValueOnce(query.promise);
  controller = new DemoController(engine);
  await tick();
  const pending = controller.reveal(id, 'b');
  query.resolve(answer('a', 'b'));
  await expect(pending).resolves.toBe('shown');
  expect(controller.solutionIndex).toBe(1);
});

it('D5 reveal reports supersession rather than selecting a newer run', async () => {
  const old = deferred<AnswerResult>();
  const fresh = deferred<AnswerResult>();
  const engine = makeEngine();
  engine.ask.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  controller = new DemoController(engine);
  await tick();
  const first = controller.reveal(id, 'b');
  const second = controller.reveal(id, 'c');
  old.resolve(answer('a', 'b'));
  await expect(first).resolves.toBe('superseded');
  await tick();
  fresh.resolve(answer('a', 'c'));
  await expect(second).resolves.toBe('shown');
  expect(controller.solutionIndex).toBe(1);
});
