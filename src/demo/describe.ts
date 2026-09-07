// Reader-facing text for every controller state and every answer row.
//
// Copy lives here rather than in a template so it is testable as data and so the
// components stay free of the member accesses ESLint cannot type through a
// `.svelte` import. Each of the six `AnswerResult` kinds keeps its own wording:
// a demo that showed one "no answer" for a failed proof, a spent budget and a
// cancelled run would be unable to tell an honest empty result from a stopped one.

import type { LimitKind, PlSolution } from '../engine/protocol.js';
import { messages } from '../i18n/locale.svelte.js';
import { QUESTION_CATALOG, type CatalogEntry, type QuestionId } from '../questions/catalog.js';
import { presentAnswerTerm } from '../questions/humanize.js';
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
  /** One-line lossless fallback when this result has no structured clauses. */
  label: string;
  /** Deterministic renderings of every grouped controlled clause. */
  items?: readonly string[];
  /** Exact source text carried in the same engine binding. */
  sourcePassage?: string;
  /** Opaque corpus id, exposed only for diagnostics and source identity. */
  document?: string;
  structured?: true;
}

export interface AnswerPoint {
  /** One deterministic reader-facing statement. */
  text: string;
  /** Zero-based solution indexes whose structured terms produce this statement. */
  sources: number[];
}

const LIMIT_TEXT = {
  stack: 'limitStack',
  depth: 'limitDepth',
  inference: 'limitInference',
  'wall-clock': 'limitWallClock',
  'answer-cap': 'limitAnswerCap',
  heap: 'limitHeap',
} as const satisfies Record<LimitKind, keyof (typeof messages.current)['TEXT']>;

/** An existence question projects no columns, so it answers yes or no, never rows. */
const isExistential = (entry: CatalogEntry): boolean => entry.projection.length === 0;

const blank: StateDescription = { status: '', error: '', busy: false, summary: '' };

const describeResult = (entry: CatalogEntry, result: AnswerResult): StateDescription => {
  const { TEXT } = messages.current;
  switch (result.kind) {
    case 'answer':
      return isExistential(entry)
        ? { ...blank, status: TEXT.answerYes(), summary: TEXT.answerYesSummary() }
        : {
            ...blank,
            status: TEXT.answerReady(),
          };
    case 'failure':
      return isExistential(entry)
        ? { ...blank, status: TEXT.answerNo(), summary: TEXT.answerNoSummary() }
        : { ...blank, status: TEXT.noProof(), summary: TEXT.noProofSummary() };
    case 'limit': {
      const text = TEXT.runStopped(
        TEXT[LIMIT_TEXT[result.limit]](),
        result.limit,
        result.solutions.length,
      );
      return { ...blank, status: text, summary: text };
    }
    case 'cancelled': {
      const text = TEXT.runCancelled(result.solutions.length);
      return { ...blank, status: text, summary: text };
    }
    case 'error':
      return {
        ...blank,
        error: TEXT.runFailed(result.error.code, result.error.message),
        summary: TEXT.runFailedSummary(),
      };
    case 'rejected':
      return {
        ...blank,
        error: TEXT.questionRejected(),
        summary: TEXT.questionRejectedSummary(),
      };
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
};

export const describeState = (state: DemoState): StateDescription => {
  const { TEXT } = messages.current;
  switch (state.kind) {
    case 'booting':
      // Not `busy`: booting is not a run, so Cancel stays disabled and the answer
      // region is idle rather than mid-replacement.
      return { ...blank, status: TEXT.engineStarting(), summary: TEXT.noAnswerYet() };
    case 'boot-error':
      return {
        ...blank,
        error: TEXT.engineFailed(state.error.message),
        summary: TEXT.engineFailedSummary(),
      };
    case 'idle':
      return {
        ...blank,
        status: TEXT.engineReady(state.contract.documents, String(state.contract.schemaVersion)),
        summary: TEXT.noAnswerYet(),
      };
    case 'running':
      return {
        ...blank,
        status: TEXT.runningQuestion(QUESTION_CATALOG[state.id].question),
        busy: true,
      };
    case 'cancelling':
      return { ...blank, status: TEXT.cancellingRun(), busy: true };
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
    const presented = projection.map(({ variable, descriptor }) => {
      const display = solution.display[variable] ?? '';
      const binding = solution.bindings[variable];
      const presentation =
        binding === undefined
          ? { text: display, items: [], structured: false as const }
          : presentAnswerTerm(binding, display);
      return {
        cell: {
          variable,
          descriptor: describeDescriptor(descriptor),
          text: presentation.text,
        },
        presentation,
      };
    });
    const cells = presented.map(({ cell }) => cell);
    const primary = presented.length === 1 ? presented[0]?.presentation : undefined;
    return {
      cells,
      label: cells.map((cell) => cell.text).join(', '),
      ...(primary?.structured === true && primary.items.length > 0
        ? { items: primary.items, structured: true as const }
        : {}),
      ...(primary?.structured !== true || primary.sourcePassage === undefined
        ? {}
        : { sourcePassage: primary.sourcePassage }),
      ...(primary?.document === undefined ? {} : { document: primary.document }),
    };
  });
};

/**
 * Combine every solution into one answer while retaining statement-level source links.
 *
 * The operation is deliberately semantic-free: preserve solution order, preserve each
 * rendered statement byte for byte, and merge exact duplicates by joining their source
 * indexes. No topic vocabulary or clinical judgment enters the synthesis.
 */
export const synthesizeAnswer = (rows: readonly AnswerRow[]): AnswerPoint[] => {
  const points: AnswerPoint[] = [];
  const byText = new Map<string, AnswerPoint>();
  for (const [source, row] of rows.entries()) {
    const statements = row.items ?? [row.label];
    for (const text of statements) {
      let point = byText.get(text);
      if (point === undefined) {
        point = { text, sources: [] };
        byText.set(text, point);
        points.push(point);
      }
      if (!point.sources.includes(source)) point.sources.push(source);
    }
  }
  return points;
};
