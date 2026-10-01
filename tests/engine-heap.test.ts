// Live heap exhaustion against the real saved image.
//
// At the pinned swipl-wasm a runaway `assertz` never raises `resource_error(memory)`: the
// allocator fails with a FATAL `Out of memory` and the WASM runtime aborts, in Node as in a
// browser. The client has no terminal state for an aborted runtime yet, so this pins today's
// behaviour — the abort surfaces as a `prolog` error and the engine never answers again — and
// flips the day the abort is classified and the worker recreated.
//
// A fresh engine takes ~6.3 s to exhaust its 2 GiB ceiling. Reserving most of that ceiling
// with one untouched `_malloc` first leaves ~100 MB of headroom, so the same trip lands in
// under a second alone — not a bound to assert, since a loaded full-suite run stretched it
// past 13 s — without committing the reserved pages.

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
const DOCUMENTS = 'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).';

type Reservable = Engine & { _malloc(bytes: number): number };

const manifest = JSON.parse(readFileSync(join(GENERATED, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const diagnostics: string[] = [];

const loadImage: ImageLoader = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as {
    default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Reservable>;
  };
  const engine = await factory.default(image)({
    printErr: (line: string) => diagnostics.push(line),
  });
  if (engine._malloc(RESERVE_BYTES) === 0) throw new Error('heap reserve refused');
  return engine;
};

let session: EngineSession;

beforeAll(async () => {
  session = new EngineSession({ loadImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(GENERATED, 'kb.pvm'))));
}, 60_000);

const budget = { ...BUDGET_MAX, wallClockMs: 30_000 };

describe('live heap exhaustion', () => {
  it('aborts the runtime instead of reporting limit heap', async () => {
    const response = await session.handle(
      { id: 'h1', kind: 'query', goal: RUNAWAY, budget },
      new Uint8Array(),
    );
    expect(response).toMatchObject({ kind: 'error', error: { code: 'prolog' } });
    expect(response.kind === 'error' ? response.error.message : '').toMatch(/^Aborted\(\)/u);
    expect(diagnostics.join('\n')).toMatch(/Out of memory/u);
  }, 30_000);

  it('leaves an engine that never answers again', async () => {
    const response = await session.handle(
      { id: 'h2', kind: 'query', goal: DOCUMENTS, budget },
      new Uint8Array(),
    );
    // Which failure depends on where the allocator gave out, and it varies run to run: the
    // runtime aborts again, or it survives with no memory and raises `resource_error(memory)`.
    const aborted = response.kind === 'error' && /^Aborted\(\)/u.test(response.error.message);
    const exhausted = response.kind === 'limit' && response.limit === 'heap';
    expect(aborted || exhausted, JSON.stringify(response).slice(0, 200)).toBe(true);
  });
});
