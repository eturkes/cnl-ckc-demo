use vstd::prelude::*;

verus! {

// Trusted spec: render-side align-TSV validator (contract m5u1 R3; error
// details byte-exact).
// Inputs are code-point sequences (UTF-8 decoding = shell boundary).
// Artifact rows: group<TAB>side<TAB>start<TAB>span; offsets/lengths count
// code points. `align_outcome` is the one function the kernel binding
// quotes; everything else defines it.
// --- primitive text helpers ---
pub open spec fn is_ascii_digit(c: char) -> bool {
    '0' <= c && c <= '9'
}

pub open spec fn all_ascii_digits(s: Seq<char>) -> bool {
    forall|i: int| #![auto] 0 <= i < s.len() ==> is_ascii_digit(s[i])
}

// Legacy rule: Python int(x) parses and str(int(x)) round-trips = exactly
// ASCII digits, nonempty, no leading zero except "0" itself. Unbounded.
pub open spec fn is_canonical_decimal(s: Seq<char>) -> bool {
    &&& s.len() > 0
    &&& all_ascii_digits(s)
    &&& (s.len() == 1 || s[0] != '0')
}

pub open spec fn digit_value(c: char) -> int {
    c as int - '0' as int
}

pub open spec fn dec_value(s: Seq<char>) -> int
    decreases s.len(),
{
    if s.len() == 0 {
        0
    } else {
        dec_value(s.drop_last()) * 10 + digit_value(s.last())
    }
}

pub open spec fn digit_char(d: int) -> char {
    if d == 0 {
        '0'
    } else if d == 1 {
        '1'
    } else if d == 2 {
        '2'
    } else if d == 3 {
        '3'
    } else if d == 4 {
        '4'
    } else if d == 5 {
        '5'
    } else if d == 6 {
        '6'
    } else if d == 7 {
        '7'
    } else if d == 8 {
        '8'
    } else {
        '9'
    }
}

// Canonical decimal rendering for row ordinals (n >= 1 in every use).
pub open spec fn dec_str(n: int) -> Seq<char>
    recommends
        n >= 0,
    decreases n,
{
    if n < 10 {
        seq![digit_char(n)]
    } else {
        dec_str(n / 10) + seq![digit_char(n % 10)]
    }
}

// Python str.split semantics: "" -> [""], trailing separator yields a
// trailing empty piece. Total, structural.
pub open spec fn split_at_seps(s: Seq<char>, sep: char) -> Seq<Seq<char>>
    decreases s.len(),
{
    if s.len() == 0 {
        seq![Seq::<char>::empty()]
    } else if s[0] == sep {
        seq![Seq::<char>::empty()] + split_at_seps(s.drop_first(), sep)
    } else {
        let rest = split_at_seps(s.drop_first(), sep);
        seq![seq![s[0]] + rest[0]] + rest.drop_first()
    }
}

// --- parsed rows ---
pub ghost struct RawSpan {
    pub start: int,
    pub end: int,
    pub group: int,
}

// Row-order spans of one side (side_name = "src" or "ace"); meaningful on
// row-check-clean files, total everywhere.
pub open spec fn side_spans(rows: Seq<Seq<char>>, side_name: Seq<char>) -> Seq<RawSpan>
    decreases rows.len(),
{
    if rows.len() == 0 {
        Seq::empty()
    } else {
        let fields = split_at_seps(rows[0], '\t');
        let rest = side_spans(rows.drop_first(), side_name);
        if fields.len() == 4 && fields[1] == side_name {
            seq![
                RawSpan {
                    start: dec_value(fields[2]),
                    end: dec_value(fields[2]) + fields[3].len(),
                    group: dec_value(fields[0]),
                },
            ] + rest
        } else {
            rest
        }
    }
}

pub open spec fn groups_of(spans: Seq<RawSpan>) -> Set<int>
    decreases spans.len(),
{
    if spans.len() == 0 {
        Set::empty()
    } else {
        groups_of(spans.drop_first()).insert(spans[0].group)
    }
}

// Two distinct span instances of one side intersect (spans are nonempty
// intervals, so touching ends never intersect; duplicates always do).
pub open spec fn has_overlap(spans: Seq<RawSpan>) -> bool {
    exists|i: int, j: int|
        #![auto]
        0 <= i < spans.len() && 0 <= j < spans.len() && i != j && spans[i].start < spans[j].end
            && spans[j].start < spans[i].end
}

// --- violations, legacy-ordered ---
pub ghost enum Violation {
    MissingTrailingNewline,
    EmptyFile,
    FieldCount { row: int },
    GroupCanonical { row: int },
    StartCanonical { row: int },
    EmptySpan { row: int },
    SideVocab { row: int },
    OutOfRange { row: int },
    SpanMismatch { row: int },
    NotBothSided,
    OverlapSrc,
    OverlapAce,
}

// In-row check order (legacy): field count -> group canonical -> start
// canonical -> empty span -> side vocabulary -> range -> text match.
pub open spec fn row_violation(row: Seq<char>, n: int, src: Seq<char>, ace: Seq<char>) -> Option<
    Violation,
> {
    let fields = split_at_seps(row, '\t');
    if fields.len() != 4 {
        Some(Violation::FieldCount { row: n })
    } else if !is_canonical_decimal(fields[0]) {
        Some(Violation::GroupCanonical { row: n })
    } else if !is_canonical_decimal(fields[2]) {
        Some(Violation::StartCanonical { row: n })
    } else if fields[3].len() == 0 {
        Some(Violation::EmptySpan { row: n })
    } else if fields[1] != "src"@ && fields[1] != "ace"@ {
        Some(Violation::SideVocab { row: n })
    } else {
        let text = if fields[1] == "src"@ {
            src
        } else {
            ace
        };
        let start = dec_value(fields[2]);
        let end = start + fields[3].len();
        if end > text.len() {
            Some(Violation::OutOfRange { row: n })
        } else if text.subrange(start, end) != fields[3] {
            Some(Violation::SpanMismatch { row: n })
        } else {
            None
        }
    }
}

pub open spec fn rows_violation(
    rows: Seq<Seq<char>>,
    n: int,
    src: Seq<char>,
    ace: Seq<char>,
) -> Option<Violation>
    decreases rows.len(),
{
    if rows.len() == 0 {
        None
    } else {
        match row_violation(rows[0], n, src, ace) {
            Some(v) => Some(v),
            None => rows_violation(rows.drop_first(), n + 1, src, ace),
        }
    }
}

// Whole-file first violation (legacy order): trailing newline -> empty file
// -> rows in physical order (1-based) -> groups both-sided -> src overlap
// -> ace overlap.
pub open spec fn first_violation(align: Seq<char>, src: Seq<char>, ace: Seq<char>) -> Option<
    Violation,
> {
    if align.len() == 0 || align.last() != '\n' {
        Some(Violation::MissingTrailingNewline)
    } else {
        let body = align.drop_last();
        if body.len() == 0 {
            Some(Violation::EmptyFile)
        } else {
            let rows = split_at_seps(body, '\n');
            match rows_violation(rows, 1, src, ace) {
                Some(v) => Some(v),
                None => {
                    let srcs = side_spans(rows, "src"@);
                    let aces = side_spans(rows, "ace"@);
                    if groups_of(srcs) != groups_of(aces) {
                        Some(Violation::NotBothSided)
                    } else if has_overlap(srcs) {
                        Some(Violation::OverlapSrc)
                    } else if has_overlap(aces) {
                        Some(Violation::OverlapAce)
                    } else {
                        None
                    }
                },
            }
        }
    }
}

pub open spec fn wellformed(align: Seq<char>, src: Seq<char>, ace: Seq<char>) -> bool {
    first_violation(align, src, ace) is None
}

// --- error rendering (byte-exact legacy details) ---
pub open spec fn row_prefix(n: int) -> Seq<char> {
    "row "@ + dec_str(n) + ": "@
}

pub open spec fn render(v: Violation) -> Seq<char> {
    match v {
        Violation::MissingTrailingNewline => "missing trailing newline"@,
        Violation::EmptyFile => "empty file"@,
        Violation::FieldCount { row } => row_prefix(row) + "expected 4 tab-separated fields"@,
        Violation::GroupCanonical { row } => row_prefix(row) + "group must be a canonical decimal"@,
        Violation::StartCanonical { row } => row_prefix(row) + "start must be a canonical decimal"@,
        Violation::EmptySpan { row } => row_prefix(row) + "empty span"@,
        Violation::SideVocab { row } => row_prefix(row) + "side must be src or ace"@,
        Violation::OutOfRange { row } => row_prefix(row) + "span out of range"@,
        Violation::SpanMismatch { row } => row_prefix(row)
            + "span does not match the text at start"@,
        Violation::NotBothSided => "every group needs both a src span and an ace span"@,
        Violation::OverlapSrc => "overlapping src spans"@,
        Violation::OverlapAce => "overlapping ace spans"@,
    }
}

// --- success model (legacy: dense display indexes by first ACE span in
// sorted (start,end,group) order; each side start-sorted) ---
pub ghost struct OutSpan {
    pub start: int,
    pub end: int,
    pub index: int,
}

pub ghost struct AlignModel {
    pub src: Seq<OutSpan>,
    pub ace: Seq<OutSpan>,
    pub count: int,
}

pub open spec fn raw_le(a: RawSpan, b: RawSpan) -> bool {
    ||| a.start < b.start
    ||| (a.start == b.start && a.end < b.end)
    ||| (a.start == b.start && a.end == b.end && a.group <= b.group)
}

pub open spec fn insert_raw(x: RawSpan, s: Seq<RawSpan>) -> Seq<RawSpan>
    decreases s.len(),
{
    if s.len() == 0 {
        seq![x]
    } else if raw_le(x, s[0]) {
        seq![x] + s
    } else {
        seq![s[0]] + insert_raw(x, s.drop_first())
    }
}

pub open spec fn sort_raw(s: Seq<RawSpan>) -> Seq<RawSpan>
    decreases s.len(),
{
    if s.len() == 0 {
        s
    } else {
        insert_raw(s[0], sort_raw(s.drop_first()))
    }
}

pub open spec fn out_le(a: OutSpan, b: OutSpan) -> bool {
    ||| a.start < b.start
    ||| (a.start == b.start && a.end < b.end)
    ||| (a.start == b.start && a.end == b.end && a.index <= b.index)
}

pub open spec fn insert_out(x: OutSpan, s: Seq<OutSpan>) -> Seq<OutSpan>
    decreases s.len(),
{
    if s.len() == 0 {
        seq![x]
    } else if out_le(x, s[0]) {
        seq![x] + s
    } else {
        seq![s[0]] + insert_out(x, s.drop_first())
    }
}

pub open spec fn sort_out(s: Seq<OutSpan>) -> Seq<OutSpan>
    decreases s.len(),
{
    if s.len() == 0 {
        s
    } else {
        insert_out(s[0], sort_out(s.drop_first()))
    }
}

// First-occurrence group order over a span sequence.
pub open spec fn groups_in_order(spans: Seq<RawSpan>, seen: Set<int>) -> Seq<int>
    decreases spans.len(),
{
    if spans.len() == 0 {
        Seq::empty()
    } else if seen.contains(spans[0].group) {
        groups_in_order(spans.drop_first(), seen)
    } else {
        seq![spans[0].group] + groups_in_order(spans.drop_first(), seen.insert(spans[0].group))
    }
}

pub open spec fn index_in(order: Seq<int>, g: int) -> int
    decreases order.len(),
{
    if order.len() == 0 {
        0
    } else if order[0] == g {
        0
    } else {
        1 + index_in(order.drop_first(), g)
    }
}

pub open spec fn to_out(spans: Seq<RawSpan>, order: Seq<int>) -> Seq<OutSpan>
    decreases spans.len(),
{
    if spans.len() == 0 {
        Seq::empty()
    } else {
        seq![
            OutSpan {
                start: spans[0].start,
                end: spans[0].end,
                index: index_in(order, spans[0].group),
            },
        ] + to_out(spans.drop_first(), order)
    }
}

// Defined for wellformed inputs (total everywhere).
pub open spec fn model_of(align: Seq<char>, src: Seq<char>, ace: Seq<char>) -> AlignModel {
    let rows = split_at_seps(align.drop_last(), '\n');
    let srcs = side_spans(rows, "src"@);
    let aces = side_spans(rows, "ace"@);
    let order = groups_in_order(sort_raw(aces), Set::empty());
    AlignModel {
        src: sort_out(to_out(srcs, order)),
        ace: sort_out(to_out(aces, order)),
        count: order.len() as int,
    }
}

// --- the one bound outcome ---
pub ghost enum AlignOutcome {
    Ok(AlignModel),
    Err(Seq<char>),
}

pub open spec fn align_outcome(align: Seq<char>, src: Seq<char>, ace: Seq<char>) -> AlignOutcome {
    match first_violation(align, src, ace) {
        Some(v) => AlignOutcome::Err(render(v)),
        None => AlignOutcome::Ok(model_of(align, src, ace)),
    }
}

// --- resolver (`goal align`, legacy align_command; contract m5u4 P4): the
// occurrence-form stdin TSV `group<TAB>side<TAB>occurrence<TAB>span` resolves
// to artifact rows `group<TAB>side<TAB>start<TAB>span`, ace rows before src
// rows, each side sorted by (start, end, group, span); the first failure in
// legacy order = an F-class detail (`goal: align: <detail>`, stderr, rc2).
// Shell: guideline/docid/payload/ACE-file pre-checks, stdin bytes, the file
// write, the meter `goal: align <docid> groups <g> spans <n>`. ---
// Python `int(s)` with `str(int(s)) == s`: canonical digits, or one leading
// '-' on a nonzero canonical value.
pub open spec fn is_canonical_int(s: Seq<char>) -> bool {
    ||| is_canonical_decimal(s)
    ||| (s.len() > 1 && s[0] == '-' && is_canonical_decimal(s.drop_first()) && s.drop_first()
        != "0"@)
}

pub open spec fn int_value(s: Seq<char>) -> int {
    if s.len() > 0 && s[0] == '-' {
        0 - dec_value(s.drop_first())
    } else {
        dec_value(s)
    }
}

// Start of the n-th (1-based) non-overlapping occurrence of `span` in `text`
// scanning left to right from `i` (Python `text.split(span)` piece
// arithmetic); -1 when absent.
pub open spec fn nth_start(text: Seq<char>, span: Seq<char>, n: int, i: int) -> int
    decreases text.len() - i,
{
    if span.len() == 0 || i < 0 || i + span.len() > text.len() {
        0 - 1
    } else if text.subrange(i, i + span.len()) == span {
        if n <= 1 {
            i
        } else {
            nth_start(text, span, n - 1, i + span.len())
        }
    } else {
        nth_start(text, span, n, i + 1)
    }
}

pub ghost struct ResSpan {
    pub start: int,
    pub end: int,
    pub group: int,
    pub span: Seq<char>,
}

// Rows in legacy failure order: field count, group (canonical, ≥ 0),
// occurrence (canonical, ≥ 1), empty span, side vocabulary, occurrence found.
pub open spec fn resolve_rows(
    rows: Seq<Seq<char>>,
    n: int,
    src: Seq<char>,
    ace: Seq<char>,
    srcs: Seq<ResSpan>,
    aces: Seq<ResSpan>,
) -> Result<(Seq<ResSpan>, Seq<ResSpan>), Seq<char>>
    decreases rows.len(),
{
    if rows.len() == 0 {
        Ok((srcs, aces))
    } else {
        let w = row_prefix(n);
        let fs = split_at_seps(rows[0], '\t');
        if fs.len() != 4 {
            Err(w + "expected group, side, occurrence, span"@)
        } else if !is_canonical_int(fs[0]) {
            Err(w + "group must be a canonical decimal"@)
        } else if int_value(fs[0]) < 0 {
            Err(w + "group below 0"@)
        } else if !is_canonical_int(fs[2]) {
            Err(w + "occurrence must be a canonical decimal"@)
        } else if int_value(fs[2]) < 1 {
            Err(w + "occurrence below 1"@)
        } else if fs[3].len() == 0 {
            Err(w + "empty span"@)
        } else if fs[1] != "src"@ && fs[1] != "ace"@ {
            Err(w + "side must be src or ace"@)
        } else {
            let text = if fs[1] == "src"@ {
                src
            } else {
                ace
            };
            let k = nth_start(text, fs[3], int_value(fs[2]), 0);
            if k < 0 {
                Err(w + "occurrence "@ + fs[2] + " of span not found in "@ + fs[1])
            } else {
                let sp = ResSpan {
                    start: k,
                    end: k + fs[3].len(),
                    group: int_value(fs[0]),
                    span: fs[3],
                };
                if fs[1] == "src"@ {
                    resolve_rows(rows.drop_first(), n + 1, src, ace, srcs.push(sp), aces)
                } else {
                    resolve_rows(rows.drop_first(), n + 1, src, ace, srcs, aces.push(sp))
                }
            }
        }
    }
}

// Code-point lexicographic order (Python str comparison).
pub open spec fn chars_le(a: Seq<char>, b: Seq<char>) -> bool
    decreases a.len(),
{
    if a.len() == 0 {
        true
    } else if b.len() == 0 {
        false
    } else if a[0] < b[0] {
        true
    } else if a[0] > b[0] {
        false
    } else {
        chars_le(a.drop_first(), b.drop_first())
    }
}

// Python tuple order (start, end, group, span).
pub open spec fn res_le(a: ResSpan, b: ResSpan) -> bool {
    ||| a.start < b.start
    ||| (a.start == b.start && a.end < b.end)
    ||| (a.start == b.start && a.end == b.end && a.group < b.group)
    ||| (a.start == b.start && a.end == b.end && a.group == b.group && chars_le(a.span, b.span))
}

pub open spec fn insert_res(x: ResSpan, s: Seq<ResSpan>) -> Seq<ResSpan>
    decreases s.len(),
{
    if s.len() == 0 {
        seq![x]
    } else if res_le(x, s[0]) {
        seq![x] + s
    } else {
        seq![s[0]] + insert_res(x, s.drop_first())
    }
}

pub open spec fn sort_res(s: Seq<ResSpan>) -> Seq<ResSpan>
    decreases s.len(),
{
    if s.len() == 0 {
        s
    } else {
        insert_res(s[0], sort_res(s.drop_first()))
    }
}

// Distinct groups in first-occurrence order.
pub open spec fn group_list(spans: Seq<ResSpan>, acc: Seq<int>) -> Seq<int>
    decreases spans.len(),
{
    if spans.len() == 0 {
        acc
    } else if acc.contains(spans[0].group) {
        group_list(spans.drop_first(), acc)
    } else {
        group_list(spans.drop_first(), acc.push(spans[0].group))
    }
}

pub open spec fn same_groups(a: Seq<int>, b: Seq<int>) -> bool {
    &&& forall|i: int| 0 <= i < a.len() ==> b.contains(#[trigger] a[i])
    &&& forall|i: int| 0 <= i < b.len() ==> a.contains(#[trigger] b[i])
}

// One side's artifact rows in sorted order; an overlap = the first row whose
// start precedes the previous row's end.
pub open spec fn side_out(name: Seq<char>, spans: Seq<ResSpan>, prev_end: int) -> Result<
    Seq<char>,
    Seq<char>,
>
    decreases spans.len(),
{
    if spans.len() == 0 {
        Ok(Seq::empty())
    } else if spans[0].start < prev_end {
        Err("overlapping "@ + name + " spans at offset "@ + dec_str(spans[0].start))
    } else {
        match side_out(name, spans.drop_first(), spans[0].end) {
            Err(e) => Err(e),
            Ok(rest) => Ok(
                dec_str(spans[0].group) + "\t"@ + name + "\t"@ + dec_str(spans[0].start) + "\t"@
                    + spans[0].span + "\n"@ + rest,
            ),
        }
    }
}

pub ghost struct Resolved {
    pub text: Seq<char>,
    pub groups: int,
    pub spans: int,
}

pub open spec fn resolve(input: Seq<char>, src: Seq<char>, ace: Seq<char>) -> Result<
    Resolved,
    Seq<char>,
> {
    if !(input.len() > 0 && input.last() == '\n') {
        Err("input lacks final newline"@)
    } else if input.len() == 1 {
        Err("empty input"@)
    } else {
        match resolve_rows(
            split_at_seps(input.drop_last(), '\n'),
            1,
            src,
            ace,
            Seq::empty(),
            Seq::empty(),
        ) {
            Err(e) => Err(e),
            Ok((srcs, aces)) => if !same_groups(
                group_list(srcs, Seq::empty()),
                group_list(aces, Seq::empty()),
            ) {
                Err("every group needs both a src span and an ace span"@)
            } else {
                match side_out("ace"@, sort_res(aces), 0) {
                    Err(e) => Err(e),
                    Ok(a) => match side_out("src"@, sort_res(srcs), 0) {
                        Err(e) => Err(e),
                        Ok(s) => Ok(
                            Resolved {
                                text: a + s,
                                groups: group_list(aces, Seq::empty()).len() as int,
                                spans: (srcs.len() + aces.len()) as int,
                            },
                        ),
                    },
                }
            },
        }
    }
}

// --- exec-facing result types (views bind exec results to the spec) ---
pub struct ESpan {
    pub start: u64,
    pub end: u64,
    pub index: u64,
}

impl View for ESpan {
    type V = OutSpan;

    open spec fn view(&self) -> OutSpan {
        OutSpan { start: self.start as int, end: self.end as int, index: self.index as int }
    }
}

pub struct EModel {
    pub src: Vec<ESpan>,
    pub ace: Vec<ESpan>,
    pub count: u64,
}

impl View for EModel {
    type V = AlignModel;

    open spec fn view(&self) -> AlignModel {
        AlignModel {
            src: self.src@.map_values(|e: ESpan| e@),
            ace: self.ace@.map_values(|e: ESpan| e@),
            count: self.count as int,
        }
    }
}

pub enum ECheck {
    Ok(EModel),
    Err(Vec<char>),
}

impl View for ECheck {
    type V = AlignOutcome;

    open spec fn view(&self) -> AlignOutcome {
        match self {
            ECheck::Ok(m) => AlignOutcome::Ok(m@),
            ECheck::Err(e) => AlignOutcome::Err(e@),
        }
    }
}

pub struct EResolved {
    pub text: Vec<char>,
    pub groups: u64,
    pub spans: u64,
}

impl View for EResolved {
    type V = Resolved;

    open spec fn view(&self) -> Resolved {
        Resolved { text: self.text@, groups: self.groups as int, spans: self.spans as int }
    }
}

pub enum EResolve {
    Ok(EResolved),
    Err(Vec<char>),
}

impl View for EResolve {
    type V = Result<Resolved, Seq<char>>;

    open spec fn view(&self) -> Result<Resolved, Seq<char>> {
        match self {
            EResolve::Ok(r) => Ok(r@),
            EResolve::Err(e) => Err(e@),
        }
    }
}

} // verus!
