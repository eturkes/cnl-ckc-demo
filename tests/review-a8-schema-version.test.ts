import generated from '@kb/question-catalog.json';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('@kb/question-catalog.json');
  vi.resetModules();
});

describe('A8 generated-asset version seam', () => {
  it('refuses a question catalog version the reader does not support', async () => {
    vi.resetModules();
    vi.doMock('@kb/question-catalog.json', () => ({
      default: { ...generated, catalogVersion: generated.catalogVersion + 1 },
    }));

    await expect(import('../src/questions/catalog.js')).rejects.toThrow(/catalog.*version/iu);
  });
});
