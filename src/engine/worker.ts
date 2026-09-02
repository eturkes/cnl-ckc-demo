// Module Worker shell: owns the engine for the whole session and speaks the
// protocol. All logic lives in `EngineSession` so Node tests can drive it without
// a DOM `Worker`.

import loadImageModule from 'swipl-wasm/dist/loadImageDefault.js';

import manifest from '@kb/kb-manifest.json';
import pvmUrl from '@kb/kb.pvm?url';

import { WORKER_FAILURE_ID, type EngineRequest, type EngineResponse } from './protocol.js';
import { EngineSession, type Engine, type ImageLoader } from './session.js';

/** Vite resolves this CommonJS default to either the function or `{ default: fn }`. */
const loadImageDefault = (
  typeof loadImageModule === 'function'
    ? loadImageModule
    : (loadImageModule as { default: unknown }).default
) as (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;

/**
 * Collect everything the engine writes to stderr.
 *
 * Both hooks are needed: `printErr` catches what Emscripten routes, `on_output`
 * catches what the Prolog filesystem layer routes. A failing load reports success
 * either way, so these lines are the only evidence that it failed.
 */
const diagnostics: string[] = [];
const sink = {
  print: () => undefined,
  printErr: (line: string) => diagnostics.push(line),
  on_output: (line: string, stream: string) => {
    if (stream === 'stderr') diagnostics.push(line);
  },
};

const drain = (): string[] => diagnostics.splice(0, diagnostics.length);

const loadImage: ImageLoader = async (image) => loadImageDefault(image)(sink);

const session = new EngineSession({
  loadImage,
  drain,
  expected: {
    schemaVersion: manifest.contract.schemaVersion,
    documents: manifest.contract.documents,
  },
});

let image: Promise<Uint8Array> | undefined;

/** `fetch` resolves on 404 and 500, so the status check is what makes this fail closed. */
const fetchImage = async (): Promise<Uint8Array> => {
  const response = await fetch(pvmUrl);
  if (!response.ok) throw new Error(`saved state ${pvmUrl} returned HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

const post = (response: EngineResponse): void => {
  self.postMessage(response);
};

self.addEventListener('message', (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  // A cancel must never wait on the image: it exists to reach a query already running,
  // and the running query is what makes this listener reachable at all.
  if (request.kind === 'cancel') {
    post({ id: request.id, kind: 'ack', accepted: session.requestCancel(request.target) });
    return;
  }
  void (async () => {
    try {
      image ??= fetchImage();
      post(await session.handle(request, await image));
    } catch (cause) {
      // Reaching here means the image itself is unavailable, so the request can
      // never be served; it still settles rather than hanging its caller.
      post({
        id: request.id,
        kind: 'error',
        error: { code: 'boot', message: cause instanceof Error ? cause.message : String(cause) },
      });
    }
  })();
});

// Both channels carry no correlation id — a request that never deserialized has
// none, and a stray rejection belongs to no request — so both settle every caller
// through the reserved id. The parent's own `error` and `messageerror` cover the
// cases where the worker dies without being able to post at all.
self.addEventListener('messageerror', () => {
  post({
    id: WORKER_FAILURE_ID,
    kind: 'error',
    error: { code: 'protocol', message: 'worker could not deserialize a request' },
  });
});

self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  // `reason` is `any` on the DOM event; widening it to `unknown` is what keeps the
  // message construction type-safe.
  const reason: unknown = event.reason;
  post({
    id: WORKER_FAILURE_ID,
    kind: 'error',
    error: {
      code: 'worker',
      message: `unhandled rejection in worker: ${reason instanceof Error ? reason.message : String(reason)}`,
    },
  });
});
