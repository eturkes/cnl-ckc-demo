<script lang="ts">
  import { tick } from 'svelte';
  import { indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState, type Rule } from '../../shared/data.js';
  import Flow from './Flow.svelte';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let search = $state('');
  let error = $state('');
  $effect(() => { const onHash = () => {state = readHash();}; addEventListener('hashchange', onHash); void loadGuideline().then(d => g = d).catch(e => error = String(e)); return () => removeEventListener('hashchange', onHash); });
  $effect(() => { if (!g && !error) return; void state; void tick().then(markReady); });
  const ix = $derived(g ? indexGuideline(g) : null);
  const key = $derived(state.view === 'rule' ? `${state.document}:${state.sentence}` : '');
  const focus = $derived(ix?.rules.get(key));
  const sentence = $derived(ix?.sentence(key));
  const doc = $derived(state.view === 'rule' ? ix?.docs.get(state.document) : undefined);
  const question = $derived(state.view === 'trace' ? g?.questions.find(q => q.id === state.question) : undefined);
  const results = $derived(state.view === 'explore' ? g?.documents.flatMap(d => d.sentences.filter(s => `${d.id} ${s.ace}`.toLowerCase().includes(state.query.toLowerCase())).map(s => ({d,s}))) ?? [] : []);
  const clean = (s: string) => s.replaceAll('-', ' ');
  const go = (next: HashState) => { state = next; writeHash(next); window.scrollTo(0,0); };
  const open = (document: string, sentence: number) => go({view:'rule',document,sentence});
  const neighbours = (r: Rule) => g?.rules.filter(other => other !== r && (other.actions.some(a => r.actions.some(b => a.verb === b.verb)) || (r.condition && other.condition?.split(' and ').some(c => r.condition?.split(' and ').includes(c))))) ?? [];
</script>

<main>
  <header><div class="brand">CNL / CKC <span>Graph studies</span></div><span class="prototype">Offline prototype</span></header>
  <div class="heading"><h1>Read the rule.</h1><p>From a condition to an action, with the source in reach.</p></div>
  <nav aria-label="Graph views">
    <button class:active={state.view === 'overview'} onclick={() => go({view:'overview'})}>All rules</button>
    <button class:active={state.view === 'trace'} onclick={() => go({view:'trace',question:'starting-opioid-therapy'})}>Trace an answer</button>
    <form onsubmit={e => {e.preventDefault();go({view:'explore',query:search});}}><label for="search">Explore text</label><div class="search"><input id="search" bind:value={search} placeholder="e.g. naloxone"/><button>Find</button></div></form>
  </nav>
  <p class="legend">Boxes hold conditions and actions. Circles hold modality. Arrows read from prerequisite to consequence, not as a patient assessment.</p>
  {#if error}<p role="alert">{error}</p>{:else if !g || !ix}<p>Loading the guideline…</p>{:else}
    <details class="guard"><summary><b>Scope guard</b> These recommendations do not apply under the recorded exclusions ({g.exclusions.length} records).</summary><p>Absence of an exclusion does not establish that a patient belongs to the guideline population.</p>{#each g.exclusions as exclusion}<p><button class="text" onclick={() => open(exclusion.document,exclusion.sentence)}>{exclusion.document}, sentence {exclusion.sentence}</button><br/>{exclusion.ace}</p>{/each}</details>
    {#if state.view === 'overview'}
      <div class="section-head"><h2>The guideline's {g.rules.length} rules</h2><span>{g.recommendations.length} recommendations</span></div>
      <p class="muted">Read across each worksheet. Open a rule for its full source and structurally related rules.</p>
      <div class="grid">{#each g.recommendations as rec}
        <section class="rec"><h3>Recommendation {rec.number}</h3><p class="grade">{rec.grade ? `Category ${rec.grade.category}, evidence type ${rec.grade.evidenceType}` : 'No grade recorded'} / page {rec.page}</p>
          {#each g.rules.filter(r => r.document === rec.id) as rule}<article><button class="rule-title" onclick={() => open(rule.document,rule.sentence)}>Sentence {rule.sentence} <span>Open worksheet</span></button><Flow {rule} compact/></article>{/each}
        </section>
      {/each}</div>
    {:else if state.view === 'rule'}
      {#if !doc || !sentence}<h2>Rule not found</h2><p>Choose a sentence from All rules or Explore text.</p>{:else}
        <div class="section-head"><h2>{doc.rec ? `Recommendation ${doc.rec}` : doc.section}: sentence {sentence.n}</h2><span>Page {doc.page}</span></div>
        <p class="muted">{focus ? 'Clinical rule parse from the exported knowledge base.' : 'Text reading of this sentence, not a clinical rule parse.'} Structure only; this worksheet does not run the rule.</p>
        <section class="worksheet"><Flow rule={focus} {sentence}/></section>
        <div class="source"><h3>Encoded sentence</h3><p>{sentence.ace}</p><details open><summary>Guideline source passage</summary><blockquote>{doc.source}</blockquote><a href={`${g.pdf}#page=${doc.page}`} target="_blank" rel="noreferrer">Read guideline page {doc.page}</a><p class="muted">{doc.id}, sentence {sentence.n}</p></details></div>
        {#if focus}<section><h3>Continue along shared structure</h3><p class="muted">Same action verb or exact condition phrase. These links do not claim clinical equivalence.</p><div class="neighbours">{#each neighbours(focus) as n}<button onclick={() => open(n.document,n.sentence)}>{n.document.replace('cdc2022-opioid-','')} / sentence {n.sentence}<span>{n.actions.map(a => `${a.polarity === 'negative' ? 'not ' : ''}${clean(a.verb)} ${clean(a.object)}`).join('; ')}</span></button>{:else}<p>No structural neighbours in the recommendation rules.</p>{/each}</div></section>{/if}
      {/if}
    {:else if state.view === 'trace'}
      {#if !question}<h2>Question not found</h2>{:else}
        <label for="question">Choose an answer to trace</label><select id="question" value={question.id} onchange={e => go({view:'trace',question:e.currentTarget.value})}>{#each g.questions as q}<option value={q.id}>{q.question}</option>{/each}</select>
        <h2>{question.question}</h2><p class="offline">{g.derivation}</p><p class="muted">{question.statements.length} statements in answer order. Open each worksheet to inspect its condition and action.</p>
        <ol class="trace">{#each question.statements as ref}{@const s = ix.sentence(`${ref.document}:${ref.sentence}`)}{@const d = ix.docs.get(ref.document)}<li><p>{s?.ace}</p><div class="trail"><button class="text" onclick={() => open(ref.document,ref.sentence)}>Inspect rule</button><span>{ref.document}, sentence {ref.sentence}</span><a href={`${g.pdf}#page=${d?.page}`} target="_blank" rel="noreferrer">Page {d?.page}</a></div><details><summary>Source passage</summary><blockquote>{d?.source}</blockquote></details></li>{/each}</ol>
      {/if}
    {:else if state.view === 'explore'}
      <h2>{results.length} sentences match “{state.query}”</h2><p class="muted">Search covers every exported document, not only the recommendation rules.</p>
      <div class="results">{#each results as {d,s}}<article><button class="text" onclick={() => open(d.id,s.n)}>{d.section}, sentence {s.n}</button><p>{s.ace}</p><small>{d.id} / page {d.page}</small></article>{:else}<p>No matching sentence. Try a term such as pain or naloxone.</p>{/each}</div>
    {/if}
    <details class="superseded"><summary>Superseded statements ({g.supersessions.length})</summary>{#each g.supersessions as s}<article><p><s>{s.ace}</s></p><p>Superseded {String(s.date).slice(0,4)}-{String(s.date).slice(4,6)}-{String(s.date).slice(6)} by <a href={s.url}>{s.citation}</a></p><button class="text" onclick={() => open(s.document,s.sentence)}>Read {s.document}, sentence {s.sentence}</button></article>{/each}</details>
    <footer><p>{g.derivation}</p><p>Content: Centers for Disease Control and Prevention. CDC does not endorse this prototype. Guideline material is free on the <a href="https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm">CDC website</a>.</p></footer>
  {/if}
</main>

<style>
  main{max-width:1240px;margin:auto;padding:24px 40px 48px}header{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:13px}.brand{font-weight:750}.brand span{font-weight:400;margin-left:18px;color:var(--text-muted)}.prototype{color:var(--warn)}h1{font-size:38px;line-height:1.1;letter-spacing:-1px;margin:0 0 8px}h2{font-size:24px;line-height:1.3}h3{font-size:18px;margin:0 0 6px}.heading{padding:36px 0 22px}.heading p{margin:0;color:var(--text-muted);font-size:18px}nav{display:flex;gap:8px;align-items:end;border-bottom:2px solid var(--text);padding-bottom:16px}button,input,select{color:var(--text);background:var(--surface-raised);border:1px solid var(--border);padding:9px 14px;border-radius:3px;max-width:100%}button{cursor:pointer}button.active{background:var(--text);color:var(--surface)}form{margin-left:auto}label{display:block;font-size:13px;margin-bottom:4px}.search{display:flex;gap:6px}input{width:215px;min-width:0}a,.text{color:var(--action)}a{overflow-wrap:anywhere}.text{padding:0;border:0;background:none;text-align:left;text-decoration:underline}.legend{font-size:13px;color:var(--text-muted);max-width:92ch}.guard{border:1px solid var(--border);border-left:5px solid var(--warn);padding:12px 16px;margin:18px 0 24px;background:var(--surface-raised)}summary{cursor:pointer}.guard summary{font-size:14px}.guard b{margin-right:10px}.guard p{max-width:78ch}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:center}.section-head h2{margin:12px 0}.section-head span,.muted,.grade,small{color:var(--text-muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.rec{background:var(--surface-sunken);padding:18px;min-width:0;border-top:3px solid var(--text-muted)}.grade{font-size:12px;margin:0 0 14px}.rec article{border-top:1px solid var(--border);padding-top:10px}.rule-title{display:flex;justify-content:space-between;gap:10px;width:100%;background:none;border:0;padding:0;text-align:left;font-weight:700}.rule-title span{font-size:12px;color:var(--action);font-weight:400}.worksheet{padding:0 24px;background:var(--surface-sunken);border:1px solid var(--border)}.source{margin:24px 0;padding-bottom:24px;border-bottom:1px solid var(--border)}.source>p,blockquote{max-width:78ch}blockquote{margin:14px 0;border-left:3px solid var(--border);padding-left:18px}.neighbours{display:grid;grid-template-columns:1fr 1fr;gap:10px}.neighbours button{text-align:left;font-size:13px}.neighbours span{display:block;font-size:15px;margin-top:6px}.offline{padding:12px 16px;background:var(--surface-sunken);border-left:4px solid var(--action)}select{width:100%}.trace{padding-left:30px}.trace li{padding:12px 18px 24px;border-bottom:1px solid var(--border)}.trace p{max-width:78ch}.trail{display:flex;gap:12px;flex-wrap:wrap;font-size:13px}.trail span{overflow-wrap:anywhere;color:var(--text-muted)}.trace details{margin-top:12px;font-size:14px}.results article{padding:20px 0;border-bottom:1px solid var(--border)}.results p{max-width:78ch}.superseded{margin:32px 0;border-top:1px solid var(--border);padding:16px 0}.superseded article{max-width:78ch}footer{font-size:12px;color:var(--text-muted);max-width:95ch}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--focus-ring);outline-offset:4px}p{overflow-wrap:anywhere}
  @media(max-width:900px){.grid{grid-template-columns:1fr}.neighbours{grid-template-columns:1fr}}
  @media(max-width:650px){main{padding:18px 16px 32px}.brand span{display:none}.heading{padding:28px 0 18px}h1{font-size:32px}.heading p{font-size:16px}nav{flex-wrap:wrap}nav>button{flex:1;font-size:14px;padding:9px}form{width:100%;margin:8px 0 0}.search input{width:100%}.search button{flex-shrink:0}.search{width:100%}.section-head{display:block}.section-head span{font-size:13px}.legend{font-size:12px}.guard{padding:10px 12px}.rec{padding:14px}.worksheet{padding:8px 14px}.trace{padding-left:24px}.trace li{padding-left:2px;padding-right:0}.trail{gap:8px}.trail span{width:100%}h2{font-size:22px}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
