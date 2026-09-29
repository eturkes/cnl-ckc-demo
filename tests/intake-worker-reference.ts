import type {
  BuiltRequest,
  JudgmentRequest,
  NoulQuestion,
  ChoiceQuestion,
} from '../src/intake/request.js';
import type { IntakeVocabulary } from '../src/intake/vocabulary.js';
import type { WorkerEnv } from '../worker/index.js';

import { referenceVocabulary } from './intake-backend-support.js';

const STOPWORDS = new Set(
  'a an the and or but if then than that this these those with for from to of in on at by as per via about into over under after before during since until while because so is are was were be been being am has have had having do does did will would should shall could can may might must i me my we our us you your he him his she her they them their it its who whom whose which what when where why how also now just only very some any more most less much many patient patients take takes taking took taken start starts started starting want wants wanted ask asks asked asking consider considers considered considering think thinking need needs needed use uses used using receive receives received receiving'.split(
    ' ',
  ),
);

const candidates = (description: string) => {
  const chunks: { text: string; start: number; end: number }[] = [];
  let overflow = 0;
  let start: number | undefined;
  let end = 0;
  const flush = () => {
    if (start !== undefined) {
      const text = description.slice(start, end);
      if (/[\p{L}\p{N}]/u.test(text)) chunks.push({ text, start, end });
    }
    start = undefined;
  };
  let segmentStart = 0;
  const segment = (segmentEnd: number) => {
    const text = description.slice(segmentStart, segmentEnd);
    for (const match of text.matchAll(/\S+/gu)) {
      const word = match[0];
      const absolute = segmentStart + match.index;
      if (STOPWORDS.has(word.toLowerCase().replace(/^['’]+|['’]+$/gu, ''))) {
        flush();
        continue;
      }
      if (word.length > 80) {
        flush();
        overflow += 1;
        continue;
      }
      if (start !== undefined && absolute + word.length - start > 80) flush();
      start ??= absolute;
      end = absolute + word.length;
    }
    flush();
  };
  for (let index = 0; index <= description.length; index += 1) {
    const char = description[index] ?? '';
    const decimal =
      char === '.' &&
      /[0-9]/u.test(description[index - 1] ?? '') &&
      /[0-9]/u.test(description[index + 1] ?? '');
    if (
      index === description.length ||
      /[,;:()[\]{}"!?\r\n]/u.test(char) ||
      (char === '.' && !decimal)
    ) {
      segment(index);
      segmentStart = index + 1;
    }
  }
  const seen = new Set<string>();
  const distinct = chunks.filter(({ text }) => {
    const key = text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    candidates: distinct.slice(0, 16),
    overflow: overflow + Math.max(0, distinct.length - 16),
  };
};

export const buildRequest = (
  vocabulary: IntakeVocabulary,
  description: string,
  options?: { hatch?: boolean },
): BuiltRequest => {
  const found = candidates(description);
  const questions: Record<string, NoulQuestion | ChoiceQuestion> = {};
  for (const condition of vocabulary.conditions)
    questions[condition.id] = { type: 'noul', instructions: condition.text };
  questions.pain = {
    type: 'choice',
    instructions: 'pain',
    criteria: Object.fromEntries(
      [
        'acute',
        'subacute',
        'chronic',
        'unstated',
        ...(options?.hatch === false ? [] : ['other']),
      ].map((option) => [option, option]),
    ),
  };
  for (const section of vocabulary.sections)
    questions[section.id] = { type: 'noul', instructions: section.heading };
  for (const [index, candidate] of found.candidates.entries())
    questions[`t${String(index + 1).padStart(2, '0')}`] = {
      type: 'noul',
      instructions: { candidate: candidate.text, vocabulary: vocabulary.vocabulary },
    };
  return { request: { model: 'jev-1.13.0', state: { description }, questions }, ...found };
};

const object = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('object required');
  return value as Record<string, unknown>;
};
const sameKeys = (left: object, right: object): boolean => {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key))
  );
};
const probability = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const validate = (raw: unknown, request: JudgmentRequest) => {
  const envelope = object(raw);
  if (envelope.model !== request.model) throw new Error('model');
  const answers = object(envelope.answers);
  if (!sameKeys(answers, request.questions)) throw new Error('answer ids');
  for (const [id, question] of Object.entries(request.questions)) {
    const answer = object(answers[id]);
    if (answer.type !== question.type) throw new Error(id);
    if (question.type === 'noul') {
      if (!probability(answer.noul)) throw new Error(id);
    } else {
      const values = object(answer.probabilities);
      if (!sameKeys(values, question.criteria)) throw new Error(id);
      const probabilities = Object.values(values);
      if (!probabilities.every(probability)) throw new Error(id);
      if (Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) > 1e-6)
        throw new Error(id);
      if (typeof answer.choice !== 'string' || values[answer.choice] !== Math.max(...probabilities))
        throw new Error(id);
      if (answer.confidence !== undefined && !probability(answer.confidence)) throw new Error(id);
    }
  }
  return { model: envelope.model, answers };
};

export const createHandler = (
  deps: { fetch?: typeof fetch; deadlineMs?: number; vocabulary?: IntakeVocabulary } = {},
) => ({
  async fetch(incoming: Request, env: WorkerEnv): Promise<Response> {
    const origin = incoming.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim());
    const headers: Record<string, string> = { Vary: 'Origin' };
    if (origin !== null && allowed.includes(origin))
      headers['Access-Control-Allow-Origin'] = origin;
    const respond = (status: number, body: unknown = { status }) => {
      if (status === 405) headers.Allow = 'POST, OPTIONS';
      if (status === 429) headers['Retry-After'] = '60';
      return status === 204
        ? new Response(null, { status, headers })
        : Response.json(body, { status, headers });
    };
    if (origin === null || !allowed.includes(origin)) return respond(403);
    if (new URL(incoming.url).pathname !== '/api/judgment') return respond(404);
    if (incoming.method === 'OPTIONS')
      return respond(incoming.headers.get('Access-Control-Request-Method') === 'POST' ? 204 : 405);
    if (incoming.method !== 'POST') return respond(405);
    if (Number(incoming.headers.get('Content-Length')) > 65_536) return respond(413);
    const body = await incoming.arrayBuffer();
    if (body.byteLength > 65_536) return respond(413);
    if (
      incoming.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !==
      'application/x-www-form-urlencoded'
    )
      return respond(415);
    const source = new TextDecoder().decode(body);
    try {
      decodeURIComponent(source.replaceAll('+', ' '));
    } catch {
      return respond(400);
    }
    if (source.split('&').some((pair) => !pair.includes('='))) return respond(400);
    const fields = new URLSearchParams(source);
    if (
      fields.getAll('description').length !== 1 ||
      fields.getAll('vocabulary').length !== 1 ||
      [...fields.keys()].some((key) => key !== 'description' && key !== 'vocabulary')
    )
      return respond(400);
    const description = fields.get('description');
    if (description === null || description.trim() === '' || description.length > 2000)
      return respond(400);
    const vocabulary = deps.vocabulary ?? referenceVocabulary();
    if (fields.get('vocabulary') !== vocabulary.digest) return respond(409);
    if (!env.TYPESAFE_API_KEY?.trim()) return respond(503);
    if (env.INTAKE_RATE_LIMITER === undefined) return respond(503);
    {
      try {
        if (
          !(
            await env.INTAKE_RATE_LIMITER.limit({
              key: incoming.headers.get('CF-Connecting-IP') ?? 'local',
            })
          ).success
        )
          return respond(429);
      } catch {
        return respond(503);
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<Response>((resolve) => {
      timer = setTimeout(() => resolve(respond(504)), deps.deadlineMs ?? 15_000);
    });
    const work = (async () => {
      try {
        const built = buildRequest(vocabulary, description);
        const remote = await (deps.fetch ?? fetch)('https://reference.invalid/judgment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.TYPESAFE_API_KEY}`,
          },
          body: JSON.stringify(built.request),
        });
        if (!remote.ok) return respond(remote.status === 429 || remote.status === 529 ? 503 : 502);
        return respond(200, validate(await remote.json(), built.request));
      } catch {
        return respond(502);
      }
    })();
    try {
      return await Promise.race([work, deadline]);
    } finally {
      clearTimeout(timer);
    }
  },
});
