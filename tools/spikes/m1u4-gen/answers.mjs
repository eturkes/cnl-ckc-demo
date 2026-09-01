/* eslint-disable */
// @ts-nocheck
import { parsePrologTerms, renderPrologTerm } from './catalog.mjs';

const refuse = (message) => {
  throw new Error(`answer serializer: ${message}`);
};

const compound = (term, functor, arity) => {
  if (term.kind !== 'compound' || term.functor !== functor || term.args.length !== arity) {
    refuse(`expected ${functor}/${arity}`);
  }
  return term.args;
};

const atom = (term, label) => {
  if (term.kind !== 'atom') refuse(`${label} must be an atom`);
  return term.value;
};

const byteOrder = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

const rowsFor = (record, result) => {
  if (result.kind === 'failure') return [];
  if (result.kind !== 'solutions') refuse(`${record.id} ended as ${result.kind}`);
  return result.solutions.map((solution, solutionIndex) => {
    const values = record.projection.map(({ variable }) => {
      const value = solution.display[variable];
      if (value === undefined) refuse(`${record.id} solution ${solutionIndex} lacks ${variable}`);
      return value;
    });
    return `sol([${values.join(',')}])`;
  });
};

export const canonicalResult = (record, result) => {
  const rawRows = rowsFor(record, result);
  if (record.projection.length === 0) {
    const resultText = rawRows.length === 0 ? 'no(finite_failure)' : 'yes';
    return {
      resultText,
      rawResultText: resultText,
      rawRows: rawRows.length,
      projectedRows: rawRows.length === 0 ? 0 : 1,
      duplicateRows: Math.max(0, rawRows.length - 1),
      sortChanged: false,
    };
  }
  const uniqueRows = [...new Set(rawRows)];
  const sortedRows = [...uniqueRows].sort(byteOrder);
  return {
    resultText: `solutions([${sortedRows.join(',')}])`,
    rawResultText: `solutions([${uniqueRows.join(',')}])`,
    rawRows: rawRows.length,
    projectedRows: sortedRows.length,
    duplicateRows: rawRows.length - uniqueRows.length,
    sortChanged: uniqueRows.some((row, index) => row !== sortedRows[index]),
  };
};

export const serializeAnswers = (record, result, querySha256) => {
  if (!/^[0-9a-f]{64}$/.test(querySha256)) refuse(`${record.id} has an invalid query digest`);
  const canonical = canonicalResult(record, result);
  const id = record.id.replaceAll("'", "''");
  return {
    ...canonical,
    bytes:
      `% ${record.id} answered against the loaded composition by ace_to_pl answer mode; do not edit.\n` +
      `'$guideline_answers'(v1,'${id}',query_sha256('${querySha256}'),result(${canonical.resultText})).\n`,
  };
};

export const parseAnswerArtifact = (source, label) => {
  const terms = parsePrologTerms(source, label);
  if (terms.length !== 1) refuse(`${label} must contain exactly one term`);
  const [version, id, queryDigest, resultWrapper] = compound(terms[0], '$guideline_answers', 4);
  if (atom(version, 'version') !== 'v1') refuse(`${label} has an unsupported version`);
  const [queryHash] = compound(queryDigest, 'query_sha256', 1);
  const [result] = compound(resultWrapper, 'result', 1);
  return {
    id: atom(id, 'id'),
    querySha256: atom(queryHash, 'query digest'),
    resultText: renderPrologTerm(result),
  };
};

export const firstByteDiff = (expected, actual) => {
  const bound = Math.min(expected.length, actual.length);
  let offset = 0;
  while (offset < bound && expected[offset] === actual[offset]) offset += 1;
  if (offset === expected.length && offset === actual.length) return '<none>';
  const show = (bytes) => Buffer.from(bytes.subarray(offset, offset + 24)).toString('utf8');
  return `offset ${offset}: expected ${JSON.stringify(show(expected))}, actual ${JSON.stringify(show(actual))}; lengths ${expected.length}/${actual.length}`;
};
