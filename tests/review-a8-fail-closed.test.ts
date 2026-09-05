import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import { parseEvidenceDocument } from '../src/provenance/model.js';
import { EVIDENCE_FIXTURE } from './provenance-fixture.js';

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generated = join(root, 'kb/generated');
const manifest = JSON.parse(readFileSync(join(generated, 'kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const image = new Uint8Array(readFileSync(join(generated, 'kb.pvm')));

const diagnostics: string[] = [];
const drain = (): string[] => diagnostics.splice(0, diagnostics.length);
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const load = typeof factory === 'function' ? factory : factory.default;
  return load(bytes)({
    printErr: (line: string) => diagnostics.push(line),
    on_output: (line: string, stream: string) => {
      if (stream === 'stderr') diagnostics.push(line);
    },
  });
};

describe('A8 fail-closed runtime boundaries', () => {
  it('rejects an out-of-bounds alignment while parsing the generated document', () => {
    const malformed = structuredClone(EVIDENCE_FIXTURE);
    const span = malformed.alignment.spans[0];
    if (span === undefined) throw new Error('fixture has no alignment span');
    span.end = 10_000;
    expect(() => parseEvidenceDocument(malformed, malformed.id)).toThrow(/alignment/u);
  });

  it('returns a typed error when an otherwise successful query emits stderr', async () => {
    const session = new EngineSession({ loadImage, drain, expected: manifest.contract });
    await session.boot(image);
    session.consult("review_a8 :- format(user_error,'review-a8~n',[]).\n");
    const response = await session.handle(
      { id: 'review-a8', kind: 'query', goal: 'review_a8.', budget: BUDGET_MAX },
      image,
    );
    expect(drain()).not.toHaveLength(0);
    expect(response).toMatchObject({ kind: 'error' });
  }, 120_000);
});
