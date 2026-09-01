import { isQuestionId, QUESTION_CATALOG, QUESTION_IDS, type QuestionId } from './catalog.js';

export const questionOptions = QUESTION_IDS.map((id) => ({
  id,
  label: QUESTION_CATALOG[id].display.label,
}));

export const selectedQuestion = (candidate: string) => {
  if (!isQuestionId(candidate)) throw new Error(`unsupported question id: ${candidate}`);
  return QUESTION_CATALOG[candidate];
};

export const selectedGoal = (id: QuestionId): string => QUESTION_CATALOG[id].goal;
