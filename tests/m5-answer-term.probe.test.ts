import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { answerRows, synthesizeAnswer } from '../src/demo/describe.js';
import { presentClinicalAdvice } from '../src/questions/advice.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import { boot, ROOT, solve } from './m5-probe-support.js';

it('ans.term: captures every live canonical term and shipped string', async () => {
  const session = await boot();
  const targets = [];
  for (const id of QUESTION_IDS) {
    const solutions = await solve(session, QUESTION_CATALOG[id].goal);
    targets.push({
      id,
      answers: solutions.map((solution) => {
        const term = solution.bindings.Answer;
        if (term === undefined) throw new Error(`missing ${id} answer`);
        const presentation = presentClinicalAdvice(term);
        expect(presentation?.structured, id).toBe(true);
        return { canonical: solution.display.Answer, term, presentation };
      }),
      points: synthesizeAnswer(answerRows(id, solutions)),
    });
  }
  const fixture = join(ROOT, 'tests/fixtures/m5-answer-targets.json');
  if (process.env.M5_CAPTURE === '1') {
    mkdirSync(join(ROOT, 'tests/fixtures'), { recursive: true });
    writeFileSync(fixture, `${JSON.stringify(targets, null, 2)}\n`);
  } else {
    expect(targets).toEqual(JSON.parse(readFileSync(fixture, 'utf8')));
  }
  if (process.env.M5_DUMP === '1') console.log(JSON.stringify(targets));
  console.log(JSON.stringify(targets.map(({ id, answers, points }) => ({
    id,
    terms: answers.length,
    rules: answers.reduce((n, { presentation }) => n + (presentation?.items.length ?? 0), 0),
    points: points.length,
    bytes: Buffer.byteLength(points.map(({ text }) => text).join('\n')),
  }))));
}, 120_000);
