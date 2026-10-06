// Reached through `import()` alone, once the reader asks for the page, so neither PDF.js nor its
// worker joins the answer path or the offline precache.

import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { locatePassage, type Located } from './locate.js';
import './pdf-viewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface RenderedPage {
  page: number;
  located: Located;
}

/**
 * Draw `page` of the PDF at `url` into `surface`, its width filling the surface, with PDF.js's
 * text layer over the canvas, and mark the items holding `passage`. Aborting, or finishing,
 * destroys the loading task, which ends its worker.
 */
export const renderPage = async (
  surface: HTMLElement,
  url: string,
  page: number,
  passage: string,
  signal: AbortSignal,
): Promise<RenderedPage> => {
  // An abort can land before this call (during the lazy import) or between any two awaits; the
  // surface is written only while the request is live.
  const live = (): void => {
    if (signal.aborted) throw new DOMException('page render aborted', 'AbortError');
  };
  live();
  const task = getDocument({ url });
  const abort = (): void => {
    void task.destroy();
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    live();
    const proxy = await pdf.getPage(page);
    live();
    const scale = surface.clientWidth / proxy.getViewport({ scale: 1 }).width;
    const viewport = proxy.getViewport({ scale });
    const ratio = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${String(viewport.width)}px`;
    canvas.style.height = `${String(viewport.height)}px`;
    const text = document.createElement('div');
    text.className = 'textLayer';
    surface.style.setProperty('--total-scale-factor', String(scale));
    surface.style.setProperty('--scale-round-x', '1px');
    surface.style.setProperty('--scale-round-y', '1px');
    surface.replaceChildren(canvas, text);

    await proxy.render({
      canvas,
      viewport,
      ...(ratio === 1 ? {} : { transform: [ratio, 0, 0, ratio, 0, 0] }),
    }).promise;
    live();
    const layer = new TextLayer({
      textContentSource: proxy.streamTextContent(),
      container: text,
      viewport,
    });
    await layer.render();
    live();
    const located = locatePassage(layer.textContentItemsStr, passage);
    for (const index of located.items) layer.textDivs[index]?.classList.add('passage');
    return { page, located };
  } finally {
    signal.removeEventListener('abort', abort);
    // The drawn canvas and text layer outlive the document; its worker does not need to.
    void task.destroy();
  }
};
