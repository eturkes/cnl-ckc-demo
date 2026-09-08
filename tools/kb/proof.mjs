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
// Cap 2 is the least sufficient depth: cap 1 proves 47 of the 48 content
// sentences, failing only the corpus's one NAF antecedent.
//
// `gate_heads/2` reads u1's cited heads out of the STORED `clinical_gate/4`
// body. Calling the gate instead is circular — `clinical_use/2` runs `call(Body)`,
// which demands the very premises the evaluator supplies. `clinical_derive/5`
// binds `Rule` only after `derive_all/4` succeeds, so the fragment data is gated
// on a real derivation rather than looked up.
//
// The `clinical_advice/3` arm hands its proof straight to `clinical_advice/4`,
// the same clause that assembles the answer. One derivation therefore produces
// both, so the displayed proof cannot drift from the answer it explains, and no
// precomputed statement or site list is left in the image for it to read back.

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
assumed(H,[A|_]) :- H = A.
assumed(H,[_|T]) :- assumed(H,T).
derive(true,_,_,[],proved) :- !.
derive(M:A,D,As,P,S) :- !, (M == user -> derive(A,D,As,P,S) ; P=[], S=limit).
derive((A,B),D,As,P,S) :- !, derive_conjunction(A,B,D,As,P,S).
derive(\+ A,D,As,[naf(A)],S) :- !, findall(R,derive(A,D,As,_,R),Rs), naf_status(Rs,S).
derive(clinical_advice(Q,Source,Answer),_,_,P,proved) :- !, clinical_advice(Q,Source,Answer,P).
derive(H,_,As,[assumption(H)],proved) :- assumed(H,As), !.
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
`;
