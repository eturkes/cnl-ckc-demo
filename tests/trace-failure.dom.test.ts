// @vitest-environment jsdom
// u14 A21: `TEXT.traceFailure` renders only when the selected solution's proof request comes
// back `failure`. The whole App runs over an engine whose answer succeeds and whose proof fails,
// and the rendered page must carry the copy in both locales.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { BootOutcome } from '../src/engine/client.js';
import type { ProofOutcome } from '../src/engine/protocol.js';
import { TEXT as EN_TEXT } from '../src/i18n/en.js';
import { TEXT as JA_TEXT } from '../src/i18n/ja.js';
import { locale } from '../src/i18n/locale.svelte.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';
import type { AnswerResult } from '../src/questions/service.js';

const ID = QUESTION_IDS[0];

class FailingProofEngine implements DemoEngine {
  proofs = 0;
  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: { schemaVersion: 1, documents: 337 } });
  }
  ask(): Promise<AnswerResult> {
    return Promise.resolve({
      kind: 'answer',
      id: ID,
      serialized: 'solutions',
      solutions: [
        {
          bindings: { Answer: { kind: 'atom', value: 'answer' } },
          display: { Answer: 'answer' },
        },
      ],
    });
  }
  readonly prove = (): Promise<ProofOutcome> => {
    this.proofs += 1;
    return Promise.resolve({ kind: 'failure' });
  };
  dispose(): void {}
}

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let controller: DemoController | undefined;

const settle = async (): Promise<void> => {
  for (let round = 0; round < 8; round++) await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

beforeEach(() => {
  locale.set('en');
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(async () => {
  if (app !== undefined) await unmount(app);
  controller?.dispose();
  target.remove();
  locale.set('en');
  app = undefined;
  controller = undefined;
});

describe('proof-RPC failure copy', () => {
  it('renders TEXT.traceFailure when the proof request fails, in both locales', async () => {
    const engine = new FailingProofEngine();
    controller = new DemoController(engine);
    app = mount(App, { target, props: { controller } });
    await settle();
    controller.select(ID);
    await controller.run();
    await settle();
    expect(engine.proofs).toBeGreaterThan(0);
    expect(controller.provenance.kind).toBe('failure');
    expect(target.textContent).toContain(EN_TEXT.traceFailure());

    locale.set('ja');
    await settle();
    expect(target.textContent).toContain(JA_TEXT.traceFailure());
  });
});
