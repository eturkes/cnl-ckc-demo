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
guideline_document(t,ace_sha256('54d33f8984a05257d99e4582d3f6a3f52ea0f20a3253422eab678ff8b3ac544a'),ulex(none),vocabulary(sha256(bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb))).
% S1: A man waits for 2 approximate hours.
guideline_event(actual,e1,wait).
guideline_cardinality(actual,q1,na,about,2).
guideline_interval(actual,e1,duration,q1,hour,none).
% S2: A man waits after 4 approximate weeks of a visit.
guideline_event(actual,e2,wait).
guideline_entity(actual,a2,visit,countable).
guideline_cardinality(actual,q2,na,about,4).
guideline_interval(actual,e2,after,q2,week,a2).
% S3: A man waits before 1 approximate day of a trip.
guideline_event(actual,e3,wait).
guideline_entity(actual,a3,trip,countable).
guideline_cardinality(actual,q3,na,about,1).
guideline_interval(actual,e3,before,q3,day,a3).
% S4: A man waits within 3 approximate months of a therapy.
guideline_event(actual,e4,wait).
guideline_entity(actual,a4,therapy,countable).
guideline_cardinality(actual,q4,na,about,3).
guideline_interval(actual,e4,within,q4,month,a4).
% S5: A man waits at an approximate interval of 2 hours.
guideline_event(actual,e5,wait).
guideline_cardinality(actual,q5,na,about,2).
guideline_recurrence(actual,e5,q5,hour).
% S6: A man reads 2 books per 1 approximate day.
guideline_event(actual,e6,read).
guideline_entity(actual,c6,book,countable).
guideline_cardinality(actual,c6,na,eq,2).
guideline_cardinality(actual,q6,na,about,1).
guideline_frequency(actual,e6,c6,q6,day).
% S7: A man waits at an approximate interval of 2 hours during a window of 3 weeks of a visit.
guideline_event(actual,e7,wait).
guideline_entity(actual,a7,visit,countable).
guideline_cardinality(actual,q7,na,about,2).
guideline_cardinality(actual,l7,na,eq,3).
guideline_recurrence_window(actual,e7,q7,hour,a7,l7,week).
% S8: A man waits at an interval of 2 hours during an approximate window of 3 weeks of a visit.
guideline_event(actual,e8,wait).
guideline_entity(actual,a8,visit,countable).
guideline_cardinality(actual,q8,na,eq,2).
guideline_cardinality(actual,l8,na,about,3).
guideline_recurrence_window(actual,e8,q8,hour,a8,l8,week).
% S9: A man waits at an approximate interval of 1 hour during an approximate window of 1 day of a visit.
guideline_event(actual,e9,'wait&<watch>').
guideline_entity(actual,a9,'start&<visit>',countable).
guideline_cardinality(actual,q9,na,about,1).
guideline_cardinality(actual,l9,na,about,1).
guideline_recurrence_window(actual,e9,q9,hour,a9,l9,day).
% S10: A man waits for at least 8 hours to 12 hours.
guideline_event(actual,e10,wait).
guideline_cardinality(actual,q10,na,geq,8).
guideline_cardinality(actual,h10,na,eq,12).
guideline_interval(actual,e10,duration,q10,hour,none).
guideline_range(actual,q10,h10).
% S11: A man waits after at least 4 days of a visit to 7 days.
guideline_event(actual,e11,wait).
guideline_entity(actual,a11,visit,countable).
guideline_cardinality(actual,q11,na,geq,4).
guideline_cardinality(actual,h11,na,eq,7).
guideline_interval(actual,e11,after,q11,day,a11).
guideline_range(actual,q11,h11).
% S12: A man waits for at least 1 week to 2 weeks.
guideline_event(actual,e12,wait).
guideline_cardinality(actual,q12,na,geq,1).
guideline_cardinality(actual,h12,na,eq,2).
guideline_interval(actual,e12,duration,q12,week,none).
guideline_range(actual,q12,h12).
% S13: A man waits for at least 0 days to 1 day.
guideline_event(actual,e13,wait).
guideline_cardinality(actual,q13,na,geq,0).
guideline_cardinality(actual,h13,na,eq,1).
guideline_interval(actual,e13,duration,q13,day,none).
guideline_range(actual,q13,h13).
% S14: If a man waits after at least 2 hours of a therapy to 3 hours then the man is ready.
guideline_property(actual,e14,ready,pos) :- guideline_event(actual,e14,wait), guideline_cardinality(actual,q14,na,geq,2), guideline_cardinality(actual,h14,na,eq,3), guideline_entity(actual,a14,therapy,countable), guideline_interval(actual,e14,after,q14,hour,a14), guideline_range(actual,q14,h14).
guideline_property(actual,e14,prepared,pos) :- guideline_event(actual,e14,wait), guideline_cardinality(actual,q14,na,geq,2), guideline_cardinality(actual,h14,na,eq,3), guideline_entity(actual,a14,therapy,countable), guideline_interval(actual,e14,after,q14,hour,a14), guideline_range(actual,q14,h14).
% S15: If it is not provable that a man waits for at least 4 days to 7 days then a woman waits.
guideline_property(actual,e15,ready,pos) :- \+ (guideline_event(actual,e15,wait), guideline_cardinality(actual,q15,na,geq,4), guideline_cardinality(actual,h15,na,eq,7), guideline_interval(actual,e15,duration,q15,day,none), guideline_range(actual,q15,h15)).
