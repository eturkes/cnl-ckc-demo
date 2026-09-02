<script lang="ts">
  // The settled answer.
  //
  // One-of-N is the APG Radio Group pattern, and native radios inside a
  // `fieldset` supply the group relationship, the checked state, the single tab
  // stop and the arrow keys without a line of script. Every cell renders text the
  // engine itself produced, so nothing here reconstructs Prolog syntax.

  import { DESCRIPTIONS } from './copy.js';
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

  <!-- The engine's own text, kept behind a disclosure: it is the evidence that
       the answer came from a proof, not the answer a reader came to read. -->
  {#if serialized !== ''}
    <details class="canonical">
      <summary>{DESCRIPTIONS.prologSummary}</summary>
      <p>{DESCRIPTIONS.prolog}</p>
      <code>{serialized}</code>
    </details>
  {/if}
</section>

<style>
  section {
    border-top: 1px solid var(--border);
    margin-top: 1.5rem;
    padding-top: 1rem;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-family: var(--font-ui);
    font-size: 1rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .summary {
    margin: 0 0 0.75rem;
    font-family: var(--font-prose);
    font-size: 1.05rem;
  }

  fieldset {
    margin: 0 0 1rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    padding: 0.5rem 0.75rem 0.75rem;
  }

  legend {
    padding: 0 0.35rem;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    color: var(--text-muted);
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

  /* Label above value while the viewport is narrow, label beside value once
     there is room for a column that does not squeeze the engine's own text. */
  dl {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.15rem 1rem;
    margin: 0 0 1rem;
  }

  @media (min-width: 34rem) {
    dl {
      grid-template-columns: minmax(6rem, max-content) 1fr;
      align-items: baseline;
      row-gap: 0.5rem;
    }
  }

  dt {
    font-family: var(--font-ui);
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  dd {
    margin: 0 0 0.5rem;
    font-family: var(--font-code);
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }

  @media (min-width: 34rem) {
    dd {
      margin-bottom: 0;
    }
  }

  .canonical {
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    background: var(--surface-raised);
    padding: 0 0.75rem;
  }

  .canonical summary {
    margin: 0 -0.75rem;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-ui);
    font-size: 0.85rem;
    color: var(--action);
    cursor: pointer;
  }

  .canonical summary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .canonical p {
    margin: 0 0 0.5rem;
    font-family: var(--font-prose);
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  code {
    display: block;
    margin-bottom: 0.75rem;
    font-family: var(--font-code);
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
</style>
