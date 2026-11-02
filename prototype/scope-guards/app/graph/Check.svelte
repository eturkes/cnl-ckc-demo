<script lang="ts">
  import SemanticGraph from './SemanticGraph.svelte';
  import { HUB } from './project.js';
  const params = new URLSearchParams(location.search);
  let dark = $state(params.get('theme') === 'dark');
  let focus = $state(params.get('focus') || HUB);
  let request = $state(1);
  $effect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; });
  function select(id: string) { focus = id; request++; }
</script>
<main>
  <header><h1>Guideline scope</h1><button onclick={() => dark = !dark}>{dark ? 'Light theme' : 'Dark theme'}</button></header>
  <p>Exclusion conditions point to the shared guideline. Their relationships carry the exclusion scope. Historical waiver actions point to the superseding Act.</p>
  <nav aria-label="Starting points">
    <button onclick={() => select(HUB)}>Guideline hub</button>
    <button onclick={() => select('entity:palliative-care')}>Palliative care</button>
    <button onclick={() => select('superseded:1:obtain')}>Waiver statement</button>
    <button onclick={() => select('event:reassess')}>Recommendation action</button>
    <button onclick={() => select('entity:pain-management-prescription')}>Discharge exception</button>
  </nav>
  <SemanticGraph {focus} focusRequest={request} />
</main>
<style>
  main {max-width:1200px; margin:auto; padding:24px;}
  header {display:flex; align-items:center; justify-content:space-between; gap:16px;}
  h1 {font-size:1.75rem;}
  p {max-width:75ch;}
  nav {display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px;}
  @media(max-width:600px) {main {padding:16px;}}
</style>
