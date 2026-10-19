import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import { toolResult, TOOL_RESULT_MAX } from '../src/chat/result.js';
import type { QueryOutcome } from '../src/engine/client.js';
import { BUDGET_MAX } from '../src/engine/budget.js';
import type { BudgetSpec, PlSolution } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
const manifest = JSON.parse(
  readFileSync(new URL('../kb/generated/kb-manifest.json', import.meta.url), 'utf8'),
) as { contract: { schemaVersion: number; documents: number } };
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (bytes: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  return (typeof factory === 'function' ? factory : factory.default)(bytes)({});
};
let session: EngineSession;
let serial = 0;
beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(image);
}, 120_000);

const query = async (goal: string, budget: BudgetSpec = BUDGET_MAX): Promise<QueryOutcome> => {
  const request = {
    id: `d2-${String(++serial)}`,
    kind: 'query' as const,
    goal,
    budget,
    readonly: true as const,
  };
  const response = await session.handle(request, image);
  switch (response.kind) {
    case 'solutions':
      return { kind: response.kind, solutions: response.solutions };
    case 'failure':
      return { kind: response.kind };
    case 'limit':
      return { kind: response.kind, solutions: response.solutions, limit: response.limit };
    case 'cancelled':
      return { kind: response.kind, solutions: response.solutions };
    case 'error':
      return { kind: response.kind, error: response.error };
    default:
      throw new Error(`unexpected query response ${response.kind}`);
  }
};
const rowsOf = (outcome: QueryOutcome): PlSolution[] =>
  'solutions' in outcome ? outcome.solutions : [];
const lineOf = (solution: PlSolution): string =>
  Object.entries(solution.display)
    .map(([name, display]) => `${name} = ${display}`)
    .join(', ');
const omission = (text: string, count: number): void => {
  const closing = text.split('\n').at(-1) ?? '';
  expect(closing).toContain(String(count));
  expect(closing).toMatch(/omitted|left out|not shown|excluded/iu);
};
const synthetic = (displays: string[]): QueryOutcome => ({
  kind: 'solutions',
  solutions: displays.map((display) => ({
    bindings: { Answer: { kind: 'atom', value: 'binding-must-not-be-read' } },
    display: { Answer: display },
  })),
});

describe('model reads engine-authored text', () => {
  it('D2 real solutions keep every display byte and join variables on their solution line', async () => {
    const outcome = await query(
      // once/1: `guideline_schema_version/1` holds one fact per document, 337 in all.
      'once(guideline_schema_version(V)), X = \'quoted atom\', Y = "日本語\\ntext".',
    );
    expect(outcome.kind).toBe('solutions');
    const rows = rowsOf(outcome);
    expect(rows).toHaveLength(1);
    const result = toolResult(outcome);
    expect(result).toMatchObject({ ok: true, shown: 1, total: 1 });
    expect(result.text.split('\n').slice(1)).toEqual(rows.map(lineOf));
    expect(result.text).toMatch(/^solutions/u);
  });

  it('D2 real failure reports zero solutions and a completed goal', async () => {
    const outcome = await query('guideline_document(chat_d2_absent_document,_,_,_).');
    expect(outcome).toEqual({ kind: 'failure' });
    expect(toolResult(outcome)).toMatchObject({ ok: true, shown: 0, total: 0 });
    expect(toolResult(outcome).text).toContain('failure');
  });

  it('D2 real guard refusal returns the engine message, refused and not ok', async () => {
    const outcome = await query('call(guideline_schema_version(_)).');
    expect(outcome.kind).toBe('error');
    if (outcome.kind !== 'error') throw new Error('expected read-only refusal');
    expect(outcome.error.code).toBe('guard');
    const result = toolResult(outcome);
    expect(result).toMatchObject({ ok: false, shown: 0, total: 0 });
    expect(result.text).toContain('refused');
    expect(result.text).toContain(outcome.error.message);
  });

  it('D2 real answer-cap limit names its limit and preserves partial display', async () => {
    const outcome = await query('guideline_document(D,T,S,V).', { ...BUDGET_MAX, answerCap: 1 });
    expect(outcome.kind).toBe('limit');
    if (outcome.kind !== 'limit') throw new Error('expected limit');
    expect(outcome.limit).toBe('answer-cap');
    const result = toolResult(outcome);
    expect(result).toMatchObject({ ok: true, shown: 1, total: 1 });
    expect(result.text).toContain('answer-cap');
    expect(result.text).toContain(lineOf(outcome.solutions[0]!));
  });

  it('D2 long real result cuts only between solutions and names omitted rows', async () => {
    const outcome = await query('guideline_document(D,T,S,V).');
    const rows = rowsOf(outcome);
    expect(rows.map(lineOf).join('\n').length).toBeGreaterThan(8000);
    const result = toolResult(outcome);
    expect(TOOL_RESULT_MAX).toBe(8000);
    expect(result.total).toBe(rows.length);
    expect(result.shown).toBeGreaterThan(0);
    expect(result.shown).toBeLessThan(result.total);
    expect(result.text.length).toBeLessThanOrEqual(TOOL_RESULT_MAX);
    expect(result.text).not.toMatch(/\[cut at/u);
    expect(result.text.split('\n').slice(1, -1)).toEqual(rows.slice(0, result.shown).map(lineOf));
    omission(result.text, result.total - result.shown);
  });

  it('D2 first oversized real solution is shown partially with an accurate character marker', async () => {
    const outcome = await query('findall(D,guideline_document(D,_,_,_),Documents).');
    expect(outcome.kind).toBe('solutions');
    const rows = rowsOf(outcome);
    expect(rows).toHaveLength(1);
    const full = lineOf(rows[0]!);
    expect(full.length).toBeGreaterThan(TOOL_RESULT_MAX);
    const result = toolResult(outcome);
    expect(result).toMatchObject({ ok: true, shown: 1, total: 1 });
    expect(result.text.length).toBeLessThanOrEqual(TOOL_RESULT_MAX);
    const match = /\[cut at (\d+) of (\d+) characters\]/u.exec(result.text);
    expect(match).not.toBeNull();
    const kept = Number(match?.[1]);
    const total = Number(match?.[2]);
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(total);
    expect(total).toBe(full.length);
    expect(result.text).toContain(full.slice(0, kept));
    expect(result.text).not.toContain(full);
  });

  it('D2 generated display lengths preserve bounds, prefixes, counts and immutable input', () => {
    const sizes = [
      0, 1, 20, 3970, 3980, 7970, 7971, 7972, 7973, 7974, 7975, 7976, 7977, 7978, 7979, 7980, 7990,
      8000, 8001, 16_001,
    ];
    for (const size of sizes) {
      for (const count of [1, 2, 5, 12]) {
        const displays = Array.from(
          { length: count },
          (_, index) => `${String(index)}:${'x'.repeat(size)}`,
        );
        const outcome = synthetic(displays);
        const before = structuredClone(outcome);
        const result = toolResult(outcome);
        expect(
          result.text.length,
          `size=${String(size)}, count=${String(count)}`,
        ).toBeLessThanOrEqual(8000);
        expect(result.ok).toBe(true);
        expect(result.total).toBe(count);
        expect(result.shown).toBeGreaterThan(0);
        expect(result.shown).toBeLessThanOrEqual(count);
        expect(result.text).not.toContain('binding-must-not-be-read');
        expect(outcome).toEqual(before);
        if (!result.text.includes('[cut at')) {
          const lines = rowsOf(outcome).map(lineOf);
          expect(result.text.split('\n').slice(1, result.shown + 1)).toEqual(
            lines.slice(0, result.shown),
          );
        }
        if (result.shown < count) omission(result.text, count - result.shown);
      }
    }
  });

  it('D2 display is the sole solution text source even when bindings disagree', () => {
    const shown = "'verbatim \\n display 日本語'";
    const result = toolResult(synthetic([shown]));
    expect(result.text.split('\n').slice(1)).toEqual([`Answer = ${shown}`]);
    expect(result.text).not.toContain('binding-must-not-be-read');
  });

  it.each(['stack', 'depth', 'inference', 'wall-clock', 'answer-cap', 'heap'] as const)(
    'D2 each limit %s remains ok and names its reason',
    (limit) => {
      const result = toolResult({ kind: 'limit', limit, solutions: [] });
      expect(result).toMatchObject({ ok: true, shown: 0, total: 0 });
      expect(result.text).toContain('limit');
      expect(result.text).toContain(limit);
    },
  );

  it('D2 other errors and cancellation cannot claim the goal ran', () => {
    const result = toolResult({
      kind: 'error',
      error: { code: 'prolog', message: 'engine-error-marker' },
    });
    expect(result).toMatchObject({ ok: false, shown: 0, total: 0 });
    expect(result.text).toContain('error');
    expect(result.text).toContain('engine-error-marker');
    expect(toolResult({ kind: 'cancelled', solutions: [] }).ok).toBe(false);
  });
});
