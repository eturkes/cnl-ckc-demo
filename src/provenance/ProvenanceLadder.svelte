<script lang="ts">
  import { guidelinePdfUrl, loadEvidenceDocument } from './assets.js';
  import {
    alignedSegments,
    flattenProof,
    type EvidenceDocument,
    type GraphFocus,
    type ProvenanceState,
  } from './model.js';

  interface Props {
    state: ProvenanceState;
    onGraphFocus?: (focus: GraphFocus) => void;
  }

  let { state: provenanceState, onGraphFocus = () => undefined }: Props = $props();

  let evidence = $state<EvidenceDocument>();
  let evidenceError = $state('');
  let evidenceLoading = $state(false);
  let selectedGroup = $state<number>();
  let pageOpen = $state(false);
  let activeRequest: AbortController | undefined;

  const steps = $derived(
    provenanceState.kind === 'ready' ? flattenProof(provenanceState.steps) : [],
  );
  const documentId = $derived(steps.find((step) => step.document !== undefined)?.document);
  const documentSteps = $derived(
    documentId === undefined ? [] : steps.filter((step) => step.document === documentId),
  );
  const sentences = $derived(
    [
      ...new Set(
        documentSteps.flatMap((step) => (step.sentence === undefined ? [] : [step.sentence])),
      ),
    ].sort((left, right) => left - right),
  );
  const proofSourceLines = $derived(
    [...new Set(documentSteps.map((step) => step.line))].sort((left, right) => left - right),
  );
  const proofLines = $derived(new Set(steps.map((step) => step.line)));
  const clauses = $derived(evidence?.clauses.filter((clause) => proofLines.has(clause.line)) ?? []);
  const aceSegments = $derived(
    evidence === undefined
      ? []
      : alignedSegments(evidence.ace.text, evidence.alignment.spans, 'ace'),
  );
  const sourceSegments = $derived(
    evidence === undefined
      ? []
      : alignedSegments(evidence.source.text, evidence.alignment.spans, 'source'),
  );
  const pageHref = $derived(
    evidence === undefined
      ? guidelinePdfUrl
      : `${guidelinePdfUrl}#page=${String(evidence.region.page)}`,
  );

  $effect(() => {
    void provenanceState;
    activeRequest?.abort();
    activeRequest = undefined;
    evidence = undefined;
    evidenceError = '';
    evidenceLoading = false;
    selectedGroup = undefined;
    pageOpen = false;
  });

  const loadEvidence = async (): Promise<void> => {
    if (evidence !== undefined || evidenceLoading || documentId === undefined) return;
    const request = new AbortController();
    activeRequest?.abort();
    activeRequest = request;
    evidenceLoading = true;
    evidenceError = '';
    try {
      evidence = await loadEvidenceDocument(documentId, request.signal);
    } catch (cause) {
      if (!request.signal.aborted) {
        evidenceError = cause instanceof Error ? cause.message : String(cause);
      }
    } finally {
      if (activeRequest === request) {
        evidenceLoading = false;
        activeRequest = undefined;
      }
    }
  };

  const opened = (event: Event): void => {
    if ((event.currentTarget as HTMLDetailsElement).open) void loadEvidence();
  };

  const describe = (value: ProvenanceState): string => {
    switch (value.kind) {
      case 'idle':
        return 'Select a citation to trace that part of the answer.';
      case 'loading':
        return 'Re-proving the selected source contribution.';
      case 'failure':
        return 'The selected source contribution could not be re-proved.';
      case 'limit':
        return `The proof trace stopped at the ${value.limit} limit.`;
      case 'cancelled':
        return 'The proof trace was cancelled.';
      case 'unavailable':
        return value.message;
      case 'error':
        return `The proof trace failed (${value.error.code}). ${value.error.message}`;
      case 'ready':
        return `${String(flattenProof(value.steps).length)} source clauses re-proved this part of the answer live.`;
      default: {
        const exhaustive: never = value;
        return exhaustive;
      }
    }
  };
</script>

<section class="trace" aria-labelledby="trace-heading">
  <div class="title-row">
    <div>
      <p class="eyebrow">Evidence</p>
      <h2 id="trace-heading">Proof to source</h2>
    </div>
    {#if documentId !== undefined}
      <button
        class="graph-link"
        type="button"
        onclick={() => {
          onGraphFocus({
            document: documentId,
            ...(sentences[0] === undefined ? {} : { sentence: sentences[0], sentences }),
            ...(proofSourceLines.length === 0 ? {} : { lines: proofSourceLines }),
          });
        }}>Find in graph <span aria-hidden="true">↗</span></button
      >
    {/if}
  </div>

  <p class="trace-summary" aria-live="polite">{describe(provenanceState)}</p>

  {#if provenanceState.kind === 'ready' && documentId !== undefined}
    <details class="ladder" ontoggle={opened}>
      <summary>Explore the six evidence steps</summary>
      <ol>
        <li>
          <h3>Live Prolog proof</h3>
          <p>
            The engine re-ran the selected source contribution through its bounded proof
            interpreter.
          </p>
          <details class="technical">
            <summary>{steps.length} proof {steps.length === 1 ? 'step' : 'steps'}</summary>
            <ul class="proof-steps">
              {#each steps as step, index (`${step.line}-${index}`)}
                <li><code>{step.head}</code> <span>line {step.line}</span></li>
              {/each}
            </ul>
          </details>
        </li>

        {#if evidenceLoading}
          <li class="pending" aria-live="polite">Loading the selected document evidence.</li>
        {:else if evidenceError !== ''}
          <li class="load-error">
            <p role="alert">{evidenceError}</p>
            <button type="button" onclick={() => void loadEvidence()}>Retry evidence</button>
          </li>
        {:else if evidence !== undefined}
          <li>
            <h3>Compiled clause</h3>
            <p>
              {clauses.length} exact {clauses.length === 1 ? 'clause' : 'clauses'} joined by source line.
            </p>
            {#each clauses as clause (clause.line)}
              <code class="clause">{clause.text}</code>
            {/each}
          </li>
          <li>
            <h3>Controlled sentence</h3>
            <p class="aligned-copy" data-side="ace">
              {#each aceSegments as segment, index (`ace-${index}`)}
                {#if segment.kind === 'aligned'}
                  <button
                    type="button"
                    class:active={selectedGroup === segment.group}
                    aria-pressed={selectedGroup === segment.group}
                    aria-label={`Align controlled phrase: ${segment.text}`}
                    onfocus={() => (selectedGroup = segment.group)}
                    onpointerenter={() => (selectedGroup = segment.group)}
                    onclick={() => (selectedGroup = segment.group)}>{segment.text}</button
                  >
                {:else}{segment.text}{/if}
              {/each}
            </p>
          </li>
          <li>
            <h3>Coverage region</h3>
            <dl>
              <div>
                <dt>Region</dt>
                <dd>{evidence.region.id}</dd>
              </div>
              <div>
                <dt>Section</dt>
                <dd>{evidence.region.section}</dd>
              </div>
              <div>
                <dt>Physical page</dt>
                <dd>{evidence.region.page}</dd>
              </div>
            </dl>
          </li>
          <li>
            <h3>Aligned source passage</h3>
            <blockquote class="aligned-copy" data-side="source">
              {#each sourceSegments as segment, index (`source-${index}`)}
                {#if segment.kind === 'aligned'}
                  <button
                    type="button"
                    class:active={selectedGroup === segment.group}
                    aria-pressed={selectedGroup === segment.group}
                    aria-label={`Align source phrase: ${segment.text}`}
                    onfocus={() => (selectedGroup = segment.group)}
                    onpointerenter={() => (selectedGroup = segment.group)}
                    onclick={() => (selectedGroup = segment.group)}>{segment.text}</button
                  >
                {:else}{segment.text}{/if}
              {/each}
            </blockquote>
            <div class="disclosures">
              <p><strong>Projection kept:</strong> {evidence.projection.kept}</p>
              <p><strong>Projection changed or omitted:</strong> {evidence.projection.dropped}</p>
              <p>
                <strong>Review status: {evidence.label}.</strong>
                {evidence.label === 'unreviewed'
                  ? ' No human adjudication is recorded for this compiled document.'
                  : ' This is the review label recorded by the knowledge-base export.'}
              </p>
            </div>
          </li>
          <li>
            <h3>Guideline page</h3>
            <p>The passage maps to physical PDF page {evidence.region.page}.</p>
            <div class="page-actions">
              <button type="button" onclick={() => (pageOpen = true)}>Load page viewer</button>
              <a href={pageHref} target="_blank" rel="noreferrer">Open page in a new tab</a>
            </div>
            {#if pageOpen}
              <iframe
                src={pageHref}
                title={`CDC guideline, physical page ${String(evidence.region.page)}`}
              ></iframe>
            {/if}
          </li>
        {/if}
      </ol>
    </details>
  {/if}
</section>

<style>
  .trace {
    max-width: 52rem;
    margin-top: 1.75rem;
    border-top: 1px solid var(--border);
  }

  .title-row {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0 0;
  }

  .eyebrow {
    margin: 0 0 0.2rem;
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 650;
  }

  h3 {
    margin: 0 0 0.35rem;
    font-size: 0.84rem;
    font-weight: 700;
  }

  p {
    margin: 0 0 0.65rem;
  }

  .trace-summary {
    margin: 0;
    padding: 0.5rem 0 1rem;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .graph-link,
  .page-actions button,
  .load-error button {
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

  .ladder {
    border-top: 1px solid var(--border);
  }

  .ladder > summary {
    padding: 0.8rem 0;
    color: var(--action);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }

  ol {
    counter-reset: evidence-step;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ol > li {
    position: relative;
    counter-increment: evidence-step;
    min-height: 3.5rem;
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    padding: 1rem 0 1rem 2.8rem;
  }

  ol > li::before {
    position: absolute;
    top: 1rem;
    left: 0;
    content: counter(evidence-step, decimal-leading-zero);
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.68rem;
    font-weight: 700;
  }

  ol > li:last-child {
    padding-bottom: 0.4rem;
  }

  ol p,
  blockquote,
  dd {
    font-size: 0.84rem;
  }

  .technical {
    margin-top: 0.35rem;
  }

  .technical summary {
    width: max-content;
    max-width: 100%;
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .proof-steps {
    margin: 0.5rem 0 0;
    padding-left: 1rem;
  }

  .proof-steps li {
    margin-bottom: 0.45rem;
    overflow-wrap: anywhere;
  }

  .proof-steps span {
    color: var(--text-muted);
    font-size: 0.72rem;
  }

  code {
    font-family: var(--font-code);
  }

  .clause {
    display: block;
    margin: 0.4rem 0;
    padding: 0.7rem;
    border-radius: 0.15rem;
    background: var(--surface-sunken);
    font-size: 0.73rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .aligned-copy {
    white-space: pre-wrap;
  }

  .aligned-copy button {
    display: inline;
    margin: 0;
    border: 0;
    border-bottom: 2px solid var(--action);
    border-radius: 0.15rem;
    padding: 0;
    background: color-mix(in srgb, var(--action) 13%, transparent);
    color: inherit;
    font: inherit;
    line-height: inherit;
    cursor: pointer;
  }

  .aligned-copy button.active,
  .aligned-copy button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
    background: var(--action);
    color: var(--action-text);
  }

  blockquote {
    margin: 0.25rem 0 0.8rem;
    border-left: 2px solid var(--action);
    padding: 0.15rem 0 0.15rem 0.85rem;
    font-family: var(--font-prose);
  }

  dl {
    display: grid;
    gap: 0.35rem;
    margin: 0;
  }

  dl div {
    display: grid;
    grid-template-columns: minmax(6rem, 0.35fr) 1fr;
    gap: 0.75rem;
  }

  dt {
    color: var(--text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .disclosures {
    margin-top: 0.75rem;
    border-left: 2px solid var(--border);
    padding: 0.1rem 0 0.1rem 0.8rem;
  }

  .disclosures p:last-child {
    margin-bottom: 0;
  }

  .page-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  a {
    color: var(--action);
    font-size: 0.82rem;
  }

  iframe {
    width: 100%;
    min-height: min(65vh, 42rem);
    margin-top: 0.85rem;
    border: 1px solid var(--border);
    background: white;
  }

  button:focus-visible,
  summary:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 28rem) {
    .title-row {
      align-items: flex-start;
      flex-direction: column;
    }

    ol {
      padding-left: 0;
    }

    dl div {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }
</style>
