// Module Worker shell: owns the engine for the whole session and speaks the
// protocol. All logic lives in `EngineSession` so Node tests can drive it without
// a DOM `Worker`.

import loadImageModule from 'swipl-wasm/dist/loadImageDefault.js';

import manifest from '@kb/kb-manifest.json';
import pvmUrl from '@kb/kb.pvm?url';

import type { EngineRequest, EngineResponse } from './protocol.js';
import { EngineSession, type Engine, type ImageLoader } from './session.js';

/** Vite resolves this CommonJS default to either the function or `{ default: fn }`. */
const loadImageDefault = (
  typeof loadImageModule === 'function'
    ? loadImageModule
    : (loadImageModule as { default: unknown }).default
) as (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>;

const loadImage: ImageLoader = async (image) => loadImageDefault(image)({});

const session = new EngineSession({
  loadImage,
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

self.addEventListener('messageerror', () => {
  post({
    id: 'unknown',
    kind: 'error',
    error: { code: 'protocol', message: 'worker could not deserialize a request' },
  });
});
