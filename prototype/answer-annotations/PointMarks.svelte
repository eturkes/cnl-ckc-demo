<script lang="ts">
  // PROTOTYPE: one statement plus the facts row its annotation goals returned (r1: variant A;
  // r2: qualifier first under one label, grade once per document run).
  import type { Snippet } from 'svelte';

  import { gradeText, preferenceText, timingText, type PointMarks } from './annotations.js';

  interface Props {
    text: string;
    marks: PointMarks | undefined;
    /** False while the previous statement shares this one's grade (r2: once per document run). */
    showGrade: boolean;
    /** Citations, rendered after the statement and before the facts row. */
    children?: Snippet;
  }

  let { text, marks, showGrade, children }: Props = $props();

  const grade = $derived(showGrade ? gradeText(marks?.grades ?? []) : '');
  const qualifiers = $derived([...new Set((marks?.qualifiers ?? []).map(({ word }) => word))]);
  const preferences = $derived((marks?.preferences ?? []).map(preferenceText));
  const timing = $derived((marks?.timing ?? []).map(timingText));
  const any = $derived(
    grade !== '' || qualifiers.length > 0 || preferences.length > 0 || timing.length > 0,
  );
</script>

{text}
{@render children?.()}

{#if any}
  <dl class="facts">
    {#if qualifiers.length > 0}
      <div>
        <dt>Qualifier</dt>
        <dd>{qualifiers.join(', ')}</dd>
      </div>
    {/if}
    {#if grade !== ''}
      <div>
        <dt>Grade</dt>
        <dd>{grade}</dd>
      </div>
    {/if}
    {#if preferences.length > 0}
      <div>
        <dt>Preferred</dt>
        <dd>{preferences.join('; ')}</dd>
      </div>
    {/if}
    {#if timing.length > 0}
      <div>
        <dt>Time</dt>
        <dd>{timing.join('; ')}</dd>
      </div>
    {/if}
  </dl>
{/if}

<style>
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

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
