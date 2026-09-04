<script lang="ts">
  // What this demo is, and what it is not.
  //
  // A `<details>` carries it: the user asked for a disclosure rather than a
  // permanent block. CDC's reuse terms require the nonendorsement disclaimer to
  // be prominently displayed, which a closed disclosure is not, so attribution
  // and nonendorsement stay in the always-visible footer and this panel carries
  // the rest.

  import { DESCRIPTIONS, FONT_LICENCES, GUIDELINE, INSTRUCTIONS } from './copy.js';

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
  <p>
    <strong>Guideline:</strong>
    <a href={GUIDELINE.html} target="_blank" rel="noreferrer">{GUIDELINE.title}</a>
  </p>
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
    margin-top: 3rem;
    border-block: 1px solid var(--border);
    padding: 0;
  }

  summary {
    padding: 1rem 0;
    font-size: 0.82rem;
    font-weight: 650;
    color: var(--text);
    cursor: pointer;
  }

  summary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  p {
    max-width: 52rem;
    margin: 0 0 0.8rem;
    font-size: 0.86rem;
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
    font-size: 0.78rem;
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
