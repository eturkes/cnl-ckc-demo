<script lang="ts">
  import SemanticGraph from '../src/graph/SemanticGraph.svelte';
  import type { GraphFocus } from '../src/graph/model.js';

  let { initial }: { initial: string } = $props();
  let focus = $state<GraphFocus>(initial);
  let focusRequest = $state(1);

  export const select = (id: string): void => {
    focus = id;
    focusRequest += 1;
  };
</script>

<SemanticGraph {focus} {focusRequest} />
