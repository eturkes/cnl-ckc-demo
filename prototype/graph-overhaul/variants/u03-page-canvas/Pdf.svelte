<script lang="ts">
  import { onMount } from 'svelte';
  import type { PDFDocumentProxy } from 'pdfjs-dist';
  let { pdf, page, large = false, done = () => {} }: {pdf: Promise<PDFDocumentProxy>; page:number; large?:boolean; done?:()=>void} = $props();
  let canvas: HTMLCanvasElement;
  onMount(() => {
    let live = true;
    void pdf.then(async doc => {
      const p = await doc.getPage(page);
      if (!live) return;
      const viewport = p.getViewport({ scale: large ? 1.3 : .24 });
      canvas.width = viewport.width; canvas.height = viewport.height;
      await p.render({canvas, viewport}).promise;
      if(live) done();
    });
    return () => {live = false;};
  });
</script>
<canvas bind:this={canvas} aria-label={`Guideline PDF page ${page}`}></canvas>
<style>canvas{display:block;width:100%;height:auto;background:white;}</style>
