<script lang="ts">
  import { EngineClient } from './engine/client.js';

  const guideline = 'CDC Clinical Practice Guideline for Prescribing Opioids for Pain (2022)';

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

  .status {
    border-top: 1px solid var(--rule);
    padding-top: 1rem;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }
</style>
