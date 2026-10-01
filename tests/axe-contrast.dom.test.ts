// jsdom has no canvas, so axe-core can never decide `color-contrast` there: every result lands
// in `incomplete`. That is why `pnpm contrast:check` grades a declared token table instead
// (`.claude/rules/ui.md` `Colour`), and why the dom suites' axe passes say nothing about colour.

import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

describe('axe-core color-contrast under jsdom', () => {
  it('reports even an unreadable pair as incomplete, never as a violation or a pass', async () => {
    const host = document.createElement('main');
    host.innerHTML = '<p style="color:#777;background:#787878">nearly invisible text</p>';
    document.body.append(host);
    try {
      const { incomplete, passes, violations } = await axe.run(host, {
        runOnly: { type: 'rule', values: ['color-contrast'] },
      });
      const ids = (results: axe.Result[]) => results.map((result) => result.id);
      expect(ids(incomplete)).toEqual(['color-contrast']);
      expect(ids(violations)).toEqual([]);
      expect(ids(passes)).toEqual([]);
    } finally {
      host.remove();
    }
  });
});
