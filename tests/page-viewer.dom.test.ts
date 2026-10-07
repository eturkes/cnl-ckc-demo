// @vitest-environment jsdom
// Close-2 C3: a failed page draw leaves Load page viewer selectable, and selecting it draws again.

import { mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';

import PageViewer from '../src/provenance/PageViewer.svelte';
import type { RenderedPage } from '../src/provenance/pdf-viewer.js';

// jsdom has no canvas: the lazily imported viewer is stood in for, as in the ladder suite.
const renderPage = vi.hoisted(() =>
  vi.fn(async (): Promise<RenderedPage> =>
    Promise.resolve({ page: 1, located: { coverage: 'whole', items: [0] } }),
  ),
);
vi.mock('../src/provenance/pdf-viewer.js', () => ({ renderPage }));

let app: ReturnType<typeof mount> | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  if (app !== undefined) await unmount(app);
  host?.remove();
  app = undefined;
  renderPage.mockClear();
});

const button = (): HTMLButtonElement => {
  const found = host?.querySelector<HTMLButtonElement>('[data-action="load-page-viewer"]');
  if (found == null) throw new Error('no Load page viewer control');
  return found;
};
const state = (): string | null | undefined =>
  host?.querySelector('.page-viewer')?.getAttribute('data-state');

it.each(['PDF fetch failed', 'Invalid page request.'])(
  'a failed draw re-enables Load page viewer, which draws again: %s',
  async (message) => {
    renderPage.mockRejectedValueOnce(new Error(message));
    host = document.createElement('div');
    document.body.append(host);
    app = mount(PageViewer, {
      target: host,
      props: { document: 'cdc2022-opioid-rec01', page: 1, passage: 'text' },
    });

    button().click();
    await vi.waitFor(() => {
      expect(state()).toBe('failed');
    });
    expect(host.textContent).toContain(message);
    expect(button().disabled).toBe(false);

    button().click();
    await vi.waitFor(() => {
      expect(state()).toBe('rendered');
    });
    expect(renderPage).toHaveBeenCalledTimes(2);
    expect(button().disabled).toBe(true);
  },
);
