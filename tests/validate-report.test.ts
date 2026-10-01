// The wave-report grader's cell split: an escaped pipe is content, so quoting one inside a
// finding must grade exactly like the same finding without it.

import { describe, expect, it } from 'vitest';

import { cells, gradeReport } from '../tools/validate-report.mjs';

const report = (finding: string): string =>
  `| id | finding | evidence |\n|---|---|---|\n| R1 | ${finding} | \`tools/x.mjs:12\` |\n`;

const grade = (finding: string) =>
  gradeReport({ name: 'r.md', text: report(finding), ids: ['R1'], verdict: true });

describe('validate-report', () => {
  it('splits on unescaped pipes alone', () => {
    expect(cells('| R1 | a \\| b | `x.mjs:1` |')).toEqual(['R1', 'a \\| b', '`x.mjs:1`']);
    expect(cells('| R1 | a \\\\| b |')).toEqual(['R1', 'a \\\\', 'b']);
  });

  it('grades a finding quoting an escaped pipe identically to one without', () => {
    const plain = grade('fail(med): the parser splits on a b pipe, so the column shifts right');
    const piped = grade('fail(med): the parser splits on a \\| b pipe, so the column shifts right');
    expect(plain).toEqual({ filled: 1, errors: [] });
    expect(piped).toEqual(plain);
  });

  it('refuses a seeded all-unknown skeleton', () => {
    const seeded = gradeReport({ name: 'r.md', text: report('unknown'), ids: ['R1'] });
    expect(seeded.filled).toBe(0);
    expect(seeded.errors).toContain("r.md:3 R1: finding still placeholder ('unknown')");
  });
});
