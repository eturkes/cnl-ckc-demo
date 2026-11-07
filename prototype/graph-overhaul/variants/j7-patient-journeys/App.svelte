<script lang="ts">
  import { tick } from 'svelte';
  import { journeys } from './model.mjs';
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
  let selected = $state('');
  const panels = $derived(g ? journeys(g) : []);
  const selectedGroup = $derived(panels.flatMap(p => p.groups).find(x => x.id === selected));
  const selectedRules = $derived([...new Set(selectedGroup?.edges.map(e => e.rule) ?? [])]);

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
  /** One fill per projected role; a node holding two roles says so instead of picking one. */
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
  /** Fact + capability sentences keep their own subject: never phrased as a clinician's action. */
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

  function selectConnection(id: string) {
    selected = id;
    void tick().then(() => document.querySelector('.edge-detail')?.scrollIntoView({ block: 'start' }));
  }
  const active = (group: { edges: NetworkEdge[] }) => group.edges.some(e => lit.some(x => x.id === e.id));
  $effect(() => { view; picked; selected; if (g) void tick().then(markReady); });
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
      <h1>Different patients. Shared recommendations.</h1>
      <p>Compare six patient situations, then open the rules that connect each to a recommendation.</p>
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

    <p class="reading"><strong>Prototype reading:</strong> these six situations and their order are hand-made. A connection means that a rule names the situation in its condition or concept anchor, not that the whole recommendation applies. Other conditions still matter. “Receiving or continuing” does not establish a long-term duration. Rules without these matches stay in the last panel.</p>
    <div class="workspace" class:focused={view.view !== 'overview'}>
      <section class="multiples" aria-label="Patient situation networks">
        {#each panels as panel (panel.id)}
          <article class="journey" class:residual={panel.id === 'other'}>
            <h2>{panel.label}</h2>
            <p class="panel-count">{panel.groups.length} recommendations · {new Set(panel.edges.map(e => e.rule)).size} rules explicitly matched</p>
            <svg viewBox={`0 0 480 ${Math.max(130,panel.groups.length*53+24)}`} role="img" aria-label={`${panel.label}, linked recommendations`}>
              <defs><marker id={`arrow-${panel.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
              <circle cx="38" cy={Math.max(130,panel.groups.length*53+24)/2} r="17" class="ego" />
              <text x="38" y={Math.max(130,panel.groups.length*53+24)/2+5} text-anchor="middle" class="ego-label">{panel.id==='other'?'?':'P'}</text>
              {#each panel.groups as group,i (group.id)}
                {@const y=38+i*53}
                <path d={`M 56 ${Math.max(130,panel.groups.length*53+24)/2} C 110 ${Math.max(130,panel.groups.length*53+24)/2} 110 ${y} 180 ${y}`} class="spoke" class:highlight={active(group)} class:negative={group.edges.every(e=>e.negative)} marker-end={`url(#arrow-${panel.id})`} />
                <text x="180" y={y-9} class="edge-label">{group.verbs}</text>
                <foreignObject x="183" y={y-4} width="285" height="37">
                  <button class="rec-node" class:highlight={active(group)} aria-pressed={selected===group.id} onclick={()=>selectConnection(group.id)}>Recommendation {group.rec} <span>{new Set(group.edges.map(e=>e.rule)).size} rules</span></button>
                </foreignObject>
              {/each}
            </svg>
            <div class="mobile-network">
              <span class="mobile-ego">{panel.id==='other'?'Unassigned rules':'Patient situation'}</span>
              {#each panel.groups as group (group.id)}
                <div class="mobile-spoke" class:highlight={active(group)} class:negative={group.edges.every(e=>e.negative)}>
                  <span>{group.verbs}</span>
                  <button class="rec-node" class:highlight={active(group)} aria-pressed={selected===group.id} onclick={()=>selectConnection(group.id)}>Recommendation {group.rec} <span>{new Set(group.edges.map(e=>e.rule)).size} rules</span></button>
                </div>
              {/each}
            </div>
            <p class="note">{panel.id==='other'?'No patient applicability inferred. Read each condition.':'Select a recommendation connection to read every supporting rule.'}</p>
          </article>
        {/each}
        <p class="legend">P = patient situation. Violet nodes = recommendations. Dashed = all supporting actions are negative. A mixed connection lists both polarities. Highlighted connections belong to the selected answer, rule or concept.</p>
        {#if selectedGroup}
          <section class="edge-detail" aria-label="Supporting rules for selected connection">
            <h2>Supporting rules for this connection</h2>
            <p>{panels.find(p=>p.groups.some(x=>x.id===selectedGroup.id))?.label} / Recommendation {selectedGroup.rec}</p>
            {#each selectedRules as key}
              {@const r=ix.rules.get(key)}
              <article class="supporting-rule">
                <h3>{key.replace('cdc2022-opioid-', '')}</h3>
                <p><strong>Verbatim condition:</strong> {r?.condition ?? 'No condition stated.'}</p>
                {#each selectedGroup.edges.filter(e=>e.rule===key) as e (e.id)}{@render relation(e)}{/each}
                <button class="link" onclick={()=>openRule(key)}>Open the whole rule</button>
                {@render source(r?.document ?? '')}
              </article>
            {/each}
          </section>
        {/if}
      </section>

      <aside>
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
                <dt>Verbatim condition</dt><dd>{rule.condition ?? 'No condition stated in this sentence. The guideline’s scope exclusions still apply.'}</dd>
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
          <h2>Compare the patient situations</h2>
          <p>{g.recommendations.length} recommendations hold {g.rules.length} clinical rules. The panels show explicit links to recommendation documents. Generic rules stay visible, without being assigned to a patient.</p>
          <h3>Explore the underlying clinical concepts</h3>
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
  .focused { grid-template-columns: minmax(0,1fr) 380px; align-items: start; }
  .focused .multiples { grid-column: 1; grid-row: 1; grid-template-columns: minmax(0,1fr); }
  .focused aside { grid-column: 2; grid-row: 1; max-height: 650px; position: sticky; top: 16px; border: 1px solid var(--border); padding: 18px; background: var(--surface-raised); }
  @media (max-width: 900px) {
    .focused { grid-template-columns: minmax(0,1fr); }
    .focused aside { grid-column: 1; grid-row: 1; position: static; max-height: 340px; }
    .focused .multiples { grid-column: 1; grid-row: 2; }
  }
  .reading { max-width: 110ch; font-size: 14px; margin: 18px 0 24px; }
  .multiples { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; min-width: 0; align-items: start; }
  .journey { background: var(--surface-raised); border: 1px solid var(--border); padding: 18px; min-width: 0; }
  .journey h2 { font-size: 22px; margin-bottom: 3px; }
  .panel-count { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; }
  .journey svg { display: block; width: 100%; height: auto; }
  .ego { fill: var(--graph-entity); }
  .ego-label { fill: var(--graph-label); font-weight: 750; font-size: 15px; }
  .spoke { stroke: var(--text-muted); stroke-width: 1.7; fill: none; }
  .spoke.negative { stroke-dasharray: 6 4; }
  .spoke.highlight { stroke: var(--action); stroke-width: 4; }
  .edge-label { fill: var(--text); font-size: 13px; }
  .rec-node { padding: 3px 10px; width: 100%; background: var(--graph-document); color: var(--graph-label); border: 2px solid transparent; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
  .rec-node span { font-size: 12px; }
  .rec-node.highlight { border-color: var(--focus-ring); }
  .rec-node[aria-pressed='true'] { outline: 3px solid var(--action); outline-offset: 2px; }
  .edge-detail, .legend { grid-column: 1 / -1; }
  .edge-detail { background: var(--surface-raised); border: 2px solid var(--action); padding: 20px; }
  .supporting-rule { border-top: 1px solid var(--border); max-width: 80ch; padding-bottom: 14px; }
  .legend { font-size: 13px; color: var(--text-muted); }
  .journey .note { margin-bottom: 0; }
  .mobile-network { display: none; }
  @media (max-width: 650px) {
    .multiples { grid-template-columns: minmax(0,1fr); }
    .journey { padding: 12px; }
    .journey h2 { font-size: 20px; }
    .journey svg { display: none; }
    .mobile-network { display: block; padding: 8px 0 4px 10px; }
    .mobile-ego { background: var(--graph-entity); color: var(--graph-label); padding: 3px 10px; font-size: 14px; }
    .mobile-spoke { border-left: 2px solid var(--text-muted); margin-left: 10px; padding: 12px 0 0 18px; position: relative; }
    .mobile-spoke::before { content: ''; position: absolute; left: 0; top: 49px; width: 18px; border-top: 2px solid var(--text-muted); }
    .mobile-spoke.negative::before { border-top-style: dashed; }
    .mobile-spoke.highlight { border-color: var(--action); }
    .mobile-spoke > span { display: block; font-size: 13px; }
    .focused aside { max-height: 440px; }
  }

  .network { min-width: 0; border: 1px solid var(--border); background: var(--surface-raised); }
  .canvas { height: 720px; width: 100%; }
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
  aside { min-width: 0; max-height: 760px; overflow: auto; padding-right: 6px; }
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
    .canvas { height: 440px; }
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
