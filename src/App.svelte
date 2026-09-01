<script lang="ts">
  import { EngineClient } from './engine/client.js';
  import { QUESTION_CATALOG, type QuestionId } from './questions/catalog.js';
  import QuestionCombobox from './questions/QuestionCombobox.svelte';

  const guideline = 'CDC Clinical Practice Guideline for Prescribing Opioids for Pain (2022)';

  // u5 holds the selection here; u6 moves it into the run controller that turns a
  // selection into a live query.
  let selected = $state<QuestionId | null>(null);
  // Derived in the script because ESLint types a `.svelte` import as `any`, so a
  // member access on a narrowed value inside the template reads as unsafe.
  const goal = $derived(selected === null ? '' : QUESTION_CATALOG[selected].goal);

  // u2 ships the engine spine only: boot the worker and report what the engine
  // itself says. The question catalog, run controls and answer views arrive with
  // u4 and u5.
  const boot = async (): Promise<string> => {
    const client = new EngineClient();
    const result = await client.boot();
    if (result.kind === 'error') throw new Error(result.error.message);
    return `${result.contract.documents} compiled documents at schema ${result.contract.schemaVersion}`;
  };

  const booting = boot();
</script>

<main>
  <h1>cnl-ckc-demo</h1>
  <p class="lede">
    Ask a question against a compiled clinical knowledge base. Every answer comes from real Prolog
    execution, and traces back to the guideline sentence that produced it.
  </p>
  <QuestionCombobox
    {selected}
    onSelect={(id: QuestionId) => {
      selected = id;
    }}
  />
  <p class="picked">
    {#if selected === null}
      Pick one of the six built-in questions.
    {:else}
      Selected goal: <code>{goal}</code>. Running it arrives with the next unit.
    {/if}
  </p>
  <p class="status">
    {#await booting}
      <span data-engine="loading">Starting the Prolog engine.</span>
    {:then summary}
      <span data-engine="ready">
        Knowledge base: <strong>{summary}</strong> from {guideline}. Query interface, proof traces
        and the entity graph arrive with their milestones.
      </span>
    {:catch error}
      <span data-engine="error">The Prolog engine did not start. {error.message}</span>
    {/await}
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

  .picked {
    margin: 1rem 0 2rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }

  .status {
    border-top: 1px solid var(--rule);
    padding-top: 1rem;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }
</style>
