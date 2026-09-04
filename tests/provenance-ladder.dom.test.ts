import axe from 'axe-core';
import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ProvenanceLadder from '../src/provenance/ProvenanceLadder.svelte';
import type { GraphFocus, ProvenanceState } from '../src/provenance/model.js';

import { EVIDENCE_FIXTURE } from './provenance-fixture.js';

let host: HTMLElement | undefined;
let cleanup: (() => void) | undefined;

const render = (
  state: ProvenanceState,
  onGraphFocus: (focus: GraphFocus) => void = () => undefined,
): HTMLElement => {
  host = document.createElement('div');
  document.body.append(host);
  const app = mount(ProvenanceLadder, { target: host, props: { state, onGraphFocus } });
  cleanup = () => void unmount(app);
  return host;
};

const ready: ProvenanceState = {
  kind: 'ready',
  solution: 0,
  steps: [
    {
      line: 77,
      head: 'guideline_property(example,dose)',
      predicate: 'guideline_property/5',
      document: 'cdc2022-opioid-rec01-imp01',
      sentence: 1,
      children: [],
    },
  ],
};

const clickNamed = (root: HTMLElement, name: string): void => {
  const button = [...root.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (button === undefined) throw new Error(`button not found: ${name}`);
  button.click();
};

const openEvidence = async (root: HTMLElement): Promise<void> => {
  const details = root.querySelector('details.ladder');
  if (!(details instanceof HTMLDetailsElement)) throw new Error('evidence ladder missing');
  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  await vi.waitFor(() => expect(root.textContent).toContain('Compiled clause'));
  await tick();
};

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  host?.remove();
  host = undefined;
  vi.unstubAllGlobals();
});

describe('proof-to-source provenance ladder', () => {
  it('loads evidence only after disclosure activation and exposes all six rungs', async () => {
    const fetcher = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify(EVIDENCE_FIXTURE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const root = render(ready);

    expect(fetcher).not.toHaveBeenCalled();
    expect(root.textContent).toContain('1 source clauses re-proved this part of the answer live.');
    expect(root.querySelector('iframe')).toBeNull();

    await openEvidence(root);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      [...root.querySelectorAll('.ladder > ol > li h3')].map((node) => node.textContent),
    ).toEqual([
      'Live Prolog proof',
      'Compiled clause',
      'Controlled sentence',
      'Coverage region',
      'Aligned source passage',
      'Guideline page',
    ]);
    expect(root.textContent).toContain('No human adjudication is recorded');
    expect(root.textContent).toContain('the example qualifier');
    expect(root.querySelector('iframe')).toBeNull();

    const pageLink = [...root.querySelectorAll<HTMLAnchorElement>('a')].find((link) =>
      link.textContent?.includes('Open page'),
    );
    expect(pageLink?.href).toContain('#page=42');
    clickNamed(root, 'Load page viewer');
    await tick();
    expect(root.querySelector<HTMLIFrameElement>('iframe')?.src).toContain('#page=42');
  });

  it('links the proof to the graph and pairs keyboard-selected alignment spans', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.resolve(new Response(JSON.stringify(EVIDENCE_FIXTURE)))),
    );
    const focuses: GraphFocus[] = [];
    const root = render(ready, (focus) => focuses.push(focus));

    clickNamed(root, 'Find in graph ↗');
    expect(focuses).toEqual([{ document: 'cdc2022-opioid-rec01-imp01', sentence: 1 }]);
    await openEvidence(root);

    const ace = root.querySelector<HTMLButtonElement>('[data-side="ace"] button');
    const source = root.querySelector<HTMLButtonElement>('[data-side="source"] button');
    if (ace === null || source === null) throw new Error('paired alignment controls missing');
    ace.focus();
    await tick();
    expect(ace.classList.contains('active')).toBe(true);
    expect(source.classList.contains('active')).toBe(true);
  });

  it('renders explicit non-content states without requesting document evidence', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const root = render({ kind: 'limit', solution: 0, limit: 'inference' });
    expect(root.textContent).toContain('inference limit');
    expect(root.querySelector('details.ladder')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      (await axe.run(root, { rules: { 'color-contrast': { enabled: false } } })).violations,
    ).toEqual([]);
  });
});
