// mnt-d10 F1–F5: injected loaders, real PVM/QLF, independent display comparison.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import type { EngineContract, PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { decodeOnce } from '../src/engine/terms.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const readGenerated = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(GENERATED, name)));
const manifest = JSON.parse(Buffer.from(readGenerated('kb-manifest.json')).toString('utf8')) as {
  contract: EngineContract;
};
const pvm = readGenerated('kb.pvm');
const qlf = readGenerated('kb.qlf');
// Ground the findall template outside its scope: fresh variable names are engine-local.
const DOCUMENT_GOAL = 'findall(D,guideline_document(D,_,_),Ds),length(Ds,N),D=all_documents.';
const TIMEOUT = 120_000;

type Options = ConstructorParameters<typeof EngineSession>[0] & {
  loadFallback: () => Promise<Engine>;
};
type QlfEngine = Engine & { FS: { writeFile(path: string, bytes: Uint8Array): void } };

const sinks = (diagnostics: string[]) => ({
  print: () => undefined,
  printErr: (line: string) => diagnostics.push(line),
  on_output: (line: string, stream: string) => {
    if (stream === 'stderr') diagnostics.push(line);
  },
});

const imageLoader =
  (diagnostics: string[]): ImageLoader =>
  async (image) => {
    const factory = require('swipl-wasm/dist/loadImageDefault.js') as
      | ((image: Uint8Array) => (options: Record<string, unknown>) => Promise<Engine>)
      | { default: (image: Uint8Array) => (options: Record<string, unknown>) => Promise<Engine> };
    const load = typeof factory === 'function' ? factory : factory.default;
    return load(image)(sinks(diagnostics));
  };

const runOnce = (engine: Engine, goal: string): void => {
  expect(decodeOnce(engine.prolog.query(goal).once()).kind, goal).toBe('bindings');
};

const qlfLoader = (diagnostics: string[]) => async (): Promise<Engine> => {
  const factory = require('swipl-wasm/dist/swipl/swipl-bundle') as (
    options: Record<string, unknown>,
  ) => Promise<QlfEngine>;
  const engine = await factory({
    arguments: ['-q'],
    preRun: [(module: QlfEngine) => module.FS.writeFile('kb.qlf', qlf)],
    ...sinks(diagnostics),
  });
  runOnce(engine, "consult('kb.qlf').");
  runOnce(engine, 'assertz(d10_loader_origin(fallback)).');
  // Keep the shared sink intact: draining here could conceal an F3 ordering defect.
  return engine;
};

const createSession = (options: Options): EngineSession => new EngineSession(options);
const drain = (diagnostics: string[]) => () => diagnostics.splice(0, diagnostics.length);
const displayOf = async (session: EngineSession, goal = DOCUMENT_GOAL) => {
  const result = await session.solve(goal, BUDGET_MAX);
  expect(result.kind).toBe('solutions');
  if (result.kind !== 'solutions') throw new Error(`expected solutions, got ${result.kind}`);
  return result.solutions.map((solution: PlSolution) => solution.display);
};

const changeContract = (engine: Engine, field: keyof EngineContract): void => {
  const goal =
    field === 'documents'
      ? "dynamic(guideline_document/3),assertz(guideline_document('$d10-extra',probe,unreviewed))."
      : `dynamic(guideline_schema_version/1),retractall(guideline_schema_version(_)),assertz(guideline_schema_version(${manifest.contract.schemaVersion + 1})).`;
  runOnce(engine, goal);
};

let referenceDisplay: PlSolution['display'][];
let healthyQlf: Engine;

beforeAll(async () => {
  const diagnostics: string[] = [];
  const sound = new EngineSession({
    loadImage: imageLoader(diagnostics),
    drain: drain(diagnostics),
    expected: manifest.contract,
  });
  expect(await sound.boot(pvm)).toEqual(manifest.contract);
  referenceDisplay = await displayOf(sound);
  // Positive control: the real QLF passes the existing boot checks independently
  // of the new fallback option, so a broken fixture cannot masquerade as red.
  const qlfControl = new EngineSession({
    loadImage: async () => {
      healthyQlf = await qlfLoader(diagnostics)();
      return healthyQlf;
    },
    drain: drain(diagnostics),
    expected: manifest.contract,
  });
  expect(await qlfControl.boot(pvm)).toEqual(manifest.contract);
  expect(await displayOf(qlfControl)).toEqual(referenceDisplay);
}, TIMEOUT);

const recovery = (loadImage: ImageLoader, diagnostics: string[]) => {
  const calls = { image: 0, fallback: 0 };
  const session = createSession({
    loadImage: async (bytes) => {
      calls.image += 1;
      return loadImage(bytes);
    },
    loadFallback: async () => {
      calls.fallback += 1;
      return qlfLoader(diagnostics)();
    },
    drain: drain(diagnostics),
    expected: manifest.contract,
  });
  return { session, calls };
};

const requireRecovered = async (
  session: EngineSession,
  calls: { image: number; fallback: number },
  booting: Promise<unknown> = session.boot(pvm),
): Promise<void> => {
  const outcome = await booting.catch((error: unknown) => error);
  expect(calls).toEqual({ image: 1, fallback: 1 });
  expect(outcome).toEqual(manifest.contract);
  expect(session.booted).toBe(true);
  expect(await displayOf(session)).toEqual(referenceDisplay);
  expect(await displayOf(session, 'd10_loader_origin(Origin).')).toEqual([{ Origin: 'fallback' }]);
  expect(await session.boot(new Uint8Array(0))).toEqual(manifest.contract);
  expect(calls).toEqual({ image: 1, fallback: 1 });
};

describe('mnt-d10 QLF fallback', () => {
  it(
    'F1 sound image reports its contract with zero fallback loads',
    async () => {
      const diagnostics: string[] = [];
      const { session, calls } = recovery(imageLoader(diagnostics), diagnostics);
      expect(await session.boot(pvm)).toEqual(manifest.contract);
      expect(session.booted).toBe(true);
      expect(calls).toEqual({ image: 1, fallback: 0 });
      expect(await displayOf(session)).toEqual(referenceDisplay);
      expect(await session.boot(new Uint8Array(0))).toEqual(manifest.contract);
      expect(calls).toEqual({ image: 1, fallback: 0 });
    },
    TIMEOUT,
  );

  it(
    'F2 truncated real image rejects, then QLF answers byte-equal to PVM',
    async () => {
      const diagnostics: string[] = [];
      let imageFailure: unknown;
      let fatalLines: string[] = [];
      const load = imageLoader(diagnostics);
      const { session, calls } = recovery(async (bytes) => {
        try {
          return await load(bytes.slice(0, Math.floor(bytes.length / 2)));
        } catch (error) {
          imageFailure = error;
          fatalLines = [...diagnostics];
          throw error;
        }
      }, diagnostics);
      const booting = session.boot(pvm).catch((error: unknown) => error);
      await booting;
      expect(String(imageFailure)).toContain('Aborted');
      expect(fatalLines.join('\n')).toContain('FATAL');
      await requireRecovered(session, calls, booting);
    },
    TIMEOUT,
  );

  it(
    'F2 non-tolerated image diagnostic triggers one verified QLF load',
    async () => {
      const diagnostics: string[] = [];
      const load = imageLoader(diagnostics);
      const { session, calls } = recovery(async (bytes) => {
        const engine = await load(bytes);
        diagnostics.push('ERROR: d10 image diagnostic');
        return engine;
      }, diagnostics);
      await requireRecovered(session, calls);
    },
    TIMEOUT,
  );

  it.each(['documents', 'schemaVersion'] as const)(
    'F2 image %s mismatch triggers one verified QLF load',
    async (field) => {
      const diagnostics: string[] = [];
      const load = imageLoader(diagnostics);
      const { session, calls } = recovery(async (bytes) => {
        const engine = await load(bytes);
        changeContract(engine, field);
        return engine;
      }, diagnostics);
      await requireRecovered(session, calls);
    },
    TIMEOUT,
  );

  it(
    'F2 concurrent boots share one image attempt and one fallback load',
    async () => {
      const diagnostics: string[] = [];
      const { session, calls } = recovery(
        () => Promise.reject(new Error('d10 concurrent image rejection')),
        diagnostics,
      );
      const outcomes = await Promise.all([
        session.boot(pvm).catch((error: unknown) => error),
        session.boot(pvm).catch((error: unknown) => error),
      ]);
      expect(calls).toEqual({ image: 1, fallback: 1 });
      expect(outcomes).toEqual([manifest.contract, manifest.contract]);
      await requireRecovered(session, calls, Promise.resolve(outcomes[0]));
    },
    TIMEOUT,
  );

  it(
    'F2 arbitrary synchronous and rejected loader failures invoke fallback once',
    async () => {
      const reasons: unknown[] = [
        undefined,
        null,
        false,
        true,
        0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        '',
        0n,
        Symbol('image'),
        [],
        {},
        () => undefined,
        new Error('image probe'),
      ];
      for (let n = 1; n <= 12; n += 1) reasons.push(`image rejection ${n}`, n, { n });
      for (const reason of reasons) {
        for (const mode of ['throw', 'reject'] as const) {
          const calls = { image: 0, fallback: 0 };
          const session = createSession({
            loadImage: () => {
              calls.image += 1;
              if (mode === 'throw') throw reason;
              // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- F2 admits every rejection reason, including non-Errors.
              return Promise.reject(reason);
            },
            loadFallback: () => {
              calls.fallback += 1;
              return Promise.resolve(healthyQlf);
            },
            expected: manifest.contract,
          });
          const outcome = await session.boot(pvm).catch((error: unknown) => error);
          expect(calls, `${mode} ${String(reason)}`).toEqual({ image: 1, fallback: 1 });
          expect(outcome).toEqual(manifest.contract);
          expect(await displayOf(session)).toEqual(referenceDisplay);
        }
      }
    },
    TIMEOUT,
  );

  it.each(['reject', 'diagnostic'] as const)(
    'F3 %s image diagnostics are drained before the fallback loader enters',
    async (failure) => {
      const diagnostics: string[] = [];
      const load = imageLoader(diagnostics);
      let fallbackCalls = 0;
      let imageCalls = 0;
      let pendingAtFallback: string[] | undefined;
      const session = createSession({
        loadImage: async (bytes) => {
          imageCalls += 1;
          if (failure === 'reject') {
            diagnostics.push('FATAL: d10 saved image diagnostic');
            throw new Error('d10 saved image rejection');
          }
          const engine = await load(bytes);
          diagnostics.push('ERROR: d10 loaded image diagnostic');
          return engine;
        },
        loadFallback: async () => {
          fallbackCalls += 1;
          pendingAtFallback = [...diagnostics];
          return qlfLoader(diagnostics)();
        },
        drain: drain(diagnostics),
        expected: manifest.contract,
      });
      const outcome = await session.boot(pvm).catch((error: unknown) => error);
      expect(fallbackCalls).toBe(1);
      expect(imageCalls).toBe(1);
      expect(pendingAtFallback).toEqual([]);
      expect(outcome).toEqual(manifest.contract);
      expect(await displayOf(session)).toEqual(referenceDisplay);
    },
    TIMEOUT,
  );

  const bothFail = () => {
    const calls = { image: 0, fallback: 0 };
    const session = createSession({
      loadImage: () => {
        calls.image += 1;
        return Promise.reject(new Error('d10 image unavailable'));
      },
      loadFallback: () => {
        calls.fallback += 1;
        return Promise.reject(new Error('d10 fallback unavailable'));
      },
      expected: manifest.contract,
    });
    return { session, calls };
  };

  it('F4 both loaders failing settles boot once with both failures and no engine', async () => {
    const { session, calls } = bothFail();
    let resolved = 0;
    let rejected = 0;
    const failure: unknown = await session.boot(pvm).then(
      () => {
        resolved += 1;
        return undefined;
      },
      (error: unknown) => {
        rejected += 1;
        return error;
      },
    );
    expect(resolved).toBe(0);
    expect(rejected).toBe(1);
    expect(calls).toEqual({ image: 1, fallback: 1 });
    expect(String(failure)).toContain('d10 image unavailable');
    expect(String(failure)).toContain('d10 fallback unavailable');
    expect(session.booted).toBe(false);
    await expect(session.solve('true.', BUDGET_MAX)).rejects.toThrow(/not booted/i);
  });

  it('F4 a non-Error fallback rejection still names both failures', async () => {
    const session = createSession({
      loadImage: () => Promise.reject(new Error('d10 image unavailable')),
      // A rejection value that is not an Error carries no message to extend.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the non-Error rejection under test
      loadFallback: () => Promise.reject('d10 raw fallback refusal'),
      expected: manifest.contract,
    });
    const response = await session.handle({ id: 'd10-raw', kind: 'boot' }, pvm);
    expect(response).toMatchObject({ id: 'd10-raw', kind: 'error' });
    if (response.kind !== 'error') throw new Error('boot returned no error');
    expect(response.error.message).toContain('d10 image unavailable');
    expect(response.error.message).toContain('d10 raw fallback refusal');
  });

  it.each([
    ['a frozen Error', Object.freeze(new Error('d10 frozen fallback'))],
    ['a DOMException', new DOMException('d10 aborted fallback', 'AbortError')],
  ])('F4 %s from the fallback still names both failures', async (_, rejection) => {
    const session = createSession({
      loadImage: () => Promise.reject(new Error('d10 image unavailable')),
      loadFallback: () => Promise.reject(rejection),
      expected: manifest.contract,
    });
    const response = await session.handle({ id: 'd10-sealed', kind: 'boot' }, pvm);
    if (response.kind !== 'error') throw new Error('boot returned no error');
    expect(response.error.message).toContain('d10 image unavailable');
    expect(response.error.message).toContain(rejection.message);
  });

  it.each([
    ['no primitive conversion', () => Object.create(null) as unknown],
    [
      'a throwing tag getter',
      () =>
        Object.create(null, {
          [Symbol.toStringTag]: {
            get() {
              throw new Error('d10 tag getter');
            },
          },
        }) as unknown,
    ],
  ])(
    'F2 an image rejection with %s still takes the fallback',
    async (_, rejection) => {
      const calls = { fallback: 0 };
      const diagnostics: string[] = [];
      const session = createSession({
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the hostile value under test
        loadImage: () => Promise.reject(rejection()),
        loadFallback: () => {
          calls.fallback += 1;
          return qlfLoader(diagnostics)();
        },
        drain: drain(diagnostics),
        expected: manifest.contract,
      });
      await expect(session.boot(pvm)).resolves.toEqual(manifest.contract);
      expect(calls.fallback).toBe(1);
    },
    TIMEOUT,
  );

  it(
    'F3 a fallback that failed loudly leaves nothing to fail the next sound boot',
    async () => {
      const diagnostics: string[] = [];
      const calls = { image: 0, fallback: 0 };
      const session = createSession({
        loadImage: async (bytes) => {
          calls.image += 1;
          if (calls.image === 1) throw new Error('d10 transient image failure');
          return imageLoader(diagnostics)(bytes);
        },
        loadFallback: () => {
          calls.fallback += 1;
          diagnostics.push('FATAL ERROR: d10 fallback could not load');
          return Promise.reject(new Error('d10 fallback unavailable'));
        },
        drain: drain(diagnostics),
        expected: manifest.contract,
      });
      await expect(session.boot(pvm)).rejects.toThrow(/d10 fallback unavailable/u);
      expect(await session.boot(pvm)).toEqual(manifest.contract);
      expect(calls).toEqual({ image: 2, fallback: 1 });
    },
    TIMEOUT,
  );

  it('F4 both loaders failing yields one correlated handle error naming both', async () => {
    const { session, calls } = bothFail();
    const response = await session.handle({ id: 'd10-both', kind: 'boot' }, pvm);
    expect(calls).toEqual({ image: 1, fallback: 1 });
    expect(response).toMatchObject({ id: 'd10-both', kind: 'error' });
    if (response.kind !== 'error') throw new Error('boot returned no error');
    expect(response.error.message).toContain('d10 image unavailable');
    expect(response.error.message).toContain('d10 fallback unavailable');
    expect(session.booted).toBe(false);
    await expect(session.solve('true.', BUDGET_MAX)).rejects.toThrow(/not booted/i);
  });

  it(
    'F4 returned invalid image is discarded when the fallback rejects',
    async () => {
      const diagnostics: string[] = [];
      const load = imageLoader(diagnostics);
      const calls = { image: 0, fallback: 0 };
      const session = createSession({
        loadImage: async (bytes) => {
          calls.image += 1;
          const engine = await load(bytes);
          diagnostics.push('ERROR: d10 image poisoned');
          return engine;
        },
        loadFallback: () => {
          calls.fallback += 1;
          return Promise.reject(new Error('d10 fallback rejected'));
        },
        drain: drain(diagnostics),
        expected: manifest.contract,
      });
      const response = await session.handle({ id: 'd10-discard', kind: 'boot' }, pvm);
      expect(calls).toEqual({ image: 1, fallback: 1 });
      expect(response.kind).toBe('error');
      if (response.kind !== 'error') throw new Error('poisoned boot reported success');
      expect(response.error.message).toContain('d10 image poisoned');
      expect(response.error.message).toContain('d10 fallback rejected');
      expect(session.booted).toBe(false);
      await expect(session.solve('true.', BUDGET_MAX)).rejects.toThrow(/not booted/i);
    },
    TIMEOUT,
  );

  it(
    'F4 fallback diagnostics undergo the same refusal and discard as the image',
    async () => {
      const diagnostics: string[] = [];
      const calls = { image: 0, fallback: 0 };
      const session = createSession({
        loadImage: () => {
          calls.image += 1;
          return Promise.reject(new Error('d10 image rejected'));
        },
        loadFallback: async () => {
          calls.fallback += 1;
          const engine = await qlfLoader(diagnostics)();
          diagnostics.push('ERROR: d10 fallback poisoned');
          return engine;
        },
        drain: drain(diagnostics),
        expected: manifest.contract,
      });
      const response = await session.handle({ id: 'd10-fallback-diagnostic', kind: 'boot' }, pvm);
      expect(calls).toEqual({ image: 1, fallback: 1 });
      expect(response).toMatchObject({ kind: 'error', error: { code: 'consult' } });
      if (response.kind !== 'error') throw new Error('poisoned fallback reported success');
      expect(response.error.message).toContain('d10 image rejected');
      expect(response.error.message).toContain('d10 fallback poisoned');
      expect(session.booted).toBe(false);
      await expect(session.solve('true.', BUDGET_MAX)).rejects.toThrow(/not booted/i);
    },
    TIMEOUT,
  );

  it.each(['documents', 'schemaVersion'] as const)(
    'F5 fallback %s mismatch answers code contract and retains no engine',
    async (field) => {
      const diagnostics: string[] = [];
      const calls = { image: 0, fallback: 0 };
      const session = createSession({
        loadImage: () => {
          calls.image += 1;
          return Promise.reject(new Error('d10 image rejected'));
        },
        loadFallback: async () => {
          calls.fallback += 1;
          const engine = await qlfLoader(diagnostics)();
          changeContract(engine, field);
          return engine;
        },
        drain: drain(diagnostics),
        expected: manifest.contract,
      });
      const response = await session.handle({ id: `d10-wrong-${field}`, kind: 'boot' }, pvm);
      expect(calls).toEqual({ image: 1, fallback: 1 });
      expect(response).toMatchObject({
        id: `d10-wrong-${field}`,
        kind: 'error',
        error: { code: 'contract' },
      });
      expect(session.booted).toBe(false);
      await expect(session.solve('true.', BUDGET_MAX)).rejects.toThrow(/not booted/i);
    },
    TIMEOUT,
  );
});
