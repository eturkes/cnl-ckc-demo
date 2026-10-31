// M5.5 K5: the reviewer surface.
// Claims: corpus-bound displayed fields; exact deterministic page bytes;
// escaped dynamic slots; registry-bound fixed copy; ordered first refusal;
// seven-column insertion preserving every prior decision row.
// Shell: committed git intake + live ledger overlay, UTF-8/file intake,
// HTTP request parsing, sockets/headers, clock/token, hash computations,
// CSP digest, temporary files/fsync/lock/CAS/rename, asset/output writes,
// double-render probe + process exit codes. The script bytes belong to render.
// R76: copy domain = ASCII + U+00A7 section sign, U+00B7 middle dot,
// U+2014 em dash, U+2265 greater-than-or-equal. Each added scalar is non-word;
// ASCII folding/word boundaries equal Python regex behavior on this domain.
// Emoji gets its legacy violation first; other non-ASCII gets a domain violation.
// Controlled registry + copy fixtures contain no non-ASCII letters. Registry
// non-ASCII scalars = U+00B7/U+2014 only; no other emitted-copy scalars occur.
// Ten ASCII-only fixtures: copy-clean, copy-css-animation, copy-css-backdrop,
// copy-css-boxshadow, copy-css-gradient, copy-css-keyframes, copy-css-transition,
// copy-exclamatory, copy-marketing, copy-relative-time. Two non-ASCII fixtures:
// copy-lookalike adds U+00A7/U+00B7/U+2265 punctuation; copy-emoji tests U+2705.
// Invented-acronym judgment stays an unmechanized design rule.
use crate::align;
use crate::check::{self, Bundle, Coverage, Decision, ECoverage, Row, Status};
use crate::engine::*;
use crate::replay::Src;
use crate::term::Term;
use crate::v1text::{self, *};
use crate::vocabulary::{self, Vocabulary};
use vstd::prelude::*;
use vstd::utf8::*;

verus! {

pub type Bytes = Seq<u8>;

pub open spec fn lit(s: Seq<char>) -> Bytes {
    encode_utf8(s)
}

pub open spec fn chars(s: Bytes) -> Seq<char> {
    if valid_utf8(s) {
        decode_utf8(s)
    } else {
        Seq::empty()
    }
}

pub open spec fn empty() -> Bytes {
    Seq::empty()
}

pub open spec fn at(xs: Seq<Bytes>, i: int) -> Bytes {
    if 0 <= i < xs.len() {
        xs[i]
    } else {
        empty()
    }
}

pub open spec fn join(xs: Seq<Bytes>, sep: Bytes) -> Bytes
    decreases xs.len(),
{
    if xs.len() == 0 {
        empty()
    } else if xs.len() == 1 {
        xs[0]
    } else {
        xs[0] + sep + join(xs.drop_first(), sep)
    }
}

pub open spec fn unprefix(s: Bytes, p: Bytes) -> Bytes {
    if check::starts(s, p) {
        s.skip(p.len() as int)
    } else {
        s
    }
}

pub open spec fn unsuffix(s: Bytes, p: Bytes) -> Bytes {
    if check::ends(s, p) {
        s.take(s.len() - p.len())
    } else {
        s
    }
}

pub open spec fn lower(s: Bytes) -> Bytes {
    s.map_values(
        |b: u8|
            if 65 <= b <= 90 {
                (b - 65 + 97) as u8
            } else {
                b
            },
    )
}

pub open spec fn digits(s: Bytes) -> bool {
    s.len() > 0 && v1text::all_in(s, |b: u8| is_digit_b(b))
}

// Escaping: `&`, `<`, `>` everywhere; `"` and `'` as well inside attributes.
pub open spec fn escape(s: Bytes, attr: bool) -> Bytes
    decreases s.len(),
{
    if s.len() == 0 {
        empty()
    } else {
        let c = s[0];
        (if c == 38 {
            amp_2()
        } else if c == 60 {
            lt_2()
        } else if c == 62 {
            gt_2()
        } else if attr && c == 34 {
            quot_2()
        } else if attr && c == 39 {
            apos()
        } else {
            seq![c]
        }) + escape(s.drop_first(), attr)
    }
}

pub open spec fn escape_text(s: Bytes) -> Bytes {
    escape(s, false)
}

pub open spec fn escape_attr(s: Bytes) -> Bytes {
    escape(s, true)
}

pub open spec fn escaped(s: Bytes, attr: bool) -> bool
    decreases s.len(),
{
    if s.len() == 0 {
        true
    } else if s[0] == 38 {
        let n: int = if check::starts(s, amp_2()) {
            5
        } else if check::starts(s, lt_2()) || check::starts(s, gt_2()) {
            4
        } else if check::starts(s, quot_2()) || check::starts(s, apos()) {
            6
        } else {
            0
        };
        n > 0 && n <= s.len() && escaped(s.skip(n), attr)
    } else {
        s[0] != 60 && s[0] != 62 && (!attr || (s[0] != 34 && s[0] != 39)) && escaped(
            s.drop_first(),
            attr,
        )
    }
}

pub open spec fn url_seg(s: Bytes) -> Bytes
    decreases s.len(),
{
    if s.len() == 0 {
        empty()
    } else {
        let b = s[0];
        let x = b as int;
        (if is_alnum_b(b) || b == 45 || b == 46 || b == 126 {
            seq![b]
        } else {
            seq![
                37u8,
                (if x / 16 < 10 {
                    48 + x / 16
                } else {
                    65 + x / 16 - 10
                }) as u8,
                (if x % 16 < 10 {
                    48 + x % 16
                } else {
                    65 + x % 16 - 10
                }) as u8,
            ]
        }) + url_seg(s.drop_first())
    }
}

// A page is an audited sequence of fixed chrome and typed dynamic slots.
// Fixed fragments can include visible copy; dynamic slots always escape.
pub ghost enum Piece {
    Fixed(Bytes),
    Text(Bytes),
    Attr(Bytes),
    Decimal(nat),
    Comment(Bytes),
}

pub type Html = Seq<Piece>;

pub open spec fn fixed(s: Seq<char>) -> Html {
    seq![Piece::Fixed(lit(s))]
}

pub open spec fn fixed_bytes(s: Bytes) -> Html {
    seq![Piece::Fixed(s)]
}

pub open spec fn text(s: Bytes) -> Html {
    seq![Piece::Text(s)]
}

pub open spec fn attr(s: Bytes) -> Html {
    seq![Piece::Attr(s)]
}

pub open spec fn number(n: nat) -> Html {
    seq![Piece::Decimal(n)]
}

pub open spec fn emit_piece(p: Piece) -> Bytes {
    match p {
        Piece::Fixed(s) => s,
        Piece::Text(s) => escape_text(s),
        Piece::Attr(s) => escape_attr(s),
        Piece::Decimal(n) => check::nat_bytes(n),
        Piece::Comment(s) => comment_safe(s),
    }
}

pub open spec fn render_page(p: Html) -> Bytes {
    p.map_values(|x: Piece| emit_piece(x)).flatten()
}

pub open spec fn hjoin(xs: Seq<Html>, sep: Html) -> Html
    decreases xs.len(),
{
    if xs.len() == 0 {
        Seq::empty()
    } else if xs.len() == 1 {
        xs[0]
    } else {
        xs[0] + sep + hjoin(xs.drop_first(), sep)
    }
}

pub open spec fn lines(xs: Seq<Html>) -> Html {
    hjoin(xs, fixed_bytes(newline()))
}

pub open spec fn cell(x: Html) -> Html {
    fixed_bytes(td_open()) + x + fixed_bytes(td_close())
}

pub open spec fn row(xs: Seq<Html>) -> Html {
    fixed_bytes(tr_open()) + xs.flatten() + fixed_bytes(tr_close())
}

pub open spec fn link(href: Bytes, label: Html) -> Html {
    fixed_bytes(a_href_open()) + attr(href) + fixed_bytes(attr_end()) + label + fixed_bytes(
        a_close(),
    )
}

// These are byte-bearing inputs, not independently supplied counts/classes.
// K4 owns coverage selection, Bundle digests, ledger grammar/classification;
// alignment uses the existing character-offset model. Prolog stays exact raw
// text: renderer acceptance does not strengthen K1 (fixture Prolog can differ).
pub ghost struct Document {
    pub bundle: Bundle,
    pub ace: Bytes,
    pub pl: Bytes,
    pub alignment: Option<Bytes>,
}

pub ghost struct Guideline {
    pub gid: Bytes,
    pub readme: Option<Bytes>,
    pub coverage: Coverage,
    pub documents: Seq<Document>,
    pub ledger: Src,
    pub ledger_digest: Bytes,
    pub source_names: Seq<Bytes>,
    pub vocabulary: Option<Bytes>,
}

pub ghost struct Corpus {
    pub guidelines: Seq<Guideline>,
    pub token: Bytes,
}

pub ghost struct Record {
    pub decision: Decision,
    pub reviewer: Bytes,
    pub comment: Bytes,
}

pub open spec fn docids(g: Guideline) -> Seq<Bytes> {
    g.documents.map_values(|d: Document| d.bundle.docid)
}

pub open spec fn bundles(g: Guideline) -> Seq<Bundle> {
    g.documents.map_values(|d: Document| d.bundle)
}

pub open spec fn decisions(g: Guideline) -> Seq<Decision> {
    check::ledger(g.ledger, docids(g)).0
}

pub open spec fn ledger_data(s: Src) -> Bytes {
    match s {
        Src::Bytes(b) => b,
        _ => empty(),
    }
}

pub open spec fn raw_rows(s: Bytes) -> Seq<Bytes> {
    check::split_on(s, 10).filter(|r: Bytes| r.len() > 0 && r[0] != 35)
}

pub open spec fn records(g: Guideline) -> Seq<Record> {
    let ds = decisions(g);
    let rows = raw_rows(ledger_data(g.ledger));
    Seq::new(
        ds.len(),
        |i: int|
            {
                let f = check::tab_fields(at(rows, i));
                Record { decision: ds[i], reviewer: at(f, 4), comment: at(f, 6) }
            },
    )
}

pub open spec fn history(g: Guideline, id: Bytes) -> Seq<Record> {
    records(g).filter(|r: Record| r.decision.docid == id)
}

pub open spec fn state(g: Guideline, id: Bytes) -> int {
    let ds = decisions(g);
    let bs = bundles(g);
    if check::cur(ds, bs, id, true) {
        if check::cur(ds, bs, id, false) {
            2
        } else {
            0
        }
    } else if check::cur(ds, bs, id, false) {
        1
    } else if check::reviewed(ds).contains(id) {
        3
    } else {
        4
    }
}

pub open spec fn state_name(k: int) -> Bytes {
    if k == 0 {
        approved_2()
    } else if k == 1 {
        rejected_2()
    } else if k == 2 {
        contested_2()
    } else if k == 3 {
        stale_2()
    } else {
        unreviewed_2()
    }
}

pub open spec fn state_label(k: int) -> Bytes {
    if k == 0 {
        approved_cap()
    } else if k == 1 {
        rejected_cap()
    } else if k == 2 {
        contested_cap()
    } else if k == 3 {
        outdated_cap()
    } else {
        unreviewed_cap()
    }
}

pub open spec fn chip(k: int) -> Html {
    fixed_bytes(span_class_chip_chip()) + attr(state_name(k)) + fixed_bytes(attr_end()) + text(
        state_label(k),
    ) + fixed_bytes(span_close())
}

pub open spec fn field(r: Row, n: int) -> Bytes {
    at(check::tab_fields(unsuffix(r.line, newline())), n)
}

pub open spec fn coverage_field(g: Guideline, id: Bytes, n: int) -> Bytes {
    match check::ace_row(g.coverage, id) {
        Option::Some(r) => field(r, n),
        _ => empty(),
    }
}

pub open spec fn payload(g: Guideline, id: Bytes) -> Bytes {
    match check::payload(g.coverage, id) {
        Option::Some(x) => x,
        _ => empty(),
    }
}

pub open spec fn first_title(ls: Seq<Bytes>, fallback: Bytes) -> Bytes
    decreases ls.len(),
{
    if ls.len() == 0 {
        fallback
    } else if check::starts(ls[0], hash_space()) && check::strip_ws(ls[0].skip(2)).len() > 0 {
        check::strip_ws(ls[0].skip(2))
    } else {
        first_title(ls.drop_first(), fallback)
    }
}

pub open spec fn title(g: Guideline) -> Bytes {
    match g.readme {
        Option::Some(b) => first_title(check::split_on(b, 10), g.gid),
        _ => g.gid,
    }
}

pub open spec fn human_section(b: Bytes) -> Bytes {
    let ss = check::split_on(b, 62).map_values(|s: Bytes| check::strip_ws(s)).filter(
        |s: Bytes| s.len() > 0,
    );
    if ss.len() == 0 {
        empty()
    } else {
        let h = check::split_on(ss[0], 32);
        let special = h.len() == 2 && digits(at(h, 1));
        let head = if special && at(h, 0) == rec_cap() {
            seq![recommendation_cap_sp() + at(h, 1)]
        } else if special && at(h, 0) == box_cap() && ss.len() > 1 {
            Seq::empty()
        } else {
            seq![ss[0]]
        };
        join(head + ss.drop_first(), gt_sep())
    }
}

pub open spec fn document_title(g: Guideline, id: Bytes) -> Bytes {
    let section = coverage_field(g, id, 3);
    let base = human_section(section);
    let region = coverage_field(g, id, 0);
    let shared = g.documents.filter(
        |d: Document| coverage_field(g, d.bundle.docid, 3) == section,
    ).len() > 1;
    let page = unprefix(check::strip_ws(coverage_field(g, id, 2)), page_prefix());
    let segs = check::split_on(region, 45);
    let last = at(segs, segs.len() - 1);
    if base.len() == 0 {
        id
    } else if !shared {
        base
    } else if digits(page) && digits(last) {
        base + page_sp() + page + passage_sp() + check::nat_bytes(check::dec_of(last))
    } else {
        base + paren_open_sep() + region + paren_close()
    }
}

pub open spec fn human_date(d: Bytes) -> Bytes {
    let p = check::split_on(unsuffix(d, zulu()), 84);
    if check::ends(d, zulu()) && p.len() == 2 {
        p[0] + space_2() + p[1] + utc_suffix()
    } else {
        d
    }
}

// Fixed rendered bytes: the stylesheet.
pub open spec fn css_text() -> Bytes {
    lit(
        r##"body { margin: 0 auto; max-width: 72rem; padding: 0 1.5rem 4rem; font-family: system-ui, sans-serif; line-height: 1.55; color: #111827; background: #ffffff; }
a { color: #1d4ed8; }
a:focus-visible, summary:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
.skip { position: absolute; left: -999px; top: 0; padding: 0.5rem 1rem; background: #ffffff; color: #1d4ed8; }
.skip:focus { left: 0; z-index: 1; }
nav.crumbs { padding: 1rem 0; border-bottom: 1px solid #e5e7eb; }
h1 { font-size: 1.5rem; }
h2 { font-size: 1.25rem; }
h3 { font-size: 1.05rem; }
h1 a.source { font-size: 1rem; font-weight: 400; margin-left: 0.5rem; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
th { border-bottom: 2px solid #111827; }
table.compact { width: auto; }
table.compact th, table.compact td { padding-right: 2rem; }
table.records { table-layout: fixed; }
table.records th { box-sizing: border-box; }
table.records th:nth-child(1) { width: 12%; }
table.records th:nth-child(2) { width: 18%; }
table.records th:nth-child(3) { width: 22%; }
table.records th:nth-child(4) { width: 10%; }
.chip { display: inline-block; padding: 0.1rem 0.6rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
.chip-approved { color: #14532d; background: #dcfce7; }
.chip-rejected { color: #7f1d1d; background: #fee2e2; }
.chip-contested { color: #4c1d95; background: #ede9fe; }
.chip-stale { color: #78350f; background: #fef3c7; }
.chip-unreviewed { color: #1f2937; background: #e5e7eb; }
pre { padding: 0.75rem 1rem; border: 1px solid #e5e7eb; white-space: pre-wrap; overflow-x: auto; }
pre, code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.95rem; }
pre.prose { font-family: Georgia, serif; font-size: 1.05rem; overflow-wrap: anywhere; }
dt { font-weight: 600; margin-top: 0.6rem; }
dd { margin-left: 0; }
summary { cursor: pointer; }
section { margin: 1.5rem 0; }
nav.docnav { padding: 1rem 0; border-top: 1px solid #e5e7eb; }
nav.docnav a + a { margin-left: 1.5rem; }
p.provenance span + a { margin-left: 0.75rem; }
section.superseded p { overflow-wrap: anywhere; }
footer.scope { margin-top: 2rem; padding: 1rem 0; border-top: 1px solid #e5e7eb; font-size: 0.9rem; }
form label { display: block; margin-top: 1rem; font-weight: 600; }
fieldset { border: 0; margin: 1rem 0 0; padding: 0; max-width: 28rem; }
legend { font-weight: 600; padding: 0; }
fieldset label { margin-top: 0.5rem; font-weight: 400; }
input[type="text"], textarea { display: block; box-sizing: border-box; width: 100%; max-width: 28rem; margin-top: 0.3rem; padding: 0.45rem 0.6rem; border: 1px solid #4b5563; font-family: inherit; font-size: 1rem; color: #111827; background: #ffffff; }
textarea { min-height: 6rem; }
input[type="radio"], input[type="checkbox"] { accent-color: #111827; }
input[type="text"]:focus-visible, input[type="radio"]:focus-visible, input[type="checkbox"]:focus-visible, textarea:focus-visible, button:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
button { margin-top: 1.25rem; padding: 0.5rem 1.2rem; border: 1px solid #111827; font-family: inherit; font-size: 1rem; font-weight: 600; color: #ffffff; background: #111827; }
mark { background: #dbeafe; color: inherit; text-decoration: underline dotted #4b5563; text-underline-offset: 0.15em; }
.kw { color: #4b5563; }
.hl-note { color: #4b5563; font-size: 0.9rem; }
mark.t1, mark.t13, mark.t25, mark.t37 { background: #fef9c3; }
mark.t2, mark.t14, mark.t26, mark.t38 { background: #f3e8ff; }
mark.t3, mark.t15, mark.t27, mark.t39 { background: #ffedd5; }
mark.t4, mark.t16, mark.t28, mark.t40 { background: #ccfbf1; }
mark.t5, mark.t17, mark.t29, mark.t41 { background: #ffe4e6; }
mark.t6, mark.t18, mark.t30, mark.t42 { background: #dcfce7; }
mark.t7, mark.t19, mark.t31, mark.t43 { background: #fae8ff; }
mark.t8, mark.t20, mark.t32, mark.t44 { background: #cffafe; }
mark.t9, mark.t21, mark.t33, mark.t45 { background: #ecfccb; }
mark.t10, mark.t22, mark.t34, mark.t46 { background: #e0e7ff; }
mark.t11, mark.t23, mark.t35, mark.t47 { background: #e7e5e4; }
mark.t0, mark.t12, mark.t24, mark.t36 { text-decoration-color: #2563eb; }
mark.t1, mark.t13, mark.t25, mark.t37 { text-decoration-color: #a16207; }
mark.t2, mark.t14, mark.t26, mark.t38 { text-decoration-color: #7c3aed; }
mark.t3, mark.t15, mark.t27, mark.t39 { text-decoration-color: #c2410c; }
mark.t4, mark.t16, mark.t28, mark.t40 { text-decoration-color: #0f766e; }
mark.t5, mark.t17, mark.t29, mark.t41 { text-decoration-color: #be123c; }
mark.t6, mark.t18, mark.t30, mark.t42 { text-decoration-color: #15803d; }
mark.t7, mark.t19, mark.t31, mark.t43 { text-decoration-color: #a21caf; }
mark.t8, mark.t20, mark.t32, mark.t44 { text-decoration-color: #0e7490; }
mark.t9, mark.t21, mark.t33, mark.t45 { text-decoration-color: #4d7c0f; }
mark.t10, mark.t22, mark.t34, mark.t46 { text-decoration-color: #4f46e5; }
mark.t11, mark.t23, mark.t35, mark.t47 { text-decoration-color: #57534e; }
main:has(mark.t0:hover) mark.t0 { background: #bfdbfe; text-decoration-style: solid; }
main:has(mark.t1:hover) mark.t1 { background: #fef08a; text-decoration-style: solid; }
main:has(mark.t2:hover) mark.t2 { background: #e9d5ff; text-decoration-style: solid; }
main:has(mark.t3:hover) mark.t3 { background: #fed7aa; text-decoration-style: solid; }
main:has(mark.t4:hover) mark.t4 { background: #99f6e4; text-decoration-style: solid; }
main:has(mark.t5:hover) mark.t5 { background: #fecdd3; text-decoration-style: solid; }
main:has(mark.t6:hover) mark.t6 { background: #bbf7d0; text-decoration-style: solid; }
main:has(mark.t7:hover) mark.t7 { background: #f5d0fe; text-decoration-style: solid; }
main:has(mark.t8:hover) mark.t8 { background: #a5f3fc; text-decoration-style: solid; }
main:has(mark.t9:hover) mark.t9 { background: #d9f99d; text-decoration-style: solid; }
main:has(mark.t10:hover) mark.t10 { background: #c7d2fe; text-decoration-style: solid; }
main:has(mark.t11:hover) mark.t11 { background: #d6d3d1; text-decoration-style: solid; }
main:has(mark.t12:hover) mark.t12 { background: #bfdbfe; text-decoration-style: solid; }
main:has(mark.t13:hover) mark.t13 { background: #fef08a; text-decoration-style: solid; }
main:has(mark.t14:hover) mark.t14 { background: #e9d5ff; text-decoration-style: solid; }
main:has(mark.t15:hover) mark.t15 { background: #fed7aa; text-decoration-style: solid; }
main:has(mark.t16:hover) mark.t16 { background: #99f6e4; text-decoration-style: solid; }
main:has(mark.t17:hover) mark.t17 { background: #fecdd3; text-decoration-style: solid; }
main:has(mark.t18:hover) mark.t18 { background: #bbf7d0; text-decoration-style: solid; }
main:has(mark.t19:hover) mark.t19 { background: #f5d0fe; text-decoration-style: solid; }
main:has(mark.t20:hover) mark.t20 { background: #a5f3fc; text-decoration-style: solid; }
main:has(mark.t21:hover) mark.t21 { background: #d9f99d; text-decoration-style: solid; }
main:has(mark.t22:hover) mark.t22 { background: #c7d2fe; text-decoration-style: solid; }
main:has(mark.t23:hover) mark.t23 { background: #d6d3d1; text-decoration-style: solid; }
main:has(mark.t24:hover) mark.t24 { background: #bfdbfe; text-decoration-style: solid; }
main:has(mark.t25:hover) mark.t25 { background: #fef08a; text-decoration-style: solid; }
main:has(mark.t26:hover) mark.t26 { background: #e9d5ff; text-decoration-style: solid; }
main:has(mark.t27:hover) mark.t27 { background: #fed7aa; text-decoration-style: solid; }
main:has(mark.t28:hover) mark.t28 { background: #99f6e4; text-decoration-style: solid; }
main:has(mark.t29:hover) mark.t29 { background: #fecdd3; text-decoration-style: solid; }
main:has(mark.t30:hover) mark.t30 { background: #bbf7d0; text-decoration-style: solid; }
main:has(mark.t31:hover) mark.t31 { background: #f5d0fe; text-decoration-style: solid; }
main:has(mark.t32:hover) mark.t32 { background: #a5f3fc; text-decoration-style: solid; }
main:has(mark.t33:hover) mark.t33 { background: #d9f99d; text-decoration-style: solid; }
main:has(mark.t34:hover) mark.t34 { background: #c7d2fe; text-decoration-style: solid; }
main:has(mark.t35:hover) mark.t35 { background: #d6d3d1; text-decoration-style: solid; }
main:has(mark.t36:hover) mark.t36 { background: #bfdbfe; text-decoration-style: solid; }
main:has(mark.t37:hover) mark.t37 { background: #fef08a; text-decoration-style: solid; }
main:has(mark.t38:hover) mark.t38 { background: #e9d5ff; text-decoration-style: solid; }
main:has(mark.t39:hover) mark.t39 { background: #fed7aa; text-decoration-style: solid; }
main:has(mark.t40:hover) mark.t40 { background: #99f6e4; text-decoration-style: solid; }
main:has(mark.t41:hover) mark.t41 { background: #fecdd3; text-decoration-style: solid; }
main:has(mark.t42:hover) mark.t42 { background: #bbf7d0; text-decoration-style: solid; }
main:has(mark.t43:hover) mark.t43 { background: #f5d0fe; text-decoration-style: solid; }
main:has(mark.t44:hover) mark.t44 { background: #a5f3fc; text-decoration-style: solid; }
main:has(mark.t45:hover) mark.t45 { background: #d9f99d; text-decoration-style: solid; }
main:has(mark.t46:hover) mark.t46 { background: #c7d2fe; text-decoration-style: solid; }
main:has(mark.t47:hover) mark.t47 { background: #d6d3d1; text-decoration-style: solid; }
.hl-note label { margin-right: 0.75rem; }
main.hl-click pre.prose { color: #4b5563; }
main.hl-click pre.prose .kw { color: #4b5563; }
main.hl-click pre.prose mark:not(.hl-pick) { background: none; text-decoration-color: #4b5563; }
main.hl-click pre.prose mark.hl-pick { color: #111827; }
body:has(input.hl-toggle:not(:checked)) pre.prose mark { background: none; text-decoration: none; color: inherit; }
body:has(input.hl-toggle:not(:checked)) pre.prose .kw { color: inherit; }
button.rw { margin: 0; padding: 0; border: 0; font: inherit; color: inherit; background: none; cursor: pointer; text-decoration: underline solid #1d4ed8 1px; text-underline-offset: 0.35em; }
button.rw[aria-pressed="true"] { text-decoration-thickness: 3px; }
p.reading { min-height: 1.55em; margin: 0.5rem 0 0; overflow-wrap: anywhere; }
p.reading span[data-w=""] { color: #4b5563; }
@media screen and (max-width: 40rem) { table { display: block; overflow-x: auto; } }
@media print {
body { max-width: none; padding: 0; }
nav.crumbs, nav.docnav, .skip, form, .verdict-entry, .hl-note { display: none; }
mark, mark[class] { background: none; text-decoration-color: #4b5563; }
main.hl-click pre.prose, main.hl-click pre.prose mark.hl-pick { color: inherit; }
main.hl-click pre.prose .kw { color: #4b5563; }
main.hl-click pre.prose mark:not(.hl-pick) { text-decoration-color: #4b5563; }
details::details-content { content-visibility: visible; }
pre { border: none; padding: 0; white-space: pre-wrap; overflow-x: visible; }
a { color: inherit; text-decoration: none; }
.chip { border: 1px solid #111827; background: none; color: inherit; }
button.rw { text-decoration: none; }
p.reading { display: none; }
}"##@,
    )
}

// Fixed rendered bytes: the highlight script.
pub open spec fn script_html() -> Bytes {
    lit(
        r##"<script>
(function () {
"use strict";
var picked = "";
var shown = "";
function groupOf(node) {
if (node === null) { return ""; }
var m = node.closest("mark");
if (m === null) { return ""; }
var name = m.classList.item(0);
if (name === null) { return ""; }
return name;
}
function clearPick() {
if (picked === "") { return; }
document.getElementById("main").classList.remove("hl-click");
var marks = document.querySelectorAll("mark.hl-pick");
var i = 0;
while (i < marks.length) { marks[i].classList.remove("hl-pick"); i += 1; }
picked = "";
}
function toggleBox() { return document.querySelector("input.hl-toggle"); }
function showReading(word) {
var lines = document.querySelectorAll("p.reading span");
var i = 0;
while (i < lines.length) { lines[i].hidden = lines[i].getAttribute("data-w") !== word; i += 1; }
var words = document.querySelectorAll("button.rw");
i = 0;
while (i < words.length) { words[i].setAttribute("aria-pressed", words[i].getAttribute("data-w") === word ? "true" : "false"); i += 1; }
shown = word;
}
document.addEventListener("click", function (ev) {
var word = ev.target.closest("button.rw");
if (word === null) { return; }
var w = word.getAttribute("data-w");
if (shown === w) { showReading(""); } else { showReading(w); }
});
document.addEventListener("click", function (ev) {
var name = groupOf(ev.target);
if (name === "") { return; }
var box = toggleBox();
if (box === null) { return; }
if (box.checked === false) { return; }
if (picked === name) { clearPick(); return; }
clearPick();
var marks = document.querySelectorAll("mark." + name);
var i = 0;
while (i < marks.length) { marks[i].classList.add("hl-pick"); i += 1; }
document.getElementById("main").classList.add("hl-click");
picked = name;
});
document.addEventListener("keydown", function (ev) {
if (ev.key === "Escape") { if (shown !== "") { showReading(""); } }
});
document.addEventListener("mouseout", function (ev) {
if (picked === "") { return; }
if (groupOf(ev.target) !== picked) { return; }
if (groupOf(ev.relatedTarget) === picked) { return; }
clearPick();
});
document.addEventListener("change", function (ev) {
var box = toggleBox();
if (box === null) { return; }
if (ev.target === box) { if (box.checked === false) { clearPick(); } }
});
})();
</script>"##@,
    )
}

// --- Pure render law. ---
pub open spec fn frame(title: Bytes, crumbs: Html, body: Html) -> Html {
    lines(
        seq![
            fixed_bytes(doctype_html()),
            fixed_bytes(html_open()),
            fixed_bytes(head_open()),
            fixed_bytes(meta_open()),
            fixed_bytes(meta_viewport()),
            fixed_bytes(title_open()) + text(title) + fixed_bytes(title_close()),
            fixed_bytes(style_open()),
            fixed_bytes(css_text()),
            fixed_bytes(style_close()),
            fixed_bytes(head_close()),
            fixed_bytes(body_open()),
            fixed_bytes(a_open_skip_to_content_a_close()),
            fixed_bytes(nav_open()) + crumbs + fixed_bytes(nav_close()),
            fixed_bytes(main_open()),
            body,
            fixed_bytes(main_close()),
            fixed_bytes(footer_open_p_open_this_page_reports_what()),
            fixed_bytes(body_close()),
            fixed_bytes(html_close()),
        ],
    ) + fixed_bytes(newline())
}

pub open spec fn current(g: Guideline, r: Record) -> bool {
    exists|i: int|
        0 <= i < g.documents.len() && (#[trigger] g.documents[i]).bundle.docid == r.decision.docid
            && g.documents[i].bundle.review == r.decision.digest
}

pub open spec fn tally(g: Guideline, id: Bytes) -> (nat, nat, nat) {
    let hs = history(g, id);
    (
        hs.filter(|r: Record| current(g, r) && r.decision.approved).len(),
        hs.filter(|r: Record| current(g, r) && !r.decision.approved).len(),
        hs.filter(|r: Record| !current(g, r)).len(),
    )
}

pub open spec fn tally_parts(t: (nat, nat, nat), earlier: bool) -> Seq<Bytes> {
    (if t.0 > 0 {
        seq![check::nat_bytes(t.0) + sp_approved()]
    } else {
        Seq::empty()
    }) + (if t.1 > 0 {
        seq![check::nat_bytes(t.1) + sp_rejected()]
    } else {
        Seq::empty()
    }) + (if earlier && t.2 > 0 {
        seq![check::nat_bytes(t.2) + sp_earlier()]
    } else {
        Seq::empty()
    })
}

pub open spec fn tally_cell(t: (nat, nat, nat)) -> Bytes {
    let p = tally_parts(t, true);
    if p.len() == 0 {
        none_cap()
    } else {
        join(p, comma_sep())
    }
}

pub open spec fn tally_text(t: (nat, nat, nat)) -> Bytes {
    let p = tally_parts(t, false);
    (if p.len() > 0 {
        decisions_on_this_version_cap() + join(p, sp_and_sp()) + period()
    } else if t.2 > 0 {
        no_decision_is_recorded_on_this_cap()
    } else {
        no_decision_is_recorded_cap()
    }) + (if t.2 > 0 {
        sp_decisions_on_earlier_versions_cap() + check::nat_bytes(t.2) + period()
    } else {
        empty()
    })
}

pub open spec fn review_summary(g: Guideline) -> Bytes {
    let n = decisions(g).len();
    let k = g.documents.len();
    if n == 0 {
        no_decisions_are_recorded_for_the_cap_sp() + check::nat_bytes(k) + (if k == 1 {
            sp_document_in_this_guideline()
        } else {
            sp_documents_in_this_guideline()
        })
    } else {
        reviewers_recorded_cap_sp() + check::nat_bytes(n) + (if n == 1 {
            sp_decision_on_sp()
        } else {
            sp_decisions_on_sp()
        }) + check::nat_bytes(check::reviewed(decisions(g)).len()) + sp_of_sp() + check::nat_bytes(
            k,
        ) + (if k == 1 {
            sp_document()
        } else {
            sp_documents()
        })
    }
}

pub open spec fn class_counts(g: Guideline) -> Seq<nat> {
    let ds = decisions(g);
    let bs = bundles(g);
    seq![
        check::class_count(ds, bs, 0),
        check::class_count(ds, bs, 1),
        check::class_count(ds, bs, 2),
        check::class_count(ds, bs, 3),
        check::unreviewed(ds, bs),
    ]
}

pub open spec fn index_html(c: Corpus) -> Html {
    let rows = c.guidelines.map_values(
        |g: Guideline|
            row(
                seq![
                    cell(
                        link(guideline_dir() + url_seg(g.gid) + index_page_path(), text(title(g))),
                    ),
                    cell(number(g.documents.len())),
                    cell(number(g.coverage.rows.len())),
                ] + class_counts(g).map_values(|n: nat| cell(number(n))),
            ),
    );
    frame(
        guidelines_cap(),
        fixed_bytes(cnl_ckc_reviewer()),
        lines(
            seq![
                fixed_bytes(h1_open_guidelines_h1_close()),
                fixed_bytes(section_open()),
                fixed_bytes(table_open()),
                fixed_bytes(thead_open_tr_open_th_open_guideline_th_close_th_open()),
                fixed_bytes(tbody_open()) + lines(rows) + fixed_bytes(tbody_close()),
                fixed_bytes(table_close()),
                fixed_bytes(section_close()),
            ],
        ),
    )
}

pub open spec fn render_index(c: Corpus) -> Bytes {
    render_page(index_html(c))
}

pub open spec fn region_status(r: Row) -> Bytes {
    match r.status {
        Status::Restates(_) => restates_cap_sp() + unsuffix(
            unprefix(field(r, 4), restates_2()),
            paren_close(),
        ),
        Status::Uncovered(_) => {
            let inner = unsuffix(unprefix(field(r, 4), uncovered_2()), paren_close());
            let i = check::first_sub(inner, colon_sep(), 0);
            not_covered_cap_colon_sp() + (if i + 2 <= inner.len() {
                inner.skip(i as int + 2)
            } else {
                empty()
            })
        },
        Status::Pending => pending_cap(),
        _ => empty(),
    }
}

// A two-cell table row (Word meanings, contract ur D4).
pub open spec fn word_row(a: Html, b: Html) -> Html {
    row(seq![cell(a), cell(b)])
}

pub open spec fn guideline_html(g: Guideline) -> Html {
    let labels = seq![
        passages_cap(),
        with_ace_cap(),
        pending_cap(),
        approved_cap(),
        rejected_cap(),
        contested_cap(),
        outdated_cap(),
        unreviewed_cap(),
    ];
    let counts = seq![
        g.coverage.rows.len(),
        check::count_status(g.coverage.rows, 1),
        check::count_status(g.coverage.rows, 0),
    ] + class_counts(g);
    let status_rows = Seq::new(
        labels.len(),
        |i: int|
            row(
                seq![
                    cell(text(labels[i])),
                    cell(
                        number(
                            if i < counts.len() {
                                counts[i]
                            } else {
                                0
                            },
                        ),
                    ),
                ],
            ),
    );
    let doc_rows = g.documents.map_values(
        |d: Document|
            {
                let id = d.bundle.docid;
                row(
                    seq![
                        cell(
                            link(
                                document_dir() + url_seg(id) + html_ext(),
                                text(document_title(g, id)),
                            ),
                        ),
                        cell(chip(state(g, id))),
                        cell(text(tally_cell(tally(g, id)))),
                        cell(text(coverage_field(g, id, 0))),
                    ],
                )
            },
    );
    let others = g.coverage.rows.filter(|r: Row| !matches!(r.status,Status::Ace(_))).map_values(
        |r: Row| row(seq![cell(text(r.id)), cell(text(region_status(r))), cell(text(field(r, 3)))]),
    );
    let body = lines(
        seq![
            fixed_bytes(h1_open()) + text(title(g)) + fixed_bytes(h1_close()),
            fixed_bytes(p_open()) + text(review_summary(g)) + fixed_bytes(
                sp_a_open_all_decision_records_a_close_p_close(),
            ),
            fixed_bytes(section_open()),
            fixed_bytes(h2_open_status_h2_close()),
            fixed_bytes(table_open_2()),
            fixed_bytes(thead_open_tr_open_th_open_status_th_close_th_open()),
            fixed_bytes(tbody_open()) + lines(status_rows) + fixed_bytes(tbody_close()),
            fixed_bytes(table_close()),
            fixed_bytes(section_close()),
        ] + meanings_section(g.vocabulary) + superseded_section(g) + seq![
            fixed_bytes(section_open()),
            fixed_bytes(h2_open_documents_h2_close()),
            fixed_bytes(table_open_2()),
            fixed_bytes(thead_open_tr_open_th_open_document_th_close_th_open()),
            fixed_bytes(tbody_open()) + lines(doc_rows) + fixed_bytes(tbody_close()),
            fixed_bytes(table_close()),
            fixed_bytes(section_close()),
            fixed_bytes(section_open()),
            fixed_bytes(h2_open_passages_without_ace_h2_close()),
            fixed_bytes(table_open_2()),
            fixed_bytes(thead_open_tr_open_th_open_passage_th_close_th_open()),
            fixed_bytes(tbody_open()) + lines(others) + fixed_bytes(tbody_close()),
            fixed_bytes(table_close()),
            fixed_bytes(section_close()),
        ],
    );
    frame(title(g), fixed_bytes(a_open_guidelines_a_close_sp()) + text(title(g)), body)
}

pub open spec fn render_guideline(g: Guideline) -> Bytes {
    render_page(guideline_html(g))
}

pub open spec fn version_link(r: Record, version: Bytes) -> Html {
    if r.decision.commit.len() > 0 {
        link(https_github_com_eturkes_cnl_ckc() + r.decision.commit, text(version))
    } else {
        text(version)
    }
}

pub open spec fn record_row(g: Guideline, r: Record) -> Html {
    row(
        seq![
            cell(
                text(
                    state_label(
                        if r.decision.approved {
                            0
                        } else {
                            1
                        },
                    ),
                ),
            ),
            cell(text(r.reviewer)),
            cell(text(human_date(r.decision.date))),
            cell(
                version_link(
                    r,
                    if current(g, r) {
                        current_cap()
                    } else {
                        earlier_cap()
                    },
                ),
            ),
            cell(
                text(
                    if r.comment.len() == 0 {
                        not_given_cap()
                    } else {
                        r.comment
                    },
                ),
            ),
        ],
    )
}

pub open spec fn record_section(g: Guideline, id: Bytes) -> Seq<Html> {
    let hs = history(g, id);
    if hs.len() == 0 {
        Seq::empty()
    } else {
        let rows = Seq::new(hs.len(), |i: int| record_row(g, hs[hs.len() - i - 1]));
        seq![
            fixed_bytes(section_id()) + attr(id) + fixed_bytes(attr_end()),
            fixed_bytes(h2_open()) + link(
                document_dir() + url_seg(id) + html_ext(),
                text(document_title(g, id)),
            ) + fixed_bytes(h2_close()),
            fixed_bytes(table_open_3()),
            fixed_bytes(thead_open_tr_open_th_open_decision_th_close_th_open()),
            fixed_bytes(tbody_open()) + lines(rows) + fixed_bytes(tbody_close()),
            fixed_bytes(table_close()),
            fixed_bytes(section_close()),
        ]
    }
}

pub open spec fn records_html(g: Guideline) -> Html {
    let sections = g.documents.map_values(
        |d: Document| record_section(g, d.bundle.docid),
    ).flatten();
    let summary = review_summary(g) + (if decisions(g).len() > 0 {
        sp_the_newest_decision_for_each_document_cap()
    } else {
        empty()
    });
    let notes = if sections.len() == 0 {
        seq![fixed_bytes(p_open_open_a_document_and_record())]
    } else {
        seq![fixed_bytes(p_open_each_reviewer_name_is_recorded())] + (if records(g).filter(
            |r: Record| r.decision.commit.len() > 0,
        ).len() > 0 {
            seq![fixed_bytes(p_open_each_version_links_to_the())]
        } else {
            Seq::empty()
        })
    };
    frame(
        decision_records_cap(),
        fixed_bytes(a_open_guidelines_a_close_a_open()) + text(title(g)) + fixed_bytes(
            a_close_records(),
        ),
        lines(
            seq![
                fixed_bytes(h1_open_decision_records_h1_close()),
                fixed_bytes(p_open()) + text(summary) + fixed_bytes(p_close()),
            ] + sections + notes + seq![
                fixed_bytes(nav_open_a_open_guideline_index_a_close_nav_close()),
            ],
        ),
    )
}

pub open spec fn render_records(g: Guideline) -> Bytes {
    render_page(records_html(g))
}

// The keyword regexp is ASCII; Unicode case folding never applies to its gaps.
pub open spec fn token_byte(b: u8) -> bool {
    is_alnum_b(b) && b != 95
}

pub open spec fn token_end(s: Bytes, i: nat) -> nat
    decreases s.len() - i,
{
    if i < s.len() && token_byte(s[i as int]) {
        token_end(s, i + 1)
    } else if i + 1 < s.len() && s[i as int] == 45 && token_byte(s[i as int + 1]) {
        token_end(s, i + 2)
    } else {
        i
    }
}

pub open spec fn keyword_html(s: Bytes) -> Html
    decreases s.len(),
{
    if s.len() == 0 {
        Seq::empty()
    } else if token_byte(s[0]) {
        let end = token_end(s, 1);
        let e = if 1 <= end <= s.len() {
            end
        } else {
            1
        };
        let word = s.take(e as int);
        (if stop_words().contains(lower(word)) {
            fixed_bytes(span_open()) + text(word) + fixed_bytes(span_close())
        } else {
            text(word)
        }) + keyword_html(s.skip(e as int))
    } else {
        text(seq![s[0]]) + keyword_html(s.drop_first())
    }
}

pub open spec fn slice_text(s: Bytes, start: int, end: int) -> Bytes {
    let cs = chars(s);
    if 0 <= start <= end <= cs.len() {
        encode_utf8(cs.subrange(start, end))
    } else {
        empty()
    }
}

pub open spec fn marked_html(
    s: Bytes,
    spans: Seq<align::OutSpan>,
    keywords: bool,
    cursor: int,
) -> Html
    decreases spans.len(),
{
    if spans.len() == 0 {
        let t = slice_text(s, cursor, chars(s).len() as int);
        if keywords {
            keyword_html(t)
        } else {
            text(t)
        }
    } else {
        let p = spans[0];
        let gap = slice_text(s, cursor, p.start);
        let part = slice_text(s, p.start, p.end);
        (if keywords {
            keyword_html(gap)
        } else {
            text(gap)
        }) + (if p.index < 48 {
            fixed_bytes(mark_class_t()) + attr(v1text::dec_bytes(p.index)) + fixed_bytes(attr_end())
        } else {
            fixed_bytes(mark_open())
        }) + text(part) + fixed_bytes(mark_close()) + marked_html(
            s,
            spans.drop_first(),
            keywords,
            p.end,
        )
    }
}

pub open spec fn alignment(g: Guideline, d: Document) -> Option<align::AlignModel> {
    match d.alignment {
        Option::None => Option::None,
        Option::Some(b) => match align::align_outcome(
            chars(b),
            chars(payload(g, d.bundle.docid)),
            chars(d.ace),
        ) {
            align::AlignOutcome::Ok(m) => Option::Some(m),
            _ => Option::None,
        },
    }
}

pub open spec fn aligned_text(g: Guideline, d: Document, ace: bool) -> Html {
    let s = if ace {
        d.ace
    } else {
        payload(g, d.bundle.docid)
    };
    match alignment(g, d) {
        Option::Some(m) => marked_html(
            s,
            if ace {
                m.ace
            } else {
                m.src
            },
            ace,
            0,
        ),
        Option::None => if ace {
            keyword_html(s)
        } else {
            text(s)
        },
    }
}

pub open spec fn names(g: Guideline) -> Seq<Bytes> {
    check::sort_bytes(
        check::dedup_bytes(
            records(g).map_values(|r: Record| r.reviewer).filter(|n: Bytes| n.len() > 0),
        ),
    )
}

pub open spec fn latest_name(rs: Seq<Record>, date: Bytes, name: Bytes) -> Bytes
    decreases rs.len(),
{
    if rs.len() == 0 {
        name
    } else {
        let r = rs[0];
        if r.reviewer.len() > 0 && !bytes_lt(r.decision.date, date) {
            latest_name(rs.drop_first(), r.decision.date, r.reviewer)
        } else {
            latest_name(rs.drop_first(), date, name)
        }
    }
}

pub open spec fn roster(g: Guideline) -> Html {
    fixed_bytes(datalist_open()) + names(g).map_values(
        |n: Bytes| fixed_bytes(option_value()) + attr(n) + fixed_bytes(option_close()),
    ).flatten() + fixed_bytes(datalist_close())
}

pub open spec fn linebreak(c: char) -> bool {
    c == '\n' || c == '\r' || c == '\u{b}' || c == '\u{c}' || c == '\u{1c}' || c == '\u{1d}' || c
        == '\u{1e}' || c == '\u{85}' || c == '\u{2028}' || c == '\u{2029}'
}

pub open spec fn splitline_count(cs: Seq<char>, pending: bool) -> nat
    decreases cs.len(),
{
    if cs.len() == 0 {
        if pending {
            1
        } else {
            0
        }
    } else if linebreak(cs[0]) {
        1 + splitline_count(
            if cs.len() > 1 && cs[0] == '\r' && cs[1] == '\n' {
                cs.skip(2)
            } else {
                cs.drop_first()
            },
            false,
        )
    } else {
        splitline_count(cs.drop_first(), true)
    }
}

// A word of table bytes `raw` as visible text when its bytes stand verbatim in
// `raw`, else `not stated`, so every visible slot is a copied table span.
pub open spec fn pl_word(pl: Bytes, w: Bytes) -> Html {
    if w.len() > 0 && check::first_sub(pl, w, 0) + w.len() <= pl.len() {
        text(w)
    } else {
        fixed_bytes(not_stated())
    }
}

// A qualifier class as its kind word (user ruling, contract s2 D7).
pub open spec fn kind_html(k: Bytes) -> Html {
    if k == lit("usuality"@) {
        fixed_bytes(kind_how_often())
    } else if k == lit("ideality"@) {
        fixed_bytes(kind_best_case())
    } else if k == lit("focus"@) {
        fixed_bytes(kind_emphasis())
    } else if k == lit("manner"@) {
        fixed_bytes(kind_manner())
    } else if k == lit("force"@) {
        fixed_bytes(kind_strength_of_wording())
    } else if k == lit("possibility"@) {
        fixed_bytes(kind_possibility())
    } else if k == lit("applicability"@) {
        fixed_bytes(kind_condition_of_use())
    } else {
        fixed_bytes(not_stated())
    }
}

// --- Word meanings + reading words (contract ur; Decisions `Review UI`): the
// table-level reading of each strength, evidence, preference, alternative,
// qualifier, scope and exclusion row — on the guideline page in one table, on a
// document page behind each ACE token that spells a row's lemma. A reading states
// how the table reads the word in every document, never that one occurrence
// compiled that way.
pub open spec fn reading_of(kind: int, v: Bytes) -> Html {
    if kind == 0 && v == lit("strong"@) {
        fixed_bytes(a_strong_recommendation())
    } else if kind == 0 && v == lit("conditional"@) {
        fixed_bytes(a_conditional_recommendation())
    } else if kind == 1 && v == lit("high"@) {
        fixed_bytes(high_certainty_of_the_evidence())
    } else if kind == 1 && v == lit("moderate"@) {
        fixed_bytes(moderate_certainty_of_the_evidence())
    } else if kind == 1 && v == lit("low"@) {
        fixed_bytes(low_certainty_of_the_evidence())
    } else if kind == 1 && v == lit("very_low"@) {
        fixed_bytes(very_low_certainty_of_the_evidence())
    } else if kind == 2 {
        fixed_bytes(the_preferred_option())
    } else if kind == 3 {
        fixed_bytes(the_alternative_to_the_preferred_option())
    } else if kind == 4 {
        fixed_bytes(a_qualifier_sep()) + kind_html(v)
    } else if kind == 5 {
        fixed_bytes(every_recommendation_of_this_guideline())
    } else if kind == 6 {
        fixed_bytes(the_verb_of_a_scope_exclusion())
    } else {
        fixed_bytes(not_stated())
    }
}

// (lemma, reading) per reading row: strength, evidence, preference, alternative,
// qualifier, scope, exclusion rows, each kind in file order.
pub open spec fn reading_rows(t: Vocabulary) -> Seq<(Bytes, Html)> {
    t.strengths.map_values(|r: (Bytes, Bytes)| (r.0, reading_of(0, r.1))) + t.evidences.map_values(
        |r: (Bytes, Bytes)| (r.0, reading_of(1, r.1)),
    ) + t.preferences.map_values(|a: Bytes| (a, reading_of(2, empty())))
        + t.alternatives.map_values(|a: Bytes| (a, reading_of(3, empty())))
        + t.qualifiers.map_values(|r: (Bytes, Bytes)| (r.0, reading_of(4, r.1)))
        + t.scopes.map_values(|r: (Bytes, Bytes)| (r.0, reading_of(5, empty())))
        + t.exclusions.map_values(|a: Bytes| (a, reading_of(6, empty())))
}

// The reading of lemma `l`: its first reading row's.
pub open spec fn first_reading(rs: Seq<(Bytes, Html)>, l: Bytes) -> Html
    decreases rs.len(),
{
    if rs.len() == 0 {
        fixed_bytes(not_stated())
    } else if rs[0].0 == l {
        rs[0].1
    } else {
        first_reading(rs.drop_first(), l)
    }
}

// Lemmas that read in any sentence: every reading row outside the scope pair.
pub open spec fn plain_lemmas(t: Vocabulary) -> Seq<Bytes> {
    vocabulary::keys(t.strengths) + vocabulary::keys(t.evidences) + t.preferences + t.alternatives
        + vocabulary::keys(t.qualifiers)
}

// The exclusion verb as an ACE sentence can spell it: display lookups for the
// lemma, never a claim about the token's own lemma.
pub open spec fn verb_forms(v: Bytes) -> Seq<Bytes> {
    seq![v, v + lit("s"@), v + lit("es"@)] + (if v.len() > 0 && v.last() == 121u8 {
        seq![v.drop_last() + lit("ies"@)]
    } else {
        Seq::empty()
    })
}

// The scope sentence of Word meanings holds only when no plain lemma shadows the pair.
pub open spec fn scope_shown(t: Vocabulary) -> bool {
    vocabulary::scoped(t) && !plain_lemmas(t).contains(t.scopes[0].0) && verb_forms(
        t.exclusions[0],
    ).filter(|f: Bytes| plain_lemmas(t).contains(f)).len() == 0
}

pub open spec fn meanings_section(t: Option<Bytes>) -> Seq<Html> {
    match t {
        Option::Some(raw) => match vocabulary::parse_vocabulary(raw) {
            Result::Ok(m) => {
                let rows = reading_rows(m);
                if rows.len() == 0 {
                    Seq::empty()
                } else {
                    seq![
                        fixed_bytes(section_open()),
                        fixed_bytes(h2_open_word_meanings_h2_close()),
                        fixed_bytes(p_open_the_compiler_reads_each_word()),
                    ] + (if scope_shown(m) {
                        seq![
                            fixed_bytes(p_open_the_words_sp()) + pl_word(raw, m.scopes[0].0)
                                + fixed_bytes(sp_and_sp()) + pl_word(raw, m.exclusions[0])
                                + fixed_bytes(sp_have_a_solid_underline_only_in()),
                        ]
                    } else {
                        Seq::empty()
                    }) + seq![
                        fixed_bytes(table_open_2()),
                        fixed_bytes(thead_open_tr_open_th_open_word_th_close_th_open()),
                        fixed_bytes(tbody_open()) + lines(
                            rows.map_values(|r: (Bytes, Html)| word_row(pl_word(raw, r.0), r.1)),
                        ) + fixed_bytes(tbody_close()),
                        fixed_bytes(table_close()),
                        fixed_bytes(section_close()),
                    ]
                }
            },
            Result::Err(_) => Seq::empty(),
        },
        Option::None => Seq::empty(),
    }
}

// --- Superseded statements (contract sup4; Decisions `Supersession`): each
// `supersession` or `superseded` row of the guideline's table, in table order,
// cut into table spans as `vocabulary::superseding` reads its value.
pub ghost struct Superseded {
    pub document: bool,  // a `supersession` row: the key names a document
    pub key: Bytes,
    pub date: Bytes,  // YYYYMMDD
    pub url: Bytes,
    pub citation: Bytes,
}

pub open spec fn superseded_row(line: Bytes) -> Option<Superseded> {
    let f = check::tab_fields(line);
    if f.len() == 3 && (f[0] == lit("supersession"@) || f[0] == lit("superseded"@)) && f[2].len()
        >= 9 {
        let rest = f[2].skip(9);
        let n = crate::replay::first_byte(rest, 32, 0);
        Option::Some(
            Superseded {
                document: f[0] == lit("supersession"@),
                key: f[1],
                date: f[2].take(8),
                url: rest.take(n as int),
                citation: if n < rest.len() {
                    rest.skip(n as int + 1)
                } else {
                    empty()
                },
            },
        )
    } else {
        Option::None
    }
}

pub open spec fn superseded_scan(lines: Seq<Bytes>) -> Seq<Superseded>
    decreases lines.len(),
{
    if lines.len() == 0 {
        Seq::empty()
    } else {
        (match superseded_row(lines[0]) {
            Option::Some(r) => seq![r],
            Option::None => Seq::empty(),
        }) + superseded_scan(lines.drop_first())
    }
}

// Only a table the grammar accepts (the `meanings_section` gate).
pub open spec fn superseded_rows(t: Option<Bytes>) -> Seq<Superseded> {
    match t {
        Option::Some(raw) => match vocabulary::parse_vocabulary(raw) {
            Result::Ok(_) => superseded_scan(
                check::body_lines(raw.skip(vocabulary::vocabulary_header().len() as int)),
            ),
            Result::Err(_) => Seq::empty(),
        },
        Option::None => Seq::empty(),
    }
}

// YYYY-MM-DD: three table spans joined by registry hyphens.
pub open spec fn iso_date(d: Bytes) -> Html {
    text(d.take(4)) + fixed_bytes(hyphen()) + text(d.subrange(4, 6)) + fixed_bytes(hyphen()) + text(
        d.subrange(6, 8),
    )
}

pub open spec fn source_link(r: Superseded) -> Html {
    link(r.url, text(r.citation))
}

// Document page (D3): the notice of the first `supersession` row naming the document.
pub open spec fn superseded_notice(g: Guideline, id: Bytes) -> Seq<Html> {
    let rs = superseded_rows(g.vocabulary).filter(|r: Superseded| r.document && r.key == id);
    if rs.len() == 0 {
        Seq::empty()
    } else {
        seq![
            fixed_bytes(section_open_superseded()),
            fixed_bytes(p_open_on_sp()) + iso_date(rs[0].date) + fixed_bytes(comma_sep())
                + source_link(rs[0]) + fixed_bytes(sp_superseded_the_guideline_statements()),
            fixed_bytes(section_close()),
        ]
    }
}

// Guideline page (D4): an empty cell claims nothing the coverage law decides.
pub open spec fn superseded_cells(g: Guideline, r: Superseded) -> Html {
    let passage = if r.document {
        coverage_field(g, r.key, 0)
    } else {
        r.key
    };
    let document = if r.document && docids(g).contains(r.key) {
        link(document_dir() + url_seg(r.key) + html_ext(), text(document_title(g, r.key)))
    } else {
        Seq::empty()
    };
    row(seq![cell(text(passage)), cell(document), cell(source_link(r)), cell(iso_date(r.date))])
}

pub open spec fn superseded_section(g: Guideline) -> Seq<Html> {
    let rs = superseded_rows(g.vocabulary);
    if rs.len() == 0 {
        Seq::empty()
    } else {
        seq![
            fixed_bytes(section_open()),
            fixed_bytes(h2_open_superseded_passages_h2_close()),
            fixed_bytes(p_open_later_law_regulation_or_guidance()),
            fixed_bytes(table_open_2()),
            fixed_bytes(thead_open_tr_open_th_open_passage_th_close_th_open_document_superseded()),
            fixed_bytes(tbody_open()) + lines(rs.map_values(|r: Superseded| superseded_cells(g, r)))
                + fixed_bytes(tbody_close()),
            fixed_bytes(table_close()),
            fixed_bytes(section_close()),
        ]
    }
}

// A reading word: characters [start, end) of the ACE text.
pub ghost struct Reading {
    pub start: int,
    pub end: int,
    pub lemma: Bytes,
}

pub open spec fn token_char(c: char) -> bool {
    ('0' <= c <= '9') || ('A' <= c <= 'Z') || ('a' <= c <= 'z')
}

// keyword_html's token scan over characters.
pub open spec fn char_token_end(cs: Seq<char>, i: int) -> int
    decreases cs.len() - i,
{
    if 0 <= i < cs.len() && token_char(cs[i]) {
        char_token_end(cs, i + 1)
    } else if 0 <= i && i + 1 < cs.len() && cs[i] == '-' && token_char(cs[i + 1]) {
        char_token_end(cs, i + 2)
    } else {
        i
    }
}

// A bundle holding a clause that the compiler emitted as the scope exclusion
// record of `key`.
pub open spec fn has_record(b: v1text::Bundle, key: Bytes) -> bool {
    exists|i: int|
        0 <= i < b.clauses.len() && (#[trigger] b.clauses[i]).head == crate::emit::exclusion_record(
            key,
        )
}

// A bundle paired with its ACE line: the s-th nonempty LF-delimited line (the
// certification line law) equals the bundle's sentence text.
pub open spec fn paired(ace: Bytes, b: v1text::Bundle) -> bool {
    let ls = crate::emit::nonempty_lines(ace);
    1 <= b.s <= ls.len() && ls[b.s - 1] == b.text
}

// The nonempty-line ordinals of the exclusion sentences.
#[verifier::opaque]
pub open spec fn exclusion_lines(d: Document, key: Bytes) -> Seq<nat> {
    if v1text::accepts(d.pl) {
        match crate::replay::the_v1(d.pl) {
            V1File::Doc(f) => f.bundles.filter(
                |b: v1text::Bundle| has_record(b, key) && paired(d.ace, b),
            ).map_values(|b: v1text::Bundle| b.s),
            _ => Seq::empty(),
        }
    } else {
        Seq::empty()
    }
}

// First match: a plain lemma anywhere; inside an exclusion sentence the scope
// noun, then a form of the exclusion verb (read as the verb's lemma).
pub open spec fn word_lemma(t: Vocabulary, w: Bytes, exclusion: bool) -> Option<Bytes> {
    if plain_lemmas(t).contains(w) {
        Option::Some(w)
    } else if exclusion && vocabulary::scoped(t) && w == t.scopes[0].0 {
        Option::Some(w)
    } else if exclusion && vocabulary::scoped(t) && verb_forms(t.exclusions[0]).contains(w) {
        Option::Some(t.exclusions[0])
    } else {
        Option::None
    }
}

// The reading words of cs[i..]: `line` = the ordinal of the last nonempty line
// begun, `fresh` = at a line start, `ex` = the exclusion ordinals.
pub open spec fn reading_scan(
    cs: Seq<char>,
    i: int,
    line: nat,
    fresh: bool,
    t: Vocabulary,
    ex: Seq<nat>,
) -> Seq<Reading>
    decreases cs.len() - i,
{
    if i < 0 || i >= cs.len() {
        Seq::empty()
    } else if cs[i] == '\n' {
        reading_scan(cs, i + 1, line, true, t, ex)
    } else {
        let n = if fresh {
            line + 1
        } else {
            line
        };
        if token_char(cs[i]) {
            let e = char_token_end(cs, i + 1);
            let end = if i < e <= cs.len() {
                e
            } else {
                i + 1
            };
            (match word_lemma(t, encode_utf8(cs.subrange(i, end)), ex.contains(n)) {
                Option::Some(l) => seq![Reading { start: i, end, lemma: l }],
                Option::None => Seq::empty(),
            }) + reading_scan(cs, end, n, false, t, ex)
        } else {
            reading_scan(cs, i + 1, n, false, t, ex)
        }
    }
}

#[verifier::opaque]
pub open spec fn reading_words(g: Guideline, d: Document) -> Seq<Reading> {
    match g.vocabulary {
        Option::Some(raw) => match vocabulary::parse_vocabulary(raw) {
            Result::Ok(t) => reading_scan(
                chars(d.ace),
                0,
                0,
                true,
                t,
                if vocabulary::scoped(t) {
                    exclusion_lines(d, t.scopes[0].1)
                } else {
                    Seq::empty()
                },
            ),
            Result::Err(_) => Seq::empty(),
        },
        Option::None => Seq::empty(),
    }
}

// The marks over characters [a, b), clipped + shifted to the piece.
pub open spec fn clip(spans: Seq<align::OutSpan>, a: int, b: int) -> Seq<align::OutSpan> {
    spans.filter(
        |p: align::OutSpan|
            (if p.start < a {
                a
            } else {
                p.start
            }) < (if p.end < b {
                p.end
            } else {
                b
            }),
    ).map_values(
        |p: align::OutSpan|
            align::OutSpan {
                start: (if p.start < a {
                    a
                } else {
                    p.start
                }) - a,
                end: (if p.end < b {
                    p.end
                } else {
                    b
                }) - a,
                index: p.index,
            },
    )
}

pub open spec fn piece_html(s: Bytes, spans: Seq<align::OutSpan>, a: int, b: int) -> Html {
    marked_html(slice_text(s, a, b), clip(spans, a, b), true, 0)
}

pub open spec fn words_html(
    s: Bytes,
    spans: Seq<align::OutSpan>,
    ws: Seq<Reading>,
    cursor: int,
) -> Html
    decreases ws.len(),
{
    if ws.len() == 0 {
        piece_html(s, spans, cursor, chars(s).len() as int)
    } else {
        piece_html(s, spans, cursor, ws[0].start) + fixed_bytes(button_open_rw()) + attr(
            ws[0].lemma,
        ) + fixed_bytes(attr_end()) + piece_html(s, spans, ws[0].start, ws[0].end) + fixed_bytes(
            button_close(),
        ) + words_html(s, spans, ws.drop_first(), ws[0].end)
    }
}

// The ACE box: today's rendering, or the reading words over it.
pub open spec fn ace_html(g: Guideline, d: Document) -> Html {
    let ws = reading_words(g, d);
    if ws.len() == 0 {
        aligned_text(g, d, true)
    } else {
        words_html(
            d.ace,
            match alignment(g, d) {
                Option::Some(m) => m.ace,
                Option::None => Seq::empty(),
            },
            ws,
            0,
        )
    }
}

pub open spec fn reading_span(raw: Bytes, t: Vocabulary, l: Bytes) -> Html {
    fixed_bytes(span_data_w()) + attr(l) + fixed_bytes(
        hidden_in_this_guideline_the_compiler_reads(),
    ) + pl_word(raw, l) + fixed_bytes(sp_as_sp()) + first_reading(reading_rows(t), l) + fixed_bytes(
        period(),
    ) + fixed_bytes(span_close())
}

// The reserved line under the ACE box: the hint, then one hidden span per lemma.
pub open spec fn reading_line(g: Guideline, d: Document) -> Seq<Html> {
    let ws = reading_words(g, d);
    match g.vocabulary {
        Option::Some(raw) => match vocabulary::parse_vocabulary(raw) {
            Result::Ok(t) => if ws.len() == 0 {
                Seq::empty()
            } else {
                seq![
                    fixed_bytes(p_class_reading_open_hint()) + check::dedup_bytes(
                        ws.map_values(|w: Reading| w.lemma),
                    ).map_values(|l: Bytes| reading_span(raw, t, l)).flatten() + fixed_bytes(
                        p_close(),
                    ),
                ]
            },
            Result::Err(_) => Seq::empty(),
        },
        Option::None => Seq::empty(),
    }
}

pub open spec fn document_html(
    g: Guideline,
    d: Document,
    prev: Bytes,
    next: Bytes,
    token: Bytes,
    commit: Bytes,
) -> Html {
    let id = d.bundle.docid;
    let k = state(g, id);
    let region = coverage_field(g, id, 0);
    let pdfs = g.source_names.filter(|n: Bytes| check::ends(n, pdf_ext()));
    let heading = text(title(g)) + (if pdfs.len() == 1 {
        fixed_bytes(sp_a_class_source_href_source()) + attr(url_seg(pdfs[0])) + fixed_bytes(
            pdf_a_close_cap(),
        )
    } else {
        Seq::empty()
    });
    let source = unprefix(coverage_field(g, id, 1), source_dir());
    let prov = (if region.len() > 0 {
        seq![
            fixed_bytes(span_plain_open()) + fixed_bytes(passage_cap_sp()) + text(region)
                + fixed_bytes(span_close()),
        ]
    } else {
        Seq::empty()
    }) + (if g.source_names.contains(source) {
        seq![link(source_2() + url_seg(source), fixed_bytes(source_text_cap()))]
    } else {
        Seq::empty()
    });
    let records_href = records_html_2() + (if history(g, id).len() > 0 {
        copy_2() + url_seg(id)
    } else {
        empty()
    });
    let shown = match alignment(g, d) {
        Option::Some(m) => m.count > 0,
        _ => false,
    };
    let nav = (if prev.len() > 0 {
        seq![link(url_seg(prev) + html_ext(), fixed_bytes(previous_document_cap()))]
    } else {
        Seq::empty()
    }) + seq![fixed_bytes(a_open_guideline_index_a_close())] + (if next.len() > 0 {
        seq![link(url_seg(next) + html_ext(), fixed_bytes(next_document_cap()))]
    } else {
        Seq::empty()
    });
    let body = lines(
        seq![
            fixed_bytes(h1_open()) + heading + fixed_bytes(h1_close()),
            fixed_bytes(h2_open()) + text(document_title(g, id)) + fixed_bytes(space_2()) + chip(k)
                + fixed_bytes(h2_close()),
        ] + (if prov.len() > 0 {
            seq![
                fixed_bytes(p_class_provenance_open()) + hjoin(prov, fixed_bytes(space_2()))
                    + fixed_bytes(p_close()),
            ]
        } else {
            Seq::empty()
        }) + seq![
            fixed_bytes(p_open()) + text(tally_text(tally(g, id))) + fixed_bytes(space_2()) + link(
                records_href,
                fixed_bytes(all_decision_records_cap()),
            ) + fixed_bytes(p_close()),
        ] + (if k == 3 {
            seq![
                fixed_bytes(section_open_2()),
                fixed_bytes(p_open_the_document_or_its_source()),
                fixed_bytes(section_close()),
            ]
        } else {
            Seq::empty()
        }) + superseded_notice(g, id) + (if shown {
            seq![
                fixed_bytes(p_open_label_open_input_open_highlighting_label_close_try()),
                fixed_bytes(script_html()),
            ]
        } else if reading_words(g, d).len() > 0 {
            seq![fixed_bytes(script_html())]
        } else {
            Seq::empty()
        }) + seq![
            fixed_bytes(section_open()),
            fixed_bytes(h3_open_original_passage_h3_close()),
            fixed_bytes(pre_open()) + aligned_text(g, d, false) + fixed_bytes(pre_close()),
            fixed_bytes(section_close()),
            fixed_bytes(section_open()),
            fixed_bytes(h3_open_attempto_controlled_english_ace_h3_close()),
            fixed_bytes(pre_open()) + ace_html(g, d) + fixed_bytes(pre_close()),
        ] + reading_line(g, d) + seq![
            fixed_bytes(section_close()),
            fixed_bytes(section_open_3()),
            fixed_bytes(h3_open_record_a_decision_h3_close()),
            fixed_bytes(p_open_does_the_ace_representation_appropriately()),
            fixed_bytes(form_open()),
            fixed_bytes(fieldset_open()),
            fixed_bytes(legend_open_decision_legend_close()),
            fixed_bytes(label_open_input_open_approved_label_close()),
            fixed_bytes(label_open_input_open_rejected_label_close()),
            fixed_bytes(fieldset_close()),
            fixed_bytes(p_open_your_name_and_comment_are_published()),
            fixed_bytes(label_open_reviewer_name_label_close()),
            fixed_bytes(input_type_text_id_reviewer_name()) + attr(
                latest_name(records(g), empty(), empty()),
            ) + fixed_bytes(required_2()),
            roster(g),
            fixed_bytes(label_open_comment_optional_label_close()),
            fixed_bytes(textarea_open_textarea_close()),
            fixed_bytes(input_type_hidden_name_review_sha256_value()) + attr(d.bundle.review)
                + fixed_bytes(attr_end()),
            fixed_bytes(input_type_hidden_name_ledger_sha256_value()) + attr(g.ledger_digest)
                + fixed_bytes(attr_end()),
            fixed_bytes(input_type_hidden_name_commit_value()) + attr(commit) + fixed_bytes(
                attr_end(),
            ),
            fixed_bytes(input_type_hidden_name_csrf_value()) + attr(token) + fixed_bytes(
                attr_end(),
            ),
            fixed_bytes(button_open_record_decision_button_close()),
            fixed_bytes(form_close()),
            fixed_bytes(section_close()),
            fixed_bytes(section_open()),
            fixed_bytes(details_open()),
            fixed_bytes(summary_open_compiled_prolog()) + number(
                splitline_count(chars(d.pl), false),
            ) + fixed_bytes(
                if splitline_count(chars(d.pl), false) == 1 {
                    sp_line_summary_close()
                } else {
                    sp_lines_summary_close()
                },
            ),
            fixed_bytes(pre_open_2()) + text(d.pl) + fixed_bytes(pre_close()),
            fixed_bytes(details_close()),
            fixed_bytes(section_close()),
            fixed_bytes(nav_open_2()) + hjoin(nav, fixed_bytes(space_2())) + fixed_bytes(
                nav_close(),
            ),
        ],
    );
    frame(
        document_title(g, id),
        fixed_bytes(a_open_guidelines_a_close_a_open_2()) + text(title(g)) + fixed_bytes(
            a_close_sp(),
        ) + text(region),
        body,
    )
}

// commit = the snapshot commit the page renders; the form posts it back.
pub open spec fn render_document(
    g: Guideline,
    d: Document,
    prev: Bytes,
    next: Bytes,
    token: Bytes,
    commit: Bytes,
) -> Bytes {
    render_page(document_html(g, d, prev, next, token, commit))
}

pub open spec fn stop_words() -> Seq<Bytes> {
    check::split_on(a_an_the_every_each_no(), 32)
}

// --- POST. Header/body IO is already parsed. ---
pub ghost struct Request {
    pub method: Bytes,
    pub path: Bytes,
    pub host: Bytes,
    pub origin: Option<Bytes>,
    pub content_type: Bytes,
    pub cookie: Option<Bytes>,
    pub body: Option<Bytes>,
}

pub ghost struct Fields {
    pub verdict: Bytes,
    pub reviewer: Bytes,
    pub comment: Bytes,
    pub review: Bytes,
    pub ledger: Bytes,
    pub csrf: Bytes,
    pub commit: Bytes,
}

// at_commit = the shell's attestation (posted commit, review digest of docid
// there), present only after the commit exists, is the snapshot commit or its
// ancestor, and bundle v2 derived there names the docid.
pub ghost struct PostDocument {
    pub docid: Bytes,
    pub render_error: Option<Bytes>,
    pub at_commit: Option<(Bytes, Bytes)>,
}

pub ghost struct PostGuideline {
    pub gid: Bytes,
    pub documents: Seq<PostDocument>,
    pub fresh: Result<Seq<Bundle>, Bytes>,
    pub ledger: Src,
    pub ledger_digest: Bytes,
}

// commit = the snapshot commit the pages render; empty = filesystem mode.
// session = the launch secret `ckc ui serve` hands the browser; empty = no
// session (the `ui request` seam and the static render).
pub ghost struct PostState {
    pub port: nat,
    pub token: Bytes,
    pub session: Bytes,
    pub models: Result<Seq<PostGuideline>, Bytes>,
    pub now: Bytes,
    pub commit: Bytes,
}

pub ghost struct Response {
    pub status: nat,
    pub body: Bytes,
    pub allow: Bytes,
    pub location: Bytes,
    pub set_cookie: Bytes,
}

// Prepared is not a successful write. Shell must rehash under its lock and
// compare expected_ledger, then atomically install exactly candidate bytes.
pub ghost enum PostOutcome {
    Read,
    Refused(Response),
    Prepared { candidate: Bytes, expected_ledger: Bytes, response: Response },
}

pub open spec fn comment_safe(d: Bytes) -> Bytes {
    chars(d).map_values(
        |c: char|
            {
                let n = c as int;
                if (48 <= n <= 57) || (65 <= n <= 90) || (97 <= n <= 122) || n == 32 || n == 58 || n
                    == 95 || n == 46 {
                    n as u8
                } else {
                    95u8
                }
            },
    )
}

pub open spec fn error_page(status: nat, title: Bytes, body: Html) -> Response {
    Response {
        status,
        body: render_page(
            frame(
                title,
                fixed_bytes(cnl_ckc_reviewer()),
                lines(seq![fixed_bytes(h1_open()) + text(title) + fixed_bytes(h1_close()), body]),
            ),
        ),
        allow: empty(),
        location: empty(),
        set_cookie: empty(),
    }
}

pub open spec fn annotated_body(copy: Bytes, detail: Bytes) -> Html {
    fixed_bytes(p_open()) + text(copy) + fixed_bytes(p_close_sp()) + seq![Piece::Comment(detail)]
        + fixed_bytes(sp_copy())
}

pub open spec fn refusal(status: nat, title: Bytes, detail: Bytes, copy: Bytes) -> PostOutcome {
    PostOutcome::Refused(error_page(status, title, annotated_body(copy, detail)))
}

pub open spec fn refused_copy() -> Bytes {
    the_request_was_refused_open_the_cap()
}

pub open spec fn invalid_form_copy() -> Bytes {
    the_submitted_form_was_not_valid_cap()
}

pub open spec fn forbidden(detail: Bytes) -> PostOutcome {
    refusal(403, forbidden_cap(), detail, refused_copy())
}

pub open spec fn bad_form(detail: Bytes) -> PostOutcome {
    refusal(400, bad_request_cap(), detail, invalid_form_copy())
}

pub open spec fn server_error(detail: Bytes) -> PostOutcome {
    refusal(500, server_error_cap(), detail, the_server_could_not_complete_the_cap())
}

pub open spec fn ledger_changed() -> PostOutcome {
    refusal(
        409,
        conflict_cap(),
        ui_verdict_ledger_changed(),
        another_decision_was_recorded_for_this_cap(),
    )
}

pub open spec fn doc_route(path: Bytes) -> Option<(Bytes, Bytes)> {
    if !check::starts(path, g_2()) {
        Option::None
    } else {
        let xs = check::split_on(path.skip(3), 47);
        if xs.len() == 3 && xs[0].len() > 0 && xs[1] == doc_2() && check::ends(xs[2], html_ext())
            && xs[2].len() > 5 {
            Option::Some((xs[0], xs[2].take(xs[2].len() - 5)))
        } else {
            Option::None
        }
    }
}

pub open spec fn method_response(shaped: bool) -> PostOutcome {
    let r = error_page(
        405,
        method_not_allowed_cap(),
        if shaped {
            fixed_bytes(p_open_only_get_and_post_are())
        } else {
            fixed_bytes(p_open_only_get_is_supported_on())
        },
    );
    PostOutcome::Refused(
        Response {
            allow: if shaped {
                get_post_cap()
            } else {
                get_cap()
            },
            ..r
        },
    )
}

pub open spec fn not_found() -> PostOutcome {
    PostOutcome::Refused(
        error_page(404, not_found_cap(), fixed_bytes(p_open_the_requested_page_does_not())),
    )
}

pub open spec fn hex_value(b: u8) -> int {
    if 48 <= b <= 57 {
        b as int - 48
    } else if 65 <= b <= 70 {
        b as int - 65 + 10
    } else if 97 <= b <= 102 {
        b as int - 97 + 10
    } else {
        -1
    }
}

pub open spec fn form_unquote(b: Bytes) -> Bytes
    decreases b.len(),
{
    if b.len() == 0 {
        empty()
    } else if b[0] == 43 {
        seq![32u8] + form_unquote(b.drop_first())
    } else if b.len() >= 3 && b[0] == 37 && hex_value(b[1]) >= 0 && hex_value(b[2]) >= 0 {
        seq![(16 * hex_value(b[1]) + hex_value(b[2])) as u8] + form_unquote(b.skip(3))
    } else {
        seq![b[0]] + form_unquote(b.drop_first())
    }
}

pub open spec fn form_pairs(xs: Seq<Bytes>) -> Result<Seq<(Bytes, Bytes)>, Bytes>
    decreases xs.len(),
{
    if xs.len() == 0 {
        Result::Ok(Seq::empty())
    } else {
        let raw = xs[0];
        let n = check::first_sub(raw, copy_3(), 0);
        if n >= raw.len() {
            Result::Err(ui_verdict_body_not_parseable())
        } else {
            let k = form_unquote(raw.take(n as int));
            let v = form_unquote(raw.skip(n as int + 1));
            if !valid_utf8(k) || !valid_utf8(v) {
                Result::Err(ui_verdict_body_not_parseable())
            } else {
                match form_pairs(xs.drop_first()) {
                    Result::Err(e) => Result::Err(e),
                    Result::Ok(ps) => Result::Ok(seq![(k, v)] + ps),
                }
            }
        }
    }
}

pub open spec fn field_names() -> Seq<Bytes> {
    seq![
        verdict_2(),
        reviewer_2(),
        comment_2(),
        review_sha256_2(),
        ledger_sha256_2(),
        csrf_2(),
        commit_2(),
    ]
}

pub open spec fn field_values(ps: Seq<(Bytes, Bytes)>, key: Bytes) -> Seq<Bytes> {
    ps.filter(|p: (Bytes, Bytes)| p.0 == key).map_values(|p: (Bytes, Bytes)| p.1)
}

pub open spec fn parse_fields(ps: Seq<(Bytes, Bytes)>) -> Result<Fields, Bytes> {
    let ns = field_names();
    let missing = ns.filter(|n: Bytes| field_values(ps, n).len() == 0);
    let duplicate = ns.filter(|n: Bytes| field_values(ps, n).len() > 1);
    let unknown = ps.filter(|p: (Bytes, Bytes)| !ns.contains(p.0));
    if missing.len() > 0 {
        Result::Err(ui_verdict_missing_field_sp() + missing[0])
    } else if duplicate.len() > 0 {
        Result::Err(ui_verdict_duplicate_field_sp() + duplicate[0])
    } else if unknown.len() > 0 {
        Result::Err(ui_verdict_unknown_field_sp() + unknown[0].0)
    } else {
        let f = Fields {
            verdict: at(field_values(ps, verdict_2()), 0),
            reviewer: at(field_values(ps, reviewer_2()), 0),
            comment: at(field_values(ps, comment_2()), 0),
            review: at(field_values(ps, review_sha256_2()), 0),
            ledger: at(field_values(ps, ledger_sha256_2()), 0),
            csrf: at(field_values(ps, csrf_2()), 0),
            commit: at(field_values(ps, commit_2()), 0),
        };
        if f.verdict != approved_2() && f.verdict != rejected_2() {
            Result::Err(ui_verdict_invalid_verdict())
        } else if f.reviewer.len() == 0 || !check::text_clean(f.reviewer) {
            Result::Err(ui_verdict_invalid_reviewer())
        } else if !check::text_clean(f.comment) {
            Result::Err(ui_verdict_invalid_comment())
        } else if !hex64(f.review) {
            Result::Err(ui_verdict_invalid_review_sha256())
        } else if f.ledger != absent_2() && !hex64(f.ledger) {
            Result::Err(ui_verdict_invalid_ledger_sha256())
        } else if f.commit.len() > 0 && !hex40(f.commit) {
            Result::Err(ui_verdict_invalid_commit())
        } else {
            Result::Ok(f)
        }
    }
}

pub open spec fn parse_form(body: Bytes) -> Result<Fields, Bytes> {
    if !valid_utf8(body) {
        Result::Err(ui_verdict_body_not_decodable())
    } else {
        let xs = if body.len() == 0 {
            Seq::empty()
        } else {
            check::split_on(body, 38)
        };
        if xs.len() > 32 {
            Result::Err(ui_verdict_body_not_parseable())
        } else {
            match form_pairs(xs) {
                Result::Err(e) => Result::Err(e),
                Result::Ok(ps) => parse_fields(ps),
            }
        }
    }
}

// The shell reads the posted commit through the verified parser alone.
pub open spec fn posted_commit(body: Bytes) -> Option<Bytes> {
    match parse_form(body) {
        Result::Ok(f) => Option::Some(f.commit),
        Result::Err(_) => Option::None,
    }
}

pub open spec fn record_line(r: Record) -> Bytes {
    let d = r.decision;
    join(
        seq![
            d.docid,
            d.digest,
            d.commit,
            if d.approved {
                approved_2()
            } else {
                rejected_2()
            },
            r.reviewer,
            d.date,
            r.comment,
        ],
        copy_4(),
    )
}

pub open spec fn insert_position(rows: Seq<Bytes>, key: Bytes, i: nat, last: nat) -> nat
    decreases rows.len() - i,
{
    if i >= rows.len() {
        last
    } else {
        let f = check::tab_fields(rows[i as int]);
        let oldkey = at(f, 0) + copy_4() + at(f, 5);
        insert_position(
            rows,
            key,
            i + 1,
            if !bytes_lt(key, oldkey) {
                i + 1
            } else {
                last
            },
        )
    }
}

pub open spec fn ledger_candidate(old: Bytes, decision: Record) -> Bytes {
    let rows = raw_rows(old);
    let pos = insert_position(
        rows,
        decision.decision.docid + copy_4() + decision.decision.date,
        0,
        0,
    );
    let i = if pos <= rows.len() {
        pos as int
    } else {
        rows.len() as int
    };
    check::ledger_header() + join(
        rows.take(i) + seq![record_line(decision)] + rows.skip(i),
        newline(),
    ) + newline()
}

pub open spec fn last_review(bs: Seq<Bundle>, id: Bytes, acc: Bytes) -> Bytes
    decreases bs.len(),
{
    if bs.len() == 0 {
        acc
    } else {
        last_review(
            bs.drop_first(),
            id,
            if bs[0].docid == id {
                bs[0].review
            } else {
                acc
            },
        )
    }
}

pub open spec fn find_guideline(gs: Seq<PostGuideline>, gid: Bytes) -> Option<PostGuideline>
    decreases gs.len(),
{
    if gs.len() == 0 {
        Option::None
    } else if gs[0].gid == gid {
        Option::Some(gs[0])
    } else {
        find_guideline(gs.drop_first(), gid)
    }
}

pub open spec fn find_document(ds: Seq<PostDocument>, id: Bytes) -> Option<PostDocument>
    decreases ds.len(),
{
    if ds.len() == 0 {
        Option::None
    } else if ds[0].docid == id {
        Option::Some(ds[0])
    } else {
        find_document(ds.drop_first(), id)
    }
}

pub open spec fn prepare_candidate(
    g: PostGuideline,
    d: PostDocument,
    f: Fields,
    snapshot: Bytes,
    now: Bytes,
) -> PostOutcome {
    let fresh = match g.fresh {
        Result::Ok(bs) => last_review(bs, d.docid, empty()),
        Result::Err(_) => empty(),
    };
    match g.fresh {
        Result::Err(e) => server_error(ui_verdict_manifest_derivation_failed() + e),
        Result::Ok(_) => if fresh.len() == 0 {
            server_error(ui_verdict_manifest_derivation_failed_docid())
        } else if f.review != fresh {
            refusal(
                409,
                conflict_cap(),
                ui_verdict_subject_changed(),
                the_document_or_its_source_changed_cap(),
            )
        } else if f.ledger != g.ledger_digest {
            ledger_changed()
        } else if !((snapshot.len() == 0 && f.commit.len() == 0) || d.at_commit == Option::Some(
            (f.commit, f.review),
        )) {
            refusal(
                409,
                conflict_cap(),
                ui_verdict_commit_does_not_hold(),
                the_document_or_its_source_changed_cap(),
            )
        } else {
            let r = Record {
                decision: Decision {
                    docid: d.docid,
                    digest: f.review,
                    commit: f.commit,
                    approved: f.verdict == approved_2(),
                    date: now,
                },
                reviewer: f.reviewer,
                comment: f.comment,
            };
            let candidate = ledger_candidate(ledger_data(g.ledger), r);
            let checked = check::ledger(
                Src::Bytes(candidate),
                g.documents.map_values(|x: PostDocument| x.docid),
            );
            match checked.1 {
                Option::Some(v) => server_error(
                    ui_adjudication_ledger_invalid() + check::strip_ws(check::render(v).1),
                ),
                Option::None => {
                    let response = error_page(
                        303,
                        decision_recorded_cap(),
                        fixed_bytes(p_open_the_decision_was_recorded_p_close()),
                    );
                    PostOutcome::Prepared {
                        candidate,
                        expected_ledger: g.ledger_digest,
                        response: Response {
                            location: g_2() + url_seg(g.gid) + doc_3() + url_seg(d.docid)
                                + html_ext(),
                            ..response
                        },
                    }
                },
            }
        },
    }
}

pub open spec fn handle_post(
    req: Request,
    s: PostState,
    g: PostGuideline,
    d: PostDocument,
) -> PostOutcome {
    let expected = http_127_0_0_1() + check::nat_bytes(s.port);
    if req.origin.is_some() && req.origin != Option::Some(expected) {
        forbidden(ui_verdict_origin_not_allowed())
    } else if req.content_type != application_x_www_form_urlencoded() {
        bad_form(ui_verdict_unsupported_content_type())
    } else {
        match req.body {
            Option::None => bad_form(ui_verdict_missing_body()),
            Option::Some(b) => match parse_form(b) {
                Result::Err(e) => bad_form(e),
                Result::Ok(f) => if s.token.len() == 0 || f.csrf != s.token {
                    forbidden(ui_verdict_invalid_csrf_token())
                } else {
                    match d.render_error {
                        Option::Some(e) => server_error(e),
                        Option::None => prepare_candidate(g, d, f, s.commit, s.now),
                    }
                },
            },
        }
    }
}

// --- Session (contract sec7). The browser receives the launch secret from
// `ckc ui serve` itself: a private file redirects to `/session/<secret>`, which
// sets the cookie. Lax: that first navigation arrives cross-site (from a file),
// and Strict would withhold the cookie on its redirect.
pub open spec fn session_cookie(port: nat, session: Bytes) -> Bytes {
    ckc_session_dash() + check::nat_bytes(port) + copy_3() + session
}

pub open spec fn cookie_pair(p: Bytes) -> Bytes
    decreases p.len(),
{
    if p.len() > 0 && p[0] == 32 {
        cookie_pair(p.drop_first())
    } else {
        p
    }
}

pub open spec fn has_cookie(cookie: Option<Bytes>, want: Bytes) -> bool {
    match cookie {
        Option::None => false,
        Option::Some(c) => check::split_on(c, 59).map_values(|p: Bytes| cookie_pair(p)).contains(
            want,
        ),
    }
}

pub open spec fn signin_response(port: nat, session: Bytes) -> Response {
    Response {
        location: slash(),
        set_cookie: session_cookie(port, session) + cookie_attributes(),
        ..error_page(303, cnl_ckc_reviewer(), fixed_bytes(p_open_opening_the_review_site_p_close()))
    }
}

pub open spec fn session_refusal() -> PostOutcome {
    refusal(
        403,
        open_the_review_site_from_ckc_cap(),
        ui_request_no_review_session(),
        this_browser_has_not_opened_the_cap(),
    )
}

// The guards over the request line, headers and launch values alone, read
// before anything else: the shell answers them before any snapshot work.
pub open spec fn gate(req: Request, port: nat, session: Bytes) -> Option<PostOutcome> {
    let route = doc_route(req.path);
    if req.host != copy_127_0_0_1() + check::nat_bytes(port) {
        Option::Some(forbidden(ui_request_host_not_allowed()))
    } else if session.len() > 0 && req.method == get_cap() && req.path == session_path() + session {
        Option::Some(PostOutcome::Refused(signin_response(port, session)))
    } else if req.method != get_cap() && (req.method != post_cap() || route.is_none()) {
        Option::Some(method_response(route.is_some()))
    } else if session.len() > 0 && !has_cookie(req.cookie, session_cookie(port, session)) {
        Option::Some(session_refusal())
    } else {
        Option::None
    }
}

pub open spec fn post_outcome(req: Request, s: PostState) -> PostOutcome {
    let route = doc_route(req.path);
    match gate(req, s.port, s.session) {
        Option::Some(o) => o,
        Option::None => match s.models {
            Result::Err(e) => server_error(e),
            Result::Ok(gs) => if req.method == get_cap() {
                PostOutcome::Read
            } else {
                match route {
                    Option::None => not_found(),
                    Option::Some((gid, id)) => match find_guideline(gs, gid) {
                        Option::None => not_found(),
                        Option::Some(g) => match find_document(g.documents, id) {
                            Option::None => not_found(),
                            Option::Some(d) => handle_post(req, s, g, d),
                        },
                    },
                }
            },
        },
    }
}

// The redirect page `ckc ui serve` writes for the browser to open from disk.
pub open spec fn signin_page(port: nat, session: Bytes) -> Html {
    lines(
        seq![
            fixed_bytes(doctype_html()),
            fixed_bytes(html_open()),
            fixed_bytes(head_open()),
            fixed_bytes(meta_open()),
            fixed_bytes(meta_http_equiv_refresh_open()) + fixed_bytes(http_127_0_0_1()) + number(
                port,
            ) + fixed_bytes(session_path()) + attr(session) + fixed_bytes(attr_end()),
            fixed_bytes(title_open()) + fixed_bytes(cnl_ckc_reviewer()) + fixed_bytes(
                title_close(),
            ),
            fixed_bytes(head_close()),
            fixed_bytes(body_open()),
            fixed_bytes(p_open_opening_the_review_site_p_close()),
            fixed_bytes(body_close()),
            fixed_bytes(html_close()),
        ],
    ) + fixed_bytes(newline())
}

// --- Executable mirrors: kernel entry points bind through View. ---
pub enum EPiece {
    Fixed(Vec<u8>),
    Text(Vec<u8>),
    Attr(Vec<u8>),
    Decimal(u64),
    Comment(Vec<u8>),
}

impl View for EPiece {
    type V = Piece;

    open spec fn view(&self) -> Piece {
        match self {
            EPiece::Fixed(b) => Piece::Fixed(b@),
            EPiece::Text(b) => Piece::Text(b@),
            EPiece::Attr(b) => Piece::Attr(b@),
            EPiece::Decimal(n) => Piece::Decimal(*n as nat),
            EPiece::Comment(b) => Piece::Comment(b@),
        }
    }
}

pub struct EPage {
    pub parts: Vec<EPiece>,
}

impl View for EPage {
    type V = Html;

    open spec fn view(&self) -> Html {
        self.parts@.map_values(|p: EPiece| p@)
    }
}

pub struct ERequest {
    pub method: Vec<u8>,
    pub path: Vec<u8>,
    pub host: Vec<u8>,
    pub origin: Option<Vec<u8>>,
    pub content_type: Vec<u8>,
    pub cookie: Option<Vec<u8>>,
    pub body: Option<Vec<u8>>,
}

impl View for ERequest {
    type V = Request;

    open spec fn view(&self) -> Request {
        Request {
            method: self.method@,
            path: self.path@,
            host: self.host@,
            origin: match self.origin {
                Some(b) => Some(b@),
                None => None,
            },
            content_type: self.content_type@,
            cookie: match self.cookie {
                Some(b) => Some(b@),
                None => None,
            },
            body: match self.body {
                Some(b) => Some(b@),
                None => None,
            },
        }
    }
}

pub struct ERecord {
    pub docid: Vec<u8>,
    pub digest: Vec<u8>,
    pub commit: Vec<u8>,
    pub approved: bool,
    pub reviewer: Vec<u8>,
    pub date: Vec<u8>,
    pub comment: Vec<u8>,
}

impl View for ERecord {
    type V = Record;

    open spec fn view(&self) -> Record {
        Record {
            decision: Decision {
                docid: self.docid@,
                digest: self.digest@,
                commit: self.commit@,
                approved: self.approved,
                date: self.date@,
            },
            reviewer: self.reviewer@,
            comment: self.comment@,
        }
    }
}

pub struct EPostDocument {
    pub docid: Vec<u8>,
    pub render_error: Option<Vec<u8>>,
    pub at_commit: Option<(Vec<u8>, Vec<u8>)>,
}

impl View for EPostDocument {
    type V = PostDocument;

    open spec fn view(&self) -> PostDocument {
        PostDocument {
            docid: self.docid@,
            render_error: match self.render_error {
                Some(b) => Some(b@),
                None => None,
            },
            at_commit: match self.at_commit {
                Some((c, r)) => Some((c@, r@)),
                None => None,
            },
        }
    }
}

pub struct EPostGuideline {
    pub gid: Vec<u8>,
    pub documents: Vec<EPostDocument>,
    pub fresh: Result<Vec<check::EBundle>, Vec<u8>>,
    pub ledger: crate::replay::ESrc,
    pub ledger_digest: Vec<u8>,
}

impl View for EPostGuideline {
    type V = PostGuideline;

    open spec fn view(&self) -> PostGuideline {
        PostGuideline {
            gid: self.gid@,
            documents: self.documents@.map_values(|d: EPostDocument| d@),
            fresh: match self.fresh {
                Ok(bs) => Ok(bs@.map_values(|b: check::EBundle| b@)),
                Err(e) => Err(e@),
            },
            ledger: self.ledger@,
            ledger_digest: self.ledger_digest@,
        }
    }
}

pub struct EPostState {
    pub port: u16,
    pub token: Vec<u8>,
    pub session: Vec<u8>,
    pub models: Result<Vec<EPostGuideline>, Vec<u8>>,
    pub now: Vec<u8>,
    pub commit: Vec<u8>,
}

impl View for EPostState {
    type V = PostState;

    open spec fn view(&self) -> PostState {
        PostState {
            port: self.port as nat,
            token: self.token@,
            session: self.session@,
            models: match self.models {
                Ok(gs) => Ok(gs@.map_values(|g: EPostGuideline| g@)),
                Err(e) => Err(e@),
            },
            now: self.now@,
            commit: self.commit@,
        }
    }
}

pub struct EResponse {
    pub status: u16,
    pub body: Vec<u8>,
    pub allow: Vec<u8>,
    pub location: Vec<u8>,
    pub set_cookie: Vec<u8>,
}

impl View for EResponse {
    type V = Response;

    open spec fn view(&self) -> Response {
        Response {
            status: self.status as nat,
            body: self.body@,
            allow: self.allow@,
            location: self.location@,
            set_cookie: self.set_cookie@,
        }
    }
}

pub enum EPostOutcome {
    Read,
    Refused(EResponse),
    Prepared { candidate: Vec<u8>, expected_ledger: Vec<u8>, response: EResponse },
}

impl View for EPostOutcome {
    type V = PostOutcome;

    open spec fn view(&self) -> PostOutcome {
        match self {
            EPostOutcome::Read => PostOutcome::Read,
            EPostOutcome::Refused(r) => PostOutcome::Refused(r@),
            EPostOutcome::Prepared {
                candidate,
                expected_ledger,
                response,
            } => PostOutcome::Prepared {
                candidate: candidate@,
                expected_ledger: expected_ledger@,
                response: response@,
            },
        }
    }
}

// --- Fidelity predicates over typed slots, whose serialization is render_page.
// Provenance is byte provenance, not NL-to-ACE fidelity. Exact renderer equality
// owns transformations; this predicate additionally limits each visible slot to
// copied corpus spans, declared copy, and canonical decimal sequences.
pub open spec fn corpus_bytes(c: Corpus) -> Seq<Bytes> {
    c.guidelines.map_values(
        |g: Guideline|
            seq![g.gid, ledger_data(g.ledger)] + (match g.readme {
                Some(b) => seq![b],
                None => Seq::empty(),
            }) + g.coverage.rows.map_values(|r: Row| seq![r.id, r.line]).flatten()
                + g.coverage.evidence.map_values(
                |e: check::Evidence|
                    e.ordinal + e.payloads.map_values(|p: (Bytes, Seq<Bytes>)| p.1).flatten(),
            ).flatten() + g.documents.map_values(
                |d: Document| seq![d.bundle.docid, d.ace, d.pl],
            ).flatten() + (match g.vocabulary {
                Some(b) => seq![b],
                None => Seq::empty(),
            }),
    ).flatten()
}

pub open spec fn copied_span(s: Bytes, inputs: Seq<Bytes>) -> bool {
    exists|i: int|
        0 <= i < inputs.len() && check::first_sub(#[trigger] inputs[i], s, 0) + s.len()
            <= inputs[i].len()
}

pub open spec fn copy_derived(s: Bytes, inputs: Seq<Bytes>, registry: Seq<Bytes>) -> bool
    decreases s.len(),
{
    s.len() == 0 || exists|k: int|
        0 < k <= s.len() && (copied_span(#[trigger] s.take(k), inputs) || registry.contains(
            s.take(k),
        ) || (digits(s.take(k)) && (k == 1 || s[0] != 48))) && copy_derived(
            s.skip(k),
            inputs,
            registry,
        )
}

pub open spec fn visible_bytes_from(page: Html, corpus: Corpus, registry: Seq<Bytes>) -> bool {
    forall|i: int|
        0 <= i < page.len() ==> match #[trigger] page[i] {
            Piece::Fixed(b) => registry.contains(b),
            Piece::Text(b) => copy_derived(b, corpus_bytes(corpus), registry),
            Piece::Decimal(_) => true,
            Piece::Attr(_) => true,
            Piece::Comment(_) => true,
        }
}

pub open spec fn well_escaped(page: Html) -> bool {
    escaped_slots(page, 0)
}

} // verus!
// One definition per fixed page string: each entry becomes a named spec fn,
// and `copy_registry()` lists the entries in table order.
macro_rules! copy_table {
    ($($name:ident $(= $text:literal)?;)*) => {
        verus! {
            $( $( pub open spec fn $name() -> Bytes { lit($text@) } )? )*

            // --- Declared static copy/chrome: each literal that reaches a page. ---
            pub open spec fn copy_registry() -> Seq<Bytes> {
                seq![$($name()),*]
            }
        }
    };
}

copy_table! {
    amp_2 = "&amp;";
    lt_2 = "&lt;";
    gt_2 = "&gt;";
    quot_2 = "&quot;";
    apos = "&#x27;";
    newline = "\n";
    td_open = "<td>";
    td_close = "</td>";
    tr_open = "<tr>";
    tr_close = "</tr>";
    a_href_open = "<a href=\"";
    attr_end = "\">";
    a_close = "</a>";
    approved_2 = "approved";
    rejected_2 = "rejected";
    contested_2 = "contested";
    stale_2 = "stale";
    unreviewed_2 = "unreviewed";
    approved_cap = "Approved";
    rejected_cap = "Rejected";
    contested_cap = "Contested";
    outdated_cap = "Outdated";
    unreviewed_cap = "Unreviewed";
    span_class_chip_chip = "<span class=\"chip chip-";
    span_close = "</span>";
    hash_space = "# ";
    rec_cap = "Rec";
    recommendation_cap_sp = "Recommendation ";
    box_cap = "BOX";
    gt_sep = " > ";
    page_prefix = "p";
    page_sp = ", page ";
    passage_sp = ", passage ";
    paren_open_sep = " (";
    paren_close = ")";
    zulu = "Z";
    space_2 = " ";
    utc_suffix = " UTC";
    css_text;
    script_html;
    doctype_html = "<!doctype html>";
    html_open = "<html lang=\"en\">";
    head_open = "<head>";
    meta_open = "<meta charset=\"utf-8\">";
    title_open = "<title>";
    title_close = "</title>";
    style_open = "<style>";
    style_close = "</style>";
    head_close = "</head>";
    body_open = "<body>";
    a_open_skip_to_content_a_close = "<a class=\"skip\" href=\"#main\">Skip to content</a>";
    nav_open = "<nav class=\"crumbs\">";
    nav_close = "</nav>";
    main_open = "<main id=\"main\">";
    main_close = "</main>";
    footer_open_p_open_this_page_reports_what = "<footer class=\"scope\"><p>This page reports what the loaded guideline documents state. It does not give clinical advice.</p></footer>";
    body_close = "</body>";
    html_close = "</html>";
    sp_approved = " approved";
    sp_rejected = " rejected";
    sp_earlier = " earlier";
    none_cap = "None";
    comma_sep = ", ";
    decisions_on_this_version_cap = "Decisions on this version: ";
    sp_and_sp = " and ";
    period = ".";
    no_decision_is_recorded_on_this_cap = "No decision is recorded on this version.";
    no_decision_is_recorded_cap = "No decision is recorded.";
    sp_decisions_on_earlier_versions_cap = " Decisions on earlier versions: ";
    no_decisions_are_recorded_for_the_cap_sp = "No decisions are recorded for the ";
    sp_documents_in_this_guideline = " documents in this guideline.";
    reviewers_recorded_cap_sp = "Reviewers recorded ";
    sp_decisions_on_sp = " decisions on ";
    sp_of_sp = " of ";
    sp_documents = " documents.";
    guideline_dir = "g/";
    index_page_path = "/index.html";
    guidelines_cap = "Guidelines";
    cnl_ckc_reviewer = "cnl-ckc reviewer";
    h1_open_guidelines_h1_close = "<h1>Guidelines</h1>";
    section_open = "<section>";
    table_open = "<table>";
    thead_open_tr_open_th_open_guideline_th_close_th_open = "<thead><tr><th>Guideline</th><th>Documents</th><th>Passages</th><th>Approved</th><th>Rejected</th><th>Contested</th><th>Outdated</th><th>Unreviewed</th></tr></thead>";
    tbody_open = "<tbody>";
    tbody_close = "</tbody>";
    table_close = "</table>";
    section_close = "</section>";
    restates_cap_sp = "Restates ";
    restates_2 = "restates(";
    uncovered_2 = "uncovered(";
    colon_sep = ": ";
    not_covered_cap_colon_sp = "Not covered: ";
    pending_cap = "Pending";
    passages_cap = "Passages";
    with_ace_cap = "With ACE";
    document_dir = "doc/";
    html_ext = ".html";
    h1_open = "<h1>";
    h1_close = "</h1>";
    p_open = "<p>";
    sp_a_open_all_decision_records_a_close_p_close = " <a href=\"records.html\">All decision records</a></p>";
    h2_open_status_h2_close = "<h2>Status</h2>";
    table_open_2 = "<table class=\"compact\">";
    thead_open_tr_open_th_open_status_th_close_th_open = "<thead><tr><th>Status</th><th>Count</th></tr></thead>";
    h2_open_documents_h2_close = "<h2>Documents</h2>";
    thead_open_tr_open_th_open_document_th_close_th_open = "<thead><tr><th>Document</th><th>Status</th><th>Decisions</th><th>Passage</th></tr></thead>";
    h2_open_passages_without_ace_h2_close = "<h2>Passages without ACE</h2>";
    thead_open_tr_open_th_open_passage_th_close_th_open = "<thead><tr><th>Passage</th><th>Status</th><th>Section</th></tr></thead>";
    a_open_guidelines_a_close_sp = "<a href=\"../../index.html\">guidelines</a> / ";
    https_github_com_eturkes_cnl_ckc = "https://github.com/eturkes/cnl-ckc/commit/";
    current_cap = "Current";
    earlier_cap = "Earlier";
    not_given_cap = "Not given";
    section_id = "<section id=\"";
    h2_open = "<h2>";
    h2_close = "</h2>";
    table_open_3 = "<table class=\"records\">";
    thead_open_tr_open_th_open_decision_th_close_th_open = "<thead><tr><th>Decision</th><th>Reviewer</th><th>Date</th><th>Version</th><th>Comment</th></tr></thead>";
    sp_the_newest_decision_for_each_document_cap = " The newest decision for each document is first.";
    p_open_open_a_document_and_record = "<p>Open a document and record a decision to start this list.</p>";
    p_open_each_reviewer_name_is_recorded = "<p>Each reviewer name is recorded as entered and is not verified.</p>";
    p_open_each_version_links_to_the = "<p>Each version links to the stored version of the text that the reviewer read.</p>";
    decision_records_cap = "Decision records";
    a_open_guidelines_a_close_a_open = "<a href=\"../../index.html\">guidelines</a> / <a href=\"index.html\">";
    a_close_records = "</a> / records";
    h1_open_decision_records_h1_close = "<h1>Decision records</h1>";
    p_close = "</p>";
    nav_open_a_open_guideline_index_a_close_nav_close = "<nav class=\"docnav\"><a href=\"index.html\">Guideline index</a></nav>";
    span_open = "<span class=\"kw\">";
    mark_class_t = "<mark class=\"t";
    mark_open = "<mark>";
    mark_close = "</mark>";
    datalist_open = "<datalist id=\"reviewer-names\">";
    option_value = "<option value=\"";
    option_close = "\"></option>";
    datalist_close = "</datalist>";
    pdf_ext = ".pdf";
    sp_a_class_source_href_source = " <a class=\"source\" href=\"../source/";
    pdf_a_close_cap = "\">PDF</a>";
    source_dir = "source/";
    source_2 = "../source/";
    source_text_cap = "Source text";
    records_html_2 = "../records.html";
    copy_2 = "#";
    previous_document_cap = "Previous document";
    a_open_guideline_index_a_close = "<a href=\"../index.html\">Guideline index</a>";
    next_document_cap = "Next document";
    all_decision_records_cap = "All decision records";
    section_open_2 = "<section class=\"stale\">";
    p_open_the_document_or_its_source = "<p>The document or its source changed after the last decision. No recorded decision applies to the version shown here.</p>";
    p_open_label_open_input_open_highlighting_label_close_try = "<p class=\"hl-note\"><label><input type=\"checkbox\" class=\"hl-toggle\" checked> Highlighting</label> Try hovering and clicking on highlighted terms for different levels of emphasis.</p>";
    h3_open_original_passage_h3_close = "<h3>Original passage</h3>";
    pre_open = "<pre class=\"prose\">";
    pre_close = "</pre>";
    h3_open_attempto_controlled_english_ace_h3_close = "<h3>Attempto Controlled English (ACE)</h3>";
    section_open_3 = "<section class=\"verdict-entry\">";
    h3_open_record_a_decision_h3_close = "<h3>Record a decision</h3>";
    p_open_does_the_ace_representation_appropriately = "<p>Does the ACE representation appropriately reflect the original passage?</p>";
    form_open = "<form method=\"post\">";
    fieldset_open = "<fieldset>";
    legend_open_decision_legend_close = "<legend>Decision</legend>";
    label_open_input_open_approved_label_close = "<label><input type=\"radio\" name=\"verdict\" value=\"approved\" required> Approved</label>";
    label_open_input_open_rejected_label_close = "<label><input type=\"radio\" name=\"verdict\" value=\"rejected\" required> Rejected</label>";
    fieldset_close = "</fieldset>";
    label_open_reviewer_name_label_close = "<label for=\"reviewer\">Reviewer name</label>";
    input_type_text_id_reviewer_name = "<input type=\"text\" id=\"reviewer\" name=\"reviewer\" list=\"reviewer-names\" value=\"";
    required_2 = "\" required>";
    label_open_comment_optional_label_close = "<label for=\"comment\">Comment (optional)</label>";
    textarea_open_textarea_close = "<textarea id=\"comment\" name=\"comment\"></textarea>";
    input_type_hidden_name_review_sha256_value = "<input type=\"hidden\" name=\"review_sha256\" value=\"";
    input_type_hidden_name_ledger_sha256_value = "<input type=\"hidden\" name=\"ledger_sha256\" value=\"";
    input_type_hidden_name_csrf_value = "<input type=\"hidden\" name=\"csrf\" value=\"";
    button_open_record_decision_button_close = "<button>Record decision</button>";
    form_close = "</form>";
    details_open = "<details>";
    summary_open_compiled_prolog = "<summary>Compiled Prolog (";
    sp_lines_summary_close = " lines)</summary>";
    pre_open_2 = "<pre>";
    details_close = "</details>";
    nav_open_2 = "<nav class=\"docnav\">";
    a_open_guidelines_a_close_a_open_2 = "<a href=\"../../../index.html\">guidelines</a> / <a href=\"../index.html\">";
    a_close_sp = "</a> / ";
    a_an_the_every_each_no = "a an the every each no all some any this that these those such is are was were be been being has have had does do did should must may can cannot might will would shall could if then and or nor but not it its itself they them their he she who whom whose which what where when there something somebody someone everything everybody everyone nothing nobody of for with without during to at in on by from as against about after before through under over above below into onto per within between among around near than least most more less fewer greater";
    p_close_sp = "</p>\n<!-- ";
    sp_copy = " -->";
    the_request_was_refused_open_the_cap = "The request was refused. Open the document page again from this site and submit the decision again.";
    the_submitted_form_was_not_valid_cap = "The submitted form was not valid. Go back to the document page, reload it, and submit the decision again.";
    forbidden_cap = "Forbidden";
    bad_request_cap = "Bad request";
    server_error_cap = "Server error";
    the_server_could_not_complete_the_cap = "The server could not complete the request. Reload the page and try again.";
    conflict_cap = "Conflict";
    ui_verdict_ledger_changed = "ui: verdict: ledger changed";
    another_decision_was_recorded_for_this_cap = "Another decision was recorded for this guideline before this one. The decision was not recorded. Open the document page again and check the current state.";
    g_2 = "/g/";
    doc_2 = "doc";
    method_not_allowed_cap = "Method not allowed";
    p_open_only_get_and_post_are = "<p>Only GET and POST are supported on this page.</p>";
    p_open_only_get_is_supported_on = "<p>Only GET is supported on this page.</p>";
    get_post_cap = "GET, POST";
    get_cap = "GET";
    not_found_cap = "Not found";
    p_open_the_requested_page_does_not = "<p>The requested page does not exist.</p>";
    copy_3 = "=";
    ui_verdict_body_not_parseable = "ui: verdict: body not parseable";
    verdict_2 = "verdict";
    reviewer_2 = "reviewer";
    comment_2 = "comment";
    review_sha256_2 = "review_sha256";
    ledger_sha256_2 = "ledger_sha256";
    csrf_2 = "csrf";
    ui_verdict_missing_field_sp = "ui: verdict: missing field ";
    ui_verdict_duplicate_field_sp = "ui: verdict: duplicate field ";
    ui_verdict_unknown_field_sp = "ui: verdict: unknown field ";
    ui_verdict_invalid_verdict = "ui: verdict: invalid verdict";
    ui_verdict_invalid_reviewer = "ui: verdict: invalid reviewer";
    ui_verdict_invalid_comment = "ui: verdict: invalid comment";
    ui_verdict_invalid_review_sha256 = "ui: verdict: invalid review_sha256";
    absent_2 = "absent";
    ui_verdict_invalid_ledger_sha256 = "ui: verdict: invalid ledger_sha256";
    ui_verdict_body_not_decodable = "ui: verdict: body not decodable";
    copy_4 = "\t";
    ui_verdict_manifest_derivation_failed = "ui: verdict: manifest derivation failed: ";
    ui_verdict_manifest_derivation_failed_docid = "ui: verdict: manifest derivation failed: docid row missing";
    ui_verdict_subject_changed = "ui: verdict: subject changed";
    the_document_or_its_source_changed_cap = "The document or its source changed after this page was loaded. The decision was not recorded. Open the document page again and check the current version.";
    ui_adjudication_ledger_invalid = "ui: adjudication ledger invalid: ";
    decision_recorded_cap = "Decision recorded";
    p_open_the_decision_was_recorded_p_close = "<p>The decision was recorded.</p>";
    doc_3 = "/doc/";
    http_127_0_0_1 = "http://127.0.0.1:";
    ui_verdict_origin_not_allowed = "ui: verdict: origin not allowed";
    application_x_www_form_urlencoded = "application/x-www-form-urlencoded";
    ui_verdict_unsupported_content_type = "ui: verdict: unsupported content type";
    ui_verdict_missing_body = "ui: verdict: missing body";
    ui_verdict_invalid_csrf_token = "ui: verdict: invalid csrf token";
    copy_127_0_0_1 = "127.0.0.1:";
    ui_request_host_not_allowed = "ui: request: host not allowed";
    post_cap = "POST";
    input_type_hidden_name_commit_value = "<input type=\"hidden\" name=\"commit\" value=\"";
    commit_2 = "commit";
    ui_verdict_invalid_commit = "ui: verdict: invalid commit";
    ui_verdict_commit_does_not_hold = "ui: verdict: commit does not hold the reviewed bundle";
    not_stated = "not stated";
    meta_viewport = "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
    p_class_provenance_open = "<p class=\"provenance\">";
    span_plain_open = "<span>";
    passage_cap_sp = "Passage ";
    kind_how_often = "How often";
    kind_best_case = "Best case";
    kind_emphasis = "Emphasis";
    kind_manner = "Manner";
    kind_strength_of_wording = "Strength of wording";
    kind_possibility = "Possibility";
    kind_condition_of_use = "Condition of use";
    thead_open_tr_open_th_open_word_th_close_th_open = "<thead><tr><th>Word</th><th>Read as</th></tr></thead>";
    h2_open_word_meanings_h2_close = "<h2>Word meanings</h2>";
    p_open_the_compiler_reads_each_word = "<p>The compiler reads each word in this table as shown, in every document of this guideline. In the ACE text of a document page, select a word with a solid underline to see its reading.</p>";
    sp_have_a_solid_underline_only_in = " have a solid underline only in the sentences that the compiler read as scope exclusions.</p>";
    a_strong_recommendation = "a strong recommendation";
    a_conditional_recommendation = "a conditional recommendation";
    high_certainty_of_the_evidence = "high certainty of the evidence";
    moderate_certainty_of_the_evidence = "moderate certainty of the evidence";
    low_certainty_of_the_evidence = "low certainty of the evidence";
    very_low_certainty_of_the_evidence = "very low certainty of the evidence";
    the_preferred_option = "the preferred option";
    the_alternative_to_the_preferred_option = "the alternative to the preferred option";
    a_qualifier_sep = "a qualifier: ";
    every_recommendation_of_this_guideline = "every recommendation of this guideline";
    the_verb_of_a_scope_exclusion = "the verb of a scope exclusion: when its condition holds, no recommendation of this guideline applies to the patient";
    button_open_rw = "<button type=\"button\" class=\"rw\" aria-pressed=\"false\" data-w=\"";
    button_close = "</button>";
    p_class_reading_open_hint = "<p class=\"reading\" aria-live=\"polite\"><span data-w=\"\">Select a word with a solid underline to see how the compiler reads it.</span>";
    span_data_w = "<span data-w=\"";
    hidden_in_this_guideline_the_compiler_reads = "\" hidden>In this guideline, the compiler reads ";
    sp_as_sp = " as ";
    p_open_the_words_sp = "<p>The words ";
    session_path = "/session/";
    slash = "/";
    ckc_session_dash = "ckc-session-";
    cookie_attributes = "; HttpOnly; SameSite=Lax; Path=/";
    open_the_review_site_from_ckc_cap = "Open the review site from ckc";
    this_browser_has_not_opened_the_cap = "This browser has not opened the review site yet. In the window where ckc ui serve runs, press Enter. The review site opens in this browser.";
    ui_request_no_review_session = "ui: request: no review session";
    p_open_opening_the_review_site_p_close = "<p>Opening the review site.</p>";
    meta_http_equiv_refresh_open = "<meta http-equiv=\"refresh\" content=\"0; url=";
    p_open_your_name_and_comment_are_published = "<p>Your name and comment are published with your decision in the knowledge base and its public repository.</p>";
    section_open_superseded = "<section class=\"superseded\">";
    p_open_on_sp = "<p>On ";
    hyphen = "-";
    sp_superseded_the_guideline_statements = " superseded the guideline statements that this page represents. This page shows the original passage and its ACE representation for review.</p>";
    h2_open_superseded_passages_h2_close = "<h2>Superseded passages</h2>";
    p_open_later_law_regulation_or_guidance = "<p>Later law, regulation or guidance superseded all or part of each passage in this table.</p>";
    thead_open_tr_open_th_open_passage_th_close_th_open_document_superseded = "<thead><tr><th>Passage</th><th>Document</th><th>Superseded by</th><th>Superseded on</th></tr></thead>";
    sp_decision_on_sp = " decision on ";
    sp_document_in_this_guideline = " document in this guideline.";
    sp_document = " document.";
    sp_line_summary_close = " line)</summary>";
}

verus! {

// --- Copy gate: enumerated copy domain (R76).
pub open spec fn ascii_word(c: char) -> bool {
    ('A' <= c <= 'Z') || ('a' <= c <= 'z') || ('0' <= c <= '9') || c == '_'
}

// Python IGNORECASE and lower() coincide for the admitted copy alphabet.
pub open spec fn copy_fold(c: char) -> char {
    if 'A' <= c <= 'Z' {
        (c as u32 + 32) as char
    } else {
        c
    }
}

pub open spec fn copy_match(s: Seq<char>, p: Seq<char>, i: int, words: bool) -> bool {
    0 <= i && i + p.len() <= s.len() && (forall|j: int|
        0 <= j < p.len() ==> copy_fold(#[trigger] s[i + j]) == p[j]) && (!words || ((i == 0
        || !ascii_word(s[i - 1])) && (i + p.len() == s.len() || !ascii_word(
        s[i + p.len() as int],
    ))))
}

pub open spec fn copy_contains(s: Seq<char>, patterns: Seq<Bytes>, words: bool) -> bool {
    exists|i: int, j: int|
        0 <= i < s.len() && 0 <= j < patterns.len() && #[trigger] copy_match(
            s,
            chars(patterns[j]),
            i,
            words,
        )
}

// Emoji retains the legacy first-pass diagnostic, before domain admission.
pub open spec fn emoji(c: char) -> bool {
    let n = c as int;
    126975 < n < 129792 || 9727 < n < 10176 || 11007 < n < 11264 || n == 65039 || n == 8205
}

pub open spec fn css_tokens() -> Seq<Bytes> {
    check::split_on(
        lit(
            "linear-gradient radial-gradient conic-gradient @keyframes animation transition backdrop-filter box-shadow"@,
        ),
        32,
    )
}

pub open spec fn marketing_tokens() -> Seq<Bytes> {
    check::split_on(
        lit(
            "simply seamless seamlessly powerful robust robustly leverage leverages leveraged leveraging effortless effortlessly intuitive streamline streamlined unlock empower empowering cutting-edge state-of-the-art world-class blazing stunning delightful revolutionize game-changing supercharge best-in-class next-generation"@,
        ),
        32,
    )
}

pub open spec fn relative_tokens() -> Seq<Bytes> {
    seq![
        lit("ago"@),
        lit("just now"@),
        lit("yesterday"@),
        lit("tomorrow"@),
        lit("recently"@),
        lit("last week"@),
        lit("last month"@),
        lit("last year"@),
    ]
}

// Format the scalar exactly as Python format(code_point, "04X").
pub open spec fn copy_hex(n: nat) -> Bytes
    decreases n,
{
    if n < 65536 {
        v1text::uhex4(n as int)
    } else {
        copy_hex(n / 16) + seq![v1text::uhex_digit((n % 16) as int)]
    }
}

pub open spec fn copy_admitted(c: char) -> bool {
    let n = c as int;
    n < 128 || n == 0x00A7 || n == 0x00B7 || n == 0x2014 || n == 0x2265
}

pub open spec fn first_copy_char(s: Seq<char>, p: spec_fn(char) -> bool) -> Option<char>
    decreases s.len(),
{
    if s.len() == 0 {
        None
    } else if p(s[0]) {
        Some(s[0])
    } else {
        first_copy_char(s.drop_first(), p)
    }
}

// CSS uses list order, not source position: animation wins over an earlier transition.
pub open spec fn first_css(s: Seq<char>, patterns: Seq<Bytes>) -> Option<Bytes>
    decreases patterns.len(),
{
    if patterns.len() == 0 {
        None
    } else if copy_contains(s, seq![patterns[0]], false) {
        Some(patterns[0])
    } else {
        first_css(s, patterns.drop_first())
    }
}

pub open spec fn word_pattern_at(s: Seq<char>, patterns: Seq<Bytes>, i: nat) -> Option<nat>
    decreases patterns.len(),
{
    if patterns.len() == 0 {
        None
    } else if copy_match(s, chars(patterns[0]), i as int, true) {
        Some(chars(patterns[0]).len())
    } else {
        word_pattern_at(s, patterns.drop_first(), i)
    }
}

// re.search: leftmost source position; alternatives retain registry order.
pub open spec fn first_copy_word(s: Seq<char>, patterns: Seq<Bytes>, i: nat) -> Option<Bytes>
    decreases s.len() - i,
{
    if i >= s.len() {
        None
    } else {
        match word_pattern_at(s, patterns, i) {
            Some(n) => if i + n <= s.len() {
                Some(encode_utf8(s.subrange(i as int, (i + n) as int)))
            } else {
                None
            },
            None => first_copy_word(s, patterns, i + 1),
        }
    }
}

pub open spec fn first_exclamation(s: Seq<char>, i: nat) -> Option<Bytes>
    decreases s.len() - i,
{
    if i + 1 >= s.len() {
        None
    } else if ascii_word(s[i as int]) && s[i as int] != '_' && s[i as int + 1] == '!' {
        Some(encode_utf8(s.subrange(i as int, i as int + 2)))
    } else {
        first_exclamation(s, i + 1)
    }
}

pub open spec fn copy_token_violation(s: Seq<char>) -> Option<Bytes> {
    match first_css(s, css_tokens()) {
        Some(p) => Some(lit("css: "@) + p),
        None => match first_copy_word(s, marketing_tokens(), 0) {
            Some(p) => Some(lit("marketing: "@) + p),
            None => match first_copy_word(s, relative_tokens(), 0) {
                Some(p) => Some(lit("relative-time: "@) + p),
                None => match first_exclamation(s, 0) {
                    Some(p) => Some(lit("exclamatory: "@) + p),
                    None => None,
                },
            },
        },
    }
}

// Decode -> legacy emoji pass -> repertoire -> CSS -> marketing -> relative -> !.
pub open spec fn copy_violation(b: Bytes) -> Option<Bytes> {
    if !valid_utf8(b) {
        Some(lit("domain: invalid UTF-8"@))
    } else {
        let s = chars(b);
        match first_copy_char(s, |c: char| emoji(c)) {
            Some(c) => Some(lit("emoji: U+"@) + copy_hex(c as nat)),
            None => match first_copy_char(s, |c: char| !copy_admitted(c)) {
                Some(c) => Some(lit("domain: U+"@) + copy_hex(c as nat)),
                None => copy_token_violation(s),
            },
        }
    }
}

pub open spec fn copy_literal_ok(b: Bytes) -> bool {
    copy_violation(b).is_none()
}

pub open spec fn copy_ok(registry: Seq<Bytes>) -> bool {
    forall|i: int| 0 <= i < registry.len() ==> copy_literal_ok(#[trigger] registry[i])
}

// Slot types must agree with their actual template context: 0 text, 1 tag,
// 2 double-quoted attribute, 3 single-quoted attribute, 4 comment, 5 style,
// 6 script. The two fixed raw-text elements carry no dynamic slots.
pub open spec fn fixed_context(s: Bytes, context: int) -> int
    decreases s.len(),
{
    if s.len() == 0 {
        context
    } else {
        let (n, next): (int, int) = if context == 0 && check::starts(s, ascii("<style>"@)) {
            (7, 5)
        } else if context == 0 && check::starts(s, ascii("<script>"@)) {
            (8, 6)
        } else if context == 0 && check::starts(s, ascii("<!--"@)) {
            (4, 4)
        } else if context == 4 && check::starts(s, ascii("-->"@)) {
            (3, 0)
        } else if context == 5 && check::starts(s, ascii("</style>"@)) {
            (8, 0)
        } else if context == 6 && check::starts(s, ascii("</script>"@)) {
            (9, 0)
        } else {
            (
                1,
                if context == 0 && s[0] == 60 {
                    1
                } else if context == 1 && s[0] == 34 {
                    2
                } else if context == 1 && s[0] == 39 {
                    3
                } else if context == 1 && s[0] == 62 {
                    0
                } else if (context == 2 && s[0] == 34) || (context == 3 && s[0] == 39) {
                    1
                } else {
                    context
                },
            )
        };
        if 0 < n <= s.len() {
            fixed_context(s.skip(n), next)
        } else {
            -1
        }
    }
}

pub open spec fn escaped_slots(page: Html, context: int) -> bool
    decreases page.len(),
{
    if page.len() == 0 {
        context == 0
    } else {
        match page[0] {
            Piece::Fixed(b) => copy_registry().contains(b) && escaped_slots(
                page.drop_first(),
                fixed_context(b, context),
            ),
            Piece::Text(b) => context == 0 && escaped(escape_text(b), false) && escaped_slots(
                page.drop_first(),
                context,
            ),
            Piece::Attr(b) => (context == 2 || context == 3) && escaped(escape_attr(b), true)
                && escaped_slots(page.drop_first(), context),
            Piece::Decimal(n) => (context == 0 || context == 2 || context == 3) && digits(
                check::nat_bytes(n),
            ) && escaped_slots(page.drop_first(), context),
            Piece::Comment(b) => context == 4 && v1text::all_in(
                comment_safe(b),
                |x: u8| is_alnum_b(x) || x == 32 || x == 58 || x == 46,
            ) && escaped_slots(page.drop_first(), context),
        }
    }
}

// Runtime page inputs are check.rs's K4 exec mirrors (R92), not parallel laws.
pub struct EDocument {
    pub bundle: check::EBundle,
    pub ace: Vec<u8>,
    pub pl: Vec<u8>,
    pub alignment: Option<Vec<u8>>,
}

impl View for EDocument {
    type V = Document;

    open spec fn view(&self) -> Document {
        Document {
            bundle: self.bundle@,
            ace: self.ace@,
            pl: self.pl@,
            alignment: match self.alignment {
                Some(x) => Some(x@),
                None => None,
            },
        }
    }
}

pub struct EGuideline {
    pub gid: Vec<u8>,
    pub readme: Option<Vec<u8>>,
    pub coverage: ECoverage,
    pub documents: Vec<EDocument>,
    pub ledger: crate::replay::ESrc,
    pub ledger_digest: Vec<u8>,
    pub source_names: Vec<Vec<u8>>,
    pub vocabulary: Option<Vec<u8>>,
}

impl View for EGuideline {
    type V = Guideline;

    open spec fn view(&self) -> Guideline {
        Guideline {
            gid: self.gid@,
            readme: match self.readme {
                Some(x) => Some(x@),
                None => None,
            },
            coverage: self.coverage@,
            documents: self.documents@.map_values(|d: EDocument| d@),
            ledger: self.ledger@,
            ledger_digest: self.ledger_digest@,
            source_names: self.source_names@.map_values(|x: Vec<u8>| x@),
            vocabulary: match self.vocabulary {
                Some(x) => Some(x@),
                None => None,
            },
        }
    }
}

pub struct ECorpus {
    pub guidelines: Vec<EGuideline>,
    pub token: Vec<u8>,
}

impl View for ECorpus {
    type V = Corpus;

    open spec fn view(&self) -> Corpus {
        Corpus { guidelines: self.guidelines@.map_values(|g: EGuideline| g@), token: self.token@ }
    }
}

} // verus!
