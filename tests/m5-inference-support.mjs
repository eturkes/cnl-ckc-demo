// M5 mechanism probes: real payload clauses + explicit, sentence-scoped witnesses.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from '../tools/kb/bag.mjs';
import { CLINICAL_QUESTIONS } from '../tools/kb/clinical.mjs';
import { payloadDocuments } from '../tools/kb/payload.mjs';
import { PROOF_SOURCE } from '../tools/kb/proof.mjs';
import { buildImage } from '../tools/kb/produce.mjs';

const require = createRequire(import.meta.url);
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const archive = readdirSync(join(ROOT, 'kb')).find((name) => name.endsWith('.tar.gz'));
if (archive === undefined) throw new Error('vendored bag missing');
export const FILES = verifyBag(readFileSync(join(ROOT, 'kb', archive))).files;
export const PAYLOAD = payloadDocuments(FILES).source;
export const ORIGINAL_IMAGE = new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm')));
export const TOPICS = CLINICAL_QUESTIONS;
export const atom = (value) => `'${value.replaceAll("'", "''")}'`;

const selected = new Map(TOPICS.flatMap((q) => q.sources.map((s) => [s.document, q.id])));
export const CASES = [];
let document = '';
let current;
for (const [index, line] of PAYLOAD.split('\n').entries()) {
  const file = /^% file:.*\/pl\/([^/]+)\.pl$/u.exec(line);
  if (file !== null) {
    document = file[1];
    current = undefined;
  }
  const sentence = /^% S([0-9]+): (.*)$/u.exec(line);
  if (sentence !== null && selected.has(document) && Number(sentence[1]) > 1) {
    current = {
      topic: selected.get(document),
      document,
      sentence: Number(sentence[1]),
      original: sentence[2],
      clauses: [],
    };
    CASES.push(current);
  }
  if (current === undefined || !line.startsWith('guideline_')) continue;
  const boundary = line.indexOf(' :- ');
  current.clauses.push({
    line: index + 1,
    head: boundary < 0 ? line.slice(0, -1) : line.slice(0, boundary),
    body: boundary < 0 ? 'true' : line.slice(boundary + 4, -1),
  });
}
for (const c of CASES) {
  const bodies = [...new Set(c.clauses.map((row) => row.body))];
  if (bodies.length !== 1) throw new Error(`${c.document}:${c.sentence}: multiple antecedents`);
  c.body = bodies[0];
}

export const CASE_SOURCE = CASES.map(
  (c) =>
    `m5_case(${atom(c.topic)},${atom(c.document)},${c.sentence},[${c.clauses.map((row) => row.head).join(',')}],(${c.body})).`,
).join('\n');

export const CUTLESS_PROOF = PROOF_SOURCE.split('\n')
  .filter((line) => !line.startsWith('derive(clinical_advice('))
  .join('\n');

export const ASSUMPTION_SOURCE = String.raw`
m5_has(H,[A|_]) :- H=A.
m5_has(H,[_|T]) :- m5_has(H,T).
m5_positive(true,[]) :- !.
m5_positive((A,B),R) :- !, m5_positive(A,X), m5_positive(B,Y), app(X,Y,R).
m5_positive(\+ _,[]) :- !.
m5_positive(H,[H]).
m5_ground([],_,_).
m5_ground([V|Vs],Case,N) :- V='$m5_hypothetical'(Case,N), N1 is N+1, m5_ground(Vs,Case,N1).
m5_prepare(Q,Doc,S,Heads,As) :- m5_case(Q,Doc,S,Heads,B), (once(B) -> As=[] ; m5_positive(B,As), term_variables(As,Vs), m5_ground(Vs,case(Doc,S),0)), ground(Heads), ground(As).
m5_derive(true,_,_,[],proved) :- !.
m5_derive(M:G,D,A,P,S) :- !, (M==user -> m5_derive(G,D,A,P,S) ; P=[],S=limit).
m5_derive((G,H),D,A,P,S) :- !, m5_conjunction(G,H,D,A,P,S).
m5_derive(\+ G,D,A,[naf(G)],S) :- !, findall(R,m5_derive(G,D,A,_,R),Rs), naf_status(Rs,S).
m5_derive(H,_,A,[assumption(H)],proved) :- m5_has(H,A), !.
m5_derive(H,0,_,[],limit) :- schema_goal(H), !.
m5_derive(H,D,A,[node(line(L),H,Sub)],S) :- D>0, D1 is D-1, resolve(H,B,L), m5_derive(B,D1,A,Sub,S).
m5_conjunction(G,H,D,A,P,proved) :- m5_derive(G,D,A,PG,proved), m5_derive(H,D,A,PH,proved), app(PG,PH,P).
m5_conjunction(G,_,D,A,[],limit) :- m5_derive(G,D,A,_,limit).
m5_conjunction(G,H,D,A,[],limit) :- m5_derive(G,D,A,_,proved), m5_derive(H,D,A,_,limit).
m5_all([],_,_,[]).
m5_all([H|T],D,A,P) :- m5_derive(H,D,A,PH,proved), m5_all(T,D,A,PT), app(PH,PT,P).
m5_without([_|T],T).
m5_without([H|T],[H|R]) :- m5_without(T,R).
m5_count([],0,0,0).
m5_count([assumption(_)|T],N,A,F) :- m5_count(T,N,A0,F), A is A0+1.
m5_count([naf(_)|T],N,A,F) :- m5_count(T,N,A,F0), F is F0+1.
m5_count([node(_,_,Children)|T],N,A,F) :- m5_count(Children,NC,AC,FC), m5_count(T,NT,AT,FT), N is 1+NC+NT, A is AC+AT, F is FC+FT.
m5_lines([],[]).
m5_lines([assumption(_)|T],L) :- m5_lines(T,L).
m5_lines([naf(_)|T],L) :- m5_lines(T,L).
m5_lines([node(line(N),_,C)|T],[N|R]) :- m5_lines(C,LC),m5_lines(T,LT),app(LC,LT,R).
m5_case_proof(Q,Doc,S,D,P) :- m5_prepare(Q,Doc,S,H,A),m5_all(H,D,A,P).
`;

export const buildProbeImage = async (extra = '', proof = CUTLESS_PROOF) =>
  (await buildImage(`${PAYLOAD}\n${proof}\n${CASE_SOURCE}\n${ASSUMPTION_SOURCE}\n${extra}\n`))
    .image;

export const loadEngine = async (image) => {
  const factory = require('swipl-wasm/dist/loadImageDefault.js');
  const load = typeof factory === 'function' ? factory : factory.default;
  const diagnostics = [];
  const engine = await load(image)({ print: () => {}, printErr: (line) => diagnostics.push(line) });
  return { engine, diagnostics };
};

export const once = (engine, goal) => {
  const result = engine.prolog.query(goal).once();
  if (result?.$error !== undefined) throw new Error(JSON.stringify(result));
  return result;
};

export const success = (engine, goal) => once(engine, `(${goal} -> Ok=yes ; Ok=no).`).Ok === 'yes';
export const prepare = (c) =>
  `m5_prepare(${atom(c.topic)},${atom(c.document)},${c.sentence},Heads,Assumptions)`;
export const text = (term, variable) =>
  `term_string(${term},${variable},[quoted(true),numbervars(true),ignore_ops(true)])`;
