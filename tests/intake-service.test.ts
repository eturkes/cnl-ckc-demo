import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { QueryOutcome } from '../src/engine/client.js';
import type { LimitKind, PlSolution } from '../src/engine/protocol.js';
import { EngineSession } from '../src/engine/session.js';
import type { PlTerm } from '../src/engine/terms.js';
import type { IntakeEngine } from '../src/intake/service.js';
import { presentClinicalAdvice } from '../src/questions/advice.js';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';

import { bagFiles, gateRecords, ROOT } from './clinical-test-support.js';
import {
  compound,
  list,
  loadIntakeImage,
  referenceVocabulary,
  ruleRecords,
} from './intake-backend-support.js';

const subject = () => import('../src/intake/service.js');
const vocabulary = referenceVocabulary();
const first = vocabulary.rules[0];
const firstRecord = ruleRecords[0];
if (first === undefined || firstRecord === undefined) throw new Error('no intake rule oracle');
const ruleTerm = firstRecord.rule;
const call = (functor: string, ...args: PlTerm[]): PlTerm => ({ kind: 'compound', functor, args });
const line = (value: number): PlTerm => call('line', { kind: 'integer', value });
const node = (value: number, children: PlTerm[] = []): PlTerm =>
  call(
    'node',
    line(value),
    { kind: 'atom', value: 'test_head' },
    { kind: 'list', items: children },
  );
const proof: PlTerm = {
  kind: 'list',
  items: [
    node(31, [node(7), node(31)]),
    call('assumption', { kind: 'atom', value: 'hypothetical' }),
    node(17),
  ],
};
const solution = (Rule: PlTerm = ruleTerm, Proof: PlTerm = proof): PlSolution => ({
  bindings: { Rule, Proof },
  display: { Rule: 'display-is-not-the-binding', Proof: 'opaque' },
});
const success = (Rule: PlTerm = ruleTerm, Proof: PlTerm = proof): QueryOutcome => ({
  kind: 'solutions',
  solutions: [solution(Rule, Proof)],
});
const fakeEngine = (outcome: QueryOutcome = success()) => ({
  query: vi.fn<IntakeEngine['query']>().mockResolvedValue(outcome),
});
const shown = (Rule: PlTerm): string => {
  const result = presentClinicalAdvice(
    call(
      'clinical_answer',
      { kind: 'atom', value: first.document },
      { kind: 'list', items: [Rule] },
      { kind: 'string', value: 'adapter-marker-not-an-answer' },
    ),
  );
  if (result?.structured !== true || result.items.length !== 1)
    throw new Error('invalid test rule');
  return result.items[0] as string;
};

const invalidIds: { name: string; value: unknown }[] = [
  { name: 'missing', value: undefined },
  { name: 'null', value: null },
  { name: 'number', value: 1 },
  { name: 'boolean', value: true },
  { name: 'array', value: [first.id] },
  { name: 'record', value: { id: first.id } },
  { name: 'empty', value: '' },
  { name: 'absent', value: 'cdc2022-opioid-rec99:2' },
  { name: 'leading-space', value: ` ${first.id}` },
  { name: 'goal-not-id', value: first.goal },
];
const limits: LimitKind[] = ['stack', 'depth', 'inference', 'wall-clock', 'answer-cap', 'heap'];

describe('intake derivation contract', () => {
  it.each(invalidIds)(
    'D1 refuses $name before any engine call even after valid ids',
    async ({ value }) => {
      const { IntakeService } = await subject();
      const engine = fakeEngine();
      const result = await new IntakeService(engine, vocabulary).derive([first.id, value]);
      expect(result).toEqual({ kind: 'rejected', ruleId: value });
      expect(engine.query).not.toHaveBeenCalled();
    },
  );

  it('D1 empty selection performs no query and returns no rule', async () => {
    const { IntakeService } = await subject();
    const engine = fakeEngine();
    expect(await new IntakeService(engine, vocabulary).derive([])).toEqual({
      kind: 'derived',
      rules: [],
    });
    expect(engine.query).not.toHaveBeenCalled();
  });

  it('D1 every accepted id runs its artifact goal byte-for-byte under the one-answer budget', async () => {
    const { IntakeService, INTAKE_BUDGET } = await subject();
    const engine = fakeEngine({ kind: 'failure' });
    const signal = new AbortController().signal;
    const ids = [...vocabulary.rules].reverse().map(({ id }) => id);
    const result = await new IntakeService(engine, vocabulary).derive(ids, signal);
    expect(engine.query).toHaveBeenCalledTimes(48);
    expect(INTAKE_BUDGET.answerCap).toBe(1);
    for (const value of Object.values(INTAKE_BUDGET)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect(engine.query.mock.calls.map(([goal]) => goal).sort()).toEqual(
      vocabulary.rules.map(({ goal }) => goal).sort(),
    );
    for (const [, budget, receivedSignal] of engine.query.mock.calls) {
      expect(budget).toEqual(INTAKE_BUDGET);
      expect(receivedSignal).toBe(signal);
    }
    expect(result.kind).toBe('derived');
    if (result.kind !== 'derived') throw new Error('valid ids rejected');
    expect(new Set(result.rules.map(({ ruleId }) => ruleId))).toEqual(new Set(ids));
  });

  it('D2 shown text follows the returned Rule binding through the existing one-rule grammar', async () => {
    const { IntakeService } = await subject();
    const altered = structuredClone(ruleTerm);
    const actions = list(compound(altered, 'rule')[3]);
    const action = compound(actions[0], 'action');
    action[2] = { kind: 'string', value: 'a u16-bound-result' };
    expect(shown(altered)).not.toBe(shown(ruleTerm));
    const engine = fakeEngine(success(altered));
    const result = await new IntakeService(engine, vocabulary).derive([first.id]);
    expect(result.kind).toBe('derived');
    if (result.kind !== 'derived') throw new Error('valid id rejected');
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toEqual({
      ruleId: first.id,
      status: 'derived',
      text: shown(altered),
      lines: expect.any(Array) as number[],
    });
    const row = result.rules[0];
    if (row?.status !== 'derived') throw new Error('Rule binding not rendered');
    expect(new Set(row.lines)).toEqual(new Set([7, 17, 31]));
    expect(row.lines).toHaveLength(3);
    expect(row.text).not.toContain('display-is-not-the-binding');
    expect(row.text).not.toContain('adapter-marker');
  });

  it.each([
    { name: 'missing Rule', bindings: { Proof: proof } },
    {
      name: 'atom Rule',
      bindings: { Rule: { kind: 'atom', value: 'rule' } as PlTerm, Proof: proof },
    },
    {
      name: 'malformed Rule',
      bindings: { Rule: call('rule', { kind: 'list', items: [] }), Proof: proof },
    },
    { name: 'missing Proof', bindings: { Rule: ruleTerm } },
  ])('D2 $name never renders a passage or a recommendation', async ({ bindings }) => {
    const { IntakeService } = await subject();
    const engine = fakeEngine({ kind: 'solutions', solutions: [{ bindings, display: {} }] });
    const result = await new IntakeService(engine, vocabulary).derive([first.id]);
    expect(result.kind).toBe('derived');
    if (result.kind !== 'derived') throw new Error('valid id rejected');
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]).toEqual({
      ruleId: first.id,
      status: 'error',
      error: { code: 'decode', message: expect.any(String) as string },
    });
    expect(result.rules[0]).not.toHaveProperty('text');
  });

  it('D3 erasing a cited guideline clause changes the shown set through IntakeService alone', async () => {
    const { IntakeService } = await subject();
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8'),
    ) as {
      contract: { schemaVersion: number; documents: number };
    };
    const base = new EngineSession({ loadImage: loadIntakeImage, expected: manifest.contract });
    await base.boot(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))));
    const ids = vocabulary.rules.slice(0, 3).map(({ id }) => id);
    const query = vi.fn<IntakeEngine['query']>((goal, budget) => base.solve(goal, budget));
    const baseline = await new IntakeService({ query }, vocabulary).derive(ids);
    expect(baseline.kind).toBe('derived');
    if (baseline.kind !== 'derived') throw new Error('baseline ids rejected');
    expect(baseline.rules.map(({ status }) => status)).toEqual(['derived', 'derived', 'derived']);
    const victim = baseline.rules.find(({ ruleId }) => ruleId === ids[0]);
    if (victim?.status !== 'derived') throw new Error('victim did not derive');
    const gate = gateRecords.find(
      ({ document, sentence }) => `${document}:${String(sentence)}` === victim.ruleId,
    );
    expect(gate).toBeDefined();
    expect(new Set(victim.lines)).toEqual(new Set(gate?.lines));
    const erased = victim.lines[0];
    if (erased === undefined) throw new Error('victim has no cited line');
    const source = payloadSource(bagFiles).source.split('\n');
    expect(source[erased - 1]).toMatch(/^guideline_/u);
    source[erased - 1] = `% u16-${String(process.pid)} erased ${source[erased - 1] as string}`;
    const overlay = new EngineSession({ loadImage: loadIntakeImage, expected: manifest.contract });
    await overlay.boot((await buildImage(source.join('\n'))).image);
    const after = await new IntakeService(
      { query: (goal, budget) => overlay.solve(goal, budget) },
      vocabulary,
    ).derive(ids);
    expect(after.kind).toBe('derived');
    if (after.kind !== 'derived') throw new Error('overlay ids rejected');
    expect(after.rules.find(({ ruleId }) => ruleId === victim.ruleId)).toEqual({
      ruleId: victim.ruleId,
      status: 'not-derived',
    });
    expect(after.rules.filter(({ status }) => status === 'derived')).toEqual(
      baseline.rules.filter(({ ruleId }) => ruleId !== victim.ruleId),
    );
    expect(after.rules.filter(({ status }) => status === 'derived')).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(3);
  }, 300_000);

  it.each(limits)(
    'D4 %s limit stays a limit even if the engine returns a partial solution',
    async (limit) => {
      const { IntakeService } = await subject();
      const engine = fakeEngine({ kind: 'limit', limit, solutions: [solution()] });
      expect(await new IntakeService(engine, vocabulary).derive([first.id])).toEqual({
        kind: 'derived',
        rules: [{ ruleId: first.id, status: 'limit', limit }],
      });
    },
  );

  it('D4 failure, error and cancellation stay distinct and cannot show text', async () => {
    const { IntakeService } = await subject();
    const error = { code: 'prolog' as const, message: 'u16 failure' };
    const engine = fakeEngine();
    engine.query
      .mockResolvedValueOnce({ kind: 'failure' })
      .mockResolvedValueOnce({ kind: 'error', error })
      .mockResolvedValueOnce({ kind: 'cancelled', solutions: [solution()] });
    const ids = vocabulary.rules.slice(0, 3).map(({ id }) => id);
    const result = await new IntakeService(engine, vocabulary).derive(ids);
    expect(result).toEqual({
      kind: 'derived',
      rules: [
        { ruleId: ids[0], status: 'not-derived' },
        { ruleId: ids[1], status: 'error', error },
        { ruleId: ids[2], status: 'cancelled' },
      ],
    });
  });

  it('D4 all 48 failed derivations produce zero recommendation text', async () => {
    const { IntakeService } = await subject();
    const engine = fakeEngine({ kind: 'failure' });
    const result = await new IntakeService(engine, vocabulary).derive(
      vocabulary.rules.map(({ id }) => id),
    );
    expect(result.kind).toBe('derived');
    if (result.kind !== 'derived') throw new Error('valid ids rejected');
    expect(result.rules).toHaveLength(48);
    expect(result.rules.every(({ status }) => status === 'not-derived')).toBe(true);
    for (const rule of result.rules) expect(rule).not.toHaveProperty('text');
  });
});
