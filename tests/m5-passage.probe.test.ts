import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { expect, it } from 'vitest';

import type { PlTerm } from '../src/engine/terms.js';
import { parseEvidenceDocument } from '../src/provenance/model.js';
import { presentClinicalAdvice } from '../src/questions/advice.js';
import { payloadDocuments } from '../tools/kb/payload.mjs';
import { buildImage } from '../tools/kb/produce.mjs';
import { bagFiles, boot, ROOT, solve } from './m5-probe-support.js';

type Target = { id: string; answers: { term: PlTerm; presentation: { document: string; sourcePassage: string } }[] };
const targets = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/m5-answer-targets.json'), 'utf8')) as Target[];

it('ans.passage: exact aligned English is required even by the current structured renderer', () => {
  const measurements = [];
  let totalPassageBytes = 0;
  let totalChunkBytes = 0;
  for (const { id, answers } of targets) {
    let topicChunkBytes = 0;
    for (const { term, presentation } of answers) {
      const chunk = readFileSync(join(ROOT, 'kb/generated/provenance/documents', `${presentation.document}.json`));
      const evidence = parseEvidenceDocument(JSON.parse(chunk.toString('utf8')), presentation.document);
      expect(evidence.source.text).toBe(presentation.sourcePassage);
      totalPassageBytes += Buffer.byteLength(evidence.source.text);
      topicChunkBytes += chunk.length;
      if (term.kind !== 'compound') throw new Error('bad answer target');
      const dropped: PlTerm = { ...term, args: [term.args[0] as PlTerm, term.args[1] as PlTerm, { kind: 'string', value: '' }] };
      expect(presentClinicalAdvice(dropped)).toBeUndefined();
      const malformed: PlTerm = { ...term, args: [term.args[0] as PlTerm, { kind: 'atom', value: 'bad-rules' }, term.args[2] as PlTerm] };
      expect(presentClinicalAdvice(malformed)).toMatchObject({ text: evidence.source.text, structured: false });
      expect(() => parseEvidenceDocument(JSON.parse(chunk.toString('utf8')), `${presentation.document}-wrong`)).toThrow();
    }
    totalChunkBytes += topicChunkBytes;
    measurements.push({ id, topicChunkBytes });
  }
  console.log(JSON.stringify({ totalPassageBytes, totalChunkBytes, measurements,
    missingPassageControls: 12, fallbackControls: 12, wrongDocumentControls: 12 }));
});

it('ans.passage-build: separate immutable passage metadata has a small measured image cost', async () => {
  const base = payloadDocuments(bagFiles()).source;
  const texts = targets.flatMap(({ answers }) => answers.map(({ presentation }) => presentation));
  const metadata = texts.map(({ document, sourcePassage }) =>
    `m5_passage('${document}',${JSON.stringify(sourcePassage)}).`).join('\n') + '\n';
  const before = await buildImage(base);
  const after = await buildImage(`${base}\n${metadata}`);
  const absent = await boot(before.image);
  expect(await solve(absent, 'current_predicate(m5_passage/2)')).toEqual([]);
  const present = await boot(after.image);
  const live = await solve(present, 'm5_passage(Doc,Passage)');
  expect(live).toHaveLength(12);
  for (const row of live) {
    const doc = row.bindings.Doc;
    const passage = row.bindings.Passage;
    if (doc?.kind !== 'atom' || passage?.kind !== 'string') throw new Error('bad metadata answer');
    expect(passage.value).toBe(texts.find(({ document }) => document === doc.value)?.sourcePassage);
  }
  console.log(JSON.stringify({ rawMetadataBytes: Buffer.byteLength(metadata), gzipMetadataBytes: gzipSync(metadata, { level: 9 }).length,
    bareImageBytes: before.image.length, withPassagesImageBytes: after.image.length,
    imageDeltaBytes: after.image.length - before.image.length, scope: 'bare guideline payload + 12 passage facts; not final u1 image' }));
}, 120_000);
