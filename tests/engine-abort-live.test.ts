import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineSession, type Engine } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};

it('A2 reports heap limit for the unflagged 32-step atom-doubling chain', async () => {
  const diagnostics: string[] = [];
  const drained: string[] = [];
  const session = new EngineSession({
    expected: manifest.contract,
    drain: () => {
      const lines = diagnostics.splice(0);
      drained.push(...lines);
      return lines;
    },
    loadImage: async (image) => {
      const factory = require('swipl-wasm/dist/loadImageDefault.js') as {
        default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;
      };
      return factory.default(image)({
        printErr: (line: string) => diagnostics.push(line),
        on_output: (line: string, stream: string) => {
          if (stream === 'stderr') diagnostics.push(line);
        },
      });
    },
  });
  expect(await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))))).toEqual(
    manifest.contract,
  );
  const chain = [
    'S0 = ab',
    ...Array.from(
      { length: 32 },
      (_, index) => `atom_concat(S${String(index)},S${String(index)},S${String(index + 1)})`,
    ),
  ].join(',');
  const response = await session.handle(
    {
      id: 'atoms',
      kind: 'query',
      goal: `${chain}.`,
      budget: { ...BUDGET_MAX, wallClockMs: 30_000 },
    },
    new Uint8Array(),
  );
  expect.soft(response).toMatchObject({ id: 'atoms', kind: 'limit', limit: 'heap', solutions: [] });
  expect.soft(drained.join('\n')).toMatch(/Out of memory/u);
}, 30_000);
