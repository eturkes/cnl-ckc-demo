import { describe, expect, it } from 'vitest';

import { clinicalArtifacts } from '../tools/kb/clinical.mjs';
import { FILES, TOPICS, atom, buildProbeImage, loadEngine, once } from './m5-inference-support.mjs';
import { MECHANISM_SOURCE, bounded, prepareCases } from './m5-inference-mechanisms.mjs';
import { answerSource, documents, proofTermGoal, selectedGoal } from './m5-inference-answer.mjs';

const counts =
  'm5_count(P,Nodes,Leaves,Nafs),m5_lines(P,Lines),sort(Lines,Unique),length(Unique,UniqueN)';

describe('M5 genuine resolution after removing the clinical-advice cut', () => {
  it('measures cut-only failure and every topic minimum cap', async () => {
    const cutOnly = await loadEngine(await buildProbeImage(clinicalArtifacts(FILES).helper));
    for (const topic of TOPICS) {
      const native = bounded(cutOnly.engine, `clinical_advice(${atom(topic.id)},_,_)`).State;
      const cap1 = bounded(cutOnly.engine, `mi(clinical_advice(${atom(topic.id)},_,_),1,_)`).State;
      const cap20 = bounded(
        cutOnly.engine,
        `mi(clinical_advice(${atom(topic.id)},_,_),20,_)`,
      ).State;
      expect({ native, cap1, cap20 }).toEqual({
        native: 'proved',
        cap1: 'failed',
        cap20: 'failed',
      });
    }
    console.log(
      'cut-only: native answers=7/7 topics; mi cap1=0/7, cap20=0/7; clinical_advice has no resolve/3 arm',
    );

    const cases = prepareCases(cutOnly.engine);
    const derived = await loadEngine(
      await buildProbeImage(`${MECHANISM_SOURCE}\n${answerSource(cases)}\n:- dynamic(m5_table/2).`),
    );
    once(derived.engine, 'set_prolog_flag(stack_limit,16777216).');
    const rows = [];
    for (const c of cases) {
      const cap1 = bounded(derived.engine, `m5_all(${c.heads},1,${c.assumptions},P)`).State;
      const cap2 = bounded(
        derived.engine,
        `m5_all(${c.heads},2,${c.assumptions},P)`,
        100,
        100000,
        counts,
      );
      expect(cap2.State, `${c.document}:${String(c.sentence)}`).toBe('proved');
      rows.push({
        ...c,
        cap1,
        cap: cap1 === 'proved' ? 1 : 2,
        nodes: Number(cap2.Nodes),
        leaves: Number(cap2.Leaves),
        nafs: Number(cap2.Nafs),
      });
    }
    for (const topic of TOPICS) {
      const selected = rows.filter((row) => row.topic === topic.id);
      const cap = Math.max(...selected.map((row) => row.cap));
      console.log(
        JSON.stringify({
          topic: topic.id,
          cap,
          scenarios: selected.length,
          cap1Complete: selected.filter((row) => row.cap1 === 'proved').length,
          nodes: selected.reduce((n, row) => n + row.nodes, 0),
          assumptions: selected.reduce((n, row) => n + row.leaves, 0),
          nafs: selected.reduce((n, row) => n + row.nafs, 0),
          needsCap2: selected
            .filter((row) => row.cap === 2)
            .map((row) => `${row.document}:${String(row.sentence)}`),
        }),
      );
      expect(cap).toBe(
        ['continuing-or-tapering-opioids', 'opioid-use-disorder-treatment'].includes(topic.id)
          ? 2
          : 1,
      );
    }
    for (const { topic, document } of documents()) {
      const proof = selectedGoal(proofTermGoal('d', document, 2), topic, document);
      expect(bounded(derived.engine, proof).State, `${document}: cap2 source answer`).toBe(
        'proved',
      );
    }
    const variableHeads = once(
      derived.engine,
      'findall(1,(m5_case(_,_,_,Hs,_),m5_has(H,Hs),term_variables(H,Vs),Vs=[_|_]),Xs),length(Xs,N).',
    ).N;
    expect(variableHeads).toBe(655);
    expect(rows.reduce((n, row) => n + row.nodes, 0)).toBe(734);
    expect(rows.filter((row) => row.cap1 === 'proved')).toHaveLength(46);
    expect(cutOnly.diagnostics).toEqual([]);
    expect(derived.diagnostics).toEqual([]);
    console.log(
      'source heads with variables=655/686; selected instantiated proof heads are not source text; render raw line data keyed by live clause reference',
    );
  }, 300_000);
});
