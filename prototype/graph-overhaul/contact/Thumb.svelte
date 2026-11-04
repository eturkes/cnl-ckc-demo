<script lang="ts">
  let { src, title }: { src: string; title: string } = $props();
  let width = $state(0);
</script>

<div class="thumb" bind:clientWidth={width}>
  <iframe {title} {src} loading="lazy" tabindex="-1" style:transform={`scale(${String(width / 1280)})`}></iframe>
</div>

<style>
  .thumb { overflow: hidden; aspect-ratio: 1280 / 900; border: 1px solid var(--border); }
  iframe { width: 1280px; height: 900px; border: 0; transform-origin: 0 0; pointer-events: none; background: var(--surface); }
</style>
