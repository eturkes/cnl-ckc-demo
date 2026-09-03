import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle-no-data');
const diagnostics = [];
const engine = await factory({
  arguments: ['-q', '-x', 'image.pvm'],
  preRun: [(module) => module.FS.writeFile('image.pvm', readFileSync('kb/generated/kb.pvm'))],
  print: () => {},
  printErr: (line) => diagnostics.push(line),
  on_output: (text, stream) => {
    if (stream === 'stderr') diagnostics.push(text);
  },
});
const once = (goal) => {
  const query = engine.prolog.query(goal);
  try {
    return query.once();
  } finally {
    query.close?.();
  }
};
const HELPERS = `
clause_term(H,true,H) :- !.
clause_term(H,B,(H:-B)).
render(H,B,S,source) :- clause_term(H,B,C0), copy_term(C0,C), numbervars(C,0,_), term_string(C,S,[quoted(true),numbervars(true),fullstop(true),nl(false)]).
render(H,B,S,standard) :- clause_term(H,B,C0), copy_term(C0,C), numbervars(C,0,_), term_string(C,S,[quoted(true),numbervars(true),spacing(standard),fullstop(true),nl(false)]).
render(H,B,S,canonical) :- clause_term(H,B,C0), copy_term(C0,C), numbervars(C,0,_), term_string(C,S,[quoted(true),numbervars(true),ignore_ops(true),fullstop(true),nl(false)]).
render(H,true,S,fragments) :- !, copy_term(H,C), numbervars(C,0,_), term_string(C,T,[quoted(true),numbervars(true),ignore_ops(false)]), string_concat(T,'.',S).
render(H,B,S,fragments) :- unqual(B,Bare), copy_term((H,Bare),(HC,BC)), numbervars((HC,BC),0,_), term_string(HC,HS,[quoted(true),numbervars(true),ignore_ops(false)]), body_text(BC,BS), string_concat(HS,' :- ',T0), string_concat(T0,BS,T1), string_concat(T1,'.',S).
unqual(user:B,B) :- !.
unqual(B,B).
body_text((A,B),S) :- !, term_string(A,AS,[quoted(true),numbervars(true),ignore_ops(false)]), body_text(B,BS), string_concat(AS,', ',T), string_concat(T,BS,S).
body_text(A,S) :- term_string(A,S,[quoted(true),numbervars(true),ignore_ops(false)]).
`;
engine.FS.writeFile('clause-helper.pl', HELPERS);
once("consult('clause-helper.pl').");
if (diagnostics.length > 0) throw new Error(diagnostics.join('\n'));

const predicates = [
  ['guideline_arg', 4],
  ['guideline_cardinality', 5],
  ['guideline_document', 3],
  ['guideline_entity', 4],
  ['guideline_event', 3],
  ['guideline_operator', 3],
  ['guideline_pp', 4],
  ['guideline_property', 4],
  ['guideline_schema_version', 1],
];
const plRoot = '../../kb/data/guidelines/cdc-2022-opioid/pl';
const sourceByPredicate = new Map(predicates.map(([name]) => [name, []]));
const plFiles = readdirSync(plRoot).filter((name) => name.endsWith('.pl')).sort();
for (const file of plFiles) {
  const lines = readFileSync(`${plRoot}/${file}`, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const match = /^(guideline_[a-z_]+)\(/u.exec(line);
    if (match && sourceByPredicate.has(match[1])) {
      sourceByPredicate.get(match[1]).push({ file, line: index + 1, text: line });
    }
  });
}
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const head = (name, arity) => `${name}(${Array.from({ length: arity }, (_, index) => `A${index}`).join(',')})`;
for (const style of ['source', 'standard', 'canonical', 'fragments']) {
  const rows = [];
  let total = 0;
  let exact = 0;
  for (const [name, arity] of predicates) {
    const h = head(name, arity);
    const runtime = once(`findall(S,(clause(${h},Body),render(${h},Body,S,${style})),Ss).`).Ss.map(String);
    const source = sourceByPredicate.get(name);
    const countEqual = runtime.length === source.length;
    let predicateExact = 0;
    let firstMismatch = null;
    for (let index = 0; index < Math.min(runtime.length, source.length); index += 1) {
      if (runtime[index] === source[index].text) {
        predicateExact += 1;
      } else if (firstMismatch === null) {
        firstMismatch = { ordinal: index + 1, runtime: runtime[index], source: source[index] };
      }
    }
    total += source.length;
    exact += predicateExact;
    rows.push({ predicate: `${name}/${arity}`, runtime: runtime.length, source: source.length, countEqual, exact: predicateExact, firstMismatch });
  }
  console.log(JSON.stringify({ type: 'render', style, total, exact, rows }));
}

const payload = plFiles
  .map((file) => `\n% file:data/guidelines/cdc-2022-opioid/pl/${file}\n${readFileSync(`${plRoot}/${file}`, 'utf8')}`)
  .join('\n');
const payloadLines = payload.split('\n');
const lineKeys = [];
const allLineNumbers = [];
for (const [name, arity] of predicates) {
  const h = head(name, arity);
  const lines = once(`findall(L,(clause(${h},_,Ref),clause_property(Ref,file('/prolog.pl')),clause_property(Ref,line_count(L))),Ls).`).Ls.map(Number);
  const source = sourceByPredicate.get(name);
  let exact = 0;
  for (let index = 0; index < Math.min(lines.length, source.length); index += 1) {
    if (payloadLines[lines[index] - 1] === source[index].text) exact += 1;
  }
  allLineNumbers.push(...lines);
  lineKeys.push({ predicate: `${name}/${arity}`, runtime: lines.length, source: source.length, exact });
}
console.log(JSON.stringify({
  type: 'line-key',
  runtimeClauses: allLineNumbers.length,
  uniqueLines: new Set(allLineNumbers).size,
  minimum: Math.min(...allLineNumbers),
  maximum: Math.max(...allLineNumbers),
  rows: lineKeys,
}));

const propertyGoal = "clause(guideline_entity(actual,_,recommendation,countable),_,Ref),(clause_property(Ref,file(F))->File=F;File=absent),(clause_property(Ref,line_count(L))->Line=L;Line=absent),(clause_property(Ref,predicate(P))->Predicate=P;Predicate=absent),(clause_property(Ref,size(Z))->Size=Z;Size=absent),(clause_property(Ref,module(M))->Module=M;Module=absent).";
console.log(JSON.stringify({ type: 'properties', result: once(propertyGoal) }));

const traceRoot = '../../kb/data/guidelines/cdc-2022-opioid/queries/traces';
let traceNodes = 0;
let hashResolvedUnique = 0;
let renderedSourceHash = 0;
const hashToSource = new Map();
for (const source of sourceByPredicate.values()) {
  for (const clause of source) {
    const hash = sha256(`${clause.text}\n`);
    const bucket = hashToSource.get(hash) ?? [];
    bucket.push(clause);
    hashToSource.set(hash, bucket);
  }
}
const traceRows = [];
for (const id of ['category-a-recommendations', 'dosage-reduction-content', 'evidence-type-1-recommendation', 'recommendation-exists']) {
  const text = readFileSync(`${traceRoot}/${id}.pl`, 'utf8');
  const hashes = [...text.matchAll(/clause_sha256\('?([0-9a-f]{64})'?\)/gu)].map((match) => match[1]);
  traceNodes += hashes.length;
  const unique = hashes.filter((hash) => hashToSource.get(hash)?.length === 1).length;
  hashResolvedUnique += unique;
  traceRows.push({ id, nodes: hashes.length, unique });
}

for (const [name, arity] of predicates) {
  const h = head(name, arity);
  const rendered = once(`findall(S,(clause(${h},Body),render(${h},Body,S,source)),Ss).`).Ss.map(String);
  const source = sourceByPredicate.get(name);
  for (let index = 0; index < Math.min(rendered.length, source.length); index += 1) {
    if (sha256(`${rendered[index]}\n`) === sha256(`${source[index].text}\n`)) renderedSourceHash += 1;
  }
}
console.log(JSON.stringify({ type: 'hash', traceNodes, hashResolvedUnique, traceRows, runtimeClauses: [...sourceByPredicate.values()].reduce((sum, rows) => sum + rows.length, 0), renderedSourceHash }));
