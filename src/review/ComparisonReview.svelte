<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import LanguageToggle from '../demo/LanguageToggle.svelte';
  import ThemeToggle from '../demo/ThemeToggle.svelte';
  import { EngineClient } from '../engine/client.js';
  import { PROOF_BUDGET_MAX } from '../engine/protocol.js';
  import type { ProvenanceState } from '../provenance/model.js';
  import ProvenanceLadder from '../provenance/ProvenanceLadder.svelte';
  import { COMPARISON_GOAL } from './goal.js';

  // The engine proves the goal in its worker through the proof RPC a catalog trace takes, and the
  // shipped ladder renders the outcome: the page adds no copy and no ladder state of its own.
  const client = new EngineClient();
  let provenance = $state.raw<ProvenanceState>({ kind: 'loading', solution: 0 });

  const prove = async (): Promise<ProvenanceState> => {
    const booted = await client.boot();
    if (booted.kind === 'error') return { kind: 'error', solution: 0, error: booted.error };
    const outcome = await client.prove({ constrainedGoal: COMPARISON_GOAL }, PROOF_BUDGET_MAX);
    switch (outcome.kind) {
      case 'proof':
        return { kind: 'ready', solution: 0, steps: outcome.steps };
      case 'limit':
        return { kind: 'limit', solution: 0, limit: outcome.limit };
      case 'error':
        return { kind: 'error', solution: 0, error: outcome.error };
      case 'failure':
      case 'cancelled':
        return { kind: outcome.kind, solution: 0 };
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  };

  onMount(() => {
    void prove().then((next) => {
      provenance = next;
    });
  });

  onDestroy(() => {
    client.dispose();
  });
</script>

<header>
  <LanguageToggle />
  <ThemeToggle />
</header>
<main>
  <ProvenanceLadder state={provenance} />
</main>

<style>
  header,
  main {
    width: min(100% - 3rem, 72rem);
    margin: 0 auto;
  }

  header {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 0.75rem 0;
  }

  main {
    margin-bottom: 4rem;
    border: 1px solid var(--border);
    padding: clamp(1.25rem, 3vw, 2rem);
    background: var(--surface-raised);
  }
</style>
