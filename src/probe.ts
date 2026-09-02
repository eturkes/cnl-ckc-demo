// Review-only browser entry. Bundles the shipped `EngineClient` and, through its
// `new URL('./worker.ts', import.meta.url)` spawn, the shipped module worker and its
// hashed PVM fetch. The Svelte UI is the only thing this entry replaces, so every
// engine-side claim it drives is driven against built output.

import { BUDGET_MAX } from './engine/budget.js';
import { EngineClient } from './engine/client.js';

declare global {
  interface Window {
    probe: {
      EngineClient: typeof EngineClient;
      BUDGET_MAX: typeof BUDGET_MAX;
      client?: EngineClient;
      ticks: number[];
    };
  }
}

window.probe = { EngineClient, BUDGET_MAX, ticks: [] };
document.body.dataset.probe = 'ready';
