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

  it('grades the reviewer role vocabulary as clean as the brief vocabulary', () => {
    for (const finding of [
      'pass — every display checks the deadline before the next one starts',
      'finding F1 (major): the deadline is checked per solution, so later displays still run',
      'finding F2, F3 (blocker): a cached hit returns a proof the current engine cannot derive',
    ]) {
      expect(grade(finding), finding).toEqual({ filled: 1, errors: [] });
    }
    expect(
      grade('finding F1: the severity is missing, so the verdict cannot be ranked').errors,
    ).not.toEqual([]);
  });

  it('refuses a seeded all-unknown skeleton', () => {
    const seeded = gradeReport({ name: 'r.md', text: report('unknown'), ids: ['R1'] });
    expect(seeded.filled).toBe(0);
    expect(seeded.errors).toContain("r.md:3 R1: finding still placeholder ('unknown')");
  });
});
