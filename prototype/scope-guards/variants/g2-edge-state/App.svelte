<script lang="ts">
  import SemanticGraph from './graph/SemanticGraph.svelte';
  import records from '../../generated/records.json';
  let focus = $state('entity:palliative-care');
  let focusRequest = $state(1);
  let dark = $state(new URLSearchParams(location.search).get('dark') === '1');
  let view = $state(new URLSearchParams(location.search).get('view') || 'palliative');
  const scenes = {
    palliative: { label: 'Palliative care', node:'entity:palliative-care', title:'A condition that excludes the guideline', help:'Exclusion conditions are not patient facts. Each relationship carries “excludes the guideline” as its outer scope.' },
    discharge: { label:'Discharge exception', node:'entity:pain-management-prescription', title:'The exception stays inside the exclusion', help:'Hospital care excludes the guideline only when receipt of a pain-management prescription at discharge is not provable. Read the nested “not provably” scope on those relationships.' },
    waiver: { label:'Prescribing waiver', node:'entity:buprenorphine-prescribing-waiver', title:'A superseded statement stays visible as history', help:'The waiver statements carry “superseded 2022-12-29”. Their date bound and the Act travel with their relationships, never as an active recommendation.' },
    age: { label:'Age bound', node:'entity:age', title:'The age condition keeps its bound', help:'The less-than-18-years condition belongs to the exclusion scope. It does not read as a current patient attribute.' },
  };
  const scene = $derived(scenes[view] || scenes.palliative);
  $effect(() => { document.documentElement.dataset.theme = dark ? 'dark':'light'; });
  $effect(() => { focus = scene.node; focusRequest = Object.keys(scenes).indexOf(view) + 1; });
  const relevant = $derived(records.exclusions.filter(r => view === 'palliative' ? r.ace.includes('palliative-care') : view === 'discharge' ? r.document.endsWith('s7-02') : view === 'age' ? r.document.endsWith('s10-04') : false));
</script>

<main>
  <header><div><p class="prototype-label">Scope and supersession / graph study</p><h1>Scope on the relationship</h1></div><button class="theme" onclick={() => dark = !dark}>{dark ? 'Light theme':'Dark theme'}</button></header>
  <p class="lead">Keep the concepts. Read where each relationship holds.</p>
  <nav aria-label="Example neighborhoods">
    {#each Object.entries(scenes) as [id, item]}<button aria-pressed={view === id} onclick={() => view = id}>{item.label}</button>{/each}
  </nav>
  <section class="scene-note"><h2>{scene.title}</h2><p>{scene.help}</p><p class="guard-note">Guarded recommendations show <span>Unless excluded</span> in the selected concept's relation list. The full network stays quiet.</p></section>
  <SemanticGraph {focus} {focusRequest} />
  <details class="records"><summary>Source records for this example</summary>
    <p>Static projection from the exported knowledge base. This is not a patient answer or a live inference.</p>
    {#if view === 'waiver'}
      {#each records.supersessions as r}<article><p>{r.ace}</p><small>{r.document}, sentence {r.sentence}</small><p>Superseded from 2022-12-29 by <a href={r.url}>{r.citation}</a>.</p></article>{/each}
    {:else}
      {#each relevant as r}<article><p>{r.ace}</p><small>{r.document}, sentence {r.sentence}</small></article>{/each}
    {/if}
  </details>
</main>
<style>
  main { max-width: 1200px; margin: auto; padding: 32px; }
  header { display:flex; justify-content:space-between; align-items:center; gap:16px; }
  h1 { font-size:2rem; letter-spacing:-.035em; margin:.2rem 0; }
  h2 { font-size:1.15rem; margin:0 0 .5rem; }
  p { max-width:76ch; }
  .prototype-label { font-size:.85rem; color:var(--text-muted); margin:0; }
  .lead { font-size:1.15rem; margin:12px 0 24px; }
  button { font:inherit; border:1px solid var(--border); border-radius:4px; padding:10px 16px; background:var(--surface-raised); color:var(--text); cursor:pointer; }
  button[aria-pressed='true'] { background:var(--action); color:var(--action-text); border-color:var(--action); }
  button:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  nav { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
  .scene-note { border-left:4px solid var(--action); padding:12px 20px; background:var(--surface-raised); margin-bottom:24px; }
  .scene-note p { margin:.4rem 0; }
  .guard-note { font-size:.85rem; color:var(--text-muted); }
  .guard-note span { border:1px solid var(--border); padding:1px 4px; color:var(--text); }
  .records { margin-top:24px; padding:16px; border:1px solid var(--border); }
  article { border-top:1px solid var(--border); padding:12px 0; }
  article small { overflow-wrap:anywhere; }
  @media(max-width:600px) { main { padding:18px 12px; } header { align-items:flex-start; } h1 { font-size:1.5rem; } .theme { padding:8px; font-size:.8rem; } .scene-note { padding:12px; } nav button { flex:1; min-width:40%; padding:10px; } }
</style>
