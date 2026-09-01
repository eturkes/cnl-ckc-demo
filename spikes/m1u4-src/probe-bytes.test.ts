import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import type { BudgetSpec } from '../../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../../src/engine/session.js';
import { sha256, verifyBag } from '../../tools/kb/bag.mjs';
import { QUESTION_CATALOG, type QuestionId } from './catalog.js';
import { serializeLegacyAnswer, serializeResult } from './serializer.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const GENERATED = join(ROOT, 'kb', 'generated');
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
if (archives.length !== 1) throw new Error(`expected one bag, found ${archives.length}`);
const bag = verifyBag(readFileSync(join(ROOT, 'kb', archives[0] as string)));
const QUERY_ROOT = 'data/guidelines/cdc-2022-opioid/queries';

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)({});
};

const BUDGET = {
  stackBytes: 1_073_741_824,
  depth: 10_000_000,
  inferences: 1_000_000_000,
  wallClockMs: 600_000,
  answerCap: 100_000,
} satisfies BudgetSpec;

const source = (path: string): Uint8Array => {
  const bytes = bag.files.get(path);
  if (bytes === undefined) throw new Error(`bag omitted ${path}`);
  return bytes;
};

const resultOf = (answer: string): string => {
  const start = answer.indexOf(',result(');
  const end = answer.lastIndexOf(').');
  if (start === -1 || end === -1) throw new Error('answer envelope malformed');
  return answer.slice(start + 1, end);
};

const EXPORTED = [
  'category-a-recommendations',
  'dosage-reduction-content',
  'evidence-type-1-recommendation',
  'recommendation-exists',
] as const satisfies readonly QuestionId[];

it('serializes live projected values against all four committed answer oracles', async () => {
  const session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))));

  for (const id of EXPORTED) {
    const question = QUESTION_CATALOG[id];
    const solved = await session.solve(question.goal, BUDGET, id);
    if (solved.kind !== 'solutions')
      throw new Error(`${id}: expected solutions, got ${solved.kind}`);

    const query = source(`${QUERY_ROOT}/pl/${id}.pl`);
    const committed = Buffer.from(source(`${QUERY_ROOT}/answers/${id}.pl`)).toString('utf8');
    const serialized = serializeLegacyAnswer(question, sha256(query), solved.solutions);
    const result = serializeResult(question, solved.solutions);
    const valueEqual = result.text === resultOf(committed);
    const byteEqual = serialized === committed;
    const sortChanged = result.liveRows.some((row, index) => row !== result.sortedRows[index]);
    console.log(
      `SRC_BYTES\t${id}\t${solved.solutions.length}\tvalue=${valueEqual}\tbytes=${byteEqual}\tsortChanged=${sortChanged}`,
    );

    expect(valueEqual, `${id}: projected result`).toBe(true);
    if (id === 'category-a-recommendations') expect(byteEqual, `${id}: bytes`).toBe(true);
  }
}, 120_000);
