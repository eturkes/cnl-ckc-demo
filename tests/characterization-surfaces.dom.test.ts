// gi characterization: accepted DOM seams; graph and new date/scope/supersession fields excluded.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App.svelte';
import { ChatController } from '../src/chat/ChatController.svelte.js';
import type { ChatClient, TurnEnd } from '../src/chat/client.js';
import type { ChatEvent } from '../src/chat/events.js';
import AnswerPanel from '../src/demo/AnswerPanel.svelte';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import { synthesizeAnswer, type AnswerRow } from '../src/demo/describe.js';
import type { QueryOutcome } from '../src/engine/client.js';
import { EN } from '../src/i18n/en.js';
import { JA } from '../src/i18n/ja.js';
import { locale } from '../src/i18n/locale.svelte.js';
import CorpusBrowser from '../src/provenance/CorpusBrowser.svelte';
import type { EvidenceDocument } from '../src/provenance/model.js';
import { QUESTION_CATALOG, QUESTION_IDS } from '../src/questions/catalog.js';
import type { DocumentMarks } from '../src/questions/marks.js';
import type { AnswerResult } from '../src/questions/service.js';

import { answerSolution, marksSolution } from './support/marks-terms.js';

const ID = QUESTION_IDS[0];
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
const RECORDED: ChatEvent[] = [
  { type: 'conversation', id: 'characterization-chat' },
  { type: 'query', call: 'q1', goal: GOAL },
  {
    type: 'search',
    query: 'cdc 2022',
    opened: undefined,
    results: [
      { url: URL_A, title: 'CDC Clinical Practice Guideline', domain: 'cdc.gov', snippet: 's' },
    ],
  },
  {
    type: 'answer',
    text: JSON.stringify({
      segments: [
        {
          text: 'Maximize nonopioid therapy for acute pain.',
          source: 'kb',
          queries: ['q1'],
          urls: [],
        },
        { text: 'The guideline appeared in 2022.', source: 'web', queries: [], urls: [URL_A] },
        { text: 'Exercise therapy is one option.', source: 'model', queries: [], urls: [] },
        { text: 'A claim with no record.', source: 'kb', queries: ['q9'], urls: [] },
      ],
    }),
  },
  { type: 'done' },
];
class RecordedClient implements ChatClient {
  async turn(
    _message: string,
    _conversation: string | undefined,
    event: (value: ChatEvent) => void | Promise<void>,
  ): Promise<TurnEnd> {
    for (const value of RECORDED) await event(value);
    return 'done';
  }
  result(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
class ViewEngine implements DemoEngine {
  asks = 0;
  readonly goals: string[] = [];
  boot() {
    return Promise.resolve({
      kind: 'booted' as const,
      contract: { schemaVersion: 1, documents: 492 },
    });
  }
  ask(): Promise<AnswerResult> {
    this.asks += 1;
    return Promise.reject(new Error('selection alone must not run'));
  }
  runGoal(goal: string): Promise<QueryOutcome> {
    this.goals.push(goal);
    return Promise.resolve(SOLVED);
  }
  dispose(): void {}
}
const input = () => {
  const document = 'cdc2022-opioid-rec01';
  const rows: AnswerRow[] = [
    {
      document,
      structured: true,
      cells: [],
      label: 'Recommendation 1',
      items: [
        'Clinicians should maximize nonopioid therapy for acute pain.',
        'Clinicians should consider opioid therapy when benefits outweigh risks.',
      ],
      sourcePassage: 'Exact source passage.',
    },
  ];
  const marks: DocumentMarks = {
    document,
    grades: [
      { dimension: 'strength', value: 'strong', label: 'category-a-recommendation' },
      { dimension: 'evidence', value: 'low', label: 'evidence-type-4-recommendation' },
    ],
    groups: [
      [
        {
          sentence: 2,
          qualifiers: [{ kind: 'manner', word: 'carefully' }],
          preferences: [{ preferred: 'nonopioid-therapy', alternative: 'opioid-therapy' }],
          times: [{ kind: 'order', relation: 'before', anchor: 'opioid-prescription' }],
        },
      ],
      [{ sentence: 3, qualifiers: [], preferences: [], times: [] }],
    ],
  };
  return {
    rows,
    points: synthesizeAnswer(rows),
    solutions: [answerSolution(document)],
    busy: false,
    marks: {
      kind: 'settled' as const,
      id: ID,
      goal: `clinical_marks('${ID}',Source,Marks)`,
      outcome: { kind: 'solutions' as const, solutions: [marksSolution(marks)] },
    },
    selectedIndex: 0,
    question: QUESTION_CATALOG[ID].question,
    summary: 'One knowledge-base answer.',
    serialized: 'observed-canonical-answer',
  };
};
let target: HTMLElement;
let app: Record<string, unknown> | undefined;
let demo: DemoController | undefined;
let chat: ChatController | undefined;
let previousTheme: string | null;
const text = (node: Node | null | undefined): string =>
  node?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
const one = <T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = target,
): T => {
  const nodes = root.querySelectorAll<T>(selector);
  expect(nodes.length, selector).toBe(1);
  return nodes[0]!;
};
const settle = async (): Promise<void> => {
  await Promise.resolve();
  flushSync();
};
const mountApp = (engine: ViewEngine, withChat = false): void => {
  demo = new DemoController(engine);
  if (withChat) chat = new ChatController({ client: new RecordedClient(), host: demo });
  app = mount(App, {
    target,
    props: { controller: demo, ...(chat === undefined ? {} : { chat }) },
  });
  flushSync();
};
const facts = (): string[][][] =>
  [...target.querySelectorAll('.answer-point')].map((point) =>
    [...point.querySelectorAll('dl.facts > div')].map((pair) => [
      text(pair.querySelector('dt')),
      text(pair.querySelector('dd')),
    ]),
  );

beforeEach(() => {
  locale.set('en');
  localStorage.clear();
  previousTheme = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', 'light');
  target = document.body.appendChild(document.createElement('div'));
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('unexpected network request'))),
  );
});
afterEach(async () => {
  if (app !== undefined) await unmount(app);
  app = undefined;
  chat?.dispose();
  demo?.dispose();
  chat = undefined;
  demo = undefined;
  target.remove();
  locale.set('en');
  localStorage.clear();
  if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', previousTheme);
  vi.unstubAllGlobals();
});

describe('accepted answer panel', () => {
  it('C4 keeps statements, facts, disclosures and source citations in both locales', () => {
    const selected = vi.fn();
    app = mount(AnswerPanel, { target, props: { ...input(), onSelect: selected } });
    flushSync();
    const structure = () => ({
      statements: [...target.querySelectorAll('.answer-point')].map((point) => ({
        tag: point.tagName,
        text: text(point.childNodes[0]),
        pairs: [...point.querySelectorAll('dl.facts > div')].map((pair) =>
          [...pair.children].map((child) => child.tagName),
        ),
      })),
      facts: facts(),
      disclosures: [
        ...target.querySelectorAll<HTMLDetailsElement>(
          'details.explanation, details.canonical, details.mark-goals',
        ),
      ].map((details) => ({
        classes: [...details.classList].filter((name) => !name.startsWith('svelte-')),
        open: details.open,
        summary: text(details.querySelector(':scope > summary')),
      })),
      passage: text(one('.source-card blockquote')),
      canonical: text(one('details.canonical')),
      marksGoal: text(one('code.mark-goal')),
      citations: [...target.querySelectorAll('.citations button')].map((button) => ({
        text: text(button),
        name: button.getAttribute('aria-label'),
      })),
    });
    expect(structure()).toMatchSnapshot('English');
    const values = facts().map((row) => row.map(([, value]) => value));
    locale.set('ja');
    flushSync();
    expect(structure()).toMatchSnapshot('Japanese');
    expect(facts().map((row) => row.map(([, value]) => value))).toEqual(values);
    const citation = target.querySelector<HTMLButtonElement>('.citations button');
    if (citation === null) throw new Error('source citation missing');
    citation.click();
    flushSync();
    expect(selected).toHaveBeenCalledWith(0);
  });
});

describe('accepted recorded chat', () => {
  it('C5 keeps four source labels, a KB card and the web source', async () => {
    const engine = new ViewEngine();
    mountApp(engine, true);
    await settle();
    const field = one<HTMLTextAreaElement>('#chat-message');
    field.value = 'What should I try before opioids?';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    one('form[data-chat]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(text(one('[data-chat-status]'))).toBe(EN.TEXT.chatAnswered()));
    expect(engine.goals).toEqual([GOAL]);
    const card = one('[data-chat-card="q1"]');
    expect({
      segments: [...target.querySelectorAll('[data-chat-segment]')].map((segment) => ({
        source: segment.getAttribute('data-chat-segment'),
        tag: text(segment.querySelector('.tag')),
        text: text(segment),
      })),
      goal: text(one('.goal', card)),
      solutions: [...card.querySelectorAll('.solutions li')].map(text),
      source: [...one('[data-chat-sources]').querySelectorAll('a')].map((link) => ({
        text: text(link),
        href: link.href,
        target: link.target,
        rel: link.rel,
      })),
    }).toMatchSnapshot();
    // Opening the disclosure is observable without claiming jsdom performs scrolling.
    const tag = one<HTMLAnchorElement>('a.tag.kb');
    expect(tag.getAttribute('href')).toBe(`#${card.id}`);
    const web = one<HTMLAnchorElement>('a.tag.web');
    expect(target.querySelector(web.getAttribute('href') ?? '')?.querySelector('a')?.href).toBe(
      URL_A,
    );
    Reflect.set(card, 'scrollIntoView', vi.fn());
    tag.click();
    flushSync();
    expect(one<HTMLDetailsElement>('details[data-chat-cards]').open).toBe(true);
  });
});

const corpusIndex = JSON.parse(
  readFileSync(resolve('kb/generated/provenance/corpus-index.json'), 'utf8'),
) as { schemaVersion: number; documents: { id: string }[] };
const evidence = JSON.parse(
  readFileSync(resolve('kb/generated/provenance/documents/cdc2022-opioid-rec01.json'), 'utf8'),
) as EvidenceDocument;

describe('accepted corpus browser', () => {
  it('C6 lists all 492 documents and opens the unchanged recommendation passage', async () => {
    const fetcher = vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(url.includes('corpus-index') ? corpusIndex : evidence), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    app = mount(CorpusBrowser, { target });
    flushSync();
    expect(fetcher).not.toHaveBeenCalled();
    one('[data-action="browse-corpus"]').click();
    await vi.waitFor(() => expect(target.querySelectorAll('.documents li code')).toHaveLength(492));
    expect(one('[data-documents]').getAttribute('data-documents')).toBe('492');
    const row = [...target.querySelectorAll('.documents li')].find(
      (element) => text(element.querySelector('code')) === evidence.id,
    );
    expect(row).toBeDefined();
    one('[data-action="open-document"]', row).click();
    await vi.waitFor(() =>
      expect(target.querySelector('.corpus-document blockquote')?.textContent).toBe(
        evidence.source.text,
      ),
    );
    expect({
      count: target.querySelectorAll('.documents li code').length,
      shown: text(one('.shown')),
      passage: createHash('sha256')
        .update(one('.corpus-document blockquote').textContent ?? '')
        .digest('hex'),
      id: evidence.id,
      open: one('[data-action="open-document"]', row).getAttribute('aria-expanded'),
    }).toMatchSnapshot();
    expect(fetcher.mock.calls.map(([url]) => String(url))).toHaveLength(2);
  });
});

describe('accepted URL and page toggles', () => {
  it.each(QUESTION_IDS)('C8 ?q=%s selects without executing', async (id) => {
    history.replaceState(null, '', `/?q=${id}`);
    const engine = new ViewEngine();
    mountApp(engine);
    await settle();
    expect(demo?.selected).toBe(id);
    expect(text(one('[role="combobox"]'))).toBe(QUESTION_CATALOG[id].question);
    expect(engine.asks).toBe(0);
    expect(new URL(location.href).searchParams.get('q')).toBe(id);
  });

  it('C8 an unknown deep link is removed in place', async () => {
    history.replaceState(null, '', '/?q=not-a-catalog-question');
    const entries = history.length;
    const engine = new ViewEngine();
    mountApp(engine);
    await settle();
    expect(demo?.selected).toBeNull();
    expect(new URL(location.href).searchParams.get('q')).toBeNull();
    expect(history.length).toBe(entries);
    expect(engine.asks).toBe(0);
  });

  it('C8 language and theme toggles round-trip without changing selection or running', async () => {
    history.replaceState(null, '', `/?q=${ID}`);
    const engine = new ViewEngine();
    mountApp(engine);
    await settle();
    const language = one<HTMLButtonElement>('[data-action="language-switch"]');
    language.click();
    flushSync();
    expect(locale.current).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.title).toBe(JA.DESCRIPTIONS.documentTitle);
    expect(localStorage.getItem('cnl-ckc-lang')).toBe('ja');
    const theme = [...target.querySelectorAll<HTMLButtonElement>('header button')].find(
      (button) => button !== language,
    );
    if (theme === undefined) throw new Error('theme toggle missing');
    theme.click();
    flushSync();
    expect(localStorage.getItem('cnl-ckc-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    theme.click();
    language.click();
    flushSync();
    expect(locale.current).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('cnl-ckc-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(text(one('[role="combobox"]'))).toBe(QUESTION_CATALOG[ID].question);
    expect(demo?.selected).toBe(ID);
    expect(engine.asks).toBe(0);
  });
});
