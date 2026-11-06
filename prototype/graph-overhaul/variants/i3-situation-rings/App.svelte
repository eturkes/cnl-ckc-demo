<script lang="ts">
  import { tick } from 'svelte';
  import {
    indexGuideline,
    loadGuideline,
    markReady,
    readHash,
    writeHash,
    type Guideline,
    type HashState,
    type NetworkEdge,
    type NetworkNode,
  } from '../../shared/data.js';


  let g = $state.raw<Guideline | null>(null);
  let view = $state.raw<HashState>(readHash());
  let picked = $state('');
  let search = $state(view.view === 'explore' ? view.query : '');
  let hovered = $state('');
  let viewport: HTMLDivElement | undefined;
  const wrap = (s: string, width: number) => {
    const rows = [''];
    for (const word of s.split(' ')) {
      const at = rows.length - 1;
      if ((rows[at] + ' ' + word).trim().length > width && rows[at]) rows.push(word);
      else rows[at] = (rows[at] + ' ' + word).trim();
    }
    return rows;
  };

  $effect(() => {
    const onHash = () => {
      view = readHash();
      picked = '';
      if (view.view === 'explore') search = view.query;
    };
    addEventListener('hashchange', onHash);
    void loadGuideline().then((data) => (g = data));
    return () => removeEventListener('hashchange', onHash);
  });

  const ix = $derived(g === null ? null : indexGuideline(g));
  const nodes = $derived(new Map((g?.network.nodes ?? []).map((n) => [n.id, n])));
  const edges = $derived(g?.network.edges ?? []);
  const label = (id: string) => nodes.get(id)?.label ?? id;
  const kind = (n: NetworkNode) => (n.roles.length > 1 ? 'several' : n.roles[0] ?? 'acted-on');
  const KIND_TEXT = {
    situation: 'A patient situation',
    'acted-on': 'Something clinicians act on',
    subject: 'The subject of a statement of fact or capability',
    several: 'A concept with several roles',
  } as const;
  const ROLE_TEXT = { situation: 'patient situation', 'acted-on': 'acted on by clinicians', subject: 'subject of a statement' } as const;
  const ruleKey = (document: string, sentence: number) => `${document}:${String(sentence)}`;

  const question = $derived(view.view === 'trace' ? g?.questions.find((q) => q.id === view.question) : undefined);
  const traceKeys = $derived(new Set(question?.statements.map((s) => ruleKey(s.document, s.sentence)) ?? []));
  const rule = $derived(view.view === 'rule' ? ix?.rules.get(ruleKey(view.document, view.sentence)) : undefined);
  const ruleSentence = $derived(view.view === 'rule' ? ix?.sentence(ruleKey(view.document, view.sentence)) : undefined);
  const matches = $derived.by(() => {
    if (view.view !== 'explore' || g === null) return [];
    const q = view.query.toLowerCase().replaceAll('-', ' ').trim();
    if (q === '') return [];
    return g.network.nodes
      .filter((n) => n.label.toLowerCase().includes(q))
      .sort((a, b) => Number(b.label.toLowerCase() === q) - Number(a.label.toLowerCase() === q) || b.rules.length - a.rules.length);
  });
  const focus = $derived(view.view === 'explore' ? (nodes.get(picked) ?? matches[0]) : undefined);

  /** Edges the current state lights; empty = the whole network at rest. */
  const lit = $derived.by(() => {
    if (view.view === 'trace') return edges.filter((e) => traceKeys.has(e.rule));
    if (view.view === 'rule') return edges.filter((e) => e.rule === ruleKey(view.document, view.sentence));
    if (focus !== undefined) return edges.filter((e) => e.source === focus.id || e.target === focus.id);
    return [];
  });
  const outgoing = $derived(focus === undefined ? [] : edges.filter((e) => e.source === focus.id && e.modal !== 'fact' && e.modal !== 'can'));
  const statements = $derived(focus === undefined ? [] : edges.filter((e) => e.source === focus.id && (e.modal === 'fact' || e.modal === 'can')));
  const incoming = $derived(focus === undefined ? [] : edges.filter((e) => e.target === focus.id && e.source !== focus.id));
  const situations = $derived(
    [...nodes.values()]
      .filter((n) => n.roles.includes('situation'))
      .map((n) => ({ n, out: edges.filter((e) => e.source === n.id).length }))
      .sort((a, b) => b.out - a.out),
  );

  function go(next: HashState) {
    view = next;
    picked = '';
    if (next.view === 'explore') search = next.query;
    writeHash(next);
  }
  const openRule = (key: string) => {
    const at = key.lastIndexOf(':');
    go({ view: 'rule', document: key.slice(0, at), sentence: Number(key.slice(at + 1)) });
  };
  const openNode = (id: string) => {
    go({ view: 'explore', query: label(id) });
    picked = id;
  };

  /** One canvas line per concept pair + style: parallel relationships stack into one labelled line. */
  const lineOf = (e: NetworkEdge) => `${e.source}>${e.target}>${e.negative ? 'n' : 'p'}>${e.modal === 'fact' ? 'f' : 'm'}`;
  const lines = $derived.by(() => {
    const out = new Map<string, NetworkEdge[]>();
    for (const e of edges) out.set(lineOf(e), [...(out.get(lineOf(e)) ?? []), e]);
    return out;
  });

  const placed = $derived.by(() => {
    const all = [...nodes.values()];
    const inner = all.filter(n => n.roles.includes('situation')).sort((a,b) => b.rules.length-a.rules.length || a.label.localeCompare(b.label));
    const angle = new Map(inner.map((n,i) => [n.id, -Math.PI/2 + i*2*Math.PI/inner.length]));
    const mean = (n: NetworkNode) => {
      const neighbors = edges.filter(e => e.source === n.id || e.target === n.id)
        .map(e => angle.get(e.source === n.id ? e.target : e.source)).filter((v): v is number => v !== undefined);
      return Math.atan2(neighbors.reduce((s,a) => s+Math.sin(a),0),neighbors.reduce((s,a) => s+Math.cos(a),0));
    };
    const outer = all.filter(n => !angle.has(n.id)).sort((a,b) => mean(a)-mean(b) || a.label.localeCompare(b.label));
    const result = new Map<string, {n: NetworkNode; x:number; y:number; angle:number; outer:boolean}>();
    inner.forEach(n => { const a=angle.get(n.id)!; result.set(n.id,{n,x:600+135*Math.cos(a),y:410+135*Math.sin(a),angle:a,outer:false}); });
    outer.forEach((n,i) => { const a=-Math.PI + (i+.5)*2*Math.PI/outer.length; result.set(n.id,{n,x:600+290*Math.cos(a),y:410+290*Math.sin(a),angle:a,outer:true}); });
    return result;
  });
  const litIds = $derived(new Set(lit.map(lineOf)));
  const activeNodes = $derived(new Set(lit.flatMap(e => [e.source,e.target])));
  const drawing = $derived.by(() => [...lines].map(([id,group],i) => {
    const e=group[0], a=placed.get(e.source)!, b=placed.get(e.target)!;
    const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1;
    const bend=(i%3-1)*22;
    const cx=(a.x+b.x)/2-dy/len*bend, cy=(a.y+b.y)/2+dx/len*bend;
    const mx=.25*a.x+.5*cx+.25*b.x, my=.25*a.y+.5*cy+.25*b.y;
    const own = group.filter(e => lit.some(x => x.id === e.id));
    const verbs=[...new Set((own.length > 0 ? own : group).map(e=>e.verb))];
    const self = e.source === e.target;
    const path = self ? `M ${a.x-7} ${a.y} C ${a.x-75} ${a.y-80} ${a.x+75} ${a.y-80} ${a.x+7} ${a.y}` : `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x-dx/len*9} ${b.y-dy/len*9}`;
    return {id,group,a,b,mx: self?a.x:mx,my: self?a.y-60:my,path,text:verbs.join(' / '),negative:e.negative,fact:e.modal==='fact'};
  }));
  const callouts = $derived.by(() => {
    const occupied: {x:number;y:number;w:number;h:number}[]=[...placed.values()].filter(p=>activeNodes.has(p.n.id)).map(p=>{
      const rows=wrap(p.n.label,15), w=Math.max(...rows.map(r=>r.length))*7.5, h=rows.length*15;
      const c=Math.cos(p.angle), s=Math.sin(p.angle);
      return {x:p.x+c*(15+w/2),y:p.y+s*(15+w/2),w:Math.abs(c)*w+Math.abs(s)*h,h:Math.abs(s)*w+Math.abs(c)*h};
    });
    return drawing.filter(d=>litIds.has(d.id)||hovered===d.id).map(d=> {
      const words=d.text.split(' '), rows:string[]=[''];
      for(const word of words) { const j=rows.length-1; if((rows[j]+' '+word).trim().length>23) rows.push(word); else rows[j]=(rows[j]+' '+word).trim(); }
      const w=Math.max(...rows.map(r=>r.length))*7+14, h=rows.length*17+8;
      let best={x:d.mx,y:d.my,w,h}, score=Infinity;
      for(let r=0;r<260;r+=22) for(let a=0;a<Math.PI*2;a+=Math.PI/6) {
        const x=d.mx+Math.cos(a)*r,y=d.my+Math.sin(a)*r;
        if(x-w/2<260||x+w/2>940||y-h/2<95||y+h/2>725) continue;
        const collision=occupied.filter(o=>Math.abs(x-o.x)<(w+o.w)/2+7 && Math.abs(y-o.y)<(h+o.h)/2+7).length;
        const nodeHit=[...placed.values()].filter(n=>Math.abs(x-n.x)<w/2+24&&Math.abs(y-n.y)<h/2+24).length;
        const cost=collision*10000+nodeHit*2000+r;
        if(cost<score) {score=cost;best={x,y,w,h};}
      }
      occupied.push(best); return {...d,...best,rows};
    });
  });
  function selectLine(all: NetworkEdge[]) {
    const own = all.filter(e => lit.some(x => x.id === e.id));
    const group = own.length > 0 ? own : all;
    const keys=[...new Set(group.map(e=>e.rule))];
    if(keys.length===1) openRule(keys[0]); else openNode(group[0].source);
  }
  $effect(() => { view; picked; if (g) void tick().then(markReady); });
  $effect(() => { if (g) void tick().then(() => { if (viewport) viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2; }); });
</script>

{#snippet relation(e: NetworkEdge, from: boolean = true)}
  <p class="relation">
    {#if from}<button class="concept" onclick={() => openNode(e.source)}>{label(e.source)}</button>{/if}
    <span class="verb" class:negative={e.negative}>{e.verb}</span>
    <button class="concept" onclick={() => openNode(e.target)}>{label(e.target)}</button>
    {#if e.detail}<span class="detail">{e.detail}</span>{/if}
  </p>
  {#if e.when.length > 0}<p class="when">When {e.when.join('; ')}</p>{/if}
{/snippet}

{#snippet source(document: string)}
  {@const d = ix?.docs.get(document)}
  {#if d && g}
    <details>
      <summary>Guideline text, page {d.page}</summary>
      <p class="source">{d.source}</p>
      <a href={`${g.pdf}#page=${String(d.page)}`} target="_blank" rel="noreferrer">Open guideline page {d.page}</a>
    </details>
  {/if}
{/snippet}

<main>
  <header>
    <a class="brand" href="#overview" onclick={() => go({ view: 'overview' })}>CNL / CKC <span>Graph studies</span></a>
  </header>
  <div class="heading">
    <div>
      <h1>Clinical relationships</h1>
      <p>What the guideline tells clinicians to do, in which situation, and under which conditions.</p>
    </div>
    <nav aria-label="Graph views">
      <button aria-current={view.view === 'overview' ? 'page' : undefined} onclick={() => go({ view: 'overview' })}>Guideline shape</button>
      <button aria-current={view.view === 'trace' ? 'page' : undefined} onclick={() => g && go({ view: 'trace', question: g.questions[0].id })}>Trace an answer</button>
      <button aria-current={view.view === 'rule' ? 'page' : undefined} onclick={() => go({ view: 'rule', document: 'cdc2022-opioid-rec01', sentence: 5 })}>Read one rule</button>
    </nav>
  </div>

  {#if g === null || ix === null}
    <p>Loading the guideline…</p>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); go({ view: 'explore', query: search }); }}>
      <label for="concept-search">Explore a clinical concept</label>
      <div>
        <input id="concept-search" bind:value={search} placeholder="Try chronic pain, naloxone or opioid dosage" />
        <button type="submit">Show its relationships</button>
      </div>
    </form>

    <div class="workspace">
      <section class="network" aria-label="Clinical relationship network">
        <p class="ring-guide">Patient situations sit inside. The things clinicians act on sit outside. Select a concept or a relationship.</p>
        <p class="mobile-guide">Swipe across the network to read each concept. <a href="#relationships" onclick={e=>{e.preventDefault();document.getElementById('relationships')?.scrollIntoView();}}>Read the relationships below</a>.</p>
        <div class="canvas" bind:this={viewport}>
          <svg viewBox="0 0 1200 820" aria-label="Clinical concept network: situations on the inner ring, acted-on concepts on the outer ring">
            <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
            <circle cx="600" cy="410" r="290" class="orbit"/><circle cx="600" cy="410" r="135" class="orbit"/>
            {#each drawing as d (d.id)}
              <path d={d.path} class="edge" class:lit={litIds.has(d.id)} class:dim={litIds.size>0&&!litIds.has(d.id)} class:negative={d.negative} class:fact={d.fact} marker-end="url(#arrow)" />
              <path d={d.path} class="hit" role="button" tabindex="0" aria-label={`${d.a.n.label} ${d.text} ${d.b.n.label}`} onclick={()=>selectLine(d.group)} onkeydown={e=>{if(e.key==='Enter'||e.key===' ') {e.preventDefault();selectLine(d.group);}}} onmouseenter={()=>hovered=d.id} onmouseleave={()=>hovered=''} onfocus={()=>hovered=d.id} onblur={()=>hovered=''} />
            {/each}
            {#each [...placed.values()] as p (p.n.id)}
              {@const left=Math.cos(p.angle)<0}
              {@const degrees=p.angle*180/Math.PI+(left?180:0)}
              <g class="node" class:dim={litIds.size>0&&!activeNodes.has(p.n.id)} role="button" tabindex="0" aria-label={p.n.label} onclick={()=>openNode(p.n.id)} onkeydown={e=>{if(e.key==='Enter'||e.key===' ') {e.preventDefault();openNode(p.n.id);}}}>
                <circle cx={p.x} cy={p.y} r={p.outer?7:10} class={kind(p.n)} />
                <text transform={`rotate(${degrees} ${p.x} ${p.y})`} text-anchor={left?'end':'start'}>
                  {#each wrap(p.n.label,15) as row,i}
                    <tspan x={p.x+(left?-15:15)} y={p.y+5-(wrap(p.n.label,15).length-1)*7.5+i*15}>{row}</tspan>
                  {/each}
                </text>
              </g>
            {/each}
            {#each callouts as c (c.id)}
              <g class="callout" role="button" tabindex="0" aria-label={`${c.a.n.label} ${c.text} ${c.b.n.label}`} onclick={()=>selectLine(c.group)} onkeydown={e=>{if(e.key==='Enter'||e.key===' ') selectLine(c.group);}}>
                <path d={`M ${c.mx} ${c.my} L ${c.x} ${c.y}`} class="leader" />
                <rect x={c.x-c.w/2} y={c.y-c.h/2} width={c.w} height={c.h} rx="3" />
                <text text-anchor="middle">{#each c.rows as row,i}<tspan x={c.x} y={c.y-c.h/2+17+i*17}>{row}</tspan>{/each}</text>
              </g>
            {/each}
          </svg>
        </div>
        <div class="legend">
          <span><i class="dot situation"></i>Patient situation</span>
          <span><i class="dot acted-on"></i>What the clinician acts on</span>
          <span><i class="dot subject"></i>Subject of a statement</span>
          <span><i class="dot several"></i>Several roles</span>
          <span><i class="line"></i>Should, can</span>
          <span><i class="line dashed"></i>Should not</span>
          <span><i class="line dotted"></i>Statement of fact</span>
        </div>
        <p class="note">Each line joins a situation to what clinicians act on in it, and is labelled with what the recommendations say, one or more rules per line. Select a line to read its rule, or the rules behind it; select a concept to see every relationship it takes part in.</p>
      </section>

      <aside id="relationships">
        {#if view.view === 'trace'}
          <h2>Trace an answer</h2>
          <label for="question">Prepared question</label>
          <select id="question" value={question?.id} onchange={(e) => go({ view: 'trace', question: e.currentTarget.value })}>
            {#each g.questions as q (q.id)}<option value={q.id}>{q.question}</option>{/each}
          </select>
          {#if question}
            <p class="note">The answer's {question.statements.length} statements light their relationships in the network.</p>
            <ol class="statements">
              {#each question.statements as s, i (i)}
                {@const key = ruleKey(s.document, s.sentence)}
                <li>
                  {#each edges.filter((e) => e.rule === key) as e (e.id)}{@render relation(e)}{:else}<p>{ix.sentence(key)?.ace}</p>{/each}
                  <button class="link" onclick={() => openRule(key)}>Read the whole rule ({s.document.replace('cdc2022-opioid-', '')}, sentence {s.sentence})</button>
                  {@render source(s.document)}
                </li>
              {/each}
            </ol>
          {:else}
            <p class="notfound">No prepared question has this name. Choose one from the list.</p>
          {/if}
        {:else if view.view === 'rule'}
          <h2>One rule, whole</h2>
          {#if ruleSentence}
            {@const doc = ix.docs.get(view.document)}
            {@const rec = g.recommendations.find((r) => r.number === doc?.rec)}
            <p class="note">Recommendation {doc?.rec ?? '—'}, sentence {view.sentence}</p>
            {#if rule}
              <dl>
                <dt>Condition</dt><dd>{rule.condition?.replaceAll('-', ' ') ?? 'No condition stated in this sentence. The guideline’s scope exclusions still apply.'}</dd>
                <dt>Who acts</dt><dd>{rule.subject.replaceAll('-', ' ')}</dd>
                <dt>Strength</dt><dd>{rule.mode === 'fact' ? 'Statement of fact' : rule.mode}</dd>
                <dt>In the network</dt>
                <dd>{#each lit as e (e.id)}{@render relation(e)}{/each}</dd>
              </dl>
            {:else}
              <p class="notfound">This sentence has no clinical parse in the knowledge base, so the network draws no relationship for it.</p>
            {/if}
            <h3>Controlled-language sentence</h3>
            <blockquote>{ruleSentence.ace}</blockquote>
            {@render source(view.document)}
            {#if rec && rec.implementation.length > 0}
              <details>
                <summary>{rec.implementation.length} implementation notes for recommendation {rec.number}</summary>
                {#each rec.implementation as id (id)}
                  {@const d = ix.docs.get(id)}
                  {#if d}<p class="source">{d.source} <span class="note">(page {d.page})</span></p>{/if}
                {/each}
              </details>
            {/if}
          {:else}
            <p class="notfound">No sentence matches this rule. Select a line in the network to open one.</p>
          {/if}
        {:else if view.view === 'explore'}
          {#if focus}
            <h2>{focus.label}</h2>
            <p class="note">{KIND_TEXT[kind(focus)]}{kind(focus) === 'several' ? ` (${focus.roles.map((x) => ROLE_TEXT[x]).join(', ')})` : ''}, in {focus.rules.length} recommendation sentences.</p>
            {#if matches.length > 1}
              <details>
                <summary>{matches.length} concepts match “{view.query}”</summary>
                {#each matches as m (m.id)}<button class="concept" onclick={() => (picked = m.id)}>{m.label}</button> {/each}
              </details>
            {/if}
            {#if outgoing.length > 0}
              <h3>In this situation, clinicians</h3>
              {#each outgoing as e (e.id)}<div class="item">{@render relation(e, false)}<button class="link" onclick={() => openRule(e.rule)}>Read the rule</button></div>{/each}
            {/if}
            {#if statements.length > 0}
              <h3>What the guideline states about it</h3>
              {#each statements as e (e.id)}<div class="item">{@render relation(e)}<button class="link" onclick={() => openRule(e.rule)}>Read the sentence</button></div>{/each}
            {/if}
            {#if incoming.length > 0}
              <h3>Relationships that lead to it</h3>
              {#each incoming as e (e.id)}<div class="item">{@render relation(e)}<button class="link" onclick={() => openRule(e.rule)}>Read the rule</button></div>{/each}
            {/if}
          {:else}
            <h2>Explore a concept</h2>
            <p class="notfound">No clinical concept matches “{view.query}”. Try a shorter word, such as pain or opioid.</p>
          {/if}
        {:else}
          <h2>The guideline at a glance</h2>
          <p>{g.recommendations.length} recommendations hold {g.rules.length} clinical rules. The network draws them as {edges.length} relationships between {nodes.size} concepts.</p>
          <h3>Situations with the most recommendations</h3>
          <ul class="ranked">
            {#each situations.slice(0, 8) as s (s.n.id)}<li><button class="concept" onclick={() => openNode(s.n.id)}>{s.n.label}</button> {s.out} relationships</li>{/each}
          </ul>
          <h3>Start with an answer</h3>
          {#each g.questions as q (q.id)}<button class="question" onclick={() => go({ view: 'trace', question: q.id })}>{q.question}</button>{/each}
        {/if}
      </aside>
    </div>

    <details class="table">
      <summary>Read {lit.length > 0 ? `the ${lit.length} highlighted` : `all ${edges.length}`} relationships as a table</summary>
      <table>
        <thead><tr><th>Situation or subject</th><th>Relationship</th><th>Acts on</th><th>Condition</th><th>Sentence</th></tr></thead>
        <tbody>
          {#each lit.length > 0 ? lit : edges as e (e.id)}
            <tr><td>{label(e.source)}</td><td>{e.verb}{e.detail ? ` (${e.detail})` : ''}</td><td>{label(e.target)}</td><td>{e.when.join('; ')}</td><td><button class="link" onclick={() => openRule(e.rule)}>{e.rule.replace('cdc2022-opioid-', '')}</button></td></tr>
          {/each}
        </tbody>
      </table>
    </details>

    <section class="boundaries">
      <h2>Where the recommendations stop</h2>
      <details>
        <summary>{g.exclusions.length} scope exclusion records</summary>
        <p>The recommendations do not apply under these conditions. An absent exclusion does not prove that a patient belongs to the guideline's population.</p>
        {#each g.exclusions as e, i (i)}<p class="source">{e.ace}</p>{/each}
      </details>
      <details>
        <summary>{g.supersessions.length} superseded statements</summary>
        {#each g.supersessions as s, i (i)}<p class="source"><s>{s.ace}</s> Superseded by <a href={s.url}>{s.citation}</a>.</p>{/each}
      </details>
    </section>
    <footer>{g.derivation} Relationships are read from the knowledge base's clinical parse of the 12 recommendations; which concept anchors a rule is a prototype reading of its condition. Clinical demonstration only. Source: CDC. CDC does not endorse this demo.</footer>
  {/if}
</main>

<style>
  main { max-width: 1480px; margin: auto; padding: 24px 32px; }
  header { padding-bottom: 18px; border-bottom: 1px solid var(--border); }
  .brand { color: var(--text); font-weight: 750; text-decoration: none; }
  .brand span { color: var(--text-muted); font-weight: 400; margin-left: 14px; }
  .heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 26px 0 20px; }
  h1 { font-size: 34px; line-height: 1.15; margin: 0 0 8px; }
  .heading p { margin: 0; color: var(--text-muted); max-width: 70ch; }
  h2 { font-size: 22px; line-height: 1.2; margin: 0 0 12px; }
  h3 { font-size: 16px; margin: 22px 0 8px; }
  nav { display: flex; gap: 6px; flex-wrap: wrap; }
  button, input, select { font: inherit; color: var(--text); background: var(--surface-raised); border: 1px solid var(--border); border-radius: 4px; padding: 8px 12px; }
  button { cursor: pointer; }
  button:hover { border-color: var(--action); }
  button[aria-current='page'], button[type='submit'] { background: var(--action); color: var(--action-text); border-color: var(--action); }
  :global(:focus-visible) { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
  a { color: var(--action); overflow-wrap: anywhere; }
  form { display: flex; align-items: center; gap: 20px; padding: 14px 18px; background: var(--surface-sunken); margin-bottom: 18px; }
  form label { font-weight: 700; white-space: nowrap; }
  form > div { display: flex; gap: 8px; flex: 1; }
  input { width: 100%; min-width: 0; }
  .workspace { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .network { min-width: 0; border: 1px solid var(--border); background: var(--surface-raised); }
  .canvas { width: 100%; overflow-x: auto; }
  svg { display: block; width: 100%; }
  .ring-guide { margin: 12px 18px 0; color: var(--text-muted); font-size: 14px; }
  .mobile-guide { display: none; }
  .orbit { fill: none; stroke: var(--border); stroke-opacity: .2; }
  .edge { fill: none; stroke: var(--graph-edge); stroke-width: 1.4; opacity: .45; }
  .edge.lit { stroke: var(--action); stroke-width: 2.4; opacity: 1; }
  .edge.negative { stroke-dasharray: 7 4; }
  .edge.fact { stroke-dasharray: 2 4; }
  .dim { opacity: .14; }
  .hit { fill: none; stroke: transparent; stroke-width: 12; cursor: pointer; }
  .node { cursor: pointer; }
  .node circle { stroke: var(--surface-raised); stroke-width: 2; }
  .node .situation { fill: var(--graph-entity); }
  .node .acted-on { fill: var(--graph-event); }
  .node .subject { fill: var(--graph-value); }
  .node .several { fill: var(--graph-operator); }
  .node text { fill: var(--text); font-size: 14px; font-weight: 650; paint-order: stroke; stroke: var(--surface-raised); stroke-width: 4; stroke-linejoin: round; }
  .callout { cursor: pointer; }
  .callout rect { fill: var(--surface-raised); stroke: var(--action); stroke-width: .8; }
  .callout text { font-size: 14px; fill: var(--text); }
  .leader { stroke: var(--action); stroke-width: .8; opacity: .7; fill: none; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 10px 16px; font-size: 13px; border-top: 1px solid var(--border); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.situation { background: var(--graph-entity); }
  .dot.acted-on { background: var(--graph-event); }
  .dot.subject { background: var(--graph-value); }
  .dot.several { background: var(--graph-operator); }
  .line { width: 26px; border-top: 2px solid var(--text-muted); }
  .line.dashed { border-top-style: dashed; }
  .line.dotted { border-top-style: dotted; }
  .note { font-size: 13px; color: var(--text-muted); }
  .network .note { padding: 0 16px 12px; margin: 0; max-width: 90ch; }
  aside { min-width: 0; max-width: 85ch; padding-right: 6px; }
  label { font-size: 14px; }
  select { width: 100%; margin: 6px 0 4px; }
  .statements { padding-left: 22px; }
  .statements li { padding-bottom: 18px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
  .relation { margin: 6px 0 2px; line-height: 2; }
  .concept { padding: 1px 8px; border-radius: 12px; font-weight: 650; font-size: 14px; }
  .verb { margin: 0 4px; font-style: italic; }
  .verb.negative { text-decoration: underline dashed; text-underline-offset: 4px; }
  .detail { display: block; font-size: 13px; color: var(--text-muted); line-height: 1.4; }
  .when { margin: 2px 0 6px; font-size: 14px; padding-left: 10px; border-left: 3px solid var(--graph-entity); }
  .link { border: 0; padding: 2px 0; background: none; color: var(--action); text-decoration: underline; font-size: 13px; text-align: left; }
  .item { padding: 8px 0; border-bottom: 1px solid var(--border); }
  .question { display: block; width: 100%; text-align: left; margin-bottom: 8px; }
  .ranked { padding-left: 18px; }
  .ranked li { margin-bottom: 6px; font-size: 14px; }
  dt { font-weight: 700; color: var(--text-muted); font-size: 13px; }
  dd { margin: 0 0 14px; }
  blockquote { margin: 8px 0 14px; padding-left: 12px; border-left: 4px solid var(--action); }
  .source { font-size: 14px; max-width: 75ch; }
  summary { cursor: pointer; padding: 8px 0; font-weight: 650; }
  .notfound { padding: 12px; border: 1px solid var(--warn); }
  .table { margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid var(--border); overflow-wrap: anywhere; }
  .boundaries { margin-top: 26px; border-top: 1px solid var(--border); padding-top: 18px; max-width: 85ch; }
  footer { font-size: 12px; color: var(--text-muted); padding: 24px 0; max-width: 100ch; }
  @media (max-width: 900px) {
    main { padding: 16px; }
    .heading { display: block; }
    nav { margin-top: 16px; }
    .workspace { grid-template-columns: minmax(0, 1fr); }
    .canvas { max-height: 650px; }
    svg { width: 1000px; max-width: none; }
    .mobile-guide { display: block; margin: 8px 16px; font-size: 13px; color: var(--text-muted); }
    aside { max-height: none; overflow: visible; }
    form { display: block; }
    form > div { margin-top: 8px; }
    h1 { font-size: 28px; }
    .table { overflow-x: auto; }
    table { min-width: 640px; }
  }
  @media (max-width: 400px) {
    form > div { display: block; }
    form button { margin-top: 8px; width: 100%; }
  }
</style>
