// ann-review G3: an always-failing body cannot be turned into a usable premise.
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

import type { Engine } from '../src/engine/session.js';
import { payloadSource } from '../tools/kb/paths.mjs';
import { buildImage } from '../tools/kb/produce.mjs';
import { bagFiles, mutatePlSentence } from './clinical-test-support.js';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/loadImageDefault.js') as
  | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
  | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
const load = typeof factory === 'function' ? factory : factory.default;
const document = 'cdc2022-opioid-rec03';

it('G3 refuses a document whose S2 bodies all end in fail', async () => {
  let changed = 0;
  const files = mutatePlSentence(bagFiles, document, 2, (line) => {
    expect(line).toContain(' :- ');
    changed += 1;
    return `${line.slice(0, -1)}, fail.`;
  });
  expect(changed).toBeGreaterThan(1);
  const source = payloadSource(files).source;
  expect(source).toMatch(/clinical_premise\('cdc2022-opioid-rec03',2,\d+,\(fail\)\)/u);
  const built = await buildImage(source);
  expect(built.contract.documents).toBe(385);
  const engine = await load(built.image)({ arguments: ['-q'] });
  const rows = (goal: string): Record<string, unknown>[] =>
    [...engine.prolog.query(goal)] as Record<string, unknown>[];
  expect(rows('true')).toHaveLength(1);
  expect(rows('fail')).toHaveLength(0);
  expect(rows(`clinical_context('${document}',2,As),assumed(fail,As)`)).toHaveLength(1);
  const answers = rows(`clinical_advice(_,_,clinical_answer('${document}',_,_))`);
  const marks = rows(`clinical_marks(_,_,marks('${document}',_,_))`);
  console.info(
    'false-body sentence clauses',
    changed,
    'answer documents',
    answers.length,
    'marks documents',
    marks.length,
  );
  expect.soft(answers).toHaveLength(0);
  expect(marks).toHaveLength(0);
}, 300_000);
