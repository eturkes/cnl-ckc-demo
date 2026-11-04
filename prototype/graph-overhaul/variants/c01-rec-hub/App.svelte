<script lang="ts">
  import { tick } from 'svelte';
  import cytoscape from 'cytoscape';
  import { indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState } from '../../shared/data.js';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let selected = $state(1);
  let search = $state('');
  let canvas = $state<HTMLDivElement>();
  let links = $state.raw<{a:number;b:number;weight:number;shared:string}[]>([]);
  let cy: cytoscape.Core | undefined;
  let edgeNote = $state('Select a recommendation to read its sources. Select a link to inspect its shared concepts.');
  const ix = $derived(g ? indexGuideline(g) : null);
  const rec = $derived(g?.recommendations.find(r => r.number === selected));
  const question = $derived(state.view === 'trace' ? g?.questions.find(q => q.id === state.question) : undefined);
  const focusDoc = $derived(state.view === 'rule' ? ix?.docs.get(state.document) : undefined);
  const focusSentence = $derived(state.view === 'rule' ? focusDoc?.sentences.find(s => s.n === state.sentence) : undefined);
  const rule = $derived(state.view === 'rule' ? ix?.rules.get(`${state.document}:${state.sentence}`) : undefined);
  const matches = $derived(g && state.view === 'explore' ? g.documents.filter(d => `${d.id} ${d.source} ${d.sentences.map(s => s.ace).join(' ')}`.toLowerCase().includes(state.query.toLowerCase())) : []);
  const attached = $derived(rec ? [...rec.implementation, ...rec.supporting] : []);
  function go(next: HashState) { state = next; writeHash(next); }
  function openDoc(id: string) { const d = ix?.docs.get(id); if (d?.sentences[0]) go({ view: 'rule', document:id, sentence:d.sentences[0].n }); }
  $effect(() => { const change = () => state = readHash(); addEventListener('hashchange', change); void loadGuideline().then(data => g = data); return () => { removeEventListener('hashchange',change); cy?.destroy(); }; });
  $effect(() => {
    if (!g || !canvas || !ix) return;
    const data = g; const docs = ix.docs; const view = state;
    if (view.view === 'rule') selected = docs.get(view.document)?.rec ?? selected;
    const active = new Set<number>(view.view === 'trace' ? (question?.documents.map(id => docs.get(id)?.rec).filter((n): n is number => n != null) ?? []) : view.view === 'explore' ? matches.map(d=>d.rec).filter((n):n is number=>n!=null) : []);
    const stop = new Set(['patient','clinician','be','have','do','person','thing','use','consider','include','receive','recommend']);
    const concepts = data.recommendations.map(r => {
      const counts = new Map<string,number>();
      for(const c of data.concepts) {
        if(stop.has(c.label.toLowerCase()) || c.label.length <= 2) continue;
        const n = c.mentions.filter(m => docs.get(m.slice(0,m.lastIndexOf(':')))?.rec === r.number).length;
        if(n) counts.set(c.label,(counts.get(c.label)??0)+n);
      }
      return counts;
    });
    const css = getComputedStyle(canvas); const token = (s:string) => css.getPropertyValue(s).trim();
    const elements: cytoscape.ElementDefinition[] = data.recommendations.map(r=>({position:{x:300*Math.cos(r.number*Math.PI/6),y:300*Math.sin(r.number*Math.PI/6)},data:{id:r.id,label:String(r.number),size:45+Math.sqrt(r.implementation.length+r.supporting.length)*4,fill:token(r.grade?.category==='A'?'--graph-entity':'--graph-document')},classes:active.size && !active.has(r.number)?'dim':''}));
    const rows: typeof links = [];
    for(let a=0;a<data.recommendations.length;a++) for(let b=a+1;b<data.recommendations.length;b++) {
      const shared=[...concepts[a].keys()].filter(c=>concepts[b].has(c));
      const weight=shared.reduce((n,c)=>n+Math.min(concepts[a].get(c)??0,concepts[b].get(c)??0),0);
      if(weight) { const text=shared.join(', '); rows.push({a:a+1,b:b+1,weight,shared:text}); elements.push({data:{id:`link-${a}-${b}`,source:data.recommendations[a].id,target:data.recommendations[b].id,weight:.5+Math.log2(weight+1)/3,shared:`${weight} shared mentions. ${text}`},classes:'shared'}); }
    }
    links=rows;
    cy?.destroy();
    cy = cytoscape({container:canvas,elements,style:[{selector:'node',style:{'background-color':'data(fill)','width':'data(size)','height':'data(size)','label':'data(label)','color':token('--graph-label'),'font-size':28,'font-family':'Atkinson Hyperlegible Next','text-valign':'center','text-wrap':'wrap','text-outline-width':0}},{selector:'edge',style:{'line-color':token('--graph-edge'),'width':'data(weight)','opacity':.28,'curve-style':'bezier'}},{selector:'.satellite',style:{'width':5,'height':5,'label':'','border-width':0}},{selector:'.membership',style:{'width':.5,'opacity':.2}},{selector:'.dim',style:{'background-opacity':.22,'color':token('--text')}},{selector:':selected',style:{'border-width':4,'border-color':token('--text')}}],layout:{name:'cose',animate:false,randomize:false,nodeRepulsion:()=>180000,idealEdgeLength:()=>190,numIter:600,padding:70},wheelSensitivity:.15});
    const core = cy;
    const hubs=core.nodes().map(n=>({id:n.id(),x:n.position('x')*2.3,y:n.position('y')*2.3}));
    // Symmetric force equilibria can stack hubs; separate their document halos before fitting.
    for(let pass=0;pass<80;pass++) for(let a=0;a<hubs.length;a++) for(let b=a+1;b<hubs.length;b++) {
      const x=hubs[b].x-hubs[a].x, y=hubs[b].y-hubs[a].y, distance=Math.hypot(x,y);
      if(distance>=240) continue;
      const angle=(a+b)*2.3999632297, ux=distance>.01?x/distance:Math.cos(angle), uy=distance>.01?y/distance:Math.sin(angle), push=(240-distance)/2;
      hubs[a].x-=ux*push;hubs[a].y-=uy*push;hubs[b].x+=ux*push;hubs[b].y+=uy*push;
    }
    for(const hub of hubs) core.getElementById(hub.id).position({x:hub.x,y:hub.y});
    for (const r of data.recommendations) {
      const center=core.getElementById(r.id).position(); const ids=[...r.implementation,...r.supporting];
      ids.forEach((id,i)=> { const angle=i*2.3999632297; const radius=55+Math.sqrt(i)*8; const orbit=`${r.number}/${id}`; core.add([{data:{id:orbit,doc:id,size:5,fill:token(i<r.implementation.length?'--graph-event':'--text-muted')},position:{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius},classes:'satellite'},{data:{id:`m${orbit}`,source:r.id,target:orbit,weight:.5},classes:'membership'}]); });
    }
    core.fit(undefined,24); core.on('tap','node',e=>{const d=e.target.data(); if(d.doc) openDoc(d.doc);else { selected=data.recommendations.find(r=>r.id===d.id)?.number??1; edgeNote='Select a sentence below to inspect its condition and actions.'; }});
    core.on('tap','edge.shared',e=>{edgeNote=`Shared clinical concepts: ${e.target.data('shared')}`;});
    void tick().then(()=>{core.resize(); core.fit(undefined,24);markReady();});
  });
</script>

<main>
  <header><div><p class="brand">CNL / CKC <span>Guideline atlas</span></p><h1>Twelve recommendations.<br/>One connected guideline.</h1></div><nav aria-label="Views"><button onclick={()=>go({view:'overview'})} aria-current={state.view==='overview'?'page':undefined}>Overview</button><button onclick={()=>g&&go({view:'trace',question:g.questions[0].id})} aria-current={state.view==='trace'?'page':undefined}>Trace an answer</button><button onclick={()=>go({view:'explore',query:search||'naloxone'})} aria-current={state.view==='explore'?'page':undefined}>Explore</button></nav></header>
  {#if !g || !ix}<p>Loading the guideline…</p>{:else}
    <p class="intro">Recommendation hubs reveal the guideline’s evidence structure. Larger circles hold more documents; thicker links mean more shared clinical-concept mentions, not clinical causation.</p>
    <div class="legend"><span class="a">● Category A</span><span class="b">● Category B</span><span>Small ochre dots: implementation; slate dots: supporting documents</span><span>Lines: shared concepts or document membership</span></div>
    <div class="workspace"><section class="map" aria-label="Recommendation network"><div class="maphead"><strong>{state.view==='trace'?'Answer sources':state.view==='explore'?'Search matches':state.view==='rule'?'Rule context':'The guideline at a glance'}</strong><button onclick={()=>cy?.fit(undefined,24)}>Fit map</button></div><div class="canvas" bind:this={canvas}></div><p class="mapnote">Pan to explore. Select a hub or a document dot. Use the list below for keyboard access.</p></section>
    <aside>
      {#if state.view==='trace'}
        <h2>Trace an answer</h2><label>Question<select value={question?.id??''} onchange={e=>go({view:'trace',question:e.currentTarget.value})}>{#each g.questions as q}<option value={q.id}>{q.question}</option>{/each}</select></label>
        {#if question}<h3>{question.question}</h3><p class="disclosure">{g.derivation}</p><ol class="statements">{#each question.statements as s}<li><p>{ix.sentence(`${s.document}:${s.sentence}`)?.ace}</p><a href={`#rule=${s.document}:${s.sentence}`}>{s.document}, sentence {s.sentence}</a><p><a target="_blank" href={`${g.pdf}#page=${ix.docs.get(s.document)?.page}`}>Guideline page {ix.docs.get(s.document)?.page}</a></p><details><summary>Source passage</summary><blockquote>{ix.docs.get(s.document)?.source}</blockquote></details></li>{/each}</ol>{:else}<p>Question not found.</p>{/if}
      {:else if state.view==='rule'}
        {#if focusDoc && focusSentence}<p class="kicker">Recommendation {focusDoc.rec ?? 'scope'}</p><h2>One rule, unpacked</h2><p class="docid">{focusDoc.id}, sentence {focusSentence.n}</p><p class="statement">{focusSentence.ace}</p>
          {#if rule}<div class="logic"><h3>When</h3><p>{rule.condition || 'No explicit condition in this rule.'}</p><h3>Who</h3><p>{rule.subject}</p><h3>Then: {rule.mode}</h3>{#each rule.actions as a}<p><strong>{a.polarity==='negative'?'NOT ':''}{a.verb}</strong> {a.object} {a.modifiers.map(m=>`${m.preposition} ${m.value}`).join(' ')}</p>{/each}</div>{:else}<div class="logic"><h3>Text reading, not the KB’s parse</h3><p>Condition: {focusSentence.condition || 'None explicit'}</p><p>{focusSentence.modal}{focusSentence.negated?' NOT':''}: {focusSentence.conclusion}</p></div>{/if}
          <a target="_blank" href={`${g.pdf}#page=${focusDoc.page}`}>Open guideline page {focusDoc.page}</a><details open><summary>Verbatim source passage</summary><blockquote>{focusDoc.source}</blockquote></details><h3>Other sentences</h3>{#each focusDoc.sentences as s}<a class="sentence-link" href={`#rule=${focusDoc.id}:${s.n}`}>Sentence {s.n}: {s.ace}</a>{/each}
        {:else}<h2>Rule not found</h2><p>Select a recommendation from the list.</p>{/if}
      {:else if state.view==='explore'}
        <h2>Explore the knowledge base</h2><form onsubmit={e=>{e.preventDefault();go({view:'explore',query:search});}}><label>Find a clinical concept<input bind:value={search} placeholder={state.query} /></label><button>Find documents</button></form><p>{matches.length} documents match “{state.query}”. Matching recommendation hubs stay bright.</p>{#each matches as d}<button class="result" onclick={()=>openDoc(d.id)}><strong>{d.id}</strong><span>{d.sentences.find(s=>s.ace.toLowerCase().includes(state.query.toLowerCase()))?.ace || d.source}</span><small>Page {d.page}</small></button>{/each}{#if !matches.length}<p>No documents found. Try another term.</p>{/if}
      {:else}
        <p class="kicker">Recommendation {selected}</p><h2>{rec?.grade ? `Category ${rec.grade.category}`:'Recommendation'}</h2><p>Evidence type {rec?.grade?.evidenceType ?? 'not stated'}; {attached.length+1} documents</p><blockquote>{rec?.source}</blockquote><a target="_blank" href={`${g.pdf}#page=${rec?.page}`}>Open guideline page {rec?.page}</a><h3>Read its rules</h3>{#each ix.docs.get(rec?.id??'')?.sentences ?? [] as s}<a class="sentence-link" href={`#rule=${rec?.id}:${s.n}`}>Sentence {s.n}: {s.ace}</a>{/each}<details><summary>{attached.length} implementation and supporting documents</summary>{#each attached as id}<button class="doc-link" onclick={()=>openDoc(id)}>{id}</button>{/each}</details>
      {/if}
    </aside></div>
    <p class="edge-note">{edgeNote}</p>
    <details class="index"><summary>Recommendation list and document counts</summary><div class="rec-list">{#each g.recommendations as r}<button onclick={()=>{selected=r.number;go({view:'overview'});}}><strong>Recommendation {r.number}</strong><span>Category {r.grade?.category}; {r.implementation.length+r.supporting.length+1} documents</span></button>{/each}</div></details>
    <details class="index"><summary>Shared-concept connection table</summary><p>Weight sums the smaller mention count for each shared clinical concept across the two recommendations. Line width uses a logarithmic scale.</p><table><thead><tr><th>Recommendations</th><th>Shared mentions</th><th>Clinical concepts</th></tr></thead><tbody>{#each links as link}<tr><td>{link.a} and {link.b}</td><td>{link.weight}</td><td><details><summary>Read shared concepts</summary>{link.shared}</details></td></tr>{/each}</tbody></table></details>
    <section class="records"><details><summary>Scope exclusions ({g.exclusions.length} records)</summary><p>These recommendations do not apply under the conditions stated below. Absence of an exclusion does not establish that a patient belongs to the guideline’s population.</p>{#each g.exclusions as x}<p>{x.ace} <a href={`#rule=${x.document}:${x.sentence}`}>{x.document}, sentence {x.sentence}</a></p>{/each}</details><details><summary>Superseded statements ({g.supersessions.length})</summary>{#each g.supersessions as x}<article><p><s>{x.ace}</s></p><p>Superseded {String(x.date).slice(0,4)}-{String(x.date).slice(4,6)}-{String(x.date).slice(6)} by <a href={x.url}>{x.citation}</a>.</p><a href={`#rule=${x.document}:${x.sentence}`}>{x.document}, sentence {x.sentence}</a></article>{/each}</details></section>
    <footer>Prototype: {g.derivation} CDC guideline material is free on the agency website. CDC does not endorse this demo. Not for clinical use.</footer>
  {/if}
</main>

<style>
  main{max-width:1480px;margin:auto;padding:32px 40px}header{display:flex;justify-content:space-between;gap:24px;align-items:center}.brand{font-weight:750;margin:0 0 16px}.brand span{font-weight:400;color:var(--text-muted);margin-left:20px}h1{font-size:36px;line-height:1.1;margin:0;font-weight:700;letter-spacing:-1px}h2{font-size:25px;line-height:1.2;margin:8px 0 14px}h3{font-size:16px;margin:22px 0 6px}nav{display:flex;gap:8px;align-self:flex-end}button,input,select{color:var(--text);background:var(--surface-raised);border:1px solid var(--border);border-radius:3px;padding:8px 12px;max-width:100%}button{cursor:pointer}button[aria-current='page']{background:var(--action);color:var(--action-text);border-color:var(--action)}button:hover{border-color:var(--action)}a{color:var(--action);text-underline-offset:3px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}.intro{max-width:85ch;color:var(--text-muted);margin:24px 0 16px}.legend{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:13px;margin-bottom:15px}.a{color:var(--graph-entity)}.b{color:var(--graph-document)}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 360px;min-height:560px;border:1px solid var(--border);background:var(--surface-raised)}.map{min-width:0;position:relative;background:var(--surface-sunken)}.maphead{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;gap:12px}.maphead button{font-size:13px;padding:5px 9px}.canvas{height:470px;width:100%;min-width:0}.mapnote{padding:0 16px;font-size:12px;color:var(--text-muted)}aside{padding:22px;border-left:1px solid var(--border);max-height:620px;overflow:auto;min-width:0}.kicker{margin:0;color:var(--text-muted)}blockquote{font-family:var(--font-prose);font-size:15px;line-height:1.65;margin:14px 0 20px;max-width:64ch}.sentence-link{display:block;font-size:14px;margin:12px 0}.docid,.doc-link{overflow-wrap:anywhere}.statement{font-family:var(--font-prose)}.logic{padding:4px 16px 16px;border-left:4px solid var(--graph-entity);background:var(--surface-sunken);margin-bottom:16px}.logic h3{margin-top:12px}.logic p{margin:4px 0}label{display:block;font-size:14px}select,input{display:block;width:100%;margin:6px 0 12px}select{font-size:13px}.disclosure{font-size:12px;padding:10px;background:var(--surface-sunken)}.statements{padding-left:20px}.statements li{padding-bottom:22px}.statements p{margin:8px 0}.statements a{font-size:12px;overflow-wrap:anywhere}.result{display:block;width:100%;text-align:left;margin-top:12px;border:0;border-bottom:1px solid var(--border);border-radius:0;padding:12px 0}.result strong{font-size:12px;overflow-wrap:anywhere}.result span,.result small{display:block;margin-top:6px}.result span{font-size:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.edge-note{font-size:13px;color:var(--text-muted);overflow-wrap:anywhere}.index{margin:20px 0}.rec-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.rec-list button{text-align:left}.rec-list span{display:block;font-size:12px}.records{display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid var(--border);padding-top:18px}.records p{max-width:72ch}.records article{margin:24px 0}.records a{font-size:13px;overflow-wrap:anywhere}details summary{cursor:pointer;font-weight:600}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:13px;margin:14px 0}td,th{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid var(--border);overflow-wrap:anywhere}td details{margin:0}.doc-link{display:block;font-size:12px;text-align:left;margin:8px 0}footer{color:var(--text-muted);font-size:12px;border-top:1px solid var(--border);margin-top:24px;padding-top:16px;max-width:100ch}form{margin-bottom:16px}
  @media(max-width:800px){main{padding:20px}.workspace{grid-template-columns:1fr}aside{border-left:0;border-top:1px solid var(--border);max-height:none}.canvas{height:390px}header{display:block}nav{margin-top:20px;flex-wrap:wrap}h1{font-size:30px}.records{grid-template-columns:1fr}.rec-list{grid-template-columns:1fr 1fr}}
  @media(max-width:400px){main{padding:16px}h1{font-size:28px}.brand span{margin-left:12px}nav{gap:6px}nav button{font-size:13px;padding:8px}.canvas{height:330px}.legend{gap:6px 14px}aside{padding:18px}.rec-list{grid-template-columns:1fr}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
