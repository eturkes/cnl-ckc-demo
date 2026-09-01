import type { SolveResult } from '../../../src/engine/session';
import type { CatalogRecord } from './catalog.mjs';

export interface CanonicalResult {
  resultText: string;
  rawResultText: string;
  rawRows: number;
  projectedRows: number;
  duplicateRows: number;
  sortChanged: boolean;
}

export interface SerializedAnswers extends CanonicalResult {
  bytes: string;
}

export interface ParsedAnswerArtifact {
  id: string;
  querySha256: string;
  resultText: string;
}

export declare function canonicalResult(
  record: CatalogRecord,
  result: SolveResult,
): CanonicalResult;
export declare function serializeAnswers(
  record: CatalogRecord,
  result: SolveResult,
  querySha256: string,
): SerializedAnswers;
export declare function parseAnswerArtifact(source: string, label: string): ParsedAnswerArtifact;
export declare function firstByteDiff(expected: Uint8Array, actual: Uint8Array): string;
