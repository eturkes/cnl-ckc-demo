<script lang="ts">
  // Interface language control, deliberately shaped exactly like `ThemeToggle`:
  // same two-state button, same `aria-pressed`, same "name the state you switch to"
  // wording, same `localStorage` restore on mount. The header carries one control
  // idiom, so a second one would read as a different kind of thing.
  //
  // It owns `locale.restore()` because it is the only component mounted in every
  // state that needs the saved choice, and restoring inside `onMount` keeps
  // `localStorage` and `document` off the module's import path.

  import { onMount } from 'svelte';

  import { locale, messages } from '../i18n/locale.svelte.js';

  const t = $derived(messages.current);
  const japanese = $derived(locale.current === 'ja');

  onMount(() => {
    locale.restore();
  });
</script>

<button
  type="button"
  aria-pressed={japanese}
  aria-label={t.LABELS.languageSwitchAria}
  lang="en"
  onclick={() => {
    locale.set(japanese ? 'en' : 'ja');
  }}
>
  <span aria-hidden="true">⇄</span>
  <span>{t.LABELS.languageSwitch}</span>
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

  /* An exchange arrow, not `あ` or a script sample: a Japanese glyph in the header
     would pull a 1.3 MB face onto the English page for one character, and routing
     it to a system font instead trades that for tofu on a host with no CJK family.
     `ThemeToggle` already relies on system fallback for `☀`/`☾`. */
  [aria-hidden='true'] {
    font-size: 0.9rem;
    line-height: 1;
  }
</style>
