<script lang="ts">
  import type { PlSolution } from '../engine/protocol.js';
  import { messages } from '../i18n/locale.svelte.js';
  import ProvenanceLadder from '../provenance/ProvenanceLadder.svelte';
  import type { GraphFocus, ProvenanceState } from '../provenance/model.js';
  import { marksView, type MarksState } from '../questions/marks.js';

  import { synthesizeAnswer, type AnswerRow } from './describe.js';

  interface Props {
    rows: AnswerRow[];
    selectedIndex: number;
    busy: boolean;
    /** Stable key for the prepared question currently being answered. */
    question: string;
    /** Terminal wording for states that do not have a complete answer. */
    summary: string;
    /** Canonical serialized answer, engine-authored. Empty before the first run settles. */
    serialized: string;
    onSelect: (index: number) => void;
    provenance?: ProvenanceState;
    onGraphFocus?: (focus: GraphFocus) => void;
    /** The answer's solutions in `rows` order: the marks join keys on each one's `Source`. */
    solutions?: readonly PlSolution[];
    /** The knowledge base's marks on this answer (`DemoController.marks`). */
    marks?: MarksState;
  }

  let {
    rows,
    selectedIndex,
    busy,
    question,
    summary,
    serialized,
    onSelect,
    provenance = { kind: 'idle' },
    onGraphFocus = () => undefined,
    solutions = [],
    marks = { kind: 'idle' },
  }: Props = $props();

  const uid = $props.id();
  const headingId = `${uid}-heading`;
  const sourceHeadingId = `${uid}-source-heading`;
  const t = $derived(messages.current);
  const points = $derived(synthesizeAnswer(rows));
  const resolvedIndex = $derived(
    selectedIndex >= 0 && selectedIndex < rows.length ? selectedIndex : 0,
  );
  const selectedRow = $derived(rows[resolvedIndex]);
  let explanation = $state<HTMLDetailsElement>();

  const view = $derived(marksView(marks, points, rows, solutions));
  /** Each statement's facts row, in the ruled order; an empty list renders no row. */
  const facts = $derived(
    view.statements.map((statement) =>
      statement === undefined
        ? []
        : [
            { label: t.LABELS.marksQualifier, value: statement.qualifier },
            { label: t.LABELS.marksGrade, value: statement.grade },
            { label: t.LABELS.marksPreferred, value: statement.preferences.join('; ') },
            { label: t.LABELS.marksTime, value: statement.times.join('; ') },
          ].filter(({ value }) => value !== ''),
    ),
  );
  /** The marks goal and what the engine returned, once it settles. */
  const goal = $derived.by(() => {
    if (marks.kind !== 'settled') return undefined;
    const { outcome } = marks;
    const returned =
      outcome.kind === 'solutions' || outcome.kind === 'limit' || outcome.kind === 'cancelled'
        ? outcome.solutions
        : [];
    let status = '';
    if (outcome.kind === 'failure') status = t.TEXT.chatCardFailure();
    else if (outcome.kind === 'limit')
      status = t.TEXT.chatCardLimit(outcome.limit, outcome.solutions.length);
    else if (outcome.kind === 'cancelled') status = t.TEXT.chatCardCancelled();
    else if (outcome.kind === 'error') status = t.TEXT.chatCardError(outcome.error.code);
    else if (outcome.kind === 'rejected') status = t.TEXT.chatCardError(outcome.reason);
    return {
      text: marks.goal,
      displays: returned.map((solution) => solution.display['Marks'] ?? ''),
      status,
    };
  });

  const inspect = (source: number): void => {
    if (explanation !== undefined) explanation.open = true;
    onSelect(source);
  };
</script>

<section class="answer-region" aria-labelledby={headingId} aria-busy={busy}>
  <h2 id={headingId}>{t.LABELS.answerHeading}</h2>

  {#if question === ''}
    {#if summary !== ''}
      <p class="empty-answer">{summary}</p>
    {/if}
  {:else}
    {#key question}
      <div class="thread">
        <article class="turn assistant-turn" aria-label={t.LABELS.answerTurn}>
          <header class="assistant-header">
            <div>
              <p class="turn-name">{t.LABELS.answerAuthor}</p>
              <p class="answer-mode">{t.LABELS.answerMode}</p>
            </div>
          </header>

          <div class="assistant-copy">
            {#if busy}
              <p class="working">{t.DESCRIPTIONS.workingAnswer}</p>
              <!-- Answers stream in as the engine proves them; sources open once the run settles. -->
              {#if points.length === 1}
                {#each points as point (point.text)}
                  <p class="answer-point">{point.text}</p>
                {/each}
              {:else if points.length > 1}
                <ul class="answer-list">
                  {#each points as point (point.text)}
                    <li class="answer-point">{point.text}</li>
                  {/each}
                </ul>
              {/if}
            {:else}
              {#if summary !== ''}
                <p class="summary">{summary}</p>
              {/if}

              {#snippet citations(sources: readonly number[])}
                <span class="citations">
                  {#each sources as source (source)}
                    <button
                      type="button"
                      aria-label={t.TEXT.inspectSource(source + 1)}
                      onclick={() => inspect(source)}>{source + 1}</button
                    >
                  {/each}
                </span>
              {/snippet}

              {#snippet factsRow(pairs: readonly { label: string; value: string }[])}
                {#if pairs.length > 0}
                  <dl class="facts">
                    {#each pairs as pair (pair.label)}
                      <div>
                        <dt>{pair.label}</dt>
                        <dd>{pair.value}</dd>
                      </div>
                    {/each}
                  </dl>
                {/if}
              {/snippet}

              <!-- A div, not a p: the facts row is a dl, which a p cannot hold. -->
              {#if points.length === 1}
                {#each points as point, index (point.text)}
                  <div class="answer-point">
                    {point.text}
                    {@render citations(point.sources)}
                    {@render factsRow(facts[index] ?? [])}
                  </div>
                {/each}
              {:else if points.length > 1}
                <ul class="answer-list">
                  {#each points as point, index (point.text)}
                    <li class="answer-point">
                      {point.text}
                      {@render citations(point.sources)}
                      {@render factsRow(facts[index] ?? [])}
                    </li>
                  {/each}
                </ul>
              {/if}

              {#if view.notice}
                <p class="marks-missing">{t.TEXT.marksMissing(view.missing, view.total)}</p>
              {/if}

              {#if goal !== undefined}
                <details class="mark-goals">
                  <summary>{t.LABELS.marksGoals}</summary>
                  <p class="mark-goals-note">{t.DESCRIPTIONS.chatCardNote}</p>
                  <code class="mark-goal">{goal.text}</code>
                  {#if goal.displays.length > 0}
                    <ol>
                      {#each goal.displays as display, index (index)}
                        <li><code>{display}</code></li>
                      {/each}
                    </ol>
                  {/if}
                  {#if goal.status !== ''}
                    <p class="mark-goals-status">{goal.status}</p>
                  {/if}
                </details>
              {/if}
            {/if}

            {#if !busy && (rows.length > 0 || serialized !== '')}
              <details class="explanation" bind:this={explanation}>
                <summary>
                  <span
                    >{rows.length > 0
                      ? t.LABELS.explanationSummary
                      : t.LABELS.technicalSummary}</span
                  >
                  {#if rows.length > 0}
                    <span class="source-count">{t.TEXT.sourceCount(rows.length)}</span>
                  {/if}
                </summary>

                <div class="explanation-body">
                  {#if rows.length > 0}
                    <p class="render-note">{t.DESCRIPTIONS.answerAssembly}</p>
                    <p class="render-note">{t.DESCRIPTIONS.clauseRendering}</p>

                    {#if rows.length > 1}
                      <div class="source-picker" role="group" aria-label={t.LABELS.sourcePicker}>
                        {#each rows as row, index (index)}
                          <button
                            type="button"
                            aria-pressed={index === resolvedIndex}
                            aria-label={t.TEXT.inspectSourceDocument(index + 1, row.document)}
                            onclick={() => onSelect(index)}
                            >{t.TEXT.sourceOrdinal(index + 1)}</button
                          >
                        {/each}
                      </div>
                    {/if}

                    {#if selectedRow !== undefined}
                      <section class="source-card" aria-labelledby={sourceHeadingId}>
                        <div class="source-heading">
                          <div>
                            <p class="source-eyebrow">{t.LABELS.selectedEvidence}</p>
                            <h3 id={sourceHeadingId}>{t.TEXT.sourceOrdinal(resolvedIndex + 1)}</h3>
                          </div>
                          {#if selectedRow.document !== undefined}
                            <code class="document-id">{selectedRow.document}</code>
                          {/if}
                        </div>
                        {#if selectedRow.sourcePassage !== undefined}
                          <p>{t.DESCRIPTIONS.sourcePassage}</p>
                          <blockquote>{selectedRow.sourcePassage}</blockquote>
                        {:else}
                          <p>{t.DESCRIPTIONS.sourceUnavailable}</p>
                        {/if}
                      </section>
                    {/if}
                  {/if}

                  {#if serialized !== ''}
                    <details class="canonical">
                      <summary>{t.DESCRIPTIONS.prologSummary}</summary>
                      <p>{t.DESCRIPTIONS.prolog}</p>
                      <code>{serialized}</code>
                    </details>
                  {/if}

                  {#if provenance.kind !== 'idle'}
                    <ProvenanceLadder state={provenance} {onGraphFocus} />
                  {/if}
                </div>
              </details>
            {/if}
          </div>
        </article>
      </div>
    {/key}
  {/if}
</section>

<style>
  .answer-region {
    border-top: 1px solid var(--border);
    margin: 0;
    padding: clamp(1.25rem, 3vw, 2rem);
  }

  .answer-region > h2 {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .empty-answer {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .thread {
    max-width: 58rem;
  }

  .turn {
    min-width: 0;
  }

  .turn-name {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .assistant-header {
    margin-bottom: 0.8rem;
  }

  .answer-mode {
    margin: 0.05rem 0 0;
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.66rem;
  }

  .assistant-copy {
    min-width: 0;
  }

  .working,
  .summary {
    margin: 0 0 1rem;
    color: var(--text-muted);
    font-size: 0.92rem;
  }

  .working {
    font-style: italic;
  }

  .answer-list {
    display: grid;
    gap: 0.72rem;
    margin: 0;
    padding-left: 1.2rem;
  }

  .answer-point {
    max-width: 52rem;
    margin: 0;
    font-size: 0.98rem;
    line-height: 1.58;
    overflow-wrap: anywhere;
  }

  .answer-list .answer-point::marker {
    color: var(--action);
  }

  .citations {
    display: inline-flex;
    gap: 0.18rem;
    margin-left: 0.3rem;
    vertical-align: 0.12em;
  }

  .citations button {
    display: inline-grid;
    place-items: center;
    min-width: 1.35rem;
    height: 1.35rem;
    border: 1px solid var(--border);
    border-radius: 0.28rem;
    padding: 0 0.25rem;
    background: transparent;
    color: var(--action);
    font-family: var(--font-code);
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
  }

  .citations button:hover {
    background: var(--surface-sunken);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1.1rem;
    margin: 0.35rem 0 0;
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .facts div {
    display: flex;
    gap: 0.35rem;
    min-width: 0;
  }

  /* The label keeps its width; only the value wraps, or a narrow screen splits `Grade`. */
  .facts dt {
    flex: none;
    color: var(--text-muted);
    font-weight: 700;
  }

  .facts dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .marks-missing {
    max-width: 52rem;
    margin: 0.75rem 0 0;
    color: var(--warn);
    font-size: 0.8rem;
  }

  .mark-goals {
    max-width: 52rem;
    margin-top: 1rem;
    font-size: 0.75rem;
  }

  .mark-goals summary {
    color: var(--action);
    font-weight: 650;
    cursor: pointer;
  }

  .mark-goals-note,
  .mark-goals-status {
    margin: 0.5rem 0 0;
    color: var(--text-muted);
  }

  .mark-goals ol {
    display: grid;
    gap: 0.5rem;
    margin: 0.5rem 0 0;
    padding-left: 1.2rem;
  }

  .mark-goals code {
    display: block;
    font-family: var(--font-code);
    font-size: 0.68rem;
    overflow-wrap: anywhere;
  }

  .mark-goal {
    margin-top: 0.5rem;
  }

  .explanation {
    max-width: 52rem;
    margin-top: 1.35rem;
    border-top: 1px solid var(--border);
  }

  .explanation > summary {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 0;
    color: var(--action);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }

  .source-count {
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.66rem;
    font-weight: 500;
  }

  .explanation-body {
    padding-bottom: 0.25rem;
  }

  .render-note {
    max-width: 48rem;
    margin: 0 0 0.45rem;
    color: var(--text-muted);
    font-size: 0.78rem;
    line-height: 1.48;
  }

  .source-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 1rem 0;
  }

  .source-picker button {
    border: 1px solid var(--border);
    border-radius: 0.3rem;
    padding: 0.36rem 0.62rem;
    background: transparent;
    color: var(--action);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .source-picker button[aria-pressed='true'] {
    border-color: var(--action);
    background: var(--surface-sunken);
    font-weight: 700;
  }

  .source-card {
    margin: 0 0 0.75rem;
    border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
    padding: 0.85rem 1rem;
    background: color-mix(in srgb, var(--surface-sunken) 55%, transparent);
  }

  .source-heading {
    display: flex;
    gap: 1rem;
    align-items: start;
    justify-content: space-between;
    margin-bottom: 0.65rem;
  }

  .source-eyebrow {
    margin: 0 0 0.1rem;
    color: var(--text-muted);
    font-family: var(--font-code);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .source-card h3 {
    margin: 0;
    font-size: 0.92rem;
  }

  .source-card > p {
    margin: 0 0 0.55rem;
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  .document-id {
    color: var(--text-muted);
    font-size: 0.68rem;
    overflow-wrap: anywhere;
  }

  .source-card blockquote {
    margin: 0;
    border-left: 2px solid var(--action);
    padding-left: 0.85rem;
    font-family: var(--font-prose);
    font-size: 0.87rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .canonical {
    border-top: 1px solid var(--border);
    padding: 0;
  }

  .canonical summary {
    padding: 0.75rem 0;
    color: var(--action);
    font-size: 0.8rem;
    font-weight: 650;
    cursor: pointer;
  }

  .canonical p {
    margin: 0 0 0.5rem;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .canonical code {
    display: block;
    margin-bottom: 0.75rem;
    font-family: var(--font-code);
    font-size: 0.82rem;
    overflow-wrap: anywhere;
  }

  button:focus-visible,
  summary:focus-visible {
    border-radius: 0.15rem;
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 34rem) {
    .source-heading {
      display: block;
    }

    .document-id {
      display: block;
      margin-top: 0.35rem;
    }
  }
</style>
