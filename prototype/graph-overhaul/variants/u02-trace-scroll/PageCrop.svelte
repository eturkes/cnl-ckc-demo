<script lang="ts">
  import { onMount } from 'svelte';
  import * as pdfjs from 'pdfjs-dist';
  import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
  let { url, page, source }: { url: string; page: number; source: string } = $props();
  let canvas: HTMLCanvasElement;
  let error = $state('');
  let position = $state('Top of page');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  onMount(() => {
    const task = pdfjs.getDocument(url);
    let cancelled = false;
    void (async () => {
      try {
        const pdf = await task.promise;
        const p = await pdf.getPage(page);
        const viewport = p.getViewport({ scale: 1.3 });
        const content = await p.getTextContent();
        const needle = source.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().slice(0, 28);
        const item = content.items.find((v) => 'str' in v && v.str.toLowerCase().replace(/[^a-z0-9 ]/g, '').includes(needle));
        const top = item && 'transform' in item ? Math.max(0, viewport.height - item.transform[5] * 1.3 - 30) : 0;
        if (cancelled) return;
        position = top ? 'Page crop near the passage opening' : 'Page preview: top crop; passage location not matched';
        canvas.width = Math.ceil(viewport.width);
        canvas.height = 300;
        const ctx = canvas.getContext('2d')!;
        await p.render({ canvasContext: ctx, canvas, viewport, transform: [1, 0, 0, 1, 0, -top] }).promise;
      } catch (e) { if (!cancelled) error = String(e); }
    })();
    return () => { cancelled = true; void task.destroy(); };
  });
</script>
<figure>
  <div class="crop"><canvas bind:this={canvas} aria-label={`Guideline page ${page} crop`}></canvas></div>
  <figcaption>{error ? `Page could not load: ${error}` : position}. <a href={`${url}#page=${page}`} target="_blank" rel="noreferrer">Open full PDF page {page}</a></figcaption>
</figure>
<style>
  figure { margin: 1rem 0 0; } .crop { background: white; border: 1px solid var(--border); max-height: 240px; overflow: hidden; } canvas { display: block; width: 100%; height: auto; } figcaption { font-size: .8rem; margin-top: .5rem; color: var(--text-muted); } a { color: var(--action); } a:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }
</style>
