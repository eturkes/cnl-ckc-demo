import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { verifyBag } from '../tools/kb/bag.mjs';
import { deriveSemanticGraph } from '../tools/kb/graph.mjs';
import { deriveProvenance } from '../tools/kb/provenance.mjs';
import { payloadSource, ROOT } from '../tools/kb/paths.mjs';

interface EvidenceChunk {
  schemaVersion: number;
  id: string;
  label: string;
  region: { id: string; sourceFile: string; page: number; section: string };
  source: { text: string };
  ace: { text: string; sentences: { number: number; text: string }[] };
  alignment: {
    unit: string;
    spans: { group: number; side: 'source' | 'ace'; start: number; end: number; text: string }[];
  };
  projection: { region: string; kept: string; dropped: string };
  clauses: { line: number; sentence: number | null; predicate: string; text: string }[];
}

const archives = readdirSync(join(ROOT, 'kb')).filter((name) => name.endsWith('.tar.gz'));
if (archives.length !== 1) throw new Error(`expected one KB bag, found ${String(archives.length)}`);
const { files } = verifyBag(readFileSync(join(ROOT, 'kb', archives[0] as string)));
const provenance = deriveProvenance(files);
const graph = deriveSemanticGraph(files, provenance.clauses);

const evidence = (id: string): EvidenceChunk => {
  const chunk = provenance.chunks.find(({ document }) => document === id);
  if (chunk === undefined) throw new Error(`missing test evidence ${id}`);
  return chunk.model as EvidenceChunk;
};

describe('bag-derived provenance assets', () => {
  it('joins every document and exact combined-source clause once', () => {
    expect(provenance.stats).toMatchObject({ documents: 337, clauses: 10_321 });
    expect(provenance.chunks).toHaveLength(337);
    expect(new Set(provenance.chunks.map(({ path }) => path)).size).toBe(337);

    const combined = payloadSource(files).source.split('\n');
    const lines = new Set<number>();
    for (const clause of provenance.clauses) {
      expect(lines.has(clause.line), `duplicate combined line ${String(clause.line)}`).toBe(false);
      lines.add(clause.line);
      expect(combined[clause.line - 1]).toBe(clause.text);
    }
    expect(
      provenance.chunks.reduce(
        (total, chunk) => total + (chunk.model as EvidenceChunk).clauses.length,
        0,
      ),
    ).toBe(provenance.stats.clauses);
  });

  it('resolves an ordinal source passage, physical page, sentences, and code-point spans', () => {
    const chunk = evidence('cdc2022-opioid-rec01');
    expect(chunk.region).toEqual({
      id: 'B3-02',
      sourceFile: 'source/box3-extraction.txt',
      page: 13,
      section: 'BOX 3 > Recommendation 1',
    });
    expect(chunk.source.text).toBe(
      'Nonopioid therapies are at least as effective as opioids for many common types of acute pain. Clinicians should maximize use of nonpharmacologic and nonopioid pharmacologic therapies as appropriate for the specific condition and patient and only consider opioid therapy for acute pain if benefits are anticipated to outweigh risks to the patient. Before prescribing opioid therapy for acute pain, clinicians should discuss with patients the realistic benefits and known risks of opioid therapy (recommendation category: B; evidence type: 3).',
    );
    expect(chunk.ace.sentences.map(({ text }) => text)).toEqual(chunk.ace.text.split('\n'));
    expect(chunk.ace.sentences.map(({ number }) => number)).toEqual([1, 2, 3, 4]);
    expect(chunk.projection.region).toBe(chunk.region.id);
    expect(chunk.label).toBe('unreviewed');

    for (const span of chunk.alignment.spans) {
      const value = span.side === 'ace' ? chunk.ace.text : chunk.source.text;
      expect(Array.from(value).slice(span.start, span.end).join('')).toBe(span.text);
    }
  });

  it('copies the verified PDF bytes and serializes deterministically', () => {
    expect(
      Buffer.from(provenance.pdf.bytes).equals(Buffer.from(files.get(provenance.pdf.source) ?? [])),
    ).toBe(true);
    const again = deriveProvenance(files);
    expect(again.index.bytes.equals(provenance.index.bytes)).toBe(true);
    expect(
      again.chunks.every(({ bytes }, index) => {
        const expected = provenance.chunks[index];
        return expected !== undefined && bytes.equals(expected.bytes);
      }),
    ).toBe(true);
  });

  it('refuses an unsafe source path and a dishonest alignment offset before emission', () => {
    const coverage = [...files.keys()].find((path) => path.endsWith('/coverage.tsv'));
    if (coverage === undefined) throw new Error('coverage fixture missing');
    const unsafe = new Map(files);
    unsafe.set(
      coverage,
      Buffer.from(
        Buffer.from(files.get(coverage) ?? [])
          .toString('utf8')
          .replace('source/box3-extraction.txt', 'source/../box3-extraction.txt'),
      ),
    );
    expect(() => deriveProvenance(unsafe)).toThrow(/unsafe-source-path/u);

    const alignment = [...files.keys()].find((path) =>
      path.endsWith('/align/cdc2022-opioid-rec01.tsv'),
    );
    if (alignment === undefined) throw new Error('alignment fixture missing');
    const badOffset = new Map(files);
    badOffset.set(
      alignment,
      Buffer.from(
        Buffer.from(files.get(alignment) ?? [])
          .toString('utf8')
          .replace(/^([^\t]+\t[^\t]+\t)[0-9]+/u, (_match, prefix: string) => `${prefix}999999`),
      ),
    );
    expect(() => deriveProvenance(badOffset)).toThrow(/alignment-span/u);
  });
});

describe('static semantic graph asset', () => {
  it('maps every explicit schema site and every Horn rule to a typed edge', () => {
    const predicateKinds = new Map([
      ['guideline_entity', 'entity'],
      ['guideline_cardinality', 'cardinality'],
      ['guideline_event', 'event'],
      ['guideline_arg', 'argument'],
      ['guideline_pp', 'preposition'],
      ['guideline_property', 'property'],
      ['guideline_operator', 'operator'],
    ]);
    const expected = new Map<string, number>();
    for (const clause of provenance.clauses) {
      const kind = predicateKinds.get(clause.predicate);
      if (kind !== undefined) expected.set(kind, (expected.get(kind) ?? 0) + 1);
    }
    expected.set('implies', provenance.clauses.filter(({ kind }) => kind === 'rule').length);
    expect(graph.model.stats.byEdgeKind).toEqual(Object.fromEntries([...expected].sort()));
    expect(graph.model.stats).toMatchObject({ documents: 337, clauses: 10_321, edges: 18_700 });
  });

  it('keeps event and operator context nodes and gives every edge source provenance', () => {
    const nodes = new Map(graph.model.nodes.map((node) => [node.id, node]));
    expect(graph.model.nodes.some(({ kind }) => kind === 'event')).toBe(true);
    expect(graph.model.nodes.some(({ kind }) => kind === 'operator-context')).toBe(true);
    expect(new Set(graph.model.nodes.map(({ id }) => id)).size).toBe(graph.model.nodes.length);
    expect(new Set(graph.model.edges.map(({ id }) => id)).size).toBe(graph.model.edges.length);
    for (const edge of graph.model.edges) {
      expect(nodes.has(edge.source), `${edge.id} source`).toBe(true);
      expect(nodes.has(edge.target), `${edge.id} target`).toBe(true);
      expect(edge.document).not.toBe('');
      expect(edge.line).toBeGreaterThan(0);
    }
    const collapsed = graph.model.edges.filter(
      (edge) =>
        (edge.kind === 'argument' || edge.kind === 'preposition') &&
        nodes.get(edge.source)?.kind === 'entity' &&
        nodes.get(edge.target)?.kind === 'entity',
    );
    expect(collapsed, 'n-ary event relationships must not collapse to noun→noun').toEqual([]);
  });

  it('is byte-deterministic for the same verified file map', () => {
    expect(deriveSemanticGraph(files, provenance.clauses).bytes.equals(graph.bytes)).toBe(true);
  });
});
