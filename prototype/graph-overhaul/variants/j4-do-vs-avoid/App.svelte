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
  const initial = readHash();
  let search = $state(initial.view === 'explore' ? initial.query : '');
  let situation = $state('opioid-therapy');
  let selected = $state('');
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
    selected = '';
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

  const displayed = $derived(view.view === 'overview' ? edges.filter(e => e.source === situation) : lit);
  const positive = $derived(displayed.filter(e => !e.negative));
  const guardContext = $derived(view.view === 'overview' ? edges.filter(e => e.negative && e.source === 'patient' && e.source !== situation && displayed.some(d => d.rule.split(':')[0] === e.rule.split(':')[0])) : []);
  const negative = $derived([...displayed.filter(e => e.negative), ...guardContext]);
  const chosen = $derived(edges.find(e => e.id === selected));
  const hinges = $derived.by(() => {
    if (!g) return [];
    const pairs: {a: typeof g.rules[number]; b: typeof g.rules[number]}[] = [];
    const normalize = (s: string) => s.replaceAll('does not outweigh', 'outweighs');
    for (let i=0;i<g.rules.length;i++) for(let j=i+1;j<g.rules.length;j++) {
      const a=g.rules[i], b=g.rules[j];
      if(a.document === b.document && a.condition && b.condition && a.condition !== b.condition && normalize(a.condition) === normalize(b.condition)) pairs.push({a,b});
    }
    return pairs;
  });
  $effect(() => { view; picked; situation; selected; if(g) void tick().then(markReady); });
  function selectEdge(id: string) { selected=id; void tick().then(()=>document.querySelector('.edge-evidence')?.scrollIntoView({block:'nearest'})); }
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
      <h1>What to do. What to avoid.</h1>
      <p>Compare actions for a patient situation. Read the conditions before reading the advice.</p>
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
        <div class="mobile-situations"><label for="situation-select">Patient situation</label><select id="situation-select" value={situation} onchange={e=>{go({view:'overview'});situation=e.currentTarget.value;selected='';}}>{#each situations as s}<option value={s.n.id}>{s.n.label} ({s.out} relationships)</option>{/each}</select></div>
        <div class="situation-strip" aria-label="Patient situations">
          {#each situations as s (s.n.id)}<button class:active={situation===s.n.id && view.view==='overview'} onclick={()=>{go({view:'overview'});situation=s.n.id;selected='';}}>{s.n.label} <small>{s.out}</small></button>{/each}
        </div>
        <p class="reading">Prototype reading: positive actions sit under “Do”; negative actions sit under “Avoid”. These are display categories, not categories recorded by the knowledge base. Facts and capabilities keep their own labels.</p>
        {#if view.view==='overview'}
          <h2 class="situation-title">{label(situation)}</h2>
          {#each hinges.filter(h => edges.some(e => e.source===situation && e.rule===`${h.a.document}:${h.a.sentence}`)) as h}
            <details class="hinge">
              <summary>What changes the advice? Benefit outweighs risk / does not outweigh risk</summary>
              <p>These two rules differ in their condition. Neither is a general instruction to reverse the other.</p>
              <div class="hinge-pair">
                {#each [h.a,h.b] as r}
                  <div><strong>{r.condition?.includes('does not outweigh') ? 'Benefit does not outweigh risk' : 'Benefit outweighs risk'}</strong><p class="exact">{r.condition}</p><button class="link" onclick={()=>openRule(`${r.document}:${r.sentence}`)}>Read recommendation {ix.docs.get(r.document)?.rec}, sentence {r.sentence}</button></div>
                {/each}
              </div>
            </details>
          {/each}
        {/if}
        <div class="split-network">
          {#each [{title:'Do / other statements',items:positive},{title:'Avoid',items:negative}] as side}
            <section class="branch">
              <h3>{side.title} <small>{side.items.length} relationships</small></h3>
              {#if side.title==='Avoid' && guardContext.length}<p class="reading">Also shown: negative advice from the same recommendation, under its own condition. The shared recommendation is not a shared condition.</p>{/if}
              {#each side.items as e (e.id)}
                <button class="edge-card" class:negative={e.negative} class:selected={selected===e.id} onclick={()=>selectEdge(e.id)}>
                  <span class="origin"><i></i>{label(e.source)}</span>
                  <span class="connector">{e.verb}{e.modal==='fact' ? ' (fact)' : ''}</span>
                  <strong class="target">{label(e.target)}</strong>
                  {#if e.detail}<span class="detail">{e.detail}</span>{/if}
                  <span class="condition">{e.when.length ? `When ${e.when.join('; ')}` : 'Read the whole condition and guideline scope.'}</span>
                  <span class="ref">Recommendation {e.rec}, sentence {e.rule.split(':').at(-1)}</span>
                </button>
              {:else}<p class="empty">No {side.title==='Avoid' ? 'negative' : 'positive'} relationship in this selection. This does not imply permission.</p>{/each}
            </section>
          {/each}
        </div>
        {#if chosen}
          {@const r=ix.rules.get(chosen.rule)}
          <section class="edge-evidence" aria-label="Supporting rules">
            <h3>Supporting rule</h3>
            <p>Recommendation {chosen.rec}, sentence {r?.sentence}</p>
            <strong>Verbatim condition</strong><p class="exact">{r?.condition ?? 'No condition stated in this sentence.'}</p>
            <blockquote>{r?.original}</blockquote>
            <button class="link" onclick={()=>openRule(chosen.rule)}>Open the whole rule</button>
            {#if r}{@render source(r.document)}{/if}
          </section>
        {/if}
        <p class="note">Select an action edge to read its supporting rule and verbatim condition. A dashed connector means negation, never an exclusion or supersession. Every action keeps its own conditions; adjacent actions are not interchangeable.</p>
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
                <dt>Condition</dt><dd>{rule.condition ?? 'No condition stated in this sentence. The guideline’s scope exclusions still apply.'}</dd>
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
  .mobile-situations {display:none;}
  .situation-strip {display:flex;flex-wrap:wrap;gap:6px;padding:18px;border-bottom:1px solid var(--border);}
  .situation-strip button {font-size:14px;padding:5px 9px;}
  .active {background:var(--graph-entity);color:var(--graph-label);}
  small {font-weight:400;font-size:12px;}
  .reading {font-size:13px;color:var(--text-muted);margin:16px 20px;max-width:85ch;}
  .situation-title {text-align:center;margin:24px 12px;}
  .hinge {margin:16px 20px 24px;padding:16px 20px;border:1px solid var(--graph-document);}
  .hinge h3 {margin:0;}
  .hinge p {font-size:13px;margin:7px 0;}
  .hinge-pair {display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:15px;}
  .exact {font-family:var(--font-ui);overflow-wrap:anywhere;}
  .split-network {display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:0 22px 22px;}
  .branch {min-width:0;}
  .branch h3 {display:flex;justify-content:space-between;border-bottom:2px solid var(--text);padding-bottom:8px;margin:0 0 12px;gap:8px;}
  .edge-card {display:block;text-align:left;width:100%;margin:0 0 14px;border:0;border-left:2px solid var(--graph-edge);border-radius:0;padding:10px 14px;background:var(--surface-sunken);}
  .edge-card.selected {outline:3px solid var(--action);}
  .origin {display:flex;align-items:center;gap:7px;font-size:13px;}
  .origin i {display:inline-block;width:11px;height:11px;border-radius:50%;background:var(--graph-entity);}
  .connector {display:block;margin:5px 0 5px 4px;border-left:2px solid var(--graph-edge);padding:5px 10px;font-size:15px;}
  .negative .connector {border-left-style:dashed;}
  .target {display:block;font-size:18px;line-height:1.3;}
  .condition {display:block;margin-top:8px;font-size:13px;line-height:1.45;}
  .ref {display:block;margin-top:8px;color:var(--action);font-size:12px;}
  .edge-evidence {padding:20px;border-top:2px solid var(--action);background:var(--surface-sunken);}
  .edge-evidence h3 {margin-top:0;}
  .empty {font-size:14px;color:var(--text-muted);}
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
    .split-network, .hinge-pair {grid-template-columns:1fr;}
    .split-network {padding:0 14px 14px;}
    .hinge {margin:14px;padding:14px;}
    .situation-strip {display:none;}
    .mobile-situations {display:block;padding:12px;}
    .reading {margin:10px 14px;}
    .situation-title {margin:14px;}
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
