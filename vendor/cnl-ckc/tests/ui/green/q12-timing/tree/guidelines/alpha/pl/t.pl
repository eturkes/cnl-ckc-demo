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
guideline_document(t,ace_sha256(eb9ba835f99b13a3356d3e78c4038422175db79c6d054edfd5fb7a2014da32f3),ulex(none),vocabulary(sha256(bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb))).
% S1: A man reads a book before a visit after a trip.
guideline_event(actual,e1,read).
guideline_entity(actual,a1,visit,countable).
guideline_entity(actual,a2,trip,countable).
guideline_order(actual,e1,before,a1).
guideline_order(actual,e1,after,a2).
guideline_order(actual,e1,before,a1).
% S2: Every man reads 1 book per 1 day.
guideline_event(actual,e2,read).
guideline_entity(actual,c2,book,countable).
guideline_cardinality(actual,c2,na,eq,1).
guideline_cardinality(actual,w2,na,eq,1).
guideline_frequency(actual,e2,c2,w2,day).
% S3: Every man reads at most 2 books per 2 weeks.
guideline_event(actual,e3,read).
guideline_entity(actual,c3,book,countable).
guideline_cardinality(actual,c3,na,leq,2).
guideline_cardinality(actual,w3,na,eq,2).
guideline_frequency(actual,e3,c3,w3,week).
% S4: Every man reads exactly 3 books per 1 hour.
guideline_event(actual,e4,read).
guideline_entity(actual,c4,book,countable).
guideline_cardinality(actual,c4,na,exactly,3).
guideline_cardinality(actual,w4,na,eq,1).
guideline_frequency(actual,e4,c4,w4,hour).
% S5: Every man reads at least 4 books per 2 hours.
guideline_event(actual,e5,read).
guideline_entity(actual,c5,book,countable).
guideline_cardinality(actual,c5,na,geq,4).
guideline_cardinality(actual,w5,na,eq,2).
guideline_frequency(actual,e5,c5,w5,hour).
% S6: Every man reads more than 5 books per 1 minute.
guideline_event(actual,e6,read).
guideline_entity(actual,c6,book,countable).
guideline_cardinality(actual,c6,na,greater,5).
guideline_cardinality(actual,w6,na,eq,1).
guideline_frequency(actual,e6,c6,w6,minute).
% S7: Every man reads less than 6 books per 3 months.
guideline_event(actual,e7,read).
guideline_entity(actual,c7,book,countable).
guideline_cardinality(actual,c7,na,less,6).
guideline_cardinality(actual,w7,na,eq,3).
guideline_frequency(actual,e7,c7,w7,month).
% S8: A man waits at an interval of at least 1 day during a window of at most 3 weeks of a visit.
guideline_event(actual,e8,'wait&<watch>').
guideline_entity(actual,a8,'start&<visit>',countable).
guideline_cardinality(actual,q8,na,geq,1).
guideline_cardinality(actual,l8,na,leq,3).
guideline_recurrence_window(actual,e8,q8,day,a8,l8,week).
guideline_range(actual,q8,l8).
% S9: A man waits at an interval of less than 2 months during a window of exactly 1 year of a trip.
guideline_event(actual,e9,wait).
guideline_entity(actual,a9,trip,countable).
guideline_cardinality(actual,q9,na,less,2).
guideline_cardinality(actual,l9,na,exactly,1).
guideline_recurrence_window(actual,e9,q9,month,a9,l9,year).
% S10: If a man reads after a visit then the man waits.
guideline_property(actual,e10,ready,pos) :- guideline_event(actual,e10,read), guideline_entity(actual,a10,visit,countable), guideline_order(actual,e10,after,a10), guideline_entity(actual,c10,book,countable), guideline_cardinality(actual,c10,na,geq,2), guideline_cardinality(actual,w10,na,eq,1), guideline_frequency(actual,e10,c10,w10,day), guideline_range(actual,c10,w10), \+ (guideline_event(actual,n10,wait), guideline_cardinality(actual,q10,na,eq,1), guideline_cardinality(actual,l10,na,eq,2), guideline_entity(actual,b10,therapy,countable), guideline_recurrence_window(actual,n10,q10,hour,b10,l10,day), guideline_range(actual,q10,l10)).
guideline_property(actual,e10,prepared,pos) :- guideline_event(actual,e10,read), guideline_entity(actual,a10,visit,countable), guideline_order(actual,e10,after,a10), guideline_entity(actual,c10,book,countable), guideline_cardinality(actual,c10,na,geq,2), guideline_cardinality(actual,w10,na,eq,1), guideline_frequency(actual,e10,c10,w10,day), guideline_range(actual,c10,w10), \+ (guideline_event(actual,n10,wait), guideline_cardinality(actual,q10,na,eq,1), guideline_cardinality(actual,l10,na,eq,2), guideline_entity(actual,b10,therapy,countable), guideline_recurrence_window(actual,n10,q10,hour,b10,l10,day), guideline_range(actual,q10,l10)).
