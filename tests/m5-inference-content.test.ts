import { describe, expect, it } from 'vitest';

import { TOPICS, buildProbeImage, loadEngine, once, text } from './m5-inference-support.mjs';
import { bounded, prepareCases } from './m5-inference-mechanisms.mjs';

const actorOnly = String.raw`
m5_actor_only(A,[guideline_entity(actual,C,clinician,countable),guideline_cardinality(actual,C,na,eq,1)]) :- m5_has(guideline_entity(actual,C,clinician,countable),A),m5_has(guideline_cardinality(actual,C,na,eq,1),A),!.
m5_actor_only(_,[]).
`;

describe('M5 current-content inference boundary', () => {
  it('distinguishes clinician-only feasibility from complete conditional content', async () => {
    const { engine, diagnostics } = await loadEngine(await buildProbeImage(actorOnly));
    const cases = prepareCases(engine);
    const rows = [];
    for (const c of cases) {
      const prepared = once(engine, `m5_actor_only(${c.assumptions},A),${text('A', 'ActorText')}.`);
      const actor = String(prepared.ActorText);
      const clinicianOnly = bounded(engine, `m5_all(${c.heads},2,${actor},_)`).State;
      const complete = bounded(engine, `m5_all(${c.heads},2,${c.assumptions},_)`).State;
      expect(complete, `${c.document}:${String(c.sentence)}`).toBe('proved');
      rows.push({ ...c, clinicianOnly, complete });
    }
    let missingCases = 0,
      missingHeads = 0;
    for (const topic of TOPICS) {
      const selected = rows.filter((row) => row.topic === topic.id);
      const missing = selected.filter((row) => row.clinicianOnly !== 'proved');
      missingCases += missing.length;
      missingHeads += missing.reduce((n, row) => n + row.clauses.length, 0);
      console.log(
        JSON.stringify({
          topic: topic.id,
          clinicianOnlyCases: selected.length - missing.length,
          fullContextCases: selected.length,
          clinicianOnlyHeads: selected
            .filter((row) => row.clinicianOnly === 'proved')
            .reduce((n, row) => n + row.clauses.length, 0),
          fullContextHeads: selected.reduce((n, row) => n + row.clauses.length, 0),
          missing: missing.map((row) => `${row.document}:${String(row.sentence)}`),
        }),
      );
      if (process.env.M5_EXACT === '1')
        for (const row of missing)
          console.log(`MISSING ${row.document}:${String(row.sentence)} ${row.original}`);
    }
    expect(missingCases).toBe(26);
    expect(missingHeads).toBe(281);
    expect(
      TOPICS.filter((topic) =>
        rows.filter((row) => row.topic === topic.id).every((row) => row.clinicianOnly === 'proved'),
      ),
    ).toHaveLength(2);
    expect(diagnostics).toEqual([]);
  }, 300_000);
});
