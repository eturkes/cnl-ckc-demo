<script lang="ts">
  // The chat intake (`.agent/contracts/chat-c5.md`): the message form, its two live regions and
  // the conversation. Both live regions are mounted from the first render for the reason
  // `RunControls` gives (ARIA22), and the conversation stays mounted so `aria-busy` is readable
  // mid-turn. Every answer part carries its source tag; a KB tag links to the card holding the
  // goal and the engine's own solutions, a Web tag to the page this turn's search returned.

  import type { QueryOutcome } from '../engine/client.js';
  import { messages } from '../i18n/locale.svelte.js';

  import type {
    AssistantMessage,
    ChatController,
    ChatFailure,
    ChatMessage,
    KbCard,
  } from './ChatController.svelte.js';
  import type { ResolvedSegment } from './provenance.js';

  interface Props {
    chat: ChatController;
  }

  let { chat }: Props = $props();

  /** The bridge's own bound on one message (`server/chat.mjs` `MESSAGE_MAX`). */
  const MAX_MESSAGE = 4000;

  const uid = $props.id();
  const hintId = `${uid}-hint`;
  const t = $derived(messages.current);
  let draft = $state('');

  const transcript = $derived(chat.messages);
  const busy = $derived(chat.busy);
  const canSend = $derived(draft.trim() !== '' && !busy);
  const last = $derived(transcript.at(-1));

  const status = $derived.by((): string => {
    const { TEXT } = t;
    if (last?.role !== 'assistant') return '';
    switch (last.status) {
      case 'streaming':
        return TEXT.chatAnswering();
      case 'answered':
        return TEXT.chatAnswered();
      case 'cancelled':
        return TEXT.chatCancelled();
      case 'failed':
        return '';
    }
  });

  const failureText = (reason: ChatFailure, message: string): string => {
    const { TEXT } = t;
    switch (reason) {
      case 'auth':
        return TEXT.chatAuth();
      case 'network':
        return TEXT.chatNetwork();
      case 'server':
        return TEXT.chatServer();
      case 'protocol':
        return TEXT.chatProtocol();
      case 'busy':
        return TEXT.chatBusy();
      case 'expired':
        return TEXT.chatExpired();
      case 'codex':
        return TEXT.chatCodex(message);
      case 'timeout':
        return TEXT.chatTimeout();
      case 'interrupted':
        return TEXT.chatInterrupted();
    }
  };

  const alert = $derived(
    last?.role === 'assistant' && last.failure !== undefined
      ? failureText(last.failure.reason, last.failure.message)
      : '',
  );

  interface ViewTag {
    kind: 'kb' | 'web' | 'model' | 'unverified';
    text: string;
    /** The element a KB or Web tag points at; `''` for a tag that points nowhere. */
    target: string;
  }

  interface ViewSegment {
    label: string;
    tags: ViewTag[];
    text: string;
    /** The source an unverified part claimed; `''` otherwise. */
    claimed: string;
  }

  interface ViewCard {
    id: string;
    call: string;
    goal: string;
    summary: string;
    /** The engine's own message for a refused or failed goal; `''` otherwise. */
    message: string;
    lines: string[];
    /** Says how much the model read when it read less than the card shows; `''` otherwise. */
    read: string;
  }

  interface ViewSource {
    id: string;
    url: string;
    text: string;
    domain: string;
  }

  /**
   * One turn, flattened in the script: ESLint types a `.svelte` import as `any`, so a member
   * access on a value narrowed inside markup reads as unsafe (`.claude/rules/toolchain.md`).
   */
  interface ViewTurn {
    user: boolean;
    state: string;
    text: string;
    commentary: string;
    /** Says the turn ended without an answer; `''` for a turn that answered or still streams. */
    ended: string;
    segments: ViewSegment[];
    cards: ViewCard[];
    cardsLabel: string;
    sources: ViewSource[];
    sourcesLabel: string;
  }

  const cardId = (call: string): string => `${uid}-card-${call}`;
  const sourceId = (turn: number, index: number): string =>
    `${uid}-turn-${String(turn)}-source-${String(index + 1)}`;

  /** The URLs the turn's `web` parts cite, numbered in first-citation order. */
  const sources = (message: AssistantMessage, turn: number): ViewSource[] => {
    const known: Record<string, { title: string; domain: string }> = {};
    for (const search of message.searches) {
      for (const { url, title, domain } of search.results) known[url] = { title, domain };
      if (search.opened !== undefined) known[search.opened] ??= { title: '', domain: '' };
    }
    const cited: string[] = [];
    for (const segment of message.segments) {
      if (segment.label !== 'web') continue;
      for (const url of segment.urls) if (!cited.includes(url)) cited.push(url);
    }
    return cited.map((url, index) => {
      const found = known[url];
      return {
        id: sourceId(turn, index),
        url,
        text: found === undefined || found.title === '' ? url : found.title,
        domain: found?.domain ?? '',
      };
    });
  };

  const segmentView = (segment: ResolvedSegment, cited: readonly ViewSource[]): ViewSegment => {
    const { LABELS, TEXT } = t;
    const names = { kb: LABELS.chatTagKb, web: LABELS.chatTagWeb, model: LABELS.chatTagModel };
    let tags: ViewTag[];
    switch (segment.label) {
      case 'kb':
        tags = segment.queries.map((call) => ({
          kind: 'kb',
          text: `${LABELS.chatTagKb} ${call}`,
          target: cardId(call),
        }));
        break;
      case 'web':
        tags = segment.urls.map((url) => {
          const at = cited.findIndex((source) => source.url === url);
          return {
            kind: 'web',
            text: `${LABELS.chatTagWeb} ${String(at + 1)}`,
            target: cited[at]?.id ?? '',
          };
        });
        break;
      case 'model':
        tags = [{ kind: 'model', text: LABELS.chatTagModel, target: '' }];
        break;
      case 'unverified':
        tags = [{ kind: 'unverified', text: LABELS.chatTagUnverified, target: '' }];
        break;
    }
    return {
      label: segment.label,
      tags,
      text: segment.text,
      claimed: segment.label === 'unverified' ? TEXT.chatClaimed(names[segment.source]) : '',
    };
  };

  const summary = (card: KbCard): string => {
    const { TEXT } = t;
    const result: QueryOutcome | undefined = card.outcome;
    if (result === undefined) return TEXT.chatCardRunning();
    switch (result.kind) {
      case 'solutions':
        return TEXT.chatCardSolutions(result.solutions.length);
      case 'failure':
        return TEXT.chatCardFailure();
      case 'limit':
        return TEXT.chatCardLimit(result.limit, result.solutions.length);
      case 'cancelled':
        return TEXT.chatCardCancelled();
      case 'error':
        return result.error.code === 'guard'
          ? TEXT.chatCardRefused()
          : TEXT.chatCardError(result.error.code);
    }
  };

  const cardView = (card: KbCard): ViewCard => {
    const result = card.outcome;
    const solutions = result !== undefined && 'solutions' in result ? result.solutions : [];
    const read = card.result;
    return {
      id: cardId(card.call),
      call: card.call,
      goal: card.goal,
      summary: summary(card),
      message: result?.kind === 'error' ? result.error.message : '',
      // Each binding's canonical display text, as the engine rendered it.
      lines: solutions.map((solution) => {
        const pairs = Object.entries(solution.display).map(([name, value]) => `${name} = ${value}`);
        return pairs.length === 0 ? 'true' : pairs.join(', ');
      }),
      read:
        read !== undefined && read.shown < read.total
          ? t.TEXT.chatModelRead(read.shown, read.total)
          : '',
    };
  };

  const turnView = (message: ChatMessage, turn: number): ViewTurn => {
    if (message.role === 'user') {
      return {
        user: true,
        state: '',
        text: message.text,
        commentary: '',
        ended: '',
        segments: [],
        cards: [],
        cardsLabel: '',
        sources: [],
        sourcesLabel: '',
      };
    }
    const cited = sources(message, turn);
    return {
      user: false,
      state: message.status,
      text: '',
      commentary: message.status === 'streaming' ? (message.commentary.at(-1) ?? '') : '',
      ended:
        (message.status === 'failed' || message.status === 'cancelled') &&
        message.segments.length === 0
          ? t.TEXT.chatTurnEnded()
          : '',
      segments: message.segments.map((segment) => segmentView(segment, cited)),
      cards: message.cards.map(cardView),
      cardsLabel: t.TEXT.chatQueries(message.cards.length),
      sources: cited,
      sourcesLabel: t.TEXT.chatSources(cited.length),
    };
  };

  const turns = $derived(transcript.map(turnView));

  /** A tag's target can sit inside a closed disclosure, which fragment navigation does not open. */
  const show = (event: MouseEvent, id: string): void => {
    const target = document.getElementById(id);
    if (target === null) return;
    event.preventDefault();
    const disclosure = target.closest('details');
    if (disclosure !== null) disclosure.open = true;
    target.scrollIntoView({ block: 'nearest' });
  };

  const send = (event: SubmitEvent): void => {
    event.preventDefault();
    if (!canSend) return;
    const text = draft;
    draft = '';
    void chat.submit(text);
  };
</script>

<form class="chat" data-chat onsubmit={send}>
  <label for="chat-message">{t.LABELS.chatLabel}</label>
  <p class="hint" id={hintId}>
    {t.INSTRUCTIONS.chatAsk}
    {t.INSTRUCTIONS.chatPrivacy}
    {t.DESCRIPTIONS.chatDisclosure}
  </p>
  <textarea
    id="chat-message"
    rows="3"
    maxlength={MAX_MESSAGE}
    aria-describedby={hintId}
    bind:value={draft}></textarea>
  <div class="chat-controls">
    <button class="send" type="submit" data-action="chat-send" disabled={!canSend}
      >{t.LABELS.chatSend}</button
    >
    <button
      class="stop"
      type="button"
      data-action="chat-stop"
      disabled={!busy}
      onclick={() => {
        chat.cancel();
      }}>{t.LABELS.chatStop}</button
    >
    <button
      class="new"
      type="button"
      data-action="chat-new"
      disabled={transcript.length === 0}
      onclick={() => {
        chat.reset();
      }}>{t.LABELS.chatNew}</button
    >
  </div>
</form>

<p class="status" role="status" data-chat-status>{status}</p>
<p class="alert" role="alert" data-chat-alert>{alert}</p>

<section
  class="conversation"
  class:filled={transcript.length > 0}
  data-chat-conversation
  aria-busy={busy}
  aria-label={t.LABELS.chatTranscript}
>
  {#if transcript.length > 0}
    <p class="legend">{t.DESCRIPTIONS.chatLegend} {t.DESCRIPTIONS.chatLimit}</p>
  {/if}
  <ol class="turns">
    {#each turns as view, index (index)}
      <li
        class="turn"
        class:user={view.user}
        data-chat-role={view.user ? 'user' : 'assistant'}
        data-chat-state={view.user ? undefined : view.state}
      >
        <p class="who">{view.user ? t.LABELS.chatYou : t.LABELS.chatAssistant}</p>
        {#if view.user}
          <p class="text">{view.text}</p>
        {/if}
        {#if view.commentary !== ''}
          <p class="commentary">{view.commentary}</p>
        {/if}
        {#if view.ended !== ''}
          <p class="meta" data-chat-ended>{view.ended}</p>
        {/if}
        {#each view.segments as segment, part (part)}
          <p class="segment" data-chat-segment={segment.label}>
            {#each segment.tags as tag, at (at)}
              {#if tag.target === ''}
                <span class="tag {tag.kind}">{tag.text}</span>
              {:else}
                <a
                  class="tag {tag.kind}"
                  href={`#${tag.target}`}
                  onclick={(event) => {
                    show(event, tag.target);
                  }}>{tag.text}</a
                >
              {/if}
            {/each}
            <span class="segment-text">{segment.text}</span>
            {#if segment.claimed !== ''}
              <span class="claimed">{segment.claimed}</span>
            {/if}
          </p>
        {/each}

        {#if view.cards.length > 0}
          <details class="cards" data-chat-cards>
            <summary>{view.cardsLabel}</summary>
            <p class="meta">{t.DESCRIPTIONS.chatCardNote}</p>
            <ol>
              {#each view.cards as card (card.call)}
                <li id={card.id} class="card" data-chat-card={card.call}>
                  <p class="card-head">
                    <span class="call">{card.call}</span>
                    <span class="meta">{card.summary}</span>
                  </p>
                  <p class="meta">{t.LABELS.chatGoal}</p>
                  <pre class="goal"><code>{card.goal}</code></pre>
                  {#if card.message !== ''}
                    <p class="meta">{card.message}</p>
                  {/if}
                  {#if card.lines.length > 0}
                    <ol class="solutions">
                      {#each card.lines as line, row (row)}
                        <li><code>{line}</code></li>
                      {/each}
                    </ol>
                  {/if}
                  {#if card.read !== ''}
                    <p class="meta">{card.read}</p>
                  {/if}
                </li>
              {/each}
            </ol>
          </details>
        {/if}

        {#if view.sources.length > 0}
          <div class="sources" data-chat-sources>
            <p class="meta">{view.sourcesLabel}</p>
            <ol>
              {#each view.sources as source (source.url)}
                <li id={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">{source.text}</a>
                  {#if source.domain !== ''}
                    <span class="meta">{source.domain}</span>
                  {/if}
                </li>
              {/each}
            </ol>
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</section>

<p class="or-pick">{t.INSTRUCTIONS.chatOrPick}</p>

<style>
  .chat {
    display: grid;
    gap: 0.5rem;
  }

  label {
    margin: 0;
    color: var(--text);
    font-size: 0.86rem;
    font-weight: 650;
  }

  .hint,
  .meta,
  .legend,
  .or-pick,
  .commentary,
  .claimed {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 4.5rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-family: var(--font-ui);
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
  }

  textarea:focus-visible,
  button:focus-visible,
  a:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .chat-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  button {
    min-height: 2.5rem;
    padding: 0.45rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    font-weight: 650;
    cursor: pointer;
  }

  button.send {
    border-color: var(--action);
    background: var(--action);
    color: var(--action-text);
  }

  button:disabled {
    border-color: var(--text-muted);
    background: transparent;
    color: var(--text-muted);
    opacity: 0.55;
    cursor: not-allowed;
  }

  .status,
  .alert {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .status {
    color: var(--text-muted);
  }

  .alert:not(:empty) {
    border-left: 3px solid var(--warn);
    padding-left: 0.6rem;
    color: var(--text);
  }

  .conversation.filled {
    margin-top: 0.75rem;
    border: 1px solid var(--border);
    padding: 1rem;
    background: var(--surface-sunken);
    color: var(--text);
    font-size: 0.86rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .turns {
    display: grid;
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend {
    margin-bottom: 0.75rem;
  }

  .who {
    margin: 0 0 0.25rem;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .text,
  .segment {
    margin: 0 0 0.45rem;
  }

  .commentary {
    font-style: italic;
  }

  /* A tag is a label, not a control style: the source names itself in text, never by colour alone. */
  .tag {
    display: inline-block;
    margin-right: 0.35rem;
    border: 1px solid var(--text-muted);
    border-radius: 0.2rem;
    padding: 0 0.35rem;
    color: var(--text);
    font-family: var(--font-code);
    font-size: 0.72rem;
    font-weight: 650;
    line-height: 1.5;
    text-decoration: none;
    white-space: nowrap;
  }

  .tag.kb,
  .tag.web {
    border-color: var(--action);
  }

  .tag.unverified {
    border-color: var(--warn);
  }

  .claimed {
    display: inline;
    margin-left: 0.35rem;
  }

  .cards {
    margin-top: 0.5rem;
  }

  .cards summary {
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 650;
  }

  .cards ol,
  .sources ol {
    display: grid;
    gap: 0.6rem;
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
  }

  .card-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
  }

  .call {
    font-family: var(--font-code);
    font-weight: 650;
  }

  .goal {
    margin: 0.2rem 0 0.4rem;
    overflow-x: auto;
    font-family: var(--font-code);
    font-size: 0.78rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .solutions {
    margin: 0;
    font-family: var(--font-code);
    font-size: 0.78rem;
  }

  /* The user-agent sheet gives `code` its own `monospace`, which inheritance cannot override. */
  .goal code,
  .solutions code {
    font-family: var(--font-code);
    overflow-wrap: anywhere;
  }

  .sources {
    margin-top: 0.5rem;
  }

  .sources a {
    color: var(--text);
  }

  .or-pick {
    margin: 1.25rem 0 0.75rem;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
</style>
