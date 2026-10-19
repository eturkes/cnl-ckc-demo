<script lang="ts">
  // PROTOTYPE: one statement's annotations, in the facts or inline premise.
  import type { Snippet } from 'svelte';

  import {
    gradeLabel,
    gradeValue,
    segments,
    timingText,
    words,
    type PointMarks,
  } from './annotations.js';

  interface Props {
    text: string;
    marks: PointMarks | undefined;
    inline: boolean;
    /** The graded variant shows the grade in its group heading instead. */
    showGrade: boolean;
    /** Citations, rendered after the statement and before any facts row. */
    children?: Snippet;
  }

  let { text, marks, inline, showGrade, children }: Props = $props();

  const parts = $derived(inline ? segments(text, marks) : [{ text }]);
  const grades = $derived(showGrade ? (marks?.grades ?? []) : []);
  const qualifiers = $derived(marks?.qualifiers ?? []);
  const timing = $derived((marks?.timing ?? []).map(timingText));
  const pending = $derived(marks === undefined);
</script>

<span class="statement">
  {#each parts as part, index (index)}
    {#if part.mark === undefined}{part.text}{:else}<mark data-kind={part.mark}
        >{part.text}<span class="kind">{words(part.mark)}</span></mark
      >{/if}
  {/each}
</span>
{#if inline && grades.length > 0}
  <span class="grade-tag"
    >{grades.map((grade) => `${grade.dimension} ${gradeValue(grade)}`).join(', ')}</span
  >
{/if}
{@render children?.()}

{#if !inline && !pending && (grades.length > 0 || qualifiers.length > 0 || timing.length > 0)}
  <dl class="facts">
    {#each grades as grade (grade.dimension)}
      <div>
        <dt>{grade.dimension}</dt>
        <dd>{gradeValue(grade)} <span class="source-label">({gradeLabel(grade)})</span></dd>
      </div>
    {/each}
    {#each qualifiers as qualifier (qualifier.kind + qualifier.word)}
      <div>
        <dt>{qualifier.kind}</dt>
        <dd>{qualifier.word}</dd>
      </div>
    {/each}
    {#if timing.length > 0}
      <div>
        <dt>time</dt>
        <dd>{timing.join('; ')}</dd>
      </div>
    {/if}
  </dl>
{/if}

<style>
  mark {
    border-bottom: 2px solid var(--action);
    padding: 0 0.05em;
    background: transparent;
    color: inherit;
  }

  .kind {
    margin-left: 0.2em;
    color: var(--text-muted);
    font-size: 0.66rem;
    font-style: italic;
    vertical-align: 0.3em;
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

  dt {
    color: var(--text-muted);
    font-weight: 700;
  }

  dt::first-letter {
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .source-label {
    color: var(--text-muted);
  }

  .grade-tag {
    margin-left: 0.4rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    padding: 0.05rem 0.35rem;
    color: var(--text-muted);
    font-size: 0.7rem;
    white-space: nowrap;
  }
</style>
