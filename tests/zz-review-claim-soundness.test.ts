// C1 text witnesses at c7c6b71: expectations reproduce the disputed claims, not new product law.
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer as createViteServer } from 'vite';
import { describe, expect, it } from 'vitest';

import { extractCandidates, MAX_CANDIDATES } from '../src/intake/chunker.js';
import { HttpJudgmentClient } from '../src/intake/client.js';
import { parseJudgment } from '../src/intake/judgment.js';
import { buildRequest } from '../src/intake/request.js';
import { select } from '../src/intake/select.js';
import { INTAKE_VOCABULARY } from '../src/intake/vocabulary.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

describe('C1 shipped claim witnesses', () => {
  it('C1-F1 absent Worker produces the README promised did-not-respond state', async () => {
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toContain(
      'service did not respond, and the prepared questions still work.',
    );
    const unused = createNetServer();
    await new Promise<void>((resolve) => unused.listen(0, '127.0.0.1', resolve));
    const address = unused.address();
    if (address === null || typeof address === 'string') throw new Error('missing test port');
    await new Promise<void>((resolve, reject) =>
      unused.close((error) => (error ? reject(error) : resolve())),
    );
    const vite = await createViteServer({
      root: ROOT,
      configFile: join(ROOT, 'vite.config.ts'),
      cacheDir: join(ROOT, '.vite', 'reviewer-8'),
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        // Same shipped proxy middleware; only the destination changes to a known closed port.
        proxy: { '/api/judgment': `http://127.0.0.1:${String(address.port)}` },
      },
      appType: 'custom',
      logLevel: 'silent',
    });
    const http = createHttpServer(vite.middlewares);
    try {
      await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
      const listening = http.address();
      if (listening === null || typeof listening === 'string')
        throw new Error('missing proxy port');
      const client = new HttpJudgmentClient({
        vocabulary: INTAKE_VOCABULARY,
        endpoint: `http://127.0.0.1:${String(listening.port)}/api/judgment`,
      });
      expect(await client.judge('acute pain')).toEqual({ kind: 'unavailable', reason: 'network' });
    } finally {
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
      await vite.close();
    }
  }, 20_000);

  it('C1-F2 a section yes selects every unconditional rule as proof.md states', () => {
    expect(readFileSync(join(ROOT, '.claude/rules/proof.md'), 'utf8')).toContain(
      'therefore selects every unconditional rule of that section',
    );
    const built = buildRequest(INTAKE_VOCABULARY, 'acute pain');
    const raw = {
      model: built.request.model,
      answers: Object.fromEntries(
        Object.entries(built.request.questions).map(([id, question]) => [
          id,
          question.type === 'choice'
            ? {
                type: 'choice',
                choice: 'acute',
                probabilities: Object.fromEntries(
                  Object.keys(question.criteria).map((name) => [name, name === 'acute' ? 1 : 0]),
                ),
              }
            : { type: 'noul', noul: id === 's1' ? 1 : 0 },
        ]),
      ),
    };
    const outcome = select(INTAKE_VOCABULARY, parseJudgment(raw, built));
    if (outcome.kind !== 'answered') throw new Error('positive control: acute s1 must answer');
    expect(outcome.matches.map(({ ruleId }) => ruleId)).toEqual(
      INTAKE_VOCABULARY.rules
        .filter(({ trigger }) => trigger.kind === 'section' && trigger.section === 's1')
        .map(({ id }) => id),
    );
  });

  it('C1-F3 every disclosed overflow is caused by the stated 16-phrase cap', () => {
    const result = extractCandidates(`${'x'.repeat(81)} and acute pain`);
    expect(result.candidates).toHaveLength(1);
    expect(result.overflow).toBe(1);
    // en.ts and ja.ts say the count limit caused the unjudged phrases. The actual cause is length.
    expect(result.candidates.length + result.overflow).toBeGreaterThan(MAX_CANDIDATES);
  });
});
