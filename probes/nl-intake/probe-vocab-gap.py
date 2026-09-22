#!/usr/bin/env python3
"""Substring retrieval vs clinician phrasing over the shipped entity vocabulary.

Illustrative probe (n=12 phrases, 18 gold entities), NOT a benchmark: the phrases and
their gold entities are MAIN-authored. What it measures is reproducible — the baseline
recall a free-text intake gets with no semantic layer at all.

Seed the vocabulary first:
  jq -r '[.nodes[]|select(.kind=="entity")|.label]|unique|join("\n")' \
     kb/generated/graph/semantic-graph.json > /tmp/ents.txt
Run:
  python3 -P .scratch/probe-vocab-gap.py
Measured 2026-09-22 on kb/generated at 1ecad59: returned 329 of 1084, recalled 2/18 = 11%.
"""

import pathlib
import re
import sys

VOCAB = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ents.txt")

PROBE = [
    ("urine drug test", ["toxicology-testing", "toxicology-screening"]),
    ("painkiller", ["opioid-therapy", "nonopioid-therapy"]),
    ("addiction", ["opioid-use-disorder"]),
    ("elderly patient", ["older-adult"]),
    ("liver problems", ["hepatic-dysfunction", "hepatic-insufficiency"]),
    ("kidney problems", ["renal-insufficiency", "renal-dysfunction"]),
    ("how much is too much", ["MME-unit-per-day"]),
    ("quitting cold turkey", ["abrupt-discontinuation", "abrupt-opioid-discontinuation"]),
    ("sleeping pills", ["benzodiazepine"]),
    ("overdose reversal", ["naloxone-coprescribing", "naloxone-overdose-reversal-training"]),
    ("talk to the patient", ["shared-decision-making"]),
    ("check the database", ["PDMP-availability"]),
]


def main() -> int:
    low = [l.strip().lower() for l in VOCAB.read_text().splitlines() if l.strip()]
    # A gold label absent from the vocabulary would understate recall for a reason that
    # has nothing to do with retrieval, so the probe refuses rather than reporting it.
    absent = [g for _, gs in PROBE for g in gs if g.lower() not in low]
    if absent:
        print(f"gold not in vocabulary: {absent}")
        return 1
    returned = recalled = gold_total = 0
    for phrase, gold in PROBE:
        tokens = [t for t in re.split(r"[^a-z0-9]+", phrase.lower()) if len(t) > 2]
        hit = {e for e in low if any(t in e for t in tokens)}
        found = [g for g in gold if g.lower() in hit]
        gold_total += len(gold)
        recalled += len(found)
        returned += len(hit)
        print(f"{phrase:<20}  returned={len(hit):<4} gold_recalled={len(found)}/{len(gold)}")
    print(
        f"\n{len(PROBE)} probes over {len(low)} entities: substring returned {returned} "
        f"in total, recalled {recalled}/{gold_total} gold = {recalled / gold_total:.0%}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
