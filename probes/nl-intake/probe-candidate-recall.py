#!/usr/bin/env python3
"""Can code-side retrieval put the right KB entity in front of a judgment model?

The select-never-generate discipline has one hard precondition: a candidate the retriever
omits can never be selected. So before spending a key on the Noul stage, measure whether
BM25 over the CLAUSE-REACHABLE vocabulary reaches the gold entity at all.

Vocabulary = names that appear as `guideline_entity/4` clause HEADS, which is what a
head-form query can actually bind. Graph-only names are excluded on purpose: they produce
zero solutions and render identically to "the guideline says nothing".
  node .scratch/probe-vocab-parity.mjs   # writes /tmp/clause-entities.txt
  cp /tmp/clause-entities.txt .scratch/clause-entities.txt
  python3 -P .scratch/probe-candidate-recall.py
"""

import math
import pathlib
import re
import sys
from collections import Counter

VOCAB = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".scratch/clause-entities.txt")
CUTOFFS = (10, 30, 100, 255)

# Gold is restricted to clause-reachable names. `elderly patient` is kept deliberately with
# NO gold: the KB has no head-form entity for it, so it is the probe's abstention case.
PROBE = [
    ("urine drug test", ["toxicology-testing", "toxicology-screening"]),
    ("painkiller", ["chronic-opioid-therapy", "nonopioid-therapy"]),
    ("addiction", ["opioid-use-disorder"]),
    ("liver problems", ["hepatic-insufficiency"]),
    ("kidney problems", ["renal-insufficiency"]),
    ("quitting cold turkey", ["abrupt-discontinuation", "abrupt-opioid-discontinuation"]),
    ("sleeping pills", ["benzodiazepine"]),
    ("overdose reversal", ["naloxone-coprescribing"]),
    ("talk to the patient", ["shared-decision-making"]),
    ("how much is too much", ["MME-dosage-determination", "calculated-MME-dosage"]),
    ("watch the patient closely", ["close-patient-monitoring", "careful-monitoring"]),
    ("elderly patient", []),
]

split = lambda text: [t for t in re.split(r"[^a-z0-9]+", text.lower()) if t]


def bm25(corpus, k1=1.5, b=0.75):
    """Standard BM25 over kebab-split name tokens; the cookbook's own first stage."""
    docs = [split(name) for name in corpus]
    lengths = [len(d) for d in docs]
    avg = sum(lengths) / len(lengths)
    df = Counter(t for d in docs for t in set(d))
    n = len(docs)
    idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def score(query):
        qt = split(query)
        out = []
        for i, d in enumerate(docs):
            tf = Counter(d)
            s = sum(
                idf.get(t, 0.0)
                * (tf[t] * (k1 + 1))
                / (tf[t] + k1 * (1 - b + b * lengths[i] / avg))
                for t in qt
                if tf[t]
            )
            out.append((s, corpus[i]))
        out.sort(key=lambda p: (-p[0], p[1]))
        return [name for s, name in out if s > 0.0]

    return score


def main() -> int:
    corpus = [l.strip() for l in VOCAB.read_text().splitlines() if l.strip()]
    absent = [g for _, gs in PROBE for g in gs if g not in corpus]
    if absent:
        print(f"gold not clause-reachable: {absent}")
        return 1
    score = bm25(corpus)
    hits = {k: 0 for k in CUTOFFS}
    gold_total = sum(len(g) for _, g in PROBE)
    print(f"{'probe':<26}{'scored':>7}{'rank of gold':>34}")
    for phrase, gold in PROBE:
        ranked = score(phrase)
        where = {g: (ranked.index(g) + 1 if g in ranked else None) for g in gold}
        for k in CUTOFFS:
            hits[k] += sum(1 for r in where.values() if r is not None and r <= k)
        shown = ", ".join(f"{g}@{r or 'MISS'}" for g, r in where.items()) or "(no gold: abstain)"
        print(f"{phrase:<26}{len(ranked):>7}   {shown}")
    print(f"\n{len(corpus)} clause-reachable entities, {gold_total} gold over {len(PROBE)} probes")
    for k in CUTOFFS:
        print(f"  recall@{k:<4} = {hits[k]}/{gold_total} = {hits[k] / gold_total:.0%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
