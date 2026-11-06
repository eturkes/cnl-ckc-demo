<script lang="ts">
  import cytoscape from 'cytoscape';
  import fcose from 'cytoscape-fcose';
  import { tick, untrack } from 'svelte';
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

  cytoscape.use(fcose);

  let g = $state.raw<Guideline | null>(null);
  let view = $state.raw<HashState>(readHash());
  let picked = $state('');
  let search = $state(view.view === 'explore' ? view.query : '');
  let container = $state<HTMLDivElement | undefined>();
  let cy = $state.raw<cytoscape.Core | undefined>();

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
  const kind = (n: NetworkNode) =>
    n.roles.includes('situation') ? (n.roles.length > 1 ? 'both' : 'situation') : 'acted-on';
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
  const outgoing = $derived(focus === undefined ? [] : edges.filter((e) => e.source === focus.id));
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

  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const FILL = { situation: '--graph-entity', 'acted-on': '--graph-event', both: '--graph-operator' } as const;

  // Build the network once; the state only moves classes, so the layout never reshuffles under the reader.
  $effect(() => {
    if (g === null || container === undefined) return;
    const data = g;
    untrack(() => {
      const ring = data.network.nodes.length;
      const core = cytoscape({
        container,
        elements: [
          ...data.network.nodes.map((n, i) => ({
            data: {
              id: n.id,
              label: n.label,
              fill: token(FILL[kind(n)]),
              size: 14 + Math.sqrt(n.rules.length) * 5,
            },
            position: { x: 400 * Math.cos((2 * Math.PI * i) / ring), y: 400 * Math.sin((2 * Math.PI * i) / ring) },
          })),
          ...[...untrack(() => lines)].map(([id, group]) => {
            const e = group[0];
            const verbs = [...new Set(group.map((x) => x.verb))];
            const rules = new Set(group.map((x) => x.rule)).size;
            return {
              data: { id, source: e.source, target: e.target, verb: `${verbs.join(' / ')}${rules > 1 ? ` (${String(rules)} rules)` : ''}`, width: 1.4 + Math.sqrt(rules) },
              classes: [e.negative ? 'negative' : '', e.modal === 'fact' ? 'fact' : ''].join(' ').trim(),
            };
          }),
        ],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(fill)',
              width: 'data(size)',
              height: 'data(size)',
              label: 'data(label)',
              color: token('--text'),
              'font-family': 'Atkinson Hyperlegible Next, sans-serif',
              'font-size': 15,
              'font-weight': 650,
              'text-valign': 'bottom',
              'text-margin-y': 4,
              'text-wrap': 'wrap',
              'text-max-width': '140px',
              'text-outline-color': token('--surface-raised'),
              'text-outline-width': 3,
              'border-width': 2,
              'border-color': token('--surface-raised'),
            },
          },
          {
            selector: 'edge',
            style: {
              width: 'data(width)',
              'line-color': token('--border'),
              'target-arrow-color': token('--border'),
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.9,
              'curve-style': 'bezier',
              opacity: 0.55,
              'font-family': 'Atkinson Hyperlegible Next, sans-serif',
              'font-size': 13,
              'font-style': 'italic',
              color: token('--text'),
              'text-background-color': token('--surface-raised'),
              'text-background-opacity': 0.92,
              'text-background-padding': '2px',
              'text-rotation': 'none',
              'text-wrap': 'wrap',
              'text-max-width': '160px',
            },
          },
          { selector: 'edge.negative', style: { 'line-style': 'dashed', 'line-dash-pattern': [7, 4] } },
          { selector: 'edge.fact', style: { 'line-style': 'dotted' } },
          { selector: '.faded', style: { opacity: 0.12 } },
          { selector: 'node.faded', style: { 'text-opacity': 0.35 } },
          {
            selector: 'edge.lit',
            style: { opacity: 1, width: 'mapData(width, 1, 6, 3, 6)', 'line-color': token('--action'), 'target-arrow-color': token('--action'), label: 'data(verb)', 'z-index': 9 },
          },
          { selector: 'edge.hover', style: { opacity: 1, label: 'data(verb)', 'z-index': 10 } },
          { selector: 'node.focus', style: { 'border-color': token('--text'), 'border-width': 4 } },
        ],
        layout: {
          name: 'fcose',
          animate: false,
          randomize: false,
          quality: 'proof',
          nodeRepulsion: () => 400000,
          idealEdgeLength: () => 230,
          edgeElasticity: () => 0.15,
          nodeSeparation: 140,
          gravity: 0.15,
          numIter: 5000,
          padding: 20,
        } as cytoscape.LayoutOptions,
        minZoom: 0.25,
        maxZoom: 2.5,
        wheelSensitivity: 0.2,
        boxSelectionEnabled: false,
        autoungrabify: true,
      });
      core.on('tap', 'node', (ev) => openNode(ev.target.id()));
      core.on('tap', 'edge', (ev) => {
        const group = untrack(() => lines).get(ev.target.id()) ?? [];
        const rules = [...new Set(group.map((e) => e.rule))];
        // One rule → read it whole; several → the source concept lists each of them.
        if (rules.length === 1) openRule(rules[0]);
        else if (group[0] !== undefined) openNode(group[0].source);
      });
      core.on('mouseover', 'edge', (ev) => ev.target.addClass('hover'));
      core.on('mouseout', 'edge', (ev) => ev.target.removeClass('hover'));
      cy = core;
    });
    return () => {
      untrack(() => cy)?.destroy();
      cy = undefined;
    };
  });

  // State → classes + framing.
  $effect(() => {
    const core = cy;
    const litIds = new Set(lit.map(lineOf));
    const focusId = focus?.id;
    if (core === undefined || g === null) return;
    core.batch(() => {
      core.elements().removeClass('lit faded focus');
      if (litIds.size > 0 || focusId !== undefined) {
        const on = core.edges().filter((e) => litIds.has(e.id()));
        const ends = on.connectedNodes();
        core.elements().not(on).not(ends).addClass('faded');
        on.addClass('lit');
        if (focusId !== undefined) core.getElementById(focusId).addClass('focus');
      }
    });
    const frame = core.edges('.lit').connectedNodes().union(focusId === undefined ? core.collection() : core.getElementById(focusId));
    core.fit(frame.length > 0 ? frame : undefined, 50);
    // A two-node selection would fill the canvas at maximum zoom: cap it, keep it centred.
    if (core.zoom() > 1.1) {
      core.zoom(1.1);
      core.center(frame.length > 0 ? frame : undefined);
    }
    void tick().then(markReady);
  });
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
        <div class="canvas" bind:this={container} role="img" aria-label="Network of clinical concepts joined by the guideline's recommendations. The same relationships are listed beside it and in the table below."></div>
        <div class="legend">
          <span><i class="dot situation"></i>Patient situation</span>
          <span><i class="dot acted-on"></i>What the clinician acts on</span>
          <span><i class="dot both"></i>Both</span>
          <span><i class="line"></i>Should, can</span>
          <span><i class="line dashed"></i>Should not</span>
          <span><i class="line dotted"></i>Statement of fact</span>
        </div>
        <p class="note">Each line is one action of one recommendation sentence, read as situation → action → what it acts on. Select a line to read its whole rule; select a concept to see every relationship it takes part in.</p>
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
                <dt>Condition</dt><dd>{rule.condition?.replaceAll('-', ' ') ?? 'None: the rule applies without a condition.'}</dd>
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
            <p class="note">{kind(focus) === 'situation' ? 'A patient situation' : kind(focus) === 'both' ? 'A patient situation and something clinicians act on' : 'Something clinicians act on'}, in {focus.rules.length} recommendation sentences.</p>
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
            {#if incoming.length > 0}
              <h3>Recommendations that act on it</h3>
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
  .workspace { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; }
  .network { min-width: 0; border: 1px solid var(--border); background: var(--surface-raised); }
  .canvas { height: 640px; width: 100%; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 10px 16px; font-size: 13px; border-top: 1px solid var(--border); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.situation { background: var(--graph-entity); }
  .dot.acted-on { background: var(--graph-event); }
  .dot.both { background: var(--graph-operator); }
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
