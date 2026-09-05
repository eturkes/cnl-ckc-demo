import { describe, expect, it } from 'vitest';

import { once } from './m5-inference-support.mjs';
import { PREDICATES, bounded } from './m5-inference-mechanisms.mjs';
import {
  answerTermGoal,
  documents,
  makeAnswerMechanisms,
  proofTermGoal,
  selectedGoal,
} from './m5-inference-answer.mjs';

const erase = PREDICATES.map(
  ([p, a]) => `retractall(${p}(${Array.from({ length: a }, () => '_').join(',')}))`,
).join(',');
const withhold =
  'retractall(m5_contexts(_,_)),findall(_, (m5_withheld(Doc,Cases),assertz(m5_contexts(Doc,Cases))),_),retractall(m5_table(_,_))';

describe('M5 inference answer negative controls', () => {
  it('requires both explicit premises and real guideline clauses for every answer row', async () => {
    const built = await makeAnswerMechanisms();
    for (const mechanism of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
      const { engine, diagnostics } = built[mechanism];
      once(engine, 'm5_enable_dynamic.');
      const rows = [];
      for (const { topic, document } of documents()) {
        const answer = selectedGoal(answerTermGoal(mechanism, document), topic, document);
        const proof = selectedGoal(proofTermGoal(mechanism, document), topic, document);
        const baseline = bounded(engine, answer).State;
        const baselineProof = bounded(engine, proof).State;
        const noKb = bounded(engine, `snapshot((${erase},${answer}))`).State;
        const noKbProof = bounded(engine, `snapshot((${erase},${proof}))`).State;
        const noPremises = bounded(engine, `snapshot((${withhold},${answer}))`).State;
        const noPremisesProof = bounded(engine, `snapshot((${withhold},${proof}))`).State;
        rows.push({
          document,
          baseline,
          baselineProof,
          noKb,
          noKbProof,
          noPremises,
          noPremisesProof,
        });
        expect(
          { noKb, noKbProof, noPremises, noPremisesProof },
          `${mechanism}:${document}`,
        ).toEqual({
          noKb: 'failed',
          noKbProof: 'failed',
          noPremises: 'failed',
          noPremisesProof: 'failed',
        });
      }
      console.log(
        JSON.stringify({
          mechanism,
          baselineAnswers: rows.filter((row) => row.baseline === 'proved').length,
          baselineProofs: rows.filter((row) => row.baselineProof === 'proved').length,
          noKb: rows.filter((row) => row.noKb === 'failed' && row.noKbProof === 'failed').length,
          noPremises: rows.filter(
            (row) => row.noPremises === 'failed' && row.noPremisesProof === 'failed',
          ).length,
          limited: rows.filter((row) => row.baseline !== 'proved' && row.baseline !== 'failed'),
        }),
      );
      expect(rows.filter((row) => row.baseline === 'proved')).toHaveLength(
        mechanism === 'a' ? 0 : mechanism === 'b' ? 9 : mechanism === 'c' ? 7 : 12,
      );
      expect(rows.filter((row) => row.baselineProof === 'proved')).toHaveLength(
        mechanism === 'a' ? 0 : 12,
      );
      expect(diagnostics).toEqual([]);
    }
  }, 300_000);
});
