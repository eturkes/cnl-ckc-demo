import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { TOPICS, atom, buildProbeImage, loadEngine, once } from './m5-inference-support.mjs';
import { MECHANISM_SOURCE, prepareCases } from './m5-inference-mechanisms.mjs';
import { answerSource, documents } from './m5-inference-answer.mjs';

const REPEATS = 21;
const median = (values: number[]): number =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const rounded = (n: number): number => Number(n.toFixed(3));

describe('M5 assumption-MI synchronous cost', () => {
  it('measures answer and selected-proof steps over all topics under the recorded envelope', async () => {
    const prepared = await loadEngine(await buildProbeImage());
    const cases = prepareCases(prepared.engine);
    const built = await loadEngine(
      await buildProbeImage(`${MECHANISM_SOURCE}\n${answerSource(cases)}\n:- dynamic(m5_table/2).`),
    );
    const { engine, diagnostics } = built;
    once(engine, 'set_prolog_flag(stack_limit,16777216).');
    const samples: Array<{
      topic: string;
      document: string;
      kind: 'answer' | 'proof';
      repeat: number;
      nextMs: number;
      wallMs: number;
      inferences: number;
      depth: number;
    }> = [];
    const docs = documents();
    for (let repeat = 0; repeat < REPEATS; repeat += 1) {
      for (let offset = 0; offset < docs.length; offset += 1) {
        const item = docs[(offset + repeat) % docs.length];
        if (item === undefined) throw new Error('document rotation failed');
        for (const kind of ['answer', 'proof'] as const) {
          const inference =
            kind === 'proof'
              ? `m5_answer_proof(d,2,${atom(item.topic)},Source,Answer,P)`
              : `m5_answer(d,2,${atom(item.topic)},Source,Answer)`;
          const goal =
            `Answer=clinical_answer(${atom(item.document)},_,_),statistics(inferences,I0),` +
            `call_with_inference_limit(call_with_depth_limit(once(${inference}),100,UsedDepth),100000,Limit),` +
            'statistics(inferences,I1),Inferences is I1-I0.';
          const started = performance.now();
          const query = engine.prolog.query(goal);
          const iterator = query[Symbol.iterator]();
          const nextStart = performance.now();
          const step = iterator.next();
          const nextMs = performance.now() - nextStart;
          query.close?.();
          const wallMs = performance.now() - started;
          const result = step.value as Record<string, unknown>;
          expect(
            result?.Inferences,
            `${item.document}:${kind}: ${JSON.stringify({ keys: Object.keys(result ?? {}), done: step.done })}`,
          ).toBeTypeOf('number');
          expect(result.Limit).not.toBe('inference_limit_exceeded');
          expect(typeof result.UsedDepth).toBe('number');
          expect(Number(result.UsedDepth)).toBeLessThanOrEqual(100);
          expect(Number(result.Inferences)).toBeLessThan(100000);
          samples.push({
            ...item,
            kind,
            repeat,
            nextMs,
            wallMs,
            inferences: Number(result.Inferences),
            depth: Number(result.UsedDepth),
          });
        }
      }
    }
    once(engine, 'm5_enable_dynamic.');
    const negativeSamples: Array<{
      topic: string;
      document: string;
      line: number;
      nextMs: number;
      inferences: number;
    }> = [];
    for (const c of cases) {
      for (const clause of c.clauses) {
        const remove = `clause((${clause.head}),_,Ref),clause_property(Ref,file('/prolog.pl')),clause_property(Ref,line_count(${clause.line})),erase(Ref)`;
        const inference = `Answer=clinical_answer(${atom(c.document)},_,_),m5_answer_proof(d,2,${atom(c.topic)},_,Answer,_)`;
        const goal =
          `statistics(inferences,I0),(call_with_inference_limit(call_with_depth_limit(once(snapshot((${remove},${inference}))),100,UsedDepth),100000,Limit)` +
          ' -> (Limit==inference_limit_exceeded -> State=inferences ; UsedDepth==depth_limit_exceeded -> State=depth ; State=proved) ; State=failed),statistics(inferences,I1),Inferences is I1-I0.';
        const query = engine.prolog.query(goal);
        const iterator = query[Symbol.iterator]();
        const started = performance.now();
        const step = iterator.next();
        const nextMs = performance.now() - started;
        query.close?.();
        const result = step.value as Record<string, unknown>;
        expect(result.State, `${c.document}:${String(clause.line)}`).toBe('failed');
        expect(Number(result.Inferences)).toBeLessThan(100000);
        negativeSamples.push({
          topic: c.topic,
          document: c.document,
          line: clause.line,
          nextMs,
          inferences: Number(result.Inferences),
        });
      }
    }
    const counts = new Map<string, { nodes: number; leaves: number; nafs: number }>();
    for (const item of docs) {
      const result = once(
        engine,
        `Answer=clinical_answer(${atom(item.document)},_,_),once(m5_answer_proof(d,2,${atom(item.topic)},_,Answer,P)),m5_count(P,Nodes,Leaves,Nafs).`,
      );
      counts.set(item.document, {
        nodes: Number(result.Nodes),
        leaves: Number(result.Leaves),
        nafs: Number(result.Nafs),
      });
    }
    for (const topic of TOPICS) {
      const relevant = docs.filter((doc) => doc.topic === topic.id);
      const selected = samples.filter((row) => row.topic === topic.id);
      const proofs = selected.filter((row) => row.kind === 'proof');
      const sumMedians = (kind: 'answer' | 'proof', field: 'nextMs' | 'wallMs') =>
        relevant.reduce(
          (n, doc) =>
            n +
            median(
              selected
                .filter((row) => row.document === doc.document && row.kind === kind)
                .map((row) => row[field]),
            ),
          0,
        );
      console.log(
        JSON.stringify({
          topic: topic.id,
          sourceAnswers: relevant.length,
          proofSamples: proofs.length,
          answerWallMedianSumMs: rounded(sumMedians('answer', 'wallMs')),
          proofWallMedianSumMs: rounded(sumMedians('proof', 'wallMs')),
          answerNextMedianSumMs: rounded(sumMedians('answer', 'nextMs')),
          proofNextMedianSumMs: rounded(sumMedians('proof', 'nextMs')),
          worstAnswerNextMs: rounded(
            Math.max(...selected.filter((row) => row.kind === 'answer').map((row) => row.nextMs)),
          ),
          worstProofNextMs: rounded(Math.max(...proofs.map((row) => row.nextMs))),
          worstProofWallMs: rounded(Math.max(...proofs.map((row) => row.wallMs))),
          maxInferences: Math.max(...proofs.map((row) => row.inferences)),
          maxOuterDepth: Math.max(...proofs.map((row) => row.depth)),
          kbNodes: relevant.reduce((n, row) => n + (counts.get(row.document)?.nodes ?? 0), 0),
          assumptionLeaves: relevant.reduce(
            (n, row) => n + (counts.get(row.document)?.leaves ?? 0),
            0,
          ),
        }),
      );
    }
    const worst = [...samples].sort((a, b) => b.nextMs - a.nextMs)[0];
    const worstNegative = [...negativeSamples].sort((a, b) => b.nextMs - a.nextMs)[0];
    console.log(
      JSON.stringify({
        totalSteps: samples.length + negativeSamples.length,
        positiveSteps: samples.length,
        negativeSteps: negativeSamples.length,
        repeatsPerSourceAndKind: REPEATS,
        worst,
        worstNegative,
        maxNegativeInferences: Math.max(...negativeSamples.map((row) => row.inferences)),
        limits: { miCap: 2, stackBytes: 16777216, outerDepth: 100, inferences: 100000 },
        coverage:
          'Node WASM query parsing + iterator.next raw Answer/P conversion + close; negative sample includes snapshot erasure; production proof/UI decoding not implemented; sample maxima are not bounds',
      }),
    );
    expect(samples).toHaveLength(REPEATS * 12 * 2);
    expect(negativeSamples).toHaveLength(686);
    expect(worst?.nextMs).toBeLessThan(1000);
    expect(worstNegative?.nextMs).toBeLessThan(1000);
    expect(diagnostics).toEqual([]);
  }, 300_000);
});
