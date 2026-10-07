<script lang="ts">
  import { messages } from '../i18n/locale.svelte.js';
  import { guidelinePdfUrl } from './assets.js';

  // One coverage row's guideline page: the new-tab link, and the owned PDF.js viewer the ladder
  // and the corpus browser share.
  interface Props {
    document: string;
    page: number;
    passage: string;
  }

  let { document, page, passage }: Props = $props();

  const t = $derived(messages.current);
  const pageHref = $derived(`${guidelinePdfUrl}#page=${String(page)}`);

  let open = $state(false);
  // Each select bumps it, so a failed draw re-runs the effect on the next select.
  let attempt = $state(0);
  let surface = $state<HTMLElement>();
  let viewer = $state.raw<
    | { kind: 'rendering' }
    | { kind: 'rendered'; page: number; coverage: 'whole' | 'continues' | 'none' }
    | { kind: 'failed'; message: string }
  >({ kind: 'rendering' });

  // The viewer and PDF.js load only here, once the reader opens the page.
  $effect(() => {
    void attempt;
    if (!open || surface === undefined) return;
    const host = surface;
    const target = page;
    const text = passage;
    const controller = new AbortController();
    viewer = { kind: 'rendering' };
    void import('./pdf-viewer.js')
      .then(({ renderPage }) =>
        // A change or unmount during the lazy import retired this render before it began.
        controller.signal.aborted
          ? undefined
          : renderPage(host, guidelinePdfUrl, target, text, controller.signal),
      )
      .then(
        (rendered) => {
          if (rendered !== undefined && !controller.signal.aborted) {
            viewer = { kind: 'rendered', page: target, coverage: rendered.located.coverage };
          }
        },
        (cause: unknown) => {
          if (!controller.signal.aborted) {
            viewer = {
              kind: 'failed',
              message: cause instanceof Error ? cause.message : String(cause),
            };
          }
        },
      );
    return () => {
      controller.abort();
    };
  });

  const status = $derived.by(() => {
    switch (viewer.kind) {
      case 'rendering':
        return t.TEXT.pageRendering();
      case 'failed':
        return t.TEXT.pageViewerFailed(viewer.message);
      case 'rendered':
        return viewer.coverage === 'whole'
          ? t.TEXT.passageHighlighted(viewer.page)
          : viewer.coverage === 'continues'
            ? t.TEXT.passageContinues(viewer.page)
            : t.TEXT.passageNotFound(viewer.page);
      default: {
        const exhaustive: never = viewer;
        return exhaustive;
      }
    }
  });
  const renderedPage = $derived(viewer.kind === 'rendered' ? viewer.page : undefined);
  const coverage = $derived(viewer.kind === 'rendered' ? viewer.coverage : undefined);
</script>

<div class="page-actions">
  <button
    type="button"
    data-action="load-page-viewer"
    disabled={open && viewer.kind !== 'failed'}
    onclick={() => {
      open = true;
      attempt += 1;
    }}>{t.LABELS.loadPageViewer}</button
  >
  <a href={pageHref} target="_blank" rel="noreferrer">{t.LABELS.openPageTab}</a>
</div>
{#if open}
  <div
    class="page-viewer"
    data-document={document}
    data-state={viewer.kind}
    data-page={renderedPage}
    data-coverage={coverage}
  >
    <p class="viewer-status" role="status">{status}</p>
    <div
      class="page-surface"
      role="group"
      aria-label={t.TEXT.pageViewerTitle(page)}
      bind:this={surface}
    ></div>
  </div>
{/if}

<style>
  .page-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .page-actions button {
    flex: none;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    padding: 0.4rem 0.65rem;
    background: transparent;
    color: var(--action);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }

  .page-actions button:disabled {
    cursor: default;
    opacity: 0.6;
  }

  a {
    color: var(--action);
    font-size: 0.82rem;
    overflow-wrap: anywhere;
  }

  .viewer-status {
    margin: 0.85rem 0 0;
    color: var(--text-muted);
    font-size: 0.82rem;
    overflow-wrap: anywhere;
  }

  .page-surface {
    position: relative;
    width: 100%;
    min-height: 8rem;
    margin-top: 0.5rem;
    border: 1px solid var(--border);
    background: white;
  }

  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
