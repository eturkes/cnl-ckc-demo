// Reserving 1900 MB without touching its pages makes the real allocator trip fast.
// Contract: .agent/contracts/chat-c2.md A1; browser recovery is graded separately.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

const require = createRequire(import.meta.url);
const GENERATED = join(dirname(dirname(fileURLToPath(import.meta.url))), 'kb', 'generated');
const RESERVE_BYTES = 1900 * 1024 * 1024;
const RUNAWAY =
  'dynamic(junk/2), between(1,inf,N), ' +
  'assertz(junk(N,[a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z])), fail.';

type Reservable = Engine & { _malloc(bytes: number): number };

const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const diagnostics: string[] = [];
const drained: string[] = [];

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as {
    default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Reservable>;
  };
  const engine = await factory.default(image)({
    printErr: (line: string) => diagnostics.push(line),
    on_output: (line: string, stream: string) => {
      if (stream === 'stderr') diagnostics.push(line);
    },
  });
  if (engine._malloc(RESERVE_BYTES) === 0) throw new Error('heap reserve refused');
  return engine;
};

let session: EngineSession;

beforeAll(async () => {
  session = new EngineSession({
    loadImage,
    expected: manifest.contract,
    drain: () => {
      const lines = diagnostics.splice(0);
      drained.push(...lines);
      return lines;
    },
  });
  expect(await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))))).toEqual(
    manifest.contract,
  );
}, 60_000);

describe('live heap exhaustion', () => {
  it('A1 returns heap limit and drains the real allocator diagnostic', async () => {
    const response = await session.handle(
      { id: 'h1', kind: 'query', goal: RUNAWAY, budget: { ...BUDGET_MAX, wallClockMs: 30_000 } },
      new Uint8Array(),
    );
    expect.soft(response).toMatchObject({ id: 'h1', kind: 'limit', limit: 'heap', solutions: [] });
    expect.soft(drained.join('\n')).toMatch(/Out of memory/u);
    expect.soft(diagnostics).toEqual([]);
  }, 30_000);
});
