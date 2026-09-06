import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from '../tools/kb/bag.mjs';
import { clinicalArtifacts, CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { payloadDocuments } from '../tools/kb/payload.mjs';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('vendored bag is missing');

export const bagFiles = verifyBag(readFileSync(join(ROOT, 'kb', archive))).files;
export const artifacts = clinicalArtifacts(bagFiles);
export const helperLines = artifacts.helper.split('\n');
export const selectedDocuments = new Set(
  CLINICAL_QUESTIONS.flatMap((question) => question.sources.map(({ document }) => document)),
);

export const sha12 = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 12);
export const orderedHash = (values: readonly string[]): string => sha12(values.join('\0'));
export const keyOf = (document: string, sentence: number): string =>
  `${document}:${String(sentence)}`;

export interface ContentSite {
  readonly line: number;
  readonly head: string;
  readonly body: string;
}

export interface SentenceSites {
  readonly document: string;
  readonly sentence: number;
  readonly marker: string;
  readonly sites: ContentSite[];
}

export const scanContentSites = (
  files: ReadonlyMap<string, Uint8Array> = bagFiles,
): SentenceSites[] => {
  const rows: SentenceSites[] = [];
  let document = '';
  let current: SentenceSites | undefined;
  for (const [index, line] of payloadDocuments(files).source.split('\n').entries()) {
    const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
    if (file !== null) {
      document = file[1] ?? '';
      current = undefined;
      continue;
    }
    const marker = /^% S([1-9][0-9]*):/u.exec(line);
    if (marker !== null) {
      const sentence = Number(marker[1]);
      current =
        selectedDocuments.has(document) && sentence > 1
          ? { document, sentence, marker: line, sites: [] }
          : undefined;
      if (current !== undefined) rows.push(current);
      continue;
    }
    if (current === undefined || !line.startsWith('guideline_')) continue;
    if (line.includes('\r')) throw new Error(`${keyOf(document, current.sentence)}: CR content`);
    const boundary = line.indexOf(' :- ');
    current.sites.push({
      line: index + 1,
      head: (boundary < 0 ? line.slice(0, -1) : line.slice(0, boundary)).trim(),
      body: boundary < 0 ? 'true' : line.slice(boundary + 4, -1),
    });
  }
  return rows;
};

export const aceSentenceKeys = (files: ReadonlyMap<string, Uint8Array> = bagFiles): string[] =>
  [...selectedDocuments].flatMap((document) => {
    const path = [...files.keys()].find((name) => name.endsWith(`/ace/${document}.ace`));
    if (path === undefined) throw new Error(`${document}: ACE source is missing`);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(files.get(path));
    const sentences = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
    return sentences.slice(1).map((_, index) => keyOf(document, index + 2));
  });

const balancedEnd = (source: string, start: number): number => {
  let depth = 0;
  let quoted = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '\\') index += 1;
      else if (char === "'" && source[index + 1] === "'") index += 1;
      else if (char === "'") quoted = false;
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  throw new Error(`unterminated generated call at byte ${String(start)}`);
};

export interface GateRecord {
  readonly document: string;
  readonly sentence: number;
  readonly lines: number[];
  readonly heads: string[];
  readonly source: string;
}

export const parseGateRecords = (helper: string = artifacts.helper): GateRecord[] =>
  helper
    .split('\n')
    .filter((line) => line.startsWith('clinical_gate('))
    .map((line) => {
      const header = /^clinical_gate\('([^']+)',(\d+),Rule,\[([\d,]*)\]\) :- /u.exec(line);
      if (header === null) throw new Error(`malformed generated gate: ${line.slice(0, 80)}`);
      const heads: string[] = [];
      let cursor = header[0].length;
      for (;;) {
        const start = line.indexOf('clinical_use(', cursor);
        if (start < 0) break;
        const end = balancedEnd(line, start + 'clinical_use'.length);
        const call = line.slice(start, end);
        const use = /^clinical_use\((\d+),\((.*)\)\)$/u.exec(call);
        if (use === null) throw new Error(`malformed generated use: ${call}`);
        heads.push(use[2] ?? '');
        cursor = end;
      }
      const lines = (header[3] ?? '').split(',').filter(Boolean).map(Number);
      if (lines.length !== heads.length) {
        throw new Error(`${header[1]}:${header[2]}: gate line/head cardinality differs`);
      }
      return {
        document: header[1] ?? '',
        sentence: Number(header[2]),
        lines,
        heads,
        source: line,
      };
    });

export const gateRecords = parseGateRecords();
