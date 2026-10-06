// @vitest-environment jsdom
// d43: the corpus browser loads nothing until the reader asks, lists every indexed document, and
// opens one through the ladder's own resolver and page viewer.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CorpusBrowser from '../src/provenance/CorpusBrowser.svelte';
import type { RenderedPage } from '../src/provenance/pdf-viewer.js';

import { EVIDENCE_FIXTURE } from './provenance-fixture.js';

// jsdom has no canvas: the lazily imported viewer is stood in for, as in the ladder suite.
const renderPage = vi.hoisted(() =>
  vi.fn(async (_surface: HTMLElement, _url: string, page: number): Promise<RenderedPage> =>
    Promise.resolve({ page, located: { coverage: 'whole', items: [0] } }),
  ),
);
vi.mock('../src/provenance/pdf-viewer.js', () => ({ renderPage }));

const INDEX = {
  schemaVersion: 1,
  documents: [
    {
      id: 'cdc2022-opioid-rec01',
      label: 'unreviewed',
      region: { id: 'B3-02', page: 13, section: 'BOX 3 > Recommendation 1' },
    },
    {
      id: EVIDENCE_FIXTURE.id,
      label: EVIDENCE_FIXTURE.label,
      region: {
        id: EVIDENCE_FIXTURE.region.id,
        page: EVIDENCE_FIXTURE.region.page,
        section: EVIDENCE_FIXTURE.region.section,
      },
    },
    {
      id: 'cdc2022-opioid-s9-01',
      label: 'unreviewed',
      region: { id: 'S9-01', page: 9, section: 'Introduction' },
    },
  ],
};

let cleanup: (() => void) | undefined;

const render = (): HTMLElement => {
  const host = document.createElement('div');
  document.body.append(host);
  const app = mount(CorpusBrowser, { target: host });
  flushSync();
  cleanup = () => {
    void unmount(app);
    host.remove();
  };
  return host;
};

const serve = (index: unknown = INDEX) => {
  const fetcher = vi.fn(async (url: string) =>
    Promise.resolve(
      new Response(JSON.stringify(url.includes('corpus-index') ? index : EVIDENCE_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};

const click = (element: Element | null | undefined): void => {
  if (!(element instanceof HTMLElement)) throw new Error('control is missing');
  element.click();
  flushSync();
};

const rows = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('.documents li code')].map((code) => code.textContent);

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  renderPage.mockClear();
});

describe('corpus browser', () => {
  it('fetches nothing until the reader asks, then lists every indexed document', async () => {
    const fetcher = serve();
    const root = render();
    expect(fetcher).not.toHaveBeenCalled();
    expect(root.querySelector('.documents')).toBeNull();

    click(root.querySelector('[data-action="browse-corpus"]'));
    await vi.waitFor(() => {
      expect(root.querySelector('[data-documents]')?.getAttribute('data-documents')).toBe('3');
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('corpus-index');
    expect(rows(root)).toEqual(INDEX.documents.map((row) => row.id));
    expect(root.textContent).toContain('Region B3-02, physical page 13');
    expect(root.querySelector('.shown')?.textContent).toBe('Showing 3 of 3 documents.');
  });

  it('filters by document, region or section', async () => {
    serve();
    const root = render();
    click(root.querySelector('[data-action="browse-corpus"]'));
    await vi.waitFor(() => {
      expect(rows(root)).toHaveLength(3);
    });
    const input = root.querySelector('input');
    if (input === null) throw new Error('filter is missing');
    for (const [needle, expected] of [
      ['rec01', ['cdc2022-opioid-rec01', EVIDENCE_FIXTURE.id]],
      ['s9-01', ['cdc2022-opioid-s9-01']],
      ['example SECTION', [EVIDENCE_FIXTURE.id]],
      ['no such row', []],
    ] as const) {
      input.value = needle;
      input.dispatchEvent(new Event('input'));
      flushSync();
      expect(rows(root), needle).toEqual(expected);
    }
  });

  it('opens a document through the evidence resolver and its page through the shared viewer', async () => {
    const fetcher = serve();
    const root = render();
    click(root.querySelector('[data-action="browse-corpus"]'));
    await vi.waitFor(() => {
      expect(rows(root)).toHaveLength(3);
    });
    const opener = [...root.querySelectorAll('[data-action="open-document"]')][1];
    click(opener);
    await vi.waitFor(() => {
      expect(root.querySelector('.corpus-document blockquote')?.textContent).toBe(
        EVIDENCE_FIXTURE.source.text,
      );
    });
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(`${EVIDENCE_FIXTURE.id}`);
    expect(opener?.getAttribute('aria-expanded')).toBe('true');
    // WCAG 2.5.3: the accessible name contains the visible label in either state.
    expect(opener?.textContent).toBe('Close');
    expect(opener?.getAttribute('aria-label')).toBe(`Close ${EVIDENCE_FIXTURE.id}`);
    expect(root.textContent).toContain('as this document records it');
    expect(root.textContent).not.toContain('The same Prolog result');

    expect(renderPage).not.toHaveBeenCalled();
    click(root.querySelector('.corpus-document [data-action="load-page-viewer"]'));
    await vi.waitFor(() => {
      expect(root.querySelector('.page-viewer')?.getAttribute('data-state')).toBe('rendered');
    });
    expect(renderPage.mock.calls[0]?.slice(2, 4)).toEqual([
      EVIDENCE_FIXTURE.region.page,
      EVIDENCE_FIXTURE.source.text,
    ]);
    expect(root.querySelector('.page-viewer')?.getAttribute('data-document')).toBe(
      EVIDENCE_FIXTURE.id,
    );

    click(opener);
    expect(root.querySelector('.corpus-document')).toBeNull();
    expect(opener?.getAttribute('aria-expanded')).toBe('false');
    expect(opener?.textContent).toBe('Open');
    expect(opener?.getAttribute('aria-label')).toBe(`Open ${EVIDENCE_FIXTURE.id}`);
  });

  it('reports a list that failed to load and retries it', async () => {
    serve({ schemaVersion: 9, documents: [] });
    const root = render();
    click(root.querySelector('[data-action="browse-corpus"]'));
    await vi.waitFor(() => {
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        'The document list did not load.',
      );
    });
    serve();
    click(root.querySelector('.load-failure button'));
    await vi.waitFor(() => {
      expect(rows(root)).toHaveLength(3);
    });
  });
});
