:- module(cnl_wire, [run_text/3]).

run_text(Input, Canonical, Display) :-
  read_term_from_atom(Input, Goal,
    [ module(user),
      variable_names(Bindings)
    ]),
  call(user:Goal),
  serialize_term(Bindings, Canonical, Display).

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

variable_names([], _, []).
variable_names([Variable|Variables], Index, [Name=Variable|Names]) :-
  format(atom(Name), 'V~d', [Index]),
  Next is Index + 1,
  variable_names(Variables, Next, Names).
