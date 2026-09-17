// The question catalog was the one generated asset whose version field had no reader:
// `tools/kb/catalog.mjs` emitted `catalogVersion` and `src/questions/catalog.ts` consumed
// `entries` without looking at it, so a producer bump would have been absorbed silently.
// Every other generated asset already pins its own (`src/provenance/model.ts:87`,
// `src/graph/model.ts:286`, `src/engine/session.ts:268`).
import generated from '@kb/question-catalog.json';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('@kb/question-catalog.json');
  vi.resetModules();
});

describe('question catalog version seam', () => {
  it('refuses a catalog version the reader does not support, naming asset and version', async () => {
    vi.resetModules();
    vi.doMock('@kb/question-catalog.json', () => ({
      default: { ...generated, catalogVersion: generated.catalogVersion + 1 },
    }));

    await expect(import('../src/questions/catalog.js')).rejects.toThrow(
      /question catalog version 4 is unsupported/iu,
    );
  });

  it('accepts the version the producer actually emits', async () => {
    vi.resetModules();
    const module = await import('../src/questions/catalog.js');

    expect(Object.keys(module.QUESTION_CATALOG)).toHaveLength(module.QUESTION_IDS.length);
  });
});
