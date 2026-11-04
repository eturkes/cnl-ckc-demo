<script lang="ts">
  import { AREAS, indexGuideline, loadGuideline, markReady, readHash, writeHash, type Guideline, type HashState } from '../../shared/data.js';
  let g = $state.raw<Guideline | null>(null);
  let state = $state.raw<HashState>(readHash());
  let search = $state('');
  const names = ['Nonopioid therapies', 'Pain & function goals', 'Immediate release', 'Lowest effective dose', 'Continue or taper', 'Prescription duration', 'Reassess therapy', 'Mitigate risk', 'Prescription history', 'Toxicology testing', 'Concurrent medicines', 'Treat opioid use disorder'];
  const lines = ['A', 'B', 'C', 'D'];
  const short = ['Start with the options', 'Choose & dose', 'Duration & follow-up', 'Reduce harm'];
  const ix = $derived(g ? indexGuideline(g) : null);
  const question = $derived(g && state.view === 'trace' ? g.questions.find(q => q.id === state.question) : null);
  const doc = $derived(ix && state.view === 'rule' ? ix.docs.get(state.document) : null);
  const sentence = $derived(ix && state.view === 'rule' ? ix.sentence(`${state.document}:${state.sentence}`) : null);
  const rule = $derived(ix && state.view === 'rule' ? ix.rules.get(`${state.document}:${state.sentence}`) : null);
  const traceRecs = $derived(question && ix ? [...new Set(question.statements.map(s => ix.docs.get(s.document)?.rec).filter((n): n is number => n !== null && n !== undefined))] : []);
  const selected = $derived(state.view === 'trace' ? traceRecs : state.view === 'rule' && doc?.rec ? [doc.rec] : []);
  const results = $derived(g && state.view === 'explore' ? g.documents.flatMap(d => d.sentences.filter(s => `${s.ace} ${d.id}`.toLowerCase().includes(state.query.toLowerCase())).map(s => ({d, s}))) : []);
  const transfers = $derived.by(() => {
    if (!g || !ix) return [];
    const eligible = g.concepts.filter(c => c.kind === 'entity' && c.label.length > 5 && !['patient', 'clinician', 'therapy', 'opioid'].includes(c.label));
    const chosen: {label: string; from: number; to: number; mentions: number}[] = [];
    for (let area = 0; area < 3; area++) {
      const candidates = eligible.map(c => {
        const recs = [...new Set(c.mentions.map(m => ix.docs.get(m.slice(0, m.lastIndexOf(':')))?.rec).filter((n): n is number => n !== null && n !== undefined))];
        return {label: c.label, from: recs.find(r => (AREAS[area].recs as readonly number[]).includes(r)), to: recs.find(r => (AREAS[area + 1].recs as readonly number[]).includes(r)), mentions: c.mentions.length};
      }).filter(c => c.from && c.to && !chosen.some(x => x.label === c.label)).sort((a,b) => b.mentions - a.mentions);
      const c = candidates[0];
      if (c?.from && c.to) chosen.push({...c, from:c.from, to:c.to});
    }
    return chosen;
  });
  function pos(n: number) {
    const a = AREAS.findIndex(x => (x.recs as readonly number[]).includes(n));
    const recs = AREAS[a].recs as readonly number[];
    return {x: 110 + recs.indexOf(n) * (550 / Math.max(1, recs.length - 1)), y: 145 + a * 120};
  }
  function join(a: {x:number;y:number}, b: {x:number;y:number}) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
    return `M ${a.x} ${a.y} L ${b.x - Math.sign(dx) * diagonal} ${a.y} L ${b.x} ${a.y + Math.sign(dy) * diagonal} L ${b.x} ${b.y}`;
  }
  function navigate(next: HashState) { state = next; writeHash(next); }
  function station(n:number) {
    const r = g?.recommendations.find(r => r.number === n);
    const first = g?.rules.find(x => x.document === r?.id);
    if (r) navigate({view:'rule',document:r.id,sentence:first?.sentence ?? 1});
  }
  $effect(() => {
    const onHash = () => { state = readHash(); };
    addEventListener('hashchange', onHash);
    void loadGuideline().then(data => g = data);
    return () => removeEventListener('hashchange', onHash);
  });
  $effect(() => { if (g) { void state; queueMicrotask(markReady); } });
</script>

<main>
  <header><a class="brand" href="#overview" onclick={() => navigate({view:'overview'})}>CNL / CKC</a><span>Graph study / Transit map</span></header>
  <div class="mast"><div><h1>Guideline transit</h1><p>Find your way from a clinical question to the words behind it.</p></div><div class="badge">CDC 2022<br/>12 recommendation stops</div></div>
  <nav aria-label="Map views">
    <button class:current={state.view === 'overview'} onclick={() => navigate({view:'overview'})}>The network</button>
    <label class="planner">Plan an answer <select aria-label="Choose an answer to trace" value={question?.id ?? ''} onchange={(e) => navigate({view:'trace',question:e.currentTarget.value})}><option value="" disabled>Choose a clinical question</option>{#each g?.questions ?? [] as q}<option value={q.id}>{q.question}</option>{/each}</select></label>
    <form onsubmit={(e) => { e.preventDefault(); navigate({view:'explore',query:search}); }}><input aria-label="Search the knowledge base" placeholder="Search the KB" bind:value={search}/><button>Find</button></form>
  </nav>
  {#if !g || !ix}<p>Loading the guideline…</p>{:else}
  <div class="workspace" class:detail={state.view !== 'overview'}>
    <section class="network" aria-label="Clinical area transit network">
      <div class="mapheading"><h2>{state.view === 'trace' ? 'Your answer route' : state.view === 'rule' ? 'At this recommendation' : 'Four lines through the guideline'}</h2><span>Diagrammatic, not a care pathway</span></div>
      <div class="linekey">{#each AREAS as area, i}<span style={`--line:var(--line-${i})`}><b>{lines[i]}</b>{short[i]}</span>{/each}</div>
      <svg class="desktop" viewBox="0 0 880 570" aria-label="Recommendations joined by clinical area; outlined transfers share a concept">
        <title>Clinical guideline transit map</title>
        {#each AREAS as area, i}
          <path d={`M 50 ${145 + i*120} H 685 L 715 ${175+i*120}`} class="track" style={`stroke:var(--line-${i})`}/>
          <text x="37" y={150+i*120} class="lineletter">{lines[i]}</text>
        {/each}
        {#each transfers as t, i}
          {@const a=pos(t.from)}{@const b=pos(t.to)}
          <path d={`${join(a,{x:(a.x+b.x)/2,y:(a.y+b.y)/2})} ${join({x:(a.x+b.x)/2,y:(a.y+b.y)/2},b)}`} class="transfer"/>
          <circle cx={(a.x+b.x)/2} cy={(a.y+b.y)/2} r="10" class="interchange"/>
          <text x={(a.x+b.x)/2} y={(a.y+b.y)/2+4} class="transfernum">{i+1}</text>
        {/each}
        {#each traceRecs.slice(1) as n,i}<path d={join(pos(traceRecs[i]),pos(n))} class="journey"/>{/each}
        {#each g.recommendations as rec}
          {@const p = pos(rec.number)}
          <a href={`#rule=${rec.id}:${g.rules.find(r=>r.document===rec.id)?.sentence ?? 1}`} onclick={(e) => {e.preventDefault();station(rec.number);}} aria-label={`Recommendation ${rec.number}: ${names[rec.number-1]}`}>
            {#if selected.includes(rec.number)}<circle cx={p.x} cy={p.y} r="22" class="selected"/>{/if}
            <circle cx={p.x} cy={p.y} r="13" class="stop"/>
            <text x={p.x} y={p.y+5} class="number">{rec.number}</text>
            <text transform={`translate(${p.x+5},${p.y-26}) rotate(-45)`} class="stationname">{names[rec.number-1]}</text>
          </a>
        {/each}
      </svg>
      <div class="mobile" aria-label="Accessible station directory">
        {#each AREAS as area,i}<div class="mobileline" style={`--line:var(--line-${i})`}><h3>{lines[i]} / {short[i]}</h3>{#each area.recs as n}<button class:active={selected.includes(n)} onclick={()=>station(n)}><b>{n}</b><span>{names[n-1]}</span>{#if selected.includes(n)}<small>On route</small>{/if}</button>{/each}</div>{/each}
      </div>
      <p class="legend">Circles are recommendations. Coloured lines group clinical areas in guideline order. Numbered interchanges share a named concept; black routes follow answer citations, not logical entailment.</p>
      <details class="transfers"><summary>Transfer directory: {transfers.length} sampled shared concepts</summary>{#each transfers as t,i}<button onclick={()=>navigate({view:'explore',query:t.label})}>{i+1}. {t.label.replaceAll('-',' ')} <small>Stops {t.from} and {t.to}</small></button>{/each}<p>Transfers are a sample, not all semantic relationships.</p></details>
    </section>
    <aside class="ticket">
      {#if state.view === 'overview'}
        <div class="tickethead"><span>Start here</span><h2>Choose a destination</h2></div>
        <p>A station opens the rule behind a recommendation. A question draws the stops its answer cites.</p>
        <h3>The line guide</h3>
        {#each AREAS as area,i}<div class="guide"><b style={`color:var(--line-${i})`}>{lines[i]}</b><p>{area.label}<small>Recommendations {area.recs.join(', ')}</small></p></div>{/each}
        <p class="note">Station names are short wayfinding labels. Open a station for the exact wording.</p>
      {:else if state.view === 'trace'}
        {#if question}
          <div class="tickethead"><span>Answer itinerary / {question.statements.length} statements</span><h2>{question.question}</h2></div>
          <p class="note">{g.derivation}</p>
          <ol class="itinerary">{#each question.statements as s,i}{@const d=ix.docs.get(s.document)}{@const text=ix.sentence(`${s.document}:${s.sentence}`)}<li><span class="step">{i+1}</span><div><a href={`#rule=${s.document}:${s.sentence}`} onclick={(e)=>{e.preventDefault();navigate({view:'rule',document:s.document,sentence:s.sentence});}}>{text?.ace ?? 'Statement not found'}</a><small>{s.document}, sentence {s.sentence}</small><a class="page" href={`${g.pdf}#page=${d?.page}`} target="_blank" rel="noreferrer">Guideline page {d?.page}</a><details><summary>Read the source passage</summary><p>{d?.source}</p></details></div></li>{/each}</ol>
        {:else}<h2>Question not found</h2><p>Choose a question from Plan an answer.</p>{/if}
      {:else if state.view === 'rule'}
        {#if doc && sentence}
          <div class="tickethead"><span>{doc.rec ? `Stop ${doc.rec} / ` : ''}{doc.kind}</span><h2>{doc.rec ? names[doc.rec-1] : 'Source sentence'}</h2></div>
          <p class="exact">{sentence.ace}</p>
          <h3>{rule ? 'Clinical rule structure' : 'Text reading, not the KB’s parse'}</h3>
          <div class="logic"><span>WHEN</span><p>{rule?.condition ?? sentence.condition ?? 'No condition is written in this sentence.'}</p><span>{rule ? rule.mode.toUpperCase() : sentence.modal.toUpperCase()}</span><p>{rule ? `${rule.subject}: ${rule.actions.map(a=>`${a.polarity==='negative'?'not ':''}${a.verb} ${a.object}${a.modifiers.map(m=>` ${m.preposition} ${m.value}`).join('')}`).join('; ')}` : sentence.conclusion}</p></div>
          <details open><summary>Guideline source / page {doc.page}</summary><p>{doc.source}</p><a href={`${g.pdf}#page=${doc.page}`} target="_blank" rel="noreferrer">Open guideline page {doc.page}</a></details>
          <small>{doc.id}, sentence {sentence.n}</small>
          <h3>Other sentences at this stop</h3><div class="siblings">{#each doc.sentences as s}<button class:current={s.n===sentence.n} onclick={()=>navigate({view:'rule',document:doc.id,sentence:s.n})}>Sentence {s.n}</button>{/each}</div>
        {:else}<h2>Sentence not found</h2><p>Select a station to read a rule.</p>{/if}
      {:else}
        <div class="tickethead"><span>Search the network</span><h2>{state.query || 'All sentences'}</h2></div><p>{results.length} matching sentences</p>
        {#if !results.length}<p>No sentence found. Try another clinical term.</p>{/if}
        {#each results.slice(0,40) as result}<div class="searchresult"><a href={`#rule=${result.d.id}:${result.s.n}`} onclick={(e)=>{e.preventDefault();navigate({view:'rule',document:result.d.id,sentence:result.s.n});}}>{result.s.ace}</a><small>{result.d.id}, sentence {result.s.n}, page {result.d.page}</small></div>{/each}
        {#if results.length>40}<p>Showing the first 40 results. Refine your search to see fewer.</p>{/if}
      {/if}
    </aside>
  </div>
  <section class="notices"><h2>Service limits</h2><p>These are scope and supersession records, not disruptions to a clinical service.</p><div class="noticegrid"><details><summary>Outside the guideline’s scope / {g.exclusions.length} records</summary><p>The recommendations do not apply under these conditions. Absence of an exclusion does not establish applicability.</p>{#each g.exclusions as e}<p><a href={`#rule=${e.document}:${e.sentence}`} onclick={(ev)=>{ev.preventDefault();navigate({view:'rule',document:e.document,sentence:e.sentence});}}>{e.ace}</a><small>{e.document}, sentence {e.sentence}</small></p>{/each}</details><details><summary>Superseded statements / {g.supersessions.length} records</summary>{#each g.supersessions as s}<p><s>{s.ace}</s><small>Superseded {String(s.date).slice(0,4)}-{String(s.date).slice(4,6)}-{String(s.date).slice(6,8)}</small><a href={s.url} target="_blank" rel="noreferrer">{s.citation}</a><small>{s.document}, sentence {s.sentence}</small></p>{/each}</details></div></section>
  <footer><p>{g.derivation}</p><p>Source: Centers for Disease Control and Prevention. Material is free at <a href="https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm">cdc.gov</a>. This demo is not endorsed by CDC and is not for clinical use.</p></footer>
  {/if}
</main>

<style>
  main{--line-0:var(--graph-document);--line-1:var(--graph-event);--line-2:var(--graph-value);--line-3:var(--graph-entity);max-width:1600px;padding:24px 40px;margin:auto}header{display:flex;justify-content:space-between;gap:20px;font-size:13px;color:var(--text-muted);border-bottom:2px solid var(--text);padding-bottom:12px}.brand{font-weight:800;color:var(--text);text-decoration:none}.mast{display:flex;justify-content:space-between;align-items:center;margin:23px 0 26px;gap:20px}h1{font-size:40px;line-height:1.1;letter-spacing:-1.4px;margin:0 0 10px}h2{font-size:23px;line-height:1.2;margin:0 0 12px}h3{font-size:17px;margin:22px 0 10px}p{max-width:76ch;margin:8px 0 15px}.mast p{margin:0;color:var(--text-muted)}.badge{font-weight:700;border-left:7px solid var(--text);padding:8px 0 8px 15px;line-height:1.3;flex-shrink:0}nav{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-block:1px solid var(--border);padding:12px 0;margin-bottom:24px}button,select,input{border:1px solid var(--border);border-radius:3px;background:var(--surface-raised);color:var(--text);padding:8px 12px;min-width:0}button{cursor:pointer}button:hover,a:hover{color:var(--action)}button.current{background:var(--text);color:var(--surface)}input{width:170px}select{max-width:300px}.planner{display:flex;gap:10px;align-items:center;font-weight:700}form{display:flex;gap:6px;margin-left:auto}a{color:var(--action);overflow-wrap:anywhere}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--focus-ring);outline-offset:4px}.workspace{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(310px,1fr);gap:28px;align-items:start}.network{min-width:0;background:var(--surface-raised);padding:18px 20px 10px;border:1px solid var(--border)}.mapheading h2{font-size:21px;margin-bottom:3px}.mapheading span{font-size:13px;color:var(--text-muted)}.linekey{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin:18px 0 0;font-size:14px}.linekey span{display:flex;gap:8px;align-items:center}.linekey b{display:grid;place-items:center;background:var(--line);color:var(--surface-raised);height:24px;width:24px;border-radius:50%}:global([data-theme='dark']) .linekey b{color:#111418}.desktop{width:100%;display:block;margin-top:0}.track{stroke-width:9;fill:none;stroke-linecap:round}.transfer{fill:none;stroke:var(--border);stroke-width:4}.interchange{fill:var(--surface-raised);stroke:var(--text);stroke-width:2}.transfernum{font-size:11px;fill:var(--text);text-anchor:middle;font-weight:700}.journey{fill:none;stroke:var(--text);stroke-width:16;stroke-linejoin:round;opacity:.75}.stop{fill:var(--surface-raised);stroke:var(--text);stroke-width:3}.selected{fill:var(--text);stroke:var(--surface-raised);stroke-width:2}.number{text-anchor:middle;fill:var(--text);font-size:15px;font-weight:800}.stationname{fill:var(--text);font-size:16px;font-weight:650}.lineletter{fill:var(--text);font-size:17px;font-weight:800}.legend{font-size:13px;color:var(--text-muted);margin:0 0 16px}.transfers{border-top:1px solid var(--border);padding:12px 0}.transfers button{display:block;margin-top:8px;width:100%;text-align:left}.ticket{border-top:8px solid var(--text);padding:17px 0;min-width:0}.tickethead span{font-size:13px;color:var(--text-muted);display:block;margin-bottom:10px}.tickethead h2{font-size:26px;line-height:1.2}.guide{display:flex;gap:16px;align-items:start;margin:12px 0}.guide>b{font-size:24px;line-height:1.3}.guide p{margin:0}small{display:block;color:var(--text-muted);font-size:12px;overflow-wrap:anywhere}.note{font-size:13px;padding:12px;background:var(--surface-sunken);border-left:3px solid var(--border)}.itinerary{list-style:none;padding:0;margin:20px 0}.itinerary li{display:flex;gap:14px;position:relative;padding-bottom:22px}.itinerary li:not(:last-child):before{content:'';position:absolute;left:12px;top:24px;bottom:0;width:3px;background:var(--text)}.step{border:2px solid var(--text);border-radius:50%;width:27px;height:27px;flex-shrink:0;display:grid;place-items:center;font-weight:700;font-size:13px;background:var(--surface)}.itinerary a:not(.page){color:var(--text);text-decoration-thickness:1px;text-underline-offset:3px}.itinerary small{margin:7px 0}.page{font-size:14px}.exact{font-size:18px;font-weight:600}.logic{border-left:6px solid var(--line-0);padding:12px 16px;background:var(--surface-raised)}.logic>span{font-size:12px;font-weight:700}.logic p{margin:4px 0 14px}details{font-size:14px}summary{cursor:pointer;font-weight:700;padding:5px 0}details p{margin:12px 0}.siblings{display:flex;flex-wrap:wrap;gap:6px}.siblings button{font-size:13px;padding:6px 9px}.searchresult{border-top:1px solid var(--border);padding:13px 0}.searchresult a{color:var(--text)}.searchresult small{margin-top:7px}.notices{margin-top:28px;border-top:3px solid var(--text);padding-top:18px}.notices h2{margin-bottom:4px}.notices>p{font-size:13px;color:var(--text-muted)}.noticegrid{display:grid;grid-template-columns:1fr 1fr;gap:28px}.noticegrid details{border-top:1px solid var(--border);padding:10px 0}.noticegrid small{margin:5px 0}footer{border-top:1px solid var(--border);font-size:12px;color:var(--text-muted);margin-top:25px;padding-top:12px}.mobile{display:none}
  @media(min-width:1500px){.stationname{font-size:17px}}
  @media(max-width:850px){main{padding:18px 20px}.workspace{grid-template-columns:1fr}.ticket{padding-top:18px}.badge{display:none}form{margin-left:0}select{max-width:250px}}
  @media(max-width:550px){.detail .ticket{order:-1}main{padding:15px}header{font-size:11px;gap:10px}.mast{margin:22px 0}h1{font-size:34px}.mast p{font-size:15px}.planner{display:block;width:100%;font-size:14px}.planner select{display:block;max-width:100%;width:100%;margin-top:5px}nav{gap:12px}form{width:100%}input{flex:1;width:0}.network{padding:15px}.mapheading h2{font-size:20px}.linekey{grid-template-columns:1fr;font-size:13px}.desktop{display:none}.mobile{display:block;margin-top:20px}.mobileline{border-left:7px solid var(--line);margin:16px 0;padding:0 0 0 14px}.mobileline h3{margin:0 0 10px;font-size:15px}.mobileline button{display:flex;align-items:center;gap:10px;border:0;background:none;padding:8px 0;min-height:48px;text-align:left;width:100%;font-size:15px}.mobileline b{border:2px solid var(--text);border-radius:50%;min-width:29px;height:29px;display:grid;place-items:center;background:var(--surface-raised)}.mobileline span{flex:1}.mobileline .active b{background:var(--text);color:var(--surface)}.mobileline small{font-size:10px}.legend{margin-top:20px}.noticegrid{grid-template-columns:1fr;gap:5px}.tickethead h2{font-size:24px}.guide{margin:16px 0}.ticket{border-top-width:6px}}
  @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
