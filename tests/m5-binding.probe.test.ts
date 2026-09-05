// Acceptance probes: intentionally RED against cbe0ae2's stored clinical answers.
// Read no committed answer/trace fixture; both controls mutate guideline predicates.
import { expect, it } from 'vitest';

import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';
import { BUDGET_MAX } from '../src/engine/budget.js';
import type { PlSolution } from '../src/engine/protocol.js';
import type { EngineSession } from '../src/engine/session.js';
import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from '../src/questions/catalog.js';
import { payloadDocuments } from '../tools/kb/payload.mjs';
import { bagFiles, boot, solve } from './m5-probe-support.js';

const text = (id: QuestionId, solutions: PlSolution[]): string =>
  synthesizeAnswer(answerRows(id, solutions))
    .map(({ text, sources }) => `${text} [${sources.join(',')}]`)
    .join('\n');

const proofKeys = async (session: EngineSession, id: QuestionId, solutions: PlSolution[]) => {
  const keys = [];
  for (const solution of solutions) {
    const proof = await session.prove(
      { goal: QUESTION_CATALOG[id].goal, selected: solution.display },
      BUDGET_MAX,
    );
    if (proof.kind !== 'proof')
      throw new Error(`proof must complete, got ${JSON.stringify(proof)}`);
    expect(proof.steps.length).toBeGreaterThan(0);
    keys.push(
      proof.steps.map(({ line, head, document, sentence }) => ({ line, head, document, sentence })),
    );
  }
  return keys;
};

it('chk.overlay: a PID-unique semantic mutation changes answer AND line-keyed proof', async () => {
  const session = await boot();
  const id = 'when-to-use-opioids';
  const before = await solve(session, QUESTION_CATALOG[id].goal);
  expect(before.length).toBeGreaterThan(0);
  const beforeProof = await proofKeys(session, id, before);
  const marker = `m5-probe-${process.pid}-overlay`;
  expect(text(id, before)).not.toContain(marker);
  const source = payloadDocuments(bagFiles()).source;
  const site = source
    .split('\n')
    .findIndex(
      (line) =>
        line.startsWith("guideline_event('$guideline_id'(context,'cdc2022-opioid-rec01',2,") &&
        line.includes(',maximize) :-'),
    );
  if (site < 0) throw new Error('rec01:S2 content-bearing event clause missing');
  const original = source.split('\n')[site] as string;
  const mutated = original.replace(',maximize) :-', `,'${marker}') :-`);
  expect(mutated).not.toBe(original);
  const context = "'$guideline_id'(context,'cdc2022-opioid-rec01',2,_,_)";
  session.consult(
    `:- dynamic(guideline_event/3).\n:- retractall(guideline_event(${context},_,maximize)).\n${mutated}\n`,
  );
  // Structural controls prove one semantic replacement really loaded. The bare KB
  // need not prove it: u1 owns question premises and must supply those on its path.
  expect(await solve(session, `clause(guideline_event(${context},_,maximize),_)`)).toEqual([]);
  expect(await solve(session, `clause(guideline_event(${context},_,'${marker}'),_)`)).toHaveLength(
    1,
  );
  const after = await solve(session, QUESTION_CATALOG[id].goal);
  const afterProof = await proofKeys(session, id, after);
  console.log(
    JSON.stringify({
      eventLine: site + 1,
      beforeTerms: before.length,
      afterTerms: after.length,
      beforeProofSites: beforeProof.flat().map(({ line }) => line),
      afterProofSites: afterProof.flat().map(({ line }) => line),
      answerChanged: text(id, after) !== text(id, before),
      proofChanged: JSON.stringify(afterProof) !== JSON.stringify(beforeProof),
    }),
  );
  expect
    .soft(text(id, after), 'schema mutation must change projected clinical text')
    .not.toBe(text(id, before));
  expect
    .soft(afterProof, 'schema mutation must change participated clause identities/heads')
    .not.toEqual(beforeProof);
}, 120_000);

it('chk.gate: removing all semantic clauses removes every shipped answer', async () => {
  const started = performance.now();
  const session = await boot();
  const baseline = new Map<QuestionId, PlSolution[]>();
  for (const id of QUESTION_IDS) {
    const rows = await solve(session, QUESTION_CATALOG[id].goal);
    expect(rows.length, `${id}:positive control`).toBeGreaterThan(0);
    baseline.set(id, rows);
  }
  const schema = [
    ['guideline_arg', 4],
    ['guideline_cardinality', 5],
    ['guideline_entity', 4],
    ['guideline_event', 3],
    ['guideline_operator', 3],
    ['guideline_pp', 4],
    ['guideline_property', 4],
  ] as const;
  session.consult(
    schema
      .map(
        ([name, arity]) =>
          `:- dynamic(${name}/${arity}).\n:- retractall(${name}(${Array.from({ length: arity }, () => '_').join(',')})).`,
      )
      .join('\n'),
  );
  for (const [name, arity] of schema) {
    const goal = `${name}(${Array.from({ length: arity }, () => '_').join(',')})`;
    expect(await solve(session, `clause(${goal},_)`), `${name}:all clauses gone`).toEqual([]);
  }
  const observed = [];
  for (const id of QUESTION_IDS) {
    const after = await solve(session, QUESTION_CATALOG[id].goal);
    observed.push({
      id,
      after: after.length,
      unchanged: text(id, after) === text(id, baseline.get(id) as PlSolution[]),
    });
    expect.soft(after, `${id}:a wiped KB must produce no recommendation`).toHaveLength(0);
  }
  console.log(JSON.stringify({ observed, elapsedMs: performance.now() - started }));
}, 120_000);
