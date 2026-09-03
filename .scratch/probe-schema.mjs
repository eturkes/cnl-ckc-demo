import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const factory = require('swipl-wasm/dist/swipl/swipl-bundle-no-data');
const diagnostics = [];
const engine = await factory({
  arguments: ['-q', '-x', 'image.pvm'],
  preRun: [(m) => m.FS.writeFile('image.pvm', readFileSync('kb/generated/kb.pvm'))],
  print: () => {},
  printErr: (line) => diagnostics.push(line),
  on_output: (text, stream) => {
    if (stream === 'stderr') diagnostics.push(text);
  },
});

const once = (goal) => engine.prolog.query(goal).once();
const show = (label, goal) => console.log(`${label}:`, JSON.stringify(once(goal)));

show(
  'schema',
  "findall(Name/Arity,(current_predicate(Name/Arity),atom(Name),sub_atom(Name,0,10,_,guideline_)),Ps),sort(Ps,Preds),term_string(Preds,S,[quoted(true)]).",
);
show(
  'census',
  "findall(p(Name,Arity,N,R,D),(current_predicate(Name/Arity),atom(Name),sub_atom(Name,0,10,_,guideline_),functor(H,Name,Arity),predicate_property(H,number_of_clauses(N)),findall(1,(clause(H,B),B\\==true),Rules),length(Rules,R),(predicate_property(H,dynamic)->D=yes;D=no)),Rows),sort(Rows,Sorted),term_string(Sorted,S,[quoted(true)]).",
);
show(
  'environment',
  "current_prolog_flag(autoload,Autoload),current_prolog_flag(unknown,Unknown),(current_predicate(append/3)->Append=yes;Append=no),(current_predicate(member/2)->Member=yes;Member=no),(current_predicate(maplist/2)->Maplist=yes;Maplist=no),(current_predicate(sub_term/2)->SubTerm=yes;SubTerm=no),(catch(absolute_file_name(library(lists),_,[access(read),file_errors(fail)]),_,fail)->Lists=yes;Lists=no),(current_predicate(clause/2)->Clause=yes;Clause=no),(current_predicate(term_string/3)->TermString=yes;TermString=no),(current_predicate(findall/3)->Findall=yes;Findall=no),(current_predicate(length/2)->Length=yes;Length=no),(current_predicate(sort/2)->Sort=yes;Sort=no),(current_predicate(functor/3)->Functor=yes;Functor=no),(current_predicate(arg/3)->Arg=yes;Arg=no),(current_predicate(copy_term/2)->CopyTerm=yes;CopyTerm=no),(current_predicate(once/1)->Once=yes;Once=no),(current_predicate(call/1)->Call=yes;Call=no),(current_predicate(var/1)->Var=yes;Var=no),(current_predicate(nonvar/1)->Nonvar=yes;Nonvar=no).",
);

console.log('diagnostics:', JSON.stringify(diagnostics));
