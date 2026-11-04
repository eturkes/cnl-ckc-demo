<script lang="ts">
  import { tick } from 'svelte';
  import { indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState, type Rule } from '../../shared/data.js';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let query = $state('');
  let selectedRec = $state<number | null>(null);
  let failure = $state('');
  const ix = $derived(g ? indexGuideline(g) : null);
  const key = (r: Rule) => `${r.document}:${r.sentence}`;
  const condition = (r: Rule) => r.condition || 'No explicit condition';
  const action = (r: Rule, a: Rule['actions'][number]) => `${r.mode === 'fact' ? '' : r.mode + ' '}${a.polarity === 'negative' ? 'not ' : ''}${a.verb} ${a.object}${a.modifiers.map(m => ` ${m.preposition} ${m.value}`).join('')}`;
  const conditions = $derived(g ? [...new Set(g.rules.map(condition))].sort() : []);
  const actions = $derived(g ? [...new Set(g.rules.flatMap(r => r.actions.map(a => action(r, a))))].sort() : []);
  const question = $derived(state.view === 'trace' ? g?.questions.find(q => q.id === state.question) : undefined);
  const matches = $derived(state.view === 'explore' && g ? g.documents.flatMap(d => d.sentences.filter(s => `${s.ace} ${d.source}`.toLowerCase().includes(state.query.toLowerCase())).map(s => ({document:d.id,sentence:s.n}))) : []);
  const refs = $derived(state.view === 'trace' ? question?.statements ?? [] : state.view === 'rule' ? [{document:state.document,sentence:state.sentence}] : state.view === 'explore' ? matches : []);
  const active = $derived(new Set(refs.map(r => `${r.document}:${r.sentence}`)));
  const rec = (r: Rule) => ix?.docs.get(r.document)?.rec ?? 1;
  const lit = (r: Rule) => selectedRec !== null ? rec(r) === selectedRec : active.has(key(r));
  const highlighted = $derived(g?.rules.filter(lit) ?? []);
  const litConditions = $derived(new Set(highlighted.map(condition)));
  const litActions = $derived(new Set(highlighted.flatMap(r => r.actions.map(a => action(r,a)))));
  const litRecs = $derived(new Set(highlighted.map(rec)));
  const point = (axis: number, i: number, count: number) => {
    const radius = 70 + (count <= 1 ? 0 : i / (count - 1)) * 205;
    const angle = [-90,150,30][axis] * Math.PI / 180;
    return {x:350 + Math.cos(angle)*radius,y:338 + Math.sin(angle)*radius};
  };
  const cp = (r: Rule) => point(1,conditions.indexOf(condition(r)),conditions.length);
  const rp = (r: Rule) => point(0,rec(r)-1,12);
  const ap = (r: Rule,a: Rule['actions'][number]) => point(2,actions.indexOf(action(r,a)),actions.length);
  const curve = (a:{x:number,y:number},b:{x:number,y:number}) => `M ${a.x} ${a.y} Q 350 338 ${b.x} ${b.y}`;
  function go(next:HashState) { selectedRec=null; state=next; writeHash(next); }
  $effect(() => {
    const update = () => { state=readHash(); selectedRec=null; };
    addEventListener('hashchange',update);
    void loadGuideline().then(data => g=data).catch(e => failure=String(e));
    return () => removeEventListener('hashchange',update);
  });
  $effect(() => { if(g || failure) { void state; void tick().then(markReady); } });
</script>

<main>
  <header><div><p class="brand">CNL / CKC <span>Graph study</span></p><h1>Clinical threads</h1></div><nav aria-label="Graph views"><button class:current={state.view==='overview'} onclick={()=>go({view:'overview'})}>Guideline shape</button><button class:current={state.view==='trace'} onclick={()=>go({view:'trace',question:g?.questions[1]?.id ?? ''})}>Trace an answer</button><button class:current={state.view==='explore'} onclick={()=>go({view:'explore',query:'naloxone'})}>Explore the KB</button></nav></header>
  {#if failure}<p role="alert">{failure}</p>{:else if !g || !ix}<p>Loading the guideline…</p>{:else}
    <p class="intro">Conditions, recommendations and actions share one rule thread. Follow a thread to read its source.</p>
    <p class="notice">{g.derivation}</p>
    <form onsubmit={e=>{e.preventDefault();go({view:'explore',query});}}><label for="search">Find a clinical term</label><input id="search" bind:value={query} placeholder="For example, naloxone"/><button>Find sentences</button></form>
    <div class="workspace">
      <section class="chart" aria-label="Hive plot">
        <div class="chart-heading"><h2>{state.view==='overview' ? 'The guideline at a glance' : state.view==='trace' ? 'The answer’s threads' : state.view==='rule' ? 'One rule’s thread' : 'Matching threads'}</h2><span>{g.rules.length} rules / {g.recommendations.length} recommendations</span></div>
        <svg viewBox="0 0 700 570" role="img" aria-label="Three radial axes connect conditions to recommendations to actions. Use the recommendation buttons or sentence list to select threads.">
          <title>Clinical rule hive plot</title>
          <g class="axes"><path d="M350 338 L350 63 M350 338 L112 476 M350 338 L588 476"/></g>
          <g class="threads">{#each g.rules as r}<path class:lit={lit(r)} d={curve(cp(r),rp(r))}/>{#each r.actions as a}<path class:lit={lit(r)} d={curve(rp(r),ap(r,a))}/>{/each}{/each}</g>
          {#each conditions as c,i}{@const p=point(1,i,conditions.length)}<circle class="point" class:highlight={litConditions.has(c)} cx={p.x} cy={p.y} r={litConditions.has(c)?5:3}><title>{c}</title></circle>{/each}
          {#each actions as a,i}{@const p=point(2,i,actions.length)}<path class="point" class:highlight={litActions.has(a)} d={`M${p.x} ${p.y-4} l4 4 -4 4 -4 -4 Z`}><title>{a}</title></path>{/each}
          {#each g.recommendations as r,i}{@const p=point(0,i,12)}<rect class="rec-point" class:highlight={litRecs.has(r.number)} x={p.x-5} y={p.y-5} width="10" height="10"/><text x={p.x+15} y={p.y+5}>{r.number}</text>{/each}
          <text x="350" y="30" text-anchor="middle" class="axis-title">Recommendations</text><text x="88" y="520" class="axis-title">Conditions</text><text x="525" y="520" class="axis-title">Actions</text>
          <text x="350" y="345" text-anchor="middle" class="centre">RULES</text>
        </svg>
        <p class="legend">● condition / ■ recommendation / ◆ action. Curves join parts of the same rule; blue marks the selection.</p>
        <div class="rec-buttons" aria-label="Isolate a recommendation">{#each g.recommendations as r}<button aria-pressed={selectedRec===r.number} onclick={()=>{selectedRec=selectedRec===r.number?null:r.number;}}>R{r.number}</button>{/each}</div>
        <p class="small">Stable order: conditions and actions alphabetically; recommendations numerically. Distance does not measure clinical importance.</p>
        <details><summary>Read the plotted rules as a table</summary><table><thead><tr><th>Rule</th><th>Condition</th><th>Action</th></tr></thead><tbody>{#each g.rules.filter(r=>selectedRec===null || rec(r)===selectedRec) as r}<tr><td><button onclick={()=>go({view:'rule',document:r.document,sentence:r.sentence})}>R{rec(r)} S{r.sentence}</button></td><td>{condition(r)}</td><td>{r.actions.map(a=>action(r,a)).join('; ')}</td></tr>{/each}</tbody></table></details>
      </section>
      <section class="reading" aria-label="Reading panel">
        {#if state.view==='overview'}
          <h2>{selectedRec ? `Recommendation ${selectedRec}` : 'Choose a thread'}</h2><p>The hive separates a rule’s circumstances from what it recommends. Select a recommendation below the plot, then open one sentence.</p>
          {#each g.recommendations.filter(r=>selectedRec===null || r.number===selectedRec) as r}<details open={selectedRec===r.number}><summary>Recommendation {r.number} <span>page {r.page}</span></summary><p>{r.source}</p>{#each g.rules.filter(rule=>rec(rule)===r.number) as rule}<button class="rule-link" onclick={()=>go({view:'rule',document:rule.document,sentence:rule.sentence})}>Sentence {rule.sentence}: {rule.original}</button>{/each}</details>{/each}
        {:else}
          {#if state.view==='trace'}<label for="question">Answer to trace</label><select id="question" value={question?.id ?? ''} onchange={e=>go({view:'trace',question:e.currentTarget.value})}>{#each g.questions as q}<option value={q.id}>{q.question}</option>{/each}</select><h2>{question?.question ?? 'Question not found'}</h2><p>Statements below follow answer order. Open a sentence to isolate its rule.</p>
          {:else if state.view==='explore'}<h2>Matches for “{state.query}”</h2><p>{matches.length} statements whose sentence or source passage contains this term. The plot highlights clinical rules among these matches.</p>
          {:else}<h2>Rule reading</h2>{/if}
          {#if refs.length===0}<p>No matching statements. Try another term.</p>{/if}
          {#each refs as ref,i}
            {@const id=`${ref.document}:${ref.sentence}`}{@const sentence=ix.sentence(id)}{@const doc=ix.docs.get(ref.document)}{@const rule=ix.rules.get(id)}
            {#if !sentence || !doc}<p role="status">Sentence not found: {id}</p>{:else}
              <article><div class="source-id">{state.view==='trace' ? `Statement ${i+1}` : doc.kind} / {ref.document} / sentence {ref.sentence}</div><p class="sentence">{sentence.ace}</p>
              {#if state.view==='rule'}<dl><dt>{rule ? 'Condition' : 'Condition (text reading)'}</dt><dd>{rule ? condition(rule) : sentence.condition || 'No explicit condition in the text split'}</dd><dt>{rule ? 'Actor' : 'Conclusion (text reading)'}</dt><dd>{rule?.subject ?? sentence.conclusion}</dd>{#if rule}<dt>Modality and action</dt><dd>{rule.actions.map(a=>action(rule,a)).join('; ')}</dd>{/if}</dl>{:else}<button onclick={()=>go({view:'rule',document:ref.document,sentence:ref.sentence})}>Explain this sentence</button>{/if}
              <details open={state.view==='rule'}><summary>Guideline source / page {doc.page}</summary><blockquote>{doc.source}</blockquote><a href={`${g.pdf}#page=${doc.page}`} target="_blank" rel="noreferrer">Open guideline page {doc.page}</a></details></article>
            {/if}
          {/each}
        {/if}
      </section>
    </div>
    <section class="bounds"><details><summary>Scope exclusions ({g.exclusions.length} records)</summary><p>The recommendations do not apply under these conditions. No exclusion does not establish that a patient belongs to the guideline’s population.</p>{#each g.exclusions as ex}<p>{ex.ace} <button onclick={()=>go({view:'rule',document:ex.document,sentence:ex.sentence})}>Source sentence</button></p>{/each}</details><details><summary>Superseded statements ({g.supersessions.length})</summary>{#each g.supersessions as s}<p><s>{s.ace}</s><br/>Superseded {String(s.date).slice(0,4)}-{String(s.date).slice(4,6)}-{String(s.date).slice(6)} by <a href={s.url}>{s.citation}</a>. <button onclick={()=>go({view:'rule',document:s.document,sentence:s.sentence})}>Source sentence</button></p>{/each}</details></section>
  {/if}
</main>

<style>
  main{max-width:1440px;margin:auto;padding:28px 36px}header{display:flex;justify-content:space-between;gap:24px;align-items:center}.brand{font-weight:700;margin:0}.brand span{font-weight:400;color:var(--text-muted);margin-left:12px}h1{font-size:36px;line-height:1.15;margin:12px 0}h2{font-size:21px;line-height:1.25;margin:0 0 16px}nav{display:flex;flex-wrap:wrap;gap:8px}button,input,select{border:1px solid var(--border);background:var(--surface-raised);color:var(--text);border-radius:3px;padding:8px 12px}button{cursor:pointer}button:hover{background:var(--surface-sunken)}button.current,button[aria-pressed=true]{background:var(--action);color:var(--action-text);border-color:var(--action)}:is(button,input,select,a,summary):focus-visible{outline:3px solid var(--focus-ring);outline-offset:3px}a{color:var(--action)}.intro{font-size:19px;max-width:65ch;margin-bottom:8px}.notice,.small{color:var(--text-muted);font-size:13px}.notice{margin-top:0}form{display:flex;gap:10px;align-items:center;margin:24px 0}input{width:260px;min-width:0}.workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);border-top:1px solid var(--border)}.chart{min-width:0;padding:24px 24px 24px 0}.chart-heading{display:flex;gap:12px;justify-content:space-between}.chart-heading span{color:var(--text-muted);font-size:13px;max-width:140px}.reading{min-width:0;border-left:1px solid var(--border);padding:24px;max-height:720px;overflow:auto;background:var(--surface-raised)}svg{display:block;width:100%;height:auto;max-height:520px}.axes path{stroke:var(--text-muted);stroke-width:1;fill:none}.threads path{fill:none;stroke:var(--border);stroke-width:.8;opacity:1}.threads .lit{stroke:var(--action);stroke-width:3;opacity:1}.point{fill:var(--text);stroke:var(--surface);stroke-width:1}.rec-point{fill:var(--surface-raised);stroke:var(--text);stroke-width:2}.highlight{fill:var(--action);stroke:var(--surface);stroke-width:1.5}text{fill:var(--text);font:16px var(--font-ui)}.axis-title{font-weight:700;font-size:20px}.centre{font-size:11px;fill:var(--text-muted)}.legend{font-size:13px}.rec-buttons{display:flex;gap:5px;flex-wrap:wrap}.rec-buttons button{padding:5px 10px}details{border-top:1px solid var(--border);padding:14px 0}summary{cursor:pointer;font-weight:600}summary span{font-weight:400;color:var(--text-muted)}p{max-width:72ch}.rule-link{text-align:left;display:block;width:100%;margin-top:8px;font-size:14px}.source-id{font-size:12px;color:var(--text-muted);overflow-wrap:anywhere}.sentence{font-family:var(--font-prose);font-size:16px;line-height:1.7}article{padding:18px 0;border-bottom:1px solid var(--border)}select{width:100%;margin:6px 0 20px;font:inherit}blockquote{font-family:var(--font-prose);margin:16px 0;line-height:1.7}dt{font-weight:700}dd{margin:4px 0 15px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:8px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border);overflow-wrap:anywhere}.bounds{display:grid;grid-template-columns:1fr 1fr;gap:24px}.bounds p{font-size:14px}section,article,blockquote,dd{overflow-wrap:anywhere}@media(max-width:760px){main{padding:20px 16px}header{display:block}h1{font-size:30px}nav{margin-top:20px}nav button{flex:1;font-size:13px;padding:8px}form{flex-wrap:wrap}form label{width:100%}input{flex:1;width:100px}.workspace{display:block}.chart{padding:20px 0}.reading{border-left:0;border-top:1px solid var(--border);padding:20px 0;max-height:none;background:transparent}.chart-heading{display:block}.chart-heading span{max-width:none}svg{margin-top:18px}.bounds{display:block}svg text:not(.axis-title){display:none}.axis-title{font-size:30px}.intro{font-size:17px}.small{font-size:12px}.legend{font-size:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
