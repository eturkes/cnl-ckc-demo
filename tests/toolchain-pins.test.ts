// `.claude/rules/toolchain.md` dependency caps, read from the installed packages: the cap is a
// peer range, so it is a fact the lockfile can state rather than a measurement to remember.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../tools/kb/paths.mjs';

const manifest = (name: string): { version: string; peerDependencies?: Record<string, string> } =>
  JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as {
    version: string;
    peerDependencies?: Record<string, string>;
  };

describe('toolchain pins', () => {
  it('typescript-eslint caps TypeScript below 6.1, and TypeScript stays on 5.x', () => {
    expect(manifest('typescript-eslint').peerDependencies?.typescript).toMatch(/<\s*6\.1\.0\b/u);
    expect(manifest('typescript').version).toMatch(/^5\./u);
  });
});
