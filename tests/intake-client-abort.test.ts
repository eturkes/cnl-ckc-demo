import { describe, expect, it, vi } from 'vitest';

import { HttpJudgmentClient } from '../src/intake/client.js';
import { vocabulary } from './intake-oracle/fixtures.js';

describe('review C1 caller abort at the fetch boundary', () => {
  it.each([429, 409, 500])('rejects AbortError rather than mapping status %s', async (status) => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    const client = new HttpJudgmentClient({ vocabulary: vocabulary(), fetch: fetcher });
    const pending = client.judge('pain', controller.signal);
    controller.abort('superseded');
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
