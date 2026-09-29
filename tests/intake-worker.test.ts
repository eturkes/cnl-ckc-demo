import { describe, expect, it, vi } from 'vitest';

import type { JudgmentRequest } from '../src/intake/request.js';
import type { WorkerEnv } from '../worker/index.js';

import { referenceVocabulary } from './intake-backend-support.js';

const subject = () => import('../worker/index.js');
const requestBuilder = () => import('../src/intake/request.js');
const vocabulary = referenceVocabulary();
const ORIGIN = 'https://intake.example';
const KEY = 'u16-local-only-key';
const DESCRIPTION = 'Chronic back pain with an opioid therapy.';
const env = (): WorkerEnv => ({
  TYPESAFE_API_KEY: KEY,
  ALLOWED_ORIGINS: `${ORIGIN}, https://second.example`,
  INTAKE_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
});
const form = (description = DESCRIPTION, digest = vocabulary.digest): string =>
  new URLSearchParams({ description, vocabulary: digest }).toString();
const request = (
  options: {
    path?: string;
    method?: string;
    origin?: string | null;
    body?: string;
    contentType?: string;
    headers?: Record<string, string>;
  } = {},
): Request => {
  const method = options.method ?? 'POST';
  return new Request(`https://local.example${options.path ?? '/api/judgment'}`, {
    method,
    headers: {
      'Content-Type': options.contentType ?? 'application/x-www-form-urlencoded',
      ...(options.origin === null ? {} : { Origin: options.origin ?? ORIGIN }),
      'CF-Connecting-IP': '192.0.2.7',
      ...options.headers,
    },
    ...(['GET', 'HEAD'].includes(method) ? {} : { body: options.body ?? form() }),
  });
};

const validResponse = (sent: JudgmentRequest) => ({
  model: sent.model,
  answers: Object.fromEntries(
    Object.entries(sent.questions).map(([id, question]) => {
      if (question.type === 'noul') return [id, { type: 'noul', value: 0.75 }];
      const options = Object.keys(question.criteria);
      return [
        id,
        {
          type: 'choice',
          choice: options[0],
          probabilities: Object.fromEntries(
            options.map((option, index) => [option, index === 0 ? 1 : 0]),
          ),
        },
      ];
    }),
  ),
});
const upstream = (
  response: (sent: JudgmentRequest) => Response = (sent) => Response.json(validResponse(sent)),
) => {
  const sent: { request: Request; body: JudgmentRequest }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const outbound = new Request(input, init);
    const body = (await outbound.clone().json()) as JudgmentRequest;
    sent.push({ request: outbound, body });
    return response(body);
  });
  return { fetch, sent };
};
const checkResponse = async (
  response: Response,
  status: number,
  origin: string | null = ORIGIN,
): Promise<void> => {
  expect(response.status).toBe(status);
  expect([...response.headers.values()].join('\n')).not.toContain(KEY);
  expect(await response.clone().text()).not.toContain(KEY);
  if (origin !== null) {
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(
      response.headers
        .get('Vary')
        ?.split(',')
        .map((value) => value.trim().toLowerCase()),
    ).toContain('origin');
  }
};

describe('intake Worker contract', () => {
  it.each(['/', '/api', '/api/judgment/', '/api/judgment/extra'])(
    'W1 path %s returns 404 without upstream',
    async (path) => {
      const { createHandler } = await subject();
      const remote = upstream();
      await checkResponse(
        await createHandler({ ...remote, vocabulary }).fetch(request({ path }), env()),
        404,
      );
      expect(remote.fetch).not.toHaveBeenCalled();
    },
  );

  it.each(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE'])(
    'W1 method %s returns 405 without upstream',
    async (method) => {
      const { createHandler } = await subject();
      const remote = upstream();
      await checkResponse(
        await createHandler({ ...remote, vocabulary }).fetch(request({ method }), env()),
        405,
      );
      expect(remote.fetch).not.toHaveBeenCalled();
    },
  );

  it('W1 OPTIONS preflight succeeds without a key or upstream request', async () => {
    const { createHandler } = await subject();
    const remote = upstream();
    const response = await createHandler({ ...remote, vocabulary }).fetch(
      request({
        method: 'OPTIONS',
        headers: { 'Access-Control-Request-Method': 'POST' },
      }),
      { ALLOWED_ORIGINS: ORIGIN },
    );
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    await checkResponse(response, response.status);
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it.each([
    'https://different.example',
    `${ORIGIN}.different.example`,
    'null',
    'http://intake.example',
  ])('W2 outside origin %s gets 403 and no upstream call', async (origin) => {
    const { createHandler } = await subject();
    const remote = upstream();
    const response = await createHandler({ ...remote, vocabulary }).fetch(
      request({ origin }),
      env(),
    );
    await checkResponse(response, 403, null);
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe(origin);
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it('W2 each allowed origin gets its exact CORS value on success and on a refusal', async () => {
    const { createHandler } = await subject();
    for (const origin of [ORIGIN, 'https://second.example']) {
      const remote = upstream();
      const handler = createHandler({ ...remote, vocabulary });
      await checkResponse(await handler.fetch(request({ origin }), env()), 200, origin);
      await checkResponse(
        await handler.fetch(request({ origin, body: form('') }), env()),
        400,
        origin,
      );
    }
  });

  it.each([
    { name: 'empty', body: form('') },
    { name: 'whitespace-only', body: form(' \t\n ') },
    { name: '2001 characters', body: form('a'.repeat(2001)) },
    {
      name: 'missing description',
      body: new URLSearchParams({ vocabulary: vocabulary.digest }).toString(),
    },
  ])('W3 $name description gets 400 without upstream', async ({ body }) => {
    const { createHandler } = await subject();
    const remote = upstream();
    await checkResponse(
      await createHandler({ ...remote, vocabulary }).fetch(request({ body }), env()),
      400,
    );
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it.each([1, 2000])('W3 a %s-character description is within bounds', async (length) => {
    const { createHandler } = await subject();
    const remote = upstream();
    await checkResponse(
      await createHandler({ ...remote, vocabulary }).fetch(
        request({ body: form('a'.repeat(length)) }),
        env(),
      ),
      200,
    );
    expect(remote.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['application/json', 'text/plain', 'multipart/form-data; boundary=missing'])(
    'W3 non-form or unparsable %s gets 400 without upstream',
    async (contentType) => {
      const { createHandler } = await subject();
      const remote = upstream();
      await checkResponse(
        await createHandler({ ...remote, vocabulary }).fetch(request({ contentType }), env()),
        400,
      );
      expect(remote.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, '', '0'.repeat(64), '1'])(
    'W3 missing or stale digest %s gets 409 without upstream',
    async (digest) => {
      const { createHandler } = await subject();
      const remote = upstream();
      const body =
        digest === undefined
          ? new URLSearchParams({ description: DESCRIPTION }).toString()
          : form(DESCRIPTION, digest);
      await checkResponse(
        await createHandler({ ...remote, vocabulary }).fetch(request({ body }), env()),
        409,
      );
      expect(remote.fetch).not.toHaveBeenCalled();
    },
  );

  it('W3 body bytes, not Content-Length or UTF-16 length, enforce the 64 KiB maximum', async () => {
    const { createHandler } = await subject();
    const prefix = `${form()}&padding=`;
    const exact = prefix + 'x'.repeat(65_536 - new TextEncoder().encode(prefix).length);
    const remote = upstream();
    const handler = createHandler({ ...remote, vocabulary });
    const boundary = await handler.fetch(request({ body: exact }), env());
    expect(boundary.status).not.toBe(413);
    for (const body of [exact + 'x', prefix + '😀'.repeat(16_384)]) {
      expect(new TextEncoder().encode(body).length).toBeGreaterThan(65_536);
      remote.fetch.mockClear();
      await checkResponse(
        await handler.fetch(request({ body, headers: { 'Content-Length': '1' } }), env()),
        413,
      );
      expect(remote.fetch).not.toHaveBeenCalled();
    }
  });

  it('W4 rate-limit refusal returns 429 before upstream', async () => {
    const { createHandler } = await subject();
    const remote = upstream();
    const bindings = env();
    const limit = vi.fn().mockResolvedValue({ success: false });
    bindings.INTAKE_RATE_LIMITER = { limit };
    await checkResponse(
      await createHandler({ ...remote, vocabulary }).fetch(request(), bindings),
      429,
    );
    expect(limit).toHaveBeenCalledTimes(1);
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it('W4 binding failure returns 503 before upstream', async () => {
    const { createHandler } = await subject();
    const remote = upstream();
    const bindings = env();
    bindings.INTAKE_RATE_LIMITER = { limit: vi.fn().mockRejectedValue(new Error(KEY)) };
    await checkResponse(
      await createHandler({ ...remote, vocabulary }).fetch(request(), bindings),
      503,
    );
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, ''])('W4 missing key %s returns 503 before upstream', async (key) => {
    const { createHandler } = await subject();
    const remote = upstream();
    const bindings = env();
    if (key === undefined) delete bindings.TYPESAFE_API_KEY;
    else bindings.TYPESAFE_API_KEY = key;
    await checkResponse(
      await createHandler({ ...remote, vocabulary }).fetch(request(), bindings),
      503,
    );
    expect(remote.fetch).not.toHaveBeenCalled();
  });

  it('W5 one upstream body equals buildRequest and only validated model plus answers return', async () => {
    const { createHandler } = await subject();
    const { buildRequest } = await requestBuilder();
    const remote = upstream((sent) =>
      Response.json({ ...validResponse(sent), usage: { total_tokens: 1 }, ignored: KEY }),
    );
    const handler = createHandler({ ...remote, vocabulary });
    const response = await handler.fetch(request(), env());
    await checkResponse(response, 200);
    expect(remote.sent).toHaveLength(1);
    expect(remote.sent[0]?.body).toEqual(buildRequest(vocabulary, DESCRIPTION).request);
    expect(await response.json()).toEqual(
      validResponse(buildRequest(vocabulary, DESCRIPTION).request),
    );
  });

  it('W5 caller fields cannot replace model, questions, state or the other hatch', async () => {
    const { createHandler } = await subject();
    const { buildRequest } = await requestBuilder();
    const remote = upstream();
    const body =
      form() + '&model=caller-model&questions=caller-question&state=caller-state&hatch=false';
    const response = await createHandler({ ...remote, vocabulary }).fetch(request({ body }), env());
    expect([200, 400]).toContain(response.status);
    await checkResponse(response, response.status);
    if (response.status === 400) expect(remote.fetch).not.toHaveBeenCalled();
    else {
      expect(remote.sent).toHaveLength(1);
      expect(remote.sent[0]?.body).toEqual(buildRequest(vocabulary, DESCRIPTION).request);
    }
  });

  it.each([400, 401, 403, 404, 408, 500, 502, 503])(
    'W6 upstream %s maps to 502 without reflecting upstream text',
    async (status) => {
      const { createHandler } = await subject();
      const remote = upstream(() => new Response(KEY, { status }));
      await checkResponse(
        await createHandler({ ...remote, deadlineMs: 100, vocabulary }).fetch(request(), env()),
        502,
      );
    },
  );

  it.each([429, 529])('W6 upstream %s maps to 503', async (status) => {
    const { createHandler } = await subject();
    const remote = upstream(() => new Response(KEY, { status }));
    await checkResponse(
      await createHandler({ ...remote, deadlineMs: 100, vocabulary }).fetch(request(), env()),
      503,
    );
  });

  it.each([
    { name: 'non-JSON', response: () => new Response(KEY) },
    {
      name: 'wrong model',
      response: (sent: JudgmentRequest) => Response.json({ ...validResponse(sent), model: KEY }),
    },
    {
      name: 'missing answers',
      response: (sent: JudgmentRequest) => Response.json({ model: sent.model }),
    },
    {
      name: 'extra answer',
      response: (sent: JudgmentRequest) => {
        const raw = validResponse(sent);
        return Response.json({
          ...raw,
          answers: { ...raw.answers, extra: { type: 'noul', value: 0.5 } },
        });
      },
    },
    {
      name: 'bad Noul',
      response: (sent: JudgmentRequest) => {
        const raw = validResponse(sent);
        return Response.json({
          ...raw,
          answers: { ...raw.answers, c01: { type: 'noul', value: 1.01 } },
        });
      },
    },
    {
      name: 'wrong answer type',
      response: (sent: JudgmentRequest) => {
        const raw = validResponse(sent);
        return Response.json({
          ...raw,
          answers: { ...raw.answers, pain: { type: 'noul', value: 0.5 } },
        });
      },
    },
  ])('W6 parser refusal $name maps to 502', async ({ response: makeResponse }) => {
    const { createHandler } = await subject();
    const remote = upstream(makeResponse);
    await checkResponse(
      await createHandler({ ...remote, vocabulary }).fetch(request(), env()),
      502,
    );
  });

  it('W6 a rejected fetch becomes 502 without exposing its error or key', async () => {
    const { createHandler } = await subject();
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(KEY));
    await checkResponse(await createHandler({ fetch, vocabulary }).fetch(request(), env()), 502);
  });

  it.each(['fetch', 'body'] as const)(
    'W6 total deadline bounds a stalled upstream %s',
    async (phase) => {
      const { createHandler } = await subject();
      const fetch = vi.fn<typeof globalThis.fetch>(() =>
        phase === 'fetch'
          ? new Promise<Response>(() => {})
          : Promise.resolve(new Response(new ReadableStream<Uint8Array>({ start() {} }))),
      );
      const started = performance.now();
      const response = await createHandler({ fetch, vocabulary, deadlineMs: 25 }).fetch(
        request(),
        env(),
      );
      await checkResponse(response, 504);
      expect(performance.now() - started).toBeLessThan(1_000);
    },
    2_000,
  );
});
