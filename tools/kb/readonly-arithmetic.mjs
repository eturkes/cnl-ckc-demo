// Read-only arithmetic, compiled into the image after the proof source (`paths.mjs`).
//
// The inference budget prices every `is/2` at one inference, so a fail-driven loop of big-integer
// arithmetic held one step for minutes even under the 1000-byte integer cap. A read-only goal's
// arithmetic is therefore routed, at parse time, to twins that evaluate one operation per
// inference over integers within 62 bits and floats: each operation then costs a bounded time,
// and the budget bounds the step again. A twin computes exactly what `is/2` computes where it
// admits an expression; an operand or result past the bound raises
// `resource_error(read_only_arithmetic)`, which the budget wrapper reports as a resource error,
// and an expression it cannot read raises as `is/2` would (`tests/readonly-arithmetic.test.ts`).
//
// `'$ro_rewrite'/2` mirrors the goal positions of `src/engine/readonly.ts` `CONTROL` and touches
// nothing else: a term in a data position stays the term the model wrote.

export const READONLY_SOURCE = String.raw`'$ro_rewrite'(G, G) :- var(G), !.
'$ro_rewrite'((A, B), (RA, RB)) :- !, '$ro_rewrite'(A, RA), '$ro_rewrite'(B, RB).
'$ro_rewrite'((A ; B), (RA ; RB)) :- !, '$ro_rewrite'(A, RA), '$ro_rewrite'(B, RB).
'$ro_rewrite'((A -> B), (RA -> RB)) :- !, '$ro_rewrite'(A, RA), '$ro_rewrite'(B, RB).
'$ro_rewrite'((A *-> B), (RA *-> RB)) :- !, '$ro_rewrite'(A, RA), '$ro_rewrite'(B, RB).
'$ro_rewrite'(\+ A, \+ RA) :- !, '$ro_rewrite'(A, RA).
'$ro_rewrite'(not(A), not(RA)) :- !, '$ro_rewrite'(A, RA).
'$ro_rewrite'(once(A), once(RA)) :- !, '$ro_rewrite'(A, RA).
'$ro_rewrite'(ignore(A), ignore(RA)) :- !, '$ro_rewrite'(A, RA).
'$ro_rewrite'(forall(A, B), forall(RA, RB)) :- !, '$ro_rewrite'(A, RA), '$ro_rewrite'(B, RB).
'$ro_rewrite'(findall(T, G, L), findall(T, RG, L)) :- !, '$ro_rewrite'(G, RG).
'$ro_rewrite'(findall(T, G, L, M), findall(T, RG, L, M)) :- !, '$ro_rewrite'(G, RG).
'$ro_rewrite'(bagof(T, G, L), bagof(T, RG, L)) :- !, '$ro_rewrite'(G, RG).
'$ro_rewrite'(setof(T, G, L), setof(T, RG, L)) :- !, '$ro_rewrite'(G, RG).
'$ro_rewrite'(V ^ G, V ^ RG) :- !, '$ro_rewrite'(G, RG).
'$ro_rewrite'(X is E, '$ro_is'(X, E)) :- !.
'$ro_rewrite'(G, '$ro_compare'(G)) :- '$ro_comparison'(G), !.
'$ro_rewrite'(G, '$ro_builtin'(G)) :- '$ro_numeric_builtin'(G), !.
'$ro_rewrite'(G, G).
'$ro_comparison'(_ =:= _).
'$ro_comparison'(_ =\= _).
'$ro_comparison'(_ < _).
'$ro_comparison'(_ > _).
'$ro_comparison'(_ =< _).
'$ro_comparison'(_ >= _).
'$ro_numeric_builtin'(guideline_satisfies(_, _, _, _)).
'$ro_numeric_builtin'(guideline_satisfies(_, _, _, _, _, _)).
'$ro_numeric_builtin'(guideline_product(_, _, _, _, _, _)).
'$ro_numeric_builtin'(guideline_quotient(_, _, _, _, _, _)).
'$ro_bound'(4611686018427387903).
'$ro_refuse'(E) :- throw(error(resource_error(read_only_arithmetic), context('$ro_is'/2, E))).
'$ro_small'(N) :- integer(N), !, '$ro_bound'(B), N >= -B, N =< B.
'$ro_small'(N) :- float(N).
'$ro_check'(V, E) :- ( '$ro_small'(V) -> true ; '$ro_refuse'(E) ).
'$ro_function'(+, 2).
'$ro_function'(-, 2).
'$ro_function'(*, 2).
'$ro_function'(/, 2).
'$ro_function'(//, 2).
'$ro_function'(mod, 2).
'$ro_function'(rem, 2).
'$ro_function'(div, 2).
'$ro_function'(min, 2).
'$ro_function'(max, 2).
'$ro_function'(abs, 1).
'$ro_function'(sign, 1).
'$ro_function'(-, 1).
'$ro_function'(+, 1).
'$ro_function'(gcd, 2).
'$ro_function'(msb, 1).
'$ro_function'(sqrt, 1).
'$ro_function'(exp, 1).
'$ro_function'(log, 1).
'$ro_function'(**, 2).
'$ro_function'(^, 2).
'$ro_function'(float, 1).
'$ro_function'(integer, 1).
'$ro_function'(truncate, 1).
'$ro_function'(round, 1).
'$ro_function'(ceiling, 1).
'$ro_function'(floor, 1).
'$ro_function'(>>, 2).
'$ro_function'(<<, 2).
'$ro_constant'(pi).
'$ro_constant'(e).
'$ro_constant'(inf).
'$ro_constant'(nan).
'$ro_constant'(epsilon).
'$ro_grows'(F, [B, N], E) :- ( F == (**) ; F == (^) ), integer(B), integer(N), N > 1, abs(B) > 1, !,
    ( N * log(abs(B)) =< 63 * log(2) -> true ; '$ro_refuse'(E) ).
'$ro_grows'(<<, [X, N], E) :- integer(X), X =\= 0, integer(N), N > 0, !,
    ( msb(abs(X)) + N =< 63 -> true ; '$ro_refuse'(E) ).
'$ro_grows'(_, _, _).
'$ro_evals'([], []).
'$ro_evals'([A|As], [V|Vs]) :- '$ro_eval'(A, V), '$ro_evals'(As, Vs).
'$ro_eval'(E, _) :- var(E), !, throw(error(instantiation_error, context('$ro_is'/2, _))).
'$ro_eval'(E, V) :- number(E), !, '$ro_check'(E, E), V = E.
'$ro_eval'(E, V) :- atom(E), '$ro_constant'(E), !, V is E.
'$ro_eval'(E, V) :- compound(E), compound_name_arity(E, F, A), '$ro_function'(F, A), !,
    E =.. [F|Args], '$ro_evals'(Args, Vs), E1 =.. [F|Vs], '$ro_grows'(F, Vs, E),
    V0 is E1, '$ro_check'(V0, E), V = V0.
'$ro_eval'(E, _) :- throw(error(type_error(evaluable, E), context('$ro_is'/2, _))).
'$ro_is'(X, E) :- '$ro_eval'(E, V), X = V.
'$ro_compare'(G) :- G =.. [Op, A, B], '$ro_eval'(A, X), '$ro_eval'(B, Y), C =.. [Op, X, Y], call(C).
'$ro_bounded'(T) :- integer(T), !, '$ro_check'(T, T).
'$ro_bounded'(T) :- compound(T), !, T =.. [_|Args], '$ro_bounded_all'(Args).
'$ro_bounded'(_).
'$ro_bounded_all'([]).
'$ro_bounded_all'([A|As]) :- '$ro_bounded'(A), '$ro_bounded_all'(As).
'$ro_builtin'(G) :- '$ro_bounded'(G), call(G).
`;
