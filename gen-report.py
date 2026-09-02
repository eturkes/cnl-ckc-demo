#!/usr/bin/env python3
"""Regenerate the audit-m1 report skeleton + .ids from audit-claims.tsv.

Idempotent: replays from a clean base. Existing filled findings are preserved by
reading the current report and carrying over any non-placeholder row.
"""

import pathlib
import re
import sys

WT = pathlib.Path(__file__).parent
OUT = pathlib.Path("/run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/agents")
REPORT, IDS = OUT / "audit-m1.md", OUT / "audit-m1.ids"

claims = [
    tuple(l.split("\t"))
    for l in (WT / "audit-claims.tsv").read_text().splitlines()
    if l.strip()
]
ids = [c[0] for c in claims]

# Carry over already-filled rows so a regeneration never drops replay work.
kept = {}
if REPORT.exists():
    for line in REPORT.read_text().splitlines():
        if not line.startswith("| A"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 3 and cells[0] in ids and cells[1].lower() != "unknown":
            kept[cells[0]] = (cells[1], cells[2])

rows = "\n".join(
    f"| {i} | {kept.get(i, ('unknown', 'unknown'))[0]} | {kept.get(i, ('unknown', 'unknown'))[1]} |"
    for i in ids
)

# Details/Register bodies survive regeneration verbatim.
prev = REPORT.read_text() if REPORT.exists() else ""
det = prev.split("## Details", 1)[1] if "## Details" in prev else "\n\n"
det = det.split("## Register", 1)[0] if "## Register" in det else det
reg = prev.split("## Register", 1)[1] if "## Register" in prev else "\n"

REPORT.write_text(
    f"""# audit-m1 — claim replay over M1

Target = `9020e62`. Census = {len(ids)} rows. Grade: `python3 -P .scratch/validate-report.py .scratch/agents/audit-m1.md --verdict`

Claim text per id = `.scratch/worktrees/audit-m1/audit-claims.tsv` (id, source, claim).

| id | finding | evidence |
| --- | --- | --- |
{rows}

## Details
{det}## Register
{reg}"""
)
IDS.write_text("\n".join(ids) + "\n")
print(f"{len(ids)} ids -> {IDS}; report -> {REPORT}; carried {len(kept)} filled rows")
