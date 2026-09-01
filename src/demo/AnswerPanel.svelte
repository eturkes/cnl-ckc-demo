<script lang="ts">
  // The settled answer.
  //
  // One-of-N is the APG Radio Group pattern, and native radios inside a
  // `fieldset` supply the group relationship, the checked state, the single tab
  // stop and the arrow keys without a line of script. Every cell renders text the
  // engine itself produced, so nothing here reconstructs Prolog syntax.

  import type { AnswerRow } from './describe.js';

  interface Props {
    rows: AnswerRow[];
    selectedIndex: number;
    busy: boolean;
    /** Terminal wording for the current state; the only content when there are no rows. */
    summary: string;
    /** Canonical serialized answer, engine-authored. Empty before the first run settles. */
    serialized: string;
    onSelect: (index: number) => void;
  }

  let { rows, selectedIndex, busy, summary, serialized, onSelect }: Props = $props();

  const uid = $props.id();
  const headingId = `${uid}-heading`;
  const group = `${uid}-answers`;
  // Derived here because ESLint types a `.svelte` import as `any`, which makes a
  // member access on a narrowed value inside the template read as unsafe.
  const selectedRow = $derived(rows[selectedIndex]);
</script>

<section aria-labelledby={headingId} aria-busy={busy}>
  <h2 id={headingId}>Answer</h2>
  {#if summary !== ''}
    <p class="summary">{summary}</p>
  {/if}

  {#if rows.length > 1}
    <fieldset>
      <legend>Choose an answer</legend>
      {#each rows as row, index (index)}
        <label>
          <input
            type="radio"
            name={group}
            checked={index === selectedIndex}
            onchange={() => {
              onSelect(index);
            }}
          />
          <span>{row.label}</span>
        </label>
      {/each}
    </fieldset>
  {/if}

  {#if selectedRow !== undefined}
    <dl>
      {#each selectedRow.cells as cell (cell.variable)}
        <dt>{cell.descriptor}</dt>
        <dd>{cell.text}</dd>
      {/each}
    </dl>
  {/if}

  {#if serialized !== ''}
    <p class="canonical">
      Canonical Prolog answer: <code>{serialized}</code>
    </p>
  {/if}
</section>

<style>
  section {
    border-top: 1px solid var(--rule);
    margin-top: 1.5rem;
    padding-top: 1rem;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-family: var(--font-ui);
    font-size: 1rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .summary {
    margin: 0 0 0.75rem;
    font-family: var(--font-prose);
    font-size: 1.05rem;
  }

  fieldset {
    margin: 0 0 1rem;
    border: 1px solid var(--rule);
    border-radius: 0.25rem;
    padding: 0.5rem 0.75rem 0.75rem;
  }

  legend {
    padding: 0 0.35rem;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  label {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.15rem 0;
    font-family: var(--font-code);
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }

  dl {
    margin: 0 0 1rem;
  }

  dt {
    font-family: var(--font-ui);
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    color: var(--ink-soft);
  }

  dd {
    margin: 0 0 0.5rem;
    font-family: var(--font-code);
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }

  .canonical {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }
</style>
