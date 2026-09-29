import { extractCandidates, type Candidate } from './chunker.js';

// Test-satisfiability surface only. Install via temporary src re-exports; production stays unread.
export type PainType = 'acute' | 'subacute' | 'chronic';
export type PainOption = PainType | 'unstated' | 'other';
export interface IntakeRule {
  id: string;
  document: string;
  sentence: number;
  trigger: { kind: 'condition'; condition: string } | { kind: 'section'; section: string };
  painSet: readonly PainType[];
  section: string;
  question: string & { readonly questionId: unique symbol };
  goal: string;
}
export interface IntakeVocabulary {
  vocabularyVersion: 1;
  digest: string;
  conditions: readonly { id: string; text: string }[];
  sections: readonly { id: string; heading: string; documents: readonly string[] }[];
  vocabulary: readonly string[];
  rules: readonly IntakeRule[];
}
export interface NoulQuestion {
  type: 'noul';
  instructions: unknown;
  criteria?: { true: unknown; false: unknown };
}
export interface ChoiceQuestion {
  type: 'choice';
  instructions: unknown;
  criteria: Record<string, unknown>;
}
export interface JudgmentRequest {
  model: string;
  state: { description: string };
  questions: Record<string, NoulQuestion | ChoiceQuestion>;
}
export interface BuiltRequest {
  request: JudgmentRequest;
  candidates: Candidate[];
  overflow: number;
}
export const JEV_MODEL = 'jev-1.13.0';
export const PAIN_OPTIONS = ['acute', 'subacute', 'chronic', 'unstated', 'other'] as const;

export function buildRequest(
  vocabulary: IntakeVocabulary,
  description: string,
  options?: { hatch?: boolean },
): BuiltRequest {
  const chunks = extractCandidates(description);
  const questions: JudgmentRequest['questions'] = {};
  for (const condition of vocabulary.conditions)
    questions[condition.id] = { type: 'noul', instructions: condition.text };
  questions.pain = {
    type: 'choice',
    instructions: 'Pain type',
    criteria: Object.fromEntries(
      PAIN_OPTIONS.filter((option) => options?.hatch !== false || option !== 'other').map(
        (option) => [option, option],
      ),
    ),
  };
  for (const section of vocabulary.sections)
    questions[section.id] = { type: 'noul', instructions: section.heading };
  chunks.candidates.forEach((candidate, index) => {
    questions[`t${String(index + 1).padStart(2, '0')}`] = {
      type: 'noul',
      instructions: [candidate.text, ...vocabulary.vocabulary],
    };
  });
  return { request: { model: JEV_MODEL, state: { description }, questions }, ...chunks };
}

export interface JudgmentResult {
  model: string;
  conditions: Readonly<Record<string, number>>;
  sections: Readonly<Record<string, number>>;
  pain: { choice: PainOption; probabilities: Readonly<Record<string, number>> };
  terms: readonly (Candidate & { value: number })[];
  overflow: number;
}
export class JudgmentError extends Error {
  constructor(
    message: string,
    readonly question: string | undefined = undefined,
  ) {
    super(message);
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function probability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
function fail(id: string): never {
  throw new JudgmentError(`invalid ${id}`, id);
}
export function parseJudgment(raw: unknown, built: BuiltRequest): JudgmentResult {
  if (!object(raw)) throw new JudgmentError('invalid envelope');
  if (raw.model !== built.request.model) throw new JudgmentError('invalid model');
  if (!object(raw.answers)) throw new JudgmentError('invalid answers');
  const expected = Object.keys(built.request.questions);
  for (const id of expected) if (!Object.hasOwn(raw.answers, id)) fail(id);
  for (const id of Object.keys(raw.answers)) if (!expected.includes(id)) fail(id);
  const conditions: Record<string, number> = {};
  const sections: Record<string, number> = {};
  const values: Record<string, number> = {};
  let pain: JudgmentResult['pain'] | undefined;
  for (const [id, question] of Object.entries(built.request.questions)) {
    const answer = raw.answers[id];
    if (!object(answer) || answer.type !== question.type) fail(id);
    if (question.type === 'noul') {
      if (!probability(answer.noul)) fail(id);
      if (id.startsWith('c')) conditions[id] = answer.noul;
      else if (id.startsWith('s')) sections[id] = answer.noul;
      else values[id] = answer.noul;
    } else {
      if (!object(answer.probabilities)) fail(id);
      const options = Object.keys(question.criteria);
      const actual = Object.keys(answer.probabilities);
      if (options.length !== actual.length || options.some((option) => !actual.includes(option)))
        fail(id);
      const probabilities: Record<string, number> = {};
      for (const option of options) {
        const value = answer.probabilities[option];
        if (!probability(value)) fail(id);
        probabilities[option] = value;
      }
      if (Math.abs(Object.values(probabilities).reduce((sum, value) => sum + value, 0) - 1) > 1e-6)
        fail(id);
      if (typeof answer.choice !== 'string' || !options.includes(answer.choice)) fail(id);
      if (probabilities[answer.choice] !== Math.max(...Object.values(probabilities))) fail(id);
      if (Object.hasOwn(answer, 'confidence') && !probability(answer.confidence)) fail(id);
      pain = { choice: answer.choice as PainOption, probabilities };
    }
  }
  if (pain === undefined) fail('pain');
  return {
    model: built.request.model,
    conditions,
    sections,
    pain,
    terms: built.candidates.map((candidate, index) => {
      const value = values[`t${String(index + 1).padStart(2, '0')}`];
      if (value === undefined) fail(`t${String(index + 1).padStart(2, '0')}`);
      return { ...candidate, value };
    }),
    overflow: built.overflow,
  };
}

export type JudgmentOutcome =
  | { kind: 'judged'; judgment: JudgmentResult }
  | { kind: 'unavailable'; reason: 'rate-limited' | 'stale' | 'server' | 'network' | 'invalid' };
export interface JudgmentClient {
  judge(description: string, signal?: AbortSignal): Promise<JudgmentOutcome>;
}
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}
export class ReplayJudgmentClient implements JudgmentClient {
  constructor(
    private readonly vocabulary: IntakeVocabulary,
    private readonly cases: readonly { description: string; response: unknown; hatch?: boolean }[],
  ) {}
  async judge(description: string, signal?: AbortSignal): Promise<JudgmentOutcome> {
    checkAbort(signal);
    await Promise.resolve();
    checkAbort(signal);
    const match = this.cases.find((item) => item.description === description);
    if (match === undefined) throw new Error('replay miss');
    return {
      kind: 'judged',
      judgment: parseJudgment(
        match.response,
        buildRequest(
          this.vocabulary,
          description,
          match.hatch === undefined ? {} : { hatch: match.hatch },
        ),
      ),
    };
  }
}
export class HttpJudgmentClient implements JudgmentClient {
  constructor(
    private readonly options: {
      vocabulary: IntakeVocabulary;
      endpoint?: string;
      fetch?: typeof fetch;
      timeoutMs?: number;
    },
  ) {}
  async judge(description: string, signal?: AbortSignal): Promise<JudgmentOutcome> {
    checkAbort(signal);
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, this.options.timeoutMs ?? 20_000);
    try {
      let reply: Response;
      try {
        reply = await (this.options.fetch ?? fetch)(this.options.endpoint ?? '/api/judgment', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ description, vocabulary: this.options.vocabulary.digest }),
          signal: controller.signal,
        });
      } catch {
        checkAbort(signal);
        return { kind: 'unavailable', reason: 'network' };
      }
      checkAbort(signal);
      if (reply.status !== 200)
        return {
          kind: 'unavailable',
          reason: reply.status === 429 ? 'rate-limited' : reply.status === 409 ? 'stale' : 'server',
        };
      try {
        const raw: unknown = await reply.json();
        checkAbort(signal);
        return {
          kind: 'judged',
          judgment: parseJudgment(raw, buildRequest(this.options.vocabulary, description)),
        };
      } catch {
        checkAbort(signal);
        return { kind: 'unavailable', reason: 'invalid' };
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
}
