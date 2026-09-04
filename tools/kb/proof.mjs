// Built-in-only, depth-capped meta-interpreter compiled into the saved state.
//
// This is deliberately source, rather than a runtime `consult`: appending it to
// the deterministic payload gives every clause one stable line in /prolog.pl and
// keeps a proof request from mutating the already-booted engine.

export const PROOF_SOURCE = String.raw`schema_goal(guideline_arg(_,_,_,_)).
schema_goal(guideline_cardinality(_,_,_,_,_)).
schema_goal(guideline_document(_,_,_)).
schema_goal(guideline_entity(_,_,_,_)).
schema_goal(guideline_event(_,_,_)).
schema_goal(guideline_operator(_,_,_)).
schema_goal(guideline_pp(_,_,_,_)).
schema_goal(guideline_property(_,_,_,_)).
schema_goal(guideline_schema_version(_)).
resolve(guideline_arg(A,B,C,D),Body,L) :- clause(guideline_arg(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_cardinality(A,B,C,D,E),Body,L) :- clause(guideline_cardinality(A,B,C,D,E),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_document(A,B,C),Body,L) :- clause(guideline_document(A,B,C),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_entity(A,B,C,D),Body,L) :- clause(guideline_entity(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_event(A,B,C),Body,L) :- clause(guideline_event(A,B,C),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_operator(A,B,C),Body,L) :- clause(guideline_operator(A,B,C),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_pp(A,B,C,D),Body,L) :- clause(guideline_pp(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_property(A,B,C,D),Body,L) :- clause(guideline_property(A,B,C,D),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
resolve(guideline_schema_version(A),Body,L) :- clause(guideline_schema_version(A),Body,R), clause_property(R,file('/prolog.pl')), clause_property(R,line_count(L)).
app([],L,L).
app([H|T],L,[H|R]) :- app(T,L,R).
has(X,[H|_]) :- X == H, !.
has(X,[_|T]) :- has(X,T).
naf_status(S,proved) :- \+ has(proved,S), \+ has(limit,S), !.
naf_status(S,limit) :- \+ has(proved,S), has(limit,S), !.
derive(true,_,[],proved) :- !.
derive(M:A,D,P,S) :- !, (M == user -> derive(A,D,P,S) ; P=[], S=limit).
derive((A,B),D,P,S) :- !, derive_conjunction(A,B,D,P,S).
derive(\+ A,D,[naf(A)],S) :- !, findall(R,derive(A,D,_,R),Rs), naf_status(Rs,S).
derive(H,0,[],limit) :- schema_goal(H), !.
derive(H,D,[node(line(L),H,Sub)],S) :- D > 0, D1 is D-1, resolve(H,B,L), derive(B,D1,Sub,S).
derive_conjunction(A,B,D,P,proved) :- derive(A,D,PA,proved), derive(B,D,PB,proved), app(PA,PB,P).
derive_conjunction(A,_,D,[],limit) :- derive(A,D,_,limit).
derive_conjunction(A,B,D,[],limit) :- derive(A,D,_,proved), derive(B,D,_,limit).
mi(G,D,P) :- derive(G,D,P,proved).
mi_limited(G,D) :- derive(G,D,_,limit), !.
`;
