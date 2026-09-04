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
  <button class="run" bind:this={runEl} type="button" disabled={!canRun} onclick={onRun}>Run</button
  >
  <button class="cancel" bind:this={cancelEl} type="button" disabled={!busy} onclick={onCancel}
    >Cancel</button
  >
  {#if showRetry}
    <button bind:this={retryEl} type="button" class="retry" onclick={onRetry}>Retry</button>
  {/if}
</div>

<p class="status" role="status">{status}</p>
<p class="alert" role="alert">{error}</p>

<style>
  .controls {
    display: flex;
    gap: 0.4rem;
    margin: 0.75rem 0;
  }

  button {
    font: inherit;
    font-family: var(--font-ui);
    min-height: 2.5rem;
    padding: 0.45rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: transparent;
    color: var(--text);
    font-size: 0.86rem;
    font-weight: 650;
    cursor: pointer;
  }

  button.run,
  button.retry {
    border-color: var(--action);
    background: var(--action);
    color: var(--action-text);
  }

  button.cancel:not(:disabled):hover {
    border-color: var(--action);
    color: var(--action);
  }

  button:disabled {
    border-color: var(--text-muted);
    background: transparent;
    color: var(--text-muted);
    opacity: 0.55;
    cursor: not-allowed;
  }

  button.retry {
    border-color: var(--warn);
    background: var(--warn);
    color: var(--action-text);
  }

  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .status,
  .alert {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
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
