<script lang="ts">
  import { tick } from 'svelte';
  import { indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState } from '../../shared/data.js';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let search = $state('');
  let selected = $state('cdc2022-opioid-rec01');
  let error = $state('');
  const navigate = (next: HashState) => { state = next; writeHash(next); };
  $effect(() => { const change = () => state = readHash(); addEventListener('hashchange', change); void loadGuideline().then(data => g = data).catch(e => error = String(e)); return () => removeEventListener('hashchange', change); });
  $effect(() => { if (!g && !error) return; void state; void tick().then(markReady); });
  const ix = $derived(g ? indexGuideline(g) : null);
  const docs = $derived(g ? [...g.documents].sort((a,b) => a.page-b.page || (a.rec ?? 0)-(b.rec ?? 0) || a.id.localeCompare(b.id)) : []);
  const question = $derived(state.view === 'trace' ? g?.questions.find(q => q.id === state.question) : undefined);
  const chartDocs = $derived(state.view === 'trace' ? docs.filter(d => question?.documents.includes(d.id)) : docs);
  const pos = $derived(new Map(chartDocs.map((d,i) => [d.id, 25 + i * 1050 / Math.max(1,chartDocs.length-1)])));
  const bands = $derived.by(() => { const runs: { rec:number|null; start:number; end:number }[]=[]; chartDocs.forEach((d,i) => { const last=runs.at(-1); if (!last || last.rec!==d.rec) runs.push({rec:d.rec,start:i,end:i}); else last.end=i; }); return runs; });
  const query = $derived(state.view === 'explore' ? state.query : '');
  const matches = $derived(state.view === 'explore' ? docs.filter(d => `${d.id} ${d.source} ${d.sentences.map(s => s.ace).join(' ')}`.toLowerCase().includes(query.toLowerCase())) : []);
  const focusDoc = $derived(state.view === 'rule' ? ix?.docs.get(state.document) : state.view === 'trace' ? ix?.docs.get(question?.statements[0]?.document ?? '') : state.view === 'explore' ? matches[0] : ix?.docs.get(selected));
  const focusSentence = $derived(state.view === 'rule' ? focusDoc?.sentences.find(s => s.n === state.sentence) : focusDoc?.sentences[0]);
  const rule = $derived(focusDoc && focusSentence ? ix?.rules.get(`${focusDoc.id}:${focusSentence.n}`) : undefined);
  const highlighted = $derived(new Set(state.view === 'trace' ? question?.documents : state.view === 'explore' ? matches.map(d => d.id) : [focusDoc?.id]));
  const links = $derived.by(() => {
    if (!g) return [];
    const pairs = new Map<string,{a:string;b:string;labels:string[]}>();
    const generic = new Set(['patient','clinician','have','be','do','consider','use','receive','recommendation']);
    for (const c of g.concepts) {
      if (generic.has(c.label)) continue;
      const ids = [...new Set(c.mentions.map(m => m.slice(0,m.lastIndexOf(':'))))].filter(id => pos.has(id));
      if (ids.length > 45) continue;
      for (let i=0;i<ids.length;i++) for (let j=i+1;j<ids.length;j++) {
        const [a,b] = [ids[i],ids[j]].sort(); const key = `${a}|${b}`;
        const pair = pairs.get(key) ?? {a,b,labels:[]}; pair.labels.push(c.label); pairs.set(key,pair);
      }
    }
    return [...pairs.values()].sort((a,b) => b.labels.length-a.labels.length).slice(0,90);
  });
  const shownLinks = $derived(state.view === 'trace' ? (question?.statements ?? []).map(s => s.document).filter((d,i,a) => i===0 || d!==a[i-1]).slice(1).map((b,i) => ({a:(question?.statements ?? []).map(s => s.document).filter((d,j,a) => j===0 || d!==a[j-1])[i],b,labels:['Answer citation sequence']})) : links);
  const arc = (a:string,b:string) => { const x=pos.get(a) ?? 25, y=pos.get(b) ?? 25; const h=Math.min(265,32+Math.abs(y-x)*.38); return `M ${x} 300 C ${x} ${300-h}, ${y} ${300-h}, ${y} 300`; };
  const short = (id:string) => id.replace('cdc2022-opioid-','');
</script>

<main>
  <header><a href="#overview" onclick={(e) => {e.preventDefault();navigate({view:'overview'});}}>CNL / CKC <span>Graph studies</span></a><span>Page-order atlas</span></header>
  <h1>Clinical cross-references</h1>
  <p class="intro">Read the guideline from left to right. Follow the arcs to see where its documents share clinical concepts.</p>
  <nav aria-label="Graph views">
    <button class:active={state.view==='overview'} onclick={() => navigate({view:'overview'})}>Guideline shape</button>
    <label>Trace an answer<select aria-label="Trace an answer" value={question?.id ?? ''} onchange={e => navigate({view:'trace',question:e.currentTarget.value})}><option value="" disabled>Choose a question</option>{#each g?.questions ?? [] as q}<option value={q.id}>{q.question}</option>{/each}</select></label>
    <form onsubmit={e => {e.preventDefault();navigate({view:'explore',query:search});}}><label for="search">Find a concept or phrase</label><div><input id="search" bind:value={search} placeholder="e.g. naloxone"/><button>Find</button></div></form>
  </nav>
  {#if error}<p role="alert">{error}</p>{:else if !g || !ix}<p>Loading the guideline…</p>{:else}
    <section class="atlas" aria-label="Document arc diagram">
      <div class="caption"><strong>{state.view==='trace' ? 'One answer across the guideline' : state.view==='explore' ? `Documents matching “${query}”` : 'The guideline in document order'}</strong><span>{docs.length} documents / {g.recommendations.length} recommendations</span></div>
      <svg viewBox="0 0 1100 360" role="img" aria-label="Documents in page order, joined by shared-concept arcs. Exact connections are listed below.">
        {#each shownLinks as l}<path d={arc(l.a,l.b)} class:lit={state.view==='trace' || highlighted.has(l.a) || highlighted.has(l.b)}><title>{short(l.a)} and {short(l.b)}: {l.labels.join(', ')}</title></path>{/each}
        {#each bands as band}<rect x={25+band.start*1050/Math.max(1,chartDocs.length-1)} y="309" width={Math.max(1,(band.end-band.start)*1050/Math.max(1,chartDocs.length-1))} height="18" fill="var(--surface-sunken)"/>{#if band.end-band.start>15}<text x={25+(band.start+band.end)/2*1050/Math.max(1,chartDocs.length-1)} y="323" text-anchor="middle">{band.rec ? `R${band.rec}` : 'Scope'}</text>{/if}{/each}
        <line x1="25" x2="1075" y1="300" y2="300"/>
        {#each chartDocs as d}<a href={`#rule=${d.id}:${d.sentences[0]?.n ?? 1}`} onclick={e => {e.preventDefault();selected=d.id;navigate({view:'rule',document:d.id,sentence:d.sentences[0]?.n ?? 1});}}><line x1={pos.get(d.id)} x2={pos.get(d.id)} y1={d.kind==='recommendation' ? 290 : 298} y2={d.kind==='recommendation' ? 320 : 308} class:node-selected={highlighted.has(d.id)} class="node"/><title>{d.id}, page {d.page}, recommendation {d.rec ?? 'guideline-wide'}</title></a>{/each}
        {#if state.view==='trace'}{#each chartDocs as d}<text x={Math.max(75,Math.min(1020,pos.get(d.id) ?? 25))} y="342" text-anchor="middle">{short(d.id)} / p. {d.page}</text>{/each}{:else}{#each chartDocs.filter((d,i,a) => i===0 || d.page!==a[i-1].page).filter((_,i)=>i%5===0) as d}<text x={pos.get(d.id)} y="342" text-anchor="middle">p. {d.page}</text>{/each}{/if}
      </svg>
      <p class="legend">{state.view==='trace' ? `Citation detail: ${chartDocs.length} cited documents. Open Guideline shape for every document.` : 'All documents shown; bands group recommendation families.'} Ticks = documents; long ticks = recommendations. Arcs = {state.view==='trace' ? 'consecutive answer citations, not inference links' : 'shared concepts, not logical entailment'}. Position follows page order, with equal document spacing.</p>
      <details><summary>How to read this view</summary><p>The overview shows the 90 document pairs with the most shared concepts. Generic roles and verbs are removed; concepts in more than 45 documents are omitted. Every document remains on the axis. Recommendation families appear in the document labels below.</p></details>
    </section>
    <div class="reading">
      <section class="references">
        {#if state.view==='trace'}
          <h2>{question?.question ?? 'Question not found'}</h2><p class="notice">{g.derivation}</p>
          {#each question?.statements ?? [] as s,i}<article><small>Statement {i+1} / Recommendation {ix.docs.get(s.document)?.rec}</small><p>{ix.sentence(`${s.document}:${s.sentence}`)?.ace}</p><a href={`#rule=${s.document}:${s.sentence}`} onclick={e => {e.preventDefault();navigate({view:'rule',document:s.document,sentence:s.sentence});}}>{short(s.document)}, sentence {s.sentence}</a><span> / page {ix.docs.get(s.document)?.page}</span></article>{/each}
        {:else if state.view==='explore'}
          <h2>{matches.length} matching documents</h2>{#if !matches.length}<p>No document found. Try a clinical concept such as pain.</p>{/if}
          {#each matches as d}<article><button class="text-button" onclick={() => navigate({view:'rule',document:d.id,sentence:d.sentences.find(s => s.ace.toLowerCase().includes(query.toLowerCase()))?.n ?? d.sentences[0].n})}>{short(d.id)} / page {d.page}</button><p>{d.source}</p></article>{/each}
        {:else if state.view==='rule'}
          <h2>Read one rule</h2>{#if !focusDoc || !focusSentence}<p>Document or sentence not found.</p>{:else}<p>{focusDoc.id}, sentence {focusSentence.n}</p><blockquote>{focusSentence.ace}</blockquote>
          <div class="logic"><div><strong>When</strong><p>{rule?.condition ?? focusSentence.condition ?? 'No explicit condition in this sentence.'}</p></div><div><strong>{rule ? `Then / ${rule.mode}` : `Text reading / ${focusSentence.modal}`}</strong><p>{rule ? `${rule.subject}: ${rule.actions.map(a => `${a.polarity==='negative'?'not ':''}${a.verb} ${a.object} ${a.modifiers.map(m => `${m.preposition} ${m.value}`).join(' ')}`).join('; ')}` : focusSentence.conclusion}</p></div></div>
          <p class="note">{rule ? 'Clinical parse from the exported recommendation rule.' : 'Text reading only: a heuristic split of the controlled-language sentence, not a clinical parse.'}</p>
          <h3>Other sentences in this document</h3>{#each focusDoc.sentences as s}<button class="sentence" class:active={s.n===focusSentence.n} onclick={() => navigate({view:'rule',document:focusDoc!.id,sentence:s.n})}>Sentence {s.n}: {s.ace}</button>{/each}{/if}
        {:else}
          <h2>Where the arcs lead</h2><p>Strongest shared-concept pairs. Select a document to read its rule and source.</p>
          {#each links as l}<article><div class="pair"><button class="text-button" onclick={() => navigate({view:'rule',document:l.a,sentence:ix!.docs.get(l.a)!.sentences[0].n})}>{short(l.a)}</button><span>↔</span><button class="text-button" onclick={() => navigate({view:'rule',document:l.b,sentence:ix!.docs.get(l.b)!.sentences[0].n})}>{short(l.b)}</button></div><p>{l.labels.length} shared concepts: {l.labels.slice(0,5).join(', ')}{l.labels.length>5?'…':''}</p></article>{/each}
          <details><summary>Every document in page order</summary>{#each docs as d}<button class="sentence" onclick={() => navigate({view:'rule',document:d.id,sentence:d.sentences[0].n})}>p. {d.page} / R{d.rec ?? '—'} / {short(d.id)}</button>{/each}</details>
        {/if}
      </section>
      <aside>
        <h2>From the source</h2>{#if focusDoc}<p class="locator">Recommendation {focusDoc.rec ?? 'scope'} / page {focusDoc.page}</p><h3>{short(focusDoc.id)}</h3><p class="source">{focusDoc.source}</p><a href={`${g.pdf}#page=${focusDoc.page}`} target="_blank" rel="noreferrer">Open guideline page {focusDoc.page}</a>{/if}
        <h3>Scope and changes</h3><details><summary>{g.exclusions.length} scope exclusion records</summary><p>The recommendations do not apply under these conditions. No listed exclusion does not prove eligibility.</p>{#each g.exclusions as e}<p>{e.ace}<br/><a href={`#rule=${e.document}:${e.sentence}`}>{short(e.document)}, sentence {e.sentence}</a></p>{/each}</details>
        <details><summary>{g.supersessions.length} superseded statements</summary>{#each g.supersessions as s}<p><s>{s.ace}</s><br/>Superseded {String(s.date).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3')}<br/><a href={s.url} target="_blank" rel="noreferrer">{s.citation}</a></p>{/each}</details>
      </aside>
    </div>
    <footer><p>{g.derivation}</p><p>Source: Centers for Disease Control and Prevention. This demo is not endorsed by CDC. The guideline is available free on the CDC website. This is not a clinical tool.</p></footer>
  {/if}
</main>

<style>
  main{max-width:1440px;margin:auto;padding:24px 40px}header{display:flex;justify-content:space-between;gap:16px;color:var(--text-muted);font-size:14px}header a{color:var(--text);text-decoration:none;font-weight:700}header a span{margin-left:16px;font-weight:400}h1{font-size:38px;line-height:1.1;margin:40px 0 12px;font-weight:650;letter-spacing:-1px}h2{font-size:22px;line-height:1.25;margin-top:0}h3{font-size:17px}p{max-width:72ch}.intro{font-size:18px;max-width:70ch;margin-bottom:28px}nav{display:flex;align-items:end;gap:22px;margin-bottom:26px;flex-wrap:wrap}nav label{display:block;font-size:14px}select,input,button{background:var(--surface-raised);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:9px 12px}select{display:block;max-width:410px;width:100%;font:inherit}form div{display:flex}input{width:200px;min-width:0}button{cursor:pointer}button.active{background:var(--action);color:var(--action-text)}a{color:var(--action)}:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}.atlas{background:var(--surface-raised);padding:20px 24px;border-bottom:4px solid var(--text)}.caption{display:flex;justify-content:space-between;gap:10px}.caption span,.legend,.note,small{color:var(--text-muted);font-size:14px}.atlas svg{width:100%;display:block;height:auto;max-height:350px}path{fill:none;stroke:var(--border);stroke-width:.8;opacity:1}path.lit{stroke:var(--action);stroke-width:2;opacity:.9}line{stroke:var(--border)}line.node{stroke-width:1.1;opacity:.7}line.node-selected{stroke:var(--action);stroke-width:3;opacity:1}text{fill:var(--text-muted);font-size:13px}.legend{margin:0 0 8px;max-width:none}.reading{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:44px;padding-top:30px}.references,aside{min-width:0}article{padding:16px 0;border-bottom:1px solid var(--border)}article p{margin:8px 0}.pair{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.text-button{border:0;padding:0;color:var(--action);background:transparent;text-decoration:underline;text-align:left}.source,blockquote{font-family:var(--font-prose);font-size:16px;line-height:1.7}blockquote{margin:20px 0;padding:14px 20px;border-left:4px solid var(--action);background:var(--surface-raised)}.locator{color:var(--text-muted)}.logic{border-left:3px solid var(--action);padding-left:20px}.logic div{padding:10px 0}.logic p{margin:5px 0}.sentence{display:block;width:100%;text-align:left;margin:6px 0;white-space:normal}.notice{background:var(--surface-sunken);padding:14px;border-left:3px solid var(--action);font-size:14px}details{margin:14px 0}summary{cursor:pointer;color:var(--action)}aside{background:var(--surface-sunken);padding:22px;height:fit-content}aside p{overflow-wrap:anywhere}footer{border-top:1px solid var(--border);margin-top:36px;font-size:13px;color:var(--text-muted)}
  @media(max-width:650px){main{padding:18px}header{font-size:12px}header a span{display:none}h1{font-size:30px;margin-top:28px}.intro{font-size:16px}nav{gap:14px;display:grid;grid-template-columns:1fr}nav>button{text-align:left}select{max-width:100%}input{flex:1;width:0}form div{width:100%}.atlas{padding:16px 12px}.caption{display:block;font-size:14px}.caption span{display:block}.atlas svg{min-height:150px}.reading{grid-template-columns:1fr;gap:28px;padding-top:24px}.pair{font-size:14px}.legend{font-size:12px}h2{font-size:21px}aside{padding:18px}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
