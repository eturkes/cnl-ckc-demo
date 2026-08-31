<script lang="ts">
  const kb = {
    documents: 337,
    guideline: 'CDC Clinical Practice Guideline for Prescribing Opioids for Pain (2022)',
  };
</script>

<main>
  <h1>cnl-ckc-demo</h1>
  <p class="lede">
    Ask a question against a compiled clinical knowledge base. Every answer comes from real Prolog
    execution, and traces back to the guideline sentence that produced it.
  </p>
  <p class="status">
    Knowledge base: <strong>{kb.documents}</strong> compiled documents from {kb.guideline}. Query
    interface, proof traces and the entity graph arrive with their milestones.
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
