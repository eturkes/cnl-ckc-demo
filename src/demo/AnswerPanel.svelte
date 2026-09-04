<script lang="ts">
  // The settled answer.
  //
  // One-of-N is the APG Radio Group pattern, and native radios inside a
  // `fieldset` supply the group relationship, the checked state, the single tab
  // stop and the arrow keys without a line of script. Every cell starts with a
  // value the engine produced; the descriptor layer only makes it readable.

  import { DESCRIPTIONS } from './copy.js';
  import type { AnswerRow } from './describe.js';
  import ProvenanceLadder from '../provenance/ProvenanceLadder.svelte';
  import type { GraphFocus, ProvenanceState } from '../provenance/model.js';

  interface Props {
    rows: AnswerRow[];
    selectedIndex: number;
    busy: boolean;
    /** Terminal wording for the current state; the only content when there are no rows. */
    summary: string;
    /** Canonical serialized answer, engine-authored. Empty before the first run settles. */
    serialized: string;
    onSelect: (index: number) => void;
    provenance?: ProvenanceState;
    onGraphFocus?: (focus: GraphFocus) => void;
  }

  let {
    rows,
    selectedIndex,
    busy,
    summary,
    serialized,
    onSelect,
    provenance = { kind: 'idle' },
    onGraphFocus = () => undefined,
  }: Props = $props();

  const uid = $props.id();
  const headingId = `${uid}-heading`;
  const group = `${uid}-answers`;
  // Derived here because ESLint types a `.svelte` import as `any`, which makes a
  // member access on a narrowed value inside the template read as unsafe.
  const selectedRow = $derived(rows[selectedIndex]);
</script>

<section aria-labelledby={headingId} aria-busy={busy}>
  <h2 id={headingId}>Result</h2>
  {#if summary !== ''}
    <p class="summary">{summary}</p>
  {/if}

  {#if rows.length > 1}
    <fieldset>
      <legend>Select a passage to inspect its source</legend>
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

  {#if selectedRow !== undefined && rows.length === 1}
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

  {#if provenance.kind !== 'idle'}
    <ProvenanceLadder state={provenance} {onGraphFocus} />
  {/if}
</section>

<style>
  section {
    border-top: 1px solid var(--border);
    margin: 0;
    padding: clamp(1.25rem, 3vw, 2rem);
  }

  h2 {
    margin: 0 0 0.6rem;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .summary {
    margin: 0 0 1rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  fieldset {
    margin: 0 0 1.25rem;
    border: 0;
    padding: 0;
  }

  legend {
    margin-bottom: 0.4rem;
    padding: 0;
    font-size: 0.75rem;
    font-weight: 650;
    color: var(--text-muted);
  }

  label {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    padding: 0.65rem 0;
    font-size: 0.9rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  label input {
    margin-top: 0.25rem;
    flex: 0 0 auto;
  }

  /* Label above value while the viewport is narrow, label beside value once
     there is room for a column that does not squeeze the engine's own text. */
  dl {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.2rem 1.25rem;
    max-width: 52rem;
    margin: 0 0 1.25rem;
  }

  @media (min-width: 34rem) {
    dl {
      grid-template-columns: minmax(7rem, max-content) 1fr;
      align-items: baseline;
      row-gap: 0.65rem;
    }
  }

  dt {
    font-size: 0.72rem;
    font-weight: 650;
    color: var(--text-muted);
  }

  dd {
    margin: 0 0 0.5rem;
    font-size: 0.94rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  @media (min-width: 34rem) {
    dd {
      margin-bottom: 0;
    }
  }

  .canonical {
    max-width: 52rem;
    border-top: 1px solid var(--border);
    padding: 0;
  }

  .canonical summary {
    padding: 0.75rem 0;
    font-size: 0.8rem;
    font-weight: 650;
    color: var(--action);
    cursor: pointer;
  }

  .canonical summary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .canonical p {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
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
