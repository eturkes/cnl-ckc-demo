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
  import { QUESTION_CATALOG, type QuestionId } from './questions/catalog.js';
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
  const activeQuestion = $derived(
    viewState.kind === 'running' || viewState.kind === 'cancelling' || viewState.kind === 'settled'
      ? QUESTION_CATALOG[viewState.id].question
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
    <div class="header-inner">
      <a class="brand" href="#top" aria-label="CNL CKC demo home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>CNL / CKC</span>
      </a>
      <nav aria-label="Page">
        <a href="#ask">Query</a>
        <a href="#graph">Graph</a>
        <a href="#about">Notes</a>
      </nav>
      <ThemeToggle />
    </div>
  </header>

  <main id="top" data-engine={engine}>
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <p class="eyebrow">Controlled language · Prolog · WebAssembly</p>
        <h1 id="page-title">{DESCRIPTIONS.wordmark}</h1>
        <p class="lede">{DESCRIPTIONS.lede}</p>
      </div>
      <div class="source-note">
        <span>Source material</span>
        <a href={GUIDELINE.html} target="_blank" rel="noreferrer">{GUIDELINE.title}</a>
        <p>Research prototype. Not clinical guidance.</p>
      </div>
    </section>

    <section id="ask" class="workbench" aria-labelledby="ask-heading">
      <header class="section-heading">
        <div>
          <p class="eyebrow">Query</p>
          <h2 id="ask-heading">Ask the compiled guideline</h2>
        </div>
        <p>{INSTRUCTIONS.selectQuestion} {INSTRUCTIONS.runQuestion}</p>
      </header>

      <div class="query-area">
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
      </div>

      <!-- Always mounted: `aria-busy` has to be readable while the run is live, and a
           region that appears only at settle cannot announce its own replacement. -->
      <AnswerPanel
        {rows}
        {serialized}
        question={activeQuestion}
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
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface-raised) 96%, transparent);
    backdrop-filter: blur(10px);
  }

  .header-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: clamp(1rem, 3vw, 2rem);
    align-items: center;
    width: min(100% - 3rem, 72rem);
    min-height: 3.75rem;
    margin: 0 auto;
  }

  .brand {
    display: flex;
    min-width: 0;
    gap: 0.7rem;
    align-items: center;
    color: var(--text);
    font-family: var(--font-code);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-decoration: none;
  }

  .brand-mark {
    display: grid;
    grid-template-columns: repeat(3, 0.3rem);
    gap: 0.18rem;
  }

  .brand-mark i {
    display: block;
    width: 0.3rem;
    height: 1rem;
    background: var(--action);
  }

  .brand-mark i:nth-child(2) {
    opacity: 0.65;
  }

  .brand-mark i:nth-child(3) {
    opacity: 0.3;
  }

  nav {
    display: flex;
    gap: 1.5rem;
  }

  nav a,
  footer a,
  .source-note a {
    color: var(--action);
    text-underline-offset: 0.2em;
  }

  nav a {
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
  }

  nav a:hover,
  nav a:focus-visible {
    text-decoration: underline;
  }

  main {
    width: min(100% - 3rem, 72rem);
    margin: 0 auto;
    padding: clamp(2.75rem, 6vw, 4rem) 0 4rem;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(14rem, 19rem);
    gap: clamp(2.5rem, 7vw, 7rem);
    align-items: start;
    margin-bottom: clamp(3.25rem, 6vw, 4rem);
  }

  .eyebrow {
    margin: 0 0 0.8rem;
    color: var(--action);
    font-family: var(--font-code);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    max-width: 44rem;
    font-size: clamp(2.4rem, 5vw, 3.75rem);
    font-weight: 650;
    line-height: 1.02;
    letter-spacing: -0.04em;
    text-wrap: balance;
  }

  .lede {
    max-width: 43rem;
    margin: 1.4rem 0 0;
    color: var(--text-muted);
    font-size: clamp(1rem, 1.8vw, 1.17rem);
    line-height: 1.6;
  }

  .source-note {
    margin-top: 1.55rem;
    border-left: 1px solid var(--border);
    padding-left: 1.25rem;
  }

  .source-note span {
    display: block;
    margin-bottom: 0.6rem;
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.67rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .source-note > a {
    display: inline;
    color: var(--text);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.45;
  }

  .source-note p {
    margin: 0.8rem 0 0;
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .workbench {
    scroll-margin-top: 5rem;
    border: 1px solid var(--border);
    background: var(--surface-raised);
  }

  .section-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(15rem, 26rem);
    gap: 2rem;
    align-items: end;
    border-bottom: 1px solid var(--border);
    padding: clamp(1.25rem, 3vw, 2rem);
    background: var(--surface-sunken);
  }

  .section-heading h2 {
    margin: 0;
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: -0.025em;
  }

  .section-heading > p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.86rem;
  }

  .query-area {
    padding: clamp(1.25rem, 3vw, 2rem);
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
    scroll-margin-top: 5rem;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    width: min(100% - 3rem, 72rem);
    margin: 0 auto;
    border-top: 1px solid var(--border);
    padding: 1.5rem 0 3rem;
    color: var(--text-muted);
    font-size: 0.76rem;
    line-height: 1.5;
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
    .header-inner {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    nav {
      display: none;
    }

    .hero {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .source-note {
      max-width: 32rem;
      margin-top: 0;
    }

    .section-heading {
      grid-template-columns: 1fr;
      gap: 0.75rem;
      align-items: start;
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
    .header-inner,
    footer {
      width: min(100% - 1.5rem, 72rem);
    }

    h1 {
      font-size: clamp(2rem, 11vw, 2.75rem);
    }
  }
</style>
