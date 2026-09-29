// The ONE judgment request a description becomes (`.agent/contracts/m5u16.md` Q1).
//
// Built from the generated vocabulary and the user's own words alone, in both the browser (to
// grade the proxy's answer) and the local Worker (to send it), so neither side can ask a question
// the other did not expect. Only the description enters `state`: extra state is a documented
// accuracy hazard for this model, so the vocabulary rides in each question's instructions.

import { extractCandidates, type Candidate } from './chunker.js';
import type { IntakeVocabulary } from './vocabulary.js';

export const JEV_MODEL = 'jev-1.13.0';
export const PAIN_OPTIONS = ['acute', 'subacute', 'chronic', 'unstated', 'other'] as const;
export type PainOption = (typeof PAIN_OPTIONS)[number];

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

// CDC 2022's own duration bands; `other` is the hatch that refuses an off-topic description.
const PAIN_CRITERIA: Record<PainOption, string> = {
  acute:
    'Acute pain: sudden onset, usually lasting under 1 month, e.g. an injury, surgery or dental work.',
  subacute: 'Subacute pain: pain that has lasted 1 to 3 months.',
  chronic: 'Chronic pain: pain lasting more than 3 months or past normal tissue healing.',
  unstated:
    'The description concerns opioid prescribing, pain care or opioid use disorder, but it does not indicate how long the pain has lasted.',
  other: 'The description is not about opioid prescribing, managing pain, or opioid use disorder.',
};

const termId = (index: number): string => `t${String(index + 1).padStart(2, '0')}`;

export const buildRequest = (
  vocabulary: IntakeVocabulary,
  description: string,
  options: { hatch?: boolean } = {},
): BuiltRequest => {
  const { candidates, overflow } = extractCandidates(description);
  const questions: Record<string, NoulQuestion | ChoiceQuestion> = {};
  for (const { id, text } of vocabulary.conditions) {
    questions[id] = {
      type: 'noul',
      instructions: {
        task: 'Does `description` state or clearly entail every element of `situation`?',
        situation: text,
      },
      criteria: {
        true: 'Every element of the situation is stated or clearly entailed by the description.',
        false: 'At least one element is absent, contradicted, or only possible.',
      },
    };
  }
  const pain =
    (options.hatch ?? true) ? PAIN_OPTIONS : PAIN_OPTIONS.filter((option) => option !== 'other');
  questions.pain = {
    type: 'choice',
    instructions: {
      task: 'Which kind of pain does `description` concern?',
    },
    criteria: Object.fromEntries(pain.map((option) => [option, PAIN_CRITERIA[option]])),
  };
  for (const { id, heading } of vocabulary.sections) {
    questions[id] = {
      type: 'noul',
      instructions: {
        task: 'Does `description` raise a decision that falls under the guideline section `section`?',
        section: heading,
      },
      criteria: {
        true: 'A decision the description raises belongs to this section.',
        false: 'No decision the description raises belongs to this section.',
      },
    };
  }
  candidates.forEach(({ text }, index) => {
    questions[termId(index)] = {
      type: 'noul',
      instructions: {
        task:
          'Does `description` assert `phrase` as a clinical fact about the patient or the situation, ' +
          'while no entry of `vocabulary` expresses that fact?',
        phrase: text,
        vocabulary: vocabulary.vocabulary,
      },
      criteria: {
        true: 'The description asserts it, not negated and not hypothetical, and no vocabulary entry covers it.',
        false:
          'The description does not assert it, it is not a clinical fact, or a vocabulary entry covers it, including a broader or synonymous entry.',
      },
    };
  });
  return {
    request: { model: JEV_MODEL, state: { description }, questions },
    candidates,
    overflow,
  };
};

export const termQuestionId = termId;
