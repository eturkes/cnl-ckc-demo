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

import { QUESTION_CATALOG } from '../src/questions/catalog.js';

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

// u2 P3.12 was comment-enforced only, so the one measured corruption path — JSON
// round-tripping an engine value, which rewrites `'$guideline_id'/5` to arity 1 and
// flips `1r3` to `3r1` — could ship again at rc 0 (M1 review E19).
describe('JSON serialization ban over src/', () => {
  it('fails kb:asset-check on a serializing call', () => {
    const call = ['JSON', 'stringify'].join('.');
    writeFileSync(CONTROL, `export const dump = (value: unknown): string => ${call}(value);\n`);
    const { status, output } = assetCheck();
    expect(status).not.toBe(0);
    expect(output).toContain('JSON serialization in src/zz-forbidden-reach-control.ts');
  });
});

// M1 review I03: a suite comment carried two generated questions, so the copy the
// corpus owns lived in two places. The sentence is read from the catalog here for
// the same reason the scan exists — this file is one of the scanned surfaces.
describe('catalog question text ban over src/ and tests/', () => {
  it('fails kb:asset-check on a copied question sentence', () => {
    const sentence = QUESTION_CATALOG['recommendation-exists'].question;
    writeFileSync(CONTROL, `export const label = ${JSON.stringify(sentence)};\n`);
    const { status, output } = assetCheck();
    expect(status).not.toBe(0);
    expect(output).toContain('catalog question text in src/zz-forbidden-reach-control.ts');
  });
});
