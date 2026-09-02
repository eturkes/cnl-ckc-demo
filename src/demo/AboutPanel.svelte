<script lang="ts">
  // What this demo is, and what it is not.
  //
  // A `<details>` carries it: the user asked for a disclosure rather than a
  // permanent block. CDC's reuse terms require the nonendorsement disclaimer to
  // be prominently displayed, which a closed disclosure is not, so attribution
  // and nonendorsement stay in the always-visible footer and this panel carries
  // the rest.

  import { DESCRIPTIONS, FONT_LICENCES, INSTRUCTIONS } from './copy.js';

  interface Props {
    /** Read from the booted engine; absent until it answers, and never a literal. */
    documents: number | undefined;
  }

  let { documents }: Props = $props();

  const corpus = $derived(
    documents === undefined
      ? undefined
      : DESCRIPTIONS.corpusSize.replace('{documents}', String(documents)),
  );
</script>

<details class="about">
  <summary>{DESCRIPTIONS.aboutSummary}</summary>

  <p class="warn">{INSTRUCTIONS.notClinical}</p>
  <p>{DESCRIPTIONS.purpose}</p>
  <p>{DESCRIPTIONS.fixedCatalog}</p>
  <p>{DESCRIPTIONS.projection}</p>
  {#if corpus}
    <p>{corpus}</p>
  {/if}
  <p>{DESCRIPTIONS.unreviewed}</p>

  <h3>{DESCRIPTIONS.licenceSummary}</h3>
  <p>{DESCRIPTIONS.fonts}</p>
  <ul>
    {#each FONT_LICENCES as licence (licence.href)}
      <li><a href={licence.href}>{licence.family}</a></li>
    {/each}
  </ul>
</details>

<style>
  .about {
    margin-top: 2rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    background: var(--surface-sunken);
    padding: 0 0.9rem;
  }

  summary {
    margin: 0 -0.9rem;
    padding: 0.7rem 0.9rem;
    font-family: var(--font-ui);
    font-weight: 600;
    color: var(--action);
    cursor: pointer;
  }

  summary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  p {
    margin: 0 0 0.75rem;
    font-family: var(--font-prose);
    font-size: 0.95rem;
  }

  /* The one line a reader must not miss, so it carries weight and a rule rather
     than colour alone. */
  .warn {
    border-left: 3px solid var(--warn);
    padding-left: 0.6rem;
    font-weight: 600;
    color: var(--warn);
  }

  h3 {
    margin: 1.25rem 0 0.5rem;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  ul {
    margin: 0 0 1rem;
    padding-left: 1.1rem;
    font-size: 0.9rem;
  }

  a {
    color: var(--action);
  }
</style>
