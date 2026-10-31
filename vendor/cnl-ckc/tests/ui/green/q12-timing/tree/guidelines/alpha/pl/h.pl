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
guideline_document(h,ace_sha256('4df4fcbad1e2e681f1442a6eee96714414c7f4c3e8b7b85b21c5d8e4da335aec'),ulex(none),vocabulary(sha256(bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb))).
% S1: A man reads a book.
guideline_frequency(actual,e1,c1,w1,day).
% S2: A man reads before a visit.
guideline_event(actual,e2,'rea\'d').
guideline_entity(actual,a2,'vis\'it',countable).
guideline_order(actual,e2,before,a2).
% S3: A man waits during a window.
guideline_recurrence_window(actual,e3,q3,day,a3,l3,week).
% S4: A man reads about 2 books per 1 day.
guideline_event(actual,e4,read).
guideline_entity(actual,c4,book,countable).
guideline_cardinality(actual,c4,na,about,2).
guideline_cardinality(actual,w4,na,eq,1).
guideline_frequency(actual,e4,c4,w4,day).
% S5: A man reads 2 books per 1 day.
guideline_event(actual,e5,read).
guideline_cardinality(actual,c5,na,eq,2).
guideline_cardinality(actual,w5,na,eq,1).
guideline_frequency(actual,e5,c5,w5,day).
% S6: A man waits.
guideline_range(actual,lo,hi).
