:- module(pl_serializer,
  [ serialize_term/3,
    parse_and_serialize/3,
    category_a_solution/2
  ]).

serialize_term(Term, Canonical, Display) :-
  term_variables(Term, Variables),
  variable_names(Variables, 0, Names),
  with_output_to(atom(Canonical),
    write_term(Term,
      [ quoted(true),
        ignore_ops(true),
        numbervars(false),
        variable_names(Names)
      ])),
  copy_term(Term, DisplayTerm),
  numbervars(DisplayTerm, 0, _),
  with_output_to(atom(Display), write_canonical(DisplayTerm)).

parse_and_serialize(Input, Canonical, Display) :-
  read_term_from_atom(Input, Term, [module(user)]),
  serialize_term(Term, Canonical, Display).

category_a_solution(Canonical, Display) :-
  user:'$guideline_query_projection'(goal(Goal), answers([answer(Answer, _)])),
  call(user:Goal),
  serialize_term(Answer, Canonical, Display).

variable_names([], _, []).
variable_names([Variable|Variables], Index, [Name=Variable|Names]) :-
  format(atom(Name), 'V~d', [Index]),
  Next is Index + 1,
  variable_names(Variables, Next, Names).
