// The build's third-party notice (`tools/licences.mjs`): which bundled module ids name a
// package, and the grader that refuses a bundled package the notice omits.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  checkNotice,
  missingNotices,
  NOTICE,
  noticeText,
  notices,
  packageDir,
} from '../tools/licences.mjs';

const STORE = '/repo/node_modules/.pnpm/x@1.0.0/node_modules/';

describe('bundled module ids', () => {
  it('maps a module to the package its last node_modules segment names', () => {
    expect(packageDir(`${STORE}cytoscape/dist/cytoscape.esm.mjs`)).toBe(`${STORE}cytoscape`);
    expect(packageDir(`${STORE}@scope/pkg/index.js`)).toBe(`${STORE}@scope/pkg`);
    expect(packageDir(`${STORE}pdfjs-dist/build/pdf.worker.min.mjs?url`)).toBe(
      `${STORE}pdfjs-dist`,
    );
    expect(packageDir('/repo/src/main.ts')).toBeUndefined();
  });

  it('maps each bundler-injected module to the package that ships it, and refuses any other', () => {
    expect(packageDir('\0vite/preload-helper.js')).toMatch(/\/vite$/u);
    expect(packageDir('__vite-browser-external')).toMatch(/\/vite$/u);
    expect(packageDir('\0rolldown/runtime.js')).toMatch(/\/rolldown$/u);
    expect(() => packageDir('\0planted/helper.js')).toThrow('names no package');
  });
});

describe('the notice', () => {
  const list = notices([packageDir('\0vite/preload-helper.js') ?? '']);

  it('carries each package licence file verbatim and refuses one it omits', () => {
    const text = noticeText(list);
    expect(missingNotices(list, text)).toEqual([]);
    const [vite] = list;
    expect(vite?.name).toBe('vite');
    expect(missingNotices(list, text.replace(vite?.text ?? '', ''))).toEqual([
      `vite@${vite?.version ?? ''} is missing from ${NOTICE}`,
    ]);
    expect(missingNotices([], '')).toEqual([`no bundled package reached ${NOTICE}`]);
  });

  it('refuses a package that ships no licence file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'licence-'));
    try {
      writeFileSync(join(dir, 'package.json'), '{"name":"bare","version":"1.0.0"}');
      expect(() => notices([dir])).toThrow('bare@1.0.0 ships no licence file');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('grades the file as written, after its control fires', () => {
    const out = mkdtempSync(join(tmpdir(), 'notice-'));
    try {
      mkdirSync(join(out, 'licenses'));
      const text = noticeText(list);
      writeFileSync(join(out, NOTICE), text);
      expect(checkNotice(out, list)).toBe(
        `licence-notice: 1 bundled packages in ${NOTICE}; control: ${NOTICE} without its first section`,
      );
      writeFileSync(join(out, NOTICE), text.replace(list[0]?.text ?? '', ''));
      expect(() => checkNotice(out, list)).toThrow(/^vite@\S+ is missing from/u);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
