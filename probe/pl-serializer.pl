:- module(pl_serializer,
  [ serialize_term/3,
    parse_and_serialize/3,
    run_and_serialize/3,
    category_a_native/1,
    category_a_solution/2,
    category_a_batch/2,
    category_a_cost/4,
    display_probe/5
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

run_and_serialize(Input, Canonical, Display) :-
  read_term_from_atom(Input, Goal, [module(user)]),
  call(user:Goal),
  serialize_term(Goal, Canonical, Display).

category_a_native(Answer) :-
  user:'$guideline_query_projection'(goal(Goal), answers([answer(Answer, _)])),
  call(user:Goal).

category_a_solution(Canonical, Display) :-
  category_a_native(Answer),
  serialize_term(Answer, Canonical, Display).

category_a_batch(Canonical, Display) :-
  findall(Answer, category_a_native(Answer), Answers),
  serialize_term(Answers, Canonical, Display).

category_a_cost(Iterations, QueryMs, SerializeMs, Canonical) :-
  statistics(cputime, QueryStart),
  findall(Answer, category_a_native(Answer), Answers),
  statistics(cputime, QueryEnd),
  serialize_term(Answers, Canonical, _),
  statistics(cputime, SerializeStart),
  forall(between(1, Iterations, _),
    ( serialize_term(Answers, Wire, Display),
      atom_length(Wire, _),
      atom_length(Display, _)
    )),
  statistics(cputime, SerializeEnd),
  QueryMs is (QueryEnd - QueryStart) * 1000,
  SerializeMs is (SerializeEnd - SerializeStart) * 1000 / Iterations.

display_probe(Input, Iterations, Display, Message, MicrosPerWrite) :-
  read_term_from_atom(Input, Term, [module(user)]),
  copy_term(Term, DisplayTerm),
  numbervars(DisplayTerm, 0, _),
  with_output_to(atom(Display), write_canonical(DisplayTerm)),
  message_to_string(DisplayTerm, MessageString),
  atom_string(Message, MessageString),
  statistics(cputime, Before),
  forall(between(1, Iterations, _),
    ( with_output_to(atom(Rendered), write_canonical(DisplayTerm)),
      atom_length(Rendered, _)
    )),
  statistics(cputime, After),
  MicrosPerWrite is (After - Before) * 1000000 / Iterations.

variable_names([], _, []).
variable_names([Variable|Variables], Index, [Name=Variable|Names]) :-
  format(atom(Name), 'V~d', [Index]),
  Next is Index + 1,
  variable_names(Variables, Next, Names).
