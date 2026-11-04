<script lang="ts">
  // Template: copy to variants/<id>/, keep main.ts + the harness calls, replace the rest.
  import { indexGuideline, loadGuideline, markReady, readHash, type Guideline, type HashState } from '../../shared/data.js';

  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());

  $effect(() => {
    const onHash = () => (state = readHash());
    addEventListener('hashchange', onHash);
    void loadGuideline().then((data) => (g = data));
    return () => removeEventListener('hashchange', onHash);
  });

  $effect(() => {
    if (g === null) return;
    void state;
    queueMicrotask(markReady);
  });

  const ix = $derived(g === null ? null : indexGuideline(g));
</script>

<main class="page">
  {#if g === null || ix === null}
    <p>Loading the guideline…</p>
  {:else}
    <h1>Template</h1>
    <p>{g.counts.recommendations} recommendations · {g.counts.documents} documents · state {state.view}</p>
  {/if}
</main>
