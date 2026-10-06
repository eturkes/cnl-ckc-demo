<script lang="ts">
  import { messages } from '../i18n/locale.svelte.js';
  import { loadCorpusIndex, loadEvidenceDocument } from './assets.js';
  import type { CorpusEntry, EvidenceDocument } from './model.js';
  import PageViewer from './PageViewer.svelte';

  // The document-first view of the explore area: every document's coverage row, each opening its
  // passage and page through the ladder's own resolver. Nothing loads until the reader asks.
  const uid = $props.id();
  const headingId = `${uid}-heading`;
  const filterId = `${uid}-filter`;
  const panelId = `${uid}-document`;
  const panelHeadingId = `${uid}-document-heading`;
  const t = $derived(messages.current);

  let list = $state.raw<
    | { kind: 'inactive' }
    | { kind: 'loading' }
    | { kind: 'ready'; documents: CorpusEntry[] }
    | { kind: 'error'; message: string }
  >({ kind: 'inactive' });
  let query = $state('');
  let opened = $state.raw<
    | { kind: 'none' }
    | { kind: 'loading'; id: string }
    | { kind: 'ready'; evidence: EvidenceDocument }
    | { kind: 'error'; id: string; message: string }
  >({ kind: 'none' });
  let request: AbortController | undefined;

  const activate = async (): Promise<void> => {
    list = { kind: 'loading' };
    try {
      list = { kind: 'ready', documents: await loadCorpusIndex() };
    } catch (cause) {
      list = { kind: 'error', message: cause instanceof Error ? cause.message : String(cause) };
    }
  };

  const open = async (id: string): Promise<void> => {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    opened = { kind: 'loading', id };
    try {
      const evidence = await loadEvidenceDocument(id, controller.signal);
      if (request === controller) opened = { kind: 'ready', evidence };
    } catch (cause) {
      if (request === controller && !controller.signal.aborted) {
        opened = {
          kind: 'error',
          id,
          message: cause instanceof Error ? cause.message : String(cause),
        };
      }
    }
  };

  const close = (): void => {
    request?.abort();
    request = undefined;
    opened = { kind: 'none' };
  };

  $effect(() => () => {
    request?.abort();
  });

  const documents = $derived(list.kind === 'ready' ? list.documents : []);
  const needle = $derived(query.trim().toLowerCase());
  const shown = $derived(
    needle === ''
      ? documents
      : documents.filter((row) =>
          [row.id, row.region.id, row.region.section].some((field) =>
            field.toLowerCase().includes(needle),
          ),
        ),
  );
  const openId = $derived(
    opened.kind === 'none' ? undefined : opened.kind === 'ready' ? opened.evidence.id : opened.id,
  );
  const evidence = $derived(opened.kind === 'ready' ? opened.evidence : undefined);
  const openError = $derived(opened.kind === 'error' ? opened.message : '');
</script>

<section class="corpus-browser" aria-labelledby={headingId}>
  <header>
    <p class="eyebrow">{t.LABELS.corpusEyebrow}</p>
    <h2 id={headingId}>{t.LABELS.corpusHeading}</h2>
  </header>

  {#if list.kind === 'inactive'}
    <div class="activation">
      <p>{t.DESCRIPTIONS.corpusIntro}</p>
      <button
        class="primary"
        type="button"
        data-action="browse-corpus"
        onclick={() => void activate()}>{t.LABELS.corpusBrowse}</button
      >
      <p class="load-note">{t.DESCRIPTIONS.corpusLoadNote}</p>
    </div>
  {:else if list.kind === 'loading'}
    <p class="pending" role="status">{t.LABELS.corpusLoading}</p>
  {:else if list.kind === 'error'}
    <div class="load-failure" role="alert">
      <p>{t.TEXT.corpusFailed(list.message)}</p>
      <button class="primary" type="button" onclick={() => void activate()}
        >{t.LABELS.graphTryAgain}</button
      >
    </div>
  {:else}
    <p class="counts" data-documents={documents.length}>{t.TEXT.corpusCount(documents.length)}</p>
    <label for={filterId}>{t.LABELS.corpusFilter}</label>
    <input id={filterId} type="search" bind:value={query} autocomplete="off" />
    <p class="shown" role="status">{t.TEXT.corpusShown(shown.length, documents.length)}</p>

    <ul class="documents">
      {#each shown as row (row.id)}
        <li class:open={row.id === openId}>
          <div class="row">
            <div class="facts">
              <code>{row.id}</code>
              <span class="section">{row.region.section}</span>
              <small>{t.TEXT.corpusRegionPage(row.region.id, row.region.page)}</small>
            </div>
            <button
              type="button"
              data-action="open-document"
              aria-expanded={row.id === openId}
              aria-controls={row.id === openId ? panelId : undefined}
              aria-label={row.id === openId
                ? t.TEXT.corpusCloseDocument(row.id)
                : t.TEXT.corpusOpenDocument(row.id)}
              onclick={() => (row.id === openId ? close() : void open(row.id))}
              >{row.id === openId ? t.LABELS.corpusClose : t.LABELS.corpusOpen}</button
            >
          </div>
        </li>
      {/each}
    </ul>

    {#if openId !== undefined}
      <section class="corpus-document" id={panelId} aria-labelledby={panelHeadingId}>
        <h3 id={panelHeadingId}><code>{openId}</code></h3>
        {#if evidence !== undefined}
          <p>{t.DESCRIPTIONS.corpusPassage}</p>
          <blockquote>{evidence.source.text}</blockquote>
          <p class="review">
            <strong>{t.TEXT.reviewStatus(evidence.label)}</strong>
            {evidence.label === 'unreviewed'
              ? t.DESCRIPTIONS.reviewUnreviewed
              : t.DESCRIPTIONS.reviewRecorded}
          </p>
          <p>{t.TEXT.passagePage(evidence.region.page)}</p>
          {#key evidence.id}
            <PageViewer
              document={evidence.id}
              page={evidence.region.page}
              passage={evidence.source.text}
            />
          {/key}
        {:else if openError !== ''}
          <p role="alert">{t.TEXT.corpusDocumentFailed(openError)}</p>
        {:else}
          <p role="status">{t.LABELS.corpusDocumentLoading}</p>
        {/if}
      </section>
    {/if}
  {/if}
</section>

<style>
  .corpus-browser {
    min-width: 0;
    margin-top: 1.5rem;
    border-top: 1px solid var(--border);
    padding-top: 1.25rem;
  }

  .eyebrow {
    margin: 0;
    color: var(--action);
    font-family: var(--font-code);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0.2rem 0 0.75rem;
    font-size: 1.35rem;
    overflow-wrap: anywhere;
  }

  .activation p,
  .counts,
  .shown,
  .pending,
  .corpus-document p {
    max-width: 46rem;
    color: var(--text-muted);
    font-size: 0.86rem;
    overflow-wrap: anywhere;
  }

  .load-note {
    font-size: 0.78rem;
  }

  button {
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    padding: 0.4rem 0.65rem;
    background: transparent;
    color: var(--action);
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }

  button.primary {
    border-color: var(--action);
    background: var(--action);
    color: var(--action-text);
    font-weight: 700;
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  label {
    display: block;
    margin-bottom: 0.3rem;
    font-size: 0.8rem;
    font-weight: 700;
  }

  input {
    box-sizing: border-box;
    width: min(100%, 28rem);
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    padding: 0.4rem 0.55rem;
    background: var(--surface-raised);
    color: var(--text);
    font: inherit;
    font-size: 0.86rem;
  }

  .documents {
    display: grid;
    gap: 0.5rem;
    max-height: 24rem;
    margin: 0.75rem 0 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .documents li {
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    padding: 0.55rem 0.7rem;
    background: var(--surface-raised);
  }

  .row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    justify-content: space-between;
  }

  .facts {
    display: grid;
    min-width: 0;
    gap: 0.15rem;
  }

  code {
    font-family: var(--font-code);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .section {
    font-size: 0.86rem;
    overflow-wrap: anywhere;
  }

  small {
    color: var(--text-muted);
    font-size: 0.75rem;
    overflow-wrap: anywhere;
  }

  .corpus-document {
    min-width: 0;
    margin-top: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    padding: 0.85rem 1rem;
    background: var(--surface-raised);
  }

  h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }

  .documents li.open {
    border-color: var(--action);
  }

  blockquote {
    margin: 0.4rem 0;
    border-left: 3px solid var(--border);
    padding-left: 0.75rem;
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }
</style>
