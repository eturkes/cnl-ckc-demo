<script lang="ts">
  // Run controls plus the demo's only two live regions.
  //
  // Both regions are mounted here from the first render and never mirror each
  // other: ARIA22 requires a live region to pre-exist its update, and a message
  // that reaches both `status` and `alert` is announced twice.

  interface Props {
    /** Polite live-region text. Empty renders the region with no message. */
    status: string;
    /** Assertive live-region text. Empty renders the region with no message. */
    error: string;
    busy: boolean;
    canRun: boolean;
    showRetry: boolean;
    onRun: () => void;
    onCancel: () => void;
    onRetry: () => void;
  }

  let { status, error, busy, canRun, showRetry, onRun, onCancel, onRetry }: Props = $props();

  let runEl = $state<HTMLButtonElement>();
  let cancelEl = $state<HTMLButtonElement>();
  let retryEl = $state<HTMLButtonElement>();

  // Disabling a focused button drops focus to `body`, so whether Cancel held it
  // has to be read before the DOM updates and acted on after.
  let cancelHeldFocus = false;

  $effect.pre(() => {
    void busy;
    cancelHeldFocus = cancelEl !== undefined && document.activeElement === cancelEl;
  });

  $effect(() => {
    if (busy || !cancelHeldFocus) return;
    cancelHeldFocus = false;
    (showRetry ? retryEl : runEl)?.focus();
  });
</script>

<div class="controls">
  <button bind:this={runEl} type="button" disabled={!canRun} onclick={onRun}>Run</button>
  <button bind:this={cancelEl} type="button" disabled={!busy} onclick={onCancel}>Cancel</button>
  {#if showRetry}
    <button bind:this={retryEl} type="button" class="retry" onclick={onRetry}>Retry</button>
  {/if}
</div>

<p class="status" role="status">{status}</p>
<p class="alert" role="alert">{error}</p>

<style>
  .controls {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0 0.75rem;
  }

  button {
    font: inherit;
    font-family: var(--font-ui);
    padding: 0.4rem 1.1rem;
    border: 1px solid var(--action);
    border-radius: 0.25rem;
    background: var(--action);
    color: var(--action-text);
    cursor: pointer;
  }

  button:disabled {
    border-color: var(--text-muted);
    background: transparent;
    color: var(--text-muted);
    cursor: not-allowed;
  }

  button.retry {
    border-color: var(--warn);
    background: var(--warn);
  }

  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .status,
  .alert {
    margin: 0;
    font-size: 0.9rem;
  }

  .status {
    color: var(--text-muted);
  }

  .alert:not(:empty) {
    border-left: 3px solid var(--warn);
    padding-left: 0.6rem;
    color: var(--text);
  }
</style>
