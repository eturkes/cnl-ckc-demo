import type { EngineError, LimitKind, ProofStep } from '../engine/protocol.js';

export type ReviewLabel = 'approved' | 'rejected' | 'contested' | 'stale' | 'unreviewed';
export type ClauseKind = 'fact' | 'rule';

export interface AlignmentSpan {
  group: number;
  side: 'source' | 'ace';
  start: number;
  end: number;
  text: string;
}

export interface EvidenceClause {
  line: number;
  sentence: number | null;
  predicate: string;
  arity: number;
  kind: ClauseKind;
  text: string;
}

export interface EvidenceDocument {
  schemaVersion: 1;
  id: string;
  label: ReviewLabel;
  region: {
    id: string;
    sourceFile: string;
    page: number;
    section: string;
  };
  source: { text: string };
  ace: { text: string; sentences: { number: number; text: string }[] };
  alignment: { unit: 'unicode-code-point'; spans: AlignmentSpan[] };
  projection: { kept: string; dropped: string };
  clauses: EvidenceClause[];
}

export interface GraphFocus {
  document: string;
  sentence?: number;
}

export type ProvenanceState =
  | { kind: 'idle' }
  | { kind: 'loading'; solution: number }
  | { kind: 'ready'; solution: number; steps: ProofStep[] }
  | { kind: 'failure'; solution: number }
  | { kind: 'limit'; solution: number; limit: LimitKind }
  | { kind: 'cancelled'; solution: number }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; solution: number; error: EngineError };

export interface TextSegment {
  kind: 'text' | 'aligned';
  text: string;
  group?: number;
}

const own = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const record = (value: unknown, at: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${at} must be an object`);
  }
  return value as Record<string, unknown>;
};

const text = (value: unknown, at: string): string => {
  if (typeof value !== 'string') throw new Error(`${at} must be text`);
  return value;
};

const integer = (value: unknown, at: string): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error(`${at} must be an integer`);
  return Number(value);
};

/** Runtime validation keeps a corrupt lazy chunk from being shown as neighbouring evidence. */
export const parseEvidenceDocument = (input: unknown, expectedId: string): EvidenceDocument => {
  const root = record(input, 'evidence');
  if (root.schemaVersion !== 1) throw new Error('evidence has an unsupported schema');
  if (root.id !== expectedId) throw new Error(`evidence id does not match ${expectedId}`);

  const region = record(root.region, 'evidence.region');
  const source = record(root.source, 'evidence.source');
  const ace = record(root.ace, 'evidence.ace');
  const alignment = record(root.alignment, 'evidence.alignment');
  const projection = record(root.projection, 'evidence.projection');
  const labels: readonly ReviewLabel[] = [
    'approved',
    'rejected',
    'contested',
    'stale',
    'unreviewed',
  ];
  if (!labels.includes(root.label as ReviewLabel))
    throw new Error('evidence has an unknown review label');
  if (alignment.unit !== 'unicode-code-point' || !Array.isArray(alignment.spans)) {
    throw new Error('evidence alignment has an unsupported shape');
  }
  if (!Array.isArray(ace.sentences) || !Array.isArray(root.clauses)) {
    throw new Error('evidence sentences or clauses are missing');
  }

  const spans = alignment.spans.map((entry, index): AlignmentSpan => {
    const span = record(entry, `evidence.alignment.spans[${String(index)}]`);
    if (span.side !== 'source' && span.side !== 'ace') throw new Error('alignment side is invalid');
    const start = integer(span.start, 'alignment start');
    const end = integer(span.end, 'alignment end');
    if (end < start) throw new Error('alignment end precedes its start');
    return {
      group: integer(span.group, 'alignment group'),
      side: span.side,
      start,
      end,
      text: text(span.text, 'alignment text'),
    };
  });

  const sentences = ace.sentences.map((entry, index) => {
    const sentence = record(entry, `evidence.ace.sentences[${String(index)}]`);
    return {
      number: integer(sentence.number, 'sentence number'),
      text: text(sentence.text, 'sentence text'),
    };
  });
  const clauses = root.clauses.map((entry, index): EvidenceClause => {
    const clause = record(entry, `evidence.clauses[${String(index)}]`);
    if (clause.kind !== 'fact' && clause.kind !== 'rule') throw new Error('clause kind is invalid');
    if (clause.sentence !== null && !Number.isSafeInteger(clause.sentence)) {
      throw new Error('clause sentence is invalid');
    }
    return {
      line: integer(clause.line, 'clause line'),
      sentence: clause.sentence as number | null,
      predicate: text(clause.predicate, 'clause predicate'),
      arity: integer(clause.arity, 'clause arity'),
      kind: clause.kind,
      text: text(clause.text, 'clause text'),
    };
  });

  for (const required of ['id', 'sourceFile', 'page', 'section']) {
    if (!own(region, required)) throw new Error(`evidence.region.${required} is missing`);
  }
  return {
    schemaVersion: 1,
    id: expectedId,
    label: root.label as ReviewLabel,
    region: {
      id: text(region.id, 'region id'),
      sourceFile: text(region.sourceFile, 'region source file'),
      page: integer(region.page, 'region page'),
      section: text(region.section, 'region section'),
    },
    source: { text: text(source.text, 'source text') },
    ace: { text: text(ace.text, 'ACE text'), sentences },
    alignment: { unit: 'unicode-code-point', spans },
    projection: {
      kept: text(projection.kept, 'projection kept'),
      dropped: text(projection.dropped, 'projection dropped'),
    },
    clauses,
  };
};

/** Split on code-point offsets while retaining every original byte-equivalent character. */
export const alignedSegments = (
  value: string,
  spans: readonly AlignmentSpan[],
  side: AlignmentSpan['side'],
): TextSegment[] => {
  const points = [...value];
  const selected = spans
    .filter((span) => span.side === side)
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end || a.group - b.group);
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const span of selected) {
    if (span.start < cursor || span.end > points.length)
      throw new Error(`${side} alignment overlaps or exceeds text`);
    if (span.start > cursor)
      segments.push({ kind: 'text', text: points.slice(cursor, span.start).join('') });
    const actual = points.slice(span.start, span.end).join('');
    if (actual !== span.text) throw new Error(`${side} alignment text does not match its span`);
    segments.push({ kind: 'aligned', text: actual, group: span.group });
    cursor = span.end;
  }
  if (cursor < points.length) segments.push({ kind: 'text', text: points.slice(cursor).join('') });
  return segments;
};

export const flattenProof = (steps: readonly ProofStep[]): ProofStep[] => {
  const flat: ProofStep[] = [];
  const visit = (step: ProofStep): void => {
    flat.push(step);
    for (const child of step.children) visit(child);
  };
  for (const step of steps) visit(step);
  return flat;
};
