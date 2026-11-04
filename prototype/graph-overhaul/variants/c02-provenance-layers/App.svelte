<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState } from '../../shared/data.js';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let selected = $state('');
  let activeRow = $state(0);
  let search = $state('');
  let error = $state('');
  const columns = ['Question', 'Answer statement', 'Rule reading', 'KB sentence', 'Document', 'PDF page'];
  const ix = $derived(g ? indexGuideline(g) : null);
  const question = $derived(g && state.view === 'trace' ? g.questions.find(q => q.id === state.question) : undefined);
  const rows = $derived.by(() => {
    if (!g || !ix) return [];
    let refs: {document:string;sentence:number}[] = [];
    if (state.view === 'overview') refs = g.recommendations.flatMap(r => {
      const d = ix.docs.get(r.id); const s = d?.sentences.find(s => ix.rules.has(`${d.id}:${s.n}`)) ?? d?.sentences[0]; return d && s ? [{document:d.id,sentence:s.n}] : [];
    });
    if (state.view === 'trace') refs = question?.statements ?? [];
    if (state.view === 'rule') refs = [{document:state.document,sentence:state.sentence}];
    if (state.view === 'explore') {
      const query = state.query.toLowerCase();
      refs = g.documents.flatMap(d => d.sentences.filter(s => `${d.id} ${s.ace}`.toLowerCase().includes(query)).map(s => ({document:d.id,sentence:s.n})));
    }
    return refs.flatMap(ref => {
      const key = `${ref.document}:${ref.sentence}`;
      const doc = ix!.docs.get(ref.document); const sentence = ix!.sentence(key);
      if (!doc || !sentence) return [];
      const rule = ix!.rules.get(key);
      const q = question ?? g!.questions.find(q => q.statements.some(s => s.document === ref.document && s.sentence === ref.sentence));
      return [{ key, doc, sentence, rule, q, ids:[q ? `q:${q.id}` : `uncited:${key}`,`answer:${key}`,`rule:${key}`,key,doc.id,`page:${doc.page}`],
        labels:[q ? q.question : 'Not cited by a prepared answer', sentence.conclusion, rule ? `${rule.condition ? 'If / ' : ''}${rule.subject} / ${rule.mode}` : 'Text reading only', `Sentence ${ref.sentence}`, doc.rec ? `Recommendation ${doc.rec}${doc.kind === 'recommendation' ? '' : ` / ${doc.kind}`}` : doc.section, `Page ${doc.page}`] }];
    });
  });
  const visible = $derived(state.view==='explore' ? rows.slice(0,40) : rows);
  const current = $derived(visible[Math.min(activeRow, Math.max(0,visible.length-1))]);
  const nodes = $derived(columns.map((_,c) => {
    const map = new Map<string,{id:string;label:string;row:number;positions:number[]}>();
    visible.forEach((row,i) => {const id=row.ids[c]; const prior=map.get(id); if(prior) prior.positions.push(i); else map.set(id,{id,label:row.labels[c],row:i,positions:[i]});});
    const items = [...map.values()].map(n => ({...n,y:n.positions.reduce((a,b)=>a+b,0)/n.positions.length*52+32})).sort((a,b)=>a.y-b.y);
    let previous = -12;
    return items.map((n,i)=>{const upper=(visible.length-1)*52+32-(items.length-1-i)*44;const y=Math.max(previous+44,Math.min(n.y,upper));previous=y;return {...n,y};});
  }));
  function nodeY(id:string,c:number) { return nodes[c].find(n=>n.id===id)?.y ?? 32; }
  const title = $derived(state.view === 'overview' ? 'From a question to the source.' : state.view === 'trace' ? question?.question ?? 'Question not found' : state.view === 'rule' ? 'Inside one rule' : `Find “${state.query}” in the knowledge base`);
  function go(next:HashState) { state = next; writeHash(next); selected=''; activeRow=0; }
  function pick(index:number,col:number) { activeRow=index; selected=visible[index].ids[col]; }
  function lit(row:typeof rows[number]) { return selected ? row.ids.includes(selected) : row.key===current?.key; }
  onMount(() => {
    const update = () => {state=readHash(); selected=''; activeRow=0;};
    addEventListener('hashchange',update);
    loadGuideline().then(data => g=data).catch(e => error=String(e));
    return () => removeEventListener('hashchange',update);
  });
  $effect(() => { if(g || error) { void state; void rows; tick().then(markReady); } });
</script>

<main>
  <header><a class="brand" href="#overview" onclick={() => go({view:'overview'})}>CNL / CKC <span>Evidence routes</span></a><span class="prototype">Graph study / provenance layers</span></header>
  <nav aria-label="Graph views"><button class:chosen={state.view==='overview'} onclick={() => go({view:'overview'})}>Guideline overview</button><label class="question">Trace an answer <select aria-label="Trace an answer" value={question?.id ?? ''} onchange={e => e.currentTarget.value && go({view:'trace',question:e.currentTarget.value})}><option value="">Choose a question</option>{#each g?.questions ?? [] as q}<option value={q.id}>{q.question}</option>{/each}</select></label><form onsubmit={e => {e.preventDefault();go({view:'explore',query:search});}}><input aria-label="Search the knowledge base" placeholder="Find a clinical term" bind:value={search}/><button>Find</button></form></nav>
  <section class="intro"><h1>{title}</h1><p>Follow the route, then select any item to light every connected source chain.</p></section>
  {#if error}<p role="alert">{error}</p>{:else if !g}<p>Loading the guideline…</p>{:else}
    <p class="notice">{g.derivation}</p>
    {#if state.view==='overview'}<p class="caption">{g.recommendations.length} recommendations. Each row previews its first clinical rule; select an item to read its rule and source.</p>{:else}<p class="caption">{rows.length} statement routes{rows.length>40 ? ' / first 40 shown; narrow your search for more' : ''}. Answer order is preserved in a trace.</p>{/if}
    <p class="legend">Nodes are evidence items. Curved links mean “traced to”, not “causes” or “rule fired”. Blue marks the selected chain.</p>
    {#if visible.length===0}<section class="empty"><h2>No matching item</h2><p>Choose another question, sentence, or clinical term.</p></section>{:else}
    <div class="desktop-diagram">
      <div class="column-heads">{#each columns as c}<strong>{c}</strong>{/each}</div>
      <div class="routes" style={`height:${Math.max(visible.length*52+16,140)}px`}>
        <svg aria-hidden="true" viewBox={`0 0 1200 ${Math.max(visible.length*52+16,140)}`} preserveAspectRatio="none">
          {#each visible as row}{#each [0,1,2,3,4] as c}<path class:lit={lit(row)} d={`M ${c*200+180} ${nodeY(row.ids[c],c)} C ${c*200+200} ${nodeY(row.ids[c],c)}, ${c*200+200} ${nodeY(row.ids[c+1],c+1)}, ${c*200+220} ${nodeY(row.ids[c+1],c+1)}`} />{/each}{/each}
        </svg>
        {#each nodes as column,c}{#each column as node}<button class="node" style={`position:absolute;left:${c*100/6+100/60}%;top:${node.y-19}px;width:${80/6}%;margin:0`} class:selected={selected===node.id} class:dim={selected!=='' && !visible.some(r=>r.ids.includes(node.id) && lit(r))} aria-pressed={selected===node.id} onclick={() => pick(node.row,c)} title={node.label}><span>{node.label}</span></button>{/each}{/each}
      </div>
    </div>
    <div class="mobile-diagram"><label>Statement route <select value={activeRow} onchange={e => {activeRow=Number(e.currentTarget.value);selected='';}}>{#each visible as r,i}<option value={i}>{i+1}. {r.doc.id} / sentence {r.sentence.n}</option>{/each}</select></label>{#if current}{#each current.labels as label,c}<button class="mobile-node" onclick={() => pick(activeRow,c)}><small>{columns[c]}</small>{label}</button>{/each}{/if}</div>
    {#if current}
      <section class="evidence"><div><div class="selection-label">Selected evidence / {current.doc.id} / sentence {current.sentence.n}</div><h2>{current.rule ? 'Condition, actor, action' : 'Text reading (heuristic)'}</h2><dl><dt>Condition</dt><dd>{current.rule?.condition ?? current.sentence.condition ?? 'No explicit condition in this sentence.'}</dd><dt>Actor</dt><dd>{current.rule?.subject ?? 'Not parsed in the clinical layer.'}</dd><dt>Action</dt><dd>{current.rule ? `${current.rule.mode} ${current.rule.actions.map(a => `${a.polarity==='negative'?'not ':''}${a.verb} ${a.object}${a.modifiers.map(m => ` ${m.preposition} ${m.value}`).join('')}`).join('; ')}` : current.sentence.conclusion}</dd></dl><details><summary>Read the exact controlled-language sentence</summary><p>{current.sentence.ace}</p></details><button onclick={() => go({view:'rule',document:current.doc.id,sentence:current.sentence.n})}>Isolate this rule</button></div><div class="source"><h2>Guideline source</h2><blockquote>{current.doc.source}</blockquote><a href={`${g.pdf}#page=${current.doc.page}`} target="_blank" rel="noreferrer">Open PDF page {current.doc.page}</a><details><summary>Other sentences in this document</summary>{#each current.doc.sentences as s}<button class="sentence-link" onclick={() => go({view:'rule',document:current.doc.id,sentence:s.n})}>Sentence {s.n}: {s.ace}</button>{/each}</details></div></section>
    {/if}
    <details class="table"><summary>Read the routes as a table</summary><table><thead><tr><th>Question</th><th>Statement</th><th>Source</th></tr></thead><tbody>{#each visible as row,i}<tr><td>{row.q?.question ?? 'No prepared question'}</td><td><button onclick={() => pick(i,1)}>{row.sentence.ace}</button></td><td>{row.doc.id}, sentence {row.sentence.n}, page {row.doc.page}</td></tr>{/each}</tbody></table></details>
    {/if}
    <section class="guards"><details><summary>Where these recommendations do not apply / {g.exclusions.length} scope records</summary><p>The absence of an exclusion does not prove that a patient belongs to the guideline population.</p>{#each g.exclusions as x}<p><button onclick={() => go({view:'rule',document:x.document,sentence:x.sentence})}>{x.ace}</button> <small>{x.document}, sentence {x.sentence}</small></p>{/each}</details><details><summary>Superseded statements / {g.supersessions.length} records</summary>{#each g.supersessions as s}<p><s>{s.ace}</s><br/><a href={s.url}>{s.citation}</a> / Superseded {String(s.date).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3')}<br/><button onclick={() => go({view:'rule',document:s.document,sentence:s.sentence})}>Read {s.document}, sentence {s.sentence}</button></p>{/each}</details></section>
    <footer>CDC Clinical Practice Guideline for Prescribing Opioids for Pain, 2022. CDC does not endorse this demo. The guideline is free on the CDC website. This prototype is not for clinical use.</footer>
  {/if}
</main>

<style>
  main{max-width:1500px;margin:auto;padding:24px 32px 40px} header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding-bottom:22px}.brand{font-size:18px;font-weight:750;text-decoration:none;color:var(--text)}.brand span{font-weight:400;margin-left:18px;color:var(--text-muted)}.prototype{color:var(--text-muted);font-size:13px}nav{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}button,select,input{color:var(--text);background:var(--surface-raised);border:1px solid var(--border);border-radius:3px;padding:8px 10px;max-width:100%}button{cursor:pointer}button:hover{border-color:var(--action)}button.chosen{background:var(--action);color:var(--action-text);border-color:var(--action)}:is(button,a,select,input,summary):focus-visible{outline:3px solid var(--action);outline-offset:3px}.question{display:flex;align-items:center;gap:10px;font-size:13px}.question select{max-width:310px}form{display:flex;gap:5px;margin-left:auto}input{width:185px}h1{font-size:36px;font-weight:650;line-height:1.15;letter-spacing:-1px;margin:26px 0 10px;max-width:950px}.intro p{margin:0 0 22px;color:var(--text-muted)}.notice{font-size:12px;color:var(--text-muted);max-width:105ch}.caption{font-size:14px;margin:20px 0 4px}.legend{font-size:12px;color:var(--text-muted);margin:0 0 18px}.desktop-diagram{background:var(--surface-raised);border:1px solid var(--border);border-radius:5px;overflow:hidden}.column-heads{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));padding:13px 10px;background:var(--surface-sunken);font-size:13px}.routes{position:relative;padding:6px 0;overflow:hidden}.routes svg{position:absolute;width:100%;height:100%;inset:0;pointer-events:none}path{stroke:var(--border);stroke-width:1.5;fill:none}path.lit{stroke:var(--action);stroke-width:2}.node.dim{border-color:var(--border)}.node{margin:0 10%;padding:7px 8px;height:38px;font-size:12px;text-align:left;line-height:1.1;overflow:hidden;background:var(--surface-raised);border-color:var(--action)}.node span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.node.selected{background:var(--action);color:var(--action-text)}.evidence{display:grid;grid-template-columns:1fr 1fr;gap:40px;padding:25px 0}.selection-label{color:var(--text-muted);font-size:12px;overflow-wrap:anywhere}h2{font-size:20px;margin:7px 0 14px;font-weight:600}dl{display:grid;grid-template-columns:75px 1fr;gap:8px;margin:0 0 14px;font-size:14px}dt{color:var(--text-muted)}dd{margin:0}.source{border-left:3px solid var(--action);padding-left:22px}blockquote{font-family:var(--font-prose);font-size:15px;line-height:1.7;margin:0 0 14px;max-width:68ch}a{color:var(--action)}summary{cursor:pointer}details{margin:12px 0;font-size:14px}details p{overflow-wrap:anywhere}.sentence-link{display:block;text-align:left;margin:8px 0}table{border-collapse:collapse;table-layout:fixed;width:100%}th,td{padding:10px;text-align:left;border-bottom:1px solid var(--border);overflow-wrap:anywhere}td button{text-align:left}.guards{display:grid;grid-template-columns:1fr 1fr;gap:30px;border-top:1px solid var(--border);padding-top:12px}.guards button{text-align:left}.guards small{color:var(--text-muted)}footer{color:var(--text-muted);font-size:12px;max-width:105ch;margin-top:35px}.mobile-diagram{display:none}.empty{padding:30px;background:var(--surface-raised)}
  @media(max-width:760px){main{padding:16px}header{display:block}.brand span{display:block;margin:4px 0}.prototype{display:block;font-size:11px;margin-top:10px}nav{align-items:stretch;gap:10px}.question{display:block;max-width:100%;width:100%}.question select{display:block;max-width:100%;width:100%;margin-top:5px}form{margin:0;width:100%}input{flex:1;min-width:0}h1{font-size:28px}.notice{font-size:11px}.desktop-diagram{display:none}.mobile-diagram{display:block}.mobile-diagram label{display:block;font-size:13px}.mobile-diagram select{width:100%;margin:6px 0 14px}.mobile-node{display:block;position:relative;width:100%;text-align:left;margin:0 0 18px;border-left:4px solid var(--action);font-size:14px}.mobile-node:not(:last-child)::after{content:'';height:18px;border-left:2px solid var(--action);position:absolute;left:12px;bottom:-19px}.mobile-node small{display:block;color:var(--text-muted);font-size:11px;margin-bottom:4px}.evidence,.guards{grid-template-columns:1fr;gap:20px}.source{padding-left:14px}dl{grid-template-columns:65px 1fr}.caption{font-size:13px}.table{font-size:12px}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
