import { readFile } from 'node:fs/promises';
import { beforeAll, expect, test } from 'vitest';
import loadImageDefaultModule from 'swipl-wasm/dist/loadImageDefault';

const loadImageDefault = typeof loadImageDefaultModule === 'function'
  ? loadImageDefaultModule
  : (loadImageDefaultModule as unknown as { default: typeof loadImageDefaultModule }).default;

type Engine = Awaited<ReturnType<ReturnType<typeof loadImageDefault>>>;
let engine: Engine;

function collect(goal: string) {
  const query = engine.prolog.query(goal);
  const rows: unknown[] = [];
  for (;;) {
    const step = query.next() as { done: boolean; value?: unknown };
    if (step.value) rows.push(step.value);
    if (step.done) return rows;
  }
}

beforeAll(async () => {
  const image = new Uint8Array(await readFile(new URL('../kb.pvm', import.meta.url)));
  engine = await loadImageDefault(image)({ arguments: ['-q'], print() {}, printErr() {} });
  const query = await readFile(new URL('../../../../kb/data/guidelines/cdc-2022-opioid/queries/pl/category-a-recommendations.pl', import.meta.url), 'utf8');
  await engine.prolog.load_string(query, '/tests/category-a-recommendations.pl');
});

test('production question path reads live Prolog state', async () => {
  const sentinel = `vitest_live_${process.pid}`;
  const overlay = `
    guideline_entity(actual,'${sentinel}',recommendation,countable).
    guideline_cardinality(actual,'${sentinel}',na,eq,1).
    guideline_entity(actual,'${sentinel}_category','category-A-recommendation',countable).
    guideline_cardinality(actual,'${sentinel}_category',na,eq,1).
    guideline_event(actual,'${sentinel}_event',be).
    guideline_arg(actual,'${sentinel}_event',1,'${sentinel}').
    guideline_arg(actual,'${sentinel}_event',2,'${sentinel}_category').
  `;
  await engine.prolog.load_string(overlay, '/tests/live-overlay.pl');
  const answers = collect("'$guideline_query_projection'(goal(G),answers([answer(A,_)])),call(G).");
  expect(answers).toHaveLength(8);
  expect(answers).toContainEqual(expect.objectContaining({ A: sentinel }));
});
