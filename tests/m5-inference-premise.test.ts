import { describe, expect, it } from 'vitest';

import {
  CASES,
  TOPICS,
  atom,
  buildProbeImage,
  loadEngine,
  once,
  prepare,
  text,
} from './m5-inference-support.mjs';

describe('M5 sentence-scoped inference premises', () => {
  it('derives every content head; each supplied premise is deletion-essential', async () => {
    const { engine, diagnostics } = await loadEngine(await buildProbeImage());
    const rows = [];
    for (const c of CASES) {
      const result = once(
        engine,
        `${prepare(c)},length(Heads,HeadsN),length(Assumptions,Premises),` +
          `once(m5_all(Heads,4,Assumptions,Proof)),m5_count(Proof,Nodes,Leaves,Nafs),` +
          `findall(1,(m5_without(Assumptions,Reduced),m5_all(Heads,4,Reduced,_)),Redundant),` +
          `length(Redundant,RedundantN),${text('Assumptions', 'PremiseText')}.`,
      );
      expect(result, `${c.document}:${String(c.sentence)}`).toMatchObject({
        HeadsN: c.clauses.length,
        RedundantN: 0,
      });
      rows.push({ topic: c.topic, document: c.document, sentence: c.sentence, ...result });
      if (process.env.M5_EXACT === '1') {
        const exact = once(engine, `${prepare(c)},${text('Heads', 'GoalText')}.`);
        console.log(
          `EXACT ${c.document}:${String(c.sentence)} assumptions=${String(result.PremiseText)} goal=m5_all(${String(exact.GoalText)},4,Assumptions,Proof)`,
        );
      }
    }
    for (const topic of TOPICS) {
      const cases = rows.filter((row) => row.topic === topic.id);
      console.log(
        JSON.stringify({
          topic: topic.id,
          sentences: cases.length,
          heads: cases.reduce((n, row) => n + Number(row.HeadsN), 0),
          premises: cases.map(
            (row) => `${row.document.slice(-2)}:${String(row.sentence)}=${String(row.Premises)}`,
          ),
          redundant: cases.reduce((n, row) => n + Number(row.RedundantN), 0),
        }),
      );
    }
    expect(rows).toHaveLength(CASES.length);
    expect(diagnostics).toEqual([]);
    expect(
      once(engine, '(guideline_entity(actual,_X,clinician,countable)->Bare=yes;Bare=no).'),
    ).toMatchObject({ Bare: 'no' });
    expect(
      once(engine, `findall(Q,m5_case(Q,_,_,_,_),Qs),sort(Qs,Us),length(Us,N).`),
    ).toMatchObject({ N: 7 });
    expect(atom("quote'test")).toBe("'quote''test'");
  }, 300_000);
});
