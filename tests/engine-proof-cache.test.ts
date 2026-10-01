// Queue row `Generation-scoped proof cache`: re-selecting a proved solution issues no
// meta-interpreter call and returns the byte-identical proof, while anything that can change
// what the knowledge base derives — a rebuilt image, a consult — reads a miss.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PROOF_BUDGET_MAX } from '../src/engine/protocol.js';
import { EngineSession, type Engine } from '../src/engine/session.js';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';

import { bagFiles, ROOT } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(join(ROOT, 'kb', 'generated', 'kb.pvm')));
const manifest = JSON.parse(
  readFileSync(join(ROOT, 'kb', 'generated', 'kb-manifest.json'), 'utf8'),
) as { contract: { schemaVersion: number; documents: number } };
const INPUT = { constrainedGoal: 'guideline_schema_version(1).' };

/** A session over `bytes` that counts the meta-interpreter queries it issues. */
const counted = (
  bytes: Uint8Array,
  drain: () => string[] = () => [],
): { session: EngineSession; derivations: () => number } => {
  let derivations = 0;
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  const session = new EngineSession({
    expected: manifest.contract,
    drain,
    loadImage: async (loaded) => {
      const engine = await load(loaded)({});
      const query = engine.prolog.query.bind(engine.prolog);
      const prolog = new Proxy(engine.prolog, {
        get(target, property, receiver) {
          if (property !== 'query') return Reflect.get(target, property, receiver) as unknown;
          return (goal: string, bindings?: Record<string, unknown>) => {
            if (goal.includes('mi((')) derivations += 1;
            return query(goal, bindings);
          };
        },
      });
      return new Proxy(engine, {
        get(target, property, receiver) {
          return property === 'prolog'
            ? prolog
            : (Reflect.get(target, property, receiver) as unknown);
        },
      });
    },
  });
  void session.boot(bytes);
  return { session, derivations: () => derivations };
};

let first: ReturnType<typeof counted>;

beforeAll(async () => {
  first = counted(image);
  await first.session.boot(image);
}, 120_000);

describe('generation-scoped proof cache', () => {
  it('re-selecting a proved solution derives nothing and returns the identical proof', async () => {
    const before = first.derivations();
    const proved = await first.session.prove(INPUT, PROOF_BUDGET_MAX);
    expect(proved.kind).toBe('proof');
    expect(first.derivations()).toBe(before + 1);
    const again = await first.session.prove(INPUT, PROOF_BUDGET_MAX);
    expect(first.derivations()).toBe(before + 1);
    expect(JSON.stringify(again)).toBe(JSON.stringify(proved));
  });

  it('hands out copies: mutating a returned proof leaves the cached one intact', async () => {
    const proved = await first.session.prove(INPUT, PROOF_BUDGET_MAX);
    const step = proved.kind === 'proof' ? proved.steps[0] : undefined;
    if (step?.kind !== 'clause') throw new Error('expected a clause step');
    const head = step.head;
    step.head = 'mutated';
    const again = await first.session.prove(INPUT, PROOF_BUDGET_MAX);
    const fresh = again.kind === 'proof' ? again.steps[0] : undefined;
    expect(fresh?.kind === 'clause' ? fresh.head : undefined).toBe(head);
  });

  it('stores a copy: mutating the first, freshly derived proof leaves the cache intact', async () => {
    const own = counted(image);
    await own.session.boot(image);
    const proved = await own.session.prove(INPUT, PROOF_BUDGET_MAX);
    const step = proved.kind === 'proof' ? proved.steps[0] : undefined;
    if (step?.kind !== 'clause') throw new Error('expected a clause step');
    const head = step.head;
    step.head = 'mutated';
    const again = await own.session.prove(INPUT, PROOF_BUDGET_MAX);
    const fresh = again.kind === 'proof' ? again.steps[0] : undefined;
    expect(fresh?.kind === 'clause' ? fresh.head : undefined).toBe(head);
    expect(own.derivations()).toBe(1);
  }, 120_000);

  it('a consult that poisons the engine during a hit refuses that hit too', async () => {
    // `consult` drains once to clear old output and once to grade its own; the second carries
    // the planted diagnostic, which is what poisons a session.
    let drains = 0;
    const own = counted(image, () => {
      if (drains === 0) return [];
      drains -= 1;
      return drains === 0 ? ['ERROR: planted diagnostic'] : [];
    });
    await own.session.boot(image);
    expect((await own.session.prove(INPUT, PROOF_BUDGET_MAX)).kind).toBe('proof');
    const hit = own.session.prove(INPUT, PROOF_BUDGET_MAX);
    drains = 2;
    expect(() => {
      own.session.consult('proof_cache_poison_marker.');
    }).toThrow(/diagnostics/u);
    await expect(hit).rejects.toThrow(/engine discarded/u);
  }, 120_000);

  it('a mutating query empties the cache: the next prove reads the engine as it now is', async () => {
    const own = counted(image);
    await own.session.boot(image);
    expect((await own.session.prove(INPUT, PROOF_BUDGET_MAX)).kind).toBe('proof');
    await own.session.solve('abolish(guideline_schema_version/1).', PROOF_BUDGET_MAX);
    expect((await own.session.prove(INPUT, PROOF_BUDGET_MAX)).kind).toBe('failure');
    expect(own.derivations()).toBe(2);
  }, 120_000);

  it('a consult landing during a hit derives afresh instead of returning the stale proof', async () => {
    const own = counted(image);
    await own.session.boot(image);
    expect((await own.session.prove(INPUT, PROOF_BUDGET_MAX)).kind).toBe('proof');
    const hit = own.session.prove(INPUT, PROOF_BUDGET_MAX);
    own.session.consult(':- abolish(guideline_schema_version/1).');
    expect((await hit).kind).toBe('failure');
  }, 120_000);

  it('a consult empties the cache', async () => {
    await first.session.prove(INPUT, PROOF_BUDGET_MAX);
    const before = first.derivations();
    first.session.consult('proof_cache_probe_marker.');
    expect((await first.session.prove(INPUT, PROOF_BUDGET_MAX)).kind).toBe('proof');
    expect(first.derivations()).toBe(before + 1);
  });

  it('an image rebuilt from a changed KB input reads a miss', async () => {
    const { source } = payloadSource(bagFiles);
    const rebuilt = (await buildImage(`${source}\nproof_cache_rebuilt_marker.\n`)).image;
    expect(Buffer.from(rebuilt).equals(Buffer.from(image))).toBe(false);
    const second = counted(rebuilt);
    await second.session.boot(rebuilt);
    expect((await second.session.prove(INPUT, PROOF_BUDGET_MAX)).kind).toBe('proof');
    expect(second.derivations()).toBe(1);
  }, 120_000);
});
