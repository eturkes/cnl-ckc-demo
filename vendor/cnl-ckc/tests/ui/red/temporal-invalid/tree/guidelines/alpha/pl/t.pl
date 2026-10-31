% t.pl compiled from ACE by ace_to_pl; regenerate via ckc compile; do not edit.
:- multifile(guideline_schema_version/1).
:- discontiguous(guideline_schema_version/1).
:- multifile(guideline_document/4).
:- discontiguous(guideline_document/4).
:- multifile(guideline_entity/4).
:- discontiguous(guideline_entity/4).
:- multifile(guideline_cardinality/5).
:- discontiguous(guideline_cardinality/5).
:- multifile(guideline_event/3).
:- discontiguous(guideline_event/3).
:- multifile(guideline_arg/4).
:- discontiguous(guideline_arg/4).
:- multifile(guideline_pp/4).
:- discontiguous(guideline_pp/4).
:- multifile(guideline_property/4).
:- discontiguous(guideline_property/4).
:- multifile(guideline_operator/3).
:- discontiguous(guideline_operator/3).
:- multifile(guideline_interval/6).
:- discontiguous(guideline_interval/6).
:- multifile(guideline_recurrence/4).
:- discontiguous(guideline_recurrence/4).
:- multifile(guideline_frequency/5).
:- discontiguous(guideline_frequency/5).
:- multifile(guideline_order/4).
:- discontiguous(guideline_order/4).
:- multifile(guideline_recurrence_window/7).
:- discontiguous(guideline_recurrence_window/7).
:- multifile(guideline_range/3).
:- discontiguous(guideline_range/3).
:- multifile(guideline_grade/5).
:- discontiguous(guideline_grade/5).
:- multifile(guideline_preference/4).
:- discontiguous(guideline_preference/4).
:- multifile(guideline_qualifier/4).
:- discontiguous(guideline_qualifier/4).
:- multifile(guideline_unit/3).
:- discontiguous(guideline_unit/3).
:- multifile(guideline_exclusion/1).
:- discontiguous(guideline_exclusion/1).
:- multifile(guideline_supersession/4).
:- discontiguous(guideline_supersession/4).
:- multifile(guideline_evaluation_date/1).
:- discontiguous(guideline_evaluation_date/1).
guideline_schema_version(1).
guideline_document(t,ace_sha256('80b28b8a92556c401791f7adf46640ab50a0f5846616a87acd1340eecc986aaf'),ulex(none),vocabulary(sha256('7be1567b05a1cd388735c0a412c76ec9b22e5bd4880ac05a140bb78ff6923a9d'))).
% S1: Every man waits for 1 day.
guideline_entity(actual,'$guideline_id'(product,t,1,ref(2),[A]),day,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,1,ref(2),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_event(actual,'$guideline_id'(product,t,1,ref(3),[A]),wait) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,1,ref(3),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_pp(actual,'$guideline_id'(product,t,1,ref(3),[A]),for,'$guideline_id'(product,t,1,ref(2),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_interval(actual,'$guideline_id'(product,t,1,ref(3),[A]),duration,'$guideline_id'(product,t,1,ref(2),[A]),day,none) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
% S2: Every man reads a book after at least 2 weeks of a visit.
guideline_entity(actual,'$guideline_id'(product,t,2,ref(2),[A]),book,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,2,ref(2),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,2,ref(3),[A]),week,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,2,ref(3),[A]),na,geq,2) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,2,ref(4),[A]),visit,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,2,ref(4),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_event(actual,'$guideline_id'(product,t,2,ref(5),[A]),read) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,2,ref(5),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,2,ref(5),[A]),2,'$guideline_id'(product,t,2,ref(2),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_pp(actual,'$guideline_id'(product,t,2,ref(5),[A]),after,'$guideline_id'(product,t,2,ref(3),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_interval(actual,'$guideline_id'(product,t,2,ref(5),[A]),after,'$guideline_id'(product,t,2,ref(3),[A]),week,'$guideline_id'(product,t,2,ref(4),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
% S3: Every man sees a woman within at most 4 weeks of a trip.
guideline_entity(actual,'$guideline_id'(product,t,3,ref(2),[A]),woman,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,3,ref(2),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_pp(actual,'$guideline_id'(product,t,3,ref(3),[A]),within,'$guideline_id'(product,t,3,ref(4),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_interval(actual,'$guideline_id'(product,t,3,ref(3),[A]),within,'$guideline_id'(product,t,3,ref(4),[A]),week,'$guideline_id'(product,t,3,ref(5),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_event(actual,'$guideline_id'(product,t,3,ref(3),[A]),see) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,3,ref(3),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,3,ref(3),[A]),2,'$guideline_id'(product,t,3,ref(2),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,3,ref(5),[A]),trip,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,3,ref(5),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,3,ref(4),[A]),week,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,3,ref(4),[A]),na,leq,4) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
% S4: Every man sees a woman at an interval of at most 3 months.
guideline_entity(actual,'$guideline_id'(product,t,4,ref(2),[A]),woman,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,4,ref(2),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,4,ref(3),[A]),interval,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,4,ref(3),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,4,ref(4),[A]),month,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,4,ref(4),[A]),na,leq,3) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_event(actual,'$guideline_id'(product,t,4,ref(5),[A]),see) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,4,ref(5),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,4,ref(5),[A]),2,'$guideline_id'(product,t,4,ref(2),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_pp(actual,'$guideline_id'(product,t,4,ref(5),[A]),at,'$guideline_id'(product,t,4,ref(3),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_recurrence(actual,'$guideline_id'(product,t,4,ref(5),[A]),'$guideline_id'(product,t,4,ref(4),[A]),month) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
% S5: Every man waits after 3 days.
guideline_entity(actual,'$guideline_id'(product,t,5,ref(2),[A]),day,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,5,ref(2),[A]),na,eq,3) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_event(actual,'$guideline_id'(product,t,5,ref(3),[A]),wait) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,5,ref(3),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_pp(actual,'$guideline_id'(product,t,5,ref(3),[A]),after,'$guideline_id'(product,t,5,ref(2),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_interval(actual,'$guideline_id'(product,t,5,ref(3),[A]),after,'$guideline_id'(product,t,5,ref(2),[A]),day,none) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
% S6: If a man waits for more than 3 months then the man reads a book.
guideline_entity(actual,'$guideline_id'(product,t,6,ref(4),[A,B,C]),book,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), guideline_entity(actual,B,month,countable), guideline_cardinality(actual,B,na,greater,3), guideline_event(actual,C,wait), guideline_arg(actual,C,1,A), guideline_pp(actual,C,for,B), guideline_interval(actual,C,duration,B,month,none).
guideline_cardinality(actual,'$guideline_id'(product,t,6,ref(4),[A,B,C]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), guideline_entity(actual,B,month,countable), guideline_cardinality(actual,B,na,greater,3), guideline_event(actual,C,wait), guideline_arg(actual,C,1,A), guideline_pp(actual,C,for,B), guideline_interval(actual,C,duration,B,month,none).
guideline_event(actual,'$guideline_id'(product,t,6,ref(5),[A,B,C]),read) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), guideline_entity(actual,B,month,countable), guideline_cardinality(actual,B,na,greater,3), guideline_event(actual,C,wait), guideline_arg(actual,C,1,A), guideline_pp(actual,C,for,B), guideline_interval(actual,C,duration,B,month,none).
guideline_arg(actual,'$guideline_id'(product,t,6,ref(5),[A,B,C]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), guideline_entity(actual,B,month,countable), guideline_cardinality(actual,B,na,greater,3), guideline_event(actual,C,wait), guideline_arg(actual,C,1,A), guideline_pp(actual,C,for,B), guideline_interval(actual,C,duration,B,month,none).
guideline_arg(actual,'$guideline_id'(product,t,6,ref(5),[A,B,C]),2,'$guideline_id'(product,t,6,ref(4),[A,B,C])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), guideline_entity(actual,B,month,countable), guideline_cardinality(actual,B,na,greater,3), guideline_event(actual,C,wait), guideline_arg(actual,C,1,A), guideline_pp(actual,C,for,B), guideline_interval(actual,C,duration,B,month,none).
% S7: Every man that does not provably wait for less than 1 month sees a woman.
guideline_entity(actual,'$guideline_id'(product,t,7,ref(4),[A]),woman,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), \+ (guideline_pp(actual,B,for,C), guideline_interval(actual,B,duration,C,month,none), guideline_event(actual,B,wait), guideline_arg(actual,B,1,A), guideline_entity(actual,C,month,countable), guideline_cardinality(actual,C,na,less,1)).
guideline_cardinality(actual,'$guideline_id'(product,t,7,ref(4),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), \+ (guideline_pp(actual,B,for,C), guideline_interval(actual,B,duration,C,month,none), guideline_event(actual,B,wait), guideline_arg(actual,B,1,A), guideline_entity(actual,C,month,countable), guideline_cardinality(actual,C,na,less,1)).
guideline_event(actual,'$guideline_id'(product,t,7,ref(5),[A]),see) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), \+ (guideline_pp(actual,B,for,C), guideline_interval(actual,B,duration,C,month,none), guideline_event(actual,B,wait), guideline_arg(actual,B,1,A), guideline_entity(actual,C,month,countable), guideline_cardinality(actual,C,na,less,1)).
guideline_arg(actual,'$guideline_id'(product,t,7,ref(5),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), \+ (guideline_pp(actual,B,for,C), guideline_interval(actual,B,duration,C,month,none), guideline_event(actual,B,wait), guideline_arg(actual,B,1,A), guideline_entity(actual,C,month,countable), guideline_cardinality(actual,C,na,less,1)).
guideline_arg(actual,'$guideline_id'(product,t,7,ref(5),[A]),2,'$guideline_id'(product,t,7,ref(4),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1), \+ (guideline_pp(actual,B,for,C), guideline_interval(actual,B,duration,C,month,none), guideline_event(actual,B,wait), guideline_arg(actual,B,1,A), guideline_entity(actual,C,month,countable), guideline_cardinality(actual,C,na,less,1)).
% S8: Every man waits for exactly 2 days.
guideline_pp(actual,'$guideline_id'(product,t,8,ref(2),[A]),for,'$guideline_id'(product,t,8,ref(3),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_interval(actual,'$guideline_id'(product,t,8,ref(2),[A]),duration,'$guideline_id'(product,t,8,ref(3),[A]),day,none) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_event(actual,'$guideline_id'(product,t,8,ref(2),[A]),wait) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,8,ref(2),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,8,ref(3),[A]),day,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,8,ref(3),[A]),na,exactly,2) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
% S9: Every woman reads a book before at most 3 hours of a visit.
guideline_entity(actual,'$guideline_id'(product,t,9,ref(2),[A]),book,countable) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,9,ref(2),[A]),na,eq,1) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_pp(actual,'$guideline_id'(product,t,9,ref(3),[A]),before,'$guideline_id'(product,t,9,ref(4),[A])) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_interval(actual,'$guideline_id'(product,t,9,ref(3),[A]),before,'$guideline_id'(product,t,9,ref(4),[A]),hour,'$guideline_id'(product,t,9,ref(5),[A])) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_event(actual,'$guideline_id'(product,t,9,ref(3),[A]),read) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,9,ref(3),[A]),1,A) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,t,9,ref(3),[A]),2,'$guideline_id'(product,t,9,ref(2),[A])) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,9,ref(5),[A]),visit,countable) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,9,ref(5),[A]),na,eq,1) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_entity(actual,'$guideline_id'(product,t,9,ref(4),[A]),hour,countable) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,t,9,ref(4),[A]),na,leq,3) :- guideline_entity(actual,A,woman,countable), guideline_cardinality(actual,A,na,eq,1).
