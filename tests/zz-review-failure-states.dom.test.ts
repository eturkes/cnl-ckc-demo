import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController } from '../src/demo/DemoController.svelte.js';
import type { BootOutcome } from '../src/engine/client.js';
import { locale } from '../src/i18n/locale.svelte.js';
import { HttpJudgmentClient } from '../src/intake/client.js';
import { IntakeController } from '../src/intake/IntakeController.svelte.js';
import {
  deferred,
  DeferredDemoEngine,
  judgment,
  turn,
  UI_VOCABULARY,
} from './intake-ui-support.js';

let app: Record<string, unknown> | undefined;
let demo: DemoController;
let intake: IntakeController;
let target: HTMLElement;

beforeEach(() => {
  locale.set('en');
  localStorage.clear();
  target = document.body.appendChild(document.createElement('div'));
});

afterEach(async () => {
  if (app !== undefined) await unmount(app);
  intake.dispose();
  demo.dispose();
  target.remove();
});

const text = (selector: string): string =>
  target.querySelector(selector)?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
const show = (): void => {
  app = mount(App, { target, props: { controller: demo, intake } });
  flushSync();
};

const noRecommendation = (): void => {
  expect(target.querySelector('[data-intake-outcome="no-match"]')).toBeNull();
  expect(target.querySelector('[data-intake-text]')).toBeNull();
  expect(target.querySelector('[data-intake-reveal]')).toBeNull();
};

describe('G2 shipped failure states', () => {
  it.each([
    ['proxy down', 0, 'network', 'did not respond'],
    ['proxy down behind Vite', 500, 'server', 'service failed'],
    ['stale vocabulary', 409, 'stale', 'different knowledge-base vocabularies'],
    ['rate limit', 429, 'rate-limited', 'Too many'],
  ] as const)('%s cannot read as no-match or a recommendation', async (_, code, reason, phrase) => {
    demo = new DemoController(new DeferredDemoEngine());
    await turn();
    intake = new IntakeController({
      vocabulary: UI_VOCABULARY,
      host: demo,
      client: new HttpJudgmentClient({
        vocabulary: UI_VOCABULARY,
        fetch: async () => {
          await Promise.resolve();
          if (code === 0) throw new TypeError('proxy unavailable');
          return new Response('', { status: code });
        },
      }),
    });
    show();
    await intake.submit('opioid use disorder');
    flushSync();
    expect(intake.state).toMatchObject({ kind: 'failed', reason });
    expect(text('[data-intake-alert]')).toContain(phrase);
    expect(target.querySelector('[data-intake-outcome="failed"]')).not.toBeNull();
    expect(target.querySelector('[data-intake-retry]')).not.toBeNull();
    noRecommendation();
  });

  it('engine not booted stays an engine failure with zero engine calls', async () => {
    const boot = deferred<BootOutcome>();
    const engine = new DeferredDemoEngine();
    engine.boot = () => boot.promise;
    demo = new DemoController(engine);
    intake = new IntakeController({
      vocabulary: UI_VOCABULARY,
      host: demo,
      client: { judge: () => Promise.resolve({ kind: 'judged', judgment: judgment() }) },
    });
    show();
    await intake.submit('opioid use disorder');
    flushSync();
    expect(intake.state).toMatchObject({ kind: 'failed', reason: 'engine' });
    expect(text('[data-intake-alert]')).toContain('Prolog engine');
    expect(engine.derivations).toHaveLength(0);
    noRecommendation();
  });

  it('a matched rule that fails to derive is disclosed without recommendation text', async () => {
    demo = new DemoController(new DeferredDemoEngine());
    await turn();
    intake = new IntakeController({
      vocabulary: UI_VOCABULARY,
      host: {
        derive: (ids) =>
          Promise.resolve({
            kind: 'derived',
            rules: ids.map((ruleId) => ({ ruleId: String(ruleId), status: 'not-derived' })),
          }),
      },
      client: { judge: () => Promise.resolve({ kind: 'judged', judgment: judgment() }) },
    });
    show();
    await intake.submit('opioid use disorder');
    flushSync();
    expect(text('[data-intake-status]')).toBe('0 recommendations derived from 2 matched rules.');
    expect(text('[data-intake-result]')).toContain('No matched rule derived in Prolog');
    expect(target.querySelectorAll('[data-intake-row]')).toHaveLength(2);
    for (const row of target.querySelectorAll('[data-intake-row]')) {
      expect(row.textContent).toContain('This rule did not derive');
    }
    noRecommendation();
  });
});
