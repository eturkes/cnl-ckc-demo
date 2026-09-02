// The corpus size is engine-reported, never copy (M1 review E03).
//
// Shipped prose used to state "All 337 compiled documents", a second source of
// truth beside the boot contract that no gate compared against the engine. The
// count now arrives as a prop, and copy may state no corpus number at all.

import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import AboutPanel from '../src/demo/AboutPanel.svelte';
import { DESCRIPTIONS, INSTRUCTIONS } from '../src/demo/copy.js';

let host: HTMLElement | undefined;

const render = (documents: number | undefined): HTMLElement => {
  host = document.createElement('div');
  document.body.append(host);
  const app = mount(AboutPanel, { target: host, props: { documents } });
  cleanup = () => void unmount(app);
  return host;
};

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  host?.remove();
  host = undefined;
});

describe('E03 corpus size comes from the engine', () => {
  it('states no corpus number anywhere in shipped copy', () => {
    // Three or more digits is what a corpus count looks like here; the font licence
    // version `1.1` and every other legitimate number stay under that.
    const offenders = [...Object.entries(INSTRUCTIONS), ...Object.entries(DESCRIPTIONS)].filter(
      ([, text]) => /\d{3,}/u.test(text),
    );
    expect(offenders).toEqual([]);
  });

  it('renders the count the engine reported', () => {
    const text = render(337).textContent ?? '';
    expect(text).toContain('337 compiled documents');
    expect(text).toContain(DESCRIPTIONS.unreviewed);
  });

  it('states no count before the engine reports one', () => {
    const text = render(undefined).textContent ?? '';
    // The font licence version keeps digits in the panel, so the check is that the
    // corpus sentence itself is absent rather than that no digit renders.
    expect(text).not.toMatch(/\d+ compiled documents/u);
    expect(text).toContain(DESCRIPTIONS.unreviewed);
  });
});
