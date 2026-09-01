import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, verifyBag } from '../../kb/bag.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../../..');
const REPO_SOURCE = join(HERE, 'repo-queries.json');
const QUERY_PATH = /^data\/guidelines\/cdc-2022-opioid\/queries\/pl\/([^/]+)\.pl$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VARIABLE = /^[A-Z][A-Za-z0-9_]*$/;
const LEAF_ARITY = new Map([
  ['guideline_entity', 4],
  ['guideline_cardinality', 5],
  ['guideline_event', 3],
  ['guideline_arg', 4],
]);

export class CatalogError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CatalogError';
  }
}

const refuse = (message) => {
  throw new CatalogError(message);
};

class Reader {
  constructor(source, label) {
    this.source = source;
    this.label = label;
    this.offset = 0;
  }

  fail(message) {
    refuse(`${this.label}:${this.offset}: ${message}`);
  }

  skip() {
    for (;;) {
      while (/\s/.test(this.source[this.offset] ?? '')) this.offset += 1;
      if (this.source[this.offset] !== '%') return;
      while (this.offset < this.source.length && this.source[this.offset] !== '\n')
        this.offset += 1;
    }
  }

  take(expected) {
    this.skip();
    if (this.source[this.offset] !== expected) this.fail(`expected ${expected}`);
    this.offset += 1;
  }

  quotedAtom() {
    this.offset += 1;
    let value = '';
    for (;;) {
      if (this.offset >= this.source.length) this.fail('unterminated quoted atom');
      const character = this.source[this.offset];
      this.offset += 1;
      if (character === '\\') this.fail('backslash escapes are unsupported');
      if (character !== "'") {
        value += character;
        continue;
      }
      if (this.source[this.offset] === "'") {
        value += "'";
        this.offset += 1;
        continue;
      }
      return { kind: 'atom', value };
    }
  }

  word() {
    const start = this.offset;
    while (!/[\s(),.\[\]%]/.test(this.source[this.offset] ?? '')) this.offset += 1;
    if (start === this.offset)
      this.fail(`unexpected ${JSON.stringify(this.source[this.offset] ?? '<eof>')}`);
    const value = this.source.slice(start, this.offset);
    if (/^-?[0-9]+$/.test(value)) return { kind: 'integer', value };
    if (/^[A-Z_][A-Za-z0-9_]*$/.test(value)) return { kind: 'variable', value };
    if (/^[a-z][A-Za-z0-9_]*$/.test(value)) return { kind: 'atom', value };
    this.fail(`unsupported token ${JSON.stringify(value)}`);
  }

  list() {
    this.offset += 1;
    this.skip();
    if (this.source[this.offset] === ']') {
      this.offset += 1;
      return { kind: 'list', items: [] };
    }
    const items = [];
    for (;;) {
      items.push(this.term());
      this.skip();
      const delimiter = this.source[this.offset];
      if (delimiter === ']') {
        this.offset += 1;
        return { kind: 'list', items };
      }
      if (delimiter !== ',') this.fail('expected , or ]');
      this.offset += 1;
    }
  }

  term() {
    this.skip();
    const character = this.source[this.offset];
    let term;
    if (character === "'") term = this.quotedAtom();
    else if (character === '[') return this.list();
    else term = this.word();

    this.skip();
    if (term.kind !== 'atom' || this.source[this.offset] !== '(') return term;
    this.offset += 1;
    const args = [];
    this.skip();
    if (this.source[this.offset] === ')') {
      this.offset += 1;
      return { kind: 'compound', functor: term.value, args };
    }
    for (;;) {
      args.push(this.term());
      this.skip();
      const delimiter = this.source[this.offset];
      if (delimiter === ')') {
        this.offset += 1;
        return { kind: 'compound', functor: term.value, args };
      }
      if (delimiter !== ',') this.fail('expected , or )');
      this.offset += 1;
    }
  }

  allTerms() {
    const terms = [];
    for (;;) {
      this.skip();
      if (this.offset === this.source.length) return terms;
      terms.push(this.term());
      this.take('.');
    }
  }
}

const parseTerms = (source, label) => new Reader(source, label).allTerms();

const compound = (term, functor, arity, label) => {
  if (term.kind !== 'compound' || term.functor !== functor || term.args.length !== arity) {
    refuse(`${label}: expected ${functor}/${arity}`);
  }
  return term.args;
};

const atom = (term, label) => {
  if (term.kind !== 'atom') refuse(`${label}: expected atom`);
  return term.value;
};

const atomText = (value) =>
  /^[a-z][A-Za-z0-9_]*$/.test(value) ? value : `'${value.replaceAll("'", "''")}'`;

const renderTerm = (term) => {
  switch (term.kind) {
    case 'atom':
      return atomText(term.value);
    case 'variable':
    case 'integer':
      return term.value;
    case 'list':
      return `[${term.items.map(renderTerm).join(',')}]`;
    case 'compound':
      return `${atomText(term.functor)}(${term.args.map(renderTerm).join(',')})`;
    default:
      return refuse('renderer received an unknown term');
  }
};

const variables = (term, found = new Set()) => {
  if (term.kind === 'variable') found.add(term.value);
  if (term.kind === 'compound') for (const argument of term.args) variables(argument, found);
  if (term.kind === 'list') for (const item of term.items) variables(item, found);
  return found;
};

const flattenGoal = (term) => {
  if (term.kind === 'compound' && term.functor === ',' && term.args.length === 2) {
    return [...flattenGoal(term.args[0]), ...flattenGoal(term.args[1])];
  }
  if (term.kind !== 'compound') refuse('goal leaf must be a compound');
  const arity = LEAF_ARITY.get(term.functor);
  if (arity === undefined || term.args.length !== arity) {
    refuse(`goal leaf ${term.functor}/${term.args.length} is outside the accepted schema`);
  }
  return [term];
};

const projectionFromTerm = (term, goalVariables) => {
  if (term.kind !== 'list') refuse('answers/1 must hold a list');
  const seen = new Set();
  return term.items.map((item) => {
    const [binding, descriptor] = compound(item, 'answer', 2, 'answer projection');
    if (binding.kind !== 'variable' || !VARIABLE.test(binding.value)) {
      refuse('answer projection binding must be a named variable');
    }
    if (!goalVariables.has(binding.value))
      refuse(`projection ${binding.value} is absent from the goal`);
    if (seen.has(binding.value)) refuse(`duplicate projection ${binding.value}`);
    seen.add(binding.value);
    if (descriptor.kind !== 'compound') refuse('answer descriptor must be a compound');
    if (!['noun', 'wh'].includes(descriptor.functor)) {
      refuse(`answer descriptor ${descriptor.functor}/${descriptor.args.length} is unsupported`);
    }
    return { variable: binding.value, descriptor: renderTerm(descriptor) };
  });
};

export const parseQueryFile = (source, filename) => {
  const terms = parseTerms(source, filename);
  if (terms.length !== 2) refuse(`${filename}: expected exactly 2 terms, got ${terms.length}`);
  const [version, queryId, aceDigest, ulex] = compound(
    terms[0],
    '$guideline_query',
    4,
    `${filename} metadata`,
  );
  if (atom(version, `${filename} version`) !== 'v1')
    refuse(`${filename}: unsupported query version`);
  const id = atom(queryId, `${filename} id`);
  if (!ID.test(id) || `${id}.pl` !== filename) refuse(`${filename}: id/filename mismatch (${id})`);
  const [aceHash] = compound(aceDigest, 'ace_sha256', 1, `${filename} ACE digest`);
  if (!HEX64.test(atom(aceHash, `${filename} ACE hash`))) refuse(`${filename}: malformed ACE hash`);
  const [ulexDigest] = compound(ulex, 'ulex', 1, `${filename} ulex`);
  const [ulexHash] = compound(ulexDigest, 'sha256', 1, `${filename} ulex digest`);
  if (!HEX64.test(atom(ulexHash, `${filename} ulex hash`)))
    refuse(`${filename}: malformed ulex hash`);

  const [goalWrapper, answersWrapper] = compound(
    terms[1],
    '$guideline_query_projection',
    2,
    `${filename} projection`,
  );
  const [goal] = compound(goalWrapper, 'goal', 1, `${filename} goal`);
  const [answers] = compound(answersWrapper, 'answers', 1, `${filename} answers`);
  const clauses = flattenGoal(goal);
  const goalVariables = new Set();
  for (const clause of clauses) variables(clause, goalVariables);
  return {
    record: {
      id,
      goal: clauses.map(renderTerm).join(','),
      projection: projectionFromTerm(answers, goalVariables),
    },
    sourceSha256: sha256(Buffer.from(source, 'utf8')),
  };
};

const parseRepoRecord = (value, index) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    refuse(`repo record ${index}: expected object`);
  }
  const source = value;
  const keys = Object.keys(source).sort();
  if (keys.join(',') !== 'clauses,id,projection') refuse(`repo record ${index}: unexpected keys`);
  if (typeof source.id !== 'string' || !ID.test(source.id))
    refuse(`repo record ${index}: invalid id`);
  if (!Array.isArray(source.clauses) || source.clauses.length === 0) {
    refuse(`repo record ${source.id}: clauses must be a non-empty array`);
  }
  const clauses = source.clauses
    .map((clause, clauseIndex) => {
      if (typeof clause !== 'string')
        refuse(`repo record ${source.id}: clause ${clauseIndex} is not text`);
      const terms = parseTerms(`${clause}.`, `${source.id} clause ${clauseIndex}`);
      if (terms.length !== 1)
        refuse(`repo record ${source.id}: clause ${clauseIndex} is not one term`);
      return flattenGoal(terms[0]);
    })
    .flat();
  const goalVariables = new Set();
  for (const clause of clauses) variables(clause, goalVariables);
  if (!Array.isArray(source.projection))
    refuse(`repo record ${source.id}: projection must be an array`);
  const projectionTerm = {
    kind: 'list',
    items: source.projection.map((entry, projectionIndex) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        refuse(`repo record ${source.id}: projection ${projectionIndex} must be an object`);
      }
      if (Object.keys(entry).sort().join(',') !== 'descriptor,variable') {
        refuse(`repo record ${source.id}: projection ${projectionIndex} has unexpected keys`);
      }
      if (typeof entry.variable !== 'string' || !VARIABLE.test(entry.variable)) {
        refuse(`repo record ${source.id}: projection ${projectionIndex} has invalid variable`);
      }
      if (typeof entry.descriptor !== 'string') {
        refuse(`repo record ${source.id}: projection ${projectionIndex} has invalid descriptor`);
      }
      const descriptors = parseTerms(
        `${entry.descriptor}.`,
        `${source.id} descriptor ${projectionIndex}`,
      );
      if (descriptors.length !== 1) refuse(`repo record ${source.id}: descriptor is not one term`);
      return {
        kind: 'compound',
        functor: 'answer',
        args: [{ kind: 'variable', value: entry.variable }, descriptors[0]],
      };
    }),
  };
  return {
    id: source.id,
    goal: clauses.map(renderTerm).join(','),
    projection: projectionFromTerm(projectionTerm, goalVariables),
  };
};

const readVerifiedArchive = (root) => {
  const kb = join(root, 'kb');
  const archives = readdirSync(kb).filter((name) => name.endsWith('.tar.gz'));
  if (archives.length !== 1) refuse(`expected exactly one bag in kb/, got ${archives.length}`);
  const bag = archives[0];
  const bytes = readFileSync(join(kb, bag));
  const expected = readFileSync(join(kb, `${bag}.sha256`), 'utf8')
    .trim()
    .split(/\s+/)[0];
  const observed = sha256(bytes);
  if (expected !== observed) refuse(`bag sidecar mismatch: expected ${expected}, got ${observed}`);
  return { bag, ...verifyBag(bytes) };
};

export const compileCatalog = (root = ROOT) => {
  const archive = readVerifiedArchive(root);
  const bagQueries = [...archive.files.entries()]
    .map(([path, bytes]) => ({ path, bytes, match: QUERY_PATH.exec(path) }))
    .filter(({ match }) => match !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
  if (bagQueries.length !== 4) refuse(`expected 4 exported query files, got ${bagQueries.length}`);
  const bagRecords = bagQueries.map(({ bytes, match }) => {
    const filename = `${match[1]}.pl`;
    return parseQueryFile(Buffer.from(bytes).toString('utf8'), filename);
  });
  const repoSource = JSON.parse(readFileSync(REPO_SOURCE, 'utf8'));
  if (!Array.isArray(repoSource) || repoSource.length !== 2)
    refuse('repo source must hold exactly 2 records');
  const repoRecords = repoSource.map(parseRepoRecord);
  const records = [...bagRecords.map(({ record }) => record), ...repoRecords].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  if (new Set(records.map(({ id }) => id)).size !== records.length)
    refuse('catalog ids must be unique');
  if (records.length !== 6) refuse(`catalog must hold 6 records, got ${records.length}`);
  return {
    bag: archive.bag,
    records,
    repoSource,
    querySha256: Object.fromEntries(
      bagRecords.map(({ record, sourceSha256 }) => [record.id, sourceSha256]),
    ),
  };
};

export const emitCatalog = (records) =>
  `// Generated by the knowledge-base build; do not edit.\n` +
  `export const QUESTION_CATALOG = ${JSON.stringify(records, null, 2)} as const;\n\n` +
  `export type QuestionId = (typeof QUESTION_CATALOG)[number]["id"];\n` +
  `export type QuestionCatalogEntry = (typeof QUESTION_CATALOG)[number];\n`;

const probe = () => {
  const compiled = compileCatalog();
  const categoryA = compiled.records.find(({ id }) => id === 'category-a-recommendations');
  const malformedSource = Buffer.from(
    readVerifiedArchive(ROOT).files.get(
      'data/guidelines/cdc-2022-opioid/queries/pl/category-a-recommendations.pl',
    ),
  )
    .toString('utf8')
    .replace("'$guideline_query_projection'", "'$guideline_query_projection_bad'");
  let malformed;
  try {
    parseQueryFile(malformedSource, 'category-a-recommendations.pl');
    malformed = { rejected: false, error: '<none>' };
  } catch (error) {
    malformed = { rejected: error instanceof CatalogError, error: String(error.message) };
  }
  process.stdout.write(
    `${JSON.stringify({
      bag: compiled.bag,
      bagRecords: compiled.records.length - compiled.repoSource.length,
      totalRecords: compiled.records.length,
      categoryA,
      repoSource: compiled.repoSource,
      repoEmitted: compiled.records.filter(({ id }) =>
        ['category-b-recommendations', 'evidence-type-3-recommendation'].includes(id),
      ),
      malformed,
      generatedBytes: Buffer.byteLength(emitCatalog(compiled.records)),
    })}\n`,
  );
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  const compiled = compileCatalog();
  if (outputIndex !== -1) {
    const output = process.argv[outputIndex + 1];
    if (output === undefined) refuse('--output needs a path');
    writeFileSync(resolve(output), emitCatalog(compiled.records));
  } else {
    probe();
  }
}
