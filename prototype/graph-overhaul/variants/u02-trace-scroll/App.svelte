<script lang="ts">
  import { tick } from 'svelte';
  import { AREAS, indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState, type Doc } from '../../shared/data.js';
  import PageCrop from './PageCrop.svelte';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let query = $state('');
  let error = $state('');
  let expanded = $state<Record<number, boolean>>({0:true});
  const ix = $derived(g ? indexGuideline(g) : null);
  const question = $derived(g && state.view === 'trace' ? g.questions.find(q => q.id === state.question) : undefined);
  const ruleDoc = $derived(ix && state.view === 'rule' ? ix.docs.get(state.document) : undefined);
  const ruleSentence = $derived(ruleDoc && state.view === 'rule' ? ruleDoc.sentences.find(s => s.n === state.sentence) : undefined);
  const rule = $derived(ix && state.view === 'rule' ? ix.rules.get(`${state.document}:${state.sentence}`) : undefined);
  const matches = $derived(g && state.view === 'explore' ? g.documents.filter(d => `${d.source} ${d.sentences.map(s => s.ace).join(' ')} ${d.id}`.toLowerCase().includes(state.query.toLowerCase())) : []);
  function go(next: HashState) { state = next; writeHash(next); window.scrollTo({top:0}); }
  function related(rec: number) {
    if (!g) return [];
    const id = g.recommendations.find(r => r.number === rec)?.id;
    const counts = new Map<number, {count:number; label:string}>();
    for (const c of g.concepts) {
      if (!c.mentions.some(m => m.startsWith(`${id}:`)) || /^(patient|clinician|have|be|recommendation|opioid-therapy)$/.test(c.label)) continue;
      const families = new Set(c.mentions.map(m => ix?.docs.get(m.slice(0,m.lastIndexOf(':')))?.rec).filter((n): n is number => n != null && n !== rec));
      for (const n of families) { const old = counts.get(n); counts.set(n,{count:(old?.count ?? 0)+1,label:!old || (c.label.includes('-') && !old.label.includes('-')) ? c.label : old.label}); }
    }
    return [...counts].sort((a,b)=>b[1].count-a[1].count).slice(0,3);
  }
  $effect(() => {
    const onHash = () => { state = readHash(); query = state.view === 'explore' ? state.query : ''; };
    addEventListener('hashchange',onHash);
    void loadGuideline().then(v => { g=v; onHash(); }).catch(e => {error=String(e); markReady();});
    return () => removeEventListener('hashchange',onHash);
  });
  $effect(() => { if (!g) return; void state; void tick().then(markReady); });
</script>

<svelte:head><title>Follow the evidence | Trace scroll</title></svelte:head>
<header>
  <a class="brand" href="#overview" onclick={(e)=>{e.preventDefault();go({view:'overview'});}}>CNL / CKC <span>Evidence scroll</span></a>
  <nav aria-label="Views"><button class:active={state.view==='overview'} onclick={()=>go({view:'overview'})}>The guideline</button><button class:active={state.view==='trace'} onclick={()=>g && go({view:'trace',question:g.questions[1].id})}>Trace an answer</button><button class:active={state.view==='explore'} onclick={()=>go({view:'explore',query:''})}>Explore</button></nav>
</header>
<main>
  {#if error}<h1>The guideline could not load</h1><p>{error}</p>
  {:else if !g || !ix}<h1>Opening the evidence scroll…</h1>
  {:else}
    <div class="intro"><p class="edition">CDC opioid prescribing guideline, 2022</p><h1>{state.view==='overview'?'Follow the evidence.':state.view==='trace'?'An answer, unrolled.':state.view==='rule'?'Read the rule in context.':'Find a thread.'}</h1><p class="lede">Read down from a statement to the words that support it. No canvas. No hidden trail.</p></div>
    <aside class="notice">Prototype. {g.derivation}</aside>
    <p class="legend"><span class="sample" aria-hidden="true"></span>Nodes are readable evidence blocks. Solid threads connect statement, sentence, passage and page. Margin links mean shared concepts, not inference.</p>
    {#if state.view==='overview'}
      <section class="overview-title"><h2>The shape of the guideline</h2><p>{g.recommendations.length} recommendations in four clinical areas. Follow a margin thread to related reading, or open a sentence to inspect its logic.</p></section>
      {#each AREAS as area}<section class="area"><h2>{area.label}</h2>
        {#each g.recommendations.filter(r=>area.recs.includes(r.number as never)) as rec}
          <article class="rec" id={`rec-${rec.number}`}><aside class="margin"><strong>Recommendation {rec.number}</strong><span>Page {rec.page}</span>{#if rec.grade}<span>Category {rec.grade.category}<br/>Evidence type {rec.grade.evidenceType}</span>{/if}<div class="related"><small>Shared-concept threads</small>{#each related(rec.number) as [n, v]}<a href={`#rec-${n}`} title={`${v.count} shared concepts`}>Rec. {n}: {v.label.replaceAll('-',' ')}</a>{/each}</div></aside><div class="recbody"><p class="source">{rec.source}</p><details><summary>Read the {ix.docs.get(rec.id)?.sentences.length} encoded sentences</summary>{#each ix.docs.get(rec.id)?.sentences ?? [] as s}<a class="sentence-link" href={`#rule=${rec.id}:${s.n}`} onclick={(e)=>{e.preventDefault();go({view:'rule',document:rec.id,sentence:s.n});}}>Sentence {s.n}: {s.ace}</a>{/each}</details><p class="doccount">{rec.implementation.length} implementation documents; {rec.supporting.length} supporting documents</p></div></article>
        {/each}
      </section>{/each}
    {:else if state.view==='trace'}
      <label class="question-picker">Choose the answer<select value={state.question} onchange={(e)=>go({view:'trace',question:e.currentTarget.value})}>{#each g.questions as q}<option value={q.id}>{q.question}</option>{/each}</select></label>
      {#if !question}<h2>Question not found</h2><p>Select a question above.</p>{:else}<h2 class="question">{question.question}</h2><p>{question.statements.length} statements, in answer order. Open each source thread as you read.</p>
        <div class="reading-spine">{#each question.statements as ref, i}
          {@const doc=ix.docs.get(ref.document)}{@const sentence=ix.sentence(`${ref.document}:${ref.sentence}`)}
          {#if doc && sentence}<article class="statement"><div class="stage">Statement {i+1}</div><p class="answer">{sentence.ace}</p><a href={`#rule=${doc.id}:${sentence.n}`} onclick={(e)=>{e.preventDefault();go({view:'rule',document:doc.id,sentence:sentence.n});}}>Inspect sentence {sentence.n} and its rule</a><details class="evidence" open={expanded[i] ?? false} ontoggle={(e)=>{expanded[i]=e.currentTarget.open;}}><summary>Follow to the source</summary><div class="step"><span class="stage">Encoded sentence</span><p>{doc.id}, sentence {sentence.n}</p><p>{sentence.ace}</p></div><div class="step"><span class="stage">Guideline passage</span><blockquote>{doc.source}</blockquote><p>{doc.section}, page {doc.page}</p>{#if expanded[i]}{#key doc.id}<PageCrop url={g.pdf} page={doc.page} source={doc.source}/>{/key}{/if}</div></details></article>{/if}
        {/each}</div>
      {/if}
    {:else if state.view==='rule'}
      {#if !ruleDoc || !ruleSentence}<h2>Sentence not found</h2><p>Use Explore to select a document sentence.</p>{:else}<div class="reading-spine"><article class="statement"><div class="stage">{ruleDoc.id}, sentence {ruleSentence.n}</div><p class="answer">{ruleSentence.ace}</p><div class="step"><h2>{rule?'Clinical rule structure':'Text reading, not a parsed clinical rule'}</h2>{#if rule}<dl><dt>Condition</dt><dd>{rule.condition ?? 'No explicit condition in this rule.'}</dd><dt>Actor</dt><dd>{rule.subject}</dd><dt>Modality</dt><dd>{rule.mode}</dd><dt>Actions</dt><dd>{#each rule.actions as action}<p><strong>{action.polarity==='negative'?'NOT ':''}{action.verb}</strong> {action.object}{#each action.modifiers as mod} {mod.preposition} {mod.value}{/each}</p>{/each}</dd></dl>{:else}<dl><dt>Condition</dt><dd>{ruleSentence.condition ?? 'No explicit condition found by the text heuristic.'}</dd><dt>Conclusion</dt><dd>{ruleSentence.conclusion}</dd><dt>Modal / negation</dt><dd>{ruleSentence.modal} / {ruleSentence.negated?'negated':'not negated'}</dd></dl>{/if}</div><div class="step"><h2>The guideline's own words</h2><blockquote>{ruleDoc.source}</blockquote><p>{ruleDoc.section}, page {ruleDoc.page}</p>{#key ruleDoc.id}<PageCrop url={g.pdf} page={ruleDoc.page} source={ruleDoc.source}/>{/key}</div><div class="step"><h3>Continue through this document</h3><div class="siblings">{#each ruleDoc.sentences as s}<button class:active={s.n===ruleSentence.n} onclick={()=>go({view:'rule',document:ruleDoc.id,sentence:s.n})}>Sentence {s.n}</button>{/each}</div></div></article></div>{/if}
    {:else}
      <form onsubmit={(e)=>{e.preventDefault();go({view:'explore',query});}}><label for="search">Search the guideline's documents and encoded sentences</label><div class="search"><input id="search" bind:value={query} placeholder="Try naloxone or opioid therapy"/><button type="submit">Find passages</button></div></form><h2>{matches.length} matching documents</h2><p>Search is a text match, not a clinical answer.</p><div class="reading-spine">{#each matches as doc}<article class="statement"><div class="stage">{doc.kind}, page {doc.page}</div><h3>{doc.section}</h3><p>{doc.source}</p><details><summary>Inspect the encoded sentences</summary>{#each doc.sentences as s}<a class="sentence-link" href={`#rule=${doc.id}:${s.n}`} onclick={(e)=>{e.preventDefault();go({view:'rule',document:doc.id,sentence:s.n});}}>Sentence {s.n}: {s.ace}</a>{/each}</details></article>{/each}</div>
    {/if}
    <section class="boundaries"><h2>Where this guideline stops</h2><p>The recommendations do not apply under the recorded exclusions. The absence of an exclusion does not establish that a patient is in scope.</p><details><summary>Read all {g.exclusions.length} scope-exclusion records</summary>{#each g.exclusions as ex}<div class="boundary"><p>{ex.ace}</p><a href={`#rule=${ex.document}:${ex.sentence}`} onclick={(e)=>{e.preventDefault();go({view:'rule',document:ex.document,sentence:ex.sentence});}}>{ex.document}, sentence {ex.sentence}</a></div>{/each}</details><h2>Statements with a superseding source</h2>{#each g.supersessions as s}<div class="boundary"><p><s>{s.ace}</s></p><p>Superseded {String(s.date).slice(0,4)}-{String(s.date).slice(4,6)}-{String(s.date).slice(6,8)} by <a href={s.url} target="_blank" rel="noreferrer">{s.citation}</a></p></div>{/each}</section>
    <footer>Content developed by the Centers for Disease Control and Prevention. This prototype is not endorsed by CDC and has no clinical use. The guideline is free on <a href="https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm">the CDC website</a>.</footer>
  {/if}
</main>

<style>
  :global(html) { scroll-behavior: auto; } :global(body) { background: var(--surface-raised); }
  header { border-bottom: 1px solid var(--border); padding: 1.2rem max(1.25rem,calc((100vw - 1120px)/2)); display:flex; align-items:center; justify-content:space-between; gap:1rem; } .brand { font-weight:750; text-decoration:none; color:var(--text); } .brand span { color:var(--text-muted); font-weight:400; margin-left:1rem; } nav {display:flex; flex-wrap:wrap; gap:.2rem;} button,select,input { color:var(--text); background:var(--surface-raised); border:1px solid var(--border); border-radius:0; padding:.55rem .75rem; max-width:100%; } button { cursor:pointer; } nav button {border:0; background:transparent;} .active {background:var(--action);color:var(--action-text);} :is(a,button,input,select,summary):focus-visible {outline:3px solid var(--focus-ring);outline-offset:3px;} a {color:var(--action);text-underline-offset:3px;} main {max-width:1060px;margin:auto;padding:3.4rem 2rem;} .intro {max-width:800px;} .edition {color:var(--text-muted);margin:0 0 .6rem;} h1 {font-family:var(--font-prose);font-size:clamp(2rem,5vw,3.5rem);font-weight:550;line-height:1.15;margin:.2rem 0 1.3rem;} .lede {font-size:1.15rem;max-width:50ch;} .notice {background:var(--surface-sunken);padding:.8rem 1rem; margin:1.5rem 0 1rem;border-left:4px solid var(--action);font-size:.85rem;} .legend {font-size:.85rem;color:var(--text-muted);max-width:80ch;}.sample {display:inline-block;height:1rem;border-left:3px solid var(--action);margin-right:.5rem;vertical-align:middle;} h2 {font-size:1.35rem;line-height:1.35;font-weight:650;} .overview-title {margin:3rem 0 2rem;} .area {margin-top:3rem;} .area>h2 {margin-left:210px;color:var(--text-muted);font-size:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border);} .rec {display:grid;grid-template-columns:180px 1fr;gap:30px;margin:2.2rem 0 3.5rem;} .margin {font-size:.85rem;display:flex;flex-direction:column;gap:.4rem;border-right:3px solid var(--action);padding-right:1rem;} .margin strong {font-size:1rem;} .related {margin-top:1.5rem;display:flex;flex-direction:column;gap:.55rem;}.related small {color:var(--text-muted);}.related a {border-left:1px solid var(--border);padding-left:.5rem;font-size:.8rem;}.source {font-family:var(--font-prose);font-size:1.14rem;line-height:1.8;margin:0 0 1.25rem;max-width:64ch;}.doccount {color:var(--text-muted);font-size:.8rem;} summary {cursor:pointer;color:var(--action);padding:.5rem 0;} .sentence-link {display:block;padding:.8rem 0;border-bottom:1px solid var(--border);font-size:.9rem;overflow-wrap:anywhere;} .question-picker {display:block;margin:2rem 0;} select {display:block;width:100%;margin-top:.4rem;} .question {font-family:var(--font-prose);font-size:1.65rem;max-width:40ch;margin-top:2rem;} .reading-spine {border-left:4px solid var(--action);padding-left:2.3rem;margin:2rem 0 3rem 1rem;}.statement {position:relative;margin-bottom:3rem;padding-bottom:2rem;border-bottom:1px solid var(--border);}.statement::before {content:'';position:absolute;left:-2.6rem;top:.35rem;width:.8rem;height:.8rem;background:var(--action);border:3px solid var(--surface-raised);border-radius:50%;}.stage {color:var(--text-muted);font-size:.82rem;}.answer {font-family:var(--font-prose);font-size:1.3rem;line-height:1.8;max-width:60ch;margin:.7rem 0 1rem;}.evidence {margin-top:1rem;}.step {margin:1.5rem 0 0 1rem;border-left:2px solid var(--border);padding-left:1.5rem;max-width:760px;}.step h2 {font-size:1.1rem;}.step p,.step blockquote {max-width:66ch;} blockquote {font-family:var(--font-prose);margin:1rem 0;font-size:1.05rem;line-height:1.8;} dl {display:grid;grid-template-columns:90px 1fr;gap:.6rem 1rem;} dt {font-size:.85rem;color:var(--text-muted);} dd {margin:0;} dd p {margin:0 0 .5rem;}.siblings {display:flex;flex-wrap:wrap;gap:.4rem;} form {margin-top:2rem;} .search {display:flex;gap:.5rem;margin-top:.5rem;} input {flex:1;min-width:0;} .boundaries {border-top:3px solid var(--text);padding-top:1rem;margin-top:4rem;max-width:800px;}.boundary {padding:.8rem 0;border-bottom:1px solid var(--border);font-size:.9rem;overflow-wrap:anywhere;}.boundary p {margin:.4rem 0;} footer {margin-top:3rem;padding-top:1rem;color:var(--text-muted);font-size:.8rem;max-width:80ch;} p {overflow-wrap:anywhere;}
  @media(max-width:650px) {header {padding:1rem;display:block;}.brand span {margin-left:.5rem;} nav {margin-top:.7rem;} nav button {padding:.45rem .6rem;font-size:.85rem;}main {padding:2rem 1rem;} .rec {display:block;}.margin {border:0;border-left:3px solid var(--action);padding-left:1rem;margin-bottom:1.2rem;} .related {margin-top:.6rem;gap:.35rem;}.related a {border:0;padding:0;} .area>h2 {margin-left:0;} .source {font-size:1.05rem;} .reading-spine {margin-left:.2rem;padding-left:1.2rem;}.statement::before {left:-1.5rem;} .step {margin-left:0;padding-left:.8rem;}.answer {font-size:1.08rem;} dl {display:block;}dt {margin-top:1rem;}dd {margin-top:.3rem;}.search {display:block;}.search input {width:100%;}.search button {margin-top:.5rem;} }
  @media(prefers-reduced-motion:reduce) {:global(*) {scroll-behavior:auto!important;}}
</style>
