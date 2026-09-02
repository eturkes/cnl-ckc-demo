<script lang="ts">
  import AboutPanel from './demo/AboutPanel.svelte';
  import AnswerPanel from './demo/AnswerPanel.svelte';
  import { DESCRIPTIONS, INSTRUCTIONS } from './demo/copy.js';
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
  <h1>{DESCRIPTIONS.wordmark}</h1>
  <p class="lede">{DESCRIPTIONS.lede}</p>
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
    onSelect={(index: number) => {
      demo.selectSolution(index);
    }}
  />

  <AboutPanel documents={demo.contract?.documents} />

  <!-- CDC's reuse terms require attribution, a nonendorsement disclaimer that is
       prominently displayed, and a statement that the material is free at the
       source. A disclosure would satisfy none of those, so the footer carries
       all three unconditionally. -->
  <footer>
    <p>{DESCRIPTIONS.attribution} {DESCRIPTIONS.freeAvailability}</p>
    <p>{DESCRIPTIONS.nonendorsement}</p>
  </footer>
</main>

<style>
  /* Padding scales with the viewport: a fixed 4rem top inset spends a third of a
     320px-tall phone viewport before the first word. */
  main {
    max-width: 46rem;
    margin: 0 auto;
    padding: clamp(1.5rem, 6vw, 4rem) clamp(1rem, 4vw, 1.5rem);
  }

  h1 {
    margin: 0 0 0.5rem;
    font-family: var(--font-ui);
    font-size: clamp(1.25rem, 4.5vw, 1.75rem);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.01em;
    text-wrap: balance;
    color: var(--action);
  }

  .lede {
    font-family: var(--font-prose);
    font-size: clamp(1.05rem, 2.5vw, 1.2rem);
    margin: 0 0 1rem;
  }

  .hint {
    margin: 0 0 2rem;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  footer {
    border-top: 1px solid var(--border);
    margin-top: 2rem;
    padding-top: 1rem;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  footer p {
    margin: 0 0 0.5rem;
  }
</style>
