import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpJudgmentClient, ReplayJudgmentClient } from '../src/intake/client.js';
import { parseJudgment } from '../src/intake/judgment.js';
import { buildRequest } from '../src/intake/request.js';
import { response, vocabulary } from './intake-oracle/fixtures.js';

const TEXT = '痛み & 2.5 mg + no insomnia?';
const vocab = vocabulary();
const built = () => buildRequest(vocab, TEXT);
const ok = () => Response.json(response(built(), 'acute'));

function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      if (settle === undefined) throw new Error('uninitialized deferred');
      settle(value);
    },
  };
}

function hangingFetch() {
  return vi.fn<typeof fetch>().mockImplementation(
    (_, init) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted fetch', 'AbortError')),
          { once: true },
        );
      }),
  );
}

async function aborted(promise: Promise<unknown>): Promise<void> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(DOMException);
  expect((error as DOMException).name).toBe('AbortError');
}

function formBody(body: BodyInit | null | undefined): URLSearchParams {
  if (typeof body !== 'string' && !(body instanceof URLSearchParams)) {
    throw new Error('expected a form-encoded request body');
  }
  return new URLSearchParams(body);
}

afterEach(() => vi.useRealTimers());

describe('C1 HTTP judgment client', () => {
  it('posts only form-encoded description and digest to the same-origin default; parses locally', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok());
    const result = await new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(TEXT);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0];
    if (call === undefined) throw new Error('missing fetch call');
    const [url, init] = call;
    expect(url).toBe('/api/judgment');
    expect(init?.method?.toUpperCase()).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toMatch(/^application\/x-www-form-urlencoded(?:;|$)/iu);
    expect(typeof init?.body === 'string' || init?.body instanceof URLSearchParams).toBe(true);
    const form = formBody(init?.body);
    expect([...form.entries()].sort()).toEqual([
      ['description', TEXT],
      ['vocabulary', vocab.digest],
    ]);
    expect(result).toEqual({
      kind: 'judged',
      judgment: parseJudgment(response(built(), 'acute'), built()),
    });
  });

  it('uses the supplied endpoint and vocabulary digest', async () => {
    const other = { ...vocab, digest: 'e'.repeat(64) };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok());
    await new HttpJudgmentClient({
      vocabulary: other,
      endpoint: '/local/custom',
      fetch: fetcher,
    }).judge(TEXT);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/local/custom');
    expect(formBody(fetcher.mock.calls[0]?.[1]?.body).get('vocabulary')).toBe(other.digest);
  });

  it.each([
    [429, 'rate-limited'],
    [409, 'stale'],
    [201, 'server'],
    [204, 'server'],
    [299, 'server'],
    [301, 'server'],
    [400, 'server'],
    [403, 'server'],
    [404, 'server'],
    [500, 'server'],
    [502, 'server'],
  ] as const)('maps status %s to unavailable/%s, never no-match', async (status, reason) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    await expect(
      new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(TEXT),
    ).resolves.toEqual({ kind: 'unavailable', reason });
  });

  it.each([
    new TypeError('offline'),
    new Error('transport failed'),
    new DOMException('not a user cancel', 'AbortError'),
  ])('maps fetch rejection %s without caller cancellation to network', async (error) => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error);
    await expect(
      new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(TEXT),
    ).resolves.toEqual({ kind: 'unavailable', reason: 'network' });
  });

  it('maps a 200 non-JSON body to invalid', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>not JSON</html>'));
    await expect(
      new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(TEXT),
    ).resolves.toEqual({ kind: 'unavailable', reason: 'invalid' });
  });

  it('rebuilds the exact request locally and refuses an extra fabricated term answer', async () => {
    const raw = response(built(), 'acute');
    raw.answers.t99 = { type: 'noul', noul: 1 };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(raw));
    await expect(
      new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(TEXT),
    ).resolves.toEqual({ kind: 'unavailable', reason: 'invalid' });
  });

  it.each([25, 20_000])('maps its abort-free %s ms timeout to network', async (timeoutMs) => {
    vi.useFakeTimers();
    const fetcher = hangingFetch();
    const options = timeoutMs === 20_000 ? {} : { timeoutMs };
    const pending = new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher, ...options }).judge(
      TEXT,
    );
    let settled = false;
    const checked = expect(pending).resolves.toEqual({ kind: 'unavailable', reason: 'network' });
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(timeoutMs - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await checked;
  });

  it('rejects an already-aborted call with DOMException AbortError, including custom abort reasons', async () => {
    const controller = new AbortController();
    controller.abort('superseded');
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ok());
    await aborted(
      new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(TEXT, controller.signal),
    );
  });

  it('rejects a caller abort during fetch rather than resolving unavailable', async () => {
    const controller = new AbortController();
    const fetcher = hangingFetch();
    const pending = new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(
      TEXT,
      controller.signal,
    );
    const checked = aborted(pending);
    controller.abort('superseded');
    await checked;
  });

  it('checks caller abort after the response-body async boundary', async () => {
    const controller = new AbortController();
    const body = deferred<unknown>();
    const bodyRead = deferred<void>();
    const reply = ok();
    vi.spyOn(reply, 'json').mockImplementation(() => {
      bodyRead.resolve();
      return body.promise;
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply);
    const pending = new HttpJudgmentClient({ vocabulary: vocab, fetch: fetcher }).judge(
      TEXT,
      controller.signal,
    );
    const checked = aborted(pending);
    await bodyRead.promise;
    controller.abort();
    body.resolve(response(built(), 'acute'));
    await checked;
  });
});

describe('C1 exact replay judgment client', () => {
  it('parses the exact recorded response and supports the forced hatch arm', async () => {
    const forced = buildRequest(vocab, TEXT, { hatch: false });
    const raw = response(forced, 'chronic');
    const client = new ReplayJudgmentClient(vocab, [
      { description: TEXT, response: raw, hatch: false },
    ]);
    await expect(client.judge(TEXT)).resolves.toEqual({
      kind: 'judged',
      judgment: parseJudgment(raw, forced),
    });
  });

  it.each([`${TEXT} `, TEXT.toUpperCase(), 'another description', ''])(
    'throws on exact-description replay miss %j',
    async (text) => {
      const client = new ReplayJudgmentClient(vocab, [
        { description: TEXT, response: response(built()) },
      ]);
      await expect(client.judge(text)).rejects.toThrow();
    },
  );

  it('honours cancellation before the async boundary', async () => {
    const controller = new AbortController();
    controller.abort('superseded');
    const client = new ReplayJudgmentClient(vocab, [
      { description: TEXT, response: response(built()) },
    ]);
    await aborted(client.judge(TEXT, controller.signal));
  });

  it('honours cancellation immediately after calling judge', async () => {
    const controller = new AbortController();
    const client = new ReplayJudgmentClient(vocab, [
      { description: TEXT, response: response(built()) },
    ]);
    const pending = client.judge(TEXT, controller.signal);
    const checked = aborted(pending);
    controller.abort();
    await checked;
  });
});
