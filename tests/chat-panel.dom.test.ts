// @vitest-environment jsdom
// chat-c5 V1–V6 (`.agent/contracts/chat-c5.md`): the rendered chat panel, mounted in the real App
// over a fake engine and a scripted bridge client.

import axe from 'axe-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { ChatController } from '../src/chat/ChatController.svelte.js';
import type { ChatClient, TurnEnd } from '../src/chat/client.js';
import type { ChatEvent } from '../src/chat/events.js';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { QueryOutcome } from '../src/engine/client.js';
import { EN } from '../src/i18n/en.js';
import { JA } from '../src/i18n/ja.js';
import { locale } from '../src/i18n/locale.svelte.js';
import type { AnswerResult } from '../src/questions/service.js';

const CONTRACT = { schemaVersion: 1, documents: 337 };
const URL_A = 'https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm';
const GOAL = 'clinical_rule(D,S,R)';

const SOLVED: QueryOutcome = {
  kind: 'solutions',
  solutions: [
    {
      bindings: { D: { kind: 'atom', value: 'cdc2022-opioid-rec01' } },
      display: { D: "'cdc2022-opioid-rec01'", S: '2' },
    },
  ],
};

/** A goal the engine refused; the card shows its message. */
const REFUSED: QueryOutcome = {
  kind: 'error',
  error: { code: 'guard', message: 'read-only query refused: assertz/1 is not on the allowlist' },
};

class FakeEngine implements DemoEngine {
  readonly goals: string[] = [];
  outcome: QueryOutcome = SOLVED;
  boot() {
    return Promise.resolve({ kind: 'booted' as const, contract: CONTRACT });
  }
  ask(): Promise<AnswerResult> {
    return new Promise(() => undefined);
  }
  runGoal(goal: string): Promise<QueryOutcome> {
    this.goals.push(goal);
    return Promise.resolve(this.outcome);
  }
  dispose(): void {}
}

/** A bridge client whose turns the test scripts event by event. */
class ScriptedClient implements ChatClient {
  readonly posted: { call: string; text: string; ok: boolean }[] = [];
  #events: ChatEvent[] = [];
  #end: TurnEnd | 'hold' = 'done';
  #release: (() => void) | undefined;

  script(events: ChatEvent[], end: TurnEnd | 'hold' = 'done'): void {
    this.#events = events;
    this.#end = end;
  }

  release(): void {
    this.#release?.();
  }

  async turn(
    _message: string,
    _conversation: string | undefined,
    onEvent: (event: ChatEvent) => void | Promise<void>,
    signal: AbortSignal,
  ): Promise<TurnEnd> {
    for (const event of this.#events) await onEvent(event);
    if (this.#end === 'hold') {
      await new Promise<void>((resolve, reject) => {
        this.#release = resolve;
        signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
      return 'done';
    }
    return this.#end;
  }

  result(_conversation: string, call: string, text: string, ok: boolean): Promise<boolean> {
    this.posted.push({ call, text, ok });
    return Promise.resolve(true);
  }
}

const answer = (segments: unknown[]): ChatEvent => ({
  type: 'answer',
  text: JSON.stringify({ segments }),
});

const ANSWERED: ChatEvent[] = [
  { type: 'conversation', id: 'c-1' },
  { type: 'commentary', text: 'Checking the knowledge base.' },
  { type: 'query', call: 'q1', goal: GOAL },
  {
    type: 'search',
    query: 'cdc 2022',
    opened: undefined,
    results: [
      { url: URL_A, title: 'CDC Clinical Practice Guideline', domain: 'cdc.gov', snippet: 's' },
    ],
  },
  answer([
    { text: 'Maximize nonopioid therapy for acute pain.', source: 'kb', queries: ['q1'], urls: [] },
    { text: 'The guideline appeared in 2022.', source: 'web', queries: [], urls: [URL_A] },
    { text: 'Exercise therapy is one option.', source: 'model', queries: [], urls: [] },
    { text: 'A claim with no record.', source: 'kb', queries: ['q9'], urls: [] },
  ]),
  { type: 'done' },
];

let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let engine: FakeEngine;
let client: ScriptedClient;
let chat: ChatController;
let demo: DemoController;
let scrolls: Element[];
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

const text = (node: Node | null | undefined): string =>
  node?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
const one = <T extends Element = HTMLElement>(selector: string, root: ParentNode = target): T => {
  const nodes = root.querySelectorAll<T>(selector);
  expect(nodes.length, selector).toBe(1);
  return nodes[0]!;
};
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};
const send = async (message = 'What should I try before opioids?'): Promise<void> => {
  const field = one<HTMLTextAreaElement>('textarea#chat-message');
  field.value = message;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  one('form[data-chat]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
};

beforeEach(async () => {
  locale.set('en');
  // jsdom implements no layout, so it has no `scrollIntoView`; record the targets instead.
  scrolls = [];
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value(this: HTMLElement) {
      scrolls.push(this);
    },
  });
  target = document.body.appendChild(document.createElement('div'));
  engine = new FakeEngine();
  client = new ScriptedClient();
  demo = new DemoController(engine);
  chat = new ChatController({ client, host: demo });
  app = mount(App, { target, props: { controller: demo, chat } });
  await settle();
});

afterEach(() => {
  if (app !== undefined) void unmount(app);
  app = undefined;
  chat.dispose();
  demo.dispose();
  target.remove();
  if (scrollDescriptor === undefined)
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  else Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor);
  locale.set('en');
});

describe('chat panel', () => {
  it('V1 replaces the intake panel above the built-in question combobox', () => {
    const form = one('form[data-chat]');
    expect(target.querySelector('form[data-intake]')).toBeNull();
    const combobox = one('[role="combobox"]');
    expect(form.compareDocumentPosition(combobox) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('V2 tags every answer part by the source its record backs', async () => {
    client.script(ANSWERED);
    await send();
    expect(engine.goals).toEqual([GOAL]);
    const kb = target.querySelectorAll('[data-chat-segment="kb"]');
    expect(kb).toHaveLength(1);
    const kbTag = one<HTMLAnchorElement>('a.tag.kb', kb[0]);
    expect(text(kbTag)).toBe('KB q1');
    expect(kbTag.getAttribute('href')).toBe(`#${one('[data-chat-card="q1"]').id}`);

    const webTag = one<HTMLAnchorElement>('[data-chat-segment="web"] a.tag.web');
    expect(text(webTag)).toBe('Web 1');
    const source = one(`[id="${webTag.getAttribute('href')?.slice(1) ?? ''}"]`);
    const link = one<HTMLAnchorElement>('a', source);
    expect(link.getAttribute('href')).toBe(URL_A);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noreferrer');
    expect(text(link)).toBe('CDC Clinical Practice Guideline');

    expect(text(one('[data-chat-segment="model"] .tag'))).toBe('Model');
    const unverified = one('[data-chat-segment="unverified"]');
    expect(text(one('.tag', unverified))).toBe('Unverified');
    expect(text(unverified)).toContain(EN.TEXT.chatClaimed('KB'));
    expect(text(one('[data-chat-status]'))).toBe(EN.TEXT.chatAnswered());
    expect(text(one('[data-chat-alert]'))).toBe('');
  });

  it('V3 a card shows the goal and the engine display text, and a tag opens it', async () => {
    client.script(ANSWERED);
    await send();
    const cards = one<HTMLDetailsElement>('details[data-chat-cards]');
    expect(cards.open).toBe(false);
    const card = one('[data-chat-card="q1"]');
    expect(text(one('.goal', card))).toBe(GOAL);
    expect(text(one('.card-head', card))).toBe(`q1 ${EN.TEXT.chatCardSolutions(1)}`);
    expect([...card.querySelectorAll('.solutions li')].map(text)).toEqual([
      "D = 'cdc2022-opioid-rec01', S = 2",
    ]);
    one<HTMLAnchorElement>('a.tag.kb').click();
    flushSync();
    expect(cards.open).toBe(true);
    expect(scrolls).toEqual([card]);
  });

  it('V3 a refused goal shows the engine message and a partial read says how much', async () => {
    engine.outcome = REFUSED;
    client.script([
      { type: 'conversation', id: 'c-2' },
      { type: 'query', call: 'q1', goal: 'assertz(x)' },
      answer([{ text: 'Nothing ran.', source: 'model', queries: [], urls: [] }]),
      { type: 'done' },
    ]);
    await send();
    const card = one('[data-chat-card="q1"]');
    expect(text(card)).toContain(EN.TEXT.chatCardRefused());
    expect(text(card)).toContain(REFUSED.kind === 'error' ? REFUSED.error.message : '');
    expect(client.posted).toEqual([expect.objectContaining({ call: 'q1', ok: false })]);

    // Five 3000-character solutions: the model reads the first two, the card shows all five.
    const long = 'x'.repeat(3000);
    engine.outcome = {
      kind: 'solutions',
      solutions: Array.from({ length: 5 }, () => ({ bindings: {}, display: { X: long } })),
    };
    client.script([
      { type: 'conversation', id: 'c-2' },
      { type: 'query', call: 'q2', goal: GOAL },
      answer([{ text: 'Long.', source: 'kb', queries: ['q2'], urls: [] }]),
      { type: 'done' },
    ]);
    await send('again');
    const partial = one('[data-chat-card="q2"]');
    expect(partial.querySelectorAll('.solutions li')).toHaveLength(5);
    expect(text(partial)).toContain(EN.TEXT.chatModelRead(2, 5));
  });

  it('V4 streams busy with its commentary, and Stop lands the turn cancelled', async () => {
    client.script(
      [
        { type: 'conversation', id: 'c-3' },
        { type: 'commentary', text: 'Thinking about it.' },
      ],
      'hold',
    );
    await send();
    expect(one('[data-chat-conversation]').getAttribute('aria-busy')).toBe('true');
    expect(text(one('[data-chat-status]'))).toBe(EN.TEXT.chatAnswering());
    expect(text(one('.commentary'))).toBe('Thinking about it.');
    expect(one<HTMLButtonElement>('[data-action="chat-send"]').disabled).toBe(true);
    const stop = one<HTMLButtonElement>('[data-action="chat-stop"]');
    expect(stop.disabled).toBe(false);
    stop.click();
    await settle();
    expect(one('[data-chat-conversation]').getAttribute('aria-busy')).toBe('false');
    expect(text(one('[data-chat-status]'))).toBe(EN.TEXT.chatCancelled());
    expect(target.querySelector('.commentary')).toBeNull();
    expect(text(one('[data-chat-ended]'))).toBe(EN.TEXT.chatTurnEnded());
  });

  const FAILURES: [string, ChatEvent[], TurnEnd, string][] = [
    ['network', [], 'network', EN.TEXT.chatNetwork()],
    ['server', [], 'server', EN.TEXT.chatServer()],
    ['protocol', [{ type: 'conversation', id: 'c' }], 'protocol', EN.TEXT.chatProtocol()],
    ...(['auth', 'busy', 'expired', 'timeout', 'interrupted'] as const).map(
      (reason): [string, ChatEvent[], TurnEnd, string] => [
        reason,
        [
          { type: 'conversation', id: 'c' },
          { type: 'error', reason, message: 'm' },
          { type: 'done' },
        ],
        'done',
        {
          auth: EN.TEXT.chatAuth(),
          busy: EN.TEXT.chatBusy(),
          expired: EN.TEXT.chatExpired(),
          timeout: EN.TEXT.chatTimeout(),
          interrupted: EN.TEXT.chatInterrupted(),
        }[reason],
      ],
    ),
    [
      'codex',
      [
        { type: 'conversation', id: 'c' },
        { type: 'error', reason: 'codex', message: 'model unavailable' },
        { type: 'done' },
      ],
      'done',
      EN.TEXT.chatCodex('model unavailable'),
    ],
  ];

  it.each(FAILURES)(
    'V4 a %s failure raises one alert naming it',
    async (_name, events, end, said) => {
      client.script(events, end);
      await send();
      const alerts = one('form[data-chat]').parentElement!.querySelectorAll('[data-chat-alert]');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.getAttribute('role')).toBe('alert');
      expect(text(alerts[0])).toBe(said);
      expect(target.querySelectorAll('[data-chat-segment]')).toHaveLength(0);
      expect(text(one('[data-chat-ended]'))).toBe(EN.TEXT.chatTurnEnded());
    },
  );

  it('V4 New conversation empties the transcript', async () => {
    client.script(ANSWERED);
    await send();
    expect(target.querySelectorAll('[data-chat-role]').length).toBeGreaterThan(0);
    one<HTMLButtonElement>('[data-action="chat-new"]').click();
    flushSync();
    expect(target.querySelectorAll('[data-chat-role]')).toHaveLength(0);
    expect(one<HTMLButtonElement>('[data-action="chat-new"]').disabled).toBe(true);
  });

  it('V5 renders the Japanese catalog', async () => {
    locale.set('ja');
    flushSync();
    client.script(ANSWERED);
    await send();
    expect(text(one('[data-action="chat-send"]'))).toBe(JA.LABELS.chatSend);
    expect(text(one('label[for="chat-message"]'))).toBe(JA.LABELS.chatLabel);
    expect(text(one('a.tag.kb'))).toBe(`${JA.LABELS.chatTagKb} q1`);
    expect(text(one('[data-chat-status]'))).toBe(JA.TEXT.chatAnswered());
  });

  it.each(['idle', 'answered', 'failed'] as const)(
    'V6 %s has zero axe violations and only the jsdom contrast limitation',
    async (state) => {
      if (state === 'answered') {
        client.script(ANSWERED);
        await send();
      } else if (state === 'failed') {
        client.script([], 'network');
        await send();
      }
      expect(one('form[data-chat]')).not.toBeNull();
      const scan = await axe.run(target);
      expect(scan.violations.map((violation) => violation.id)).toEqual([]);
      expect(
        scan.incomplete.map((item) => item.id).filter((id) => id !== 'color-contrast'),
      ).toEqual([]);
    },
  );
});
