#!/usr/bin/env python3
"""Can a judgment model ground a clinician's words in the KB's own concept names?

BM25 over the same vocabulary reaches 6% recall@255 (`.scratch/probe-candidate-recall.py`),
so there is no usable retrieval stage to rerank. This probe eliminates stage 1 instead: the
800 clause-reachable entity names are split into <=255-option Choice questions, all sent in
ONE fan-out request, then the surviving group winners go to a runoff Choice.

The model only ever SELECTS from names the knowledge base defines. It never writes a name,
so a hallucinated constant is not a reachable outcome.

  TYPESAFE_KEY_FILE=/tmp/ts-spike/key python3 -P .scratch/probe-grounding.py [--limit N]
"""

import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

ENDPOINT = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"
# The 255-option cap counts the escape hatch, so a group holds 254 real names.
CHUNK = 254
NONE = "none_in_this_group"
VOCAB = pathlib.Path(".scratch/clause-entities.txt")

FRAME = (
    "A clinician typed `clinician_question` into a search box over a knowledge base built "
    "from the CDC 2022 opioid-prescribing guidelines. Every option below is a concept name "
    "that knowledge base actually defines. Pick the option naming the concept the clinician "
    "is asking about, even when their wording is informal or is a lay synonym. "
    f"Pick `{NONE}` when no option in this group is what they mean."
)
NONE_DESC = "No concept in this group is what the clinician is asking about"

# Gold is clause-reachable only, and holds EVERY name a clinician would accept as the
# referent rather than one blessed answer: a narrower list scored `painkiller` ->
# `opioid-pain-medication` and `addiction` -> `substance-use-disorder` as misses, when both
# are real knowledge-base names and defensible readings. MAIN-authored judgment.
# `elderly patient` carries no gold on purpose: the knowledge base has no head-form entity
# for it, so it is the abstention case.
PROBE = [
    ("urine drug test", ["toxicology-testing", "toxicology-screening", "specific-toxicology-testing"]),
    (
        "painkiller",
        [
            "opioid-pain-medication",
            "chronic-opioid-therapy",
            "long-term-opioid-therapy",
            "first-line-opioid-therapy",
            "continued-opioid-therapy",
            "nonopioid-pain-treatment",
        ],
    ),
    ("addiction", ["opioid-use-disorder", "substance-use-disorder"]),
    ("liver problems", ["hepatic-insufficiency"]),
    ("kidney problems", ["renal-insufficiency"]),
    ("quitting cold turkey", ["abrupt-discontinuation", "abrupt-opioid-discontinuation"]),
    ("sleeping pills", ["benzodiazepine"]),
    (
        "overdose reversal",
        [
            "naloxone-coprescribing",
            "naloxone-overdose-reversal-training",
            "naloxone-overdose-reversal-precaution",
            "naloxone-access",
            "naloxone-dose",
        ],
    ),
    (
        "talk to the patient",
        ["shared-decision-making", "clinician-patient-communication", "communication-principle"],
    ),
    ("how much is too much", ["MME-dosage-determination", "calculated-MME-dosage"]),
    (
        "watch the patient closely",
        [
            "close-patient-monitoring",
            "careful-monitoring",
            "patient-monitoring",
            "increased-monitoring",
            "continued-close-patient-monitoring",
        ],
    ),
    ("elderly patient", []),
]

USAGE = {"input_tokens": 0, "output_tokens": 0, "requests": 0, "seconds": 0.0}


def ask(key, state, questions):
    body = json.dumps({"model": MODEL, "state": state, "questions": questions}).encode()
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    # 429 and 529 are the documented backoff codes; everything else fails the probe loudly.
    started = time.time()
    payload = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.load(response)
            break
        except urllib.error.HTTPError as error:
            if error.code not in (429, 529) or attempt == 3:
                raise SystemExit(f"HTTP {error.code}: {error.read()[:300]!r}")
            time.sleep(2**attempt)
    if payload is None:
        raise SystemExit("no response after retries")
    USAGE["seconds"] += time.time() - started
    USAGE["requests"] += 1
    for field in ("input_tokens", "output_tokens"):
        USAGE[field] += payload.get("usage", {}).get(field, 0)
    return payload["answers"]


def ground(key, phrase, names):
    """One fan-out request over every chunk, then a runoff over the surviving winners."""
    groups = [names[i : i + CHUNK] for i in range(0, len(names), CHUNK)]
    questions = {
        f"g{i}": {
            "type": "choice",
            "instructions": FRAME,
            "criteria": {**{n: None for n in group}, NONE: NONE_DESC},
        }
        for i, group in enumerate(groups)
    }
    questions["covered"] = {
        "type": "noul",
        "instructions": (
            "Does `clinician_question` ask about something an opioid-prescribing guideline "
            "would cover? Answer no when it asks about an unrelated topic, or about a patient "
            "attribute the guideline does not itself define as a concept."
        ),
    }
    answers = ask(key, {"clinician_question": phrase}, questions)
    covered = answers["covered"]["noul"]
    survivors = [
        (answers[f"g{i}"]["choice"], answers[f"g{i}"]["confidence"])
        for i in range(len(groups))
        if answers[f"g{i}"]["choice"] != NONE
    ]
    if not survivors:
        return None, 0.0, covered, survivors
    if len(survivors) == 1:
        return survivors[0][0], survivors[0][1], covered, survivors
    runoff = ask(
        key,
        {"clinician_question": phrase},
        {
            "final": {
                "type": "choice",
                "instructions": FRAME,
                "criteria": {**{n: None for n, _ in survivors}, NONE: NONE_DESC},
            }
        },
    )["final"]
    pick = runoff["choice"]
    return (None if pick == NONE else pick), runoff["confidence"], covered, survivors


def main() -> int:
    key_file = os.environ.get("TYPESAFE_KEY_FILE")
    if not key_file:
        print("set TYPESAFE_KEY_FILE to a file holding the api key")
        return 1
    key = pathlib.Path(key_file).read_text().strip()
    names = [l.strip() for l in VOCAB.read_text().splitlines() if l.strip()]
    absent = [g for _, gs in PROBE for g in gs if g not in names]
    if absent:
        print(f"gold not clause-reachable: {absent}")
        return 1

    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else len(PROBE)
    correct = abstained_right = 0
    scored = PROBE[:limit]
    for phrase, gold in scored:
        pick, confidence, covered, survivors = ground(key, phrase, names)
        if gold:
            ok = pick in gold
            correct += ok
            verdict = "HIT " if ok else "MISS"
        else:
            ok = pick is None
            abstained_right += ok
            verdict = "ABSTAIN-OK" if ok else "FALSE-GROUND"
        print(
            f"{verdict:<12} {phrase:<26} -> {str(pick):<34} "
            f"conf={confidence:.2f} covered={covered:.2f} groups_firing={len(survivors)}"
        )
    graded = [p for p in scored if p[1]]
    print(
        f"\n{len(names)} concept names in {-(-len(names) // CHUNK)} groups. "
        f"grounding {correct}/{len(graded)} = {correct / len(graded):.0%}; "
        f"abstention {abstained_right}/{len(scored) - len(graded)}"
    )
    print(
        f"cost: {USAGE['requests']} requests, {USAGE['input_tokens']} input + "
        f"{USAGE['output_tokens']} output tokens, {USAGE['seconds']:.1f} s total "
        f"({USAGE['seconds'] / USAGE['requests']:.2f} s/request)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
