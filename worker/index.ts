// Local judgment proxy (`.agent/contracts/m5u16.md` W1–W7): the one place the provider key and
// SDK live. It asks ONE fixed request — `buildRequest` over the bundled vocabulary and the
// caller's description — so a caller chooses no question, grades the provider's answer before
// returning it, and never echoes the key. `wrangler dev` serves it; Vite proxies
// `/api/judgment` here, so the browser stays same-origin.

import {
  APIError,
  APIUserAbortError,
  TypeSafeClient,
  type SystemOneRequest,
} from '@typesafe-ai/sdk';

import { JudgmentError, parseJudgment } from '../src/intake/judgment.js';
import { buildRequest } from '../src/intake/request.js';
import { INTAKE_VOCABULARY, type IntakeVocabulary } from '../src/intake/vocabulary.js';

export interface WorkerEnv {
  TYPESAFE_API_KEY?: string;
  /** Comma-separated exact origins, e.g. `http://localhost:5173`. */
  ALLOWED_ORIGINS?: string;
  INTAKE_RATE_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
}

const ROUTE = '/api/judgment';
const FORM = 'application/x-www-form-urlencoded';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_DESCRIPTION = 2000;
const DEADLINE_MS = 15_000;

class TooLarge extends Error {}
class BadForm extends Error {}
class Expired extends Error {}

const allowedOrigins = (env: WorkerEnv): Set<string> =>
  new Set(
    (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
  );

const reply = (
  status: number,
  origin: string,
  body: unknown,
  extra: Record<string, string> = {},
): Response =>
  Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });

/** Refused before any origin is trusted, so it carries no CORS grant. */
const forbidden = (): Response =>
  Response.json(
    { error: 'forbidden' },
    { status: 403, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );

const readBounded = async (request: Request): Promise<string> => {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^[0-9]+$/u.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    throw new TooLarge();
  }
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new TooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new BadForm();
  }
};

/**
 * Strict form decoding: `URLSearchParams` accepts malformed escapes and repeated keys without
 * complaint, which would let an unreadable body reach the provider as some other text.
 */
const readForm = (body: string): { description: string; vocabulary: string } => {
  const fields = new Map<string, string>();
  for (const pair of body === '' ? [] : body.split('&')) {
    const at = pair.indexOf('=');
    if (at < 0) throw new BadForm();
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(pair.slice(0, at).replaceAll('+', ' '));
      value = decodeURIComponent(pair.slice(at + 1).replaceAll('+', ' '));
    } catch {
      throw new BadForm();
    }
    if ((key !== 'description' && key !== 'vocabulary') || fields.has(key)) throw new BadForm();
    fields.set(key, value);
  }
  const description = fields.get('description');
  const vocabulary = fields.get('vocabulary');
  if (description === undefined || vocabulary === undefined) throw new BadForm();
  return { description, vocabulary };
};

export const createHandler = (
  deps: { fetch?: typeof fetch; deadlineMs?: number; vocabulary?: IntakeVocabulary } = {},
): { fetch(request: Request, env: WorkerEnv): Promise<Response> } => {
  const vocabulary = deps.vocabulary ?? INTAKE_VOCABULARY;
  const deadlineMs = deps.deadlineMs ?? DEADLINE_MS;
  return {
    async fetch(request, env) {
      const origin = request.headers.get('origin');
      if (origin === null || !allowedOrigins(env).has(origin)) return forbidden();
      if (new URL(request.url).pathname !== ROUTE)
        return reply(404, origin, { error: 'not_found' });
      if (request.method === 'OPTIONS') {
        if (request.headers.get('access-control-request-method') !== 'POST') {
          return reply(405, origin, { error: 'method_not_allowed' }, { Allow: 'POST, OPTIONS' });
        }
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '600',
            'Cache-Control': 'no-store',
            Vary: 'Origin',
          },
        });
      }
      if (request.method !== 'POST') {
        return reply(405, origin, { error: 'method_not_allowed' }, { Allow: 'POST, OPTIONS' });
      }
      const media = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
      if (media !== FORM) return reply(415, origin, { error: 'unsupported_media_type' });

      let form: { description: string; vocabulary: string };
      try {
        form = readForm(await readBounded(request));
      } catch (error) {
        if (error instanceof TooLarge) return reply(413, origin, { error: 'payload_too_large' });
        return reply(400, origin, { error: 'invalid_request' });
      }
      const { description } = form;
      if (description.trim() === '' || description.length > MAX_DESCRIPTION) {
        return reply(400, origin, { error: 'invalid_request' });
      }
      if (form.vocabulary !== vocabulary.digest)
        return reply(409, origin, { error: 'stale_vocabulary' });

      const key = env.TYPESAFE_API_KEY;
      if (key === undefined || key.trim() === '')
        return reply(503, origin, { error: 'intake_unavailable' });
      const limiter = env.INTAKE_RATE_LIMITER;
      let allowed: boolean;
      try {
        if (limiter === undefined) throw new Error('no rate limiter bound');
        // One bucket: the limit caps spend on the key, and the local proxy has one caller.
        ({ success: allowed } = await limiter.limit({ key: 'intake' }));
      } catch {
        return reply(503, origin, { error: 'intake_unavailable' });
      }
      if (!allowed) return reply(429, origin, { error: 'rate_limited' }, { 'Retry-After': '60' });

      const built = buildRequest(vocabulary, description);
      const deadline = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      // Raced, not only signalled: a fetch that ignores its signal would otherwise outlive it.
      const expired = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          deadline.abort();
          reject(new Expired());
        }, deadlineMs);
      });
      let raw: unknown;
      try {
        const client = new TypeSafeClient({
          apiKey: key,
          // Descriptions are patient text; the SDK logs request bodies at debug level.
          logLevel: 'off',
          // No silent retry: each upstream status maps to one reply, and the browser offers Retry.
          retry: { maxRetries: 0 },
          // Past the deadline, so the deadline alone decides a slow call (504, never 502).
          timeout: deadlineMs + 1_000,
          ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
        });
        raw = await Promise.race([
          client.systemOne(built.request as unknown as SystemOneRequest, {
            signal: deadline.signal,
          }),
          expired,
        ]);
      } catch (error) {
        if (deadline.signal.aborted || error instanceof APIUserAbortError) {
          return reply(504, origin, { error: 'intake_unavailable' });
        }
        if (error instanceof APIError && (error.status === 429 || error.status === 529)) {
          return reply(503, origin, { error: 'intake_unavailable' }, { 'Retry-After': '5' });
        }
        return reply(502, origin, { error: 'intake_unavailable' });
      } finally {
        clearTimeout(timer);
      }
      try {
        parseJudgment(raw, built);
      } catch (error) {
        if (error instanceof JudgmentError)
          return reply(502, origin, { error: 'intake_unavailable' });
        throw error;
      }
      const { model, answers } = raw as { model: string; answers: unknown };
      return reply(200, origin, { model, answers });
    },
  };
};

export default createHandler();
