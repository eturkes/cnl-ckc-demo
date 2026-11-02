<script lang="ts">
  import { messages } from '../../../src/i18n/locale.svelte.js';
  import { loadCorpusIndex, loadEvidenceDocument } from '../../../src/provenance/assets.js';
  import type { CorpusEntry, EvidenceDocument } from '../../../src/provenance/model.js';
  import PageViewer from '../../../src/provenance/PageViewer.svelte';
  import { EXCLUSION_GOAL, loadExclusionRecords } from './guards.js';

  // The document-first view of the explore area: every document's coverage row, each opening its
  // passage and page through the ladder's own resolver. Nothing loads until the reader asks.
  let { demo } = $props();
  const uid = $props.id();
  let status = $state('Reading status records from the knowledge base…');
  let supersessions = $state.raw<any[]>([]);
  let exclusions = $state.raw<any[]>([]);
  let recordsRead = false;
  const supersessionGoal = 'guideline_supersession(Document,Sentence,Source,Date)';
  // guideline_exclusion sources join live clause lines to the shipped index, not a document list.
  const exclusionGoal = EXCLUSION_GOAL;
  let raw = $state('');
  const value = (term: any) => term?.value;
  const superseded = (id: string, sentence?: number) => supersessions.find(row => row.document === id && (sentence === undefined || row.sentence === sentence));
  const excluded = (id: string, sentence?: number) => exclusions.some(row => row.document === id && (sentence === undefined || row.sentence === sentence));
  const dateText = (date: number) => new Date(Date.UTC(Math.floor(date / 10000), Math.floor(date / 100) % 100 - 1, date % 100)).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
  $effect(() => {
    if (demo.state.kind === 'booting' || demo.state.kind === 'boot-error' || recordsRead) return;
    recordsRead = true;
    void (async () => {
      try {
        const sup = await demo.runGoal(supersessionGoal);
        const exc = await loadExclusionRecords(demo);
        if (sup?.kind !== 'solutions') throw new Error(JSON.stringify(sup));
        supersessions = sup.solutions.map(({bindings: b}: any) => ({document: value(b.Document), sentence: Number(value(b.Sentence)), citation: value(b.Source.args[0]), url: value(b.Source.args[1]), date: Number(value(b.Date))}));
        exclusions = exc.records.map(record => ({document:record.document,sentence:record.sentence}));
        raw = JSON.stringify({sup,exc}, null, 2);
        status = `Status records read from the knowledge base: ${supersessions.length} superseded sentences; ${exc.records.length} scope-exclusion clauses.`;
        await activate();
        const first = supersessions[0]?.document;
        if (first) { query = first; await open(first); }
      } catch (error) { status = `Status records could not be shown: ${String(error)}`; }
    })();
  });
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

  const statusDocuments = $derived([...new Set([...supersessions,...exclusions].map(row => row.document))]);
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

  <p role="status">{status}</p>
  <nav class="review-links" aria-label="Status record examples">
    <button onclick={() => { query = ''; close(); }}>Every document</button>
    {#each statusDocuments as documentId}
      <button onclick={() => { query = documentId; void open(documentId); }}>{documentId}</button>
    {/each}
  </nav>
  <details class="record-goals"><summary>Prolog goals behind these status marks</summary><pre>{`${supersessionGoal}\n${exclusionGoal}`}</pre><pre>{raw}</pre></details>

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
              {#if superseded(row.id)}<small class="status-mark">◷ Superseded</small>{/if}
              {#if excluded(row.id)}<small class="status-mark">⊘ Scope exclusion</small>{/if}
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
          <h4>Statements in this document</h4>
          <p>The controlled-language sentences below retain the document's wording. Status marks come from the live knowledge base records.</p>
          <ol class="sentence-records">
            {#each evidence.ace.sentences as sentence}
              {@const replacement = superseded(evidence.id, sentence.number)}
              <li data-sentence={sentence.number}>
                <span class="sentence-id">S{sentence.number}</span>
                <div>
                  <p class="sentence-text">{sentence.text}</p>
                  {#if replacement}
                    <p class="statement-status"><strong>◷ Superseded</strong> from {dateText(replacement.date)} by <a href={replacement.url} target="_blank" rel="noreferrer">{replacement.citation}</a></p>
                  {/if}
                  {#if excluded(evidence.id, sentence.number)}
                    <p class="statement-status"><strong>⊘ Scope exclusion</strong> This sentence states a condition that excludes a patient or care setting from the guideline's recommendations.</p>
                  {/if}
                </div>
              </li>
            {/each}
          </ol>
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
  .review-links { display: flex; gap: .4rem; flex-wrap: wrap; margin: .7rem 0; }
  .record-goals { margin: .7rem 0; font-size: .8rem; }
  pre { max-height: 20rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
  .status-mark { color: var(--warn); font-weight: 700; }
  .sentence-records { list-style: none; padding: 0; margin: .5rem 0 1.2rem; }
  .sentence-records li { display: grid; grid-template-columns: 1.6rem 1fr; gap: .5rem; padding: .8rem 0; border-top: 1px solid var(--border); }
  .sentence-id { font-family: var(--font-code); font-size: .75rem; color: var(--text-muted); padding-top: .2rem; }
  .corpus-document .sentence-text { margin: 0; font-family: var(--font-prose); font-size: .95rem; color: var(--text); }
  .corpus-document .statement-status { border-left: 3px solid var(--warn); padding-left: .65rem; margin: .5rem 0 0; font-size: .8rem; color: var(--text); }
  .statement-status strong { color: var(--warn); }
  .statement-status a { color: var(--action); }
  .statement-status a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  h4 { margin: 1.4rem 0 .4rem; }
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
