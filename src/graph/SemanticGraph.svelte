<script lang="ts">
  import { onDestroy, tick } from 'svelte';

  import graphAssetUrl from '@kb/graph/semantic-graph.json?url&no-inline';

  import { mountGraphCanvas, type GraphCanvas } from './canvas.js';
  import {
    DEFAULT_NEIGHBOR_LIMIT,
    MAX_NEIGHBOR_LIMIT,
    SemanticGraphModel,
    graphFocusKey,
    graphRelationLabel,
    parseSemanticGraph,
    type GraphEvidenceSubgraph,
    type GraphFocus,
    type GraphPath,
    type GraphSubgraph,
    type SemanticGraphEdge,
    type SemanticGraphNode,
  } from './model.js';

  interface Props {
    /** URL injection keeps nested-host and failure-path checks independent of Vite output names. */
    graphUrl?: string;
    /** Applied after activation; supplying a focus token never fetches the graph by itself. */
    focus?: GraphFocus | null;
    /** Monotonic, user-originated request to activate and reveal the supplied focus. */
    focusRequest?: number;
    /** User-originated selection from the canvas, search results, path, or HTML graph. */
    onSelect?: (node: SemanticGraphNode) => void;
  }

  let {
    graphUrl = graphAssetUrl,
    focus = null,
    focusRequest = 0,
    onSelect = () => undefined,
  }: Props = $props();

  const uid = $props.id();
  const headingId = `${uid}-heading`;
  const searchId = `${uid}-search`;
  const searchHelpId = `${uid}-search-help`;
  const pathHeadingId = `${uid}-path-heading`;
  const htmlHeadingId = `${uid}-html-heading`;

  type Phase = 'inactive' | 'loading' | 'ready' | 'error';

  let phase = $state<Phase>('inactive');
  let model = $state.raw<SemanticGraphModel | null>(null);
  let selectedId = $state<string | null>(null);
  let query = $state('');
  let depth = $state(1);
  let nodeLimit = $state(DEFAULT_NEIGHBOR_LIMIT);
  let path = $state.raw<GraphPath | null>(null);
  let evidenceView = $state.raw<GraphEvidenceSubgraph | null>(null);
  let pathStatus = $state('');
  let loadError = $state('');
  let canvasError = $state('');
  let canvasHost = $state<HTMLElement>();
  let focusNotice = $state<HTMLElement>();
  let selectionCard = $state<HTMLElement>();
  let canvas = $state.raw<GraphCanvas>();
  let request: AbortController | undefined;
  let destroyed = false;
  let appliedFocus = '';
  let handledFocusRequest = 0;
  let focusAfterLoad = false;

  const selected = $derived(
    model === null || selectedId === null ? undefined : model.node(selectedId),
  );
  const searchResults = $derived(model === null ? [] : model.search(query));
  const subgraph = $derived<GraphSubgraph>(
    model === null || selectedId === null
      ? { nodes: [], edges: [], truncatedNodes: false, truncatedEdges: false }
      : (evidenceView ??
          model.neighborhood(selectedId, depth, nodeLimit, path?.nodes ?? [], path?.edges ?? [])),
  );
  const relationPool = $derived(
    model === null || selectedId === null
      ? []
      : evidenceView === null
        ? model.incident(selectedId)
        : evidenceView.edges.filter(
            (edge) => edge.source === selectedId || edge.target === selectedId,
          ),
  );
  const relations = $derived(relationPool.slice(0, 60));
  const canExpand = $derived(
    selected !== undefined &&
      (evidenceView !== null || depth < 3 || nodeLimit < MAX_NEIGHBOR_LIMIT),
  );

  const choose = (id: string, notify = true, retainEvidence = false): void => {
    const node = model?.node(id);
    if (node === undefined) return;
    selectedId = node.id;
    depth = 1;
    nodeLimit = DEFAULT_NEIGHBOR_LIMIT;
    path = null;
    pathStatus = '';
    if (!retainEvidence) evidenceView = null;
    if (notify) onSelect(node);
  };

  const peerOf = (edge: SemanticGraphEdge): SemanticGraphNode | undefined => {
    if (model === null || selectedId === null) return undefined;
    return model.node(edge.source === selectedId ? edge.target : edge.source);
  };

  const findPath = (target: string): void => {
    if (model === null || selectedId === null) return;
    evidenceView = null;
    const found = model.shortestPath(selectedId, target);
    path = found ?? null;
    pathStatus =
      found === undefined
        ? 'No connecting path was found.'
        : `Shortest path: ${String(Math.max(0, found.nodes.length - 1))} relationships.`;
  };

  const expand = (): void => {
    if (evidenceView !== null) {
      evidenceView = null;
      depth = 2;
      return;
    }
    depth = Math.min(3, depth + 1);
    nodeLimit = Math.min(MAX_NEIGHBOR_LIMIT, nodeLimit + DEFAULT_NEIGHBOR_LIMIT);
  };

  const revealFocusedGraph = async (): Promise<void> => {
    await tick();
    const target = evidenceView === null ? selectionCard : focusNotice;
    target?.scrollIntoView?.({ block: 'start' });
    target?.focus({ preventScroll: true });
    canvas?.recenter(evidenceView === null ? (selectedId ?? undefined) : undefined);
  };

  const applyFocus = (next: GraphFocus, reveal = false): void => {
    const current = model;
    if (current === null) return;
    const scoped = typeof next === 'string' ? undefined : current.evidenceSubgraph(next);
    const resolved = current.resolveFocus(next) ?? scoped?.nodes[0];
    evidenceView = scoped ?? null;
    query = '';
    if (resolved !== undefined) choose(resolved.id, false, true);
    if (reveal) void revealFocusedGraph();
  };

  const activate = async (): Promise<void> => {
    request?.abort();
    canvas?.destroy();
    canvas = undefined;
    model = null;
    selectedId = null;
    path = null;
    evidenceView = null;
    loadError = '';
    canvasError = '';
    phase = 'loading';
    const active = new AbortController();
    request = active;
    try {
      const response = await fetch(graphUrl, {
        signal: active.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`graph asset returned HTTP ${String(response.status)}`);
      const value: unknown = await response.json();
      const loaded = new SemanticGraphModel(parseSemanticGraph(value));
      if (destroyed || active.signal.aborted) return;
      model = loaded;
      const scoped =
        focus === null || typeof focus === 'string' ? undefined : loaded.evidenceSubgraph(focus);
      const initial =
        (focus === null ? undefined : loaded.resolveFocus(focus)) ??
        scoped?.nodes[0] ??
        loaded.data.nodes.find((node) => node.kind === 'document') ??
        loaded.data.nodes[0];
      selectedId = initial?.id ?? null;
      evidenceView = scoped ?? null;
      appliedFocus = graphFocusKey(focus);
      phase = 'ready';
      await tick();
      if (destroyed || active.signal.aborted || canvasHost === undefined) return;
      try {
        canvas = await mountGraphCanvas(canvasHost, (id) => {
          choose(id);
        });
      } catch (cause) {
        canvasError = `The visual graph is unavailable. Use the complete HTML navigation below. ${
          cause instanceof Error ? cause.message : String(cause)
        }`;
      }
      if (focusAfterLoad) {
        focusAfterLoad = false;
        await revealFocusedGraph();
      }
    } catch (cause) {
      if (destroyed || active.signal.aborted) return;
      phase = 'error';
      loadError = `The semantic graph did not load. ${cause instanceof Error ? cause.message : String(cause)}`;
    } finally {
      if (request === active) request = undefined;
    }
  };

  $effect(() => {
    const current = canvas;
    const view = subgraph;
    const root = selectedId;
    const route = path;
    if (current !== undefined && root !== null) current.update(view, root, route);
  });

  $effect(() => {
    const current = model;
    const next = focus;
    const key = graphFocusKey(next);
    if (current === null) return;
    if (next === null) {
      appliedFocus = '';
      evidenceView = null;
      return;
    }
    if (key === appliedFocus) return;
    appliedFocus = key;
    applyFocus(next);
  });

  $effect(() => {
    const nextRequest = focusRequest;
    const next = focus;
    const currentPhase = phase;
    if (nextRequest === 0 || nextRequest === handledFocusRequest) return;
    handledFocusRequest = nextRequest;
    focusAfterLoad = true;
    if (currentPhase === 'inactive' || currentPhase === 'error') {
      void activate();
    } else if (currentPhase === 'ready' && next !== null) {
      focusAfterLoad = false;
      appliedFocus = graphFocusKey(next);
      applyFocus(next, true);
    }
  });

  onDestroy(() => {
    destroyed = true;
    request?.abort();
    canvas?.destroy();
  });
</script>

<section class="graph-shell" aria-labelledby={headingId} tabindex="-1">
  <header>
    <div>
      <p class="eyebrow">Graph</p>
      <h2 id={headingId}>Semantic knowledge graph</h2>
    </div>
    {#if phase === 'ready' && model !== null}
      <p class="counts">
        {model.data.stats.nodes.toLocaleString()} nodes · {model.data.stats.edges.toLocaleString()}
        relationships
      </p>
    {/if}
  </header>

  {#if phase === 'inactive'}
    <div class="activation">
      <p>
        Navigate the documents, entities, events, values, and logical context compiled into the
        knowledge base.
      </p>
      <button class="primary" type="button" onclick={() => void activate()}>Explore graph</button>
      <p class="load-note">
        The graph data and layout engine load only after you select this control.
      </p>
    </div>
  {:else if phase === 'loading'}
    <div class="pending" role="status">
      <span class="pulse" aria-hidden="true"></span>
      Loading the semantic graph.
    </div>
  {:else if phase === 'error'}
    <div class="load-failure" role="alert">
      <p>{loadError}</p>
      <button class="primary" type="button" onclick={() => void activate()}>Try again</button>
    </div>
  {:else if model !== null && selected !== undefined}
    {#if evidenceView !== null}
      <div class="evidence-focus" tabindex="-1" bind:this={focusNotice}>
        <p class="kind">Answer evidence</p>
        <p>
          <strong
            >Focused on {evidenceView.sentences.length}
            {evidenceView.sentences.length === 1
              ? 'controlled sentence'
              : 'controlled sentences'}</strong
          >
          from <code>{evidenceView.document}</code>. This view contains only the relationships
          compiled from the selected source contribution.
        </p>
      </div>
    {/if}

    <div class="toolbar">
      <label for={searchId}>Find a node</label>
      <div class="search-row">
        <input
          id={searchId}
          type="search"
          placeholder="Search labels, kinds, or document IDs"
          autocomplete="off"
          bind:value={query}
          aria-describedby={searchHelpId}
        />
        <button type="button" onclick={() => canvas?.recenter(selectedId ?? undefined)}>
          Recenter
        </button>
        <button type="button" disabled={!canExpand} onclick={expand}>Expand</button>
      </div>
      <p id={searchHelpId} class="help">
        Select a result to move the neighborhood. Select Path to keep this node and show the
        shortest connection.
      </p>

      {#if query.trim() !== ''}
        <div class="search-results" aria-label="Graph search results">
          {#if searchResults.length === 0}
            <p>No matching nodes.</p>
          {:else}
            <ul>
              {#each searchResults as result (result.id)}
                <li>
                  <button class="result" type="button" onclick={() => choose(result.id)}>
                    <span>{result.label}</span>
                    <small>{result.kind}</small>
                  </button>
                  {#if result.id !== selectedId}
                    <button class="path-action" type="button" onclick={() => findPath(result.id)}>
                      Path
                      <span class="visually-hidden"> to {result.label}</span>
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>

    <div class="selection-card" tabindex="-1" bind:this={selectionCard}>
      <div>
        <p class="kind">{selected.kind.replace(/-/gu, ' ')}</p>
        <h3>{selected.label}</h3>
        <p class="identifier">{selected.id}</p>
      </div>
      {#if selected.document !== undefined}
        <p class="location">
          {selected.document}{selected.sentence === undefined
            ? ''
            : ` · sentence ${String(selected.sentence)}`}
        </p>
      {/if}
    </div>

    <div class="canvas-frame">
      <div class="canvas" bind:this={canvasHost} aria-hidden="true"></div>
      <div class="legend" aria-hidden="true">
        <span class="document">Document</span>
        <span class="entity">Entity</span>
        <span class="event">Event</span>
        <span class="operator">Operator</span>
        <span class="value">Value</span>
      </div>
    </div>
    {#if canvasError !== ''}
      <p class="canvas-error" role="status">{canvasError}</p>
    {/if}

    <p class="view-status" role="status">
      Showing {subgraph.nodes.length.toLocaleString()} nodes and
      {subgraph.edges.length.toLocaleString()} relationships{evidenceView === null
        ? ` at depth ${String(depth)}`
        : ' for the selected answer evidence'}.
      {#if subgraph.truncatedNodes || subgraph.truncatedEdges}
        The view is capped for readability. Select Expand to reveal more.
      {/if}
    </p>

    {#if path !== null}
      <section class="path-panel" aria-labelledby={pathHeadingId}>
        <div class="panel-heading">
          <h3 id={pathHeadingId}>Shortest path</h3>
          <button
            type="button"
            onclick={() => {
              path = null;
              pathStatus = '';
            }}>Clear</button
          >
        </div>
        <p>{pathStatus}</p>
        <ol>
          {#each path.nodes as id (id)}
            {@const node = model.node(id)}
            {#if node !== undefined}
              <li><button type="button" onclick={() => choose(node.id)}>{node.label}</button></li>
            {/if}
          {/each}
        </ol>
      </section>
    {:else if pathStatus !== ''}
      <p class="path-status" role="status">{pathStatus}</p>
    {/if}

    <section class="html-graph" aria-labelledby={htmlHeadingId}>
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Accessible graph view</p>
          <h3 id={htmlHeadingId}>Relationships from {selected.label}</h3>
        </div>
      </div>

      {#if relations.length === 0}
        <p>This node has no relationships.</p>
      {:else}
        <ul class="relations">
          {#each relations as relation (relation.id)}
            {@const peer = peerOf(relation)}
            {#if peer !== undefined}
              <li>
                <span class="relation">{graphRelationLabel(relation)}</span>
                <button type="button" onclick={() => choose(peer.id)}>{peer.label}</button>
                <small>{peer.kind.replace(/-/gu, ' ')}</small>
              </li>
            {/if}
          {/each}
        </ul>
        {#if relationPool.length > relations.length}
          <p class="help">
            Showing the first {relations.length} of {relationPool.length} direct relationships. Use search
            to reach any node.
          </p>
        {/if}
      {/if}

      <details>
        <summary>Nodes in this visual neighborhood</summary>
        <ul class="node-index">
          {#each subgraph.nodes as node (node.id)}
            <li>
              <button
                type="button"
                aria-current={node.id === selectedId ? 'true' : undefined}
                onclick={() => choose(node.id)}>{node.label}</button
              >
              <small>{node.kind.replace(/-/gu, ' ')}</small>
            </li>
          {/each}
        </ul>
      </details>
    </section>
  {/if}
</section>

<style>
  .graph-shell {
    margin-top: clamp(4rem, 7vw, 5rem);
    border-block: 1px solid var(--border);
  }

  header,
  .activation,
  .pending,
  .load-failure,
  .evidence-focus,
  .toolbar,
  .selection-card,
  .view-status,
  .path-panel,
  .path-status,
  .html-graph {
    padding-inline: 0;
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    padding-block: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  h2,
  h3,
  p {
    margin-top: 0;
  }

  h2 {
    margin-bottom: 0;
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 650;
    line-height: 1.15;
    letter-spacing: -0.025em;
  }

  h3 {
    margin-bottom: 0.25rem;
    font-size: 1rem;
  }

  .eyebrow,
  .kind {
    margin-bottom: 0.2rem;
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .counts,
  .load-note,
  .help,
  .location,
  .view-status,
  small {
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  .counts {
    margin-bottom: 0;
    white-space: nowrap;
  }

  .graph-shell:focus-visible,
  .evidence-focus:focus-visible,
  .selection-card:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 3px;
  }

  .evidence-focus {
    scroll-margin-top: 5rem;
    padding-block: 1rem;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--action) 6%, transparent);
  }

  .evidence-focus p:last-child {
    max-width: 52rem;
    margin-bottom: 0;
    color: var(--text-muted);
    font-size: 0.88rem;
  }

  .evidence-focus strong {
    color: var(--text);
  }

  .evidence-focus code {
    color: var(--text);
    font-family: var(--font-code);
    font-size: 0.8em;
    overflow-wrap: anywhere;
  }

  .activation,
  .pending,
  .load-failure {
    padding-block: 1.75rem;
  }

  .activation > p:first-child {
    max-width: 46rem;
    color: var(--text-muted);
  }

  .load-note {
    margin: 0.65rem 0 0;
  }

  .pending {
    display: flex;
    gap: 0.65rem;
    align-items: center;
  }

  .pulse {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background: var(--action);
    animation: pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    to {
      opacity: 0.3;
      transform: scale(0.72);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse {
      animation: none;
    }
  }

  button,
  input {
    font: inherit;
  }

  button {
    min-height: 2.35rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    padding: 0.4rem 0.7rem;
    background: transparent;
    color: var(--text);
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--action);
    color: var(--action);
  }

  button:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button.primary {
    border-color: var(--action);
    background: var(--action);
    color: var(--action-text);
    font-weight: 650;
  }

  .toolbar {
    padding-block: 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  .toolbar > label {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.78rem;
    font-weight: 650;
  }

  .search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.45rem;
  }

  input {
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    padding: 0.6rem 0.7rem;
    background: var(--surface-raised);
    color: var(--text);
  }

  .help {
    margin: 0.45rem 0 0;
  }

  .search-results {
    max-height: 17rem;
    margin-top: 0.65rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: var(--surface-raised);
    overflow-y: auto;
  }

  .search-results > p {
    margin: 0;
    padding: 0.65rem;
  }

  .search-results ul,
  .relations,
  .node-index {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .search-results li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.35rem;
    align-items: center;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    padding: 0.35rem;
  }

  .search-results li:last-child {
    border-bottom: 0;
  }

  .result {
    display: flex;
    min-width: 0;
    justify-content: space-between;
    gap: 0.75rem;
    border-color: transparent;
    text-align: left;
  }

  .result span,
  .identifier {
    overflow-wrap: anywhere;
  }

  .path-action {
    font-size: 0.8rem;
  }

  .selection-card {
    display: flex;
    scroll-margin-top: 5rem;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
    padding-block: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .kind,
  .identifier,
  .location {
    margin-bottom: 0;
  }

  .identifier {
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.72rem;
  }

  .location {
    text-align: right;
  }

  .canvas-frame {
    position: relative;
    border-bottom: 1px solid var(--border);
    background: var(--surface-sunken);
  }

  .canvas {
    width: 100%;
    height: clamp(24rem, 62vh, 40rem);
  }

  .legend {
    position: absolute;
    right: 0.65rem;
    bottom: 0.65rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    max-width: calc(100% - 1.3rem);
    border: 1px solid var(--border);
    border-radius: 0.15rem;
    padding: 0.45rem 0.55rem;
    background: var(--surface-raised);
  }

  .legend span {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
    padding: 0;
    color: var(--text-muted);
    font-size: 0.65rem;
  }

  .legend span::before {
    width: 0.45rem;
    height: 0.45rem;
    content: '';
  }

  .legend .document::before {
    background: #245c73;
  }

  .legend .entity::before {
    background: #176b68;
  }

  .legend .event::before {
    background: #956019;
  }

  .legend .operator::before {
    background: #75558a;
  }

  .legend .value::before {
    background: #5d6871;
  }

  .canvas-error,
  .load-failure {
    border-left: 3px solid var(--warn);
    padding-block: 0.6rem;
    padding-left: 0.75rem;
  }

  .canvas-error {
    margin: 0.75rem 1rem 0;
  }

  .view-status {
    margin: 0;
    padding-block: 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .path-panel,
  .html-graph {
    padding-block: 1rem;
  }

  .path-panel {
    border-bottom: 1px solid var(--border);
    border-left: 2px solid var(--warn);
  }

  .path-panel p {
    margin-bottom: 0.5rem;
  }

  .path-panel ol {
    margin: 0;
    padding-left: 1.6rem;
  }

  .path-panel li + li {
    margin-top: 0.35rem;
  }

  .path-panel li::marker {
    color: var(--warn);
    font-family: var(--font-code);
    font-weight: 700;
  }

  .path-status {
    margin: 0;
    padding-block: 0.7rem;
    border-bottom: 1px solid var(--border);
  }

  .panel-heading {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .relations {
    margin-top: 0.75rem;
  }

  .relations li {
    display: grid;
    grid-template-columns: minmax(7rem, 0.45fr) minmax(0, 1fr) auto;
    gap: 0.55rem;
    align-items: center;
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    padding-block: 0.55rem;
  }

  .relations button,
  .node-index button,
  .path-panel li button {
    border-color: transparent;
    padding: 0.2rem 0.3rem;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .relation {
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.74rem;
  }

  details {
    margin-top: 1rem;
    border-top: 1px solid var(--border);
    padding-top: 0.7rem;
  }

  summary {
    color: var(--action);
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 650;
  }

  .node-index {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.35rem 0.75rem;
    margin-top: 0.65rem;
  }

  .node-index li {
    display: flex;
    min-width: 0;
    justify-content: space-between;
    gap: 0.4rem;
    align-items: baseline;
  }

  .node-index button[aria-current='true'] {
    border-color: var(--action);
    font-weight: 700;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 34rem) {
    header,
    .selection-card {
      display: block;
    }

    .counts,
    .location {
      margin-top: 0.5rem;
      text-align: left;
      white-space: normal;
    }

    .search-row {
      grid-template-columns: 1fr 1fr;
    }

    .search-row input {
      grid-column: 1 / -1;
    }

    .canvas {
      height: 24rem;
    }

    .relations li {
      grid-template-columns: 1fr auto;
    }

    .relation {
      grid-column: 1 / -1;
    }
  }
</style>
