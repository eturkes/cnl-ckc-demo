import { describe, expect, it } from 'vitest';

import { TOPICS, loadEngine, once, success } from './m5-inference-support.mjs';
import {
  answerGoal,
  bounded,
  makeMechanisms,
  proofGoal,
  scopedGoal,
} from './m5-inference-mechanisms.mjs';

const mechanisms = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

describe('M5 premise mechanism matrix', () => {
  it('compares native derivation, genuine proof, contamination and reload', async () => {
    const built = await makeMechanisms();
    const sample = built.cases[0];
    expect(sample).toBeDefined();
    for (const mechanism of mechanisms) {
      const { engine, diagnostics } = built[mechanism];
      once(engine, 'set_prolog_flag(stack_limit,16777216).');
      const answers = [];
      const proofs = [];
      for (const c of built.cases) {
        answers.push(bounded(engine, answerGoal(mechanism, c)).State);
        proofs.push(bounded(engine, proofGoal(mechanism, c)).State);
      }
      const fullTopics = TOPICS.filter((topic) =>
        built.cases.every(
          (c, index) =>
            c.topic !== topic.id || (answers[index] === 'proved' && proofs[index] === 'proved'),
        ),
      ).length;
      const clinicians = once(
        engine,
        'findall(A,guideline_entity(actual,A,clinician,countable),As),sort(As,Unique),length(Unique,N).',
      ).N;
      const rawProof = bounded(
        engine,
        scopedGoal(mechanism, sample, `m5_plain_all(${sample.heads},4,_)`),
      ).State;
      console.log(
        JSON.stringify({
          mechanism,
          answerCases: answers.filter((state) => state === 'proved').length,
          proofCases: proofs.filter((state) => state === 'proved').length,
          fullTopics,
          actualCliniciansAfterQuery: clinicians,
          rawResolverProof: rawProof,
          nonproved:
            mechanism === 'a'
              ? '45 unsatisfied preconditions'
              : built.cases.flatMap((c, i) =>
                  answers[i] === 'proved'
                    ? []
                    : [`${c.document}:${String(c.sentence)}=${String(answers[i])}`],
                ),
          proofNonproved:
            mechanism === 'a'
              ? '45 unsatisfied preconditions'
              : built.cases.flatMap((c, i) =>
                  proofs[i] === 'proved'
                    ? []
                    : [`${c.document}:${String(c.sentence)}=${String(proofs[i])}`],
                ),
        }),
      );
      expect(fullTopics).toBe(
        mechanism === 'a' ? 0 : mechanism === 'b' || mechanism === 'c' ? 5 : 7,
      );
      expect(answers.filter((state) => state === 'proved')).toHaveLength(
        mechanism === 'a' ? 3 : mechanism === 'b' || mechanism === 'c' ? 44 : 48,
      );
      expect(proofs.filter((state) => state === 'proved')).toHaveLength(mechanism === 'a' ? 3 : 48);
      expect(clinicians).toBe(mechanism === 'c' ? 45 : 0);
      expect(rawProof).not.toBe('proved');
      expect(diagnostics).toEqual([]);
    }

    const live = built.b.engine;
    expect(success(live, `m5_assert(${sample.assumptions},_)`)).toBe(true);
    expect(success(live, 'guideline_entity(actual,_,clinician,countable)')).toBe(true);
    const fresh = await loadEngine(built.image);
    expect(success(fresh.engine, 'guideline_entity(actual,_,clinician,countable)')).toBe(false);
    const freshTable = await loadEngine(built.tableImage);
    expect(success(freshTable.engine, 'guideline_entity(actual,_,clinician,countable)')).toBe(true);
    expect(success(built.e.engine, 'predicate_property(guideline_entity(_,_,_,_),dynamic)')).toBe(
      true,
    );
    expect(success(built.d.engine, 'predicate_property(guideline_entity(_,_,_,_),dynamic)')).toBe(
      false,
    );
    expect(
      success(
        built.e.engine,
        `catch(snapshot((m5_assert_first(${sample.assumptions},_),throw(probe_exception))),probe_exception,true)`,
      ),
    ).toBe(true);
    expect(success(built.e.engine, 'guideline_entity(actual,_,clinician,countable)')).toBe(false);
    console.log(
      'reload: b/e/d/f original contexts=0; c compiled hypotheses persist; e snapshot restores thrown queries; dynamic flags persist',
    );
  }, 300_000);
});
