use crate::engine::*;
use crate::replay::*;
use crate::v1text::*;
use vstd::prelude::*;

verus! {

// Trusted spec: the K4 custody core of `ckc check` (contract m5u3; every
// meter and violation detail byte-exact, R44). Kernel tier = what a clinician's
// recorded verdict binds to: the coverage ledger's closure over the
// evidence files, the per-document review bundle (ACE bytes, coverage row,
// selected source payload, retained clause lines) and its digest, the
// review manifest's self-consistency, the adjudication ledger's grammar +
// verdict classification, and the lexicon liveness/minimality gates.
// Everything else in `check` (inventories, fork notices, compendium,
// subprocess orchestration) = shell tier, fixture-gated (R45–R47).
// Text arrives as bytes; UTF-8 validity = the shell boundary; the shell
// hashes (R3) and hands lowercase-hex digests to `bundle`.
// --- outcome: the first violation wins, else a meter ---
pub ghost enum Verdict {
    Ok(Seq<u8>),  // meter line(s), each LF-terminated
    Fail(
        Seq<u8>,
        Seq<u8>,
    ),  // category, detail  → `goal: <category>: <detail>\n` rc1
}

pub open spec fn fail(cat: Seq<char>, detail: Seq<u8>) -> Verdict {
    Verdict::Fail(ascii(cat), detail)
}

// Legacy `violation` escapes the detail: LF → `\n`, CR → `\r` (two bytes each).
pub open spec fn escape_detail(d: Seq<u8>) -> Seq<u8>
    decreases d.len(),
{
    if d.len() == 0 {
        Seq::empty()
    } else {
        (if d[0] == 0x0A {
            seq![0x5Cu8, 0x6Eu8]
        } else if d[0] == 0x0D {
            seq![0x5Cu8, 0x72u8]
        } else {
            seq![d[0]]
        }) + escape_detail(d.drop_first())
    }
}

pub open spec fn render(v: Verdict) -> (int, Seq<u8>) {
    match v {
        Verdict::Ok(m) => (0, m),
        Verdict::Fail(c, d) => (
            1,
            ascii("ckc: "@) + c + ascii(": "@) + escape_detail(d) + seq![0x0Au8],
        ),
    }
}

// --- byte helpers ---
pub open spec fn has_byte(s: Seq<u8>, b: u8) -> bool {
    exists|i: int| 0 <= i < s.len() && s[i] == b
}

pub open spec fn starts(s: Seq<u8>, p: Seq<u8>) -> bool {
    s.len() >= p.len() && s.take(p.len() as int) == p
}

pub open spec fn ends(s: Seq<u8>, p: Seq<u8>) -> bool {
    s.len() >= p.len() && s.skip(s.len() - p.len()) == p
}

pub open spec fn split_on(s: Seq<u8>, b: u8) -> Seq<Seq<u8>>
    decreases s.len(),
{
    if s.len() == 0 {
        seq![Seq::empty()]
    } else {
        let n = first_byte(s, b, 0);
        if n >= s.len() {
            seq![s]
        } else {
            seq![s.take(n as int)] + split_on(s.skip(n as int + 1), b)
        }
    }
}

// Python `text.split("\n")` then drop the final empty piece (a final LF is required first).
pub open spec fn body_lines(s: Seq<u8>) -> Seq<Seq<u8>> {
    split_on(s, 0x0A).drop_last()
}

pub open spec fn tab_fields(row: Seq<u8>) -> Seq<Seq<u8>> {
    split_on(row, 0x09)
}

// Whitespace = Python `str.strip()`/`str.split()` over the UTF-8 text (R61),
// as byte sequences: ASCII 09–0D, 1C–1F, 20; U+0085/U+00A0 (C2 85/A0); U+1680
// (E1 9A 80); U+2000–200A (E2 80 80–8A), U+2028/2029 (E2 80 A8/A9), U+202F
// (E2 80 AF); U+205F (E2 81 9F); U+3000 (E3 80 80). Byte length, 0 = none.
pub open spec fn ws_len(s: Seq<u8>, i: nat) -> nat {
    if i >= s.len() {
        0
    } else if (0x09 <= s[i as int] && s[i as int] <= 0x0D) || (0x1C <= s[i as int] && s[i as int]
        <= 0x20) {
        1
    } else if i + 2 <= s.len() && s[i as int] == 0xC2 && (s[i as int + 1] == 0x85 || s[i as int + 1]
        == 0xA0) {
        2
    } else if i + 3 <= s.len() && s[i as int] == 0xE1 && s[i as int + 1] == 0x9A && s[i as int + 2]
        == 0x80 {
        3
    } else if i + 3 <= s.len() && s[i as int] == 0xE2 && s[i as int + 1] == 0x80 && ((0x80
        <= s[i as int + 2] && s[i as int + 2] <= 0x8A) || s[i as int + 2] == 0xA8 || s[i as int + 2]
        == 0xA9 || s[i as int + 2] == 0xAF) {
        3
    } else if i + 3 <= s.len() && s[i as int] == 0xE2 && s[i as int + 1] == 0x81 && s[i as int + 2]
        == 0x9F {
        3
    } else if i + 3 <= s.len() && s[i as int] == 0xE3 && s[i as int + 1] == 0x80 && s[i as int + 2]
        == 0x80 {
        3
    } else {
        0
    }
}

pub open spec fn lead_ws(s: Seq<u8>, i: nat) -> nat
    decreases s.len() - i,
{
    if i < s.len() && ws_len(s, i) > 0 {
        lead_ws(s, i + ws_len(s, i))
    } else {
        i
    }
}

// End of the last non-whitespace byte scanned so far (`acc`), forward.
pub open spec fn last_end(s: Seq<u8>, i: nat, acc: nat) -> nat
    decreases s.len() - i,
{
    if i >= s.len() {
        acc
    } else if ws_len(s, i) > 0 {
        last_end(s, i + ws_len(s, i), acc)
    } else {
        last_end(s, i + 1, i + 1)
    }
}

pub open spec fn strip_ws(s: Seq<u8>) -> Seq<u8> {
    let l = lead_ws(s, 0);
    let e = last_end(s, 0, 0);
    if l < e {
        s.subrange(l as int, e as int)
    } else {
        Seq::empty()
    }
}

// Whitespace-separated tokens (`str.split()`): `cur` = the token being read.
pub open spec fn tokens_acc(s: Seq<u8>, i: nat, cur: Seq<u8>, acc: Seq<Seq<u8>>) -> Seq<Seq<u8>>
    decreases s.len() - i,
{
    if i >= s.len() {
        if cur.len() > 0 {
            acc.push(cur)
        } else {
            acc
        }
    } else if ws_len(s, i) > 0 {
        tokens_acc(
            s,
            i + ws_len(s, i),
            Seq::empty(),
            if cur.len() > 0 {
                acc.push(cur)
            } else {
                acc
            },
        )
    } else {
        tokens_acc(s, i + 1, cur.push(s[i as int]), acc)
    }
}

pub open spec fn nat_bytes(n: nat) -> Seq<u8> {
    udec_bytes(n)
}

pub open spec fn docid_ok(id: Seq<u8>) -> bool {
    name_ok(id) && id.len() <= 250
}

// --- coverage ledger ---
pub open spec fn coverage_header() -> Seq<u8> {
    ascii(
        "# format: id<TAB>file<TAB>page<TAB>section<TAB>status\n# status: ace(<docid>) | restates(<id>) | uncovered(<class>: <one-clause reason>) | pending\n# uncovered classes: heading | process | external | aim | descriptive | notice | inexpressible\n"@,
    )
}

pub ghost enum Status {
    Pending,
    Ace(Seq<u8>),
    Restates(Seq<u8>),
    Uncovered(Seq<u8>),  // the class
}

pub open spec fn uncovered_class_ok(c: Seq<u8>) -> bool {
    ||| c == ascii("heading"@)
    ||| c == ascii("process"@)
    ||| c == ascii("external"@)
    ||| c == ascii("aim"@)
    ||| c == ascii("descriptive"@)
    ||| c == ascii("notice"@)
    ||| c == ascii("inexpressible"@)
}

pub open spec fn wrapped(s: Seq<u8>, head: Seq<char>) -> Option<Seq<u8>> {
    let h = ascii(head);
    if starts(s, h) && s.len() > h.len() && s.last() == 0x29 {
        Option::Some(s.skip(h.len() as int).drop_last())
    } else {
        Option::None
    }
}

// status grammar; Err carries the exact legacy detail bytes
pub open spec fn status_of(id: Seq<u8>, s: Seq<u8>) -> Result<Status, Seq<u8>> {
    if s == ascii("pending"@) {
        Result::Ok(Status::Pending)
    } else if starts(s, ascii("ace("@)) {
        match wrapped(s, "ace("@) {
            Option::None => Result::Err(ascii("malformed status for "@) + id + ascii(": "@) + s),
            Option::Some(d) => if docid_ok(d) {
                Result::Ok(Status::Ace(d))
            } else {
                Result::Err(ascii("ace names invalid docid for "@) + id + ascii(": "@) + d)
            },
        }
    } else if starts(s, ascii("restates("@)) {
        match wrapped(s, "restates("@) {
            Option::None => Result::Err(ascii("malformed status for "@) + id + ascii(": "@) + s),
            Option::Some(t) => if t.len() == 0 {
                Result::Err(ascii("empty restates target for "@) + id)
            } else {
                Result::Ok(Status::Restates(t))
            },
        }
    } else if starts(s, ascii("uncovered("@)) {
        match wrapped(s, "uncovered("@) {
            Option::None => Result::Err(ascii("malformed status for "@) + id + ascii(": "@) + s),
            Option::Some(inner) => {
                let sep = ascii(": "@);
                let k = first_sub(inner, sep, 0);
                if k >= inner.len() {
                    Result::Err(
                        ascii("uncovered without class and reason for "@) + id + ascii(": "@) + s,
                    )
                } else {
                    let class = inner.take(k as int);
                    let reason = inner.skip(k as int + 2);
                    if !uncovered_class_ok(class) {
                        Result::Err(
                            ascii("unknown uncovered class for "@) + id + ascii(": "@) + class,
                        )
                    } else if reason.len() == 0 {
                        Result::Err(ascii("empty uncovered reason for "@) + id)
                    } else {
                        Result::Ok(Status::Uncovered(class))
                    }
                }
            },
        }
    } else {
        Result::Err(ascii("unknown status for "@) + id + ascii(": "@) + s)
    }
}

// Index of the first occurrence of `p` in `s` at or after `i`, else s.len().
pub open spec fn first_sub(s: Seq<u8>, p: Seq<u8>, i: nat) -> nat
    decreases s.len() + 1 - i,
{
    if i > s.len() || i + p.len() > s.len() {
        s.len()
    } else if s.subrange(i as int, i as int + p.len() as int) == p {
        i
    } else {
        first_sub(s, p, i + 1)
    }
}

pub ghost struct Row {
    pub id: Seq<u8>,
    pub file: Seq<u8>,
    pub status: Status,
    pub line: Seq<u8>,  // the row bytes incl. LF (the coverage_row digest input)
}

// One row's grammar in the legacy order.
pub open spec fn parse_row(line: Seq<u8>, seen: Seq<Row>) -> Result<Row, Seq<u8>> {
    let f = tab_fields(line);
    if f.len() != 5 {
        Result::Err(ascii("row without 5 columns: "@) + line)
    } else {
        let (id, file, page, section, status) = (f[0], f[1], f[2], f[3], f[4]);
        if id.len() == 0 {
            Result::Err(ascii("empty region id: "@) + line)
        } else if has_byte(id, 0x20) {
            Result::Err(ascii("region id holds a space: "@) + id)
        } else if !starts(file, ascii("source/"@)) {
            Result::Err(ascii("file outside source/ for "@) + id + ascii(": "@) + file)
        } else if first_sub(file, ascii(".."@), 0) < file.len() {
            Result::Err(ascii("file path traversal for "@) + id + ascii(": "@) + file)
        } else if page.len() == 0 {
            Result::Err(ascii("empty page for: "@) + id)
        } else if section.len() == 0 {
            Result::Err(ascii("empty section for: "@) + id)
        } else if exists|j: int| 0 <= j < seen.len() && (#[trigger] seen[j]).id == id {
            Result::Err(ascii("duplicate region id: "@) + id)
        } else {
            match status_of(id, status) {
                Result::Err(e) => Result::Err(e),
                Result::Ok(st) => Result::Ok(
                    Row { id, file, status: st, line: line + seq![0x0Au8] },
                ),
            }
        }
    }
}

pub open spec fn ace_docid(r: Row) -> Option<Seq<u8>> {
    match r.status {
        Status::Ace(d) => Option::Some(d),
        _ => Option::None,
    }
}

pub open spec fn claims(rows: Seq<Row>, d: Seq<u8>) -> bool {
    exists|j: int| 0 <= j < rows.len() && ace_docid(#[trigger] rows[j]) == Option::Some(d)
}

// Rows in order: comments only before the first row; each row's grammar
// plus the ace-docid laws (claimed once, known docid).
pub open spec fn parse_rows(
    lines: Seq<Seq<u8>>,
    i: nat,
    docids: Seq<Seq<u8>>,
    acc: Seq<Row>,
) -> Result<Seq<Row>, Seq<u8>>
    decreases lines.len() - i,
{
    if i >= lines.len() {
        Result::Ok(acc)
    } else {
        let line = lines[i as int];
        if line.len() > 0 && line[0] == 0x23 {
            if acc.len() > 0 {
                Result::Err(ascii("comment line after rows: "@) + line)
            } else {
                parse_rows(lines, i + 1, docids, acc)
            }
        } else {
            match parse_row(line, acc) {
                Result::Err(e) => Result::Err(e),
                Result::Ok(r) => match ace_docid(r) {
                    Option::Some(d) => if claims(acc, d) {
                        Result::Err(ascii("docid claimed by two rows: "@) + d)
                    } else if !docids.contains(d) {
                        Result::Err(
                            ascii("ace names unknown docid for "@) + r.id + ascii(": "@) + d,
                        )
                    } else {
                        parse_rows(lines, i + 1, docids, acc.push(r))
                    },
                    Option::None => parse_rows(lines, i + 1, docids, acc.push(r)),
                },
            }
        }
    }
}

// First row carrying `id` (accepted ledgers carry each id once).
pub open spec fn row_by_id(rows: Seq<Row>, id: Seq<u8>) -> Option<Row>
    decreases rows.len(),
{
    if rows.len() == 0 {
        Option::None
    } else if rows[0].id == id {
        Option::Some(rows[0])
    } else {
        row_by_id(rows.drop_first(), id)
    }
}

// Restates: never itself, target known, target not itself a restatement.
pub open spec fn restates_check(rows: Seq<Row>, i: nat) -> Option<Seq<u8>>
    decreases rows.len() - i,
{
    if i >= rows.len() {
        Option::None
    } else {
        match rows[i as int].status {
            Status::Restates(t) => if t == rows[i as int].id {
                Option::Some(ascii("restates itself: "@) + rows[i as int].id)
            } else {
                match row_by_id(rows, t) {
                    Option::None => Option::Some(
                        ascii("restates unknown region for "@) + rows[i as int].id + ascii(": "@)
                            + t,
                    ),
                    Option::Some(target) => if target.status is Restates {
                        Option::Some(
                            ascii("restates a restatement for "@) + rows[i as int].id + ascii(": "@)
                                + t,
                        )
                    } else {
                        restates_check(rows, i + 1)
                    },
                }
            },
            _ => restates_check(rows, i + 1),
        }
    }
}

pub open spec fn first_unclaimed(rows: Seq<Row>, docids: Seq<Seq<u8>>, i: nat) -> Option<Seq<u8>>
    decreases docids.len() - i,
{
    if i >= docids.len() {
        Option::None
    } else if !claims(rows, docids[i as int]) {
        Option::Some(docids[i as int])
    } else {
        first_unclaimed(rows, docids, i + 1)
    }
}

// Evidence files in first-reference order.
pub open spec fn files_of(rows: Seq<Row>, i: nat, acc: Seq<Seq<u8>>) -> Seq<Seq<u8>>
    decreases rows.len() - i,
{
    if i >= rows.len() {
        acc
    } else if acc.contains(rows[i as int].file) {
        files_of(rows, i + 1, acc)
    } else {
        files_of(rows, i + 1, acc.push(rows[i as int].file))
    }
}

pub open spec fn rows_in(rows: Seq<Row>, file: Seq<u8>) -> Seq<Row> {
    rows.filter(|r: Row| r.file == file)
}

// --- evidence files: census + locator regions or ordinal payloads ---
// `identify the N payloads below` — the first FULL match in the file (legacy
// `census_rx.search`): an `identify the ` occurrence whose digit run breaks
// the pattern is skipped, not terminal.
pub open spec fn census_at(text: Seq<u8>, k: nat) -> Option<nat>
    decreases text.len() - k,
{
    let p = ascii("identify the "@);
    if k >= text.len() {
        Option::None
    } else {
        let hit = first_sub(text, p, k);
        if hit >= text.len() {
            Option::None
        } else {
            let after = text.skip(hit as int + p.len() as int);
            let n = lead_digits(after, 0);
            if n > 0 && starts(after.skip(n as int), ascii(" payloads below"@)) {
                Option::Some(dec_of(after.take(n as int)))
            } else {
                census_at(text, k + 1)
            }
        }
    }
}

pub open spec fn census_of(text: Seq<u8>) -> Option<nat> {
    census_at(text, 0)
}

pub open spec fn lead_digits(s: Seq<u8>, i: nat) -> nat
    decreases s.len() - i,
{
    if i < s.len() && is_digit_b(s[i as int]) {
        lead_digits(s, i + 1)
    } else {
        i
    }
}

pub open spec fn dec_of(ds: Seq<u8>) -> nat
    decreases ds.len(),
{
    if ds.len() == 0 {
        0
    } else {
        dec_of(ds.drop_last()) * 10 + (ds.last() - 0x30) as nat
    }
}

// A locator line: `[<id> | ...]` with a nonempty space-free id.
pub open spec fn locator_id(line: Seq<u8>) -> Option<Seq<u8>> {
    if line.len() >= 2 && line[0] == 0x5B && line.last() == 0x5D && first_sub(
        line,
        ascii(" | "@),
        0,
    ) < line.len() {
        let body = line.skip(1);
        let id = body.take(first_sub(body, ascii(" | "@), 0) as int);
        if id.len() > 0 && !has_byte(id, 0x20) {
            Option::Some(id)
        } else {
            Option::None
        }
    } else {
        Option::None
    }
}

pub ghost struct Evidence {
    pub census: nat,
    pub locators: Seq<Seq<u8>>,  // locator ids in file order
    pub payloads: Seq<(Seq<u8>, Seq<Seq<u8>>)>,  // per locator: its content lines
    pub ordinal: Seq<
        Seq<u8>,
    >,  // locatorless mode: nonempty lines after the first blank, labels stripped
}

pub open spec fn strip_label(line: Seq<u8>) -> Seq<u8> {
    let k = first_sub(line, ascii(". "@), 0);
    if k < line.len() && k > 0 && all_in(line.take(k as int), |b: u8| is_digit_b(b)) {
        line.skip(k as int + 2)
    } else {
        line
    }
}

// The line walk (legacy evidence_regions): locator lines open regions;
// other nonempty lines belong to the open region and, past the first blank
// line, to the ordinal list.
pub open spec fn walk(
    lines: Seq<Seq<u8>>,
    i: nat,
    cur: Option<Seq<u8>>,
    cur_lines: Seq<Seq<u8>>,
    past_blank: bool,
    locs: Seq<Seq<u8>>,
    pays: Seq<(Seq<u8>, Seq<Seq<u8>>)>,
    ord: Seq<Seq<u8>>,
) -> (Seq<Seq<u8>>, Seq<(Seq<u8>, Seq<Seq<u8>>)>, Seq<Seq<u8>>)
    decreases lines.len() - i,
{
    if i >= lines.len() {
        match cur {
            Option::Some(c) => (locs, pays.push((c, cur_lines)), ord),
            Option::None => (locs, pays, ord),
        }
    } else {
        let line = lines[i as int];
        match locator_id(line) {
            Option::Some(id) => {
                let pays2 = match cur {
                    Option::Some(c) => pays.push((c, cur_lines)),
                    Option::None => pays,
                };
                walk(
                    lines,
                    i + 1,
                    Option::Some(id),
                    Seq::empty(),
                    past_blank,
                    locs.push(id),
                    pays2,
                    ord,
                )
            },
            Option::None => if line.len() == 0 {
                walk(lines, i + 1, cur, cur_lines, true, locs, pays, ord)
            } else {
                let cl = if cur is Some {
                    cur_lines.push(line)
                } else {
                    cur_lines
                };
                let o = if past_blank {
                    ord.push(line)
                } else {
                    ord
                };
                walk(lines, i + 1, cur, cl, past_blank, locs, pays, o)
            },
        }
    }
}

pub open spec fn evidence_of(text: Seq<u8>, path: Seq<u8>) -> Result<Evidence, Seq<u8>> {
    match census_of(text) {
        Option::None => Result::Err(ascii("evidence lacks region-authority census: "@) + path),
        Option::Some(n) => {
            let (locs, pays, ord) = walk(
                split_on(text, 0x0A),
                0,
                Option::None,
                Seq::empty(),
                false,
                Seq::empty(),
                Seq::empty(),
                Seq::empty(),
            );
            // every region carries exactly one content line
            match first_multi(pays, 0) {
                Option::Some((id, k)) => Result::Err(
                    ascii("evidence region "@) + id + ascii(" carries "@) + nat_bytes(k) + ascii(
                        " content lines in: "@,
                    ) + path,
                ),
                Option::None => if locs.len() == 0 && ord.len() != n {
                    Result::Err(
                        ascii("payload lines "@) + nat_bytes(ord.len()) + ascii(
                            " differ from census "@,
                        ) + nat_bytes(n) + ascii(" for: "@) + path,
                    )
                } else {
                    Result::Ok(
                        Evidence {
                            census: n,
                            locators: locs,
                            payloads: pays,
                            ordinal: ord.map_values(|l: Seq<u8>| strip_label(l)),
                        },
                    )
                },
            }
        },
    }
}

pub open spec fn first_multi(pays: Seq<(Seq<u8>, Seq<Seq<u8>>)>, i: nat) -> Option<(Seq<u8>, nat)>
    decreases pays.len() - i,
{
    if i >= pays.len() {
        Option::None
    } else if pays[i as int].1.len() != 1 {
        Option::Some((pays[i as int].0, pays[i as int].1.len()))
    } else {
        first_multi(pays, i + 1)
    }
}

// The first payload entry under `id` (accepted evidence carries each id once
// with exactly one payload, `first_multi`).
pub open spec fn payload_in(pays: Seq<(Seq<u8>, Seq<Seq<u8>>)>, id: Seq<u8>) -> Option<Seq<u8>>
    decreases pays.len(),
{
    if pays.len() == 0 {
        Option::None
    } else if pays[0].0 == id {
        if pays[0].1.len() > 0 {
            Option::Some(pays[0].1[0])
        } else {
            Option::None
        }
    } else {
        payload_in(pays.drop_first(), id)
    }
}

pub open spec fn payload_of(e: Evidence, id: Seq<u8>) -> Option<Seq<u8>> {
    payload_in(e.payloads, id)
}

pub open spec fn dup_locator(locs: Seq<Seq<u8>>, i: nat) -> Option<Seq<u8>>
    decreases locs.len() - i,
{
    if i >= locs.len() {
        Option::None
    } else if locs.take(i as int).contains(locs[i as int]) {
        Option::Some(locs[i as int])
    } else {
        dup_locator(locs, i + 1)
    }
}

pub open spec fn first_unanchored(claimed: Seq<Row>, locs: Seq<Seq<u8>>, i: nat) -> Option<Seq<u8>>
    decreases claimed.len() - i,
{
    if i >= claimed.len() {
        Option::None
    } else if !locs.contains(claimed[i as int].id) {
        Option::Some(claimed[i as int].id)
    } else {
        first_unanchored(claimed, locs, i + 1)
    }
}

// A shell-read evidence file: the legacy read order (symlink, then regular
// file, then bytes) and the R46 classes (unreadable, invalid UTF-8 at an offset).
pub ghost enum FileSrc {
    Symlink,
    Missing,
    Unreadable,
    Bad(nat),
    Bytes(Seq<u8>),
}

// Legacy prints evidence paths joined under the guideline path through
// `pathlib` (R62/R74): empty and `.` components collapse (`source//x`,
// `source/./x`, a trailing `/` → `source/x`); row-field diagnostics keep the
// raw field.
pub open spec fn join_slash(segs: Seq<Seq<u8>>) -> Seq<u8>
    decreases segs.len(),
{
    if segs.len() == 0 {
        Seq::empty()
    } else if segs.len() == 1 {
        segs[0]
    } else {
        segs[0] + seq![0x2Fu8] + join_slash(segs.drop_first())
    }
}

pub open spec fn norm_path(f: Seq<u8>) -> Seq<u8> {
    join_slash(split_on(f, 0x2F).filter(|s: Seq<u8>| s.len() > 0 && s != ascii("."@)))
}

pub open spec fn full_path(root: Seq<u8>, f: Seq<u8>) -> Seq<u8> {
    root + seq![0x2Fu8] + norm_path(f)
}

// Per cited file in first-reference order: census vs claimed rows, then
// locator mode (count, duplicates, anchoring) or ordinal mode.
pub open spec fn files_check(
    rows: Seq<Row>,
    files: Seq<Seq<u8>>,
    texts: Seq<FileSrc>,
    root: Seq<u8>,
    i: nat,
) -> Result<Seq<Evidence>, Seq<u8>>
    decreases files.len() - i,
{
    if i >= files.len() {
        Result::Ok(Seq::empty())
    } else {
        let f = files[i as int];
        match texts[i as int] {
            FileSrc::Bytes(text) => match evidence_of(text, full_path(root, f)) {
                Result::Err(e) => Result::Err(e),
                Result::Ok(ev) => {
                    let claimed = rows_in(rows, f);
                    if claimed.len() != ev.census {
                        Result::Err(
                            ascii("rows "@) + nat_bytes(claimed.len()) + ascii(
                                " differ from census "@,
                            ) + nat_bytes(ev.census) + ascii(" for: "@) + f,
                        )
                    } else if ev.locators.len() > 0 {
                        if ev.locators.len() != ev.census {
                            Result::Err(
                                ascii("locators "@) + nat_bytes(ev.locators.len()) + ascii(
                                    " differ from census "@,
                                ) + nat_bytes(ev.census) + ascii(" for: "@) + f,
                            )
                        } else {
                            match dup_locator(ev.locators, 0) {
                                Option::Some(id) => Result::Err(
                                    ascii("duplicate evidence locator: "@) + id,
                                ),
                                Option::None => match first_unanchored(claimed, ev.locators, 0) {
                                    Option::Some(id) => Result::Err(
                                        ascii("coverage row without evidence region: "@) + id,
                                    ),
                                    Option::None => match files_check(
                                        rows,
                                        files,
                                        texts,
                                        root,
                                        i + 1,
                                    ) {
                                        Result::Err(e) => Result::Err(e),
                                        Result::Ok(rest) => Result::Ok(seq![ev] + rest),
                                    },
                                },
                            }
                        }
                    } else {
                        match files_check(rows, files, texts, root, i + 1) {
                            Result::Err(e) => Result::Err(e),
                            Result::Ok(rest) => Result::Ok(seq![ev] + rest),
                        }
                    }
                },
            },
            FileSrc::Symlink => Result::Err(ascii("is a symlink: "@) + full_path(root, f)),
            FileSrc::Missing => Result::Err(ascii("missing: "@) + full_path(root, f)),
            FileSrc::Unreadable => Result::Err(ascii("unreadable "@) + full_path(root, f)),
            FileSrc::Bad(_) => Result::Err(ascii("invalid_utf8 "@) + full_path(root, f)),
        }
    }
}

pub ghost struct Coverage {
    pub rows: Seq<Row>,
    pub files: Seq<Seq<u8>>,
    pub evidence: Seq<Evidence>,
}

pub open spec fn count_status(rows: Seq<Row>, k: int) -> nat {
    rows.filter(
        |r: Row|
            match r.status {
                Status::Pending => k == 0,
                Status::Ace(_) => k == 1,
                Status::Restates(_) => k == 2,
                Status::Uncovered(c) => if c == ascii("inexpressible"@) {
                    k == 4
                } else {
                    k == 3
                },
            },
    ).len()
}

pub open spec fn coverage_meter(gid: Seq<u8>, rows: Seq<Row>) -> Seq<u8> {
    ascii("ckc: coverage ok "@) + gid + seq![0x20u8] + nat_bytes(rows.len()) + ascii(
        " regions; ace="@,
    ) + nat_bytes(count_status(rows, 1)) + ascii(" restates="@) + nat_bytes(count_status(rows, 2))
        + ascii(" uncovered="@) + nat_bytes(count_status(rows, 3)) + ascii(" inexpressible="@)
        + nat_bytes(count_status(rows, 4)) + ascii(" pending="@) + nat_bytes(count_status(rows, 0))
        + seq![0x0Au8]
}

// The coverage law: envelope → rows → restates → docid totality → evidence closure.
pub open spec fn coverage(
    bytes: Seq<u8>,
    docids: Seq<Seq<u8>>,
    file_texts: spec_fn(Seq<u8>) -> FileSrc,
    root: Seq<u8>,
) -> Result<Coverage, Verdict> {
    if has_byte(bytes, 0x0D) {
        Result::Err(fail("coverage"@, ascii("carriage return byte in ledger"@)))
    } else if !(bytes.len() > 0 && bytes.last() == 0x0A) {
        Result::Err(fail("coverage"@, ascii("ledger lacks final newline"@)))
    } else if !starts(bytes, coverage_header()) {
        Result::Err(fail("coverage"@, ascii("header bytes drift"@)))
    } else {
        match parse_rows(
            body_lines(bytes.skip(coverage_header().len() as int)),
            0,
            docids,
            Seq::empty(),
        ) {
            Result::Err(e) => Result::Err(fail("coverage"@, e)),
            Result::Ok(rows) => if rows.len() == 0 {
                Result::Err(fail("coverage"@, ascii("ledger holds no rows"@)))
            } else {
                match restates_check(rows, 0) {
                    Option::Some(e) => Result::Err(fail("coverage"@, e)),
                    Option::None => match first_unclaimed(rows, docids, 0) {
                        Option::Some(d) => Result::Err(
                            fail("coverage"@, ascii("docid without a coverage row: "@) + d),
                        ),
                        Option::None => {
                            let files = files_of(rows, 0, Seq::empty());
                            match files_check(
                                rows,
                                files,
                                files.map_values(|f: Seq<u8>| file_texts(f)),
                                root,
                                0,
                            ) {
                                Result::Err(e) => Result::Err(fail("coverage"@, e)),
                                Result::Ok(evs) => Result::Ok(
                                    Coverage { rows, files, evidence: evs },
                                ),
                            }
                        },
                    },
                }
            },
        }
    }
}

// The document's coverage row (bytes incl. LF) = the first row claiming it
// (`parse_rows` claims each docid once), and its selected source payload.
pub open spec fn first_ace_row(rows: Seq<Row>, d: Seq<u8>) -> Option<Row>
    decreases rows.len(),
{
    if rows.len() == 0 {
        Option::None
    } else if ace_docid(rows[0]) == Option::Some(d) {
        Option::Some(rows[0])
    } else {
        first_ace_row(rows.drop_first(), d)
    }
}

pub open spec fn ace_row(c: Coverage, d: Seq<u8>) -> Option<Row> {
    first_ace_row(c.rows, d)
}

// First index of `f` (`files_of` lists each file once); `files.len()` when absent.
pub open spec fn index_of(files: Seq<Seq<u8>>, f: Seq<u8>) -> int
    decreases files.len(),
{
    if files.len() == 0 {
        0
    } else if files[0] == f {
        0
    } else {
        1 + index_of(files.drop_first(), f)
    }
}

pub open spec fn file_index(c: Coverage, f: Seq<u8>) -> int {
    index_of(c.files, f)
}

// First index of the row with `id` among `rows`; `rows.len()` when absent.
pub open spec fn row_index(rows: Seq<Row>, id: Seq<u8>) -> int
    decreases rows.len(),
{
    if rows.len() == 0 {
        0
    } else if rows[0].id == id {
        0
    } else {
        1 + row_index(rows.drop_first(), id)
    }
}

// Locator mode: the payload under the row's region id; ordinal mode: the
// row's ordinal among the rows citing that file.
pub open spec fn payload(c: Coverage, d: Seq<u8>) -> Option<Seq<u8>> {
    match ace_row(c, d) {
        Option::None => Option::None,
        Option::Some(r) => {
            if file_index(c, r.file) >= c.evidence.len() {
                Option::None
            } else {
                let ev = c.evidence[file_index(c, r.file)];
                if ev.locators.len() > 0 {
                    payload_of(ev, r.id)
                } else {
                    let cited = rows_in(c.rows, r.file);
                    let k = row_index(cited, r.id);
                    if k < ev.ordinal.len() {
                        Option::Some(ev.ordinal[k])
                    } else {
                        Option::None
                    }
                }
            }
        },
    }
}

// --- review bundle (v2) ---
// Retained clause-line stream: every line except `%` comments and `:- `
// directives; exactly one `guideline_document(` record, dropped.
pub open spec fn retained(lines: Seq<Seq<u8>>) -> Seq<u8>
    decreases lines.len(),
{
    if lines.len() == 0 {
        Seq::empty()
    } else {
        let l = lines[0];
        (if starts(l, ascii("guideline_document("@)) || starts(l, ascii("%"@)) || starts(
            l,
            ascii(":- "@),
        ) {
            Seq::<u8>::empty()
        } else {
            l + seq![0x0Au8]
        }) + retained(lines.drop_first())
    }
}

pub open spec fn record_count(lines: Seq<Seq<u8>>) -> nat {
    lines.filter(|l: Seq<u8>| starts(l, ascii("guideline_document("@))).len()
}

// First line that is neither a comment, a directive, nor dot-terminated
// (legacy loop order): it names the class of the first violation.
pub open spec fn first_undotted(lines: Seq<Seq<u8>>) -> Option<Seq<u8>>
    decreases lines.len(),
{
    if lines.len() == 0 {
        Option::None
    } else if starts(lines[0], ascii("%"@)) || starts(lines[0], ascii(":- "@)) || ends(
        lines[0],
        seq![0x2Eu8],
    ) {
        first_undotted(lines.drop_first())
    } else {
        Option::Some(lines[0])
    }
}

// The bytes the shell hashes for `semantic_clause_sha256`.
pub open spec fn semantic_input(pl: Seq<u8>, docid: Seq<u8>) -> Result<Seq<u8>, Seq<u8>> {
    if !(pl.len() > 0 && pl.last() == 0x0A) {
        Result::Err(ascii("compiled document lacks final newline: "@) + docid)
    } else {
        let lines = body_lines(pl);
        if first_undotted(lines) is Some {
            Result::Err(
                (if starts(first_undotted(lines).unwrap(), ascii("guideline_document("@)) {
                    ascii("noncanonical document record in: "@)
                } else {
                    ascii("noncanonical clause line in: "@)
                }) + docid,
            )
        } else if record_count(lines) != 1 {
            Result::Err(
                ascii("document record count "@) + nat_bytes(record_count(lines)) + ascii(" for: "@)
                    + docid,
            )
        } else {
            Result::Ok(retained(lines))
        }
    }
}

// The bytes the shell hashes for `review_sha256`.
pub open spec fn bundle_block(
    docid: Seq<u8>,
    ace: Seq<u8>,
    cov: Seq<u8>,
    pay: Seq<u8>,
    cl: Seq<u8>,
) -> Seq<u8> {
    ascii("bundle v2 "@) + docid + seq![0x0Au8] + ascii("ace "@) + ace + seq![0x0Au8] + ascii(
        "coverage "@,
    ) + cov + seq![0x0Au8] + ascii("payload "@) + pay + seq![0x0Au8] + ascii("clauses "@) + cl
        + seq![0x0Au8]
}

pub open spec fn manifest_header_1() -> Seq<u8> {
    ascii(
        "# format: docid<TAB>ace_sha256<TAB>coverage_row_sha256<TAB>region_payload_sha256<TAB>semantic_clause_sha256<TAB>review_sha256\n"@,
    )
}

pub open spec fn manifest_header_2() -> Seq<u8> {
    ascii(
        "# bundle v2; review_sha256 = sha256 of the labeled component-digest block; regenerate: ckc review-manifest <id>; do not edit.\n"@,
    )
}

pub open spec fn manifest_header() -> Seq<u8> {
    manifest_header_1() + manifest_header_2()
}

pub ghost struct Bundle {
    pub docid: Seq<u8>,
    pub ace: Seq<u8>,
    pub cov: Seq<u8>,
    pub pay: Seq<u8>,
    pub cl: Seq<u8>,
    pub review: Seq<u8>,
}

pub open spec fn manifest_row(b: Bundle) -> Seq<u8> {
    b.docid + seq![0x09u8] + b.ace + seq![0x09u8] + b.cov + seq![0x09u8] + b.pay + seq![0x09u8]
        + b.cl + seq![0x09u8] + b.review + seq![0x0Au8]
}

pub open spec fn print_manifest(bs: Seq<Bundle>) -> Seq<u8> {
    manifest_header() + bs.map_values(|b: Bundle| manifest_row(b)).flatten()
}

// --- committed-manifest parse (legacy `parse_review_manifest`, R63): the
// well-formed row prefix + the first grammar violation. `review_sha256
// self-consistency` is a shell hash: the shell checks the prefix rows in order
// BEFORE the reported grammar violation, so the first violation keeps the
// legacy row order.
pub open spec fn manifest_row_detail(n: nat, what: Seq<char>) -> Seq<u8> {
    ascii("manifest row "@) + nat_bytes(n) + seq![0x20u8] + ascii(what)
}

pub open spec fn parse_rows_of(
    lines: Seq<Seq<u8>>,
    i: nat,
    n: nat,
    prev: Seq<u8>,
    acc: Seq<Bundle>,
) -> (Seq<Bundle>, Option<Seq<u8>>)
    decreases lines.len() - i,
{
    if i >= lines.len() {
        (acc, Option::None)
    } else {
        let fs = split_on(lines[i as int], 0x09);
        if fs.len() != 6 {
            (acc, Option::Some(manifest_row_detail(n, "field-count "@) + nat_bytes(fs.len())))
        } else if !docid_ok(fs[0]) {
            (acc, Option::Some(manifest_row_detail(n, "docid-grammar"@)))
        } else if acc.map_values(|b: Bundle| b.docid).contains(fs[0]) {
            (acc, Option::Some(manifest_row_detail(n, "duplicate-docid "@) + fs[0]))
        } else if bytes_lt(fs[0], prev) {
            (
                acc,
                Option::Some(
                    manifest_row_detail(n, "sort-order "@) + fs[0] + ascii(" after "@) + prev,
                ),
            )
        } else if !hex64(fs[1]) {
            (acc, Option::Some(manifest_row_detail(n, "ace_sha256"@)))
        } else if !hex64(fs[2]) {
            (acc, Option::Some(manifest_row_detail(n, "coverage_row_sha256"@)))
        } else if !hex64(fs[3]) {
            (acc, Option::Some(manifest_row_detail(n, "region_payload_sha256"@)))
        } else if !hex64(fs[4]) {
            (acc, Option::Some(manifest_row_detail(n, "semantic_clause_sha256"@)))
        } else if !hex64(fs[5]) {
            (acc, Option::Some(manifest_row_detail(n, "review_sha256"@)))
        } else {
            parse_rows_of(
                lines,
                i + 1,
                n + 1,
                fs[0],
                acc.push(
                    Bundle {
                        docid: fs[0],
                        ace: fs[1],
                        cov: fs[2],
                        pay: fs[3],
                        cl: fs[4],
                        review: fs[5],
                    },
                ),
            )
        }
    }
}

pub open spec fn parse_manifest(src: Src, path: Seq<u8>) -> (Seq<Bundle>, Option<Seq<u8>>) {
    match src {
        Src::Missing => (Seq::empty(), Option::Some(ascii("manifest missing: "@) + path)),
        Src::Bad(_) => (Seq::empty(), Option::Some(ascii("manifest encoding"@))),
        Src::Bytes(b) => if has_byte(b, 0x0D) {
            (Seq::empty(), Option::Some(ascii("manifest carriage-return"@)))
        } else if !(b.len() > 0 && b.last() == 0x0A) {
            (Seq::empty(), Option::Some(ascii("manifest final-newline"@)))
        } else if !starts(b, manifest_header_1()) {
            (Seq::empty(), Option::Some(ascii("manifest header line 1"@)))
        } else if !starts(b.skip(manifest_header_1().len() as int), manifest_header_2()) {
            (Seq::empty(), Option::Some(ascii("manifest header line 2"@)))
        } else {
            let lines = body_lines(b.skip(manifest_header().len() as int));
            if lines.len() == 0 {
                (Seq::empty(), Option::Some(ascii("manifest holds no rows: "@) + path))
            } else {
                parse_rows_of(lines, 0, 3, Seq::empty(), Seq::empty())
            }
        },
    }
}

// --- adjudication ledger ---
pub open spec fn ledger_header() -> Seq<u8> {
    ascii(
        "# format: docid<TAB>review_sha256<TAB>ace_commit<TAB>verdict<TAB>reviewer<TAB>date<TAB>comment\n"@,
    )
}

pub open spec fn hex40(h: Seq<u8>) -> bool {
    h.len() == 40 && all_in(h, |b: u8| is_hex_lower_b(b))
}

pub open spec fn text_clean(s: Seq<u8>) -> bool {
    all_in(s, |b: u8| b >= 0x20 && b != 0x7F)
}

// YYYY-MM-DDTHH:MM:SSZ with a real UTC calendar date.
pub open spec fn date_ok(d: Seq<u8>) -> bool {
    &&& d.len() == 20
    &&& d[4] == 0x2D && d[7] == 0x2D && d[10] == 0x54 && d[13] == 0x3A && d[16] == 0x3A && d[19]
        == 0x5A
    &&& forall|i: int|
        0 <= i < 20 && i != 4 && i != 7 && i != 10 && i != 13 && i != 16 && i != 19 ==> is_digit_b(
            #[trigger] d[i],
        )
    &&& calendar_ok(
        dec_of(d.take(4)),
        dec_of(d.subrange(5, 7)),
        dec_of(d.subrange(8, 10)),
        dec_of(d.subrange(11, 13)),
        dec_of(d.subrange(14, 16)),
        dec_of(d.subrange(17, 19)),
    )
}

pub open spec fn leap(y: nat) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

pub open spec fn month_days(y: nat, m: nat) -> nat {
    if m == 2 {
        if leap(y) {
            29
        } else {
            28
        }
    } else if m == 4 || m == 6 || m == 9 || m == 11 {
        30
    } else {
        31
    }
}

pub open spec fn calendar_ok(y: nat, mo: nat, d: nat, h: nat, mi: nat, s: nat) -> bool {
    1 <= y && 1 <= mo <= 12 && 1 <= d <= month_days(y, mo) && h <= 23 && mi <= 59 && s <= 59
}

pub ghost struct Decision {
    pub docid: Seq<u8>,
    pub digest: Seq<u8>,
    pub commit: Seq<u8>,  // empty or hex40
    pub approved: bool,
    pub date: Seq<u8>,
}

pub open spec fn row_detail(n: nat, what: Seq<char>) -> Seq<u8> {
    ascii("ledger row "@) + nat_bytes(n) + seq![0x20u8] + ascii(what)
}

// One ledger row in the legacy order (sort key = docid TAB date, checked
// before the date's own grammar).
pub open spec fn parse_decision(
    line: Seq<u8>,
    n: nat,
    known: Seq<Seq<u8>>,
    prev: Option<(Seq<u8>, Seq<u8>)>,
) -> Result<Decision, Seq<u8>> {
    if line.len() > 0 && line[0] == 0x23 {
        Result::Err(ascii("ledger header"@))
    } else {
        let f = tab_fields(line);
        if f.len() != 7 {
            Result::Err(row_detail(n, "field-count "@) + nat_bytes(f.len()))
        } else {
            let (docid, digest, commit, verdict, reviewer, date, comment) = (
                f[0],
                f[1],
                f[2],
                f[3],
                f[4],
                f[5],
                f[6],
            );
            if !docid_ok(docid) {
                Result::Err(row_detail(n, "docid-grammar"@))
            } else if !known.contains(docid) {
                Result::Err(row_detail(n, "unknown-docid "@) + docid)
            } else if (match prev {
                Option::Some((pd, pt)) => bytes_lt(
                    docid + seq![0x09u8] + date,
                    pd + seq![0x09u8] + pt,
                ),
                Option::None => false,
            }) {
                let (pd, pt) = prev.unwrap();
                Result::Err(
                    row_detail(n, "sort-order "@) + docid + seq![0x20u8] + date + ascii(" after "@)
                        + pd + seq![0x20u8] + pt,
                )
            } else if !hex64(digest) {
                Result::Err(row_detail(n, "hex"@))
            } else if !(commit.len() == 0 || hex40(commit)) {
                Result::Err(row_detail(n, "ace-commit"@))
            } else if !(verdict == ascii("approved"@) || verdict == ascii("rejected"@)) {
                Result::Err(row_detail(n, "verdict"@))
            } else if reviewer.len() == 0 || !text_clean(reviewer) {
                Result::Err(row_detail(n, "reviewer"@))
            } else if !date_ok(date) {
                Result::Err(row_detail(n, "date"@))
            } else if !text_clean(comment) {
                Result::Err(row_detail(n, "comment"@))
            } else {
                Result::Ok(
                    Decision {
                        docid,
                        digest,
                        commit,
                        approved: verdict == ascii("approved"@),
                        date,
                    },
                )
            }
        }
    }
}

// The well-formed row prefix + the first grammar violation (R68): legacy
// checks each row's recorded commit (a git read, shell tier) inside the same
// per-row loop, so the shell walks the returned prefix in order — commit
// absent / historical digest mismatch on row j fires before a grammar
// violation on a later row.
pub open spec fn parse_decisions(
    lines: Seq<Seq<u8>>,
    i: nat,
    known: Seq<Seq<u8>>,
    prev: Option<(Seq<u8>, Seq<u8>)>,
    acc: Seq<Decision>,
) -> (Seq<Decision>, Option<Seq<u8>>)
    decreases lines.len() - i,
{
    if i >= lines.len() {
        (acc, Option::None)
    } else {
        match parse_decision(lines[i as int], i + 2, known, prev) {
            Result::Err(e) => (acc, Option::Some(e)),
            Result::Ok(d) => parse_decisions(
                lines,
                i + 1,
                known,
                Option::Some((d.docid, d.date)),
                acc.push(d),
            ),
        }
    }
}

// Ledger bytes → (decision prefix, first violation); absent ledger = no
// decisions. Prefix row j (0-based) = ledger row j + 2.
pub open spec fn ledger(src: Src, known: Seq<Seq<u8>>) -> (Seq<Decision>, Option<Verdict>) {
    match src {
        Src::Missing => (Seq::empty(), Option::None),
        Src::Bad(_) => (
            Seq::empty(),
            Option::Some(fail("adjudication"@, ascii("ledger encoding"@))),
        ),
        Src::Bytes(b) => if has_byte(b, 0x0D) {
            (Seq::empty(), Option::Some(fail("adjudication"@, ascii("ledger carriage-return"@))))
        } else if !(b.len() > 0 && b.last() == 0x0A) {
            (Seq::empty(), Option::Some(fail("adjudication"@, ascii("ledger final-newline"@))))
        } else if !starts(b, ledger_header()) {
            (Seq::empty(), Option::Some(fail("adjudication"@, ascii("ledger header"@))))
        } else {
            let (ds, v) = parse_decisions(
                body_lines(b.skip(ledger_header().len() as int)),
                0,
                known,
                Option::None,
                Seq::empty(),
            );
            match v {
                Option::Some(e) => (ds, Option::Some(fail("adjudication"@, e))),
                Option::None => (ds, Option::None),
            }
        },
    }
}

// Classification over the CURRENT bundle digests: a document with any
// current approved and any current rejected decision is contested; only
// approved → approved; only rejected → rejected; decisions but none
// current → stale; none → unreviewed.
pub open spec fn cur(ds: Seq<Decision>, bs: Seq<Bundle>, d: Seq<u8>, approved: bool) -> bool {
    exists|i: int, j: int|
        0 <= i < ds.len() && 0 <= j < bs.len() && (#[trigger] ds[i]).docid == d && (
        #[trigger] bs[j]).docid == d && ds[i].digest == bs[j].review && ds[i].approved == approved
}

pub open spec fn reviewed(ds: Seq<Decision>) -> Seq<Seq<u8>> {
    ds.map_values(|x: Decision| x.docid).fold_left(
        Seq::<Seq<u8>>::empty(),
        |acc: Seq<Seq<u8>>, d: Seq<u8>|
            if acc.contains(d) {
                acc
            } else {
                acc.push(d)
            },
    )
}

pub open spec fn class_count(ds: Seq<Decision>, bs: Seq<Bundle>, k: int) -> nat {
    reviewed(ds).filter(
        |d: Seq<u8>|
            {
                let a = cur(ds, bs, d, true);
                let r = cur(ds, bs, d, false);
                if k == 0 {
                    a && !r
                } else if k == 1 {
                    !a && r
                } else if k == 2 {
                    a && r
                } else {
                    !a && !r
                }
            },
    ).len()
}

// Unreviewed = bundles minus reviewed docids; total: 0 when a ledger names
// more docids than the manifest holds (unreachable through `ledger`'s
// known-docid law, R64).
pub open spec fn unreviewed(ds: Seq<Decision>, bs: Seq<Bundle>) -> nat {
    if reviewed(ds).len() <= bs.len() {
        (bs.len() - reviewed(ds).len()) as nat
    } else {
        0
    }
}

pub open spec fn adjudication_meter(gid: Seq<u8>, ds: Seq<Decision>, bs: Seq<Bundle>) -> Seq<u8> {
    ascii("ckc: adjudication "@) + gid + ascii(" approved="@) + nat_bytes(class_count(ds, bs, 0))
        + ascii(" rejected="@) + nat_bytes(class_count(ds, bs, 1)) + ascii(" contested="@)
        + nat_bytes(class_count(ds, bs, 2)) + ascii(" stale="@) + nat_bytes(class_count(ds, bs, 3))
        + ascii(" unreviewed="@) + nat_bytes(unreviewed(ds, bs)) + ascii(" decisions="@)
        + nat_bytes(ds.len()) + seq![0x0Au8]
}

// --- lexicon gates ---
pub open spec fn normalized(line: Seq<u8>) -> Seq<u8> {
    let t = strip_ws(line);
    let u = if t.len() > 0 && t.last() == 0x2E {
        t.drop_last()
    } else {
        t
    };
    u.filter(|b: u8| b != 0x27 && b != 0x20 && b != 0x09)
}

// `kind(surface, lemma, ...)`: quoted surface/lemma or bare comma fields.
pub open spec fn entry_of(line: Seq<u8>) -> Option<(Seq<u8>, Seq<u8>, Seq<u8>)> {
    let p = first_byte(line, 0x28, 0);
    if p >= line.len() {
        Option::None
    } else {
        let kind = line.take(p as int);
        let rest = line.skip(p as int + 1);
        let q = split_on(rest, 0x27);
        if q.len() > 3 {
            Option::Some((kind, q[1], q[3]))
        } else {
            let c = split_on(rest, 0x2C);
            if c.len() < 2 {
                Option::None
            } else {
                Option::Some((kind, c[0], c[1]))
            }
        }
    }
}

pub open spec fn strip_tok(t: Seq<u8>) -> Seq<u8> {
    let is_strip = |b: u8|
        b == 0x2E || b == 0x2C || b == 0x3B || b == 0x3A || b == 0x3F || b == 0x21 || b == 0x22 || b
            == 0x28 || b == 0x29;
    let l = lead_while(t, 0, is_strip);
    let u = t.skip(l as int);
    u.take(u.len() - trail_while(u, u.len(), is_strip) as int)
}

pub open spec fn lead_while(s: Seq<u8>, i: nat, p: spec_fn(u8) -> bool) -> nat
    decreases s.len() - i,
{
    if i < s.len() && p(s[i as int]) {
        lead_while(s, i + 1, p)
    } else {
        i
    }
}

pub open spec fn trail_while(s: Seq<u8>, i: nat, p: spec_fn(u8) -> bool) -> nat
    decreases i,
{
    if i > 0 && p(s[i as int - 1]) {
        1 + trail_while(s, (i - 1) as nat, p)
    } else {
        0
    }
}

// Whitespace-split tokens of every ACE document, edge punctuation stripped.
pub open spec fn ace_tokens(texts: Seq<Seq<u8>>) -> Set<Seq<u8>> {
    texts.map_values(
        |t: Seq<u8>| ws_split(t).map_values(|w: Seq<u8>| strip_tok(w)),
    ).flatten().to_set()
}

pub open spec fn ws_split(t: Seq<u8>) -> Seq<Seq<u8>> {
    tokens_acc(t, 0, Seq::empty(), Seq::empty())
}

pub open spec fn clex_lines(clex: Seq<u8>) -> Seq<Seq<u8>> {
    split_on(clex, 0x0A).map_values(|l: Seq<u8>| strip_ws(l)).filter(
        |l: Seq<u8>| l.len() > 0 && !starts(l, ascii("%"@)) && !starts(l, ascii(":-"@)),
    )
}

pub open spec fn clex_norms(clex: Seq<u8>) -> Set<Seq<u8>> {
    clex_lines(clex).map_values(|l: Seq<u8>| normalized(l)).to_set()
}

pub open spec fn surface_of(l: Seq<u8>) -> Seq<u8> {
    match entry_of(l) {
        Option::Some((_, s, _)) => s,
        Option::None => Seq::empty(),
    }
}

// The distinct normalized Clex entries sharing a surface, sorted, `+`-joined.
pub open spec fn clex_key(clex: Seq<u8>, surface: Seq<u8>) -> Seq<u8> {
    join_plus(
        sort_bytes(
            dedup_bytes(
                clex_lines(clex).filter(|l: Seq<u8>| surface_of(l) == surface).map_values(
                    |l: Seq<u8>| normalized(l),
                ),
            ),
        ),
    )
}

pub open spec fn dedup_bytes(s: Seq<Seq<u8>>) -> Seq<Seq<u8>> {
    s.fold_left(
        Seq::<Seq<u8>>::empty(),
        |acc: Seq<Seq<u8>>, x: Seq<u8>|
            if acc.contains(x) {
                acc
            } else {
                acc.push(x)
            },
    )
}

pub open spec fn insert_bytes(x: Seq<u8>, s: Seq<Seq<u8>>) -> Seq<Seq<u8>>
    decreases s.len(),
{
    if s.len() > 0 && bytes_lt(s[0], x) {
        seq![s[0]] + insert_bytes(x, s.drop_first())
    } else {
        seq![x] + s
    }
}

pub open spec fn sort_bytes(s: Seq<Seq<u8>>) -> Seq<Seq<u8>>
    decreases s.len(),
{
    if s.len() == 0 {
        Seq::empty()
    } else {
        insert_bytes(s[0], sort_bytes(s.drop_first()))
    }
}

pub open spec fn join_plus(s: Seq<Seq<u8>>) -> Seq<u8>
    decreases s.len(),
{
    if s.len() == 0 {
        Seq::empty()
    } else if s.len() == 1 {
        s[0]
    } else {
        s[0] + seq![0x2Bu8] + join_plus(s.drop_first())
    }
}

pub open spec fn ulex_lines(ulex: Seq<u8>) -> Seq<Seq<u8>> {
    split_on(ulex, 0x0A).map_values(|l: Seq<u8>| strip_ws(l)).filter(|l: Seq<u8>| l.len() > 0)
}

pub open spec fn has_surface(clex: Seq<u8>, surface: Seq<u8>) -> bool {
    exists|i: int|
        0 <= i < clex_lines(clex).len() && surface_of(#[trigger] clex_lines(clex)[i]) == surface
}

// Per ulex line in order: Clex redundancy → duplicate → entry grammar →
// shadow (a Clex surface match needs a ruling row keyed by
// normalized entry TAB clex key).
pub open spec fn ulex_check(
    lines: Seq<Seq<u8>>,
    i: nat,
    clex: Seq<u8>,
    rulings: Seq<(Seq<u8>, Seq<u8>)>,
    seen: Seq<Seq<u8>>,
) -> Option<Verdict>
    decreases lines.len() - i,
{
    if i >= lines.len() {
        Option::None
    } else {
        let l = lines[i as int];
        let n = normalized(l);
        if clex_norms(clex).contains(n) {
            Option::Some(fail("lexicon-redundant"@, ascii("clex already provides: "@) + l))
        } else if seen.contains(n) {
            Option::Some(fail("lexicon-duplicate"@, ascii("entry repeated in lexicon: "@) + l))
        } else {
            match entry_of(l) {
                Option::None => Option::Some(
                    fail("lexicon-entry"@, ascii("malformed entry: "@) + l),
                ),
                Option::Some((_, surface, _)) => if has_surface(clex, surface) && !rulings.contains(
                    (n, clex_key(clex, surface)),
                ) {
                    Option::Some(
                        fail(
                            "lexicon-shadow"@,
                            ascii("clex shares surface without ruling: "@) + l + ascii(" vs "@)
                                + clex_key(clex, surface),
                        ),
                    )
                } else {
                    ulex_check(lines, i + 1, clex, rulings, seen.push(n))
                },
            }
        }
    }
}

pub open spec fn ruling_used(clex: Seq<u8>, lines: Seq<Seq<u8>>, r: (Seq<u8>, Seq<u8>)) -> bool {
    exists|i: int|
        0 <= i < lines.len() && normalized(#[trigger] lines[i]) == r.0 && has_surface(
            clex,
            surface_of(lines[i]),
        ) && clex_key(clex, surface_of(lines[i])) == r.1
}

pub open spec fn first_stale(
    clex: Seq<u8>,
    lines: Seq<Seq<u8>>,
    rs: Seq<(Seq<u8>, Seq<u8>)>,
    i: nat,
) -> Option<Seq<u8>>
    decreases rs.len() - i,
{
    if i >= rs.len() {
        Option::None
    } else if !ruling_used(clex, lines, rs[i as int]) {
        Option::Some(rs[i as int].0)
    } else {
        first_stale(clex, lines, rs, i + 1)
    }
}

// A lemma is live when some entry with that lemma has a referenced surface.
pub open spec fn live(lines: Seq<Seq<u8>>, toks: Set<Seq<u8>>, lemma: Seq<u8>) -> bool {
    exists|i: int|
        0 <= i < lines.len() && (match entry_of(#[trigger] lines[i]) {
            Option::Some((_, s, l)) => l == lemma && toks.contains(s),
            Option::None => false,
        })
}

pub open spec fn first_dead(lines: Seq<Seq<u8>>, toks: Set<Seq<u8>>, i: nat) -> Option<Seq<u8>>
    decreases lines.len() - i,
{
    if i >= lines.len() {
        Option::None
    } else {
        match entry_of(lines[i as int]) {
            Option::Some((_, s, l)) => if !live(lines, toks, l) {
                Option::Some(s)
            } else {
                first_dead(lines, toks, i + 1)
            },
            Option::None => first_dead(lines, toks, i + 1),
        }
    }
}

pub open spec fn ruled_count(
    clex: Seq<u8>,
    lines: Seq<Seq<u8>>,
    rs: Seq<(Seq<u8>, Seq<u8>)>,
) -> nat {
    lines.filter(
        |l: Seq<u8>|
            has_surface(clex, surface_of(l)) && rs.contains(
                (normalized(l), clex_key(clex, surface_of(l))),
            ),
    ).len()
}

pub open spec fn lexicon_meter(path: Seq<u8>, entries: nat, clex_facts: nat, ruled: nat) -> Seq<
    u8,
> {
    ascii("ckc: lexicon ok "@) + path + seq![0x20u8] + nat_bytes(entries) + ascii(" entries "@)
        + nat_bytes(clex_facts) + ascii(" clex facts "@) + nat_bytes(ruled) + ascii(
        " ruled shadows"@,
    ) + seq![0x0Au8]
}

// The lexicon law: rulings are (ulex_entry, clex_entries) pairs the shell
// parsed from audit/lexicon-shadow.tsv (structure = shell tier, R47).
pub open spec fn lexicon(
    path: Seq<u8>,
    ulex: Seq<u8>,
    clex: Seq<u8>,
    ace: Seq<Seq<u8>>,
    rulings: Seq<(Seq<u8>, Seq<u8>)>,
) -> Verdict {
    let lines = ulex_lines(ulex);
    match ulex_check(lines, 0, clex, rulings, Seq::empty()) {
        Option::Some(v) => v,
        Option::None => match first_stale(clex, lines, rulings, 0) {
            Option::Some(u) => fail(
                "lexicon-shadow"@,
                ascii("stale ruling matches no live shadow: "@) + u,
            ),
            Option::None => match first_dead(lines, ace_tokens(ace), 0) {
                Option::Some(s) => fail(
                    "lexicon-dead-lexeme"@,
                    ascii("no ace document references: "@) + s,
                ),
                Option::None => Verdict::Ok(
                    lexicon_meter(
                        path,
                        lines.len(),
                        clex_norms(clex).len(),
                        ruled_count(clex, lines, rulings),
                    ),
                ),
            },
        },
    }
}

// --- exec mirrors: byte custody crosses the shell boundary through these values ---
pub enum EFileSrc {
    Symlink,
    Missing,
    Unreadable,
    Bad(usize),
    Bytes(Vec<u8>),
}

impl View for EFileSrc {
    type V = FileSrc;

    open spec fn view(&self) -> FileSrc {
        match self {
            EFileSrc::Symlink => FileSrc::Symlink,
            EFileSrc::Missing => FileSrc::Missing,
            EFileSrc::Unreadable => FileSrc::Unreadable,
            EFileSrc::Bad(i) => FileSrc::Bad(*i as nat),
            EFileSrc::Bytes(b) => FileSrc::Bytes(b@),
        }
    }
}

pub enum EVerdict {
    Ok(Vec<u8>),
    Fail(Vec<u8>, Vec<u8>),
}

impl View for EVerdict {
    type V = Verdict;

    open spec fn view(&self) -> Verdict {
        match self {
            EVerdict::Ok(m) => Verdict::Ok(m@),
            EVerdict::Fail(c, d) => Verdict::Fail(c@, d@),
        }
    }
}

pub struct ERendered {
    pub rc: u8,
    pub out: Vec<u8>,
}

impl View for ERendered {
    type V = (int, Seq<u8>);

    open spec fn view(&self) -> Self::V {
        (self.rc as int, self.out@)
    }
}

pub enum EStatus {
    Pending,
    Ace(Vec<u8>),
    Restates(Vec<u8>),
    Uncovered(Vec<u8>),
}

impl View for EStatus {
    type V = Status;

    open spec fn view(&self) -> Status {
        match self {
            EStatus::Pending => Status::Pending,
            EStatus::Ace(d) => Status::Ace(d@),
            EStatus::Restates(d) => Status::Restates(d@),
            EStatus::Uncovered(c) => Status::Uncovered(c@),
        }
    }
}

pub struct ECoverageRow {
    pub id: Vec<u8>,
    pub file: Vec<u8>,
    pub status: EStatus,
    pub line: Vec<u8>,
}

impl View for ECoverageRow {
    type V = Row;

    open spec fn view(&self) -> Row {
        Row { id: self.id@, file: self.file@, status: self.status@, line: self.line@ }
    }
}

pub struct EEvidence {
    // Decimal bytes retain censuses beyond machine-word bounds.
    pub census: Vec<u8>,
    pub locators: Vec<Vec<u8>>,
    pub payloads: Vec<(Vec<u8>, Vec<Vec<u8>>)>,
    pub ordinal: Vec<Vec<u8>>,
}

impl View for EEvidence {
    type V = Evidence;

    open spec fn view(&self) -> Evidence {
        Evidence {
            census: dec_of(self.census@),
            locators: byte_rows(self.locators@),
            payloads: self.payloads@.map_values(
                |p: (Vec<u8>, Vec<Vec<u8>>)| (p.0@, byte_rows(p.1@)),
            ),
            ordinal: byte_rows(self.ordinal@),
        }
    }
}

pub struct ECoverage {
    pub rows: Vec<ECoverageRow>,
    pub files: Vec<Vec<u8>>,
    pub evidence: Vec<EEvidence>,
}

impl View for ECoverage {
    type V = Coverage;

    open spec fn view(&self) -> Coverage {
        Coverage {
            rows: self.rows@.map_values(|r: ECoverageRow| r@),
            files: byte_rows(self.files@),
            evidence: self.evidence@.map_values(|e: EEvidence| e@),
        }
    }
}

pub struct EBundle {
    pub docid: Vec<u8>,
    pub ace: Vec<u8>,
    pub cov: Vec<u8>,
    pub pay: Vec<u8>,
    pub cl: Vec<u8>,
    pub review: Vec<u8>,
}

impl View for EBundle {
    type V = Bundle;

    open spec fn view(&self) -> Bundle {
        Bundle {
            docid: self.docid@,
            ace: self.ace@,
            cov: self.cov@,
            pay: self.pay@,
            cl: self.cl@,
            review: self.review@,
        }
    }
}

pub struct EDecision {
    pub docid: Vec<u8>,
    pub digest: Vec<u8>,
    pub commit: Vec<u8>,
    pub approved: bool,
    pub date: Vec<u8>,
}

impl View for EDecision {
    type V = Decision;

    open spec fn view(&self) -> Decision {
        Decision {
            docid: self.docid@,
            digest: self.digest@,
            commit: self.commit@,
            approved: self.approved,
            date: self.date@,
        }
    }
}

pub open spec fn byte_rows(v: Seq<Vec<u8>>) -> Seq<Seq<u8>> {
    v.map_values(|b: Vec<u8>| b@)
}

pub open spec fn byte_pairs(v: Seq<(Vec<u8>, Vec<u8>)>) -> Seq<(Seq<u8>, Seq<u8>)> {
    v.map_values(|p: (Vec<u8>, Vec<u8>)| (p.0@, p.1@))
}

pub open spec fn source_pairs(v: Seq<(Vec<u8>, EFileSrc)>) -> Seq<(Seq<u8>, FileSrc)> {
    v.map_values(|p: (Vec<u8>, EFileSrc)| (p.0@, p.1@))
}

// Finite shell-read tables: first matching key wins; absent key is Missing.
pub open spec fn source_lookup(v: Seq<(Seq<u8>, FileSrc)>, key: Seq<u8>, i: nat) -> FileSrc
    decreases v.len() - i,
{
    if i >= v.len() {
        FileSrc::Missing
    } else if v[i as int].0 == key {
        v[i as int].1
    } else {
        source_lookup(v, key, i + 1)
    }
}

pub open spec fn bundles(v: Seq<EBundle>) -> Seq<Bundle> {
    v.map_values(|b: EBundle| b@)
}

pub open spec fn decisions(v: Seq<EDecision>) -> Seq<Decision> {
    v.map_values(|d: EDecision| d@)
}

pub open spec fn coverage_result(r: Result<ECoverage, EVerdict>) -> Result<Coverage, Verdict> {
    match r {
        Result::Ok(c) => Result::Ok(c@),
        Result::Err(e) => Result::Err(e@),
    }
}

pub open spec fn ledger_result(r: (Vec<EDecision>, Option<EVerdict>)) -> (
    Seq<Decision>,
    Option<Verdict>,
) {
    (
        decisions(r.0@),
        match r.1 {
            Some(v) => Some(v@),
            None => None,
        },
    )
}

pub open spec fn bytes_result(r: Result<Vec<u8>, Vec<u8>>) -> Result<Seq<u8>, Seq<u8>> {
    match r {
        Result::Ok(b) => Result::Ok(b@),
        Result::Err(e) => Result::Err(e@),
    }
}

pub open spec fn optional_bytes(r: Option<Vec<u8>>) -> Option<Seq<u8>> {
    match r {
        Option::Some(b) => Option::Some(b@),
        Option::None => Option::None,
    }
}

} // verus!
