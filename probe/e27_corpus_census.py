from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
source = "\n".join(path.read_text() for path in sorted((root / "tests").glob("engine*.test.ts")))
cases = {
    "term:foo-vector": r"foo\(bar,7\)",
    "term:foo-list": r"foo\(\[bar,7\]\)",
    "term:1r3": r"1 rdiv 3",
    "term:3r1": r"3 rdiv 1",
    "term:atom-string": r"distinguishes an atom from a string",
    "term:large-integer": r"above 2\^53",
    "term:negative-zero": r"negative and zero integers",
    "term:float": r"decodes a float distinctly|X (?:=|is) 1\.5",
    "term:empty-list": r"empty list",
    "term:improper-list": r"improper list",
    "term:unbound-variable": r"unbound variable",
    "term:shared-variable": r"variable identity shared|shared across two arguments",
    "term:nested-ref": r"functor: 'ref'",
    "term:dollar-functor": r"\$guideline_id",
    "term:hyphenated-atom": r"hyphenated atom",
    "term:operator": r"operator term",
    "term:empty-atom": r"empty atom",
    "term:quoted-atom": r"atom containing a quote|reader's atom",
    "term:deep-nesting": r"deeply nested",
    "protocol:unmatched-id": r"unmatched response|matched no pending request",
    "protocol:duplicate-id": r"duplicate response",
    "protocol:worker-dies": r"worker fails|worker dying|worker exploded",
    "protocol:boot-failure": r"boot failure before any request|surfaces boot failure",
    "protocol:concurrent-correlation": r"two concurrent requests.*correlated|keeps two concurrent",
    "protocol:preboot-request": r"request issued before boot|before boot completes",
    "protocol:malformed-goal": r"malformed goal",
    "protocol:zero-solutions": r"zero-solution|zero solution",
}
missing = [name for name, pattern in cases.items() if re.search(pattern, source) is None]
if missing:
    raise SystemExit(f"RED E27: {len(missing)}/27 corpus cases absent: {', '.join(missing)}")
print("E27 corpus census complete: 27/27")
