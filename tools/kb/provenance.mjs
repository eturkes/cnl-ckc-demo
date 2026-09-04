// Deterministic provenance assets derived directly from a verified BagIt file map.
//
// The browser never parses the distribution's TSV or Prolog formats. This module
// resolves those joins once at build time, rejects ambiguous input, and emits a
// small line-to-document index plus one independently addressable document chunk.

import { payloadDocuments } from './payload.mjs';

const GUIDELINE_ID = /^[a-z0-9](?:[a-z0-9-]{0,249})$/u;
const REGION_ID = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,249})$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const PAGE = /^p([1-9][0-9]*)$/u;
const SOURCE_PATH = /^source\/[A-Za-z0-9][A-Za-z0-9._-]*\.txt$/u;
const PDF_PATH = /^source\/[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/u;

export const PROVENANCE_SCHEMA_VERSION = 1;
export const CLAUSE_INDEX_PATH = 'provenance/clause-index.json';
export const PDF_ASSET_PATH = 'provenance/guideline.pdf';

/** @typedef {'approved' | 'rejected' | 'contested' | 'stale' | 'unreviewed'} ReviewLabel */
/** @typedef {'fact' | 'rule'} ClauseKind */
/** @typedef {'source' | 'ace'} AlignmentSide */
/**
 * @typedef {{ name: string, args: string[], source: string }} PrologCall
 * @typedef {{ line: number, document: string, sentence: number | null,
 *   predicate: string, arity: number, kind: ClauseKind, text: string,
 *   head: PrologCall, body: PrologCall[] }} ClauseSite
 * @typedef {{ region: string, file: string, page: number, section: string,
 *   status: string, document: string | null, raw: string }} CoverageRow
 * @typedef {{ group: number, side: AlignmentSide, start: number, end: number,
 *   text: string }} AlignmentSpan
 */

/** A typed refusal prevents a half-resolved provenance record from being emitted. */
export class ProvenanceError extends Error {
  /** @param {string} reason @param {string} detail */
  constructor(reason, detail) {
    super(`${reason}: ${detail}`);
    this.name = 'ProvenanceError';
    this.reason = reason;
    this.detail = detail;
  }
}

/** @param {string} reason @param {string} detail @returns {never} */
const refuse = (reason, detail) => {
  throw new ProvenanceError(reason, detail);
};

/** Stable, human-inspectable generated JSON. @param {unknown} value */
export const generatedJson = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');

/** @param {Map<string, Uint8Array>} files @param {string} path */
const bytesAt = (files, path) => files.get(path) ?? refuse('missing-file', path);

/**
 * Decode consumed textual inputs strictly. Tabs and LF are the only controls the
 * distribution formats need; CR and directional controls are rejected.
 *
 * @param {Uint8Array} bytes
 * @param {string} path
 */
const decodeText = (bytes, path) => {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    return refuse('invalid-utf8', `${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(text)) refuse('unsupported-control', path);
  if (/[\u202a-\u202e\u2066-\u2069]/u.test(text)) refuse('unsupported-bidi', path);
  if (text.includes('\r')) refuse('carriage-return', path);
  return text;
};

/** @param {Map<string, Uint8Array>} files @param {string} path */
const textAt = (files, path) => decodeText(bytesAt(files, path), path);

/** @param {string} text @param {string} path */
const requireFinalLf = (text, path) => {
  if (!text.endsWith('\n')) refuse('missing-final-lf', path);
  return text.slice(0, -1);
};

/** @param {string} id @param {string} what */
const requireId = (id, what) => {
  if (!GUIDELINE_ID.test(id) || Buffer.byteLength(id, 'utf8') > 250) refuse('invalid-id', `${what}: ${id}`);
  return id;
};

/** @param {string} id @param {string} what */
const requireRegion = (id, what) => {
  if (!REGION_ID.test(id) || Buffer.byteLength(id, 'utf8') > 250) refuse('invalid-region', `${what}: ${id}`);
  return id;
};

/** @param {string} path */
const directSourcePath = (path) => {
  if (!SOURCE_PATH.test(path) || path.includes('..') || path.includes('\\')) {
    refuse('unsafe-source-path', path);
  }
  return path;
};

/** @param {Map<string, Uint8Array>} files */
const guidelineRoot = (files) => {
  const matches = [...files.keys()]
    .map((path) => /^data\/guidelines\/([^/]+)\/coverage\.tsv$/u.exec(path))
    .filter((match) => match !== null);
  if (matches.length !== 1) refuse('guideline-count', `expected 1 coverage file, found ${matches.length}`);
  const id = requireId(/** @type {RegExpExecArray} */ (matches[0])[1] ?? '', 'guideline');
  return { id, root: `data/guidelines/${id}` };
};

/** @param {string} source @param {string} path */
const dataLines = (source, path) =>
  requireFinalLf(source, path)
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'));

/** @param {Map<string, Uint8Array>} files @param {string} root */
const parseCoverage = (files, root) => {
  const path = `${root}/coverage.tsv`;
  /** @type {CoverageRow[]} */
  const rows = [];
  /** @type {Map<string, CoverageRow>} */
  const regions = new Map();
  /** @type {Map<string, CoverageRow>} */
  const documents = new Map();
  for (const [index, line] of dataLines(textAt(files, path), path).entries()) {
    const fields = line.split('\t');
    if (fields.length !== 5) refuse('coverage-row', `${path}:${index + 1}`);
    const [rawRegion = '', rawFile = '', rawPage = '', section = '', status = ''] = fields;
    const region = requireRegion(rawRegion, `${path}:${index + 1}`);
    const file = directSourcePath(rawFile);
    const pageMatch = PAGE.exec(rawPage);
    if (pageMatch === null || section === '') refuse('coverage-row', `${path}:${index + 1}`);
    if (regions.has(region)) refuse('duplicate-region', region);
    /** @type {string | null} */
    let document = null;
    const ace = /^ace\(([^()]+)\)$/u.exec(status);
    if (ace !== null) {
      document = requireId(ace[1] ?? '', `${path}:${index + 1} document`);
      if (documents.has(document)) refuse('duplicate-document', document);
    } else if (
      status !== 'pending' &&
      !/^restates\([A-Za-z0-9][A-Za-z0-9-]*\)$/u.test(status) &&
      !/^uncovered\((?:heading|process|external|aim|descriptive|notice): [^\r\n]+\)$/u.test(status)
    ) {
      refuse('coverage-status', `${path}:${index + 1}: ${status}`);
    }
    const row = {
      region,
      file,
      page: Number(pageMatch[1]),
      section,
      status,
      document,
      raw: line,
    };
    rows.push(row);
    regions.set(region, row);
    if (document !== null) documents.set(document, row);
  }
  if (documents.size === 0) refuse('coverage-empty', path);
  return { rows, documents };
};

/** @param {Map<string, Uint8Array>} files @param {string} root */
const parseProjectionNotes = (files, root) => {
  const path = `${root}/audit/projection-notes.tsv`;
  /** @type {Map<string, { region: string, kept: string, dropped: string }>} */
  const notes = new Map();
  for (const [index, line] of dataLines(textAt(files, path), path).entries()) {
    const fields = line.split('\t');
    if (fields.length !== 4) refuse('projection-row', `${path}:${index + 1}`);
    const [rawDocument = '', rawRegion = '', kept = '', dropped = ''] = fields;
    const document = requireId(rawDocument, `${path}:${index + 1}`);
    const region = requireRegion(rawRegion, `${path}:${index + 1}`);
    if (kept === '' || dropped === '' || notes.has(document)) {
      refuse('projection-row', `${path}:${index + 1}`);
    }
    notes.set(document, { region, kept, dropped });
  }
  return notes;
};

/** @param {Map<string, Uint8Array>} files */
const parseReleaseLabels = (files) => {
  const path = 'release-manifest.tsv';
  /** @type {Map<string, ReviewLabel>} */
  const labels = new Map();
  const accepted = new Set(['approved', 'rejected', 'contested', 'stale', 'unreviewed']);
  for (const [index, line] of requireFinalLf(textAt(files, path), path).split('\n').entries()) {
    if (!line.startsWith('label\t')) continue;
    const fields = line.split('\t');
    if (fields.length !== 3) refuse('label-row', `${path}:${index + 1}`);
    const document = requireId(fields[1] ?? '', `${path}:${index + 1}`);
    const rawLabel = fields[2] ?? '';
    if (!accepted.has(rawLabel) || labels.has(document)) refuse('label-row', `${path}:${index + 1}`);
    labels.set(document, /** @type {ReviewLabel} */ (rawLabel));
  }
  return labels;
};

/**
 * Parse extraction text once. Bracketed files address payloads by locator;
 * locator-free Box 3 addresses them by coverage-row ordinal.
 *
 * @param {string} text
 * @param {string} path
 */
const parseExtraction = (text, path) => {
  const content = requireFinalLf(text, path);
  const lines = content.split('\n');
  const firstBlank = lines.indexOf('');
  if (firstBlank < 0) refuse('extraction-header', path);
  const censusMatch = /(?:identify|identifies) (?:the )?([1-9][0-9]*) payloads below/iu.exec(
    lines.slice(0, firstBlank).join('\n'),
  );
  /** @type {Map<string, { text: string, page: number, section: string }>} */
  const locators = new Map();
  const marker = /^\[([^\]| ]+) \| (p[1-9][0-9]*) \| ([^\]]+)\]$/u;
  for (let index = firstBlank + 1; index < lines.length; index += 1) {
    const match = marker.exec(lines[index] ?? '');
    if (match === null) continue;
    const region = requireRegion(match[1] ?? '', `${path}:${index + 1}`);
    const payload = lines[index + 1];
    if (payload === undefined || payload === '' || marker.test(payload) || locators.has(region)) {
      refuse('extraction-locator', `${path}:${index + 1}`);
    }
    locators.set(region, {
      text: payload,
      page: Number((PAGE.exec(match[2] ?? '') ?? [])[1]),
      section: match[3] ?? '',
    });
    index += 1;
  }
  if (locators.size > 0) {
    if (censusMatch !== null && Number(censusMatch[1]) !== locators.size) {
      refuse('extraction-census', `${path}: declared ${censusMatch[1]}, found ${locators.size}`);
    }
    return { locators, ordered: /** @type {string[]} */ ([]) };
  }
  const ordered = lines
    .slice(firstBlank + 1)
    .filter((line) => line !== '')
    .map((line) => line.replace(/^[1-9][0-9]*\. /u, ''));
  if (censusMatch === null || Number(censusMatch[1]) !== ordered.length) {
    refuse('extraction-census', `${path}: declared ${censusMatch?.[1] ?? 'none'}, found ${ordered.length}`);
  }
  return { locators, ordered };
};

/**
 * @param {CoverageRow} row
 * @param {CoverageRow[]} sameFileRows
 * @param {{ locators: Map<string, { text: string, page: number, section: string }>, ordered: string[] }} extraction
 */
const passageFor = (row, sameFileRows, extraction) => {
  if (extraction.locators.size > 0) {
    const located = extraction.locators.get(row.region) ?? refuse('region-not-found', row.region);
    if (located.page !== row.page || located.section !== row.section) {
      refuse('region-metadata', row.region);
    }
    return located.text;
  }
  if (sameFileRows.length !== extraction.ordered.length) {
    refuse('ordinal-census', `${row.file}: coverage ${sameFileRows.length}, payloads ${extraction.ordered.length}`);
  }
  const ordinal = sameFileRows.indexOf(row);
  if (ordinal < 0) refuse('ordinal-region', row.region);
  return extraction.ordered[ordinal] ?? refuse('ordinal-region', row.region);
};

/** Split comma-separated Prolog arguments without interpreting their values. @param {string} source */
export const splitTopLevel = (source) => {
  /** @type {string[]} */
  const fields = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === "'" && source[index + 1] === "'") index += 1;
      else if (char === "'") quoted = false;
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === '(') round += 1;
    else if (char === ')') round -= 1;
    else if (char === '[') square += 1;
    else if (char === ']') square -= 1;
    else if (char === ',' && round === 0 && square === 0) {
      fields.push(source.slice(start, index).trim());
      start = index + 1;
    }
    if (round < 0 || square < 0) refuse('prolog-balance', source);
  }
  if (quoted || round !== 0 || square !== 0) refuse('prolog-balance', source);
  fields.push(source.slice(start).trim());
  if (fields.some((field) => field === '')) refuse('prolog-argument', source);
  return fields;
};

/** @param {string} source @returns {PrologCall} */
export const parsePrologCall = (source) => {
  const open = source.indexOf('(');
  if (open <= 0 || !source.endsWith(')')) refuse('prolog-call', source);
  const name = source.slice(0, open);
  if (!/^guideline_[a-z_]+$/u.test(name)) refuse('prolog-predicate', name);
  return { name, args: splitTopLevel(source.slice(open + 1, -1)), source };
};

/** Extract every schema call from a generated rule body. @param {string} source */
const bodyCalls = (source) => {
  /** @type {PrologCall[]} */
  const calls = [];
  const pattern = /guideline_[a-z_]+\(/gu;
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    if (start === undefined) continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = -1;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === "'" && source[index + 1] === "'") index += 1;
        else if (char === "'") quoted = false;
        continue;
      }
      if (char === "'") quoted = true;
      else if (char === '(') depth += 1;
      else if (char === ')' && --depth === 0) {
        end = index;
        break;
      }
    }
    if (end < 0) refuse('prolog-body', source);
    calls.push(parsePrologCall(source.slice(start, end + 1)));
  }
  return calls;
};

const ARITIES = new Map([
  ['guideline_schema_version', 1],
  ['guideline_document', 3],
  ['guideline_entity', 4],
  ['guideline_cardinality', 5],
  ['guideline_event', 3],
  ['guideline_arg', 4],
  ['guideline_pp', 4],
  ['guideline_property', 4],
  ['guideline_operator', 3],
]);

/**
 * Parse the exact source string fed to SWI. Array position + 1 is therefore the
 * same line_count reported by clause_property/2 in the saved image.
 *
 * @param {Map<string, Uint8Array>} files
 * @returns {ClauseSite[]}
 */
export const parseClauseSites = (files) => {
  const { source, names } = payloadDocuments(files);
  const expectedNames = new Set(names);
  /** @type {ClauseSite[]} */
  const clauses = [];
  /** @type {string | null} */
  let document = null;
  /** @type {number | null} */
  let sentence = null;
  for (const [offset, line] of source.split('\n').entries()) {
    if (line.startsWith('% file:')) {
      const path = line.slice('% file:'.length);
      if (!expectedNames.has(path)) refuse('prolog-marker', path);
      const match = /\/pl\/([^/]+)\.pl$/u.exec(path);
      document = requireId(match?.[1] ?? '', 'Prolog filename');
      sentence = null;
      continue;
    }
    const sentenceMatch = /^% S([1-9][0-9]*):/u.exec(line);
    if (sentenceMatch !== null) {
      sentence = Number(sentenceMatch[1]);
      continue;
    }
    if (!line.startsWith('guideline_')) continue;
    if (document === null || !line.endsWith('.')) refuse('prolog-clause', `line ${offset + 1}`);
    const text = line.slice(0, -1);
    const ruleAt = text.indexOf(' :- ');
    const headSource = ruleAt < 0 ? text : text.slice(0, ruleAt);
    const bodySource = ruleAt < 0 ? '' : text.slice(ruleAt + 4);
    const head = parsePrologCall(headSource);
    const arity = ARITIES.get(head.name);
    if (arity === undefined || head.args.length !== arity) {
      refuse('prolog-arity', `${head.name}/${head.args.length}`);
    }
    const documentFact = head.name === 'guideline_document' ? atomText(head.args[0] ?? '') : null;
    if (documentFact !== null && documentFact !== document) refuse('prolog-document', `${documentFact} != ${document}`);
    const idMatch = /'\$guideline_id'\((?:context|product|witness),'([^']+)',([1-9][0-9]*),/u.exec(
      head.source,
    );
    const clauseSentence =
      head.name === 'guideline_schema_version' || head.name === 'guideline_document'
        ? null
        : idMatch === null
          ? sentence
          : Number(idMatch[2]);
    if (idMatch !== null && (idMatch[1] !== document || clauseSentence !== sentence)) {
      refuse('prolog-sentence', `line ${offset + 1}`);
    }
    const body = bodySource === '' ? [] : bodyCalls(bodySource);
    for (const call of body) {
      const expected = ARITIES.get(call.name);
      if (expected === undefined || call.args.length !== expected) {
        refuse('prolog-body-arity', `${call.name}/${call.args.length}`);
      }
    }
    clauses.push({
      line: offset + 1,
      document,
      sentence: clauseSentence,
      predicate: head.name,
      arity,
      kind: ruleAt < 0 ? 'fact' : 'rule',
      text: line,
      head,
      body,
    });
  }
  if (clauses.length === 0) refuse('prolog-empty', 'no schema clauses');
  return clauses;
};

/** Decode the simple atoms used as graph labels and document ids. @param {string} term */
export const atomText = (term) => {
  const value = term.trim();
  if (/^[a-z][A-Za-z0-9_-]*$/u.test(value)) return value;
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value
      .slice(1, -1)
      .replace(/''/gu, "'")
      .replace(/\\([\\'])/gu, '$1');
  }
  return null;
};

/**
 * @param {string} text
 * @param {string} ace
 * @param {string} source
 * @param {string} path
 * @returns {AlignmentSpan[]}
 */
const parseAlignment = (text, ace, source, path) => {
  const rows = dataLines(text, path);
  if (rows.length === 0) refuse('alignment-empty', path);
  /** @type {AlignmentSpan[]} */
  const spans = [];
  const codepoints = { ace: Array.from(ace), source: Array.from(source) };
  const groups = { ace: new Set(), source: new Set() };
  for (const [index, line] of rows.entries()) {
    const fields = line.split('\t');
    if (fields.length !== 4) refuse('alignment-row', `${path}:${index + 1}`);
    const [rawGroup = '', rawSide = '', rawStart = '', surface = ''] = fields;
    if (!DECIMAL.test(rawGroup) || !DECIMAL.test(rawStart) || surface === '') {
      refuse('alignment-row', `${path}:${index + 1}`);
    }
    const side = rawSide === 'src' ? 'source' : rawSide === 'ace' ? 'ace' : null;
    if (side === null) refuse('alignment-side', `${path}:${index + 1}`);
    const group = Number(rawGroup);
    const start = Number(rawStart);
    const width = Array.from(surface).length;
    const end = start + width;
    if (codepoints[side].slice(start, end).join('') !== surface) {
      refuse('alignment-span', `${path}:${index + 1}`);
    }
    groups[side].add(group);
    spans.push({ group, side, start, end, text: surface });
  }
  const aceGroups = [...groups.ace].sort((left, right) => left - right);
  const sourceGroups = [...groups.source].sort((left, right) => left - right);
  if (JSON.stringify(aceGroups) !== JSON.stringify(sourceGroups)) refuse('alignment-groups', path);
  for (const side of /** @type {const} */ (['source', 'ace'])) {
    const ordered = spans
      .filter((span) => span.side === side)
      .sort((left, right) => left.start - right.start || left.end - right.end);
    for (let index = 1; index < ordered.length; index += 1) {
      if ((ordered[index]?.start ?? 0) < (ordered[index - 1]?.end ?? 0)) refuse('alignment-overlap', path);
    }
  }
  return spans;
};

/** @param {ClauseSite} clause */
const publicClause = (clause) => ({
  line: clause.line,
  sentence: clause.sentence,
  predicate: clause.predicate,
  arity: clause.arity,
  kind: clause.kind,
  text: clause.text,
});

/** @param {ClauseSite} clause */
const indexClause = (clause) => ({
  line: clause.line,
  document: clause.document,
  sentence: clause.sentence,
  predicate: clause.predicate,
  arity: clause.arity,
  kind: clause.kind,
});

/**
 * Derive every provenance output. The returned byte arrays are the build and
 * checker contract; callers must write/compare them without reserializing.
 *
 * @param {Map<string, Uint8Array>} files
 */
export const deriveProvenance = (files) => {
  const guideline = guidelineRoot(files);
  const coverage = parseCoverage(files, guideline.root);
  const notes = parseProjectionNotes(files, guideline.root);
  const labels = parseReleaseLabels(files);
  const clauses = parseClauseSites(files);
  /** @type {Map<string, ClauseSite[]>} */
  const clausesByDocument = new Map();
  for (const clause of clauses) {
    const bucket = clausesByDocument.get(clause.document) ?? [];
    bucket.push(clause);
    clausesByDocument.set(clause.document, bucket);
  }
  /** @type {Map<string, CoverageRow[]>} */
  const coverageByFile = new Map();
  for (const row of coverage.rows) {
    const bucket = coverageByFile.get(row.file) ?? [];
    bucket.push(row);
    coverageByFile.set(row.file, bucket);
  }
  /** @type {Map<string, ReturnType<typeof parseExtraction>>} */
  const extractions = new Map();
  for (const sourcePath of coverageByFile.keys()) {
    const path = `${guideline.root}/${sourcePath}`;
    extractions.set(sourcePath, parseExtraction(textAt(files, path), path));
  }

  const documentIds = [...coverage.documents.keys()].sort();
  /** @type {{ document: string, path: string, bytes: Buffer, model: unknown }[]} */
  const chunks = [];
  let alignmentSpans = 0;
  for (const document of documentIds) {
    const coverageRow = /** @type {CoverageRow} */ (coverage.documents.get(document));
    const note = notes.get(document) ?? refuse('projection-missing', document);
    const label = labels.get(document) ?? refuse('label-missing', document);
    if (note.region !== coverageRow.region) refuse('projection-region', document);
    const extraction = extractions.get(coverageRow.file) ?? refuse('source-missing', coverageRow.file);
    const passage = passageFor(
      coverageRow,
      coverageByFile.get(coverageRow.file) ?? [],
      extraction,
    );
    const acePath = `${guideline.root}/ace/${document}.ace`;
    const ace = requireFinalLf(textAt(files, acePath), acePath);
    const sentences = ace.split('\n').map((text, index) => {
      if (text === '') refuse('ace-empty-sentence', `${acePath}:${index + 1}`);
      return { number: index + 1, text };
    });
    const alignPath = `${guideline.root}/align/${document}.tsv`;
    const spans = parseAlignment(textAt(files, alignPath), ace, passage, alignPath);
    alignmentSpans += spans.length;
    const documentClauses = clausesByDocument.get(document) ?? refuse('clauses-missing', document);
    const model = {
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
      id: document,
      label,
      region: {
        id: coverageRow.region,
        sourceFile: coverageRow.file,
        page: coverageRow.page,
        section: coverageRow.section,
      },
      source: { text: passage },
      ace: { text: ace, sentences },
      alignment: { unit: 'unicode-code-point', spans },
      projection: note,
      clauses: documentClauses.map(publicClause),
    };
    const path = `provenance/documents/${document}.json`;
    chunks.push({ document, path, bytes: generatedJson(model), model });
  }
  for (const document of notes.keys()) {
    if (!coverage.documents.has(document)) refuse('projection-orphan', document);
  }
  for (const document of labels.keys()) {
    if (!coverage.documents.has(document)) refuse('label-orphan', document);
  }
  for (const document of clausesByDocument.keys()) {
    if (!coverage.documents.has(document)) refuse('clause-orphan', document);
  }

  const indexModel = {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    documents: chunks.map(({ document, path }) => ({ id: document, path })),
    clauses: clauses.map(indexClause),
    stats: { documents: chunks.length, clauses: clauses.length },
  };
  const pdfCandidates = [...files.keys()].filter((path) => {
    if (!path.startsWith(`${guideline.root}/`)) return false;
    return PDF_PATH.test(path.slice(guideline.root.length + 1));
  });
  if (pdfCandidates.length !== 1) refuse('pdf-count', `expected 1, found ${pdfCandidates.length}`);
  const pdfSource = /** @type {string} */ (pdfCandidates[0]);
  const pdfBytes = bytesAt(files, pdfSource);
  if (!Buffer.from(pdfBytes.subarray(0, 5)).equals(Buffer.from('%PDF-', 'ascii'))) {
    refuse('pdf-signature', pdfSource);
  }
  return {
    guideline: guideline.id,
    clauses,
    index: { path: CLAUSE_INDEX_PATH, bytes: generatedJson(indexModel), model: indexModel },
    chunks,
    pdf: { path: PDF_ASSET_PATH, bytes: pdfBytes, source: pdfSource },
    stats: {
      documents: chunks.length,
      clauses: clauses.length,
      alignmentSpans,
    },
  };
};
