import type { PlSolution } from '../../src/engine/protocol.js';

import type { QuestionRecord } from './catalog.js';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const serializeResult = (
  question: QuestionRecord,
  solutions: readonly PlSolution[],
): {
  readonly text: string;
  readonly liveRows: readonly string[];
  readonly sortedRows: readonly string[];
} => {
  if (question.projection.kind === 'boolean') {
    return {
      text: `result(${solutions.length === 0 ? 'no' : 'yes'})`,
      liveRows: [],
      sortedRows: [],
    };
  }

  const liveRows = solutions.map((solution) => {
    const terms = question.projection.variables.map(({ name }) => {
      const display = solution.display[name];
      if (display === undefined) throw new Error(`${question.id}: solution omitted ${name}`);
      return display;
    });
    return `sol([${terms.join(',')}])`;
  });
  const sortedRows = [...liveRows].sort(compareText);
  return { text: `result(solutions([${sortedRows.join(',')}]))`, liveRows, sortedRows };
};

export const serializeLegacyAnswer = (
  question: QuestionRecord,
  querySha256: string,
  solutions: readonly PlSolution[],
): string => {
  const result = serializeResult(question, solutions).text;
  return (
    `% ${question.id} answered against the loaded composition by ace_to_pl answer mode; do not edit.\n` +
    `'$guideline_answers'(v1,'${question.id}',query_sha256('${querySha256}'),${result}).\n`
  );
};
