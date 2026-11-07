<script lang="ts">
  import { tick } from 'svelte';
  import {loadGuideline,indexGuideline,readHash,writeHash,markReady,type Guideline,type HashState,type Rule} from '../../shared/data.js';
  import {pathway,key,readable} from './model.js';
  let g=$state.raw<Guideline|null>(null), view=$state.raw<HashState>(readHash());
  let search=$state(view.view==='explore'?view.query:''), selected=$state(''), recSelected=$state(0), selectedStep=$state('');
  $effect(()=>{const h=()=>{view=readHash();selected='';recSelected=0;if(view.view==='explore')search=view.query;};addEventListener('hashchange',h);void loadGuideline().then(d=>g=d);return()=>removeEventListener('hashchange',h);});
  const ix=$derived(g?indexGuideline(g):null);
  const model=$derived(g?pathway(g):{nodes:[],links:[],careSteps:[],eventLinks:[]});
  const step=$derived(model.careSteps.find(s=>s.id===selectedStep));
  const connected=$derived(new Set(model.links.flatMap(e=>[e.source,e.target])));
  const question=$derived(view.view==='trace'?g?.questions.find(q=>q.id===view.question):undefined);
  const trace=$derived(new Set(question?.statements.map(s=>`${s.document}:${s.sentence}`)??[]));
  const currentRule=$derived(view.view==='rule'?ix?.rules.get(`${view.document}:${view.sentence}`):undefined);
  const sentence=$derived(view.view==='rule'?ix?.sentence(`${view.document}:${view.sentence}`):undefined);
  const found=$derived(view.view==='explore'?model.nodes.filter(n=>`${n.number} ${g?.rules.filter(r=>r.document===n.id).map(r=>readable(`${r.condition??''} ${r.actions.map(a=>a.object).join(' ')}`)).join(' ')}`.toLowerCase().includes(view.query.toLowerCase().replaceAll('-',' '))):[]);
  const lit=$derived(new Set(model.links.filter(e=>selected?e.id===selected||model.eventLinks.some(x=>`event:${x.id}`===selected&&x.recLinks.includes(e.id)):recSelected?e.source===recSelected||e.target===recSelected:view.view==='trace'?e.matches.some(m=>trace.has(key(m.from))||trace.has(key(m.to))):view.view==='rule'?e.matches.some(m=>key(m.from)===`${view.document}:${view.sentence}`||key(m.to)===`${view.document}:${view.sentence}`):view.view==='explore'?found.some(n=>n.number===e.source||n.number===e.target):false).map(e=>e.id)));
  const chosen=$derived.by(()=>{const event=model.eventLinks.find(e=>`event:${e.id}`===selected);return event?{source:readable(event.source),target:readable(event.target),matches:model.links.filter(e=>event.recLinks.includes(e.id)).flatMap(e=>e.matches)}:model.links.find(e=>e.id===selected);});
  function go(v:HashState){view=v;selected='';recSelected=0;selectedStep='';if(v.view==='explore')search=v.query;writeHash(v);}
  function open(r:Rule){go({view:'rule',document:r.document,sentence:r.sentence});}
  const title=(id:string)=>[...new Set(g?.network.edges.filter(e=>e.rule.startsWith(`${id}:`)&&e.modal!=='fact').map(e=>`${e.verb} ${g?.network.nodes.find(n=>n.id===e.target)?.label??''}`)??[])].slice(0,2).join('; ');
  const active=(n:number)=>view.view==='trace'&&question?.documents.some(d=>ix?.docs.get(d)?.rec===n)||view.view==='rule'&&ix?.docs.get(view.document)?.rec===n||view.view==='explore'&&found.some(r=>r.number===n)||lit.size>0&&model.links.some(e=>lit.has(e.id)&&(e.source===n||e.target===n))||view.view==='overview'&&!selected&&!recSelected;
  // Longest simple upstream path gives the horizontal rank; no chronology is supplied.
  function rank(n:number,seen:number[]=[]):number {if(seen.includes(n))return 0;return Math.max(0,...model.links.filter(e=>e.target===n).map(e=>1+rank(e.source,[...seen,n])));}
  const positions=$derived.by(()=>{const out=new Map<number,{x:number;y:number}>();const levels=new Map<number,number[]>();for(const n of model.nodes.filter(n=>connected.has(n.number))){const r=rank(n.number);levels.set(r,[...(levels.get(r)??[]),n.number]);}for(const [r,ns]of levels)ns.forEach((n,i)=>out.set(n,{x:110+r*265,y:100+i*190}));return out;});
  $effect(()=>{view;selected;recSelected;selectedStep;if(g)void tick().then(markReady);});
  $effect(()=>{if((selected||selectedStep||recSelected)&&matchMedia('(max-width:600px)').matches)void tick().then(()=>document.querySelector('aside')?.scrollIntoView({behavior:'instant',block:'start'}));});
</script>

{#snippet ruleEvidence(r:Rule)}
  {@const d=ix?.docs.get(r.document)}
  <article class="evidence">
    <button class="text-link" onclick={()=>open(r)}>Recommendation {d?.rec}, sentence {r.sentence}</button>
    <h4>Condition, verbatim</h4><p class="condition">{r.condition??'No condition stated in this sentence.'}</p>
    <p>{#each g?.network.edges.filter(e=>e.rule===key(r))??[] as e}<span class="action" class:negative={e.negative}>{e.verb} {g?.network.nodes.find(n=>n.id===e.target)?.label} {e.detail}</span>{/each}</p>
    <details><summary>Controlled-language sentence and source</summary><p>{r.original}</p><p class="source">{d?.source}</p>{#if d&&g}<a target="_blank" rel="noreferrer" href={`${g.pdf}#page=${d.page}`}>Open guideline page {d.page}</a>{/if}</details>
  </article>
{/snippet}

<main>
  <header><a href="#overview" onclick={()=>go({view:'overview'})}>CNL / CKC</a><span>Clinical network studies</span></header>
  <div class="heading"><div><h1>Care hand-offs</h1><p>Where an action in one recommendation meets a condition in another.</p></div><nav aria-label="Views"><button onclick={()=>go({view:'overview'})}>Guideline shape</button><button onclick={()=>g&&go({view:'trace',question:g.questions[0].id})}>Trace an answer</button><button onclick={()=>go({view:'rule',document:'cdc2022-opioid-rec01',sentence:5})}>Read one rule</button></nav></div>
  <p class="warning"><strong>A partial pathway, not a treatment algorithm.</strong> A link matches a positive action’s verb and object to one phrase in another rule’s condition. It does not establish the whole condition or prove that care must proceed in this order.</p>
  {#if !g||!ix}<p>Loading the guideline…</p>{:else}
    <form onsubmit={e=>{e.preventDefault();go({view:'explore',query:search});}}><label for="search">Find a treatment or situation</label><div><input id="search" bind:value={search} placeholder="Try naloxone or chronic pain"/><button>Find recommendations</button></div></form>
    <div class="workspace" class:focused={view.view!=='overview'||!!selected||!!selectedStep||!!recSelected}>
      <section class="network" aria-label="Recommendation hand-off network">
        <div class="network-heading"><h2>Events in care</h2><p>{model.careSteps.length} events named in rule conditions; select one to read every attached rule.</p></div>
        <p class="reading"><strong>Prototype’s reading order, hand-made:</strong> consider initiation → start / prescribe → continue / receive → consider dose increase / change dose → opioid use disorder. This arrangement is not a KB-derived sequence. It does not imply that opioid therapy leads to opioid use disorder.</p>
        <div class="care-steps">
          {#each model.careSteps as s}
            {@const ownLinks=model.eventLinks.filter(e=>e.source===s.id)}
            <article class="care-step" class:step-lit={selectedStep===s.id||(view.view==='trace'&&s.rules.some(r=>trace.has(key(r))))||(view.view==='rule'&&s.rules.some(r=>key(r)===`${view.document}:${view.sentence}`))||(view.view==='explore'&&s.rules.some(r=>found.some(n=>n.id===r.document)))}>
              <button class="step-title" onclick={()=>{selectedStep=s.id;selected='';recSelected=0;}}>{s.label}<span>{s.rules.length} rules</span></button>
              {#each ownLinks as e}<button class="candidate" onclick={()=>{selected=`event:${e.id}`;selectedStep='';recSelected=0;}}>Positive hand-off → {model.careSteps.find(t=>t.id===e.target)?.label}</button>{/each}
            </article>
          {/each}
        </div>
        <p class="spine-key"><strong>Green links</strong> are the literal positive action-to-condition matches. Card order alone is the prototype’s reading. Tapering rules stay attached to “patient receives opioid therapy”; no “patient tapers” condition is invented.</p>
        <details class="recommendation-map"><summary>Show {model.links.length} matched recommendation links</summary>
        <div class="network-heading"><h2>{model.links.length} hand-offs found</h2><p>{connected.size} of {model.nodes.length} recommendations connect by the literal matching rule.</p></div>
        <svg viewBox="0 0 780 420" aria-label="Directed network of recommendations linked by matching actions and conditions">
          <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="var(--graph-entity)"/></marker></defs>
          {#each model.links as e}
            {@const a=positions.get(e.source)!}{@const b=positions.get(e.target)!}
            <g class="edge" class:lit={lit.has(e.id)} class:dim={lit.size>0&&!lit.has(e.id)}>
              <path d={`M${a.x+58} ${a.y} C${a.x+150} ${a.y} ${b.x-150} ${b.y} ${b.x-63} ${b.y}`} marker-end="url(#arrow)"/>
              <foreignObject x={(a.x+b.x)/2-69} y={(a.y+b.y)/2-37} width="138" height="75"><button class="edge-label" data-edge={e.id} onclick={()=>{selected=e.id;recSelected=0;}}>{readable(e.matches[0].phrase)}<small>{e.matches.length} rule pairs</small></button></foreignObject>
            </g>
          {/each}
          {#each model.nodes.filter(n=>connected.has(n.number)) as n}
            {@const p=positions.get(n.number)!}
            <g class:dim={!active(n.number)}><circle cx={p.x} cy={p.y} r="55"/><foreignObject x={p.x-52} y={p.y-46} width="104" height="94"><button class="rec-node" onclick={()=>{recSelected=n.number;selected='';}}><span>Rec {n.number}</span><small>Category {n.grade?.category}<br/>Evidence {n.grade?.evidenceType}</small></button></foreignObject></g>
          {/each}
        </svg>
        <div class="mobile-network">{#each model.nodes.filter(n=>connected.has(n.number)) as n}<div class="mobile-node" class:highlight={active(n.number)}><button onclick={()=>{recSelected=n.number;selected='';}}>Recommendation {n.number}</button>{#each model.links.filter(e=>e.source===n.number) as e}<button class="mobile-edge" data-edge={e.id} onclick={()=>{selected=e.id;recSelected=0;}}>{readable(e.matches[0].phrase)} → Rec {e.target}</button>{/each}</div>{/each}</div>
        <p class="legend"><i></i> Recommendation <span>Solid arrows = positive action-to-condition matches.</span></p></details>
        <h3>Without a matching hand-off</h3>
        <p class="muted">No link is drawn merely because recommendations share a treatment. Starting therapy, tapering and opioid use disorder do not form a complete sequence under this matching rule.</p>
        <div class="unmatched">{#each model.nodes.filter(n=>!connected.has(n.number)) as n}<button class:highlight={recSelected===n.number||(view.view==='trace'&&question?.documents.includes(n.id))||(view.view==='rule'&&view.document===n.id)||(view.view==='explore'&&found.some(r=>r.number===n.number))} onclick={()=>{recSelected=n.number;selected='';}}><strong>Rec {n.number}</strong><span>{title(n.id)}</span></button>{/each}</div>
        <details class="method"><summary>How this prototype reads a hand-off</summary><p>For each positive should / may / must action, remove the object’s article and trailing “cautiously”, then match its verb’s regular third-person form plus that exact object in another recommendation’s condition. No synonym or treatment-stage mapping is used. This is a text match, not a Prolog proof. All remaining conditions must still hold.</p><p>Hand-made reading order: consider initiation → start / prescribe → continue / receive → consider dose increase / change dose → opioid use disorder. Event nodes come from the conditions; their order is editorial. The optional recommendation map follows graph reachability, not chronology.</p></details>
      </section>
      <aside aria-live="polite">
        {#if chosen}
          <h2>{typeof chosen.source==='number'?`Rec ${chosen.source}`:chosen.source} to {typeof chosen.target==='number'?`Rec ${chosen.target}`:chosen.target}</h2><p>{chosen.matches.length} supporting rule pairs. A matched phrase is only part of the receiving condition.</p>
          {#each chosen.matches as m,i}<section class="pair"><h3>Hand-off {i+1}</h3><p><strong>Action:</strong> {m.action}</p><p><strong>Matched condition phrase:</strong> {m.phrase}</p><h3>Action rule</h3>{@render ruleEvidence(m.from)}<h3>Receiving rule</h3>{@render ruleEvidence(m.to)}</section>{/each}
        {:else if step}
          <h2>{step.label}</h2><p>This event appears in {step.rules.length} rule conditions. Each whole condition remains binding; the event alone is not enough.</p>{#each step.rules as r}{@render ruleEvidence(r)}{/each}
        {:else if recSelected}
          <h2>Recommendation {recSelected}</h2><p>{connected.has(recSelected)?'Its matched hand-offs are highlighted. Select an arrow to read both rules.':'No positive verb-and-object hand-off was found. Its rules still apply on their own conditions.'}</p>
          {#each g.rules.filter(r=>ix?.docs.get(r.document)?.rec===recSelected) as r}{@render ruleEvidence(r)}{/each}
        {:else if view.view==='trace'}
          <h2>Trace an answer</h2><label for="question">Prepared question</label><select id="question" value={question?.id} onchange={e=>go({view:'trace',question:e.currentTarget.value})}>{#each g.questions as q}<option value={q.id}>{q.question}</option>{/each}</select>
          {#if question}<p>The answer’s recommendation nodes and any matching hand-offs light up. Each statement below opens its sentence and guideline page. This prototype uses offline statement records, not a live answer.</p>{#each question.statements as s}{@const r=ix.rules.get(`${s.document}:${s.sentence}`)}{#if r}{@render ruleEvidence(r)}{:else}<p>{ix.sentence(`${s.document}:${s.sentence}`)?.ace}</p>{/if}{/each}{:else}<p class="warning">Question not found. Choose a prepared question.</p>{/if}
        {:else if view.view==='rule'}
          <h2>One rule, whole</h2>{#if currentRule}{@render ruleEvidence(currentRule)}<p>{lit.size} matching hand-offs involve this rule. No hand-off means no literal action-to-condition match, not that the rule is unimportant.</p>{:else if sentence}<p>{sentence.ace}</p><p>No clinical parse is available for this sentence.</p>{:else}<p class="warning">Rule not found. Select a recommendation or arrow.</p>{/if}
        {:else if view.view==='explore'}
          <h2>Recommendations for “{view.query}”</h2>{#if found.length}{#each found as n}<button class="result" onclick={()=>recSelected=n.number}>Recommendation {n.number}<span>{title(n.id)}</span></button>{/each}{:else}<p class="warning">No recommendation matches. Try a shorter treatment or situation name.</p>{/if}
        {:else}
          <h2>What can connect?</h2><p>Continuing opioid therapy in recommendation 5 meets conditions in recommendations 4 and 7. Prescribing the opioid in recommendation 4 meets conditions in recommendations 10 and 11.</p><p>These are candidate hand-offs between rules, not instructions to move a patient along a fixed pathway.</p><h3>Inspect a hand-off</h3>{#each model.links as e}<button class="result" data-edge={e.id} onclick={()=>selected=e.id}>Rec {e.source} to Rec {e.target}<span>{readable(e.matches[0].phrase)}</span></button>{/each}<h3>Start with an answer</h3>{#each g.questions as q}<button class="result" onclick={()=>go({view:'trace',question:q.id})}>{q.question}</button>{/each}
        {/if}
      </aside>
    </div>
    <details class="edge-table"><summary>Read all {model.links.length} hand-offs as a table</summary><table><thead><tr><th>From</th><th>To</th><th>Matched phrase</th><th>Rule pairs</th></tr></thead><tbody>{#each model.links as e}<tr><td>Rec {e.source}</td><td>Rec {e.target}</td><td><button class="text-link" onclick={()=>selected=e.id}>{readable(e.matches[0].phrase)}</button></td><td>{e.matches.length}</td></tr>{/each}</tbody></table></details>
    <section class="boundaries"><h2>Where this pathway stops</h2><details><summary>{g.exclusions.length} scope exclusion records</summary><p>The recommendations do not apply under these conditions. An absent exclusion does not prove that a patient belongs to the guideline’s population.</p>{#each g.exclusions as e}<p>{e.ace}</p>{/each}</details><details><summary>{g.supersessions.length} superseded statements</summary>{#each g.supersessions as s}<p><s>{s.ace}</s> Superseded {s.date} by <a href={s.url}>{s.citation}</a>.</p>{/each}</details></section>
    <footer>{g.derivation} Clinical demonstration only. Source: CDC. CDC does not endorse this demo. Guideline material is free on the CDC website.</footer>
  {/if}
</main>

<style>
  main{max-width:1450px;margin:auto;padding:22px 30px}header{display:flex;gap:24px;border-bottom:1px solid var(--border);padding-bottom:14px}header a{font-weight:750;text-decoration:none;color:var(--text)}header span,.muted{color:var(--text-muted)}.heading{display:flex;justify-content:space-between;align-items:end;gap:25px;padding:24px 0 16px}h1{font-size:34px;line-height:1.1;margin:0 0 8px}.heading p{margin:0}nav{display:flex;gap:6px;flex-wrap:wrap}button,input,select{font:inherit;color:var(--text);border:1px solid var(--border);background:var(--surface-raised);border-radius:4px;padding:8px 10px;max-width:100%}button{cursor:pointer}button:hover{border-color:var(--action)}:global(:focus-visible){outline:3px solid var(--focus-ring);outline-offset:3px}a{color:var(--action);overflow-wrap:anywhere}.warning{padding:12px 16px;border-left:4px solid var(--graph-event);background:var(--surface-sunken);max-width:100ch}.warning strong{display:block}form{display:flex;align-items:center;gap:20px;margin:20px 0}form label{font-weight:650}form>div{display:flex;gap:8px;flex:1}input{flex:1;min-width:0}form button{background:var(--action);color:var(--action-text)}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 345px;gap:24px}.network{border:1px solid var(--border);background:var(--surface-raised);min-width:0;padding-bottom:16px}.network-heading{padding:16px 20px 0}.network-heading h2{margin:0;font-size:22px}.network-heading p{margin:4px 0;color:var(--text-muted)}svg{display:block;width:100%}svg circle{fill:var(--graph-document)}.rec-node{width:100%;height:100%;border:0;border-radius:50%;padding:6px;background:transparent;color:var(--graph-label);text-align:center}.rec-node span{display:block;font-size:22px;font-weight:750}.rec-node small{display:block;font-size:12px;line-height:1.25}.edge path{stroke:var(--graph-entity);stroke-width:2;fill:none}.edge.lit path{stroke-width:4}.edge-label{font-size:13px;line-height:1.2;white-space:normal;width:100%;border-color:var(--graph-entity);padding:5px}.edge-label small{display:block;color:var(--text-muted);font-size:11px;margin-top:4px}.lit .edge-label{box-shadow:0 0 0 2px var(--graph-entity)}.dim{opacity:.22}.legend{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 20px 16px;font-size:12px;color:var(--text-muted)}.legend i{width:12px;height:12px;background:var(--graph-document);border-radius:50%}.network>h3,.network>.muted{margin:12px 20px}.network>.muted{font-size:13px}.unmatched{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:12px 20px}.unmatched button{text-align:left;font-size:13px}.unmatched span{display:block;color:var(--text-muted);font-size:12px;margin-top:3px}.highlight{outline:2px solid var(--action)}.method{margin:12px 20px;font-size:13px}aside{min-width:0;max-height:800px;overflow:auto;padding-right:8px}h2{font-size:22px;margin:0 0 10px}h3{font-size:16px;margin:18px 0 7px}h4{font-size:12px;color:var(--text-muted);margin:9px 0 2px}.evidence{padding:12px 0;border-bottom:1px solid var(--border)}.condition{margin:0;border-left:3px solid var(--graph-entity);padding-left:10px;font-size:14px;overflow-wrap:anywhere}.action{display:block;font-size:14px}.negative{text-decoration:underline dashed;text-underline-offset:4px}.text-link{background:transparent;border:0;padding:0;color:var(--action);text-align:left;text-decoration:underline;font-size:14px}.source{font-family:var(--font-prose);font-size:14px}.pair{border-top:2px solid var(--graph-entity);margin-top:20px}.result{display:block;text-align:left;width:100%;margin-bottom:8px}.result span{display:block;font-size:13px;color:var(--text-muted)}select{width:100%;margin:8px 0}summary{cursor:pointer;font-weight:650;padding:8px 0}details p{max-width:75ch}.edge-table,.boundaries{margin-top:24px}.boundaries{border-top:1px solid var(--border);padding-top:18px;max-width:90ch}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid var(--border)}footer{font-size:12px;color:var(--text-muted);margin:25px 0;max-width:95ch}.mobile-network{display:none}
  .reading,.spine-key{font-size:13px;margin:14px 20px;color:var(--text-muted)}.reading strong{color:var(--text)}.care-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 10px;margin:20px}.care-step{border-top:5px solid var(--graph-document);background:var(--surface-sunken);padding:8px;position:relative}.care-step:not(:last-child)::after{content:'›';position:absolute;right:-11px;top:20px;color:var(--text-muted);font-size:26px;z-index:1}.step-title{border:0;background:none;text-align:left;padding:2px;font-size:14px;font-weight:700;width:100%}.step-title span{display:block;color:var(--text-muted);font-size:12px;font-weight:400}.candidate{font-size:12px;line-height:1.3;text-align:left;border:2px solid var(--graph-entity);margin-top:8px;border-radius:0;width:100%;padding:7px}.step-lit{outline:3px solid var(--action)}.recommendation-map{margin:0 20px}.recommendation-map>summary{font-size:14px}
  @media(max-width:600px){.workspace.focused aside{order:-1}.care-steps{grid-template-columns:minmax(0,1fr)}.care-step:not(:last-child)::after{content:'⌄';top:auto;bottom:-26px;right:50%}.care-step{padding:10px}.step-title{font-size:16px}}
  @media(max-width:1000px){.workspace{grid-template-columns:minmax(0,1fr)}aside{max-height:none;overflow:visible;max-width:80ch}.heading{display:block}nav{margin-top:16px}}
  @media(max-width:600px){main{padding:16px}h1{font-size:29px}header{gap:12px;font-size:13px}form{display:block}form>div{display:block;margin-top:6px}input,form button{width:100%;margin-bottom:7px}svg{display:none}.mobile-network{display:block;padding:12px 20px}.mobile-node{padding:10px 0;border-bottom:1px solid var(--border)}.mobile-node>button:first-child{background:var(--graph-document);color:var(--graph-label)}.mobile-edge{display:block;text-align:left;font-size:13px;margin:7px 0 0 14px;border-left:3px solid var(--graph-entity)}.mobile-node.highlight{outline:none}.unmatched{grid-template-columns:minmax(0,1fr)}.legend{margin-top:10px}nav button{font-size:13px;padding:7px}td,th{font-size:12px;padding:6px}.warning{font-size:14px}}
  @media(prefers-reduced-motion:reduce){:global(*){scroll-behavior:auto!important}}
</style>
