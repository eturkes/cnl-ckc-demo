// Grade a provider response against the request it answers (`.agent/contracts/m5u16.md` J1).
//
// The provider SDK casts any 2xx body to its declared type without looking, so nothing it hands
// back is trusted until this refuses or accepts it. It grades against the request actually
// sent, never a fixed option set: the forced arm omits `other`, and a parser pinned to five
// options would refuse the very control that proves the hatch is load-bearing.

import type { BuiltRequest, PainOption } from './request.js';
import { termQuestionId } from './request.js';

export interface JudgmentResult {
  model: string;
  /** Condition id → the Noul's value. */
  conditions: Readonly<Record<string, number>>;
  /** Section id → the Noul's value. */
  sections: Readonly<Record<string, number>>;
  pain: { choice: PainOption; probabilities: Readonly<Record<string, number>> };
  /** One per candidate, in candidate order. */
  terms: readonly { text: string; start: number; end: number; value: number }[];
  overflow: number;
}

export class JudgmentError extends Error {
  readonly question: string | undefined;

  constructor(message: string, question?: string) {
    super(message);
    this.name = 'JudgmentError';
    this.question = question;
  }
}

const SUM_TOLERANCE = 1e-6;
// Question ids ARE the vocabulary ids (`buildRequest`), so the id shape routes each value.
const CONDITION_ID = /^c[0-9]+$/u;
const SECTION_ID = /^s[0-9]+$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const refuse = (message: string, question?: string): never => {
  throw new JudgmentError(message, question);
};

// The provider names a Noul's probability `noul` (measured on a live `jev-1.13.0` response).
const noulValue = (answer: Record<string, unknown>, id: string): number => {
  const value = answer.noul;
  return unit(value) ? value : refuse(`${id}: noul value is not a finite number in [0,1]`, id);
};

export const parseJudgment = (raw: unknown, built: BuiltRequest): JudgmentResult => {
  if (!isRecord(raw)) return refuse('response is not an object');
  const { request } = built;
  if (typeof raw.model !== 'string') return refuse('model is not a string');
  if (raw.model !== request.model) {
    refuse(`model ${raw.model} is not the requested ${request.model}`);
  }
  const answers = raw.answers;
  if (!isRecord(answers)) return refuse('answers is not an object');
  for (const id of Object.keys(request.questions)) {
    if (!Object.hasOwn(answers, id)) refuse(`${id}: answer missing`, id);
  }
  for (const id of Object.keys(answers)) {
    if (!Object.hasOwn(request.questions, id)) refuse(`${id}: answer to no question asked`, id);
  }

  const values = new Map<string, number>();
  let pain: JudgmentResult['pain'] | undefined;
  for (const [id, question] of Object.entries(request.questions)) {
    const answer = answers[id];
    if (!isRecord(answer)) return refuse(`${id}: answer is not an object`, id);
    if (answer.type !== question.type) {
      refuse(`${id}: answer type ${String(answer.type)} is not ${question.type}`, id);
    }
    if (question.type === 'noul') {
      values.set(id, noulValue(answer, id));
      continue;
    }
    const options = Object.keys(question.criteria);
    const probabilities = answer.probabilities;
    if (!isRecord(probabilities)) return refuse(`${id}: probabilities is not an object`, id);
    const keys = Object.keys(probabilities);
    if (
      keys.length !== options.length ||
      options.some((option) => !Object.hasOwn(probabilities, option))
    ) {
      refuse(`${id}: probabilities cover [${keys.join(', ')}], asked [${options.join(', ')}]`, id);
    }
    let sum = 0;
    let best = -1;
    for (const option of options) {
      const probability = probabilities[option];
      if (!unit(probability)) return refuse(`${id}: probability of ${option} is not in [0,1]`, id);
      sum += probability;
      best = Math.max(best, probability);
    }
    if (Math.abs(sum - 1) > SUM_TOLERANCE) refuse(`${id}: probabilities sum to ${String(sum)}`, id);
    const choice = answer.choice;
    if (typeof choice !== 'string' || !options.includes(choice)) {
      return refuse(`${id}: choice ${String(choice)} is not an option asked`, id);
    }
    if (probabilities[choice] !== best)
      refuse(`${id}: choice ${choice} is not a most probable option`, id);
    if ('confidence' in answer && !unit(answer.confidence)) {
      refuse(`${id}: confidence is not in [0,1]`, id);
    }
    pain = {
      choice: choice as PainOption,
      probabilities: Object.freeze(
        Object.fromEntries(options.map((option) => [option, probabilities[option] as number])),
      ),
    };
  }
  if (pain === undefined) return refuse('pain: no pain choice was asked', 'pain');

  const pick = (predicate: (id: string) => boolean): Readonly<Record<string, number>> =>
    Object.freeze(Object.fromEntries([...values].filter(([id]) => predicate(id))));
  return {
    model: raw.model,
    conditions: pick((id) => CONDITION_ID.test(id)),
    sections: pick((id) => SECTION_ID.test(id)),
    pain,
    terms: Object.freeze(
      built.candidates.map((candidate, index) =>
        Object.freeze({ ...candidate, value: values.get(termQuestionId(index)) as number }),
      ),
    ),
    overflow: built.overflow,
  };
};
