import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpChatClient } from '../src/chat/client.js';
import { parseEvent } from '../src/chat/events.js';

type Event = NonNullable<ReturnType<typeof parseEvent>>;
const encoder = new TextEncoder();
const wire = (events: unknown[]): string =>
  events.map((event) => JSON.stringify(event)).join('\n') + '\n';
const conversation = { type: 'conversation', id: 'thread-1' } as const;
const done = { type: 'done' } as const;
const events = [conversation, { type: 'commentary', text: '痛み · café 🩺' }, done];

const response = (chunks: Uint8Array[], status = 200): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { status, headers: { 'Content-Type': 'application/x-ndjson' } },
  );
const mockFetch = (reply: Response) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply);
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
};
const formOf = (init: RequestInit | undefined): URLSearchParams => {
  const body = init?.body;
  expect(body instanceof URLSearchParams || typeof body === 'string').toBe(true);
  if (body instanceof URLSearchParams) return body;
  if (typeof body === 'string') return new URLSearchParams(body);
  throw new Error('expected form body');
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

afterEach(() => vi.unstubAllGlobals());

describe('chat HTTP wire', () => {
  it.each([undefined, 'thread-1'])(
    'D8 turn posts c3 form fields with conversation %s',
    async (id) => {
      const fetcher = mockFetch(response([encoder.encode(wire([conversation, done]))]));
      const abort = new AbortController();
      const seen: Event[] = [];
      const message = 'pain & nausea=増加 + 10%\nsecond line';
      const result = await new HttpChatClient().turn(
        message,
        id,
        (event) => {
          seen.push(event);
        },
        abort.signal,
      );
      expect(result).toBe('done');
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).toBe('/api/chat/turn');
      expect(init?.method).toBe('POST');
      expect(init?.signal).toBe(abort.signal);
      expect([...formOf(init)]).toEqual(
        id === undefined
          ? [['message', message]]
          : [
              ['message', message],
              ['conversation', id],
            ],
      );
      expect(seen).toEqual([conversation, done]);
    },
  );

  it.each([true, false])(
    'D8 result posts exact conversation, call, text and ok=%s as a form',
    async (ok) => {
      const fetcher = mockFetch(new Response(null, { status: 204 }));
      const text = "solutions\nAnswer = 'a+b&c'\n日本語";
      await new HttpChatClient().result('thread-2', 'q7', text, ok);
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).toBe('/api/chat/result');
      expect(init?.method).toBe('POST');
      expect(Object.fromEntries(formOf(init))).toEqual({
        conversation: 'thread-2',
        call: 'q7',
        text,
        ok: String(ok),
      });
      expect([...formOf(init)]).toHaveLength(4);
    },
  );

  it('D8 every byte split preserves event order and multibyte display text', async () => {
    const bytes = encoder.encode(wire(events));
    for (let split = 1; split < bytes.length; split += 1) {
      mockFetch(response([bytes.slice(0, split), bytes.slice(split)]));
      const seen: Event[] = [];
      expect(
        await new HttpChatClient().turn(
          'm',
          undefined,
          (event) => {
            seen.push(event);
          },
          new AbortController().signal,
        ),
        `split ${String(split)}`,
      ).toBe('done');
      expect(seen, `split ${String(split)}`).toEqual(events);
    }
  });

  it('D8 one-byte chunks and several lines in one chunk each deliver once', async () => {
    const bytes = encoder.encode(wire(events));
    for (const chunks of [[bytes], Array.from(bytes, (byte) => Uint8Array.of(byte))]) {
      mockFetch(response(chunks));
      const seen: Event[] = [];
      expect(
        await new HttpChatClient().turn(
          'm',
          undefined,
          (event) => {
            seen.push(event);
          },
          new AbortController().signal,
        ),
      ).toBe('done');
      expect(seen).toEqual(events);
    }
  });

  it('D8 awaits each event handler before handing over its successor', async () => {
    mockFetch(response([encoder.encode(wire(events))]));
    const gate = deferred();
    const started = deferred();
    const seen: Event[] = [];
    const pending = new HttpChatClient().turn(
      'm',
      undefined,
      async (event) => {
        seen.push(event);
        if (event.type === 'conversation') {
          started.resolve();
          await gate.promise;
        }
      },
      new AbortController().signal,
    );
    await started.promise;
    expect(seen).toEqual([conversation]);
    gate.resolve();
    expect(await pending).toBe('done');
    expect(seen).toEqual(events);
  });

  it.each(['', wire([conversation]), wire([conversation, { type: 'answer', text: '{}' }])])(
    'D8 EOF without done is protocol failure: %j',
    async (text) => {
      mockFetch(response([encoder.encode(text)]));
      expect(
        await new HttpChatClient().turn(
          'm',
          undefined,
          () => undefined,
          new AbortController().signal,
        ),
      ).toBe('protocol');
    },
  );

  it.each([
    'not-json',
    'null',
    '[]',
    '{"type":"alien"}',
    '{"type":"query","call":"q1"}',
    '{"type":"answer","text":4}',
  ])('D8 malformed event line fails protocol: %s', async (line) => {
    mockFetch(response([encoder.encode(wire([conversation]) + line + '\n' + wire([done]))]));
    const seen: Event[] = [];
    expect(
      await new HttpChatClient().turn(
        'm',
        undefined,
        (event) => {
          seen.push(event);
        },
        new AbortController().signal,
      ),
    ).toBe('protocol');
    expect(seen).toEqual([conversation]);
  });

  it.each([400, 403, 404, 500, 503])(
    'D8 HTTP %i is server failure, never a successful turn',
    async (status) => {
      const listener = vi.fn();
      mockFetch(response([encoder.encode(wire([conversation, done]))], status));
      expect(
        await new HttpChatClient().turn('m', undefined, listener, new AbortController().signal),
      ).toBe('server');
      expect(listener).not.toHaveBeenCalled();
    },
  );

  it('D8 a rejected fetch is network failure', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')));
    const listener = vi.fn();
    expect(
      await new HttpChatClient().turn('m', undefined, listener, new AbortController().signal),
    ).toBe('network');
    expect(listener).not.toHaveBeenCalled();
  });

  it('D8 abort between buffered lines delivers no further event', async () => {
    const abort = new AbortController();
    const fetcher = mockFetch(response([encoder.encode(wire(events))]));
    const seen: Event[] = [];
    await new HttpChatClient().turn(
      'm',
      undefined,
      (event) => {
        seen.push(event);
        abort.abort();
      },
      abort.signal,
    );
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(abort.signal);
    expect(seen).toEqual([conversation]);
  });

  it('D8 an already-aborted signal admits no event even from an immediate response', async () => {
    const abort = new AbortController();
    abort.abort();
    mockFetch(response([encoder.encode(wire(events))]));
    const listener = vi.fn();
    await new HttpChatClient().turn('m', undefined, listener, abort.signal);
    expect(listener).not.toHaveBeenCalled();
  });

  it('D8 abort ends a turn waiting for its next chunk', async () => {
    const abort = new AbortController();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const started = deferred();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation((_url, init) => {
        init?.signal?.addEventListener(
          'abort',
          () => stream.error(new DOMException('cancelled', 'AbortError')),
          { once: true },
        );
        return Promise.resolve(
          new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } }),
        );
      }),
    );
    const seen: Event[] = [];
    const pending = new HttpChatClient().turn(
      'm',
      undefined,
      (event) => {
        seen.push(event);
        started.resolve();
      },
      abort.signal,
    );
    stream.enqueue(encoder.encode(wire([conversation])));
    await started.promise;
    abort.abort();
    await pending;
    expect(seen).toEqual([conversation]);
  });
});
