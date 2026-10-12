// One unreadable pair, read by axe's `color-contrast` rule in whatever environment runs it: jsdom
// can never decide it (no canvas), Chromium can. The jsdom pin and its Chromium counterpart share
// this probe, so the pin's reading is shown to come from the environment rather than the probe.

import axe from 'axe-core';

export interface ContrastReading {
  incomplete: string[];
  violations: string[];
  passes: string[];
}

/** What jsdom reports: undecided, never a violation or a pass. */
export const JSDOM_READING: ContrastReading = {
  incomplete: ['color-contrast'],
  violations: [],
  passes: [],
};

/** axe's `color-contrast` reading of `#777` on `#787878`, about 1.03:1. */
export const contrastReading = async (): Promise<ContrastReading> => {
  const host = document.createElement('main');
  host.innerHTML = '<p style="color:#777;background:#787878">nearly invisible text</p>';
  document.body.append(host);
  try {
    const { incomplete, passes, violations } = await axe.run(host, {
      runOnly: { type: 'rule', values: ['color-contrast'] },
    });
    const ids = (results: axe.Result[]): string[] => results.map((result) => result.id);
    return { incomplete: ids(incomplete), violations: ids(violations), passes: ids(passes) };
  } finally {
    host.remove();
  }
};
