% h.pl compiled from ACE by ace_to_pl; regenerate via ckc compile; do not edit.
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
guideline_document(h,ace_sha256(d3b600c6172d4ccbc62a6e5182a1ec940df74338c4ed2fe2254d79a96342187f),ulex(none),vocabulary(sha256('7be1567b05a1cd388735c0a412c76ec9b22e5bd4880ac05a140bb78ff6923a9d'))).
% S1: Every man waits after 3 days of a visit.
guideline_entity(actual,'$guideline_id'(product,h,1,ref(2),[A]),day,countable) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_cardinality(actual,'$guideline_id'(product,h,1,ref(3),[A]),na,eq,1) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_arg(actual,'$guideline_id'(product,h,1,ref(4),[A]),1,A) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_pp(actual,'$guideline_id'(product,h,1,ref(4),[A]),after,'$guideline_id'(product,h,1,ref(2),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
guideline_interval(actual,'$guideline_id'(product,h,1,ref(4),[A]),after,'$guideline_id'(product,h,1,ref(2),[A]),day,'$guideline_id'(product,h,1,ref(3),[A])) :- guideline_entity(actual,A,man,countable), guideline_cardinality(actual,A,na,eq,1).
