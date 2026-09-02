// Negative control for the forbidden answer-oracle reach scan (m1u4 P5).
//
// The scan is what keeps the committed `queries/answers/*.pl` regression oracles out
// of the answer path, and ESLint cannot express it: core `no-restricted-imports`
// visits import and export declarations only, so `import()` and `fs.readFile` escape
// it. Without a planted control the scan passes whether or not it still scans.

import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONTROL = join(ROOT, 'src', 'zz-forbidden-reach-control.ts');
// Assembled at run time so this file is not itself a literal reach the scan must skip.
const ORACLE = ['queries', 'answers'].join('/') + '/category-a-recommendations.pl';

const assetCheck = (): { status: number; output: string } => {
  try {
    const out = execFileSync(process.execPath, [join(ROOT, 'tools', 'kb', 'check.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { status: 0, output: out };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
};

afterEach(() => rmSync(CONTROL, { force: true }));

describe('forbidden answer-oracle reach', () => {
  it('passes with no control in place', () => {
    expect(assetCheck().status).toBe(0);
  });

  it.each([
    ['static import', `import oracle from '../${ORACLE}';\nexport default oracle;\n`],
    ['dynamic import', `export const load = async () => import('../${ORACLE}');\n`],
    [
      'filesystem read',
      `import { readFileSync } from 'node:fs';\nexport const read = () => readFileSync('${ORACLE}');\n`,
    ],
  ])('fails kb:asset-check on a %s', (_form, source) => {
    writeFileSync(CONTROL, source);
    const { status, output } = assetCheck();
    expect(status).not.toBe(0);
    expect(output).toContain('answer-oracle reach in src/zz-forbidden-reach-control.ts');
  });
});
