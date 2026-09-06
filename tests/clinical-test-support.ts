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

export const scanContentSites = (files: Map<string, Uint8Array> = bagFiles): SentenceSites[] => {
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

export const aceSentenceKeys = (files: Map<string, Uint8Array> = bagFiles): string[] =>
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

export const scanRawContentSites = (files: Map<string, Uint8Array> = bagFiles): SentenceSites[] => {
  const names = [...files.keys()]
    .filter((name) => /^data\/guidelines\/[^/]+\/pl\/[^/]+\.pl$/u.test(name))
    .sort();
  const source = names
    .map((name) => `\n% file:${name}\n${Buffer.from(files.get(name) ?? []).toString('utf8')}`)
    .join('\n');
  const rows: SentenceSites[] = [];
  let document = '';
  let current: SentenceSites | undefined;
  for (const [index, line] of source.split('\n').entries()) {
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
    const boundary = line.indexOf(' :- ');
    current.sites.push({
      line: index + 1,
      head: boundary < 0 ? line.slice(0, -1) : line.slice(0, boundary),
      body: boundary < 0 ? 'true' : line.slice(boundary + 4, -1),
    });
  }
  return rows;
};

export interface PremiseRecord {
  readonly document: string;
  readonly sentence: number;
  readonly ordinal: number;
  readonly literal: string;
}

export const parsePremiseRecords = (helper: string = artifacts.helper): PremiseRecord[] =>
  helper
    .split('\n')
    .filter((line) => line.startsWith('clinical_premise('))
    .map((line) => {
      const match = /^clinical_premise\('([^']+)',(\d+),(\d+),\((.*)\)\)\.$/u.exec(line);
      if (match === null) throw new Error(`malformed generated premise: ${line}`);
      return {
        document: match[1] ?? '',
        sentence: Number(match[2]),
        ordinal: Number(match[3]),
        literal: match[4] ?? '',
      };
    });

const stripOuter = (source: string): string => {
  let text = source.trim();
  while (text.startsWith('(') && balancedEnd(text, 0) === text.length) {
    text = text.slice(1, -1).trim();
  }
  return text;
};

const splitConjunction = (source: string): string[] => {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '\\') index += 1;
      else if (char === "'" && source[index + 1] === "'") index += 1;
      else if (char === "'") quoted = false;
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0 && char === ',') {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    } else if (
      depth === 0 &&
      (char === ';' || source.startsWith('->', index) || source.startsWith('*->', index))
    ) {
      throw new Error('unsupported control in independent premise oracle');
    }
  }
  parts.push(source.slice(start).trim());
  return parts;
};

export const positiveGoals = (source: string): string[] => {
  const text = stripOuter(source);
  if (text === 'true' || text.startsWith('\\+')) return [];
  const parts = splitConjunction(text);
  return parts.length === 1 ? [text] : parts.flatMap(positiveGoals);
};

const quotedAtomEnd = (source: string, start: number): number => {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') index += 1;
    else if (source[index] === "'" && source[index + 1] === "'") index += 1;
    else if (source[index] === "'") return index + 1;
  }
  throw new Error('unterminated atom in independent grounding oracle');
};

const canonicalVariables = (terms: readonly string[]): string[] => {
  const variables = new Map<string, string>();
  let ordinal = 0;
  let anonymous = 0;
  return terms.map((source) => {
    let result = '';
    for (let index = 0; index < source.length;) {
      const char = source[index] ?? '';
      if (char === "'") {
        const end = quotedAtomEnd(source, index);
        result += source.slice(index, end);
        index = end;
        continue;
      }
      if (/[A-Za-z_]/u.test(char)) {
        let end = index + 1;
        while (end < source.length && /[A-Za-z0-9_]/u.test(source[end] ?? '')) end += 1;
        const token = source.slice(index, end);
        if (/^[A-Z_]/u.test(token)) {
          const key = token === '_' ? `#anonymous-${String(anonymous++)}` : token;
          let replacement = variables.get(key);
          if (replacement === undefined) {
            replacement = `⟦v${String(ordinal)}⟧`;
            variables.set(key, replacement);
            ordinal += 1;
          }
          result += replacement;
        } else result += token;
        index = end;
        continue;
      }
      result += char;
      index += 1;
    }
    return result;
  });
};

export const canonicalSourceTerms = (terms: readonly string[]): string[] =>
  canonicalVariables(terms);

export const replaceVariablesOutsideAtoms = (source: string, replacement: string): string => {
  let result = '';
  for (let index = 0; index < source.length;) {
    const char = source[index] ?? '';
    if (char === "'") {
      const end = quotedAtomEnd(source, index);
      result += source.slice(index, end);
      index = end;
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/u.test(source[end] ?? '')) end += 1;
      const token = source.slice(index, end);
      result += /^[A-Z_]/u.test(token) ? replacement : token;
      index = end;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
};

export const canonicalGeneratedTerms = (
  terms: readonly string[],
  document: string,
  sentence: number,
): string[] => {
  const skolems = new Map<string, string>();
  let ordinal = 0;
  return terms.map((term) =>
    term.replace(
      /'\$clinical_hypothetical'\('([^']+)',(\d+),(\d+)\)/gu,
      (whole, actualDocument: string, actualSentence: string) => {
        if (actualDocument !== document || Number(actualSentence) !== sentence) {
          throw new Error(`${keyOf(document, sentence)}: foreign skolem ${whole}`);
        }
        let replacement = skolems.get(whole);
        if (replacement === undefined) {
          replacement = `⟦v${String(ordinal)}⟧`;
          skolems.set(whole, replacement);
          ordinal += 1;
        }
        return replacement;
      },
    ),
  );
};

export const filePath = (files: Map<string, Uint8Array>, suffix: string): string => {
  const matches = [...files.keys()].filter((name) => name.endsWith(suffix));
  if (matches.length !== 1)
    throw new Error(`${suffix}: expected one file, found ${String(matches.length)}`);
  return matches[0] ?? '';
};

export const replaceFileText = (
  files: Map<string, Uint8Array>,
  suffix: string,
  transform: (text: string) => string,
): Map<string, Uint8Array> => {
  const path = filePath(files, suffix);
  const copy = new Map(files);
  copy.set(path, Buffer.from(transform(Buffer.from(files.get(path) ?? []).toString('utf8'))));
  return copy;
};

export const mutatePlSentence = (
  files: Map<string, Uint8Array>,
  document: string,
  sentence: number,
  transform: (line: string, index: number) => string,
): Map<string, Uint8Array> =>
  replaceFileText(files, `/pl/${document}.pl`, (text) => {
    let current = 0;
    let index = 0;
    return text
      .split('\n')
      .map((line) => {
        const marker = /^% S([1-9][0-9]*):/u.exec(line);
        if (marker !== null) {
          current = Number(marker[1]);
          index = 0;
          return line;
        }
        if (current !== sentence || !line.startsWith('guideline_')) return line;
        const changed = transform(line, index);
        index += 1;
        return changed;
      })
      .join('\n');
  });
