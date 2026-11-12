<script lang="ts">
  import { tick } from 'svelte';
  import { loadGuideline, indexGuideline, readHash, writeHash, markReady, type Guideline, type HashState } from '../../shared/data.js';
  import { project, RISKS, CARE, readable } from './model.js';
  let g=$state.raw<Guideline|null>(null);
  let view=$state.raw<HashState>(readHash());
  let selected=$state('');
  let search=$state(view.view==='explore'?view.query:'');
  const model=$derived(g?project(g):{nodes:[],edges:[]});
  const ix=$derived(g?indexGuideline(g):null);
  const question=$derived(view.view==='trace'?g?.questions.find(q=>q.id===view.question):undefined);
  const keys=$derived(new Set(question?.statements.map(s=>`${s.document}:${s.sentence}`)??[]));
  const current=$derived(view.view==='rule'?`${view.document}:${view.sentence}`:'');
  const rule=$derived(ix?.rules.get(current));
  const matches=$derived(view.view==='explore'?model.nodes.filter(n=>n.label.includes(readable(view.query.toLowerCase()))):[]);
  const lit=$derived(model.edges.filter(e=>view.view==='trace'?e.rules.every(k=>keys.has(k)):view.view==='rule'?e.rules.includes(current):view.view==='explore'?matches.some(n=>n.id===e.source||n.id===e.target):false));
  const active=$derived(new Set(lit.map(e=>e.id)));
  const activeNodes=$derived(new Set(lit.flatMap(e=>[e.source,e.target])));
  const picked=$derived(model.edges.find(e=>e.id===selected));
  const groups=$derived.by(()=>{
    const out=new Map<string,typeof model.edges>();
    for(const e of model.edges){const k=`${e.source}/${e.target}/${e.negative}/${e.type}`;out.set(k,[...(out.get(k)??[]),e]);}
    return [...out].map(([id,edges])=>({id,edges,source:edges[0].source,target:edges[0].target,negative:edges[0].negative,type:edges[0].type}));
  });
  const pos=$derived.by(()=>{
    const out=new Map<string,{x:number;y:number}>();
    for(const [kind,x] of [['care',130],['risk',600]] as const)model.nodes.filter(n=>n.kind===kind).forEach((n,i)=>out.set(n.id,{x,y:65+i*65}));
    return out;
  });
  const graphHeight=$derived(Math.max(460,Math.max(model.nodes.filter(n=>n.kind==='care').length,model.nodes.filter(n=>n.kind==='risk').length)*65+60));
  const short=(s:string)=>s.replace('controlled substance prescription history','prescription history').replace('evidence based medication treatment','evidence based\nmedication treatment');
  function go(v:HashState){view=v;selected='';if(v.view==='explore')search=v.query;writeHash(v);}
  function openRule(k:string){const at=k.lastIndexOf(':');go({view:'rule',document:k.slice(0,at),sentence:Number(k.slice(at+1))});}
  $effect(()=>{const change=()=>{view=readHash();selected='';if(view.view==='explore')search=view.query;};addEventListener('hashchange',change);void loadGuideline().then(d=>g=d);return()=>removeEventListener('hashchange',change);});
  $effect(()=>{view;selected;if(g)void tick().then(markReady);});
</script>

{#snippet evidence(k:string)}
  {@const r=ix?.rules.get(k)}
  {@const d=ix?.docs.get(k.slice(0,k.lastIndexOf(':')))}
  <article class="evidence">
    <button class="link" onclick={()=>openRule(k)}>Recommendation {d?.rec}, sentence {k.split(':')[1]}</button>
    <h3>Verbatim condition</h3><p class="condition">{r?.condition??'No condition stated in this sentence.'}</p>
    <p>{r?.original??ix?.sentence(k)?.ace}</p>
    {#if d&&g}<a href={`${g.pdf}#page=${d.page}`} target="_blank" rel="noreferrer">Open guideline page {d.page}</a>{/if}
  </article>
{/snippet}

<main>
  <header><a href="#overview" onclick={()=>go({view:'overview'})}>CNL / CKC</a><span>Clinical network studies</span></header>
  <div class="heading"><div><h1>Risks and safeguards</h1><p>Which care actions connect to named risks in a rule or recommendation?</p></div>
    <nav aria-label="Graph views"><button onclick={()=>go({view:'overview'})} aria-current={view.view==='overview'?'page':undefined}>Guideline shape</button><button onclick={()=>g&&go({view:'trace',question:g.questions[0].id})}>Trace an answer</button><button onclick={()=>go({view:'rule',document:'cdc2022-opioid-rec09',sentence:2})}>Read one rule</button></nav>
  </div>
  {#if g&&ix}
    <p class="reading">Prototype reading: <strong>strong lines = same rule; pale lines = named in the same recommendation</strong>, in separate rules. Neither means prevention. The term lists are hand-made, not KB categories. Medication-free detoxification is advised against.</p>
    <details class="taxonomy"><summary>Which terms did this prototype select?</summary><p>This hand-made list is this prototype's reading, not a taxonomy in the knowledge base.</p><p>Risks and testing tradeoffs: {RISKS.map(readable).join(', ')}.</p><p>Testing benefit is a tradeoff, not a harm. Care: {CARE.map(readable).join(', ')}. Opioid and opioid dosage appear only for tapering, reduction or discontinuation.</p></details>
    <form onsubmit={e=>{e.preventDefault();go({view:'explore',query:search});}}><label for="search">Explore a risk or care action</label><input id="search" bind:value={search} placeholder="Try naloxone or overdose"/><button type="submit">Find connections</button></form>
    <div class="workspace" class:detail={view.view!=='overview'||selected!==''}>
      <section class="diagram" aria-label="Risk and safeguard network">
        <div class="diagram-heading"><span>Care actions</span><span>Risks and tradeoffs</span></div>
        <div class="scroll"><svg viewBox={`0 0 730 ${graphHeight}`} aria-label="Care actions and risks joined by same-rule or same-recommendation links">
          {#each groups as line (line.id)}
            {@const a=pos.get(line.source)!}{@const b=pos.get(line.target)!}
            {@const highlighted=line.edges.some(e=>active.has(e.id))}
            <path d={`M ${a.x+12} ${a.y} C 330 ${a.y}, 400 ${b.y}, ${b.x-12} ${b.y}`} class="edge" class:negative={line.negative} class:weak={line.type==='recommendation'} class:lit={highlighted||line.edges.some(e=>e.id===selected)} class:dim={view.view!=='overview'&&!highlighted}/>
            <path d={`M ${a.x+12} ${a.y} C 330 ${a.y}, 400 ${b.y}, ${b.x-12} ${b.y}`} class="hit" role="button" tabindex="0" aria-label={`${readable(line.source)} linked to ${readable(line.target)}; ${line.edges.length} supporting actions${line.type==='recommendation'?'; named in the same recommendation':''}`} onclick={()=>selected=line.edges[0].id} onkeydown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=line.edges[0].id;}}}><title>{line.edges.map(e=>e.text).join('; ')}</title></path>
            {#if line.type==='recommendation'}<text x="365" y={(a.y+b.y)/2-5} text-anchor="middle" class="weak-label" class:dim={view.view!=='overview'&&!highlighted}>named in the same recommendation</text>{/if}
          {/each}
          {#each model.nodes as n (n.id)}
            {@const p=pos.get(n.id)!}
            <g class="node" class:dim={view.view!=='overview'&&!activeNodes.has(n.id)&&!matches.some(m=>m.id===n.id)} role="button" tabindex="0" aria-label={n.label} onclick={()=>go({view:'explore',query:n.label})} onkeydown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go({view:'explore',query:n.label});}}}>
              <circle cx={p.x} cy={p.y} r="10" class:risk={n.kind==='risk'} class:care={n.kind==='care'}/>
              <text x={p.x} y={p.y+25} text-anchor="middle">{#each short(n.label).split('\n') as row,i}<tspan x={p.x} dy={i===0?0:15}>{row}</tspan>{/each}</text>
            </g>
          {/each}
        </svg></div>
        <div class="legend"><span><i class="dot care"></i>Care action</span><span><i class="dot risk"></i>Risk / harm / tradeoff</span><span>Strong: same rule</span><span>Pale: named in the same recommendation</span><span>Dashed: should not</span></div>
        <p class="note">Select a line for its action labels and every supporting rule. Read the same connections in the table below. Pale links do not carry advice from one rule to another. Unconnected nodes have no link under either reading.</p>
      </section>
      <aside aria-live="polite">
        {#if picked}
          <h2>{readable(picked.source)}</h2><p>{picked.type==='rule'?'Linked in one rule to':'Named in the same recommendation as'} <strong>{readable(picked.target)}</strong>.</p>
          {#each model.edges.filter(e=>e.source===picked.source&&e.target===picked.target&&e.negative===picked.negative&&e.type===picked.type) as e (e.id)}<p class="action">{e.text}</p><p class="note">{e.basis}</p>{/each}
          {#each [...new Set(model.edges.filter(e=>e.source===picked.source&&e.target===picked.target&&e.negative===picked.negative&&e.type===picked.type).flatMap(e=>e.rules))] as k (k)}{@render evidence(k)}{/each}
        {:else if view.view==='trace'}
          <h2>Trace an answer</h2><select aria-label="Prepared question" value={question?.id??''} onchange={e=>go({view:'trace',question:e.currentTarget.value})}>{#each g.questions as q}<option value={q.id}>{q.question}</option>{/each}</select>
          {#if question}<p>{lit.length} actions in this risk-focused network come from the answer's {question.statements.length} statements.</p>{#if !lit.length}<p class="notice">This answer has no selected care–risk connection. Its statements remain available below; no link is inferred.</p>{/if}{#each question.statements as s}{@render evidence(`${s.document}:${s.sentence}`)}{/each}{:else}<p class="notice">Question not found. Choose a prepared question.</p>{/if}
        {:else if view.view==='rule'}
          <h2>One rule, whole</h2>{#if ix.sentence(current)}{@render evidence(current)}{#if !lit.length}<p class="notice">This rule has no selected care–risk connection.</p>{/if}{:else}<p class="notice">Rule not found. Select a connection to read its rules.</p>{/if}
        {:else if view.view==='explore'}
          <h2>Explore “{view.query}”</h2>{#if !matches.length}<p class="notice">No selected concept matches. Try naloxone, risk or overdose.</p>{/if}
          {#each matches as n}<h3>{n.label}</h3>{#if !model.edges.some(e=>e.source===n.id||e.target===n.id)}<p class="notice">The parsed recommendation rules name this intervention but do not connect it to a selected risk under either link type.</p>{/if}{#each n.rules as k}{@render evidence(k)}{/each}{/each}
        {:else}
          <h2>Read the risk connections</h2><p>{model.nodes.length} selected concepts, {model.edges.length} links: {model.edges.filter(e=>e.type==='rule').length} same-rule actions and {model.edges.filter(e=>e.type==='recommendation').length} same-recommendation associations.</p>
          <p>The clearest shared-rule link is prescription-history review with high overdose risk. Detoxification has explicit links to increased overdose, overdose death and drug-use resumption risk.</p>
          <button class="wide" onclick={()=>go({view:'explore',query:'high overdose risk'})}>Explore high overdose risk</button><button class="wide" onclick={()=>go({view:'explore',query:'naloxone'})}>Explore naloxone’s recommendation</button>
          <h3>Start with an answer</h3>{#each g.questions as q}<button class="wide" onclick={()=>go({view:'trace',question:q.id})}>{q.question}</button>{/each}
        {/if}
      </aside>
    </div>
    <details class="table"><summary>Read {lit.length?lit.length:model.edges.length} connections as a table</summary><div class="table-scroll"><table><thead><tr><th>Care action</th><th>Risk</th><th>Rule's action</th><th>Supporting rule</th></tr></thead><tbody>{#each lit.length?lit:model.edges as e}<tr><td>{readable(e.source)}</td><td>{readable(e.target)}</td><td>{e.text}<br/><small>{e.basis}</small></td><td>{#each e.rules as k}<button class="link" onclick={()=>openRule(k)}>{k.replace('cdc2022-opioid-','')}</button><br/>{/each}</td></tr>{/each}</tbody></table></div></details>
    <section class="boundaries"><h2>Where the recommendations stop</h2><details><summary>{g.exclusions.length} scope exclusion records</summary><p>The recommendations do not apply under these conditions. An absent exclusion does not prove that the patient belongs to the guideline's population.</p>{#each g.exclusions as e}<p>{e.ace}</p>{/each}</details><details><summary>{g.supersessions.length} superseded statements</summary>{#each g.supersessions as s}<p><s>{s.ace}</s> Superseded {String(s.date)} by <a href={s.url}>{s.citation}</a>.</p>{/each}</details></section>
    <footer>{g.derivation} Clinical demonstration only. Source: CDC. CDC does not endorse this demo. Guideline material is free on the CDC website.</footer>
  {:else}<p>Loading the guideline…</p>{/if}
</main>

<style>
 main{max-width:1480px;margin:auto;padding:24px 32px}header{display:flex;gap:20px;border-bottom:1px solid var(--border);padding-bottom:16px}header a{font-weight:800;color:var(--text);text-decoration:none}header span{color:var(--text-muted)}.heading{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:25px 0 16px}h1{font-size:34px;line-height:1.15;margin:0 0 8px}h2{font-size:22px;line-height:1.25;margin-top:0}h3{font-size:15px;margin:14px 0 4px}p{max-width:78ch}.heading p{margin:0;color:var(--text-muted)}nav{display:flex;gap:6px;flex-wrap:wrap}button,input,select{font:inherit;color:var(--text);background:var(--surface-raised);border:1px solid var(--border);padding:8px 12px;border-radius:3px;max-width:100%}button{cursor:pointer}button:hover{border-color:var(--action)}button[aria-current='page'],button[type='submit']{background:var(--action);color:var(--action-text)}:global(:focus-visible){outline:3px solid var(--focus-ring);outline-offset:3px}a,.link{color:var(--action)}a{overflow-wrap:anywhere}.reading{border-left:4px solid var(--graph-entity);padding-left:14px;font-size:14px;margin-bottom:8px}.taxonomy{font-size:13px;margin-bottom:16px;max-width:95ch}summary{cursor:pointer;font-weight:650;padding:7px 0}form{display:flex;gap:10px;align-items:center;background:var(--surface-sunken);padding:12px;margin-bottom:18px}input{min-width:0;flex:1}label{font-weight:650}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px}.diagram{min-width:0;background:var(--surface-raised);border:1px solid var(--border)}.diagram-heading{display:flex;justify-content:space-between;padding:12px 10%;font-weight:750;border-bottom:1px solid var(--border)}.scroll{overflow-x:auto}svg{display:block;width:100%}.edge{fill:none;stroke:var(--graph-edge);stroke-width:1.5;opacity:.65}.edge.weak{stroke-width:1;opacity:.3}.weak-label{font-size:10px;fill:var(--text-muted);paint-order:stroke;stroke:var(--surface-raised);stroke-width:4px;pointer-events:none}.edge.negative{stroke-dasharray:7 4}.edge.lit{stroke:var(--action);stroke-width:3;opacity:1}.edge.weak.lit{stroke-width:1.5;opacity:.65}.dim{opacity:.16}.hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}.node{cursor:pointer}.node text{fill:var(--text);font-size:14px;font-weight:650;paint-order:stroke;stroke:var(--surface-raised);stroke-width:4px}.care{fill:var(--graph-entity);background:var(--graph-entity)}.risk{fill:var(--graph-operator);background:var(--graph-operator)}.legend{display:flex;flex-wrap:wrap;gap:8px 16px;padding:12px;font-size:12px;border-top:1px solid var(--border)}.legend span{display:flex;align-items:center;gap:6px}.dot{width:11px;height:11px;border-radius:50%}.note{font-size:13px;color:var(--text-muted)}.diagram>.note{padding:0 12px 10px}aside{min-width:0;max-height:820px;overflow:auto}select{width:100%}.wide{display:block;width:100%;text-align:left;margin:8px 0}.evidence{border-top:1px solid var(--border);padding:12px 0;font-size:14px}.condition{border-left:3px solid var(--graph-operator);padding-left:10px;overflow-wrap:anywhere}.action{font-weight:650}.link{border:0;background:none;text-decoration:underline;padding:0;text-align:left}.notice{border-left:3px solid var(--warn);padding:8px 12px;background:var(--surface-sunken);font-size:14px}.table{margin-top:20px}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--border)}.boundaries{margin-top:24px;border-top:1px solid var(--border);padding-top:20px;max-width:90ch;font-size:14px}footer{font-size:12px;color:var(--text-muted);margin-top:24px;max-width:100ch}
 @media(max-width:900px){main{padding:16px}.heading{display:block}nav{margin-top:15px}.workspace{grid-template-columns:minmax(0,1fr)}aside{max-height:none;overflow:visible}.scroll svg{width:730px;max-width:none}.detail aside{order:-1;max-height:440px;overflow:auto}form{flex-wrap:wrap}form label{width:100%}h1{font-size:29px}.table-scroll table{min-width:650px}.diagram-heading{padding:10px 16px}}
 @media(max-width:400px){form input,form button{width:100%;flex:auto}header{font-size:13px;gap:12px}}
 @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
