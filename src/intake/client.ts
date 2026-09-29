// The judgment seam (`.agent/contracts/m5u16.md` C1). The browser never holds the provider key
// or its SDK: `HttpJudgmentClient` posts to the same-origin local Worker, and
// `ReplayJudgmentClient` answers from recorded responses so the whole path runs offline.
//
// Both REBUILD the request locally and grade the response against it: a response whose model,
// question ids, answer types or values do not fit that request is refused, and gap terms come
// from the locally cut candidates alone, never from provider text. A transport failure is always
// `unavailable`, never a no-match: the two must stay tellable apart.

import { JudgmentError, parseJudgment, type JudgmentResult } from './judgment.js';
import { buildRequest } from './request.js';
import type { IntakeVocabulary } from './vocabulary.js';

export type JudgmentOutcome =
  | { kind: 'judged'; judgment: JudgmentResult }
  | { kind: 'unavailable'; reason: 'rate-limited' | 'stale' | 'server' | 'network' | 'invalid' };

export interface JudgmentClient {
  judge(description: string, signal?: AbortSignal): Promise<JudgmentOutcome>;
}

const abortError = (): DOMException => new DOMException('The judgment was aborted.', 'AbortError');

const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted === true) throw abortError();
};

const graded = (
  vocabulary: IntakeVocabulary,
  description: string,
  body: unknown,
  hatch = true,
): JudgmentOutcome => {
  try {
    const judgment = parseJudgment(body, buildRequest(vocabulary, description, { hatch }));
    return { kind: 'judged', judgment };
  } catch (error) {
    if (error instanceof JudgmentError) return { kind: 'unavailable', reason: 'invalid' };
    throw error;
  }
};

export class HttpJudgmentClient implements JudgmentClient {
  readonly #vocabulary: IntakeVocabulary;
  readonly #endpoint: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: {
    vocabulary: IntakeVocabulary;
    endpoint?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
  }) {
    this.#vocabulary = options.vocabulary;
    this.#endpoint = options.endpoint ?? '/api/judgment';
    // Bound late so a test's replaced global and a browser's own `fetch` both resolve at call time.
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs ?? 20_000;
  }

  async judge(description: string, signal?: AbortSignal): Promise<JudgmentOutcome> {
    throwIfAborted(signal);
    const timeout = new AbortController();
    const timer = setTimeout(() => {
      timeout.abort();
    }, this.#timeoutMs);
    const onAbort = (): void => {
      timeout.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      let response: Response;
      try {
        response = await this.#fetch(this.#endpoint, {
          method: 'POST',
          // A form body, not JSON: `src/` serializes nothing through JSON (`kb:asset-check`).
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ description, vocabulary: this.#vocabulary.digest }),
          signal: timeout.signal,
        });
      } catch {
        throwIfAborted(signal);
        return { kind: 'unavailable', reason: 'network' };
      }
      // An abort that lands while the response is in hand still rejects: it is never a status.
      throwIfAborted(signal);
      if (response.status === 429) return { kind: 'unavailable', reason: 'rate-limited' };
      if (response.status === 409) return { kind: 'unavailable', reason: 'stale' };
      if (response.status !== 200) return { kind: 'unavailable', reason: 'server' };
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throwIfAborted(signal);
        return timeout.signal.aborted
          ? { kind: 'unavailable', reason: 'network' }
          : { kind: 'unavailable', reason: 'invalid' };
      }
      throwIfAborted(signal);
      return graded(this.#vocabulary, description, body);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

export class ReplayJudgmentClient implements JudgmentClient {
  readonly #vocabulary: IntakeVocabulary;
  readonly #cases: ReadonlyMap<string, { response: unknown; hatch: boolean }>;

  constructor(
    vocabulary: IntakeVocabulary,
    cases: readonly { description: string; response: unknown; hatch?: boolean }[],
  ) {
    this.#vocabulary = vocabulary;
    const map = new Map<string, { response: unknown; hatch: boolean }>();
    for (const { description, response, hatch } of cases) {
      if (map.has(description)) throw new Error('replay holds two responses for one description');
      map.set(description, { response, hatch: hatch ?? true });
    }
    this.#cases = map;
  }

  async judge(description: string, signal?: AbortSignal): Promise<JudgmentOutcome> {
    throwIfAborted(signal);
    const recorded = this.#cases.get(description);
    if (recorded === undefined) throw new Error('no recorded judgment for this exact description');
    // Keeps the production async boundary, so an abort landing mid-call is honoured here too.
    await Promise.resolve();
    throwIfAborted(signal);
    return graded(
      this.#vocabulary,
      description,
      structuredClone(recorded.response),
      recorded.hatch,
    );
  }
}
