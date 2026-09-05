import { describe, expect, it } from 'vitest';

import { CASES, once, text } from './m5-inference-support.mjs';
import { bounded } from './m5-inference-mechanisms.mjs';
import {
  answerTermGoal,
  documents,
  makeAnswerMechanisms,
  proofTermGoal,
  selectedGoal,
} from './m5-inference-answer.mjs';

const proofLines = `m5_lines(P,Lines),sort(Lines,Unique),${text('Unique', 'LineText')}`;

describe('M5 cited-clause answer/proof binding', () => {
  it('erases every selected content clause, one at a time, against real answer terms', async () => {
    const built = await makeAnswerMechanisms();
    for (const mechanism of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
      const { engine, diagnostics } = built[mechanism];
      once(engine, 'm5_enable_dynamic.');
      let baselineRows = 0,
        erased = 0,
        changedAnswers = 0,
        changedProofs = 0;
      const answerAfterStates: Record<string, number> = {};
      const proofAfterStates: Record<string, number> = {};
      const skipped: string[] = [];
      for (const { topic, document } of documents()) {
        const answer = selectedGoal(answerTermGoal(mechanism, document), topic, document);
        const proof = selectedGoal(proofTermGoal(mechanism, document), topic, document);
        const beforeAnswer = bounded(engine, answer, 100, 100000, text('Answer', 'AnswerText'));
        const beforeProof = bounded(engine, proof, 100, 100000, proofLines);
        if (beforeAnswer.State !== 'proved' || beforeProof.State !== 'proved') {
          skipped.push(`${document}:${String(beforeAnswer.State)}/${String(beforeProof.State)}`);
          continue;
        }
        baselineRows += 1;
        const lines = JSON.parse(String(beforeProof.LineText)) as number[];
        const clauses = CASES.filter((c) => c.document === document).flatMap((c) => c.clauses);
        for (const clause of clauses) {
          expect(lines, `${document}:${String(clause.line)} must participate`).toContain(
            clause.line,
          );
          const remove = `clause((${clause.head}),_,Ref),clause_property(Ref,file('/prolog.pl')),clause_property(Ref,line_count(${clause.line})),erase(Ref)`;
          const afterAnswer = bounded(
            engine,
            `snapshot((${remove},${answer}))`,
            100,
            100000,
            text('Answer', 'AnswerText'),
          );
          const afterProof = bounded(
            engine,
            `snapshot((${remove},${proof}))`,
            100,
            100000,
            proofLines,
          );
          expect(
            ['failed', 'inferences', 'depth', 'stack'],
            `${mechanism}:${document}:${String(clause.line)} answer`,
          ).toContain(afterAnswer.State);
          expect(
            ['failed', 'inferences', 'depth', 'stack'],
            `${mechanism}:${document}:${String(clause.line)} proof`,
          ).toContain(afterProof.State);
          answerAfterStates[String(afterAnswer.State)] =
            (answerAfterStates[String(afterAnswer.State)] ?? 0) + 1;
          proofAfterStates[String(afterProof.State)] =
            (proofAfterStates[String(afterProof.State)] ?? 0) + 1;
          expect(String(afterAnswer.AnswerText)).not.toBe(String(beforeAnswer.AnswerText));
          expect(String(afterProof.LineText)).not.toBe(String(beforeProof.LineText));
          erased += 1;
          changedAnswers += Number(afterAnswer.State !== 'proved');
          changedProofs += Number(afterProof.State !== 'proved');
        }
      }
      console.log(
        JSON.stringify({
          mechanism,
          baselineRows,
          erased,
          changedAnswers,
          changedProofs,
          answerAfterStates,
          proofAfterStates,
          skipped,
        }),
      );
      expect(baselineRows).toBe(
        mechanism === 'a' ? 0 : mechanism === 'b' ? 9 : mechanism === 'c' ? 7 : 12,
      );
      expect(erased).toBe(
        mechanism === 'a' ? 0 : mechanism === 'b' ? 498 : mechanism === 'c' ? 369 : 686,
      );
      expect(diagnostics).toEqual([]);
    }
  }, 300_000);
});
