<script lang="ts">
  import AboutPanel from './demo/AboutPanel.svelte';
  import AnswerPanel from './demo/AnswerPanel.svelte';
  import { DESCRIPTIONS, GUIDELINE, INSTRUCTIONS } from './demo/copy.js';
  import { DemoController, solutionsOf } from './demo/DemoController.svelte.js';
  import { answerRows, describeState, type AnswerRow } from './demo/describe.js';
  import RunControls from './demo/RunControls.svelte';
  import ThemeToggle from './demo/ThemeToggle.svelte';
  import {
    SemanticGraph,
    type GraphFocus as SemanticGraphFocus,
    type SemanticGraphNode,
  } from './graph/index.js';
  import { flattenProof, type GraphFocus as ProvenanceGraphFocus } from './provenance/model.js';
  import type { QuestionId } from './questions/catalog.js';
  import QuestionCombobox from './questions/QuestionCombobox.svelte';

  interface Props {
    /** Injected by tests; the shipped app lets `App` build and own the default. */
    controller?: DemoController;
  }

  let { controller }: Props = $props();

  // The controller is an ownership handoff read once at construction, not a
  // reactive input: swapping it mid-life would strand the engine it owns.
  // svelte-ignore state_referenced_locally
  const injected = controller;
  const demo = injected ?? new DemoController();

  let graphFocus = $state.raw<SemanticGraphFocus | null>(null);
  let graphSelection = $state.raw<SemanticGraphNode | null>(null);
  let graphRegion = $state<HTMLElement>();

  $effect(() => () => {
    if (injected === undefined) demo.dispose();
  });

  // Everything below is derived in the script rather than the template: ESLint
  // types a `.svelte` import as `any`, so a member access on a narrowed value
  // inside markup reads as unsafe.
  const viewState = $derived(demo.state);
  const description = $derived(describeState(viewState));
  const rows = $derived<AnswerRow[]>(
    viewState.kind === 'settled' ? answerRows(viewState.id, solutionsOf(viewState.result)) : [],
  );
  const serialized = $derived(
    viewState.kind === 'settled' && 'serialized' in viewState.result
      ? viewState.result.serialized
      : '',
  );
  const booted = $derived(viewState.kind !== 'booting' && viewState.kind !== 'boot-error');
  const engine = $derived(
    viewState.kind === 'booting' ? 'loading' : viewState.kind === 'boot-error' ? 'error' : 'ready',
  );
  const canRun = $derived(demo.selected !== null && booted && !description.busy);
  const showRetry = $derived(
    viewState.kind === 'boot-error' ||
      (viewState.kind === 'settled' && viewState.result.kind === 'error'),
  );
  const proofDocuments = $derived(
    new Set(
      demo.provenance.kind === 'ready'
        ? flattenProof(demo.provenance.steps).flatMap((step) =>
            step.document === undefined ? [] : [step.document],
          )
        : [],
    ),
  );

  const showInGraph = (focus: ProvenanceGraphFocus): void => {
    // A document focus is deliberately broader than a clause focus. Every graph
    // has a document node, while some compiled clauses create no visual entity.
    graphFocus = { document: focus.document };
    graphRegion?.scrollIntoView({ block: 'start' });
    graphRegion?.querySelector<HTMLButtonElement>('button')?.focus();
  };
</script>

<div class="site-shell">
  <header class="site-header">
    <a class="brand" href="#top" aria-label="CNL CKC demo home">
      <span class="brand-mark" aria-hidden="true">CNL</span>
      <span>Clinical Knowledge Compiler</span>
    </a>
    <nav aria-label="Page">
      <a href="#ask">Ask</a>
      <a href="#graph">Graph</a>
      <a href="#about">About</a>
    </nav>
    <ThemeToggle />
  </header>

  <main id="top" data-engine={engine}>
    <section class="hero" aria-labelledby="page-title">
      <p class="eyebrow">Executable guideline knowledge</p>
      <h1 id="page-title">{DESCRIPTIONS.wordmark}</h1>
      <p class="lede">{DESCRIPTIONS.lede}</p>
      <div class="source-note">
        <span aria-hidden="true">Source 01</span>
        <p>
          Compiled from the
          <a href={GUIDELINE.html} target="_blank" rel="noreferrer">{GUIDELINE.title}</a>. This
          demonstration is not clinical guidance.
        </p>
      </div>
    </section>

    <section id="ask" class="ask-card" aria-labelledby="ask-heading">
      <div class="section-heading">
        <p class="eyebrow">Live Prolog</p>
        <h2 id="ask-heading">Ask the compiled guideline</h2>
      </div>
      <p class="hint">{INSTRUCTIONS.selectQuestion} {INSTRUCTIONS.runQuestion}</p>

      <QuestionCombobox
        selected={demo.selected}
        onSelect={(id: QuestionId) => {
          demo.select(id);
        }}
      />

      <RunControls
        status={description.status}
        error={description.error}
        busy={description.busy}
        {canRun}
        {showRetry}
        onRun={() => {
          void demo.run();
        }}
        onCancel={() => {
          void demo.cancel();
        }}
        onRetry={() => {
          void demo.retry();
        }}
      />

      <!-- Always mounted: `aria-busy` has to be readable while the run is live, and a
           region that appears only at settle cannot announce its own replacement. -->
      <AnswerPanel
        {rows}
        {serialized}
        selectedIndex={demo.solutionIndex}
        busy={description.busy}
        summary={description.summary}
        provenance={demo.provenance}
        onSelect={(index: number) => {
          demo.selectSolution(index);
        }}
        onGraphFocus={showInGraph}
      />
    </section>

    <div id="graph" class="graph-region" bind:this={graphRegion}>
      <SemanticGraph
        focus={graphFocus}
        onSelect={(node: SemanticGraphNode) => {
          graphSelection = node;
        }}
      />
      {#if graphSelection?.document !== undefined}
        <p class="graph-selection-note">
          Selected from <code>{graphSelection.document}</code>.
          {#if proofDocuments.has(graphSelection.document)}
            <a href="#trace-heading">Compare with the current proof</a>.
          {:else}
            Run a prepared question above to compare the graph with a live proof.
          {/if}
        </p>
      {/if}
    </div>

    <div id="about">
      <AboutPanel documents={demo.contract?.documents} />
    </div>
  </main>

  <!-- CDC's reuse terms require attribution, a nonendorsement disclaimer that is
       prominently displayed, and a statement that the material is free at the
       source. A disclosure would satisfy none of those, so the footer carries
       all three unconditionally. -->
  <footer>
    <div>
      <p>{DESCRIPTIONS.attribution} {DESCRIPTIONS.freeAvailability}</p>
      <p>{DESCRIPTIONS.nonendorsement}</p>
    </div>
    <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
  </footer>
</div>

<style>
  .site-shell {
    min-height: 100vh;
  }

  .site-header {
    position: sticky;
    z-index: 20;
    top: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: clamp(0.5rem, 2vw, 1.5rem);
    align-items: center;
    width: min(100% - 2rem, 76rem);
    margin: 0 auto;
    border-bottom: 1px solid var(--border);
    padding: 0.65rem 0;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(14px);
  }

  .brand {
    display: flex;
    min-width: 0;
    gap: 0.65rem;
    align-items: center;
    color: var(--text);
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
  }

  .brand-mark {
    flex: none;
    border-radius: 0.25rem;
    padding: 0.18rem 0.35rem;
    background: var(--action);
    color: var(--action-text);
    font-family: var(--font-code);
    letter-spacing: 0.08em;
  }

  nav {
    display: flex;
    gap: clamp(0.55rem, 2vw, 1.25rem);
  }

  nav a,
  footer a,
  .source-note a {
    color: var(--action);
    text-underline-offset: 0.2em;
  }

  nav a {
    font-size: 0.82rem;
    font-weight: 650;
    text-decoration: none;
  }

  nav a:hover,
  nav a:focus-visible {
    text-decoration: underline;
  }

  main {
    width: min(100% - 2rem, 76rem);
    margin: 0 auto;
    padding: clamp(2.5rem, 7vw, 6.5rem) 0 3rem;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(14rem, 1fr);
    gap: clamp(1.5rem, 5vw, 5rem);
    align-items: end;
    margin-bottom: clamp(2.5rem, 7vw, 5rem);
  }

  .hero > .eyebrow,
  .hero > h1,
  .hero > .lede {
    grid-column: 1;
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    color: var(--action);
    font-family: var(--font-code);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-family: var(--font-prose);
    font-size: clamp(2.35rem, 7vw, 5.75rem);
    font-weight: 650;
    line-height: 0.98;
    letter-spacing: -0.045em;
    text-wrap: balance;
  }

  .lede {
    max-width: 47rem;
    margin: 1.25rem 0 0;
    font-family: var(--font-prose);
    font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  }

  .source-note {
    grid-row: 1 / span 3;
    grid-column: 2;
    border-top: 3px solid var(--action);
    padding-top: 0.75rem;
  }

  .source-note > span {
    display: block;
    margin-bottom: 0.45rem;
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .source-note p {
    margin: 0;
    font-family: var(--font-prose);
    font-size: 0.92rem;
  }

  .ask-card {
    max-width: 54rem;
    scroll-margin-top: 5rem;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    padding: clamp(1rem, 4vw, 2rem);
    background: var(--surface-raised);
    box-shadow: 0 1.5rem 4rem color-mix(in srgb, var(--text) 8%, transparent);
  }

  .section-heading h2 {
    margin: 0;
    font-family: var(--font-prose);
    font-size: clamp(1.45rem, 4vw, 2.25rem);
    line-height: 1.15;
  }

  .hint {
    margin: 0.65rem 0 1.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .graph-region {
    scroll-margin-top: 5rem;
  }

  .graph-selection-note {
    margin: 0.75rem 1rem 0;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .graph-selection-note code {
    font-family: var(--font-code);
  }

  #about {
    max-width: 54rem;
    scroll-margin-top: 5rem;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    width: min(100% - 2rem, 76rem);
    margin: 0 auto;
    border-top: 1px solid var(--border);
    padding: 1.25rem 0 2.5rem;
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  footer div {
    max-width: 59rem;
  }

  footer p {
    margin: 0 0 0.5rem;
  }

  footer > a {
    flex: none;
  }

  :global(a:focus-visible) {
    border-radius: 0.1rem;
    outline: 2px solid var(--focus-ring);
    outline-offset: 3px;
  }

  @media (max-width: 44rem) {
    .site-header {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .brand > span:last-child,
    nav {
      display: none;
    }

    .hero {
      grid-template-columns: 1fr;
    }

    .hero > .eyebrow,
    .hero > h1,
    .hero > .lede,
    .source-note {
      grid-row: auto;
      grid-column: 1;
    }

    .source-note {
      max-width: 30rem;
    }

    footer {
      display: block;
    }

    footer > a {
      display: inline-block;
      margin-top: 0.75rem;
    }
  }

  @media (max-width: 24rem) {
    main,
    .site-header,
    footer {
      width: min(100% - 1rem, 76rem);
    }

    h1 {
      font-size: clamp(2rem, 13vw, 3rem);
    }

    .ask-card {
      padding: 0.85rem;
    }
  }
</style>
