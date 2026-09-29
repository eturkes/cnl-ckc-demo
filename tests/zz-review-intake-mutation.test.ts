import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
interface Mutation {
  name: string;
  file: string;
  before: string;
  after: string;
  suites: string[];
}
const controls: Mutation[] = [
  {
    name: 'K1 case-sensitive deduplication',
    file: 'chunker',
    before: 'const key = text.toLowerCase();',
    after: 'const key = text;',
    suites: ['chunker'],
  },
  {
    name: 'Q1 discarded description',
    file: 'request',
    before: 'state: { description }, questions',
    after: "state: { description: '' }, questions",
    suites: ['request'],
  },
  {
    name: 'J1 permissive probability sum',
    file: 'judgment',
    before: 'const SUM_TOLERANCE = 1e-6;',
    after: 'const SUM_TOLERANCE = 1;',
    suites: ['judgment'],
  },
  {
    name: 'S1 wrong Noul threshold',
    file: 'select',
    before: 'export const NOUL_YES = 0.5;',
    after: 'export const NOUL_YES = 0.51;',
    suites: ['select'],
  },
  {
    name: 'S2 invented candidate text',
    file: 'judgment',
    before: 'Object.freeze({ ...candidate, value:',
    after: "Object.freeze({ ...candidate, text: 'fabricated', value:",
    suites: ['gaps'],
  },
  {
    name: 'C1 missing caller-abort checks',
    file: 'client',
    before: 'throwIfAborted(signal);',
    after: 'void signal;',
    suites: ['client'],
  },
];
const fixedTrigger: Mutation = {
  name: 'R-INT per-rule lookup replaced by first trigger',
  file: 'select',
  before: '      trigger.id,\n    );',
  after: "      trigger.kind === 'condition' ? 'c01' : 's1',\n    );",
  suites: ['select', 'gaps'],
};

function campaign(mutation: Mutation) {
  mkdirSync(join(root, '.scratch'), { recursive: true });
  const scratch = mkdtempSync(join(root, '.scratch', 'review-intake-'));
  const config = join(scratch, 'vite.config.ts');
  // Vite transforms the real module in memory; target files remain byte-identical.
  writeFileSync(
    config,
    `import base from '../../vite.config.ts';
export default {
  ...base,
  cacheDir: ${JSON.stringify(join(scratch, 'cache'))},
  plugins: [...(base.plugins ?? []), {
    name: 'review-intake-mutant',
    enforce: 'pre',
    transform(code, id) {
      if (id !== ${JSON.stringify(join(root, 'src/intake', `${mutation.file}.ts`))}) return;
      const before = ${JSON.stringify(mutation.before)};
      if (!code.includes(before)) throw new Error('review mutation anchor absent');
      console.error('REVIEW_MUTATION_APPLIED');
      return { code: code.replaceAll(before, ${JSON.stringify(mutation.after)}), map: null };
    },
  }],
};
`,
  );
  try {
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        ...mutation.suites.map((suite) => `tests/intake-${suite}.test.ts`),
        '--config',
        config,
        '--maxWorkers',
        '2',
        '--reporter=dot',
        '--no-color',
      ],
      { cwd: root, encoding: 'utf8', timeout: 30_000 },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.error, output).toBeUndefined();
    expect(output, mutation.name).toContain('REVIEW_MUTATION_APPLIED');
    expect(output, mutation.name).not.toContain('Failed Suites');
    expect(output, mutation.name).not.toContain('Unhandled Errors');
    return { status: result.status, output };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

describe('review R-INT load-bearing suite controls', () => {
  it.each(controls)(
    '$name is refused by its shipped suite',
    (mutation) => {
      const result = campaign(mutation);
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain('Failed Tests');
    },
    40_000,
  );

  it('refuses ignoring per-rule trigger ids', () => {
    const result = campaign(fixedTrigger);
    expect(result.status, result.output).toBe(1);
  }, 40_000);
});
