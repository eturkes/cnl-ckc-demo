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

  import { cleanedNetwork } from './model.mjs';

  cytoscape.use(fcose);

  let g = $state.raw<Guideline | null>(null);
  let view = $state.raw<HashState>(readHash());
  let picked = $state('');
  let selectedLine = $state('');
  let search = $state(untrack(() => view.view === 'explore' ? view.query : ''));
  let container = $state<HTMLDivElement | undefined>();
  let cy = $state.raw<cytoscape.Core | undefined>();
  type Example = { rule: string; subject: string; verb: string; modal: string; items: string[] };
  let examples = $state.raw<Example[]>([]);

  $effect(() => {
    const onHash = () => {
      view = readHash();
      picked = '';
      selectedLine = '';
      if (view.view === 'explore') search = view.query;
    };
    addEventListener('hashchange', onHash);
    // Layout sizes nodes by their labels: measured in a fallback font it packed 29 label overlaps.
    void Promise.all([loadGuideline(), document.fonts.load('600 15px "Atkinson Hyperlegible Next"')]).then(([data]) => {
      const network = cleanedNetwork(data);
      examples = network.examples;
      g = { ...data, network };
    });
    return () => removeEventListener('hashchange', onHash);
  });

  const ix = $derived(g === null ? null : indexGuideline(g));
  const nodes = $derived(new Map((g?.network.nodes ?? []).map((n) => [n.id, n])));
  const edges = $derived(g?.network.edges ?? []);
  const label = (id: string) => nodes.get(id)?.label ?? id;
  /** One fill per projected role; a node holding two roles says so instead of picking one. */
  const kind = (n: NetworkNode) => (n.roles.length > 1 ? 'several' : n.roles[0] ?? 'acted-on');
  const KIND_TEXT = {
    situation: 'A concept that rule conditions name',
    'acted-on': 'Something clinicians act on',
    subject: 'The subject of a statement of fact or capability',
    several: 'A concept with several roles',
  } as const;
  const ROLE_TEXT = { situation: 'named in rule conditions', 'acted-on': 'acted on by clinicians', subject: 'subject of a statement' } as const;
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
  const examplesOf = (key: string) => examples.filter((x) => x.rule === key);
  const exampleHits = $derived.by(() => {
    if (view.view !== 'explore') return [];
    const q = view.query.toLowerCase().replaceAll('-', ' ').trim();
    return q === '' ? [] : examples.filter((x) => [x.subject, ...x.items].some((t) => t.includes(q)));
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
    selectedLine = '';
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
  // User ruling: fill = the KB's declared kind. Every network concept is a KB `entity`, so one fill;
  // the role a projection reads into a concept shows in its panel, never as colour.
  const FILL = '--graph-entity';

  /** Labels hold ~12 px on screen whatever the fit zoom (state effect `px`). */
  const labelStyle = (core: cytoscape.Core) => {
    const px = (n: number) => Math.max(n, n * (0.85 / core.zoom()));
    core.style().selector('node').style({ width: `mapData(size, 14, 40, ${String(px(9))}, ${String(px(22))})`, height: `mapData(size, 14, 40, ${String(px(9))}, ${String(px(22))})`, 'font-size': px(14), 'text-max-width': `${String(px(130))}px`, 'text-outline-width': px(3) }).selector('edge').style({ 'font-size': px(13), 'text-max-width': `${String(px(160))}px` }).update();
  };
  /**
   * fcose packs nodes, not the labels they carry at the overview's fit zoom: 29 label pairs overlapped
   * at 1280 px. Push each overlapping pair apart along its shallower axis at the final label size,
   * refit, repeat; local moves, so the shape fcose found stays.
   */
  const declutter = (core: cytoscape.Core) => {
    for (let round = 0; round < 60; round++) {
      core.fit(undefined, 50);
      labelStyle(core);
      const ns = core.nodes().toArray();
      const bb = ns.map((n) => n.boundingBox({ includeLabels: true }));
      const gap = 6 / core.zoom();
      let moved = 0;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = bb[i], c = bb[j];
          const dx = Math.min(a.x2, c.x2) - Math.max(a.x1, c.x1) + gap;
          const dy = Math.min(a.y2, c.y2) - Math.max(a.y1, c.y1) + gap;
          if (dx <= 0 || dy <= 0) continue;
          moved++;
          const pa = ns[i].position(), pc = ns[j].position();
          if (dx < dy) {
            const s = (pa.x <= pc.x ? -1 : 1) * dx / 2;
            ns[i].position({ x: pa.x + s, y: pa.y });
            ns[j].position({ x: pc.x - s, y: pc.y });
          } else {
            const s = (pa.y <= pc.y ? -1 : 1) * dy / 2;
            ns[i].position({ x: pa.x, y: pa.y + s });
            ns[j].position({ x: pc.x, y: pc.y - s });
          }
        }
      }
      if (moved === 0) return;
    }
  };

  // Build the network once; the state only moves classes, so the layout never reshuffles under the reader.
  $effect(() => {
    if (g === null || container === undefined) return;
    const data = g;
    untrack(() => {
      // A fixed ring start trapped fcose at 26 overlapping label pairs (1280 px, every label on);
      // seeded random starts give 0–3 over 10 seeds. Seeded so every load draws the same map.
      let t = 1;
      const random = Math.random;
      Math.random = () => {
        t = (t + 0x6d2b79f5) | 0;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
      const core = cytoscape({
        container,
        elements: [
          ...data.network.nodes.map((n) => ({
            data: {
              id: n.id,
              label: n.label,
              fullLabel: n.label,
              fill: token(FILL),
              size: 14 + Math.sqrt(n.rules.length) * 5,
            },
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
              'font-weight': 600,
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
              'line-color': token('--text-muted'),
              'target-arrow-color': token('--text-muted'),
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.9,
              'curve-style': 'bezier',
              opacity: 0.35,
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
          { selector: 'node.faded', style: { 'text-opacity': 0 } },
          {
            selector: 'edge.lit',
            style: { opacity: 1, width: 'mapData(width, 1, 6, 3, 6)', 'line-color': token('--action'), 'target-arrow-color': token('--action'), 'z-index': 9 },
          },
          { selector: 'edge.hover', style: { opacity: 1, label: 'data(verb)', 'z-index': 10 } },
          // A hovered lit line keeps the lit relationships' label, never its group's other verbs.
          { selector: 'edge.lit.hover', style: { label: 'data(litVerb)' } },
          { selector: 'node.focus', style: { 'border-color': token('--text'), 'border-width': 4 } },
        ],
        layout: { name: 'preset' },
        minZoom: 0.03,
        maxZoom: 2.5,
        wheelSensitivity: 0.2,
        boxSelectionEnabled: false,
        autoungrabify: true,
      });
      core.layout({
          name: 'fcose',
          animate: false,
          randomize: true,
          quality: 'proof',
          nodeDimensionsIncludeLabels: true,
          nodeRepulsion: () => 900000,
          idealEdgeLength: () => 260,
          edgeElasticity: () => 0.15,
          nodeSeparation: 140,
          gravity: 0.05,
          numIter: 5000,
          padding: 20,
        } as cytoscape.LayoutOptions).run();
      Math.random = random;
      // fcose packs near-square; a wide canvas then fits it at half width. Stretch it to the canvas shape
      // (capped at 2×) so the declutter pass below spends the width, not the height.
      const box = core.nodes().boundingBox();
      const stretch = Math.min(2, Math.max(1, core.width() / core.height() / (box.w / box.h)));
      core.nodes().positions((n) => ({ x: n.position('x') * stretch, y: n.position('y') }));
      if (innerWidth >= 600) declutter(core);
      core.on('tap', 'node', (ev) => openNode(ev.target.id()));
      core.on('tap', 'edge', (ev) => {
        selectedLine = ev.target.id();
      });
      core.on('mouseover', 'node', (ev) => ev.target.style('label', ev.target.data('fullLabel')));
      core.on('mouseout', 'node', (ev) => ev.target.removeStyle('label'));
      core.on('mouseover', 'edge', (ev) => ev.target.addClass('hover'));
      core.on('mouseout', 'edge', (ev) => ev.target.removeClass('hover'));
      cy = core;
      (window as unknown as { __cy?: cytoscape.Core }).__cy = core; // layout probe hook (.scratch/iterate/layout-probe.mjs)
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
    const litEdges = new Set(lit.map((e) => e.id));
    const focusId = focus?.id;
    if (core === undefined || g === null) return;
    core.batch(() => {
      core.elements().removeClass('lit faded focus');
      for (const n of nodes.values()) core.getElementById(n.id).data('label', view.view === 'overview' && innerWidth < 600 ? '' : n.label);
      // A lit line names only the lit relationships: a shared line never lends another rule's verb.
      for (const [id, group] of lines) {
        const own = group.filter((e) => litEdges.has(e.id));
        if (own.length > 0) core.getElementById(id).data('litVerb', [...new Set(own.map((e) => e.verb))].join(' / '));
      }
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
    labelStyle(core);
    void tick().then(markReady);
  });
</script>

{#snippet relation(e: NetworkEdge, from: boolean = true)}
  <p class="relation">
    {#if from && e.source !== e.target}<button class="concept" onclick={() => openNode(e.source)}>{label(e.source)}</button>{/if}
    {#if e.source === e.target}About <button class="concept" onclick={() => openNode(e.target)}>{label(e.target)}</button>:{/if}
    <span class="verb" class:negative={e.negative}>{e.verb}</span>
    {#if e.source !== e.target}<button class="concept" onclick={() => openNode(e.target)}>{label(e.target)}</button>{/if}
    {#if e.detail}<span class="detail">{e.detail}</span>{/if}
  </p>
  {#if e.when.length > 0}<p class="when">When {e.when.join('; ')}</p>{/if}
  {#if (e.starts.length) > 1}<p class="note">One rule, drawn from each concept its condition names: {e.starts.join(', ')}. Its lines state no relationship between them.</p>{/if}
{/snippet}

{#snippet exampleList(key: string)}
  {#each examplesOf(key) as x (x.subject + x.verb)}
    <p class="examples"><span class="note">Examples this sentence lists, not drawn in the network:</span> {x.subject} {x.verb} {x.items.join(', ')}.</p>
  {/each}
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
      <h1>Clinical concepts, without the scaffolding</h1>
      <p>The same clinical rules. Specific concepts remain; generic patient, benefit and risk referents move onto their relationships.</p>
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
        {#if view.view === 'overview'}
          <div class="mobile-concepts"><p>Most shared concepts. Select one to read its network.</p>
            {#each [...nodes.values()].sort((a,b) => b.rules.length-a.rules.length || a.label.localeCompare(b.label)).slice(0,8) as n (n.id)}
              <button class="concept" onclick={() => openNode(n.id)}>{n.label}</button>
            {/each}
          </div>
        {/if}
        <div class="legend">
          <span><i class="dot"></i>Clinical concept (the knowledge base's kind: entity)</span>
          <span><i class="line"></i>Should, can</span>
          <span><i class="line dashed"></i>Should not</span>
          <span><i class="line dotted"></i>Statement of fact</span>
        </div>
        <p class="note">Example lists, such as the warning signs of overdose, are no nodes: each shows beside the sentence that lists it. Prototype reading: bare patient, benefit and risk endpoints become attached advice loops. A loop is not a self-relation. Every original action and condition remains. Every concept is labelled on a wide screen; on a phone, select a dot or use the relationship selector below. Each line joins a concept a rule's condition names — a patient situation or a treatment in course — to what clinicians act on, and is labelled with what the recommendations say, one or more rules per line. Hover a line to read its verb; select it to read every supporting rule; select a concept to see every relationship it takes part in.</p>
      </section>

      <aside>
        <label for="relationship-pick">Select a relationship to read its supporting rules</label>
        <select id="relationship-pick" bind:value={selectedLine}>
          <option value="">Choose a relationship</option>
          {#each [...lines] as [id, group] (id)}
            <option value={id}>{label(group[0].source)}: {group[0].verb} {group[0].source === group[0].target ? '' : label(group[0].target)}</option>
          {/each}
        </select>
        {#if selectedLine}
          <section class="selected-edge" aria-label="Supporting rules for selected relationship">
            <h2>Rules behind this relationship</h2>
            {#each [...new Set((lines.get(selectedLine) ?? []).map(e => e.rule))] as key (key)}
              {@const r = ix.rules.get(key)}
              <div class="item">
                <h3>{key.replace('cdc2022-opioid-', '')}</h3>
                {#each (lines.get(selectedLine) ?? []).filter(e => e.rule === key) as e (e.id)}{@render relation(e)}{/each}
                <p><strong>Condition, verbatim:</strong> {r?.condition ?? 'No condition stated in this sentence.'}</p>
                <button class="link" onclick={() => openRule(key)}>Open recommendation sentence</button>
                {@render source(key.slice(0, key.lastIndexOf(':')))}
              </div>
            {/each}
          </section>
        {/if}
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
                  {#each edges.filter((e) => e.rule === key) as e (e.id)}{@render relation(e)}{:else}{#if examplesOf(key).length === 0}<p>{ix.sentence(key)?.ace}</p>{/if}{/each}
                  {@render exampleList(key)}
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
                <dd>{#each lit as e (e.id)}{@render relation(e)}{:else}{#if examplesOf(ruleKey(view.document, view.sentence)).length === 0}Nothing drawn from this sentence.{:else}Nothing: this sentence lists examples.{/if}{/each}{@render exampleList(ruleKey(view.document, view.sentence))}</dd>
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
              <h3>When a rule's condition names it, clinicians</h3>
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
            {#if exampleHits.length > 0}
              <p class="notfound">“{view.query}” is no concept in the network. The guideline names it as an example:</p>
              {#each exampleHits as x (x.rule + x.subject)}<div class="item"><p>{x.subject} {x.verb} {x.items.join(', ')}.</p><button class="link" onclick={() => openRule(x.rule)}>Read the sentence</button></div>{/each}
            {:else}
              <p class="notfound">No clinical concept matches “{view.query}”. Try a shorter word, such as pain or opioid.</p>
            {/if}
          {/if}
        {:else}
          <h2>The guideline at a glance</h2>
          <p>{g.recommendations.length} recommendations hold {g.rules.length} clinical rules. The network draws them as {edges.length} relationships between {nodes.size} concepts.</p>
          <h3>Concepts that start the most relationships</h3>
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
        <thead><tr><th>Condition concept or subject</th><th>Relationship</th><th>Acts on</th><th>Condition</th><th>Sentence</th></tr></thead>
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
  .canvas { height: 660px; width: 100%; }
  .mobile-concepts { display: none; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 10px 16px; font-size: 13px; border-top: 1px solid var(--border); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--graph-entity); }
  .line { width: 26px; border-top: 2px solid var(--text-muted); }
  .line.dashed { border-top-style: dashed; }
  .line.dotted { border-top-style: dotted; }
  .note { font-size: 13px; color: var(--text-muted); }
  .network .note { padding: 0 16px 12px; margin: 0; max-width: 90ch; }
  aside { min-width: 0; max-width: 85ch; padding-right: 6px; }
  .selected-edge { padding: 18px; border: 2px solid var(--action); margin-bottom: 24px; }
  label { font-size: 14px; }
  select { width: 100%; margin: 6px 0 4px; }
  .statements { padding-left: 22px; }
  .statements li { padding-bottom: 18px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
  .relation { margin: 6px 0 2px; line-height: 2; }
  .concept { padding: 1px 8px; border-radius: 12px; font-weight: 650; font-size: 14px; }
  .verb { margin: 0 4px; font-style: italic; }
  .verb.negative { text-decoration: underline dashed; text-underline-offset: 4px; }
  .examples { margin: 6px 0; }
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
  @media (max-width: 600px) { .mobile-concepts { display: block; padding: 12px; } .mobile-concepts p { margin-top: 0; } .mobile-concepts button { margin: 3px; } }
  @media (max-width: 400px) {
    form > div { display: block; }
    form button { margin-top: 8px; width: 100%; }
  }
</style>
