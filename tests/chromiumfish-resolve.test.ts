// `resolveChromiumfish` (`tools/browser.mjs`) over both pnpm global layouts: pnpm ≤ 10 keeps one
// tree per store version (`global/5/node_modules`), pnpm ≥ 11 one per installed package set
// beneath it (`global/v11/<hash>/node_modules`), where a fresh `pnpm add -g chromiumfish` lands.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveChromiumfish } from '../tools/browser.mjs';

let home = '';

/** A launcher entry under `$PNPM_HOME/global/<segments>`, as its file URL. */
const plant = (...segments: string[]): string => {
  const dir = join(home, 'global', ...segments, 'node_modules', 'chromiumfish', 'dist');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.js'), '');
  return pathToFileURL(join(dir, 'index.js')).href;
};

const refuse = (message: string): never => {
  throw new Error(message);
};

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cnl-ckc-pnpm-home-'));
  vi.stubEnv('PNPM_HOME', home);
  vi.stubEnv('CHROMIUMFISH_DIR', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

describe('resolveChromiumfish', () => {
  it('finds a pnpm 11+ global install beneath its package-set hash', () => {
    const entry = plant('v11', '5b135-18e327bc1497fd53-0');
    expect(resolveChromiumfish(refuse)).toBe(entry);
  });

  it('finds a pnpm 10 global install', () => {
    const entry = plant('5');
    expect(resolveChromiumfish(refuse)).toBe(entry);
  });

  it('prefers the newest store version when both layouts hold one', () => {
    plant('5');
    const entry = plant('v11', '5b135-18e327bc1497fd53-0');
    expect(resolveChromiumfish(refuse)).toBe(entry);
  });

  it('refuses, naming the global directory, when no layout holds one', () => {
    mkdirSync(join(home, 'global', 'v11', '5b135-18e327bc1497fd53-0', 'node_modules'), {
      recursive: true,
    });
    expect(() => resolveChromiumfish(refuse)).toThrow(
      `chromiumfish missing from ${join(home, 'global')}`,
    );
  });
});
