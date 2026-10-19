// STUB (tester-4): contract surface alone; MAIN discards this file.
import type { PlTerm } from '../engine/terms.js';
import type { AnswerPoint, AnswerRow } from '../demo/describe.js';
import type { PlSolution } from '../engine/protocol.js';
import type { QuestionId } from './catalog.js';
import type { MarksOutcome } from './service.js';

export type Comparison = 'eq' | 'exactly' | 'geq' | 'greater' | 'leq' | 'less' | 'about';
export interface Grade {
  dimension: 'strength' | 'evidence';
  value: string;
  label: string;
}
export interface Qualifier {
  kind: string;
  word: string;
}
export interface Preference {
  preferred: string;
  alternative: string | null;
}
export type TimeMark =
  | {
      kind: 'interval';
      role: 'after' | 'before' | 'within';
      comparison: Comparison;
      count: number;
      unit: string;
      anchor: string;
    }
  | { kind: 'order'; relation: 'before' | 'after'; anchor: string };
export interface SentenceMarks {
  sentence: number;
  qualifiers: Qualifier[];
  preferences: Preference[];
  times: TimeMark[];
}
export interface DocumentMarks {
  document: string;
  grades: Grade[];
  groups: SentenceMarks[][];
}
export type MarksState =
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'loading'; id: QuestionId; goal: string }
  | { kind: 'settled'; id: QuestionId; goal: string; outcome: MarksOutcome };
export interface StatementMarks {
  qualifier: string;
  grade: string;
  preferences: string[];
  times: string[];
}
export interface MarksView {
  statements: readonly (StatementMarks | undefined)[];
  missing: number;
  total: number;
  notice: boolean;
}
export const decodeMarks = (_term: PlTerm): DocumentMarks | undefined => ({
  document: 'STUB',
  grades: [],
  groups: [],
});
export const gradeReading = (_grades: readonly Grade[]): string => '';
export const qualifierReading = (_qualifiers: readonly Qualifier[]): string => '';
export const preferenceReading = (_preference: Preference): string => '';
export const timeReading = (_time: TimeMark): string => '';
export const marksView = (
  _state: MarksState,
  _points: readonly AnswerPoint[],
  _rows: readonly AnswerRow[],
  _answers: readonly PlSolution[],
): MarksView => ({ statements: [], missing: 0, total: 0, notice: false });
