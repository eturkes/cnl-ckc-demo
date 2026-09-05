import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineSession, type Engine } from '../src/engine/session.js';
import {
  CUTLESS_PROOF,
  ROOT,
  atom,
  buildProbeImage,
  loadEngine,
  once,
  success,
} from './m5-inference-support.mjs';
import { prepareCases } from './m5-inference-mechanisms.mjs';

const leafCheck = String.raw`
m5_leaf_check([],_,0).
m5_leaf_check([assumption(H)|T],A,N) :- m5_has(H,A),m5_leaf_check(T,A,N0),N is N0+1.
m5_leaf_check([naf(_)|T],A,N) :- m5_leaf_check(T,A,N).
m5_leaf_check([node(line(L),_,C)|T],A,N) :- integer(L),m5_leaf_check(C,A,NC),m5_leaf_check(T,A,NT),N is NC+NT.
`;

describe('M5 explicit hypothetical-premise provenance', () => {
  it('keeps every assumption separate from KB lines and exposes the current decoder seam', async () => {
    const proof = CUTLESS_PROOF.replace(
      'derive(true,',
      "derive(m5_ui_case,D,P,proved) :- m5_prepare('when-to-use-opioids','cdc2022-opioid-rec01',2,H,A),m5_all(H,D,A,P).\nderive(true,",
    );
    const image = await buildProbeImage(leafCheck, proof);
    const loaded = await loadEngine(image);
    const cases = prepareCases(loaded.engine);
    let assumptions = 0;
    for (const c of cases) {
      const row = once(
        loaded.engine,
        `once(m5_all(${c.heads},2,${c.assumptions},P)),m5_leaf_check(P,${c.assumptions},Leaves).`,
      );
      expect(row.success).toBe(true);
      assumptions += Number(row.Leaves);
    }
    expect(assumptions).toBe(3882);
    expect(success(loaded.engine, 'guideline_entity(actual,_,clinician,countable)')).toBe(false);
    expect(success(loaded.engine, 'predicate_property(guideline_entity(_,_,_,_),dynamic)')).toBe(
      false,
    );
    expect(once(loaded.engine, `findall(Q,m5_case(Q,_,_,_,_),Qs),sort(Qs,U),length(U,N).`).N).toBe(
      7,
    );

    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8'),
    ) as { contract: { schemaVersion: number; documents: number } };
    const session = new EngineSession({
      loadImage: async () => loaded.engine as Engine,
      expected: manifest.contract,
    });
    await session.boot(image);
    const result = await session.handle(
      {
        id: 'assumption-node-protocol',
        kind: 'proof',
        input: { constrainedGoal: 'm5_ui_case' },
        budget: BUDGET_MAX,
      },
      image,
    );
    expect(result).toMatchObject({
      kind: 'error',
      error: { code: 'decode', message: 'proof tree contains an invalid node' },
    });
    expect(loaded.diagnostics).toEqual([]);
    console.log(
      JSON.stringify({
        checkedAssumptionLeaves: assumptions,
        sourceLineLabelsOnAssumptions: 0,
        actualHypotheticalCliniciansAfterQuery: 0,
        schemaDynamic: false,
        currentDecoder: result,
      }),
    );
    expect(atom('hypothetical')).toBe("'hypothetical'");
  }, 300_000);
});
