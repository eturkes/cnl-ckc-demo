import axe from 'axe-core';
import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SemanticGraph from '../src/graph/SemanticGraph.svelte';
import type { GraphFocus, SemanticGraphNode } from '../src/graph/model.js';

import { GRAPH_FIXTURE } from './graph-fixture.js';

const canvasState = vi.hoisted(() => ({
  fail: '',
  updates: [] as { selected: string; nodes: number; edges: number; path: number }[],
  recentered: [] as (string | undefined)[],
  destroyed: 0,
}));

vi.mock('../src/graph/canvas.js', () => ({
  mountGraphCanvas: vi.fn(() => {
    if (canvasState.fail !== '') return Promise.reject(new Error(canvasState.fail));
    return Promise.resolve({
      update: (
        subgraph: { nodes: unknown[]; edges: unknown[] },
        selected: string,
        path: { nodes: unknown[] } | null,
      ) => {
        canvasState.updates.push({
          selected,
          nodes: subgraph.nodes.length,
          edges: subgraph.edges.length,
          path: path?.nodes.length ?? 0,
        });
      },
      recenter: (id?: string) => canvasState.recentered.push(id),
      destroy: () => {
        canvasState.destroyed += 1;
      },
    });
  }),
}));

let host: HTMLElement | undefined;
let cleanup: (() => void) | undefined;

const fetchOk = (): ReturnType<typeof vi.fn> =>
  vi.fn(async () =>
    Promise.resolve(
      new Response(JSON.stringify(GRAPH_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );

const render = (
  props: {
    focus?: GraphFocus;
    focusRequest?: number;
    onSelect?: (node: SemanticGraphNode) => void;
  } = {},
): HTMLElement => {
  host = document.createElement('div');
  document.body.append(host);
  const app = mount(SemanticGraph, { target: host, props });
  cleanup = () => void unmount(app);
  return host;
};

const click = (element: Element | null): void => {
  if (!(element instanceof HTMLElement)) throw new Error('expected a clickable element');
  element.click();
};

const activate = async (root: HTMLElement): Promise<void> => {
  click(
    [...root.querySelectorAll('button')].find((button) => button.textContent === 'Explore graph') ??
      null,
  );
  await vi.waitFor(() =>
    expect(root.querySelector('.counts')?.textContent).toMatch(/7 nodes\s*·\s*5\s*relationships/u),
  );
  await tick();
};

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  host?.remove();
  host = undefined;
  vi.unstubAllGlobals();
  canvasState.fail = '';
  canvasState.updates.length = 0;
  canvasState.recentered.length = 0;
  canvasState.destroyed = 0;
});

describe('lazy semantic graph surface', () => {
  it('fetches and imports the visual renderer only after explicit activation', async () => {
    const fetcher = fetchOk();
    vi.stubGlobal('fetch', fetcher);
    const root = render();

    expect(fetcher).not.toHaveBeenCalled();
    expect(root.textContent).toContain('load only after you select this control');

    await activate(root);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain('CDC 2022 opioid guideline');
    expect(canvasState.updates.at(-1)).toMatchObject({ selected: 'doc:cdc' });
  });

  it('applies an external focus after activation without letting it trigger the fetch', async () => {
    const fetcher = fetchOk();
    vi.stubGlobal('fetch', fetcher);
    const root = render({ focus: { kind: 'entity', label: 'Dosage reduction' } });
    expect(fetcher).not.toHaveBeenCalled();

    await activate(root);
    expect(root.querySelector('.selection-card h3')?.textContent).toBe('Dosage reduction');
    expect(canvasState.updates.at(-1)?.selected).toBe('entity:dosage');
  });

  it('activates on an explicit answer request and opens the cited sentence subgraph', async () => {
    const fetcher = fetchOk();
    vi.stubGlobal('fetch', fetcher);
    const root = render({
      focus: {
        document: 'cdc2022-opioid-rec05',
        sentence: 2,
        sentences: [2],
        lines: [22],
      },
      focusRequest: 1,
    });

    await vi.waitFor(() => expect(root.querySelector('.evidence-focus')).not.toBeNull());
    await tick();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.selection-card h3')?.textContent).toBe('Dosage reduction');
    expect(root.querySelector('.evidence-focus')?.textContent).toMatch(
      /Focused on 1\s+controlled sentence.*cdc2022-opioid-rec05/isu,
    );
    expect(root.querySelector('.view-status')?.textContent).toMatch(
      /Showing 4 nodes and\s*3 relationships for the selected answer evidence/iu,
    );
    expect(canvasState.updates.at(-1)).toMatchObject({
      selected: 'entity:dosage',
      nodes: 4,
      edges: 3,
    });
    expect(canvasState.recentered.at(-1)).toBeUndefined();
    expect(document.activeElement).toBe(root.querySelector('.evidence-focus'));
  });

  it('searches, selects through native controls, emits the node, and exposes a path', async () => {
    const selected: SemanticGraphNode[] = [];
    vi.stubGlobal('fetch', fetchOk());
    const root = render({ onSelect: (node) => selected.push(node) });
    await activate(root);

    const input = root.querySelector('input[type="search"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('search input missing');
    input.value = 'operator';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await tick();

    const result = [...root.querySelectorAll('.search-results button.result')].find((button) =>
      button.textContent?.includes('should'),
    );
    expect(result).toBeDefined();
    const path = result?.parentElement?.querySelector('button.path-action') ?? null;
    click(path);
    await tick();
    expect(root.textContent).toContain('Shortest path: 4 relationships.');
    expect(root.querySelectorAll('.path-panel ol li')).toHaveLength(5);

    click(result ?? null);
    await tick();
    expect(selected.at(-1)?.id).toBe('operator:should');
    expect(root.querySelector('.selection-card h3')?.textContent).toBe('should');
  });

  it('keeps the HTML relationships usable when the canvas renderer fails', async () => {
    canvasState.fail = 'canvas unavailable';
    vi.stubGlobal('fetch', fetchOk());
    const root = render();
    await activate(root);

    expect(root.textContent).toContain('visual graph is unavailable');
    expect(root.querySelector('.html-graph')).not.toBeNull();
    const recommendation = [...root.querySelectorAll('.relations button')].find(
      (button) => button.textContent === 'Recommendation',
    );
    click(recommendation ?? null);
    await tick();
    expect(root.querySelector('.selection-card h3')?.textContent).toBe('Recommendation');
  });

  it('reports a failed asset request and retries from an explicit control', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(GRAPH_FIXTURE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    const root = render();
    click(
      [...root.querySelectorAll('button')].find(
        (button) => button.textContent === 'Explore graph',
      ) ?? null,
    );
    await vi.waitFor(() => expect(root.textContent).toContain('returned HTTP 404'));
    click(
      [...root.querySelectorAll('button')].find((button) => button.textContent === 'Try again') ??
        null,
    );
    await vi.waitFor(() =>
      expect(root.querySelector('.counts')?.textContent).toMatch(
        /7 nodes\s*·\s*5\s*relationships/u,
      ),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('has no automated accessibility violations before or after activation', async () => {
    vi.stubGlobal('fetch', fetchOk());
    const root = render();
    const options = { rules: { 'color-contrast': { enabled: false } } };
    expect((await axe.run(root, options)).violations).toEqual([]);
    await activate(root);
    expect((await axe.run(root, options)).violations).toEqual([]);
  });
});
