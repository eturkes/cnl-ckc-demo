<script lang="ts">
  // PROTOTYPE chrome: switches the display premise in place; outside the shipped page.
  import { urlForVariant, VARIANT_NAMES, VARIANTS, type Variant } from './variant.js';

  interface Props {
    variant: Variant;
    onChange: (variant: Variant) => void;
  }

  let { variant, onChange }: Props = $props();

  const choose = (next: Variant): void => {
    history.replaceState(null, '', urlForVariant(location.href, next));
    onChange(next);
  };
</script>

<div class="variant-switch" role="group" aria-label="Prototype variant">
  <span>Prototype: answer annotations</span>
  {#each VARIANTS as option (option)}
    <button
      type="button"
      aria-pressed={option === variant}
      onclick={() => {
        choose(option);
      }}>{VARIANT_NAMES[option]}</button
    >
  {/each}
</div>

<style>
  .variant-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding: 0.45rem 1.5rem;
    background: var(--surface-sunken);
    font-size: 0.75rem;
  }

  span {
    margin-right: 0.4rem;
    color: var(--text-muted);
    font-weight: 700;
  }

  button {
    border: 1px solid var(--border);
    border-radius: 0.3rem;
    padding: 0.25rem 0.55rem;
    background: transparent;
    color: var(--action);
    font: inherit;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    border-color: var(--action);
    background: var(--surface-raised);
    font-weight: 700;
  }

  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
