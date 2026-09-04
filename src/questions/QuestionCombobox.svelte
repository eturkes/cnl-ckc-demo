<script lang="ts">
  // Select-only APG combobox over the clinician-facing catalog. Contract =
  // `.agent/contracts/m1u5.md`; predicate ids appear on the rules they encode.
  //
  // Host is a `div`, not a readonly `<input>` (D1): an input announces "read only
  // edit" for a widget that accepts no text and raises a mobile keyboard. The
  // text-field look is CSS, so the later free-text intake swaps the host alone.

  import { QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from './catalog.js';

  interface Props {
    /** Controlled: the widget never stores a selection of its own. */
    selected: QuestionId | null;
    onSelect: (id: QuestionId) => void;
  }

  let { selected, onSelect }: Props = $props();

  const PROMPT = 'Choose a question';
  const LABEL = 'Clinical question';
  const LAST = QUESTION_IDS.length - 1;
  const LABELS = QUESTION_IDS.map((id) => QUESTION_CATALOG[id].question);
  // APG's own buffer window; a repeated single character cycles matches (D3).
  const TYPEAHEAD_MS = 500;

  const uid = $props.id();
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;
  const optionId = (index: number): string => `${uid}-option-${QUESTION_IDS[index]}`;

  let open = $state(false);
  let activeIndex = $state(0);
  let box: HTMLElement;
  let root: HTMLElement;
  // Not reactive: the typeahead buffer never renders.
  let buffer = '';
  let bufferTimer: ReturnType<typeof setTimeout> | undefined;

  const anchor = $derived(selected === null ? 0 : QUESTION_IDS.indexOf(selected));

  // B1: every active-option change scrolls that option into view. An effect keyed
  // on both signals fires exactly once per open and once per move.
  $effect(() => {
    if (!open) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
  });

  const clearBuffer = (): void => {
    if (bufferTimer !== undefined) clearTimeout(bufferTimer);
    bufferTimer = undefined;
    buffer = '';
  };

  const show = (): void => {
    activeIndex = anchor;
    open = true;
  };

  /** Cancel path: no `onSelect`, and the active option returns to the selection. */
  const hide = (): void => {
    open = false;
    activeIndex = anchor;
    clearBuffer();
  };

  const commit = (index: number): void => {
    const id = QUESTION_IDS[index];
    if (id !== undefined) onSelect(id);
    hide();
  };

  /** First label matching `prefix`, scanning from `from` and wrapping. */
  const scan = (prefix: string, from: number): number => {
    const order = [...LABELS.slice(from), ...LABELS.slice(0, from)];
    const match = order.find((label) => label.toLowerCase().startsWith(prefix));
    return match === undefined ? -1 : LABELS.indexOf(match);
  };

  // K5 diverges from APG's example here: a fresh prefix names the FIRST matching
  // question, so it scans from option 1. APG scans from after the active option,
  // which lands the same keystroke on a different question per selection.
  const search = (prefix: string, after: number): number => {
    const first = scan(prefix, 0);
    if (first >= 0) return first;
    const head = prefix[0] ?? '';
    // Only a repeated single character cycles, walking on from the active option.
    return [...prefix].every((char) => char === head) ? scan(head, after) : -1;
  };

  const type = (char: string): void => {
    if (bufferTimer !== undefined) clearTimeout(bufferTimer);
    buffer += char.toLowerCase();
    bufferTimer = setTimeout(clearBuffer, TYPEAHEAD_MS);
    const found = search(buffer, activeIndex + 1);
    if (found >= 0) activeIndex = found;
    else clearBuffer();
  };

  const printable = (key: string): boolean => key.length === 1 && key !== ' ';

  const onKeyDown = (event: KeyboardEvent): void => {
    const { key, altKey, ctrlKey, metaKey } = event;
    if (ctrlKey || metaKey) return;
    if (!open) {
      if (key === 'ArrowUp' && altKey) return; // K2: no-op while closed
      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        show();
      } else if (key === 'ArrowUp' || key === 'Home' || key === 'End') {
        // K2 + K4: these three open at a fixed end, not at the selection.
        event.preventDefault();
        show();
        activeIndex = key === 'End' ? LAST : 0;
      } else if (printable(key)) {
        event.preventDefault();
        show();
        type(key);
      }
      return;
    }
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, LAST);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (altKey)
          commit(activeIndex); // K11
        else activeIndex = Math.max(activeIndex - 1, 0);
        return;
      case 'Home':
        event.preventDefault();
        activeIndex = 0;
        return;
      case 'End':
        event.preventDefault();
        activeIndex = LAST;
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeIndex);
        return;
      case 'Escape':
        event.preventDefault();
        hide();
        return;
      // K10: Tab commits and lets the browser move focus onward.
      case 'Tab':
        commit(activeIndex);
        return;
      default:
        if (printable(key)) {
          event.preventDefault();
          type(key);
        }
    }
  };

  // P3: a pointer press outside cancels, matching a native select. APG's example
  // commits on blur instead, which would let an idle click start a run in u6.
  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && root.contains(next)) return;
    if (open) hide();
  };

  // Delegated from the listbox: per-option handlers would each need their own
  // keyboard handler to satisfy the compiler, and this widget's keyboard path
  // deliberately lives on the combobox alone.
  const onListClick = (event: MouseEvent): void => {
    const { currentTarget, target } = event;
    if (!(currentTarget instanceof HTMLElement) || !(target instanceof Element)) return;
    const option = target.closest('[role="option"]');
    if (option === null) return;
    const index = [...currentTarget.children].indexOf(option);
    if (index < 0) return;
    commit(index);
    box.focus();
  };
</script>

<div class="intake" bind:this={root} onfocusout={onFocusOut}>
  <span class="label" id={labelId}>{LABEL}</span>
  <div class="control">
    <div
      class="box"
      bind:this={box}
      role="combobox"
      tabindex="0"
      aria-labelledby={labelId}
      aria-controls={listId}
      aria-expanded={open}
      aria-activedescendant={open ? optionId(activeIndex) : undefined}
      class:prompt={selected === null}
      onkeydown={onKeyDown}
      onclick={() => (open ? hide() : show())}
    >
      {selected === null ? PROMPT : QUESTION_CATALOG[selected].question}
    </div>
    <span class="caret" aria-hidden="true">▾</span>
    <!-- Keeping DOM focus on the combobox is what makes aria-activedescendant work,
         so the press that would move it is cancelled before it lands. That same
         rule puts the widget's whole keyboard path on the combobox, which the
         compiler cannot see from here. -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <ul
      class="list"
      id={listId}
      role="listbox"
      aria-labelledby={labelId}
      hidden={!open}
      onmousedown={(event) => event.preventDefault()}
      onclick={onListClick}
    >
      {#each QUESTION_IDS as id, index (id)}
        <li
          id={optionId(index)}
          role="option"
          aria-selected={id === selected}
          class:active={open && index === activeIndex}
        >
          {QUESTION_CATALOG[id].question}
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .intake {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .label {
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 650;
  }

  .control {
    position: relative;
  }

  /* Text-field affordance: the widget accepts no text today, and free-text intake
     replaces this host without touching the rest. */
  .box {
    box-sizing: border-box;
    width: 100%;
    min-height: 3rem;
    padding: 0.72rem 2.6rem 0.72rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: var(--surface-raised);
    font-size: 0.95rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .box:focus-visible {
    outline: 2px solid var(--action);
    outline-offset: 1px;
  }

  .box.prompt {
    color: var(--text-muted);
  }

  .caret {
    position: absolute;
    top: 0.78rem;
    right: 0.9rem;
    color: var(--text-muted);
    pointer-events: none;
  }

  .list {
    position: absolute;
    z-index: 1;
    inset-inline: 0;
    top: calc(100% + 0.35rem);
    max-height: 18rem;
    overflow-y: auto;
    margin: 0;
    padding: 0.35rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: var(--surface-raised);
    box-shadow: 0 0.8rem 2rem color-mix(in srgb, var(--text) 12%, transparent);
    list-style: none;
  }

  .list li {
    padding: 0.65rem 0.7rem;
    border-radius: 0.1rem;
    font-size: 0.9rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .list li.active {
    background: var(--action);
    color: var(--action-text);
  }

  .list li[aria-selected='true']::after {
    content: ' ✓';
  }
</style>
