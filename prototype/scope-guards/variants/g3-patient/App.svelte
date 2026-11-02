<script lang="ts">
  import SemanticGraph from './graph/SemanticGraph.svelte';
  import { graphUrl, records } from './project.js';
  let focus = $state('entity:patient');
  let focusRequest = $state(1);
  let dark = $state(false);
  let selected = $state('patient');
  const choices = [ ['patient', 'entity:patient'], ['palliative care', 'entity:palliative-care'], ['waiver statements', 'entity:buprenorphine-prescribing-waiver'] ];
  $effect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; });
  function choose(id: string) { focus = id; selected = id.replace('entity:', ''); focusRequest++; }
</script>

<main>
  <header><div><p>Scope-guard prototype / G3</p><h1>When recommendations do not apply</h1></div><button onclick={() => dark = !dark}>{dark ? 'Light theme' : 'Dark theme'}</button></header>
  <p class="intro">Read applicability from the patient’s side. Conditions qualify the negated relationship; they do not assert facts about a patient.</p>
  <nav aria-label="Example neighborhoods">{#each choices as [label, id]}<button class:active={focus === id} onclick={() => choose(id)}>{label}</button>{/each}</nav>
  <div class="reading"><strong>Scope lens</strong><span>Dashed edges carry negation. “When” links name the condition, not an observed patient fact.</span></div>
  <SemanticGraph {graphUrl} {focus} {focusRequest} onSelect={(n) => selected = n.label}/>
  <section class="sources"><h2>Source conditions for {selected.replaceAll('-', ' ')}</h2>
  <p>Static graph projection from the exported bag. These are rule conditions, not answers or patient assessments.</p>
  {#each records.exclusions.filter(r => selected === 'patient' || selected === 'recommendation' || r.ace.includes(selected)) as r}<details><summary>{r.document}, sentence {r.sentence}</summary><p>{r.ace}</p></details>{/each}
  {#if selected.includes('waiver') || selected.includes('obtain') || selected.includes('Act') || selected.includes('evaluation')}
    {#each records.supersessions as r}<details open><summary>Superseded statement {r.sentence}: {r.document}</summary><p>{r.ace}</p><p>Historical derivation requires an evaluation date before {r.date}. Superseded from {r.date}.</p><a href={r.url} target="_blank" rel="noreferrer">{r.citation}</a></details>{/each}
  {/if}
  </section>
</main>

<style>
  main { max-width: 1200px; padding: 28px 24px; margin: auto; }
  header { display:flex; gap:20px; align-items:center; justify-content:space-between; }
  header p { color:var(--text-muted); margin:0 0 6px; }
  h1 { font-size:1.9rem; margin:0; line-height:1.2; }
  h2 { font-size:1.25rem; }
  p { max-width:76ch; }
  .intro { margin:18px 0; color:var(--text-muted); }
  nav { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
  button { border:1px solid var(--border); background:var(--surface-raised); color:var(--text); padding:9px 14px; cursor:pointer; border-radius:5px; font:inherit; }
  button.active { background:var(--action); color:var(--action-text); border-color:var(--action); }
  button:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  .reading { display:flex; gap:14px; padding:12px 0; border-block:1px solid var(--border); margin-bottom:18px; }
  .reading strong { white-space:nowrap; }
  .sources { margin-top:28px; padding-top:12px; border-top:1px solid var(--border); overflow-wrap:anywhere; }
  details { padding:12px 0; border-bottom:1px solid var(--border); }
  summary { cursor:pointer; }
  a { color:var(--action); }
  @media (max-width:600px) { main { padding:18px 12px; } header { align-items:flex-start; } h1 { font-size:1.4rem; } header button { padding:7px; font-size:.85rem; } .reading { flex-direction:column; gap:5px; } }
</style>
