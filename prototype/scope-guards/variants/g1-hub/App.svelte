<script lang="ts">
  import SemanticGraph from './graph/SemanticGraph.svelte';
  import { HUB } from './augment.js';
  let dark = $state(new URLSearchParams(location.search).get('theme') === 'dark');
  let focus = $state(new URLSearchParams(location.search).get('focus') || HUB);
  let request = $state(1);
  $effect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; });
  function select(id: string) { focus = id; request++; }
</script>

<main>
  <header><div><p class="prototype">Graph study G1</p><h1>Guideline scope</h1></div><button onclick={() => dark = !dark}>{dark ? 'Light theme' : 'Dark theme'}</button></header>
  <p class="intro">Follow the conditions that exclude a patient from the recommendations. The superseded waiver statements point to the Act that replaced them.</p>
  <nav aria-label="Graph starting points">
    <button onclick={() => select(HUB)}>Guideline hub</button>
    <button onclick={() => select('scope-event:1:obtain')}>Waiver statement</button>
    <button onclick={() => select('exclusion-concept:palliative care')}>Palliative care</button>
  </nav>
  <aside>Conditions are not patient facts. “Not” on an exception means the prescription cannot be proved. A superseded statement remains visible as historical guidance, with its evaluation-date condition.</aside>
  <SemanticGraph focus={focus} focusRequest={request} />
  <footer>Prototype projection of the exported knowledge base. CDC material is free at cdc.gov. This study is not endorsed by CDC and is not for clinical use.</footer>
</main>

<style>
  main { max-width:1200px; margin:auto; padding:24px; }
  header {display:flex;align-items:center;justify-content:space-between;gap:16px;}
  h1 {font-size:1.75rem;margin:0;}
  .prototype {color:var(--text-muted);margin:0 0 4px;}
  .intro {max-width:72ch;}
  nav {display:flex;flex-wrap:wrap;gap:8px;margin:20px 0;}
  aside {border-left:3px solid var(--action);padding:10px 16px;background:var(--surface-raised);margin:16px 0;max-width:76ch;}
  footer {margin-top:24px;color:var(--text-muted);max-width:76ch;font-size:.875rem;}
  @media(max-width:600px){main{padding:16px;}header{align-items:flex-start;}header button{max-width:110px;}}
</style>
