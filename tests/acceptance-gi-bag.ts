// Independent expectations: verified export bytes alone; no graph/clinical producer imports.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from '../tools/kb/bag.mjs';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('acceptance oracle: vendored bag missing');
export const bag = verifyBag(readFileSync(join(ROOT, 'kb', archive)));

export interface SourceSentence {
  document: string;
  sentence: number;
  text: string;
}
export interface ScopeCondition {
  body: string;
  sources: SourceSentence[];
}
export interface SupersessionRecord extends SourceSentence {
  citation: string;
  url: string;
  date: string;
}

// Alpha-equivalence preserves quoted atoms, repeated variables, and anonymous-variable freshness.
export const alpha = (source: string): string => {
  const names = new Map<string, string>();
  let anonymous = 0;
  return source.replace(/'(?:''|\\.|[^'\\])*'|\b[A-Z_][A-Za-z0-9_]*\b/gu, (token) => {
    if (token.startsWith("'")) return token;
    const key = token === '_' ? `anonymous:${String(anonymous++)}` : token;
    const value = names.get(key) ?? `V${String(names.size)}`;
    names.set(key, value);
    return value;
  });
};

export const sentenceKey = ({
  document,
  sentence,
}: Pick<SourceSentence, 'document' | 'sentence'>): string => `${document}:${String(sentence)}`;
const decodeAtom = (value: string): string => value.replace(/''/gu, "'").replace(/\\'/gu, "'");
const iso = (value: string): string =>
  `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
export const sentences: SourceSentence[] = [];
export const scopeConditions: ScopeCondition[] = [];
export const supersessionRecords: SupersessionRecord[] = [];
const byBody = new Map<string, ScopeCondition>();

for (const [path, bytes] of bag.files) {
  const file = /\/pl\/([^/]+)\.pl$/u.exec(path);
  if (file === null) continue;
  const document = file[1] ?? '';
  let current: SourceSentence | undefined;
  for (const line of Buffer.from(bytes).toString('utf8').split('\n')) {
    const marker = /^% S([1-9][0-9]*):\s*(.*)$/u.exec(line);
    if (marker !== null) {
      current = { document, sentence: Number(marker[1]), text: marker[2] ?? '' };
      sentences.push(current);
      continue;
    }
    if (current === undefined) continue;
    const exclusion = /^guideline_exclusion\('[^']+'\) :- (.*)\.$/u.exec(line);
    if (exclusion !== null) {
      const body = alpha(exclusion[1] ?? '');
      let condition = byBody.get(body);
      if (condition === undefined) {
        condition = { body, sources: [] };
        byBody.set(body, condition);
        scopeConditions.push(condition);
      }
      condition.sources.push({ ...current });
    }
    const supersession =
      /^guideline_supersession\('((?:''|[^'])*)',(\d+),source\('((?:''|[^'])*)','((?:''|[^'])*)'\),(\d{8})\)\.$/u.exec(
        line,
      );
    if (supersession !== null) {
      supersessionRecords.push({
        ...current,
        document: decodeAtom(supersession[1] ?? ''),
        sentence: Number(supersession[2]),
        citation: decodeAtom(supersession[3] ?? ''),
        url: decodeAtom(supersession[4] ?? ''),
        date: iso(supersession[5] ?? ''),
      });
    }
  }
}

if (sentences.length === 0 || scopeConditions.length !== 8 || supersessionRecords.length !== 3) {
  throw new Error(
    `acceptance oracle: sentences=${String(sentences.length)}, exclusions=${String(scopeConditions.length)}, supersessions=${String(supersessionRecords.length)}`,
  );
}
