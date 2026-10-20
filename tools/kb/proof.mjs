// Built-in-only, depth-capped meta-interpreter compiled into the saved state.
//
// This is deliberately source, rather than a runtime `consult`: appending it to
// the deterministic payload gives every clause one stable line in /prolog.pl and
// keeps a proof request from mutating the already-booted engine.
//
// `derive/5` carries a query-local assumption list, which is what applies a
// guideline's universal quantification over clinicians without writing to the
// world: the `actual` world holds no clinician instance, so `guideline_operator`
// correctly fails on the bare KB, and `assertz` would leave a fake instance
// visible to every later query. The assumption clause sits before the depth cap
// and before `resolve/3` and commits, so an assumed literal never also resolves
// against a KB clause and never fabricates a `line(L)` for a hypothesis.
//
// Cap 2 is the least sufficient depth: cap 1 proves 51 of the 53 content
// sentences, failing only the corpus's two NAF antecedents.
//
// `gate_heads/2` reads u1's cited heads out of the STORED `clinical_gate/4`
// body. Calling the gate instead is circular — `clinical_use/2` runs `call(Body)`,
// which demands the very premises the evaluator supplies. `clinical_derive/5`
// binds `Rule` only after `derive_all/4` succeeds, so the fragment data is gated
// on a real derivation rather than looked up.
//
// A comparison built-in (`guideline_satisfies/4,6`, defined in `schema.pl`, in no document) is
// evaluated where it stands and leaves a line-free `builtin(G)` leaf, as upstream's traces record
// it: no clause states it, no depth is spent on it, and no premise can stand in for it, since an
// assumption replaces a schema relation alone.
//
// The `clinical_advice/3` arm hands its proof straight to `clinical_advice/4`,
// the same clause that assembles the answer. One derivation therefore produces
// both, so the displayed proof cannot drift from the answer it explains, and no
// precomputed statement or site list is left in the image for it to read back.

export const PROOF_SOURCE = String.raw`schema_goal(guideline_arg(_,_,_,_)).
schema_goal(guideline_cardinality(_,_,_,_,_)).
schema_goal(guideline_document(_,_,_,_)).
schema_goal(guideline_entity(_,_,_,_)).
schema_goal(guideline_event(_,_,_)).
schema_goal(guideline_frequency(_,_,_,_,_)).
schema_goal(guideline_grade(_,_,_,_,_)).
schema_goal(guideline_interval(_,_,_,_,_,_)).
schema_goal(guideline_operator(_,_,_)).
schema_goal(guideline_order(_,_,_,_)).
schema_goal(guideline_pp(_,_,_,_)).
schema_goal(guideline_preference(_,_,_,_)).
schema_goal(guideline_property(_,_,_,_)).
schema_goal(guideline_qualifier(_,_,_,_)).
schema_goal(guideline_range(_,_,_)).
schema_goal(guideline_recurrence(_,_,_,_)).
schema_goal(guideline_recurrence_window(_,_,_,_,_,_,_)).
schema_goal(guideline_schema_version(_)).
schema_goal(guideline_unit(_,_,_)).
comparison_goal(guideline_satisfies(_,_,_,_)).
comparison_goal(guideline_satisfies(_,_,_,_,_,_)).
resolve(guideline_arg(A,B,C,D),Body,L) :- clause(guideline_arg(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_cardinality(A,B,C,D,E),Body,L) :- clause(guideline_cardinality(A,B,C,D,E),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_document(A,B,C,D),Body,L) :- clause(guideline_document(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_entity(A,B,C,D),Body,L) :- clause(guideline_entity(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_event(A,B,C),Body,L) :- clause(guideline_event(A,B,C),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_frequency(A,B,C,D,E),Body,L) :- clause(guideline_frequency(A,B,C,D,E),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_grade(A,B,C,D,E),Body,L) :- clause(guideline_grade(A,B,C,D,E),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_interval(A,B,C,D,E,F),Body,L) :- clause(guideline_interval(A,B,C,D,E,F),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_operator(A,B,C),Body,L) :- clause(guideline_operator(A,B,C),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_order(A,B,C,D),Body,L) :- clause(guideline_order(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_pp(A,B,C,D),Body,L) :- clause(guideline_pp(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_preference(A,B,C,D),Body,L) :- clause(guideline_preference(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_property(A,B,C,D),Body,L) :- clause(guideline_property(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_qualifier(A,B,C,D),Body,L) :- clause(guideline_qualifier(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_range(A,B,C),Body,L) :- clause(guideline_range(A,B,C),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_recurrence(A,B,C,D),Body,L) :- clause(guideline_recurrence(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_recurrence_window(A,B,C,D,E,F,G),Body,L) :- clause(guideline_recurrence_window(A,B,C,D,E,F,G),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_schema_version(A),Body,L) :- clause(guideline_schema_version(A),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_unit(A,B,C),Body,L) :- clause(guideline_unit(A,B,C),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
app([],L,L).
app([H|T],L,[H|R]) :- app(T,L,R).
has(X,[H|_]) :- X == H, !.
has(X,[_|T]) :- has(X,T).
naf_status(S,proved) :- \+ has(proved,S), \+ has(limit,S), !.
naf_status(S,limit) :- \+ has(proved,S), has(limit,S), !.
assumed(H,[A|_]) :- H = A.
assumed(H,[_|T]) :- assumed(H,T).
derive(true,_,_,[],proved) :- !.
derive(M:A,D,As,P,S) :- !, (M == user -> derive(A,D,As,P,S) ; P=[], S=limit).
derive((A,B),D,As,P,S) :- !, derive_conjunction(A,B,D,As,P,S).
derive(\+ A,D,As,[naf(A)],S) :- !, findall(R,derive(A,D,As,_,R),Rs), naf_status(Rs,S).
derive(clinical_advice(Q,Source,Answer),_,_,P,proved) :- !, clinical_advice(Q,Source,Answer,P).
derive(G,_,_,[builtin(G)],proved) :- comparison_goal(G), !, call(G).
derive(H,_,As,[assumption(H)],proved) :- schema_goal(H), assumed(H,As), !.
derive(H,0,_,[],limit) :- schema_goal(H), !.
derive(H,D,As,[node(line(L),H,Sub)],S) :- D > 0, D1 is D-1, resolve(H,B,L), derive(B,D1,As,Sub,S).
derive_conjunction(A,B,D,As,P,proved) :- derive(A,D,As,PA,proved), derive(B,D,As,PB,proved), app(PA,PB,P).
derive_conjunction(A,_,D,As,[],limit) :- derive(A,D,As,_,limit).
derive_conjunction(A,B,D,As,[],limit) :- derive(A,D,As,_,proved), derive(B,D,As,_,limit).
derive_all([],_,_,[]).
derive_all([H|T],D,As,P) :- derive(H,D,As,PH,proved), derive_all(T,D,As,PT), app(PH,PT,P).
gate_heads((clinical_use(_,H),B),[H|T]) :- !, gate_heads(B,T).
gate_heads(_,[]).
clinical_depth(2).
clinical_context(Doc,S,As) :- findall(L,clinical_premise(Doc,S,_,L),As).
clinical_derive(Doc,S,Rule,P) :- clinical_depth(D), clinical_derive(Doc,S,D,Rule,P).
clinical_derive(Doc,S,D,Rule,P) :- clause(clinical_gate(Doc,S,_,_),Body,_), gate_heads(Body,Heads), clinical_context(Doc,S,As), derive_all(Heads,D,As,P), clinical_rule(Doc,S,Rule).
mi(G,D,P) :- derive(G,D,[],P,proved).
mi_limited(G,D) :- derive(G,D,[],_,limit), !.
clinical_derived(Doc,Derived) :- findall(S,clause(clinical_gate(Doc,S,_,_),_,_),Sentences), clinical_derived(Sentences,Doc,Derived).
clinical_derived([],_,[]).
clinical_derived([S|Ss],Doc,[d(S,Rule,P)|T]) :- clinical_derive(Doc,S,Rule,P), !, clinical_derived(Ss,Doc,T).
clinical_marks(Q,'$guideline_id'(product,Doc,First,ref(1),[]),marks(Doc,Grades,Groups)) :- clinical_source(Q,Doc,First), clinical_derived(Doc,Derived), mark_sentences(Derived,Marked), clinical_split(Derived,Rules,_), clinical_groups(Rules,Answer), mark_groups(Answer,Marked,Groups), mark_grades(Doc,Grades).
mark_member(X,[X|_]).
mark_member(X,[_|T]) :- mark_member(X,T).
mark_sentences([],[]).
mark_sentences([d(S,R,P)|T],[m(R,sentence(S,Qs,Ps,Ts))|M]) :- mark_nodes(P), mark_qualifiers(P,Qs), mark_preferences(P,P,Ps), mark_times(P,P,Ts), mark_sentences(T,M).
mark_nodes([]).
mark_nodes([node(_,H,_)|T]) :- \+ mark_uncovered(H), mark_nodes(T).
mark_uncovered(guideline_recurrence(_,_,_,_)).
mark_uncovered(guideline_frequency(_,_,_,_,_)).
mark_uncovered(guideline_recurrence_window(_,_,_,_,_,_,_)).
mark_uncovered(guideline_range(_,_,_)).
mark_qualifiers([],[]).
mark_qualifiers([node(_,guideline_qualifier(_,_,C,W),_)|T],[qualifier(C,W)|Qs]) :- !, mark_qualifiers(T,Qs).
mark_qualifiers([_|T],Qs) :- mark_qualifiers(T,Qs).
mark_preferences([],_,[]).
mark_preferences([node(_,guideline_preference(_,_,R,A),_)|T],P,[preference(N,M)|Ps]) :- !, mark_noun(R,P,N), mark_alternative(A,P,M), mark_preferences(T,P,Ps).
mark_preferences([_|T],P,Ps) :- mark_preferences(T,P,Ps).
mark_alternative(none,_,none) :- !.
mark_alternative(A,P,N) :- mark_noun(A,P,N), N \== none.
mark_times([],_,[]).
mark_times([node(_,guideline_interval(_,_,Role,Q,U,A),_)|T],P,[interval(Role,C,N,U,X)|Ts]) :- !, A \== none, mark_quantity(Q,P,C,N), mark_noun(A,P,X), mark_times(T,P,Ts).
mark_times([node(_,guideline_order(_,_,Relation,A),_)|T],P,[order(Relation,X)|Ts]) :- !, mark_noun(A,P,X), mark_times(T,P,Ts).
mark_times([_|T],P,Ts) :- mark_times(T,P,Ts).
mark_quantity(Q,P,C,N) :- mark_member(node(_,guideline_cardinality(_,Q,_,C,N),_),P), !.
mark_noun(R,P,N) :- mark_member(node(_,guideline_entity(_,R,N,_),_),P), !.
mark_noun(R,P,N) :- mark_member(node(_,guideline_property(_,R,N,_),_),P), !.
mark_groups([],_,[]).
mark_groups([rule(_,Su,Mo,A)|T],Marked,[group(Ss)|Gs]) :- findall(X,(mark_member(m(rule(_,Su1,Mo1,A1),X),Marked),Su1 == Su,Mo1 == Mo,A1 == A),Ss), Ss \== [], mark_groups(T,Marked,Gs).
mark_grades(Doc,Grades) :- findall(G,(G = guideline_grade(actual,'$guideline_id'(product,Doc,_,_,_),_,_,_),derive(G,1,[],_,proved)),Heads), mark_labels(Heads,Grades).
mark_labels([],[]).
mark_labels([guideline_grade(_,_,D,V,L)|T],[grade(D,V,N)|Gs]) :- derive(guideline_entity(actual,L,N,_),1,[],_,proved), !, mark_labels(T,Gs).
`;
