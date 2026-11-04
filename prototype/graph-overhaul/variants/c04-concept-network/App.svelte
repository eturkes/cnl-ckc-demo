<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState, type Concept } from '../../shared/data.js';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let selected = $state('');
  let witness = $state<string[]>([]);
  let search = $state('');
  let compact = $state(matchMedia('(max-width:600px)').matches);
  $effect(() => { const mq=matchMedia('(max-width:600px)'); const resize=()=>compact=mq.matches; mq.addEventListener('change',resize); return ()=>mq.removeEventListener('change',resize); });
  function labelLines(label: string) { const lines=['']; for(const word of pretty(label).split(' ')) { if((lines.at(-1)!.length+word.length)>22) lines.push(word); else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word; } return lines; }
  const stop = new Set(['patient','clinician','have','be','consider','include','use','receive','ensure','take','apply','provide','need','recommendation','opioid-pain-clinical-practice-guideline','recommend','show','do','make','become']);
  $effect(() => { const hash = () => { state = readHash(); selected = ''; witness = []; search = state.view === 'explore' ? state.query : ''; }; addEventListener('hashchange', hash); untrack(hash); void loadGuideline().then(d => g = d); return () => removeEventListener('hashchange', hash); });
  $effect(() => { if(g) { void state; void selected; void tick().then(markReady); } });
  const ix = $derived(g ? indexGuideline(g) : null);
  const concepts = $derived(g?.concepts.filter(c => c.kind !== 'value' && !stop.has(c.label)) ?? []);
  const question = $derived(state.view === 'trace' ? g?.questions.find(q => q.id === state.question) : undefined);
  const ruleKey = $derived(state.view === 'rule' ? `${state.document}:${state.sentence}` : '');
  const sentence = $derived(ix?.sentence(ruleKey));
  const rule = $derived(ix?.rules.get(ruleKey));
  const matches = $derived(state.view === 'explore' ? concepts.filter(c => pretty(c.label).toLowerCase().includes(state.query.toLowerCase().replaceAll('-', ' '))) : []);
  const focus = $derived(concepts.find(c => c.id === selected) ?? (state.view === 'explore' ? matches[0] : undefined));
  const shared = (a: Concept,b: Concept) => { const s = new Set(b.mentions); return a.mentions.filter(m => s.has(m)); };
  function pretty(s: string) { return s.replaceAll('-', ' '); }
  function go(s: HashState) { state = s; selected = ''; witness = []; writeHash(s); }
  function dominant(c: Concept) { const counts = new Map<number,number>(); for(const m of c.mentions) { const r = ix?.docs.get(m.split(':')[0])?.rec; if(r) counts.set(r,(counts.get(r) ?? 0)+1); } return [...counts].sort((a,b)=>b[1]-a[1] || a[0]-b[0])[0]?.[0] ?? 0; }
  const hue = (r: number) => `hsl(${(r*137.5+200)%360} 45% 43%)`;
  function choose(c: Concept, keys: string[] = []) { state = {view:'explore',query:pretty(c.label)}; selected=c.id; witness=keys; search=pretty(c.label); writeHash(state); }
  const graph = $derived.by(() => {
    let pool: Concept[];
    if(focus) pool = [focus,...concepts.filter(c=>c.id!==focus.id).map(c=>({c,n:shared(focus,c).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,16).map(x=>x.c)];
    else if(state.view === 'rule') pool = concepts.filter(c=>c.mentions.includes(ruleKey)).slice(0,20);
    else if(question) { const keys = new Set(question.statements.map(s=>`${s.document}:${s.sentence}`)); pool = concepts.filter(c=>c.mentions.some(m=>keys.has(m))).slice(0,28); }
    else pool = concepts.slice(0,28);
    if(compact) pool=pool.slice(0,8);
    const nodes = pool.map((c,i)=>({...c,rec:dominant(c),x:compact?180+95*Math.cos(i*2*Math.PI/pool.length):390+285*Math.cos(i*2.399),y:compact?215+150*Math.sin(i*2*Math.PI/pool.length):285+205*Math.sin(i*2.399),r:6+Math.sqrt(c.mentions.length)*1.6}));
    const edges: {a:number;b:number;keys:string[]}[]=[];
    for(let a=0;a<nodes.length;a++) for(let b=a+1;b<nodes.length;b++) { const keys=shared(nodes[a],nodes[b]); if(keys.length) edges.push({a,b,keys}); }
    edges.sort((a,b)=>b.keys.length-a.keys.length); edges.splice(60);
    for(let t=0;t<(compact?0:210);t++) {
      const forces=nodes.map(n=>({x:(390-n.x)*0.002,y:(285-n.y)*0.002}));
      for(let a=0;a<nodes.length;a++) for(let b=a+1;b<nodes.length;b++) { const dx=nodes[a].x-nodes[b].x,dy=nodes[a].y-nodes[b].y,d=Math.max(20,Math.hypot(dx,dy)); const f=5500/(d*d); forces[a].x+=dx/d*f; forces[a].y+=dy/d*f; forces[b].x-=dx/d*f; forces[b].y-=dy/d*f; }
      for(const e of edges) {const a=nodes[e.a],b=nodes[e.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)); const f=(d-130)*0.008; forces[e.a].x+=dx/d*f; forces[e.a].y+=dy/d*f; forces[e.b].x-=dx/d*f; forces[e.b].y-=dy/d*f;}
      nodes.forEach((n,i)=>{n.x=Math.max(95,Math.min(685,n.x+forces[i].x));n.y=Math.max(45,Math.min(515,n.y+forces[i].y));});
    }
    return {nodes,edges};
  });
  const records = $derived(witness.length ? witness : focus?.mentions ?? []);
  const communities = $derived([...new Set(graph.nodes.map(n=>n.rec))].sort((a,b)=>a-b));
</script>

<main>
  <header><a href="#overview" onclick={() => go({view:'overview'})}>CNL / CKC <span>Graph studies</span></a><span>Clinical language, connected</span></header>
  <div class="heading"><div><h1>Clinical concept field</h1><p>Find where the guideline talks about the same things.</p></div><nav aria-label="Graph views"><button class:active={state.view==='overview'} onclick={()=>go({view:'overview'})}>Guideline shape</button><button class:active={state.view==='trace'} onclick={()=>g && go({view:'trace',question:g.questions[0].id})}>Trace an answer</button><button class:active={state.view==='rule'} onclick={()=>go({view:'rule',document:'cdc2022-opioid-rec01',sentence:5})}>Read one rule</button></nav></div>
  {#if g && ix}
  <form onsubmit={e=>{e.preventDefault();go({view:'explore',query:search});}}><label for="concept-search">Explore a clinical concept</label><div><input id="concept-search" bind:value={search} placeholder="Try naloxone, pain, or opioid dosage"/><button type="submit">Find concepts</button></div></form>
  <div class="workspace">
    <section class="field" aria-label="Concept network">
      <div class="field-heading"><h2>{focus ? pretty(focus.label) : state.view==='trace' ? 'The answer’s vocabulary' : state.view==='rule' ? 'Inside this sentence' : 'Shared clinical language'}</h2>{#if focus}<button onclick={()=>{selected='';go({view:'overview'});}}>Show overview</button>{/if}</div>
      <p class="legend">Circles = concepts; size = sentence mentions. Lines = shared sentences, not clinical claims.</p>
      {#if (state.view==='trace' && !question) || (state.view==='rule' && !sentence) || (state.view==='explore' && !focus)}<p class="notfound">No matching {state.view==='explore'?'concept':'record'} found. Try another selection.</p>{/if}
      <svg viewBox={compact?'0 0 360 460':'0 0 780 570'} role="img" aria-label="Clinical concepts connected by shared sentences">
        {#each graph.edges as e}{@const a=graph.nodes[e.a]}{@const b=graph.nodes[e.b]}<a href="#witnesses" onclick={ev=>{ev.preventDefault();choose(a,e.keys);}} aria-label={`${pretty(a.label)} and ${pretty(b.label)}: ${e.keys.length} shared sentences`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke-width={Math.min(5,0.6+Math.sqrt(e.keys.length)*0.5)}/></a>{/each}
        {#each graph.nodes as n}<a href={`#explore=${encodeURIComponent(pretty(n.label))}`} onclick={e=>{e.preventDefault();choose(n);}} aria-label={`${pretty(n.label)}, ${n.mentions.length} sentence mentions, recommendation ${n.rec}`}><circle cx={n.x} cy={n.y} r={n.r} fill={hue(n.rec)} class:selected={focus?.id===n.id}/><text x={n.x} y={n.y+n.r+15} text-anchor="middle">{#each labelLines(n.label) as line,i}<tspan x={n.x} dy={i?13:0}>{line}</tspan>{/each}</text><text class="rec" x={n.x} y={n.y+4} text-anchor="middle">{n.rec ? `R${n.rec}` : 'G'}</text></a>{/each}
      </svg>
      <div class="communities">Colour = most-mentioned recommendation: {#each communities as r}<span><i style:background={hue(r)}></i>{r ? `R${r}` : 'Guideline'}</span>{/each}</div>
      <p class="sample">{compact ? 'Compact network: up to 8 concepts.' : focus ? 'Selected concept + up to 16 co-mentioned neighbours.' : 'Ranked sample: up to 28 concepts.'} {graph.edges.length} strongest co-mention links shown. Select a circle to explore; select a line to read its sentences.</p>
      <details><summary>Read the network as a table</summary><table><thead><tr><th>Concept</th><th>Mentions</th><th>Community</th></tr></thead><tbody>{#each graph.nodes as n}<tr><td><button onclick={()=>choose(n)}>{pretty(n.label)}</button></td><td>{n.mentions.length}</td><td>R{n.rec}</td></tr>{/each}</tbody></table></details>
    </section>
    <aside id="witnesses">
      {#if state.view==='trace'}
        <h2>Answer to source</h2><label for="question">Prepared question</label><select id="question" value={question?.id} onchange={e=>go({view:'trace',question:e.currentTarget.value})}>{#each g.questions as q}<option value={q.id}>{q.question}</option>{/each}</select>
        {#if question}<h3>{question.question}</h3><p class="note">{g.derivation}</p><ol class="statements">{#each question.statements as s}{@const d=ix.docs.get(s.document)}<li><p>{ix.sentence(`${s.document}:${s.sentence}`)?.ace}</p><a href={`#rule=${s.document}:${s.sentence}`} onclick={()=>go({view:'rule',document:s.document,sentence:s.sentence})}>{s.document}, sentence {s.sentence}</a>{#if d}<details><summary>Source text, page {d.page}</summary><p>{d.source}</p><a href={`${g.pdf}#page=${d.page}`} target="_blank" rel="noreferrer">Open guideline page {d.page}</a></details>{/if}</li>{/each}</ol>{/if}
      {:else if state.view==='rule'}
        <h2>One rule, read closely</h2>{#if sentence}{@const d=ix.docs.get(state.document)}<p class="locator">{state.document}, sentence {state.sentence}</p><blockquote>{sentence.ace}</blockquote>{#if rule}<dl><dt>Condition</dt><dd>{rule.condition ?? 'No explicit condition in this sentence.'}</dd><dt>Actor</dt><dd>{rule.subject}</dd><dt>Modality</dt><dd>{rule.mode}</dd><dt>Actions</dt><dd>{#each rule.actions as a}<p>{a.polarity==='negative'?'Not ':''}{a.verb} {a.object}</p>{/each}</dd></dl>{:else}<p class="note">Text reading, not the KB’s clinical parse.</p><dl><dt>Condition</dt><dd>{sentence.condition ?? 'No explicit condition found.'}</dd><dt>Conclusion</dt><dd>{sentence.conclusion}</dd></dl>{/if}{#if d}<details open><summary>Guideline source, page {d.page}</summary><p>{d.source}</p><a href={`${g.pdf}#page=${d.page}`} target="_blank" rel="noreferrer">Open guideline page</a></details>{/if}{/if}
      {:else if focus}
        <h2>{witness.length ? 'Sentences behind this link' : 'Where this concept appears'}</h2><p>{records.length} {witness.length ? 'shared sentences' : 'sentence mentions'}. Showing the first 30.</p>{#if matches.length>1}<details><summary>{matches.length} matching concepts</summary>{#each matches as c}<button class="match" onclick={()=>{selected=c.id;witness=[];}}>{pretty(c.label)}</button>{/each}</details>{/if}
        {#each records.slice(0,30) as key}{@const d=ix.docs.get(key.split(':')[0])}<article><p>{ix.sentence(key)?.ace}</p><a href={`#rule=${key}`} onclick={()=>{const at=key.lastIndexOf(':');go({view:'rule',document:key.slice(0,at),sentence:Number(key.slice(at+1))});}}>{key}</a>{#if d}<a class="page-link" href={`${g.pdf}#page=${d.page}`} target="_blank" rel="noreferrer">Guideline page {d.page}</a><details><summary>Source text</summary><p>{d.source}</p></details>{/if}</article>{/each}
      {:else if witness.length}<h2>Sentences behind this link</h2>{#each records.slice(0,30) as key}<article><p>{ix.sentence(key)?.ace}</p><a href={`#rule=${key}`}>{key}</a></article>{/each}
      {:else}
        <h2>Follow a connection</h2><p>A line means two concepts occur in the same controlled-language sentence. It does not mean one causes or supports the other.</p><p>Select a circle to see its immediate neighbours. Select a line to inspect the shared sentences.</p><div class="shape"><strong>{concepts.length.toLocaleString()}</strong><span>entity and event concepts after the generic-word filter</span></div><h3>The guideline at a glance</h3><p>{g.recommendations.length} recommendations, {g.documents.length} source documents and {g.rules.length} parsed recommendation rules.</p><h3>Start with an answer</h3>{#each g.questions as q}<button class="question" onclick={()=>go({view:'trace',question:q.id})}>{q.question}</button>{/each}
      {/if}
    </aside>
  </div>
  <section class="boundaries"><h2>Read the boundaries too</h2><p>Co-mention links carry no recommendation, exclusion or supersession logic. Read those records directly.</p><details><summary>{g.exclusions.length} scope exclusion records</summary><p>The recommendations do not apply under these conditions. An absent exclusion does not prove eligibility.</p>{#each g.exclusions as e}<article><p>{e.ace}</p><a href={`#rule=${e.document}:${e.sentence}`}>{e.document}, sentence {e.sentence}</a></article>{/each}</details><details><summary>{g.supersessions.length} superseded statements</summary>{#each g.supersessions as s}<article><p><s>{s.ace}</s></p><p>Superseded {String(s.date).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3')} by <a href={s.url}>{s.citation}</a>.</p><a href={`#rule=${s.document}:${s.sentence}`}>{s.document}, sentence {s.sentence}</a></article>{/each}</details></section>
  <footer>{g.derivation} Clinical demonstration only. Source: CDC. CDC does not endorse this demo. Guideline material is free on the CDC website.</footer>
  {:else}<p>Loading the guideline…</p>{/if}
</main>

<style>
  main{max-width:1480px;margin:auto;padding:24px 32px}header{display:flex;justify-content:space-between;gap:20px;padding-bottom:22px;border-bottom:1px solid var(--border)}header a{color:var(--text);font-weight:750;text-decoration:none}header span{color:var(--text-muted);font-weight:400}header a span{margin-left:14px}h1{font-size:34px;line-height:1.15;margin:0 0 10px;letter-spacing:-.7px}h2{font-size:22px;line-height:1.2;margin:0 0 14px}h3{font-size:18px;line-height:1.4}.heading{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:30px 0 24px}.heading p{margin:0;color:var(--text-muted)}nav{display:flex;gap:6px;flex-wrap:wrap}button{border:1px solid var(--border);background:var(--surface-raised);color:var(--text);padding:8px 12px;cursor:pointer;border-radius:4px}button.active,button[type=submit]{background:var(--action);color:var(--action-text);border-color:var(--action)}a{color:var(--action);overflow-wrap:anywhere}button:hover{border-color:var(--action)}:global(:focus-visible){outline:3px solid var(--focus-ring);outline-offset:3px}form{display:flex;align-items:center;gap:22px;padding:15px 20px;background:var(--surface-sunken);margin-bottom:20px}form label{font-weight:700;white-space:nowrap}form>div{display:flex;gap:8px;flex:1}input{width:100%;min-width:0;padding:8px 12px;background:var(--surface-raised);color:var(--text);border:1px solid var(--border);border-radius:3px}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:26px}.field{min-width:0;background:var(--surface-raised);padding:20px;border:1px solid var(--border);align-self:start}.field-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.field-heading h2{margin-bottom:0}.legend,.sample,.note,.locator{font-size:13px;color:var(--text-muted)}svg{width:100%;height:auto;display:block;background:var(--surface-raised)}svg line{stroke:var(--border);opacity:.45}svg a:hover line,svg a:focus line{stroke:var(--action);opacity:1;stroke-width:6}svg circle{stroke:var(--surface-raised);stroke-width:2}svg circle.selected{stroke:var(--text);stroke-width:4}svg text{font-family:var(--font-ui);font-size:12px;fill:var(--text);paint-order:stroke;stroke:var(--surface-raised);stroke-width:4px;stroke-linejoin:round;font-weight:650}svg text.rec{fill:white;stroke:none;font-size:10px}.communities{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--text-muted)}.communities span{display:inline-flex;align-items:center;gap:4px}.communities i{width:10px;height:10px;border-radius:50%}aside{min-width:0;max-height:780px;overflow:auto;padding:2px 6px 10px 0}aside>p,article p{margin-top:8px}article{padding:12px 0;border-bottom:1px solid var(--border);font-size:14px}article a{font-size:12px}.page-link{display:block;margin-top:8px}.shape{padding:22px 0;display:flex;gap:16px;align-items:center}.shape strong{font-size:42px;line-height:1}.shape span{font-size:13px;color:var(--text-muted)}.question,.match{display:block;width:100%;text-align:left;margin-bottom:8px}select{width:100%;white-space:normal;background:var(--surface-raised);color:var(--text);font:inherit;padding:8px;border:1px solid var(--border);margin-top:8px}blockquote{margin:20px 0;padding:0 0 0 14px;border-left:4px solid var(--action);font-size:18px}dt{font-weight:700;color:var(--text-muted);font-size:13px}dd{margin:0 0 15px}dd p{margin:0 0 8px}.statements{padding-left:22px}.statements li{padding-bottom:22px}.statements p{margin-top:0}summary{cursor:pointer;padding:10px 0;font-weight:650}details p{max-width:75ch}table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;padding:6px;border-bottom:1px solid var(--border)}td button{border:0;padding:0;text-align:left}.boundaries{margin-top:30px;border-top:1px solid var(--border);padding-top:22px;max-width:85ch}.boundaries>p{color:var(--text-muted)}footer{font-size:12px;color:var(--text-muted);padding:26px 0;max-width:100ch}.notfound{padding:16px;border:1px solid var(--warn)}
  @media(max-width:900px){main{padding:18px}.heading{display:block}nav{margin-top:20px}.workspace{grid-template-columns:minmax(0,1fr)}aside{max-height:none;overflow:visible}.field{padding:14px}form{display:block}form>div{margin-top:8px}header>span{display:none}h1{font-size:30px}svg{min-height:300px}.legend{font-size:12px}}
  @media(max-width:400px){main{padding:12px}form{padding:12px}form>div{display:block}form button{margin-top:8px;width:100%}.field-heading{display:block}.field-heading button{margin-top:8px}nav button{padding:7px 9px}h1{font-size:28px}.communities{gap:6px}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
