import { describe, expect, it } from 'vitest';

import type { ProofStep } from '../src/engine/protocol.js';
import {
  alignedSegments,
  flattenProof,
  parseEvidenceDocument,
  proofClauses,
} from '../src/provenance/model.js';

import { EVIDENCE_FIXTURE } from './provenance-fixture.js';

describe('provenance evidence model', () => {
  it('validates a document and rejects an id mismatch before rendering', () => {
    expect(parseEvidenceDocument(EVIDENCE_FIXTURE, 'cdc2022-opioid-rec01-imp01')).toEqual(
      EVIDENCE_FIXTURE,
    );
    expect(() => parseEvidenceDocument(EVIDENCE_FIXTURE, 'doc-2')).toThrow(/does not match/u);
  });

  it('uses Unicode code-point offsets and retains every character', () => {
    const segments = alignedSegments(
      EVIDENCE_FIXTURE.source.text,
      EVIDENCE_FIXTURE.alignment.spans,
      'source',
    );
    expect(segments).toEqual([
      { kind: 'text', text: 'A 💊 ' },
      { kind: 'aligned', text: 'dose', group: 7 },
      { kind: 'text', text: '.' },
    ]);
    expect(segments.map((segment) => segment.text).join('')).toBe(EVIDENCE_FIXTURE.source.text);
  });

  it('rejects overlapping, out-of-bounds, and text-mismatched spans', () => {
    const base = EVIDENCE_FIXTURE.alignment.spans[0];
    if (base === undefined) throw new Error('fixture span missing');
    expect(() =>
      alignedSegments(
        EVIDENCE_FIXTURE.source.text,
        [base, { ...base, start: 6, end: 8, text: 'se' }],
        'source',
      ),
    ).toThrow(/overlaps/u);
    expect(() =>
      alignedSegments(EVIDENCE_FIXTURE.source.text, [{ ...base, start: 4, end: 40 }], 'source'),
    ).toThrow(/exceeds/u);
    expect(() =>
      alignedSegments(EVIDENCE_FIXTURE.source.text, [{ ...base, text: 'wrong' }], 'source'),
    ).toThrow(/does not match/u);
  });

  it('flattens a nested live proof in traversal order, keeping every arm', () => {
    const nested: ProofStep = {
      kind: 'clause',
      line: 77,
      head: 'outer',
      predicate: 'outer/1',
      children: [
        { kind: 'clause', line: 78, head: 'inner', predicate: 'inner/1', children: [] },
        { kind: 'assumption', head: 'assumed', predicate: 'assumed/0' },
        { kind: 'negation', goal: 'absent' },
      ],
    };
    expect(flattenProof([nested]).map((step) => step.kind)).toEqual([
      'clause',
      'clause',
      'assumption',
      'negation',
    ]);
    // Only the source-bearing arm reaches the ladder; the other two carry no line.
    expect(proofClauses([nested]).map((step) => step.line)).toEqual([77, 78]);
  });
});
