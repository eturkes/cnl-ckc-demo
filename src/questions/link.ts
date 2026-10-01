// The page URL carries the selected catalog id alone (`?q=`). Restoring it selects; it never
// runs, so a shared or reloaded link cannot start inference without the user's own click.

import { QUESTION_IDS, type QuestionId } from './catalog.js';

const PARAM = 'q';

export const questionFromUrl = (href: string): QuestionId | null => {
  const id = new URL(href).searchParams.get(PARAM);
  return QUESTION_IDS.find((known) => known === id) ?? null;
};

export const urlForQuestion = (href: string, id: QuestionId | null): string => {
  const url = new URL(href);
  if (id === null) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, id);
  return url.href;
};
