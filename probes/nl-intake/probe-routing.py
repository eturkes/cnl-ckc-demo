#!/usr/bin/env python3
"""O3: can free text route to the SEVEN already-verified goals, and refuse outside them?

`src/questions/catalog.ts` is the whole executable surface: seven curated topic keys, each
with a goal the bag compiled and `kb:export-check` pins. Routing free text onto one of them
adds NO new executable surface — the goal that runs is byte-identical to the one today's
drop-down runs. That makes routing the cheapest free-text intake the non-negotiable allows.

The risk is not a wrong topic, it is a CONFIDENT wrong topic on a question no topic covers:
seven options with no escape hatch make "how do I treat migraine" come back as real opioid
advice. So the probe measures the escape hatch directly, running every phrase TWICE — once
with `other` offered, once forced onto the seven — and reports what the hatch buys.

Stage 2 is the fallback: a phrase that routes to `other` goes to concept grounding
(`.scratch/probe-grounding.py`, 82% at M8) and then to the document lookup (M9). A question
outside the curated topics can still land on a real guideline concept.

  TYPESAFE_KEY_FILE=~/.config/typesafe/key python3 -P .scratch/probe-routing.py
  python3 -P .scratch/probe-routing.py --control    # refusal control, no key needed
"""

import importlib.util
import json
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
CATALOG = pathlib.Path("kb/generated/question-catalog.json")
OTHER = "other"

_spec = importlib.util.spec_from_file_location("grounding", HERE / "probe-grounding.py")
assert _spec is not None and _spec.loader is not None
_grounding = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_grounding)
ask, ground, USAGE = _grounding.ask, _grounding.ground, _grounding.USAGE

FRAME = (
    "A clinician typed `clinician_question` into a search box. Behind the box is a knowledge "
    "base built from the CDC 2022 opioid-prescribing guideline, which can answer exactly the "
    "questions listed as options below. Pick the option that answers what the clinician is "
    "actually asking."
)
HATCH = (
    "None of the listed questions answers this. Pick this when the question is about a "
    "different clinical topic, when it is not a clinical question at all, or when it is "
    "about opioids but about something none of the listed questions covers."
)

# Gold fixed BEFORE the run. `how do I tell if the opioid is still doing any good` carries a
# DECLARED adjacency: reassessment and continue-or-taper are one clinical move split across
# two curated topics, so both are accepted. The MME-conversion and prescribing-for-family
# probes are the deliberately hard abstentions - heavily opioid-flavoured, covered by no
# curated topic. `MME conversion` gold is CONTESTABLE and is scored strictly anyway.
# MAIN-authored phrasing and gold: illustrative, not a benchmark.
PROBE = [
    ("my patient has chronic back pain, should I start them on opioids?", ["when-to-use-opioids"]),
    ("what dose do I begin with?", ["starting-opioid-therapy"]),
    ("wisdom teeth out yesterday, how many days of oxycodone?", ["acute-pain-prescription-duration"]),
    ("how soon should I see them back after starting?", ["opioid-follow-up"]),
    ("what do I need to have in place to prescribe this safely?", ["opioid-safety"]),
    ("he's been on the same dose two years, do I keep renewing?", ["continuing-or-tapering-opioids"]),
    ("my patient is addicted, what do I do?", ["opioid-use-disorder-treatment"]),
    ("should I be giving naloxone with this?", ["opioid-safety"]),
    ("immediate release or extended release to start?", ["starting-opioid-therapy"]),
    ("do I need to check the prescription drug monitoring database?", ["opioid-safety"]),
    ("she wants to come off them, how do I do that?", ["continuing-or-tapering-opioids"]),
    ("is buprenorphine the right call here?", ["opioid-use-disorder-treatment"]),
    (
        "how do I tell if the opioid is still doing any good?",
        ["opioid-follow-up", "continuing-or-tapering-opioids"],
    ),
    ("what antibiotic for an uncomplicated UTI?", [OTHER]),
    ("how should I treat this patient's migraine?", [OTHER]),
    ("what's the capital of France?", [OTHER]),
    ("will the patient's insurance cover this prescription?", [OTHER]),
    ("what's the MME conversion factor for oxycodone 5 mg?", [OTHER]),
    ("can I write an opioid prescription for my own mother?", [OTHER]),
]

# The demo ships a Japanese interface, but question text comes from the bag and stays
# English (`.claude/rules/i18n.md`), so a Japanese user would type Japanese against English
# options. Cross-lingual routing is therefore a SHIPPED-surface question, not a hypothetical.
PROBE_JA = [
    ("慢性腰痛の患者にオピオイドを開始すべきでしょうか？", ["when-to-use-opioids"]),
    ("開始用量はどれくらいにすればいいですか？", ["starting-opioid-therapy"]),
    ("親知らずを抜いた患者に、オピオイドは何日分処方すればよいですか？", ["acute-pain-prescription-duration"]),
    ("開始後、どのくらいで再診すべきですか？", ["opioid-follow-up"]),
    ("ナロキソンも一緒に処方すべきですか？", ["opioid-safety"]),
    ("患者が依存症になっています。どうすればいいですか？", ["opioid-use-disorder-treatment"]),
    ("二年間同じ用量です。このまま続けるべきですか？", ["continuing-or-tapering-opioids"]),
    ("単純性尿路感染症にはどの抗菌薬を使いますか？", [OTHER]),
    ("フランスの首都はどこですか？", [OTHER]),
    ("この処方は保険適用されますか？", [OTHER]),
]


def topic_question(entries, with_hatch):
    criteria = {e["id"]: e["question"] for e in entries}
    if with_hatch:
        criteria[OTHER] = HATCH
    return {"type": "choice", "instructions": FRAME, "criteria": criteria}


def route(key, phrase, entries):
    """Both arms in ONE request: they are independent questions over the same state."""
    answers = ask(
        key,
        {"clinician_question": phrase},
        {
            "hatched": topic_question(entries, True),
            "forced": topic_question(entries, False),
            "covered": {
                "type": "noul",
                "instructions": (
                    "Is `clinician_question` asking about something the CDC opioid-prescribing "
                    "guideline itself gives advice about? Answer no for a different clinical "
                    "topic, for a non-clinical question, and for an administrative, legal, or "
                    "arithmetic question that the guideline does not itself answer."
                ),
            },
        },
    )
    return answers["hatched"], answers["forced"], answers["covered"]["noul"]


def main() -> int:
    entries = json.loads(CATALOG.read_text())["entries"]
    ids = {e["id"] for e in entries}
    control = "--control" in sys.argv
    probes = PROBE_JA if "--ja" in sys.argv else PROBE
    gold_ids = {g for _, gs in probes for g in gs if g != OTHER}
    if control:
        gold_ids.add("zz-not-a-topic")
    unknown = sorted(gold_ids - ids)
    if unknown:
        # Firing input: a gold topic the compiled catalog does not define must refuse by name,
        # because a probe scoring against a topic that cannot run grades nothing.
        print(f"gold topic not in the compiled catalog: {unknown}")
        return 1
    if control:
        print("control did not fire")
        return 1

    key_file = os.environ.get("TYPESAFE_KEY_FILE")
    if not key_file:
        print("set TYPESAFE_KEY_FILE to a file holding the api key")
        return 1
    key = pathlib.Path(os.path.expanduser(key_file)).read_text().strip()
    names = [l.strip() for l in _grounding.VOCAB.read_text().splitlines() if l.strip()]

    in_scope = [p for p in probes if p[1] != [OTHER]]
    out_scope = [p for p in probes if p[1] == [OTHER]]
    routed = abstained = forced_harm = 0
    cov_in, cov_out = [], []
    print(f"{'verdict':<13}{'phrase':<52}{'routed to':<34}{'conf':>6}{'cov':>6}  forced-arm")
    for phrase, gold in probes:
        hatched, forced, covered = route(key, phrase, entries)
        pick = hatched["choice"]
        if gold == [OTHER]:
            ok = pick == OTHER
            abstained += ok
            verdict = "ABSTAIN-OK" if ok else "FALSE-ROUTE"
            # The forced arm has no hatch, so it MUST name a topic; that is the harm the
            # hatch prevents, counted only where abstention was the right answer.
            forced_harm += 1
            cov_out.append(covered)
        else:
            ok = pick in gold
            routed += ok
            verdict = "HIT" if ok else ("REFUSED" if pick == OTHER else "MISS")
            cov_in.append(covered)
        print(
            f"{verdict:<13}{phrase[:50]:<52}{pick:<34}"
            f"{hatched['confidence']:>6.2f}{covered:>6.2f}  {forced['choice']}"
        )

    print(
        f"\nrouting {routed}/{len(in_scope)} = {routed / len(in_scope):.0%}; "
        f"abstention {abstained}/{len(out_scope)} = {abstained / len(out_scope):.0%}; "
        f"forced arm named a real topic on all {forced_harm} uncovered questions"
    )

    # Would the `covered` Noul have done the hatch's job on its own? Score every threshold
    # the data admits, so "the hatch is what separates" is measured rather than asserted.
    best = max(
        (
            (sum(c >= t for c in cov_in) + sum(c < t for c in cov_out), t)
            for t in sorted({round(c, 2) for c in cov_in + cov_out})
        ),
        default=(0, 0.0),
    )
    total = len(cov_in) + len(cov_out)
    print(
        f"`covered` Noul alone: in-scope [{min(cov_in):.2f}, {max(cov_in):.2f}], "
        f"out-of-scope [{min(cov_out):.2f}, {max(cov_out):.2f}]; best single threshold "
        f"{best[1]:.2f} scores {best[0]}/{total} vs the hatch's {routed + abstained}/{total}"
    )

    print("\n=== stage 2: what the fallback recovers from the `other` bucket ===")
    for phrase, _gold in out_scope:
        name, confidence, covered, _ = ground(key, phrase, names)
        print(f"  {phrase[:50]:<52} -> {str(name):<40} conf={confidence:.2f} cov={covered:.2f}")

    print(
        f"\ncost: {USAGE['requests']} requests, {USAGE['input_tokens']} input + "
        f"{USAGE['output_tokens']} output tokens, {USAGE['seconds']:.1f} s total "
        f"({USAGE['seconds'] / USAGE['requests']:.2f} s/request)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
