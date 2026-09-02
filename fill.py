#!/usr/bin/env python3
"""Fill audit-m1.md rows IN PLACE from a batch TSV on stdin: id \t finding \t evidence.

Rewrites matching `| <id> |` table lines only; the rest of the file is untouched.
"""

import pathlib
import sys

REPORT = pathlib.Path(
    "/run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/agents/audit-m1.md"
)

batch = {}
for line in sys.stdin.read().splitlines():
    if not line.strip():
        continue
    i, f, e = line.split("\t")
    batch[i.strip()] = (f.strip(), e.strip())

out, hit = [], set()
for line in REPORT.read_text().splitlines():
    if line.startswith("| A"):
        rid = line.strip().strip("|").split("|")[0].strip()
        if rid in batch:
            f, e = batch[rid]
            out.append(f"| {rid} | {f} | {e} |")
            hit.add(rid)
            continue
    out.append(line)

REPORT.write_text("\n".join(out) + "\n")
missed = set(batch) - hit
filled = sum(
    1
    for l in REPORT.read_text().splitlines()
    if l.startswith("| A") and l.strip().strip("|").split("|")[1].strip() != "unknown"
)
print(f"wrote {len(hit)} rows; total filled {filled}" + (f"; MISSED {sorted(missed)}" if missed else ""))
