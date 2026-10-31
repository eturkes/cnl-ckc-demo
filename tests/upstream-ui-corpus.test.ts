// n33: upstream's `tests/ui/` fixture corpus, vendored at the release's tag commit, held against the
// provenance port (`tools/kb/provenance.mjs`). Each family whose target the port implements runs
// through `deriveProvenance` over its own tree: a green family joins, a red one is refused by the
// port's reason for the refusal upstream records. Every other family is named beside the surface
// the port lacks, so a family upstream adds fails the classification case until it is placed.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { deriveProvenance, ProvenanceError } from '../tools/kb/provenance.mjs';

// The corpus alone: no shared support module, whose import derives the whole shipped bag.
const CORPUS = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  'vendor',
  'cnl-ckc',
  'tests',
  'ui',
);

type Verdict = { joins: true } | { reason: string; upstream: string };

/**
 * The families whose target is a port surface: coverage grammar, evidence payloads, alignment,
 * identifiers, strict text decoding and the representation inventory. `upstream` is the first
 * line upstream's reviewer prints (`check.stderr.expect`). `duplicate-docid-order`: upstream's
 * reviewer names the sorted-first duplicate, `a-10`; the port names the first repeat in coverage
 * order, `z`, as upstream's own coverage grammar does (`check.rs` `parse_rows`).
 */
const APPLICABLE: Record<string, Verdict> = {
  'green/basic': { joins: true },
  'green/highlight': { joins: true },
  'green/length-boundary': { joins: true },
  'green/locatorless-boundary': { joins: true },
  'green/payload-selection': { joins: true },
  'green/unicode-digit-region': { joins: true },
  'red/align-one-sided': {
    reason: 'alignment-groups',
    upstream: 'ui: viewmodel: hl doc h-1 align: every group needs both a src span and an ace span',
  },
  'red/align-overlap': {
    reason: 'alignment-overlap',
    upstream: 'ui: viewmodel: hl doc h-1 align: overlapping ace spans',
  },
  'red/align-span-mismatch': {
    reason: 'alignment-span',
    upstream: 'ui: viewmodel: hl doc h-1 align: row 1: span does not match the text at start',
  },
  'red/coverage-restates-unclosed': {
    reason: 'coverage-status',
    upstream: 'ui: viewmodel: alpha malformed coverage row: r9',
  },
  'red/coverage-uncovered-noreason': {
    reason: 'coverage-status',
    upstream: 'ui: viewmodel: alpha malformed coverage row: r9',
  },
  'red/coverage-unknown-status': {
    reason: 'coverage-status',
    upstream: 'ui: viewmodel: alpha malformed coverage row: r9',
  },
  'red/duplicate-docid': {
    reason: 'duplicate-document',
    upstream: 'ui: viewmodel: alpha duplicate docid a',
  },
  'red/duplicate-docid-order': {
    reason: 'duplicate-document',
    upstream: 'ui: viewmodel: alpha duplicate docid a-10',
  },
  'red/duplicate-locator': {
    reason: 'extraction-locator',
    upstream: 'ui: viewmodel: alpha duplicate region locator r1 in source/evidence.txt',
  },
  'red/empty-payload': {
    reason: 'extraction-locator',
    upstream: 'ui: viewmodel: alpha doc a region r1 has empty payload',
  },
  'red/first-violation-t1-before-t2': {
    reason: 'duplicate-document',
    upstream: 'ui: viewmodel: alpha duplicate docid a',
  },
  'red/invalid-docid': { reason: 'invalid-id', upstream: 'ui: viewmodel: alpha invalid docid Bad' },
  'red/invalid-guideline-id': {
    reason: 'invalid-id',
    upstream: 'ui: viewmodel: Bad invalid guideline id',
  },
  'red/invalid-utf8-ace': {
    reason: 'invalid-utf8',
    upstream: 'ui: viewmodel: alpha file not UTF-8: ace/a.ace',
  },
  'red/invalid-utf8-coverage': {
    reason: 'invalid-utf8',
    upstream: 'ui: viewmodel: alpha file not UTF-8: coverage.tsv',
  },
  'red/invalid-utf8-prolog': {
    reason: 'invalid-utf8',
    upstream: 'ui: viewmodel: alpha file not UTF-8: pl/a.pl',
  },
  'red/invalid-utf8-source': {
    reason: 'invalid-utf8',
    upstream: 'ui: viewmodel: alpha file not UTF-8: source/evidence.txt',
  },
  'red/locatorless-census-mismatch': {
    reason: 'ordinal-census',
    upstream: 'ui: viewmodel: alpha region census mismatch source/ordinal.txt',
  },
  'red/malformed-coverage-row': {
    reason: 'coverage-row',
    upstream: 'ui: viewmodel: alpha malformed coverage row: bad-row',
  },
  'red/missing-ace': {
    reason: 'missing-file',
    upstream: 'ui: viewmodel: alpha doc a missing ace file',
  },
  'red/missing-coverage': {
    reason: 'guideline-count',
    upstream: 'ui: viewmodel: alpha missing coverage.tsv',
  },
  'red/missing-guidelines': {
    reason: 'guideline-count',
    upstream: 'ui: viewmodel: missing guidelines directory',
  },
  'red/missing-pl': {
    reason: 'missing-file',
    upstream: 'ui: viewmodel: alpha doc a missing Prolog file',
  },
  'red/orphan-ace': {
    reason: 'file-orphan',
    upstream: 'ui: viewmodel: alpha orphan ace file ghost.ace',
  },
  'red/orphan-pl': {
    reason: 'file-orphan',
    upstream: 'ui: viewmodel: alpha orphan Prolog file ghost.pl',
  },
  'red/overlong-docid': { reason: 'invalid-id', upstream: 'ui: viewmodel: alpha invalid docid ' },
  'red/overlong-guideline-id': { reason: 'invalid-id', upstream: 'ui: viewmodel: g' },
  'red/region-resolve-failure': {
    reason: 'region-not-found',
    upstream: 'ui: viewmodel: alpha doc a region r1 unresolved in source/evidence.txt',
  },
};

/** The families whose target is a surface the port lacks, by that surface. */
const NOT_APPLICABLE: Record<string, readonly string[]> = {
  'the reviewer index over several guidelines': [
    'green/empty-guidelines',
    'green/multi-guideline-order',
  ],
  'HTML rendering and its escaping': [
    'green/escaped-href-text',
    'green/hostile',
    'green/q12-temporal-words',
    'green/q12-timing',
    'green/q13-temporal-words',
    'green/q13-timing',
    'green/superseded-spaceless-citation',
    'green/temporal-words',
    'green/timing',
    'red/copy-visible-hex',
    'red/verdict-get-form',
  ],
  'git tree selection': ['green/git-uncommitted-edit', 'green/git-untracked-document'],
  'the adjudication ledger and its verdict writes': [
    'green/header-only-ledger',
    'green/verdicts',
    'red/empty-ledger',
    'red/ledger-invalid',
    'red/malformed-adjudication-row',
    'red/unknown-ledger-docid',
    'red/verdict-artifact-drift',
    'red/verdict-artifact-drift-payload',
    'red/verdict-cas-conflict',
    'red/verdict-crash',
    'red/verdict-ledger-invalid',
    'red/verdict-manifest-derivation',
    'red/verdict-ok-append',
    'red/verdict-ok-create',
    'red/verdict-subject-drift',
  ],
  'the README title': [
    'green/missing-readme-fallback',
    'red/invalid-utf8-readme',
    'red/unsupported-control-bidi-readme',
    'red/unsupported-control-cr-readme',
    'red/unsupported-control-del-readme',
    'red/unsupported-control-isolate-readme',
    'red/unsupported-control-readme',
  ],
  "the source tree's review manifest and its audit digests": [
    'red/digest-mismatch-ace',
    'red/digest-mismatch-payload',
    'red/digest-precedence-ace',
    'red/digest-prefix-ace',
    'red/digest-prefix-payload',
    'red/digest-wrong-column',
    'red/doc-missing-manifest',
    'red/duplicate-review-manifest-doc',
    'red/invalid-utf8-manifest',
    'red/malformed-review-manifest-row',
    'red/manifest-missing-doc',
    'red/missing-audit',
    'red/missing-manifest-file',
  ],
  'HTTP request handling': [
    'red/http-403-foreign-host',
    'red/http-404',
    'red/http-404-doc-near-match',
    'red/http-404-gid-near-match',
    'red/http-405',
    'red/http-405-head',
    'red/http-digest-500',
    'red/http-digest-index-200',
    'red/http-ledger-500',
    'red/http-precedence-digest',
    'red/http-precedence-model',
    'red/http-traversal-404',
    'red/http-viewmodel-500',
    'red/method-matrix',
    'red/verdict-405',
    'red/verdict-csrf',
    'red/verdict-field-grammar',
    'red/verdict-host',
    'red/verdict-origin',
    'red/verdict-path-decode',
  ],
  'the upstream command-line grammar': ['red/usage-arity', 'red/verdict-request-cli'],
  'the vocabulary table': ['red/temporal-invalid'],
};

const families = ['green', 'red'].flatMap((kind) =>
  readdirSync(join(CORPUS, kind))
    .sort()
    .map((name) => `${kind}/${name}`),
);

/** Every file under a directory, by path relative to it. */
const treeFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) =>
        statSync(join(dir, name)).isDirectory()
          ? treeFiles(join(dir, name)).map((path) => `${name}/${path}`)
          : [name],
      )
    : [];

const ACE_STATUS = /^ace\(([^()]+)\)$/u;
const DOCUMENT_FACT = /^guideline_document\(('[^']*'|[a-z0-9-]+),[^\n]*\)\.$/u;

/**
 * A family's tree as the bag the port reads: `tree/guidelines/<id>/` → `data/guidelines/<id>/`,
 * every byte kept, plus the bag-only plumbing an upstream source tree lacks, none of it a family's
 * target: release labels (`release-manifest.tsv`, each coverage document `unreviewed`), one PDF
 * stand-in, a one-code-point alignment where a document has none (upstream's reviewer admits a
 * document without one; the bag always ships it), the schema's fourth `guideline_document`
 * argument, and a document fact in a coverage document's Prolog file holding no schema clause.
 */
const bagOf = (family: string): Map<string, Uint8Array> => {
  const tree = join(CORPUS, family, 'tree');
  const files = new Map<string, Uint8Array>();
  for (const path of treeFiles(join(tree, 'guidelines'))) {
    files.set(`data/guidelines/${path}`, readFileSync(join(tree, 'guidelines', path)));
  }
  const labels: string[] = [];
  for (const coveragePath of [...files.keys()].filter((path) => path.endsWith('/coverage.tsv'))) {
    const root = coveragePath.slice(0, -'/coverage.tsv'.length);
    const rows = Buffer.from(files.get(coveragePath) ?? [])
      .toString()
      .split('\n')
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => line.split('\t'));
    for (const [, , , , status = ''] of rows) {
      const document = ACE_STATUS.exec(status)?.[1];
      if (document === undefined) continue;
      labels.push(`label\t${document}\tunreviewed\n`);
      const alignPath = `${root}/align/${document}.tsv`;
      if (!files.has(alignPath)) {
        // Group 0 pairs the first code point of the passage with the first of the ACE text; the
        // passage starts the payload line, so its first code point is that line's.
        const ace = Buffer.from(files.get(`${root}/ace/${document}.ace`) ?? []).toString();
        files.set(
          alignPath,
          Buffer.from(
            `0\tsrc\t0\t${[...passageOf(files, root, rows, document)][0] ?? ''}\n0\tace\t0\t${[...ace][0] ?? ''}\n`,
          ),
        );
      }
      const plPath = `${root}/pl/${document}.pl`;
      const pl = files.get(plPath);
      if (pl !== undefined) files.set(plPath, withDocumentFact(pl, document));
    }
    if (
      ![...files.keys()].some((path) => path.startsWith(`${root}/source/`) && path.endsWith('.pdf'))
    ) {
      files.set(`${root}/source/fixture.pdf`, Buffer.from('%PDF-fixture\n'));
    }
  }
  files.set('release-manifest.tsv', Buffer.from(labels.join('')));
  return files;
};

/** A document's passage, read the way the extraction lays it out: the line after its locator, else its ordinal. */
const passageOf = (
  files: Map<string, Uint8Array>,
  root: string,
  rows: string[][],
  document: string,
): string => {
  const row = rows.find(([, , , , status = '']) => ACE_STATUS.exec(status)?.[1] === document) ?? [];
  const [region = '', file = ''] = row;
  const lines = Buffer.from(files.get(`${root}/${file}`) ?? [])
    .toString()
    .split('\n');
  const marker = lines.findIndex((line) => line.startsWith(`[${region} | `));
  const ordinal = rows.filter(([, rowFile]) => rowFile === file).indexOf(row);
  const payloads = lines.slice(lines.indexOf('') + 1).filter((line) => line !== '');
  const payload =
    marker >= 0 ? lines[marker + 1] : payloads[ordinal]?.replace(/^[1-9][0-9]*\. /u, '');
  return payload ?? '';
};

/**
 * Upstream's fixtures write `guideline_document/3`; the schema's fourth argument is appended. A file
 * holding no schema clause gains one document fact. Bytes are read and written as latin1, so an
 * invalid UTF-8 byte reaches the port unchanged.
 */
const withDocumentFact = (bytes: Uint8Array, document: string): Uint8Array => {
  const text = Buffer.from(bytes).toString('latin1');
  const lines = text
    .split('\n')
    .map((line) =>
      DOCUMENT_FACT.test(line) && line.split(',').length === 3
        ? `${line.slice(0, -2)},vocabulary(none)).`
        : line,
    );
  const fact = `guideline_document('${document}',ace_sha256(fixture),ulex(none),vocabulary(none)).`;
  if (!lines.some((line) => line.startsWith('guideline_'))) lines.push(fact, '');
  return Buffer.from(lines.join('\n'), 'latin1');
};

type Derived = ReturnType<typeof deriveProvenance>;

const outcome = (
  family: string,
): { joins: Derived; files: Map<string, Uint8Array> } | { reason: string; detail: string } => {
  const files = bagOf(family);
  try {
    return { joins: deriveProvenance(files), files };
  } catch (error) {
    if (!(error instanceof ProvenanceError)) throw error;
    return { reason: error.reason, detail: error.detail };
  }
};

/**
 * What a green family's join must hold, re-read from its own tree: one chunk per coverage
 * document, each carrying its coverage region, the passage its extraction lays out, its ACE text
 * and numbered sentences, the spans of a native alignment row for row, and its own clauses.
 */
const expectJoin = (family: string, derived: Derived, files: Map<string, Uint8Array>): void => {
  const [coveragePath = ''] = [...files.keys()].filter((path) => path.endsWith('/coverage.tsv'));
  const root = coveragePath.slice(0, -'/coverage.tsv'.length);
  const rows = Buffer.from(files.get(coveragePath) ?? [])
    .toString()
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.split('\t'));
  const documents = rows.flatMap(([region = '', file = '', page = '', , status = '']) => {
    const id = ACE_STATUS.exec(status)?.[1];
    return id === undefined ? [] : [{ id, region, file, page: Number(page.slice(1)) }];
  });
  expect(
    derived.chunks.map(({ document }) => document),
    family,
  ).toEqual(documents.map(({ id }) => id).sort());
  for (const { id, region, file, page } of documents) {
    const chunk = derived.chunks.find(({ document }) => document === id);
    const model = chunk?.model as {
      region: { id: string; sourceFile: string; page: number };
      source: { text: string };
      ace: { text: string; sentences: { number: number; text: string }[] };
      alignment: { spans: { group: number; side: string; start: number; text: string }[] };
      clauses: { text: string }[];
    };
    const at = `${family} ${id}`;
    expect(chunk?.path, at).toBe(`provenance/documents/${id}.json`);
    expect(model.region, at).toMatchObject({ id: region, sourceFile: file, page });
    expect(model.source.text, at).toBe(passageOf(files, root, rows, id));
    const ace = Buffer.from(files.get(`${root}/ace/${id}.ace`) ?? [])
      .toString()
      .replace(/\n$/u, '');
    expect(model.ace.text, at).toBe(ace);
    expect(model.ace.sentences, at).toEqual(
      ace.split('\n').map((text, index) => ({ number: index + 1, text })),
    );
    const native = join(
      CORPUS,
      family,
      'tree',
      'guidelines',
      root.slice('data/guidelines/'.length),
      'align',
      `${id}.tsv`,
    );
    if (existsSync(native)) {
      const spans = readFileSync(native, 'utf8')
        .split('\n')
        .filter((line) => line !== '' && !line.startsWith('#'))
        .map((line) => line.split('\t'))
        .map(([group = '', side = '', start = '', text = '']) => ({
          group: Number(group),
          side: side === 'src' ? 'source' : side,
          start: Number(start),
          text,
        }));
      expect(
        model.alignment.spans.map(({ group, side, start, text }) => ({ group, side, start, text })),
        at,
      ).toEqual(spans);
    }
    const schema = Buffer.from(files.get(`${root}/pl/${id}.pl`) ?? [])
      .toString()
      .split('\n')
      .filter((line) => line.startsWith('guideline_'));
    expect(schema.length, at).toBeGreaterThan(0);
    expect(
      model.clauses.map(({ text }) => text),
      at,
    ).toEqual(schema);
  }
  expect(derived.stats.documents, family).toBe(documents.length);
};

describe('upstream tests/ui corpus', () => {
  it('U1 places every family once: applicable to the port, or named beside the surface it lacks', () => {
    const named = Object.values(NOT_APPLICABLE).flat();
    const placed = [...Object.keys(APPLICABLE), ...named];
    expect(families.length).toBe(107);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(families);
  });

  it('U2 each applicable red family records the refusal the table maps', () => {
    for (const [family, verdict] of Object.entries(APPLICABLE)) {
      const recorded = join(CORPUS, family, 'check.stderr.expect');
      if ('joins' in verdict) {
        expect(existsSync(recorded), family).toBe(false);
        continue;
      }
      const [first = ''] = readFileSync(recorded, 'utf8').split('\n');
      expect(first.startsWith(verdict.upstream), `${family}: ${first}`).toBe(true);
    }
  });

  it.each(Object.entries(APPLICABLE))('U3 %s', (family, verdict) => {
    const result = outcome(family);
    if ('joins' in verdict) {
      if (!('joins' in result))
        throw new Error(`${family}: refused ${result.reason}: ${result.detail}`);
      expectJoin(family, result.joins, result.files);
    } else expect(result, family).toMatchObject({ reason: verdict.reason });
  });
});
