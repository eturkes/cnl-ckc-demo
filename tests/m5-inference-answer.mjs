// Prototype binding only: lossless renderer data behind real per-sentence inference.
import { clinicalArtifacts } from '../tools/kb/clinical.mjs';
import {
  FILES,
  TOPICS,
  atom,
  buildProbeImage,
  loadEngine,
  once,
  text,
} from './m5-inference-support.mjs';
import { MECHANISM_SOURCE, compiledTable, prepareCases } from './m5-inference-mechanisms.mjs';

export const ANSWER_SOURCE = String.raw`
m5_case_answer(a,_,_,H,A) :- m5_call_all(A),m5_call_all(H).
m5_case_answer(b,_,_,H,A) :- setup_call_cleanup(m5_assert(A,R),once(m5_call_all(H)),m5_erase_refs(R)).
m5_case_answer(c,_,_,H,_) :- m5_call_all(H).
m5_case_answer(d,D,_,H,A) :- m5_all(H,D,A,_).
m5_case_answer(e,_,_,H,A) :- snapshot((m5_assert_first(A,_),m5_call_all(H))).
m5_case_answer(f,_,_,H,A) :- setup_call_cleanup(m5_assert_first(A,R),once(m5_call_all(H)),m5_erase_refs(R)).
m5_case_tree(a,D,_,H,_,P) :- m5_plain_all(H,D,P).
m5_case_tree(b,D,_,H,A,P) :- setup_call_cleanup(m5_assert(A,R),once(m5_db_all(H,D,[],P)),m5_erase_refs(R)).
m5_case_tree(c,D,K,H,_,P) :- m5_compiled_all(H,D,K,P).
m5_case_tree(d,D,_,H,A,P) :- m5_all(H,D,A,P).
m5_case_tree(e,D,_,H,A,P) :- snapshot((m5_assert_first(A,_),m5_db_all(H,D,[],P))).
m5_case_tree(f,D,_,H,A,P) :- setup_call_cleanup(m5_assert_first(A,R),once(m5_db_all(H,D,[],P)),m5_erase_refs(R)).
m5_answer_cases(_,_,[]).
m5_answer_cases(M,D,[scenario(K,H,A)|T]) :- m5_case_answer(M,D,K,H,A),m5_answer_cases(M,D,T).
m5_proof_cases(_,_,[],[]).
m5_proof_cases(M,D,[scenario(K,H,A)|T],P) :- m5_case_tree(M,D,K,H,A,PH),m5_proof_cases(M,D,T,PT),app(PH,PT,P).
m5_answer(M,D,Q,Source,Answer) :- m5_template(Q,Source,Answer),arg(1,Answer,Doc),m5_contexts(Doc,Cases),m5_answer_cases(M,D,Cases).
m5_answer_proof(M,D,Q,Source,Answer,P) :- m5_template(Q,Source,Answer),arg(1,Answer,Doc),m5_contexts(Doc,Cases),m5_proof_cases(M,D,Cases,P).
`;

export const answerSource = (cases) => {
  const templates = clinicalArtifacts(FILES)
    .helper.split('\n')
    .filter((line) => line.startsWith('clinical_advice('))
    .map((line) => line.replace(/^clinical_advice\(/u, 'm5_template('));
  const documents = [...new Set(cases.map((c) => c.document))];
  const contexts = documents.map(
    (document) =>
      `m5_contexts(${atom(document)},[${cases
        .filter((c) => c.document === document)
        .map((c) => `scenario(case(${atom(document)},${c.sentence}),${c.heads},${c.assumptions})`)
        .join(',')}]).`,
  );
  const withheld = documents.map(
    (document) =>
      `m5_withheld(${atom(document)},[${cases
        .filter((c) => c.document === document)
        .map((c) => `scenario(case(${atom(document)},${c.sentence}),${c.heads},[])`)
        .join(',')}]).`,
  );
  return `:- dynamic(m5_contexts/2).\n${templates.join('\n')}\n${contexts.join('\n')}\n${withheld.join('\n')}\n${ANSWER_SOURCE}`;
};

export const makeAnswerMechanisms = async () => {
  const probe = await loadEngine(await buildProbeImage());
  const cases = prepareCases(probe.engine);
  const source = `${MECHANISM_SOURCE}\n${answerSource(cases)}`;
  const image = await buildProbeImage(`${source}\n:- dynamic(m5_table/2).`);
  const tableImage = await buildProbeImage(`${source}\n${compiledTable(cases)}`);
  const engines = {};
  for (const mechanism of ['a', 'b', 'c', 'd', 'e', 'f']) {
    engines[mechanism] = await loadEngine(mechanism === 'c' ? tableImage : image);
    once(engines[mechanism].engine, 'set_prolog_flag(stack_limit,16777216).');
    if (['b', 'e', 'f'].includes(mechanism)) once(engines[mechanism].engine, 'm5_enable_dynamic.');
  }
  return { cases, image, tableImage, ...engines };
};

export const documents = () =>
  TOPICS.flatMap((topic) => topic.sources.map((s) => ({ topic: topic.id, document: s.document })));
export const answerTermGoal = (mechanism, document, cap = 4) =>
  `m5_answer(${mechanism},${cap},Q,Source,Answer),arg(1,Answer,${atom(document)})`;
export const proofTermGoal = (mechanism, document, cap = 4) =>
  `m5_answer_proof(${mechanism},${cap},Q,Source,Answer,P),arg(1,Answer,${atom(document)})`;
export const selectedGoal = (goal, topic, document) =>
  `Q=${atom(topic)},Answer=clinical_answer(${atom(document)},_,_),${goal}`;
