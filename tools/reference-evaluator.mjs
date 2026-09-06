import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBag } from './kb/bag.mjs';
import { clinicalArtifacts } from './kb/clinical.mjs';
import { payloadDocuments } from './kb/payload.mjs';
import { buildImage } from './kb/produce.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BAG = join(ROOT, 'kb', 'cnl-ckc-kb-g952cc950a0c6.tar.gz');
const SCRATCH = join(ROOT, 'kb', 'generated', `reference-evaluator-${String(process.pid)}`);

const REF_SOURCE = String.raw`
ref_schema_goal(guideline_arg(_,_,_,_)).
ref_schema_goal(guideline_cardinality(_,_,_,_,_)).
ref_schema_goal(guideline_document(_,_,_)).
ref_schema_goal(guideline_entity(_,_,_,_)).
ref_schema_goal(guideline_event(_,_,_)).
ref_schema_goal(guideline_operator(_,_,_)).
ref_schema_goal(guideline_pp(_,_,_,_)).
ref_schema_goal(guideline_property(_,_,_,_)).
ref_schema_goal(guideline_schema_version(_)).

ref_assumed(H,[A|_]) :- H = A.
ref_assumed(H,[_|T]) :- ref_assumed(H,T).

ref_append([],R,R).
ref_append([H|T],R,[H|U]) :- ref_append(T,R,U).

ref_max([],0).
ref_max([H|T],M) :- ref_max(T,N), (H > N -> M = H ; M = N).

ref_has_status(S,[state(S,_)|_]) :- !.
ref_has_status(S,[_|T]) :- ref_has_status(S,T).
ref_state_depths([],[]).
ref_state_depths([state(_,D)|T],[D|R]) :- ref_state_depths(T,R).

ref_naf_status(States,proved,Used) :-
    \+ ref_has_status(proved,States),
    \+ ref_has_status(limit,States),
    ref_state_depths(States,Depths), ref_max(Depths,Used), !.
ref_naf_status(States,limit,Used) :-
    \+ ref_has_status(proved,States),
    ref_has_status(limit,States),
    ref_state_depths(States,Depths), ref_max(Depths,Used), !.

ref_eval(H,_,As,[assumption(H)],proved,0) :- ref_assumed(H,As), !.
ref_eval(true,_,_,[],proved,0) :- !.
ref_eval(M:A,D,As,P,S,U) :- !,
    (M == user -> ref_eval(A,D,As,P,S,U) ; P = [], S = limit, U = 0).
ref_eval((A,B),D,As,P,S,U) :- !, ref_eval_pair(A,B,D,As,P,S,U).
ref_eval(\+ A,D,As,[naf(A)],S,U) :- !,
    findall(state(R,V),ref_eval(A,D,As,_,R,V),States),
    ref_naf_status(States,S,U).
ref_eval(H,0,_,[],limit,0) :- ref_schema_goal(H), !.
ref_eval(H,D,As,[node(line(L),H,Sub)],S,U) :-
    D > 0, D1 is D-1,
    ref_resolve(H,B,L),
    ref_eval(B,D1,As,Sub,S,V),
    U is V+1.

ref_eval_pair(A,B,D,As,P,proved,U) :-
    ref_eval(A,D,As,PA,proved,UA),
    ref_eval(B,D,As,PB,proved,UB),
    ref_append(PA,PB,P),
    (UA > UB -> U = UA ; U = UB).
ref_eval_pair(A,_,D,As,[],limit,U) :- ref_eval(A,D,As,_,limit,U).
ref_eval_pair(A,B,D,As,[],limit,U) :-
    ref_eval(A,D,As,_,proved,UA), ref_eval(B,D,As,_,limit,UB),
    (UA > UB -> U = UA ; U = UB).

ref_resolve(H,B,L) :-
    ref_schema_goal(H), clause(H,B,R), clause_property(R,line_count(L)).

ref_gate_sites((clinical_use(L,H),Rest),[site(L,H)|Tail]) :- !,
    ref_gate_sites(Rest,Tail).
ref_gate_sites(clinical_rule(_,_,_),[]) :- !.
ref_gate_sites(_,[]).

ref_context(full,Doc,S,As) :- !, findall(H,clinical_premise(Doc,S,_,H),As).
ref_context(none,_,_,[]).

ref_eval_sites([],_,_,[],0).
ref_eval_sites([site(_,H)|T],D,As,P,U) :-
    ref_eval(H,D,As,PH,proved,UH),
    ref_eval_sites(T,D,As,PT,UT),
    ref_append(PH,PT,P),
    (UH > UT -> U = UH ; U = UT).

ref_sentence(Doc,S,Cap,Mode,Rule,Proof,Used) :-
    clause(clinical_gate(Doc,S,_,_),Body,_),
    ref_gate_sites(Body,Sites),
    ref_context(Mode,Doc,S,As),
    ref_eval_sites(Sites,Cap,As,Proof,Used),
    clinical_rule(Doc,S,Rule).
`;

const DYNAMIC_SOURCE = String.raw`
:- dynamic guideline_arg/4.
:- dynamic guideline_cardinality/5.
:- dynamic guideline_document/3.
:- dynamic guideline_entity/4.
:- dynamic guideline_event/3.
:- dynamic guideline_operator/3.
:- dynamic guideline_pp/4.
:- dynamic guideline_property/4.
:- dynamic guideline_schema_version/1.
`;

const HARNESS_SOURCE = String.raw`
:- use_module(library(http/json)).

ref_keys(Keys) :- setof(Doc-S,Rule^clinical_rule(Doc,S,Rule),Keys).
ref_id(Doc,S,Id) :- format(atom(Id),'~w:~d',[Doc,S]).

ref_failures(Cap,Failures) :-
    ref_keys(Keys),
    findall(Id,
        (member(Doc-S,Keys), \+ once(ref_sentence(Doc,S,Cap,full,_,_,_)), ref_id(Doc,S,Id)),
        Failures).

ref_cap_result(Cap,Result) :-
    ref_failures(Cap,Failures),
    length(Failures,Failed),
    Proved is 48-Failed,
    Result = _{cap:Cap,proved:Proved,failed:Failed,failures:Failures}.

ref_measure_o1 :-
    maplist(ref_cap_result,[1,2,3],Caps),
    ref_failures(1,F1), ref_failures(2,F2), ref_failures(3,F3),
    (F1 \= [], F2 == [], F3 == [] -> Least = 2 ; Least = null),
    json_write_dict(current_output,_{caps:Caps,least_sufficient_cap:Least},[width(0)]), nl.

ref_clause_ref(Line,Ref) :-
    ref_schema_goal(H), clause(H,_,Ref), clause_property(Ref,line_count(Line)), !.

ref_erase_case(case(Doc,S,Line),result(Doc,S,Line,Outcome)) :-
    snapshot((
        ref_clause_ref(Line,Ref), erase(Ref),
        (once(ref_sentence(Doc,S,2,full,_,_,_)) -> Outcome = survived ; Outcome = failed)
    )).

ref_result_survivor(result(Doc,S,Line,survived),_{id:Id,line:Line}) :- ref_id(Doc,S,Id).
ref_outcome_count(Outcome,Results,Count) :-
    findall(1,member(result(_,_,_,Outcome),Results),Ones), length(Ones,Count).

ref_count_proved(Cap,Mode,Count) :-
    ref_keys(Keys),
    findall(1,(member(Doc-S,Keys),once(ref_sentence(Doc,S,Cap,Mode,_,_,_))),Ones),
    length(Ones,Count).

ref_measure_o2 :-
    findall(case(Doc,S,Line),
        (clause(clinical_gate(Doc,S,_,Lines),_,_),member(Line,Lines)),
        Cases),
    get_time(T0), maplist(ref_erase_case,Cases,Results), get_time(T1),
    ref_outcome_count(failed,Results,Failed),
    ref_outcome_count(survived,Results,Survived),
    findall(Item,(member(Result,Results),ref_result_survivor(Result,Item)),Survivors),
    ref_count_proved(2,full,PostCampaignProved),
    length(Cases,Total), WallMs is (T1-T0)*1000,
    json_write_dict(current_output,_{
        total:Total,
        outcomes:_{failed:Failed,survived:Survived},
        survivors:Survivors,
        wall_ms:WallMs,
        post_campaign_proved:PostCampaignProved
    },[width(0)]), nl.

ref_docs(Docs) :- setof(Doc,S^Rule^clinical_rule(Doc,S,Rule),Docs).
ref_doc_complete(Doc,Cap,Mode) :-
    ref_keys(Keys),
    forall(member(Doc-S,Keys),once(ref_sentence(Doc,S,Cap,Mode,_,_,_))).

ref_count_documents(Cap,Mode,Count) :-
    ref_docs(Docs),
    findall(1,(member(Doc,Docs),ref_doc_complete(Doc,Cap,Mode)),Ones),
    length(Ones,Count).

ref_withheld_survivor(Doc-S,Item) :-
    once(ref_sentence(Doc,S,2,none,_,Proof,_)),
    findall(P,clinical_premise(Doc,S,_,P),Premises),
    length(Premises,PremiseCount),
    clause(clinical_gate(Doc,S,_,Lines),_,_),
    length(Proof,ProofNodes),
    ref_id(Doc,S,Id),
    (PremiseCount =:= 0 -> Reason = true_antecedent ; Reason = unexpected),
    Item = _{id:Id,premises:PremiseCount,gate_lines:Lines,proof_nodes:ProofNodes,reason:Reason}.

ref_measure_o3 :-
    ref_count_proved(2,none,Sentences),
    ref_count_documents(2,none,Documents),
    ref_keys(Keys),
    findall(Item,(member(Key,Keys),ref_withheld_survivor(Key,Item)),Survivors),
    json_write_dict(current_output,_{
        sentence_grain:_{proved:Sentences,total:48},
        document_grain:_{proved:Documents,total:12},
        survivors:Survivors
    },[width(0)]), nl.

ref_clear_schema :-
    retractall(guideline_arg(_,_,_,_)),
    retractall(guideline_cardinality(_,_,_,_,_)),
    retractall(guideline_document(_,_,_)),
    retractall(guideline_entity(_,_,_,_)),
    retractall(guideline_event(_,_,_)),
    retractall(guideline_operator(_,_,_)),
    retractall(guideline_pp(_,_,_,_)),
    retractall(guideline_property(_,_,_,_)),
    retractall(guideline_schema_version(_)).

ref_schema_clause_count(Count) :-
    findall(1,(ref_schema_goal(H),clause(H,_,_)),Clauses), length(Clauses,Count).

ref_measure_o4 :-
    snapshot((
        ref_clear_schema,
        ref_schema_clause_count(ErasedCount),
        ref_count_proved(2,full,Sentences),
        ref_count_documents(2,full,Documents)
    )),
    ref_count_proved(2,full,PostSnapshotProved),
    json_write_dict(current_output,_{
        sentence_grain:_{proved:Sentences,total:48},
        document_grain:_{proved:Documents,total:12},
        remaining_schema_clauses:ErasedCount,
        post_snapshot_proved:PostSnapshotProved
    },[width(0)]), nl.

ref_proof_parts([],[],[],[]).
ref_proof_parts([assumption(H)|T],[H|As],Lines,Heads) :- !,
    ref_proof_parts(T,As,Lines,Heads).
ref_proof_parts([node(line(L),H,Sub)|T],As,[L|Lines],[H|Heads]) :- !,
    ref_proof_parts(Sub,SubAs,SubLines,SubHeads),
    ref_proof_parts(T,TailAs,TailLines,TailHeads),
    ref_append(SubAs,TailAs,As),
    ref_append(SubLines,TailLines,Lines),
    ref_append(SubHeads,TailHeads,Heads).
ref_proof_parts([_|T],As,Lines,Heads) :- ref_proof_parts(T,As,Lines,Heads).

ref_bundle(Doc-S,bundle(Doc,S,Premises,Assumptions,Lines,NodeHeads,GateLines)) :-
    once(ref_sentence(Doc,S,2,full,_,Proof,_)),
    findall(P,clinical_premise(Doc,S,_,P),Premises),
    ref_proof_parts(Proof,Assumptions,Lines,NodeHeads),
    clause(clinical_gate(Doc,S,_,GateLines),_,_).

ref_same_member(X,[H|_]) :- X =@= H, !.
ref_same_member(X,[_|T]) :- ref_same_member(X,T).
ref_term_text(Term,Text) :- term_string(Term,Text,[quoted(true),numbervars(true)]).

ref_missing_premise(bundle(Doc,S,Premises,Assumptions,_,_,_),Item) :-
    member(Premise,Premises), \+ ref_same_member(Premise,Assumptions),
    ref_id(Doc,S,Id), ref_term_text(Premise,Text), Item = _{id:Id,literal:Text}.
ref_extra_assumption(bundle(Doc,S,Premises,Assumptions,_,_,_),Item) :-
    member(Assumption,Assumptions), \+ ref_same_member(Assumption,Premises),
    ref_id(Doc,S,Id), ref_term_text(Assumption,Text), Item = _{id:Id,literal:Text}.
ref_premise_node(bundle(Doc,S,Premises,_,_,Heads,_),Item) :-
    member(Head,Heads), ref_same_member(Head,Premises),
    ref_id(Doc,S,Id), ref_term_text(Head,Text), Item = _{id:Id,literal:Text}.
ref_line_outside_gate(bundle(Doc,S,_,_,Lines,_,GateLines),Item) :-
    member(Line,Lines), \+ memberchk(Line,GateLines),
    ref_id(Doc,S,Id), Item = _{id:Id,line:Line}.

ref_doc_line_mismatch(Doc,Bundles,Item) :-
    findall(Line,(member(bundle(Doc,_,_,_,Lines,_,_),Bundles),member(Line,Lines)),Proof0),
    findall(Line,(member(bundle(Doc,_,_,_,_,_,Gate),Bundles),member(Line,Gate)),Gate0),
    sort(Proof0,Proof), sort(Gate0,Gate), Proof \== Gate,
    subtract(Gate,Proof,Missing), subtract(Proof,Gate,Extra),
    Item = _{document:Doc,missing:Missing,extra:Extra}.

ref_measure_o5 :-
    ref_keys(Keys), maplist(ref_bundle,Keys,Bundles),
    findall(P,(member(bundle(_,_,Premises,_,_,_,_),Bundles),member(P,Premises)),AllPremises),
    findall(A,(member(bundle(_,_,_,Assumptions,_,_,_),Bundles),member(A,Assumptions)),AllAssumptions),
    findall(L,(member(bundle(_,_,_,_,Lines,_,_),Bundles),member(L,Lines)),AllLines),
    findall(Item,(member(B,Bundles),ref_missing_premise(B,Item)),MissingPremises),
    findall(Item,(member(B,Bundles),ref_extra_assumption(B,Item)),ExtraAssumptions),
    findall(Item,(member(B,Bundles),ref_premise_node(B,Item)),PremiseNodes),
    findall(Item,(member(B,Bundles),ref_line_outside_gate(B,Item)),OutsideLines),
    ref_docs(Docs),
    findall(Item,(member(Doc,Docs),ref_doc_line_mismatch(Doc,Bundles,Item)),DocumentMismatches),
    length(AllPremises,PremiseRecords),
    length(AllAssumptions,AssumptionOccurrences), sort(AllAssumptions,UniqueAssumptions),
    length(UniqueAssumptions,UniqueAssumptionCount),
    length(AllLines,ProofLineOccurrences), sort(AllLines,UniqueLines), length(UniqueLines,UniqueLineCount),
    length(Bundles,Proofs), length(Docs,DocumentCount), length(DocumentMismatches,MismatchCount),
    MatchingDocuments is DocumentCount-MismatchCount,
    json_write_dict(current_output,_{
        proofs:Proofs,
        premise_records:PremiseRecords,
        assumption_occurrences:AssumptionOccurrences,
        unique_assumptions:UniqueAssumptionCount,
        missing_premises:MissingPremises,
        extra_assumptions:ExtraAssumptions,
        premise_literals_as_line_nodes:PremiseNodes,
        assumption_leaves_with_source_lines:0,
        proof_line_occurrences:ProofLineOccurrences,
        unique_proof_lines:UniqueLineCount,
        proof_lines_outside_sentence_gate:OutsideLines,
        document_line_unions:_{matching:MatchingDocuments,total:DocumentCount,mismatches:DocumentMismatches}
    },[width(0)]), nl.

ref_outcome(Doc,S,Cap,Outcome,Used) :-
    (once(ref_sentence(Doc,S,Cap,full,_,_,Used)) -> Outcome = proved ; Outcome = failed, Used = 0).

ref_measure_case(Doc-S,Cap,Result) :-
    statistics(inferences,I0), get_time(T0),
    ref_outcome(Doc,S,Cap,Outcome,Used),
    get_time(T1), statistics(inferences,I1),
    Inferences is I1-I0, WallMs is (T1-T0)*1000,
    call_with_inference_limit(ref_outcome(Doc,S,Cap,_,_),100000,InferenceGuard),
    call_with_depth_limit(ref_outcome(Doc,S,Cap,_,_),100,DepthReached),
    ref_id(Doc,S,Id),
    Result = _{
        id:Id,cap:Cap,outcome:Outcome,wall_ms:WallMs,inferences:Inferences,
        proved_tree_schema_depth:Used,inference_guard:InferenceGuard,depth_reached:DepthReached
    }.

ref_max_record(Field,[H|T],Best) :- ref_max_record_(T,Field,H,Best).
ref_max_record_([],_,Best,Best).
ref_max_record_([H|T],Field,Current,Best) :-
    get_dict(Field,H,HV), get_dict(Field,Current,CV),
    (HV > CV -> Next = H ; Next = Current),
    ref_max_record_(T,Field,Next,Best).

ref_guard_failure(Field,Cases,Item) :-
    member(Case,Cases), get_dict(Field,Case,Value),
    ((Field == inference_guard, Value == inference_limit_exceeded) ;
     (Field == depth_reached, Value == depth_limit_exceeded)),
    Item = Case.

ref_special_id('cdc2022-opioid-rec01',3).
ref_special_id('cdc2022-opioid-rec02',3).
ref_special_id('cdc2022-opioid-rec02',8).
ref_special_id('cdc2022-opioid-rec05',4).

ref_special_case(Cases,Item) :-
    ref_special_id(Doc,S), ref_id(Doc,S,Id),
    member(Item,Cases), get_dict(id,Item,Id), get_dict(cap,Item,2).

ref_measure_o6 :-
    ref_keys(Keys),
    forall((member(Cap,[1,2,3]),member(Doc-S,Keys)),ref_outcome(Doc,S,Cap,_,_)),
    findall(Case,
        (member(Cap,[1,2,3]),member(Key,Keys),ref_measure_case(Key,Cap,Case)),
        Cases),
    ref_max_record(wall_ms,Cases,WorstWall),
    ref_max_record(inferences,Cases,WorstInferences),
    ref_max_record(proved_tree_schema_depth,Cases,WorstSemanticDepth),
    ref_max_record(depth_reached,Cases,WorstCallDepth),
    findall(Item,ref_guard_failure(inference_guard,Cases,Item),InferenceFailures),
    findall(Item,ref_guard_failure(depth_reached,Cases,Item),DepthFailures),
    findall(Item,ref_special_case(Cases,Item),SpecialCases),
    current_prolog_flag(stack_limit,StackLimit),
    json_write_dict(current_output,_{
        envelope:_{stack_bytes:StackLimit,depth:100,inferences:100000,wall_ms:1000},
        measured_cases:144,
        worst_wall:WorstWall,
        worst_inferences:WorstInferences,
        worst_proved_tree_schema_depth:WorstSemanticDepth,
        worst_call_depth:WorstCallDepth,
        inference_limit_failures:InferenceFailures,
        depth_limit_failures:DepthFailures,
        native_unresolvable_handover:SpecialCases
    },[width(0)]), nl.

ref_schema_template(guideline_arg,4,guideline_arg(_,_,_,_)).
ref_schema_template(guideline_cardinality,5,guideline_cardinality(_,_,_,_,_)).
ref_schema_template(guideline_document,3,guideline_document(_,_,_)).
ref_schema_template(guideline_entity,4,guideline_entity(_,_,_,_)).
ref_schema_template(guideline_event,3,guideline_event(_,_,_)).
ref_schema_template(guideline_operator,3,guideline_operator(_,_,_)).
ref_schema_template(guideline_pp,4,guideline_pp(_,_,_,_)).
ref_schema_template(guideline_property,4,guideline_property(_,_,_,_)).
ref_schema_template(guideline_schema_version,1,guideline_schema_version(_)).

ref_schema_snapshot(Snapshot) :-
    findall(schema{predicate:Name,arity:Arity,clauses:Count,dynamic:Dynamic},
        (ref_schema_template(Name,Arity,Head),
         findall(1,clause(Head,_,_),Clauses), length(Clauses,Count),
         (predicate_property(Head,dynamic) -> Dynamic = true ; Dynamic = false)),
        Snapshot).

ref_static_count(Snapshot,Count) :-
    findall(1,(member(Item,Snapshot),get_dict(dynamic,Item,false)),Static), length(Static,Count).

ref_assert_probe(Status,ErrorText) :-
    catch(
        (assertz(guideline_schema_version(ref_probe)),
         retractall(guideline_schema_version(ref_probe)),
         Status = unexpected_success, ErrorText = ''),
        Error,
        (ref_term_text(Error,ErrorText),
         (Error = error(permission_error(modify,static_procedure,_),_) ->
             Status = permission_error
         ;   Status = unexpected_error))).

ref_measure_o7 :-
    ref_schema_snapshot(Before), ref_static_count(Before,StaticBefore),
    ref_count_proved(2,full,Derived),
    ref_schema_snapshot(After), ref_static_count(After,StaticAfter),
    (Before == After -> Unchanged = true ; Unchanged = false),
    ref_assert_probe(AssertStatus,AssertError),
    json_write_dict(current_output,_{
        derived:Derived,
        before:Before,
        after:After,
        snapshots_identical:Unchanged,
        static_predicates_before:StaticBefore,
        static_predicates_after:StaticAfter,
        direct_assertz:_{status:AssertStatus,error:AssertError}
    },[width(0)]), nl.
`;

const splitTopLevel = (text, delimiter) => {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '\\') {
        index += 1;
      } else if (char === "'" && text[index + 1] === "'") {
        index += 1;
      } else if (char === "'") {
        quoted = false;
      }
      continue;
    }
    if (char === "'") {
      quoted = true;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if (char === ')' || char === ']' || char === '}') depth -= 1;
    if (depth === 0 && text.startsWith(delimiter, index)) {
      parts.push(text.slice(start, index).trim());
      index += delimiter.length - 1;
      start = index + 1;
    }
  }
  if (quoted || depth !== 0) throw new Error(`unbalanced Prolog term: ${text}`);
  parts.push(text.slice(start).trim());
  return parts;
};

const outerParenthesized = (text) => {
  if (!text.startsWith('(') || !text.endsWith(')')) return false;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '\\') {
        index += 1;
      } else if (char === "'" && text[index + 1] === "'") {
        index += 1;
      } else if (char === "'") {
        quoted = false;
      }
      continue;
    }
    if (char === "'") quoted = true;
    else if (char === '(') depth += 1;
    else if (char === ')' && --depth === 0) return index === text.length - 1;
  }
  return false;
};

const unwrap = (text) => {
  let term = text.trim();
  while (outerParenthesized(term)) term = term.slice(1, -1).trim();
  return term;
};

const positiveLeaves = (body) => {
  const term = unwrap(body);
  if (term === 'true') return 0;
  if (term.startsWith('\\+')) return 0;
  for (const control of ['*->', '->', ';']) {
    if (splitTopLevel(term, control).length > 1) {
      throw new Error(`unsupported census control ${control}: ${term}`);
    }
  }
  const conjuncts = splitTopLevel(term, ',');
  if (conjuncts.length > 1) return conjuncts.reduce((sum, part) => sum + positiveLeaves(part), 0);
  return 1;
};

const clauseBody = (line) => {
  const clause = line.trim();
  if (!clause.endsWith('.')) throw new Error(`unterminated Prolog clause: ${line}`);
  const terms = splitTopLevel(clause.slice(0, -1), ':-');
  if (terms.length === 1) return 'true';
  if (terms.length === 2) return terms[1];
  throw new Error(`multiple clause separators: ${line}`);
};

const independentCensus = (files, source) => {
  const acePattern = /^data\/guidelines\/cdc-2022-opioid\/ace\/(cdc2022-opioid-rec\d{2})\.ace$/;
  const selections = [...files.keys()]
    .flatMap((name) => {
      const match = acePattern.exec(name);
      return match === null ? [] : [{ document: match[1], path: name }];
    })
    .sort((a, b) => a.document.localeCompare(b.document));
  const selected = new Set(selections.map(({ document }) => document));
  const contentKeys = new Set();
  const sentenceCounts = new Map();
  for (const { document, path } of selections) {
    const sentences = Buffer.from(files.get(path)).toString('utf8').split(/\r?\n/u).filter(Boolean);
    if (sentences.length < 2) throw new Error(`${document}: no content sentences`);
    sentenceCounts.set(document, sentences.length - 1);
    for (let index = 1; index < sentences.length; index += 1) {
      contentKeys.add(`${document}:${String(index + 1)}`);
    }
  }

  const sites = new Map();
  let activeDocument = null;
  let activeSentence = null;
  let sawMarker = false;
  let excludedPreambleSites = 0;
  for (const [index, line] of source.split('\n').entries()) {
    if (line.startsWith('% file:')) {
      activeDocument = null;
      activeSentence = null;
      sawMarker = false;
      const match = /\/pl\/(cdc2022-opioid-rec\d{2})\.pl$/u.exec(line.slice('% file:'.length));
      if (match !== null && selected.has(match[1])) activeDocument = match[1];
      continue;
    }
    if (activeDocument === null) continue;
    const marker = /^% S(\d+):/u.exec(line);
    if (marker !== null) {
      sawMarker = true;
      const sentence = Number(marker[1]);
      activeSentence = sentence > 1 ? sentence : null;
      continue;
    }
    if (!line.startsWith('guideline_')) continue;
    if (!sawMarker) excludedPreambleSites += 1;
    if (activeSentence === null) continue;
    const key = `${activeDocument}:${String(activeSentence)}`;
    const record = sites.get(key) ?? [];
    record.push({ line: index + 1, body: clauseBody(line) });
    sites.set(key, record);
  }

  const missingSentences = [...contentKeys].filter((key) => !sites.has(key));
  const unexpectedSentences = [...sites.keys()].filter((key) => !contentKeys.has(key));
  const antecedentViolations = [];
  let contentSites = 0;
  let premises = 0;
  const perDocument = [];
  for (const { document } of selections) {
    let documentSites = 0;
    let documentPremises = 0;
    for (const key of contentKeys) {
      if (!key.startsWith(`${document}:`)) continue;
      const clauses = sites.get(key) ?? [];
      contentSites += clauses.length;
      documentSites += clauses.length;
      const bodies = [...new Set(clauses.map(({ body }) => body))];
      if (bodies.length !== 1) antecedentViolations.push({ key, bodies: bodies.length });
      if (bodies.length === 1) {
        const count = positiveLeaves(bodies[0]);
        premises += count;
        documentPremises += count;
      }
    }
    perDocument.push({
      document,
      sentences: sentenceCounts.get(document),
      sites: documentSites,
      premises: documentPremises,
    });
  }

  const measured = {
    documents: selections.length,
    content_sentences: contentKeys.size,
    content_sites: contentSites,
    premises,
  };
  const expected = { documents: 12, content_sentences: 48, content_sites: 686, premises: 346 };
  const disagreements = Object.keys(expected).flatMap((key) =>
    measured[key] === expected[key] ? [] : [{ field: key, expected: expected[key], measured: measured[key] }],
  );
  return {
    selection_rule: 'base cdc2022-opioid-recNN ACE documents; implication files excluded',
    selected_documents: selections.map(({ document }) => document),
    measured,
    u1_claim: expected,
    disagreements,
    per_document: perDocument,
    missing_sentences: missingSentences,
    unexpected_sentences: unexpectedSentences,
    distinct_antecedent_violations: antecedentViolations,
    excluded_file_preamble_sites: excludedPreambleSites,
    record_predicates_consulted: [],
  };
};

const rows = process.argv.slice(2);
const requested = rows.length === 0 ? ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8'] : rows;
const supported = new Set(['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8']);
for (const row of requested) {
  if (!supported.has(row)) throw new Error(`unsupported row ${row}`);
}

const bag = verifyBag(readFileSync(BAG));
const documents = payloadDocuments(bag.files);
const prologRows = requested.filter((row) => row !== 'O8');
const mutationCalls = ['assertz', 'asserta', 'retract', 'retractall', 'erase'].filter((name) =>
  new RegExp(`\\b${name}\\s*\\(`, 'u').test(REF_SOURCE),
);
if (/(^|\n)\s*:-\s*dynamic\b/u.test(REF_SOURCE)) mutationCalls.push('dynamic');

try {
  let image = null;
  let staticPath = '';
  let dynamicPath = '';
  let harnessPath = '';
  if (prologRows.length > 0) {
    const clinical = clinicalArtifacts(bag.files);
    const source = `${documents.source}\n${clinical.source}\n${REF_SOURCE}\n`;
    mkdirSync(SCRATCH, { recursive: true });
    image = await buildImage(source);
    staticPath = join(SCRATCH, 'prolog.pl');
    dynamicPath = join(SCRATCH, 'prolog-dynamic.pl');
    harnessPath = join(SCRATCH, 'harness.pl');
    writeFileSync(staticPath, source);
    writeFileSync(dynamicPath, `${source}\n${DYNAMIC_SOURCE}\n`);
    writeFileSync(harnessPath, HARNESS_SOURCE);
  }

  for (const row of requested) {
    if (row === 'O8') {
      console.log(`O8 ${JSON.stringify(independentCensus(bag.files, documents.source))}`);
      continue;
    }
    const goal = `ref_measure_${row.toLowerCase()}`;
    const prolog = row === 'O2' || row === 'O4' ? dynamicPath : staticPath;
    const run = spawnSync(
      'swipl',
      ['--stack_limit=16m', '-q', '-f', prolog, '-s', harnessPath, '-g', goal, '-t', 'halt'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    if (run.status !== 0) {
      throw new Error(`${row} failed (rc ${String(run.status)}):\n${run.stderr}${run.stdout}`);
    }
    const result = JSON.parse(run.stdout.trim());
    result.image_contract = image.contract;
    if (row === 'O7') result.evaluator_mutation_calls = mutationCalls;
    console.log(`${row} ${JSON.stringify(result)}`);
  }
} finally {
  rmSync(SCRATCH, { recursive: true, force: true });
}
