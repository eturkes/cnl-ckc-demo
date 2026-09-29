// @vitest-environment jsdom

import axe from 'axe-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController } from '../src/demo/DemoController.svelte.js';
import { locale } from '../src/i18n/locale.svelte.js';
import type { IntakeController } from '../src/intake/IntakeController.svelte.js';
import type { JudgmentOutcome } from '../src/intake/client.js';
import type { DerivedRule, IntakeDerivation } from '../src/intake/service.js';
import {
  clinicalAnswer,
  deferred,
  DeferredDemoEngine,
  derived,
  judgment,
  QUESTION,
  turn,
  UI_VOCABULARY,
  type Deferred,
} from './intake-ui-support.js';

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let demo: DemoController | undefined;
let intake: IntakeController | undefined;
let engine: DeferredDemoEngine;
let judges: {
  description: string;
  signal: AbortSignal | undefined;
  result: Deferred<JudgmentOutcome>;
}[];
let derivations: { ids: readonly unknown[]; result: Deferred<IntakeDerivation> }[];
let scrolls: HTMLElement[];
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
const DESCRIPTION = 'gap-sentinel';
const IDS = ['doc-alpha:1', 'doc-beta:2'];

const text = (node: Node): string => node.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
const one = <T extends Element = HTMLElement>(selector: string, root: ParentNode = target): T => {
  const nodes = root.querySelectorAll<T>(selector);
  expect(nodes.length, selector).toBe(1);
  return nodes[0]!;
};
const field = (): HTMLTextAreaElement => one('textarea#intake-description');
const form = (): HTMLFormElement => one('form[data-intake]');
const submit = (): HTMLButtonElement => one('button[type="submit"]', form());
const cancel = (): HTMLButtonElement => one('button[data-intake-cancel]', form());
const region = (): HTMLElement => one('[data-intake-result]');
const update = async (): Promise<void> => {
  await turn();
  flushSync();
};
const enter = (value = DESCRIPTION): void => {
  field().value = value;
  field().dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};
const send = (): void => {
  form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  flushSync();
};
const judge = async (kind: 'answered' | 'refused' | 'no-match', overflow = 0): Promise<void> => {
  const base = judgment({ overflow });
  if (kind === 'refused')
    base.pain = {
      choice: 'other',
      probabilities: { acute: 0, subacute: 0, chronic: 0, unstated: 0, other: 1 },
    };
  if (kind === 'no-match') {
    base.conditions = { c01: 0, c02: 0 };
    base.sections = { s1: 0 };
  }
  judges.at(-1)!.result.resolve({ kind: 'judged', judgment: base });
  await update();
};
const answer = async (results?: DerivedRule[]): Promise<void> => {
  enter();
  send();
  await judge('answered');
  derivations
    .at(-1)!
    .result.resolve(results === undefined ? derived(IDS) : { kind: 'derived', rules: results });
  await update();
};
const heading = (kind: string): HTMLElement => {
  const node = one(`[data-intake-outcome="${kind}"]`);
  expect(node.matches('h1,h2,h3,h4,h5,h6,[role="heading"]')).toBe(true);
  expect(text(node)).not.toBe('');
  expect(node.closest('[hidden],[aria-hidden="true"]')).toBeNull();
  return node;
};
const labelledGaps = (): HTMLUListElement => {
  const list = one<HTMLUListElement>('ul[data-intake-gaps]');
  const references = list.getAttribute('aria-labelledby')?.trim().split(/\s+/u) ?? [];
  expect(references.length).toBeGreaterThan(0);
  const label = references
    .map((id) => {
      const node = document.getElementById(id);
      expect(node, `gap label ${id}`).not.toBeNull();
      expect(node?.closest('[hidden],[aria-hidden="true"]')).toBeNull();
      return node === null ? '' : text(node);
    })
    .join(' ')
    .trim();
  expect(label).not.toBe('');
  for (const item of list.querySelectorAll('li')) expect(label).not.toBe(text(item));
  return list;
};

beforeEach(async () => {
  locale.set('en');
  localStorage.clear();
  target = document.body.appendChild(document.createElement('div'));
  scrolls = [];
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value(this: HTMLElement) {
      scrolls.push(this);
    },
  });
  judges = [];
  derivations = [];
  engine = new DeferredDemoEngine();
  demo = new DemoController(engine);
  await turn();
  // Resolve at test time so an absent contract seam records one red per case.
  const module = await import('../src/intake/IntakeController.svelte.js');
  intake = new module.IntakeController({
    vocabulary: UI_VOCABULARY,
    client: {
      judge(description, signal) {
        const result = deferred<JudgmentOutcome>();
        judges.push({ description, signal, result });
        return result.promise;
      },
    },
    host: {
      derive(ids) {
        const result = deferred<IntakeDerivation>();
        derivations.push({ ids, result });
        return result.promise;
      },
    },
  });
  app = mount(App, { target, props: { controller: demo, intake } });
  flushSync();
});

afterEach(() => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  intake?.dispose();
  intake = undefined;
  demo?.dispose();
  demo = undefined;
  target.remove();
  if (scrollDescriptor === undefined)
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  else Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor);
  locale.set('en');
  localStorage.clear();
});

describe('U1 free text first; accepted surfaces stay mounted', () => {
  it('U1 places the labelled textarea and submit above the built-in combobox inside ask', () => {
    const ask = one('#ask');
    const combo = one('[role="combobox"]', ask);
    expect(ask.contains(form())).toBe(true);
    expect(form().contains(field())).toBe(true);
    const label = one<HTMLLabelElement>('label[for="intake-description"]', form());
    expect(text(label)).not.toBe('');
    expect(label.control).toBe(field());
    expect(field().compareDocumentPosition(combo) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(submit().compareDocumentPosition(combo) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(text(submit())).not.toBe('');
    expect(one('.controls', ask)).not.toBeNull();
    expect(one('.answer-region', ask)).not.toBeNull();
  });

  it('U1 intake updates leave combobox, controls, answer and ladder markup unchanged', async () => {
    demo!.state = {
      kind: 'settled',
      id: QUESTION,
      result: clinicalAnswer(QUESTION, ['doc-existing']),
    };
    demo!.solutionIndex = 0;
    demo!.provenance = { kind: 'failure', solution: 0 };
    flushSync();
    const selectors = ['[role="combobox"]', '.controls', '.answer-region', '.trace'];
    const before = selectors.map((selector) => one(selector));
    const markup = before.map((node) => node.outerHTML);
    await answer();
    selectors.forEach((selector, index) => {
      expect(one(selector)).toBe(before[index]);
      expect(one(selector).outerHTML).toBe(markup[index]);
    });
    expect(one('[data-intake-result]')).not.toBe(one('.answer-region'));
  });
});

describe('U2 distinct outcomes, grounded gaps and overflow', () => {
  it('U2 refused, no-match and answered have pairwise-distinct headings and result text', async () => {
    const headings: string[] = [];
    const contents: string[] = [];
    for (const kind of ['refused', 'no-match', 'answered'] as const) {
      enter();
      send();
      await judge(kind);
      if (kind === 'answered') {
        derivations.at(-1)!.result.resolve(derived(IDS));
        await update();
      }
      expect(region().querySelectorAll('[data-intake-outcome]')).toHaveLength(1);
      headings.push(text(heading(kind)));
      contents.push(text(region()));
    }
    expect(new Set(headings).size).toBe(3);
    expect(new Set(contents).size).toBe(3);
  });

  it.each(['answered', 'no-match'] as const)(
    'U2 %s shows verbatim gaps with a separate judged-absence label',
    async (kind) => {
      enter();
      send();
      await judge(kind);
      if (kind === 'answered') {
        derivations.at(-1)!.result.resolve(derived(IDS));
        await update();
      }
      const gaps = labelledGaps();
      expect([...gaps.querySelectorAll('li')].map(text)).toEqual([DESCRIPTION]);
      expect(gaps.closest('[hidden],[aria-hidden="true"]')).toBeNull();
    },
  );

  it.each(['answered', 'no-match'] as const)(
    'U2 %s discloses nonzero overflow and omits it at zero',
    async (kind) => {
      for (const overflow of [0, 19]) {
        enter();
        send();
        await judge(kind, overflow);
        if (kind === 'answered') {
          derivations.at(-1)!.result.resolve(derived(IDS));
          await update();
        }
        const notice = region().querySelector('[data-intake-overflow]');
        if (overflow === 0) expect(notice).toBeNull();
        else {
          expect(notice).not.toBeNull();
          expect(text(notice!)).toMatch(/\b19\b/u);
        }
      }
    },
  );

  it('U2 refused removes prior recommendation rows, gaps and overflow', async () => {
    await answer();
    enter();
    send();
    await judge('refused', 5);
    heading('refused');
    expect(region().querySelector('[data-intake-row]')).toBeNull();
    expect(region().querySelector('[data-intake-gaps]')).toBeNull();
    expect(region().querySelector('[data-intake-overflow]')).toBeNull();
  });
});

describe('U3 derived rows and owned reveal action', () => {
  it('U3 every row shows its own derived text, document, trigger value and clause count', async () => {
    const results: DerivedRule[] = IDS.map((ruleId, index) => ({
      ruleId,
      status: 'derived',
      text: `ONLY ENGINE TEXT ${String(index)}.`,
      lines: Array.from({ length: index === 0 ? 7 : 11 }, (_, n) => 401 + n),
    }));
    await answer(results);
    expect(
      [...region().querySelectorAll('[data-intake-row]')].map((row) =>
        row.getAttribute('data-intake-row'),
      ),
    ).toEqual(IDS);
    for (const [index, ruleId] of IDS.entries()) {
      const row = one<HTMLLIElement>(`li[data-intake-row="${ruleId}"]`);
      const rule = UI_VOCABULARY.rules[index]!;
      const result = results[index]!;
      if (result.status !== 'derived') throw new Error('fixture must derive');
      expect(text(one('[data-intake-text]', row))).toBe(result.text);
      expect(text(row)).toContain(rule.document);
      const trigger = index === 0 ? ['c01', 'condition-alpha'] : ['s1', 'section-gamma'];
      expect(trigger.some((label) => text(row).includes(label))).toBe(true);
      expect(text(row)).toMatch(index === 0 ? /0[.,]83|83\s*%/u : /0[.,]91|91\s*%/u);
      expect(text(row)).toMatch(index === 0 ? /\b7\b/u : /\b11\b/u);
      expect(text(one('button[data-intake-reveal]', row))).not.toBe('');
    }
  });

  it.each(['not-derived', 'limit', 'error', 'cancelled'] as const)(
    'U3 %s rows never render a recommendation or reveal action',
    async (status) => {
      const result: DerivedRule =
        status === 'limit'
          ? { ruleId: IDS[0]!, status, limit: 'depth' }
          : status === 'error'
            ? { ruleId: IDS[0]!, status, error: { code: 'decode', message: 'unrenderable-rule' } }
            : { ruleId: IDS[0]!, status };
      await answer([result, { ruleId: IDS[1]!, status: 'not-derived' }]);
      for (const row of region().querySelectorAll('[data-intake-row]')) {
        expect(row.querySelector('[data-intake-text]')).toBeNull();
        expect(row.querySelector('[data-intake-reveal]')).toBeNull();
        expect(text(row)).not.toBe('');
      }
      expect(region().querySelectorAll('[data-intake-row]')).toHaveLength(2);
      expect(region().querySelector('[data-intake-text]')).toBeNull();
    },
  );

  it('U3 reveal waits, selects the matching non-first document, then scrolls to the answer', async () => {
    await answer();
    const row = one('[data-intake-row="doc-beta:2"]');
    one<HTMLButtonElement>('button[data-intake-reveal]', row).click();
    await update();
    expect(engine.asks).toHaveLength(1);
    expect(engine.asks[0]?.id).toBe(UI_VOCABULARY.rules[1]?.question);
    expect(demo!.selected).toBe(UI_VOCABULARY.rules[1]?.question);
    expect(scrolls).toHaveLength(0);
    engine.asks[0]!.result.resolve(
      clinicalAnswer(UI_VOCABULARY.rules[1]!.question, ['doc-other', 'doc-beta']),
    );
    await update();
    expect(demo!.solutionIndex).toBe(1);
    expect(scrolls).toHaveLength(1);
    const answerRegion = one('.answer-region');
    expect(scrolls[0] === answerRegion || answerRegion.contains(scrolls[0]!)).toBe(true);
  });

  it('U3 missing document announces a row-local refusal and never scrolls to another answer', async () => {
    await answer();
    const row = one('[data-intake-row="doc-beta:2"]');
    one<HTMLButtonElement>('button[data-intake-reveal]', row).click();
    await update();
    engine.asks[0]!.result.resolve(clinicalAnswer(UI_VOCABULARY.rules[1]!.question, ['doc-other']));
    await update();
    expect(scrolls).toHaveLength(0);
    expect(text(one('[data-intake-reveal-note]', row))).not.toBe('');
  });

  it('U3 superseded reveal never scrolls after a different owned run takes over', async () => {
    await answer();
    const row = one('[data-intake-row="doc-beta:2"]');
    one<HTMLButtonElement>('button[data-intake-reveal]', row).click();
    await update();
    demo!.select(QUESTION);
    const next = demo!.run();
    engine.asks[0]!.result.resolve(clinicalAnswer(UI_VOCABULARY.rules[1]!.question, ['doc-beta']));
    await update();
    expect(scrolls).toHaveLength(0);
    expect(engine.asks).toHaveLength(2);
    engine.asks[1]!.result.resolve(clinicalAnswer());
    await next;
    await update();
    expect(scrolls).toHaveLength(0);
  });
});

describe('U4 mounted live regions and complete control lifecycle', () => {
  it('U4 mounts stable status, alert and unbusy result before any submission', async () => {
    const status = one('[data-intake-status][role="status"]');
    const alert = one('[data-intake-alert][role="alert"]');
    const result = region();
    expect(result.getAttribute('aria-busy')).toBe('false');
    enter();
    send();
    expect(region()).toBe(result);
    expect(result.getAttribute('aria-busy')).toBe('true');
    expect(one('[data-intake-status][role="status"]')).toBe(status);
    expect(one('[data-intake-alert][role="alert"]')).toBe(alert);
    expect(text(status)).not.toBe('');
    await judge('answered');
    expect(result.getAttribute('aria-busy')).toBe('true');
    derivations.at(-1)!.result.resolve(derived(IDS));
    await update();
    expect(region()).toBe(result);
    expect(result.getAttribute('aria-busy')).toBe('false');
    expect(one('[data-intake-status][role="status"]')).toBe(status);
    expect(one('[data-intake-alert][role="alert"]')).toBe(alert);
  });

  it('U4 submit and cancel use native disabled states for empty, judging and deriving', async () => {
    expect(submit().disabled).toBe(true);
    expect(cancel().disabled).toBe(true);
    enter(' \n\t ');
    expect(submit().disabled).toBe(true);
    enter();
    expect(submit().disabled).toBe(false);
    send();
    expect(submit().disabled).toBe(true);
    expect(cancel().disabled).toBe(false);
    await judge('answered');
    expect(submit().disabled).toBe(true);
    expect(cancel().disabled).toBe(false);
    derivations.at(-1)!.result.resolve(derived(IDS));
    await update();
    expect(submit().disabled).toBe(false);
    expect(cancel().disabled).toBe(true);
  });

  it.each(['rate-limited', 'stale', 'server', 'network', 'invalid'] as const)(
    'U4 %s failure keeps typed text and retries through the injected client',
    async (reason) => {
      enter();
      send();
      judges[0]!.result.resolve({ kind: 'unavailable', reason });
      await update();
      heading('failed');
      expect(field().value).toBe(DESCRIPTION);
      expect(region().getAttribute('aria-busy')).toBe('false');
      expect(text(one('[data-intake-alert][role="alert"]'))).not.toBe('');
      const retry = one<HTMLButtonElement>('button[data-intake-retry]');
      expect(retry.disabled).toBe(false);
      expect(text(retry)).not.toBe('');
      retry.click();
      await update();
      expect(judges).toHaveLength(2);
      expect(judges[1]?.description).toBe(DESCRIPTION);
      await judge('no-match');
      heading('no-match');
      expect(region().querySelector('[data-intake-retry]')).toBeNull();
    },
  );

  it.each(['judging', 'deriving'] as const)(
    'U4 cancelling %s returns idle with late results suppressed',
    async (phase) => {
      enter();
      send();
      if (phase === 'deriving') await judge('answered');
      cancel().click();
      flushSync();
      expect(intake!.state).toEqual({ kind: 'idle' });
      expect(region().getAttribute('aria-busy')).toBe('false');
      expect(cancel().disabled).toBe(true);
      expect(submit().disabled).toBe(false);
      expect(field().value).toBe(DESCRIPTION);
      if (phase === 'judging') await judge('answered');
      else {
        derivations.at(-1)!.result.resolve(derived(IDS));
        await update();
      }
      expect(region().querySelector('[data-intake-outcome]')).toBeNull();
      expect(region().querySelector('[data-intake-row]')).toBeNull();
    },
  );
});

describe('U6 accessibility across every intake phase', () => {
  it.each(['idle', 'judging', 'deriving', 'refused', 'no-match', 'answered', 'failed'] as const)(
    'U6 %s has zero axe violations and only the jsdom contrast limitation',
    async (kind) => {
      if (kind !== 'idle') {
        enter();
        send();
        if (kind === 'failed') {
          judges[0]!.result.resolve({ kind: 'unavailable', reason: 'network' });
          await update();
        } else if (kind !== 'judging') {
          await judge(kind === 'deriving' ? 'answered' : kind);
          if (kind === 'answered') {
            derivations.at(-1)!.result.resolve(derived(IDS));
            await update();
          }
        }
      }
      // Positive surface assertion: axe on an omitted intake must not grade an empty fixture.
      expect(one('form[data-intake]')).not.toBeNull();
      if (['refused', 'no-match', 'answered', 'failed'].includes(kind)) heading(kind);
      const scan = await axe.run(target);
      expect(scan.violations.map((violation) => violation.id)).toEqual([]);
      expect(
        scan.incomplete.map((item) => item.id).filter((id) => id !== 'color-contrast'),
      ).toEqual([]);
    },
  );
});
