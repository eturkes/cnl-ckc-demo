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
guideline_document(h,ace_sha256('31c53b2332173e5ef42969570b88ec5fc6a00193ab6d4dc263248f2c9c381c1d'),ulex(none),vocabulary(sha256(bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb))).
% S1: A man waits.
guideline_event(actual,e101,wait).
guideline_cardinality(actual,h101,na,eq,3).
guideline_interval(actual,e101,duration,q101,hour,none).
guideline_range(actual,q101,h101).
% S2: A man waits.
guideline_event(actual,e102,wait).
guideline_cardinality(actual,q102,na,geq,2).
guideline_interval(actual,e102,duration,q102,hour,none).
guideline_range(actual,q102,h102).
% S3: A man waits.
guideline_event(actual,e103,wait).
guideline_cardinality(actual,q103,na,eq,2).
guideline_cardinality(actual,h103,na,eq,3).
guideline_interval(actual,e103,duration,q103,hour,none).
guideline_range(actual,q103,h103).
% S4: A man waits.
guideline_event(actual,e104,wait).
guideline_cardinality(actual,q104,na,geq,2).
guideline_cardinality(actual,h104,na,about,3).
guideline_interval(actual,e104,duration,q104,hour,none).
guideline_range(actual,q104,h104).
% S5: A man waits.
guideline_event(actual,e105,wait).
guideline_cardinality(actual,q105,na,geq,2).
guideline_cardinality(actual,h105,na,exactly,3).
guideline_interval(actual,e105,duration,q105,hour,none).
guideline_range(actual,q105,h105).
% S6: A man waits.
guideline_event(actual,e106,wait).
guideline_cardinality(actual,q106,na,geq,-1).
guideline_cardinality(actual,h106,na,eq,3).
guideline_interval(actual,e106,duration,q106,hour,none).
guideline_range(actual,q106,h106).
% S7: A man waits.
guideline_event(actual,e107,wait).
guideline_cardinality(actual,q107,na,geq,2).
guideline_cardinality(actual,h107,na,eq,-3).
guideline_interval(actual,e107,duration,q107,hour,none).
guideline_range(actual,q107,h107).
% S8: A man waits.
guideline_event(actual,e108,wait).
guideline_cardinality(actual,q108,na,geq,2).
guideline_cardinality(actual,other108,na,eq,3).
guideline_interval(actual,e108,duration,q108,hour,none).
guideline_range(actual,q108,h108).
% S9: A man waits.
guideline_event(actual,e109,wait).
guideline_cardinality(actual,q109,na,geq,2).
guideline_interval(actual,e109,duration,q109,hour,none).
guideline_range(actual,other109,high109).
% S10: A man waits.
guideline_range(actual,orphan_low,orphan_high).
