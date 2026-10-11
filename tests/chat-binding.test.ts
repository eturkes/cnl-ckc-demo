import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  ChatController,
  type AssistantMessage,
  type ChatHost,
} from '../src/chat/ChatController.svelte.js';
import { ReplayChatClient } from '../src/chat/client.js';
import type { ChatEvent } from '../src/chat/events.js';
import { toolResult } from '../src/chat/result.js';
import { BUDGET_MAX } from '../src/engine/budget.js';
import type { QueryOutcome } from '../src/engine/client.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { decodeOnce } from '../src/engine/terms.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
const manifest = JSON.parse(
  readFileSync(new URL('../kb/generated/kb-manifest.json', import.meta.url), 'utf8'),
) as { contract: { schemaVersion: number; documents: number } };
let engine: Engine;
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  engine = await (typeof factory === 'function' ? factory : factory.default)(bytes)({});
  return engine;
};
let session: EngineSession;
const marker = `chat_d4_${String(process.pid)}`;
const goal = `guideline_entity(actual,Id,${marker},countable).`;
let serial = 0;
const once = (text: string): void => {
  const result = decodeOnce(engine.prolog.query(text).once());
  if (result.kind !== 'bindings') throw new Error(`overlay setup failed: ${text}`);
};
const clear = (): void => once(`retractall(guideline_entity(actual,_,${marker},countable)).`);
const plant = (): void =>
  once(`assertz(guideline_entity(actual,${marker}_entity,${marker},countable)).`);

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
  once('dynamic(guideline_entity/4).');
}, 120_000);

const liveGoal: ChatHost['runGoal'] = async (text, signal) => {
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
  const request = {
    id: `d4-${String(++serial)}`,
    kind: 'query' as const,
    goal: text,
    budget: BUDGET_MAX,
    readonly: true as const,
  };
  const response = await session.handle(request, image);
  switch (response.kind) {
    case 'solutions':
      return { kind: response.kind, solutions: response.solutions };
    case 'failure':
      return { kind: response.kind };
    case 'limit':
      return { kind: response.kind, limit: response.limit, solutions: response.solutions };
    case 'cancelled':
      return { kind: response.kind, solutions: response.solutions };
    case 'error':
      return { kind: response.kind, error: response.error };
    default:
      throw new Error(`unexpected live response ${response.kind}`);
  }
};
interface Observation {
  cards: AssistantMessage['cards'];
  posted: ReplayChatClient['posted'];
  dispatched: number;
}
const observe = async (host: ChatHost, dispatch: boolean): Promise<Observation> => {
  const events: ChatEvent[] = [{ type: 'conversation', id: 'd4-conversation' }];
  if (dispatch) events.push({ type: 'query', call: 'q1', goal });
  events.push(
    {
      type: 'answer',
      text: JSON.stringify({
        segments: [{ text: 'Inspect the query card.', source: 'kb', queries: ['q1'], urls: [] }],
      }),
    },
    { type: 'done' },
  );
  const client = new ReplayChatClient([{ message: 'read overlay', events }]);
  let dispatched = 0;
  const controller = new ChatController({
    client,
    host: {
      runGoal: (text, signal) => {
        dispatched += 1;
        expect(text).toBe(goal);
        return host.runGoal(text, signal);
      },
    },
  });
  try {
    await controller.submit('read overlay');
    const message = controller.messages.at(-1);
    if (message?.role !== 'assistant') throw new Error('no real assistant message');
    expect(message.status).toBe('answered');
    for (const card of message.cards) {
      expect(card.goal).toBe(goal);
      expect(card.call).toBe('q1');
      expect(card.outcome).toBeDefined();
      if (!card.outcome) throw new Error('missing engine outcome');
      expect(card.result).toEqual(toolResult(card.outcome));
      expect(client.posted.find((post) => post.call === card.call)).toEqual({
        conversation: 'd4-conversation',
        call: 'q1',
        text: card.result?.text,
        ok: card.result?.ok,
      });
    }
    return { cards: message.cards, posted: client.posted, dispatched };
  } finally {
    controller.dispose();
  }
};
const campaign = async (
  host: ChatHost,
  dispatch = true,
): Promise<readonly [Observation, Observation, Observation]> => {
  clear();
  const before = await observe(host, dispatch);
  try {
    plant();
    const during = await observe(host, dispatch);
    clear();
    const after = await observe(host, dispatch);
    return [before, during, after];
  } finally {
    clear();
  }
};
const displays = (value: Observation): unknown =>
  value.cards.map((card) =>
    card.outcome && 'solutions' in card.outcome
      ? card.outcome.solutions.map((row) => row.display)
      : [],
  );
const text = (value: Observation): string[] => value.posted.map((post) => post.text);
const bindingFailures = ([before, during, after]: readonly [
  Observation,
  Observation,
  Observation,
]): string[] => {
  const failures: string[] = [];
  for (const [name, observation] of [
    ['before', before],
    ['during', during],
    ['after', after],
  ] as const) {
    if (observation.cards.length !== 1) failures.push(`${name}:card-count`);
    if (observation.posted.length !== 1) failures.push(`${name}:post-count`);
    if (observation.dispatched !== 1) failures.push(`${name}:dispatch-count`);
  }
  if (JSON.stringify(displays(before)) === JSON.stringify(displays(during)))
    failures.push('overlay:card-solutions');
  if (JSON.stringify(text(before)) === JSON.stringify(text(during)))
    failures.push('overlay:posted-text');
  if (JSON.stringify(displays(before)) !== JSON.stringify(displays(after)))
    failures.push('retract:card-solutions');
  if (JSON.stringify(text(before)) !== JSON.stringify(text(after)))
    failures.push('retract:posted-text');
  return failures;
};

describe('chat answer binding to exported KB execution', () => {
  it('D4 real controller cards and posted result change under a PID-unique guideline_entity overlay and restore after retraction', async () => {
    const observations = await campaign({ runGoal: liveGoal });
    expect(bindingFailures(observations)).toEqual([]);
    const [before, during, after] = observations;
    expect(before.cards[0]?.outcome?.kind).toBe('failure');
    expect(during.cards[0]?.outcome?.kind).toBe('solutions');
    expect(after.cards[0]?.outcome?.kind).toBe('failure');
    expect(displays(during)).toEqual([[{ Id: `${marker}_entity` }]]);
    expect(during.posted[0]?.text).toContain(`${marker}_entity`);
    expect(before.posted[0]?.text).not.toContain(marker);
  });

  it('D4 fixed-outcome host control fails both card and posted-text binding assertions', async () => {
    clear();
    const fixed: QueryOutcome | undefined = await liveGoal(goal, new AbortController().signal);
    if (!fixed) throw new Error('live baseline missing');
    const observations = await campaign({ runGoal: () => Promise.resolve(fixed) });
    expect(bindingFailures(observations)).toEqual([
      'overlay:card-solutions',
      'overlay:posted-text',
    ]);
  });

  it('D4 no-dispatch controller-path control fails the same binding assertions', async () => {
    const observations = await campaign({ runGoal: liveGoal }, false);
    const failures = bindingFailures(observations);
    expect(failures).toContain('before:dispatch-count');
    expect(failures).toContain('during:card-count');
    expect(failures).toContain('during:post-count');
    expect(failures).toContain('overlay:card-solutions');
    expect(failures).toContain('overlay:posted-text');
  });
});
