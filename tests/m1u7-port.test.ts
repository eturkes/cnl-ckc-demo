import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const components = (directory: string): string[] =>
  readdirSync(new URL(`../${directory}`, import.meta.url), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? components(path) : entry.name.endsWith('.svelte') ? [path] : [];
    },
  );

const rootDeclarations = (): string => {
  const root = /:root\s*\{([^}]*)\}/u.exec(read('src/app.css'))?.[1];
  if (root === undefined) throw new Error('app.css carries no :root declarations');
  return root;
};

describe('m1u7 presentation contract', () => {
  // m1u7 F1:79–80; presentation:check holds an exact pin, not this particular version.
  it.each(['atkinson-hyperlegible-next', 'atkinson-hyperlegible-mono', 'literata'])(
    'F1 retains the contracted 5.3.0 dependency for %s',
    (family) => {
      const manifest: unknown = JSON.parse(read('package.json'));
      expect(manifest).toHaveProperty(['dependencies', `@fontsource-variable/${family}`], '5.3.0');
    },
  );

  // m1u7 T1:92 + ui.md Colour:38–41: role law retains the invariant and names today's roles.
  it('T1 defines only role-named root tokens', () => {
    const names = [...rootDeclarations().matchAll(/(--[\w-]+)\s*:/gu)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(0);
    const role =
      /^--(?:surface(?:-raised|-sunken)?|text(?:-muted)?|border|action(?:-text)?|warn|focus-ring|font-(?:ui|prose|code)|graph-(?:label|document|entity|event|operator|value|edge|path))$/u;
    expect(names.filter((name) => name === undefined || !role.test(name))).toEqual([]);
  });

  // m1u7 T2:93–94: closure quantifies over every component, rather than a path allowlist.
  it('T2 defines every component-consumed custom property and retires the field fallback', () => {
    const declared = new Set(
      [...rootDeclarations().matchAll(/(--[\w-]+)\s*:/gu)].map((match) => match[1]),
    );
    const paths = components('src');
    expect(paths.length).toBeGreaterThan(0);
    const missing = paths.flatMap((path) => {
      const source = read(path);
      expect(source, path).not.toMatch(/var\(\s*--field\s*,\s*#fff(?:fff)?\b/iu);
      return [...source.matchAll(/var\(\s*(--[\w-]+)/gu)]
        .map((match) => match[1])
        .filter((name) => !declared.has(name))
        .map((name) => `${path}: ${String(name)}`);
    });
    expect(missing).toEqual([]);
    expect(declared.has('--field')).toBe(false);
  });

  // C6:117–118: the existing control lowers the limit; these plant the stated input instead.
  it.each(['INSTRUCTIONS', 'DESCRIPTIONS'])(
    'C6 refuses a 30-word sentence planted in %s by file, key and count',
    (record) => {
      const checker = read('tools/copy-check.mjs')
        .replace(/^import[^\n]+;\n/gmu, '')
        .replace(/\nmain\(\);\s*$/u, '\n(source) => gradeEnglish(source, BUCKETS, FILLER);');
      const candidate: unknown = runInNewContext(checker);
      expect(typeof candidate).toBe('function');
      const grade = candidate as (source: string) => { failures: string[]; graded: number };
      const source = read('src/i18n/en.ts');
      expect(grade(source).failures).toEqual([]);
      const sentence = `${Array.from({ length: 30 }, (_, index) => `word${String(index)}`).join(' ')}.`;
      const mutant = source.replace(
        new RegExp(`(export const ${record}[^\\n]*\\{)`, 'u'),
        `$1\n  contractThirtyWordControl: '${sentence}',`,
      );
      expect(mutant).not.toBe(source);
      expect(grade(mutant).failures).toEqual([
        expect.stringContaining(`src/i18n/en.ts ${record}.contractThirtyWordControl: 30 words`),
      ]);
    },
  );
});
