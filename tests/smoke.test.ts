import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string;
  license: string;
};

describe('package metadata', () => {
  it('carries the project name and the LICENSE identifier', () => {
    expect(pkg.name).toBe('cnl-ckc-ui');
    expect(pkg.license).toBe('Apache-2.0 WITH LLVM-exception');
  });
});
