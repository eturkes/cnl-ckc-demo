// `.claude/rules/toolchain.md` dependency caps, read from the installed packages: the cap is a
// peer range, so it is a fact the lockfile can state rather than a measurement to remember.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../tools/kb/paths.mjs';

type Manifest = { version: string; peerDependencies?: Record<string, string> };

const manifest = (name: string): Manifest =>
  JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as Manifest;

/** Each broken cap, by name: the peer range must stop below 6.1 and TypeScript stay on 5.x. */
const capFailures = (eslint: Manifest, typescript: Manifest): string[] => [
  ...(/<\s*6\.1\.0\b/u.test(eslint.peerDependencies?.typescript ?? '')
    ? []
    : ['typescript-eslint no longer caps TypeScript below 6.1']),
  ...(/^5\./u.test(typescript.version) ? [] : [`TypeScript ${typescript.version} left 5.x`]),
];

describe('toolchain pins', () => {
  it('typescript-eslint caps TypeScript below 6.1, and TypeScript stays on 5.x', () => {
    expect(capFailures(manifest('typescript-eslint'), manifest('typescript'))).toEqual([]);
  });

  it('refuses the installed manifests with the peer cap lifted and TypeScript at 6.1.0', () => {
    const eslint = manifest('typescript-eslint');
    const lifted = {
      ...eslint,
      peerDependencies: { ...eslint.peerDependencies, typescript: '>=4.8.4' },
    };
    expect(capFailures(lifted, { ...manifest('typescript'), version: '6.1.0' })).toEqual([
      'typescript-eslint no longer caps TypeScript below 6.1',
      'TypeScript 6.1.0 left 5.x',
    ]);
  });
});
