<script lang="ts">
  import { onMount } from 'svelte';

  let dark = $state(false);

  const apply = (next: boolean, remember: boolean): void => {
    dark = next;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    if (remember) localStorage.setItem('cnl-ckc-theme', next ? 'dark' : 'light');
  };

  onMount(() => {
    const saved = localStorage.getItem('cnl-ckc-theme');
    apply(
      saved === null
        ? (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
        : saved === 'dark',
      false,
    );
  });
</script>

<button
  type="button"
  aria-pressed={dark}
  aria-label={dark ? 'Use the light theme' : 'Use the dark theme'}
  onclick={() => {
    apply(!dark, true);
  }}
>
  <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
  <span>{dark ? 'Light' : 'Dark'}</span>
</button>

<style>
  button {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
    min-height: 2rem;
    border: 0;
    border-radius: 0.2rem;
    padding: 0.3rem 0.45rem;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-ui);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-sunken);
    color: var(--action);
  }

  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  [aria-hidden='true'] {
    font-size: 0.9rem;
    line-height: 1;
  }
</style>
