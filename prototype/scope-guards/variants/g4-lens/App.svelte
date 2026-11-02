<script lang="ts">
 import SemanticGraph from './graph/SemanticGraph.svelte';
 let dark=$state(false);
 const focus = new URLSearchParams(location.search).get('focus') ?? 'palliative-care';
 $effect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';});
</script>
<main>
 <div class="prototype-heading"><div><span>CNL / CKC</span><h1>Scope limits in the knowledge graph</h1><p>G4 · Scope-limits lens · development prototype</p></div><button onclick={()=>dark=!dark}>{dark?'Light theme':'Dark theme'}</button></div>
 <SemanticGraph {focus} focusRequest={1}/>
</main>
<style>
 main{max-width:1200px;margin:auto;padding:24px;} .prototype-heading{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-bottom:26px;} h1{font-family:var(--font-heading);font-size:1.6rem;margin:10px 0;}p{color:var(--text-muted);} button{white-space:nowrap;}@media(max-width:500px){main{padding:12px;}.prototype-heading{flex-wrap:wrap;}}
</style>
