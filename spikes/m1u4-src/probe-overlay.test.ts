import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import type { BudgetSpec } from '../../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../../src/engine/session.js';
import { QUESTION_CATALOG } from './catalog.js';
import { serializeResult } from './serializer.js';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const GENERATED = join(ROOT, 'kb', 'generated');
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const diagnostics: string[] = [];
const sink = {
  print: () => undefined,
  printErr: (line: string) => diagnostics.push(line),
  on_output: (line: string, stream: string) => {
    if (stream === 'stderr') diagnostics.push(line);
  },
};
const drain = (): string[] => diagnostics.splice(0, diagnostics.length);
const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(image)(sink);
};
const BUDGET = {
  stackBytes: 1_073_741_824,
  depth: 10_000_000,
  inferences: 1_000_000_000,
  wallClockMs: 600_000,
  answerCap: 100_000,
} satisfies BudgetSpec;
const OVERLAY = `
:- dynamic(guideline_entity/4).
:- dynamic(guideline_cardinality/5).
:- dynamic(guideline_event/3).
:- dynamic(guideline_arg/4).
guideline_entity(actual,'$guideline_id'(product,'overlay-rec',1,ref(1),[]),recommendation,countable).
guideline_cardinality(actual,'$guideline_id'(product,'overlay-rec',1,ref(1),[]),na,eq,1).
guideline_entity(actual,'$guideline_id'(product,'overlay-category-a',1,ref(1),[]),'category-A-recommendation',countable).
guideline_cardinality(actual,'$guideline_id'(product,'overlay-category-a',1,ref(1),[]),na,eq,1).
guideline_event(actual,'$guideline_id'(product,'overlay-event',1,ref(1),[]),be).
guideline_arg(actual,'$guideline_id'(product,'overlay-event',1,ref(1),[]),1,'$guideline_id'(product,'overlay-rec',1,ref(1),[])).
guideline_arg(actual,'$guideline_id'(product,'overlay-event',1,ref(1),[]),2,'$guideline_id'(product,'overlay-category-a',1,ref(1),[])).
`;

it('changes the displayed SRC service result after a runtime overlay', async () => {
  const session = new EngineSession({ loadImage, drain, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))));
  const question = QUESTION_CATALOG['category-a-recommendations'];
  const before = await session.solve(question.goal, BUDGET, 'before');
  if (before.kind !== 'solutions') throw new Error(`before: ${before.kind}`);

  session.consult(OVERLAY);
  const after = await session.solve(question.goal, BUDGET, 'after');
  if (after.kind !== 'solutions') throw new Error(`after: ${after.kind}`);
  const beforeText = serializeResult(question, before.solutions).text;
  const afterText = serializeResult(question, after.solutions).text;
  const overlayDisplay = after.solutions
    .map((solution) => solution.display.A)
    .find((text) => text?.includes('overlay-rec'));

  expect(before.solutions).toHaveLength(7);
  expect(after.solutions).toHaveLength(8);
  expect(overlayDisplay).toContain('overlay-rec');
  expect(afterText).not.toBe(beforeText);
  console.log(
    `SRC_OVERLAY\tbefore=${before.solutions.length}\tafter=${after.solutions.length}\tdisplayChanged=${afterText !== beforeText}\toverlayDisplayed=${overlayDisplay !== undefined}`,
  );
}, 120_000);
