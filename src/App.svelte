<script lang="ts">
  import AnswerPanel from './demo/AnswerPanel.svelte';
  import { DemoController, solutionsOf } from './demo/DemoController.svelte.js';
  import { answerRows, describeState, type AnswerRow } from './demo/describe.js';
  import RunControls from './demo/RunControls.svelte';
  import type { QuestionId } from './questions/catalog.js';
  import QuestionCombobox from './questions/QuestionCombobox.svelte';

  interface Props {
    /** Injected by tests; the shipped app lets `App` build and own the default. */
    controller?: DemoController;
  }

  let { controller }: Props = $props();

  const guideline = 'CDC Clinical Practice Guideline for Prescribing Opioids for Pain (2022)';

  // The controller is an ownership handoff read once at construction, not a
  // reactive input: swapping it mid-life would strand the engine it owns.
  // svelte-ignore state_referenced_locally
  const injected = controller;
  const demo = injected ?? new DemoController();

  $effect(() => () => {
    if (injected === undefined) demo.dispose();
  });

  // Everything below is derived in the script rather than the template: ESLint
  // types a `.svelte` import as `any`, so a member access on a narrowed value
  // inside markup reads as unsafe.
  const state = $derived(demo.state);
  const description = $derived(describeState(state));
  const rows = $derived<AnswerRow[]>(
    state.kind === 'settled' ? answerRows(state.id, solutionsOf(state.result)) : [],
  );
  const serialized = $derived(
    state.kind === 'settled' && 'serialized' in state.result ? state.result.serialized : '',
  );
  const booted = $derived(state.kind !== 'booting' && state.kind !== 'boot-error');
  const engine = $derived(
    state.kind === 'booting' ? 'loading' : state.kind === 'boot-error' ? 'error' : 'ready',
  );
  const canRun = $derived(demo.selected !== null && booted && !description.busy);
  const showRetry = $derived(state.kind === 'settled' && state.result.kind === 'error');
</script>

<main data-engine={engine}>
  <h1>cnl-ckc-demo</h1>
  <p class="lede">
    Ask a question against a compiled clinical knowledge base. Every answer comes from real Prolog
    execution, and traces back to the guideline sentence that produced it.
  </p>

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
    onSelect={(index: number) => {
      demo.selectSolution(index);
    }}
  />

  <p class="colophon">
    Knowledge base compiled from {guideline}. Proof traces and the entity graph arrive with their
    milestones.
  </p>
</main>

<style>
  main {
    max-width: 46rem;
    margin: 0 auto;
    padding: 4rem 1.5rem;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-family: var(--font-code);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--accent);
  }

  .lede {
    font-family: var(--font-prose);
    font-size: 1.2rem;
    margin: 0 0 2rem;
  }

  .colophon {
    border-top: 1px solid var(--rule);
    margin-top: 2rem;
    padding-top: 1rem;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }
</style>
