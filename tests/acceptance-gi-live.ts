// Node transport only: the shipped client and session execute the real saved image.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { EngineClient } from '../src/engine/client.js';
import type { EngineRequest, EngineResponse } from '../src/engine/protocol.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

import { ROOT } from './acceptance-gi-bag.js';

const require = createRequire(import.meta.url);
const image = new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm')));
const manifest = JSON.parse(readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8')) as {
  contract: { schemaVersion: number; documents: number };
};
const loadImage: ImageLoader = async (bytes) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options: Record<string, unknown>) => Promise<Engine> };
  return (typeof factory === 'function' ? factory : factory.default)(bytes)({});
};

export class LiveWorker {
  #ended = false;
  readonly #session = new EngineSession({
    loadImage,
    expected: manifest.contract,
    drain: () => [],
  });
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();
  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }
  #emit(response: EngineResponse): void {
    if (!this.#ended)
      for (const listener of this.#listeners.get('message') ?? []) listener({ data: response });
  }
  postMessage(request: EngineRequest): void {
    setTimeout(() => {
      if (this.#ended) return;
      void this.#session
        .handle(request, image, (response) => this.#emit(response))
        .then(
          (response) => this.#emit(response),
          (cause: unknown) => {
            if (this.#ended) return;
            for (const listener of this.#listeners.get('error') ?? [])
              listener({
                message: cause instanceof Error ? cause.message : String(cause),
              });
          },
        );
    }, 0);
  }
  terminate(): void {
    this.#ended = true;
  }
}
export const liveClient = (): EngineClient =>
  new EngineClient({ spawn: () => new LiveWorker() as unknown as Worker });
