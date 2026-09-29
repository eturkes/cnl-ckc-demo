import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntakeController, IntakeHost } from '../src/intake/IntakeController.svelte.js';
import type { JudgmentClient, JudgmentOutcome } from '../src/intake/client.js';
import type { DerivedRule, IntakeDerivation } from '../src/intake/service.js';
import {
  deferred,
  derived,
  judgment,
  turn,
  UI_VOCABULARY,
  type Deferred,
} from './intake-ui-support.js';

interface JudgeCall {
  description: string;
  signal: AbortSignal | undefined;
  result: Deferred<JudgmentOutcome>;
}
interface HostCall {
  ids: readonly unknown[];
  signal: AbortSignal | undefined;
  result: Deferred<IntakeDerivation>;
}

let controller: IntakeController | undefined;
let create: (client?: JudgmentClient, host?: IntakeHost) => IntakeController;
let judges: JudgeCall[];
let derivations: HostCall[];
let client: JudgmentClient;
let host: IntakeHost;
const IDS = ['doc-alpha:1', 'doc-beta:2'];
const DESCRIPTION = 'gap-sentinel';
const judged = (overrides: Parameters<typeof judgment>[0] = {}): JudgmentOutcome => ({
  kind: 'judged',
  judgment: judgment(overrides),
});
const noMatch = (): JudgmentOutcome =>
  judged({ conditions: { c01: 0, c02: 0 }, sections: { s1: 0 } });
const refused = (): JudgmentOutcome =>
  judged({
    pain: {
      choice: 'other',
      probabilities: { acute: 0, subacute: 0, chronic: 0, unstated: 0, other: 1 },
    },
  });

beforeEach(async () => {
  judges = [];
  derivations = [];
  client = {
    judge(description, signal) {
      const result = deferred<JudgmentOutcome>();
      judges.push({ description, signal, result });
      return result.promise;
    },
  };
  host = {
    derive(ids, signal) {
      const result = deferred<IntakeDerivation>();
      derivations.push({ ids, signal, result });
      return result.promise;
    },
  };
  const module = await import('../src/intake/IntakeController.svelte.js');
  create = (selectedClient = client, selectedHost = host) => {
    controller = new module.IntakeController({
      client: selectedClient,
      host: selectedHost,
      vocabulary: UI_VOCABULARY,
    });
    return controller;
  };
});

afterEach(() => {
  controller?.dispose();
  controller = undefined;
});

const deriving = async (created: IntakeController): Promise<Promise<void>[]> => {
  const run = created.submit(DESCRIPTION);
  judges[0]!.result.resolve(judged());
  await turn();
  expect(created.state).toEqual({ kind: 'deriving', description: DESCRIPTION });
  expect(derivations).toHaveLength(1);
  return [run];
};

describe('U2 deterministic intake outcomes', () => {
  it('U4 starts idle and not busy', () => {
    const created = create();
    expect(created.state).toEqual({ kind: 'idle' });
    expect(created.busy).toBe(false);
  });

  it.each(['', ' ', '\t\r\n', ' ', ' '])('U4 empty %j is a no-op', async (input) => {
    const created = create();
    const state = created.state;
    await created.submit(input);
    expect(created.state).toBe(state);
    expect(judges).toHaveLength(0);
    expect(derivations).toHaveLength(0);
  });

  it('U4 trims description before judgment and keeps the trimmed text through failure', async () => {
    const created = create();
    const run = created.submit(` \t${DESCRIPTION}\n `);
    expect(created.state).toEqual({ kind: 'judging', description: DESCRIPTION });
    expect(created.busy).toBe(true);
    expect(judges[0]?.description).toBe(DESCRIPTION);
    judges[0]!.result.resolve({ kind: 'unavailable', reason: 'server' });
    await run;
    expect(created.state).toEqual({ kind: 'failed', description: DESCRIPTION, reason: 'server' });
    expect(created.busy).toBe(false);
  });

  it('U2 refused lands directly and never calls the engine or carries gaps', async () => {
    const created = create();
    const run = created.submit(DESCRIPTION);
    judges[0]!.result.resolve(refused());
    await run;
    expect(created.state).toEqual({ kind: 'refused', description: DESCRIPTION });
    expect(created.busy).toBe(false);
    expect(derivations).toHaveLength(0);
  });

  it('U2 no-match preserves selected gap spans and overflow without deriving', async () => {
    const created = create();
    const run = created.submit(DESCRIPTION);
    judges[0]!.result.resolve(
      judged({
        conditions: { c01: 0.49, c02: 0 },
        sections: { s1: 0 },
        overflow: 7,
        terms: [
          { text: 'gap-sentinel', start: 0, end: 12, value: 0.5 },
          { text: 'not-a-gap', start: 13, end: 22, value: 0.49 },
        ],
      }),
    );
    await run;
    expect(created.state).toEqual({
      kind: 'no-match',
      description: DESCRIPTION,
      gaps: [{ text: 'gap-sentinel', start: 0, end: 12, value: 0.5 }],
      overflow: 7,
    });
    expect(created.busy).toBe(false);
    expect(derivations).toHaveLength(0);
  });

  it('U3 derives match ids in artifact order and associates each result with its own rule', async () => {
    const created = create();
    const [run] = await deriving(created);
    expect(derivations[0]?.ids).toEqual(IDS);
    expect(derivations[0]?.signal).toBe(judges[0]?.signal);
    expect(created.busy).toBe(true);
    const result = derived(IDS);
    derivations[0]!.result.resolve(result);
    await run;
    expect(created.state).toEqual({
      kind: 'answered',
      description: DESCRIPTION,
      pain: 'acute',
      rows: IDS.map((id, index) => ({
        match: {
          ruleId: id,
          trigger:
            index === 0
              ? { kind: 'condition', id: 'c01', value: 0.83 }
              : { kind: 'section', id: 's1', value: 0.91 },
        },
        rule: UI_VOCABULARY.rules[index],
        result: result.kind === 'derived' ? result.rules[index] : undefined,
      })),
      gaps: judgment().terms,
      overflow: 0,
    });
    expect(created.busy).toBe(false);
  });

  const failures: readonly DerivedRule[] = [
    { ruleId: IDS[0]!, status: 'not-derived' },
    { ruleId: IDS[0]!, status: 'limit', limit: 'depth' },
    { ruleId: IDS[0]!, status: 'error', error: { code: 'decode', message: 'bad rule' } },
    { ruleId: IDS[0]!, status: 'cancelled' },
  ];
  it.each(failures)('U3 keeps per-rule $status distinct from a derived answer', async (failure) => {
    const created = create();
    const [run] = await deriving(created);
    const rules = [failure, { ruleId: IDS[1]!, status: 'not-derived' as const }];
    derivations[0]!.result.resolve({ kind: 'derived', rules });
    await run;
    expect(created.state.kind).toBe('answered');
    if (created.state.kind !== 'answered') throw new Error('answered state missing');
    expect(created.state.rows.map((row) => row.result)).toEqual(rules);
    expect(created.state.rows.every((row) => !('text' in row.result))).toBe(true);
    expect(created.busy).toBe(false);
  });

  it('U2 every state replacement leaves earlier state snapshots unchanged', async () => {
    const created = create();
    const idle = created.state;
    const run = created.submit(DESCRIPTION);
    const judging = created.state;
    judges[0]!.result.resolve(judged());
    await turn();
    const derivingState = created.state;
    derivations[0]!.result.resolve(derived(IDS));
    await run;
    expect(idle).toEqual({ kind: 'idle' });
    expect(judging).toEqual({ kind: 'judging', description: DESCRIPTION });
    expect(derivingState).toEqual({ kind: 'deriving', description: DESCRIPTION });
    expect(new Set([idle, judging, derivingState, created.state]).size).toBe(4);
  });
});

describe('U4 failures, retry and cancellation', () => {
  it.each(['rate-limited', 'stale', 'server', 'network', 'invalid'] as const)(
    'U4 unavailable %s is failure rather than no-match',
    async (reason) => {
      const created = create();
      const run = created.submit(DESCRIPTION);
      judges[0]!.result.resolve({ kind: 'unavailable', reason });
      await run;
      expect(created.state).toEqual({ kind: 'failed', description: DESCRIPTION, reason });
      expect(created.busy).toBe(false);
      expect(derivations).toHaveLength(0);
    },
  );

  it.each(['undefined', 'rejected'] as const)('U4 host %s maps to failed engine', async (kind) => {
    const created = create(client, {
      derive: () =>
        kind === 'undefined'
          ? undefined
          : Promise.resolve({ kind: 'rejected', ruleId: 'doc-alpha:1' }),
    });
    const run = created.submit(DESCRIPTION);
    judges[0]!.result.resolve(judged());
    await run;
    expect(created.state).toEqual({ kind: 'failed', description: DESCRIPTION, reason: 'engine' });
    expect(created.busy).toBe(false);
  });

  it.each(['judgment', 'derivation'] as const)(
    // MAIN ruling (m5u16.md): a rejected derivation promise is an engine failure, not network.
    'U4 %s rejection fails with its own phase reason',
    async (phase) => {
      const created = create();
      const run = created.submit(DESCRIPTION);
      if (phase === 'judgment') judges[0]!.result.reject(new Error('transport-rejected'));
      else {
        judges[0]!.result.resolve(judged());
        await turn();
        derivations[0]!.result.reject(new Error('host-rejected'));
      }
      await run;
      expect(created.state).toEqual({
        kind: 'failed',
        description: DESCRIPTION,
        reason: phase === 'judgment' ? 'network' : 'engine',
      });
      expect(created.busy).toBe(false);
    },
  );

  it('U4 retry submits the failed description with a fresh live signal', async () => {
    const created = create();
    const first = created.submit(DESCRIPTION);
    judges[0]!.result.resolve({ kind: 'unavailable', reason: 'rate-limited' });
    await first;
    const retry = created.retry();
    expect(judges).toHaveLength(2);
    expect(judges[1]?.description).toBe(DESCRIPTION);
    expect(judges[1]?.signal).not.toBe(judges[0]?.signal);
    expect(judges[1]?.signal?.aborted).toBe(false);
    judges[1]!.result.resolve(noMatch());
    await retry;
    expect(created.state.kind).toBe('no-match');
  });

  it.each(['idle', 'judging', 'refused', 'no-match', 'answered'] as const)(
    'U4 retry outside failure is inert in %s',
    async (kind) => {
      const created = create();
      let first: Promise<void> | undefined;
      if (kind !== 'idle') {
        first = created.submit(DESCRIPTION);
        if (kind !== 'judging') {
          judges[0]!.result.resolve(
            kind === 'refused' ? refused() : kind === 'no-match' ? noMatch() : judged(),
          );
          if (kind === 'answered') {
            await turn();
            derivations[0]!.result.resolve(derived(IDS));
          }
          await first;
        }
      }
      const snapshot = created.state;
      const count = judges.length;
      await created.retry();
      expect(created.state).toBe(snapshot);
      expect(judges).toHaveLength(count);
      if (kind === 'judging') {
        created.cancel();
        judges[0]!.result.resolve(noMatch());
        await first;
      }
    },
  );

  it.each(['judgment', 'derivation'] as const)(
    'U4 cancel during %s returns idle and discards late success',
    async (phase) => {
      const created = create();
      const run = created.submit(DESCRIPTION);
      if (phase === 'derivation') {
        judges[0]!.result.resolve(judged());
        await turn();
      }
      const signal = judges[0]?.signal;
      created.cancel();
      expect(signal?.aborted).toBe(true);
      expect(created.state).toEqual({ kind: 'idle' });
      expect(created.busy).toBe(false);
      if (phase === 'judgment') judges[0]!.result.resolve(judged());
      else derivations[0]!.result.resolve(derived(IDS));
      await run;
      expect(created.state).toEqual({ kind: 'idle' });
      expect(derivations).toHaveLength(phase === 'judgment' ? 0 : 1);
    },
  );

  it.each(['judgment', 'derivation'] as const)(
    'U4 an AbortError in %s never writes a failure or terminal result',
    async (phase) => {
      const created = create();
      const run = created.submit(DESCRIPTION);
      if (phase === 'derivation') {
        judges[0]!.result.resolve(judged());
        await turn();
      }
      const snapshot = created.state;
      const pending = phase === 'judgment' ? judges[0]!.result : derivations[0]!.result;
      pending.reject(new DOMException('aborted', 'AbortError'));
      await run;
      expect(created.state).toBe(snapshot);
    },
  );
});

describe('D5 intake token starts before judgment and guards all later writes', () => {
  it.each(['answered', 'refused', 'no-match', 'unavailable', 'rejection'] as const)(
    'D5 stale judgment %s cannot derive or overwrite a newer submission',
    async (outcome) => {
      const created = create();
      const first = created.submit('first-description');
      const second = created.submit('second-description');
      expect(judges[0]?.signal?.aborted).toBe(true);
      expect(judges[1]?.signal?.aborted).toBe(false);
      const snapshot = created.state;
      if (outcome === 'rejection') judges[0]!.result.reject(new Error('late failure'));
      else
        judges[0]!.result.resolve(
          outcome === 'answered'
            ? judged()
            : outcome === 'refused'
              ? refused()
              : outcome === 'no-match'
                ? noMatch()
                : { kind: 'unavailable', reason: 'network' },
        );
      await first;
      expect(created.state).toBe(snapshot);
      expect(derivations).toHaveLength(0);
      judges[1]!.result.resolve(noMatch());
      await second;
      expect(created.state).toMatchObject({ kind: 'no-match', description: 'second-description' });
    },
  );

  it.each(['success', 'rejected', 'rejection'] as const)(
    'D5 stale derivation %s cannot overwrite the new judgment phase',
    async (outcome) => {
      const created = create();
      const [first] = await deriving(created);
      const second = created.submit('second-description');
      expect(derivations[0]?.signal?.aborted).toBe(true);
      const snapshot = created.state;
      if (outcome === 'rejection')
        derivations[0]!.result.reject(new Error('late derivation failure'));
      else
        derivations[0]!.result.resolve(
          outcome === 'success' ? derived(IDS) : { kind: 'rejected', ruleId: IDS[0] },
        );
      await first;
      expect(created.state).toBe(snapshot);
      judges[1]!.result.resolve(judged());
      await turn();
      expect(derivations).toHaveLength(2);
      derivations[1]!.result.resolve(derived(IDS));
      await second;
      expect(created.state).toMatchObject({ kind: 'answered', description: 'second-description' });
    },
  );

  it('D5 owns the token before a judgment client re-enters submit synchronously', async () => {
    const first = deferred<JudgmentOutcome>();
    const second = deferred<JudgmentOutcome>();
    const signals: (AbortSignal | undefined)[] = [];
    let newer: Promise<void> | undefined;
    const reentrant: JudgmentClient = {
      judge(description, signal) {
        signals.push(signal);
        if (description === 'first') {
          newer = controller!.submit('second');
          return first.promise;
        }
        return second.promise;
      },
    };
    const created = create(reentrant);
    const older = created.submit('first');
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    first.resolve(judged());
    await older;
    expect(derivations).toHaveLength(0);
    expect(created.state).toEqual({ kind: 'judging', description: 'second' });
    second.resolve(noMatch());
    await newer;
    expect(created.state).toMatchObject({ kind: 'no-match', description: 'second' });
  });

  it.each(['judgment', 'derivation'] as const)(
    'D5 disposal during %s aborts ownership and refuses late writes',
    async (phase) => {
      const created = create();
      const run = created.submit(DESCRIPTION);
      if (phase === 'derivation') {
        judges[0]!.result.resolve(judged());
        await turn();
      }
      created.dispose();
      const snapshot = created.state;
      expect(judges[0]?.signal?.aborted).toBe(true);
      if (phase === 'judgment') judges[0]!.result.resolve(judged());
      else derivations[0]!.result.resolve(derived(IDS));
      await run;
      expect(created.state).toBe(snapshot);
      expect(derivations).toHaveLength(phase === 'judgment' ? 0 : 1);
    },
  );

  it('D5 a whitespace no-op does not cancel a live submission', async () => {
    const created = create();
    const first = created.submit(DESCRIPTION);
    const snapshot = created.state;
    await created.submit(' \n\t ');
    expect(created.state).toBe(snapshot);
    expect(judges[0]?.signal?.aborted).toBe(false);
    expect(judges).toHaveLength(1);
    judges[0]!.result.resolve(noMatch());
    await first;
    expect(created.state.kind).toBe('no-match');
  });

  it('U4 catches a synchronously throwing judgment client as network failure', async () => {
    const reject = vi.fn((): Promise<JudgmentOutcome> => {
      throw new Error('sync-client-failure');
    });
    const created = create({ judge: reject });
    await created.submit(DESCRIPTION);
    expect(created.state).toEqual({ kind: 'failed', description: DESCRIPTION, reason: 'network' });
    expect(reject).toHaveBeenCalledOnce();
  });
});
