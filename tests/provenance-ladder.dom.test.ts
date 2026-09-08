import axe from 'axe-core';
import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { locale } from '../src/i18n/locale.svelte.js';
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
      kind: 'clause',
      line: 77,
      head: 'guideline_property(example,dose)',
      predicate: 'guideline_property/5',
      document: 'cdc2022-opioid-rec01-imp01',
      sentence: 1,
      children: [],
    },
  ],
};

/**
 * A proof carrying all three arms, with the SAME premise re-assumed under two clauses and a
 * repeat inside one clause. That repetition is the real shape — 3,930 leaves collapse to 346
 * distinct literals — so a display that forgets to dedup fails here.
 */
const mixed: ProvenanceState = {
  kind: 'ready',
  solution: 0,
  steps: [
    {
      kind: 'clause',
      line: 77,
      head: 'guideline_property(example,dose)',
      predicate: 'guideline_property/5',
      document: 'cdc2022-opioid-rec01-imp01',
      sentence: 1,
      children: [
        { kind: 'assumption', head: 'guideline_entity(actual,c,clinician)', predicate: 'x/3' },
        { kind: 'assumption', head: 'guideline_entity(actual,c,clinician)', predicate: 'x/3' },
        { kind: 'negation', goal: 'guideline_event(actual,e,taper)' },
      ],
    },
    {
      kind: 'clause',
      line: 78,
      head: 'guideline_operator(actual,c,should)',
      predicate: 'guideline_operator/3',
      document: 'cdc2022-opioid-rec01-imp01',
      sentence: 1,
      children: [
        { kind: 'assumption', head: 'guideline_entity(actual,c,clinician)', predicate: 'x/3' },
        { kind: 'assumption', head: 'guideline_cardinality(actual,c,1)', predicate: 'y/3' },
        { kind: 'negation', goal: 'guideline_event(actual,e,taper)' },
      ],
    },
  ],
};

/** Every `<li>` of the named nested list inside the live-proof rung. */
const rowsOf = (root: HTMLElement, className: string): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(`ul.${className} li`),
];

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
  // `locale.set` persists, so a failed case would otherwise leave every later one Japanese.
  locale.set('en');
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
    expect(root.textContent).toContain('1 source clause re-proved this part of the answer live.');
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
    expect(focuses).toEqual([
      {
        document: 'cdc2022-opioid-rec01-imp01',
        sentence: 1,
        sentences: [1],
        lines: [77],
      },
    ]);
    await openEvidence(root);

    const ace = root.querySelector<HTMLButtonElement>('[data-side="ace"] button');
    const source = root.querySelector<HTMLButtonElement>('[data-side="source"] button');
    if (ace === null || source === null) throw new Error('paired alignment controls missing');
    ace.focus();
    await tick();
    expect(ace.classList.contains('active')).toBe(true);
    expect(source.classList.contains('active')).toBe(true);
  });

  it('C1/C2/C3 deduplicates premises, badges their origin, and never gives one a line', () => {
    vi.stubGlobal('fetch', vi.fn());
    const root = render(mixed);

    // C1: five assumption leaves, two distinct literals, first-appearance order.
    const premises = rowsOf(root, 'premises').filter((row) =>
      row.textContent?.includes('assumed, not stated'),
    );
    expect(premises.map((row) => row.querySelector('code')?.textContent)).toEqual([
      'guideline_entity(actual,c,clinician)',
      'guideline_cardinality(actual,c,1)',
    ]);
    expect(root.textContent).toContain('2 assumed premises');

    // C2: a premise carries the badge and no line text. A line would claim the knowledge
    // base states it, which is the one thing an assumption is not.
    for (const row of premises) {
      expect(row.textContent).toContain('assumed, not stated');
      expect(row.textContent).not.toMatch(/line \d/u);
    }

    // C3: the negation is its own claim, deduplicated to one row and never badged assumed.
    const negations = rowsOf(root, 'premises').filter((row) =>
      row.textContent?.includes('proved absent'),
    );
    expect(negations).toHaveLength(1);
    expect(negations[0]?.querySelector('code')?.textContent).toBe(
      'guideline_event(actual,e,taper)',
    );
    expect(root.textContent).toContain('1 goal proved absent');
    expect(root.textContent).toContain('The knowledge base does not state a premise');
  });

  it('C4/C6 keeps the clause list, the graph focus and the ladder rungs clause-only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.resolve(new Response(JSON.stringify(EVIDENCE_FIXTURE)))),
    );
    const focuses: GraphFocus[] = [];
    const root = render(mixed, (focus) => focuses.push(focus));

    // C4: the two lineless arms reach neither the step list nor the graph payload.
    const clauses = rowsOf(root, 'proof-steps').filter(
      (row) => row.parentElement?.classList.contains('premises') !== true,
    );
    expect(clauses.map((row) => row.querySelector('code')?.textContent)).toEqual([
      'guideline_property(example,dose)',
      'guideline_operator(actual,c,should)',
    ]);
    expect(root.textContent).toContain('2 proof steps');
    clickNamed(root, 'Find in graph ↗');
    expect(focuses).toEqual([
      { document: 'cdc2022-opioid-rec01-imp01', sentence: 1, sentences: [1], lines: [77, 78] },
    ]);

    // C6: the accepted ladder is unchanged — same six rungs, same summary.
    await openEvidence(root);
    const ladder = root.querySelector('details.ladder > ol');
    expect([...(ladder?.children ?? [])]).toHaveLength(6);
  });

  it('C7 renders both locales, and C9 axe stays clean with every disclosure open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.resolve(new Response(JSON.stringify(EVIDENCE_FIXTURE)))),
    );
    const root = render(mixed);
    await openEvidence(root);
    for (const details of root.querySelectorAll('details')) details.open = true;
    await tick();
    expect(
      (await axe.run(root, { rules: { 'color-contrast': { enabled: false } } })).violations,
    ).toEqual([]);

    locale.set('ja');
    await tick();
    expect(root.textContent).toContain('仮定 (知識ベース外)');
    expect(root.textContent).toContain('不成立を確認');
    expect(root.textContent).toContain('仮定した前提2件');
    expect(root.textContent).toContain('不成立を確認した目標1件');
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
