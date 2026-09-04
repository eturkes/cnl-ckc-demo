// Reader-facing text for every controller state and every answer row.
//
// Copy lives here rather than in a template so it is testable as data and so the
// components stay free of the member accesses ESLint cannot type through a
// `.svelte` import. Each of the six `AnswerResult` kinds keeps its own wording:
// a demo that showed one "no answer" for a failed proof, a spent budget and a
// cancelled run would be unable to tell an honest empty result from a stopped one.

import type { LimitKind, PlSolution } from '../engine/protocol.js';
import { QUESTION_CATALOG, type CatalogEntry, type QuestionId } from '../questions/catalog.js';
import { humanizeGuidelineId } from '../questions/humanize.js';
import type { AnswerResult } from '../questions/service.js';

import type { DemoState } from './DemoController.svelte.js';
import { describeDescriptor } from './descriptor.js';

export interface StateDescription {
  /** Polite live-region text. Empty means there is nothing to announce yet. */
  status: string;
  /** Assertive alert text. Empty means no error. */
  error: string;
  /** A run is in flight, so the answer region is being replaced. */
  busy: boolean;
  /** Terminal wording for the answer region, shown above any rows. */
  summary: string;
}

export interface AnswerCell {
  variable: string;
  /** Reader-facing label for this column, formatted from its ACE descriptor. */
  descriptor: string;
  text: string;
}

export interface AnswerRow {
  cells: AnswerCell[];
  /** One-line accessible name for the row's radio. */
  label: string;
}

const LIMIT_TEXT: Record<LimitKind, string> = {
  stack: 'the stack limit',
  depth: 'the depth limit',
  inference: 'the inference limit',
  'wall-clock': 'the time limit',
  'answer-cap': 'the answer limit',
  heap: 'the memory limit',
};

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** An existence question projects no columns, so it answers yes or no, never rows. */
const isExistential = (entry: CatalogEntry): boolean => entry.projection.length === 0;

const blank: StateDescription = { status: '', error: '', busy: false, summary: '' };

const describeResult = (entry: CatalogEntry, result: AnswerResult): StateDescription => {
  switch (result.kind) {
    case 'answer':
      return isExistential(entry)
        ? { ...blank, status: 'Answer: yes.', summary: 'Yes. The knowledge base proves it.' }
        : {
            ...blank,
            status: `${count(result.solutions.length, 'answer')} for this question.`,
            summary: count(result.solutions.length, 'answer'),
          };
    case 'failure':
      return isExistential(entry)
        ? { ...blank, status: 'Answer: no.', summary: 'No. The knowledge base found no proof.' }
        : { ...blank, status: 'No proof found.', summary: 'No proof found. The result is empty.' };
    case 'limit': {
      const partial = count(result.solutions.length, 'partial answer');
      const text = `The run stopped at ${LIMIT_TEXT[result.limit]} (${result.limit}) with ${partial}.`;
      return { ...blank, status: text, summary: text };
    }
    case 'cancelled': {
      const text = `Cancelled with ${count(result.solutions.length, 'partial answer')}.`;
      return { ...blank, status: text, summary: text };
    }
    case 'error':
      return {
        ...blank,
        error: `The run failed (${result.error.code}). ${result.error.message}`,
        summary: 'The run failed.',
      };
    case 'rejected':
      return {
        ...blank,
        error: 'That question is not in the catalog, so it was never run.',
        summary: 'The question was rejected.',
      };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
};

export const describeState = (state: DemoState): StateDescription => {
  switch (state.kind) {
    case 'booting':
      // Not `busy`: booting is not a run, so Cancel stays disabled and the answer
      // region is idle rather than mid-replacement.
      return { ...blank, status: 'Starting the Prolog engine.', summary: 'No answer yet.' };
    case 'boot-error':
      return {
        ...blank,
        error: `The Prolog engine did not start. ${state.error.message}`,
        summary: 'The engine is unavailable. Select Retry to start it again.',
      };
    case 'idle':
      return {
        ...blank,
        status:
          `Knowledge base ready: ${count(state.contract.documents, 'compiled document')} ` +
          `at schema ${state.contract.schemaVersion}. Pick a question and run it.`,
        summary: 'No answer yet.',
      };
    case 'running':
      return {
        ...blank,
        status: `Running ${QUESTION_CATALOG[state.id].question}`,
        busy: true,
      };
    case 'cancelling':
      return { ...blank, status: 'Cancelling the run.', busy: true };
    case 'settled':
      return describeResult(QUESTION_CATALOG[state.id], state.result);
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

/**
 * One row per solution, one cell per projected column.
 *
 * Text is the engine's own canonical `display`, optionally read through the
 * structural humanizer whose fallback is that same display. Nothing here builds
 * Prolog syntax from a decoded binding.
 */
export const answerRows = (id: QuestionId, solutions: readonly PlSolution[]): AnswerRow[] => {
  const { projection } = QUESTION_CATALOG[id];
  // An existence question projects no columns, so its whole answer is the yes/no
  // summary. Mapping its N solutions would emit N unlabelled radios.
  if (projection.length === 0) return [];
  return solutions.map((solution) => {
    const cells = projection.map(({ variable, descriptor }) => {
      const display = solution.display[variable] ?? '';
      const binding = solution.bindings[variable];
      return {
        variable,
        descriptor: describeDescriptor(descriptor),
        text: binding === undefined ? display : humanizeGuidelineId(binding, display),
      };
    });
    return { cells, label: cells.map((cell) => cell.text).join(', ') };
  });
};
