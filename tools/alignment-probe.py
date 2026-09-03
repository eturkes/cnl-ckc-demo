#!/usr/bin/env python3
import argparse
import re
import statistics
from collections import defaultdict
from pathlib import Path


def source_regions(root: Path) -> dict[str, str]:
    regions = {}
    marker = re.compile(r"^\[([^\]|]+) \| p\d+ \| [^\]]+\]\n", re.MULTILINE)
    for path in sorted((root / "source").glob("*.txt")):
        text = path.read_text()
        if path.name == "box3-extraction.txt":
            body = text.split("HTML Box 3 decoded character range: [630335, 638736)\n", 1)[1]
            for index, line in enumerate((line for line in body.splitlines() if line), 1):
                regions[f"B3-{index:02d}"] = re.sub(r"^\d+\. ", "", line)
            continue
        for match in marker.finditer(text):
            end = text.find("\n", match.end())
            regions[match.group(1)] = text[match.end() : len(text) if end < 0 else end]
    return regions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kb", type=Path)
    args = parser.parse_args()
    root = args.kb.resolve() / "data/guidelines/cdc-2022-opioid"
    regions = source_regions(root)
    doc_regions = {}
    for line in (root / "audit/projection-notes.tsv").read_text().splitlines():
        if line and not line.startswith("#"):
            doc_id, region, *_ = line.split("\t")
            doc_regions[doc_id] = region

    char_failures = []
    byte_failures = []
    overlaps = []
    row_counts = []
    group_counts = []
    for path in sorted((root / "align").glob("*.tsv")):
        doc_id = path.stem
        texts = {"ace": (root / "ace" / f"{doc_id}.ace").read_text().rstrip("\n"), "src": regions[doc_regions[doc_id]]}
        intervals = defaultdict(list)
        groups = set()
        rows = [line.split("\t") for line in path.read_text().splitlines() if line]
        for group, side, raw_start, surface in rows:
            start = int(raw_start)
            groups.add(group)
            end = start + len(surface)
            if texts[side][start:end] != surface:
                char_failures.append((doc_id, side, start, surface))
            raw = texts[side].encode()
            if raw[start : start + len(surface.encode())] != surface.encode():
                byte_failures.append((doc_id, side, start, surface))
            intervals[side].append((start, end, group))
        for side, spans in intervals.items():
            for index, left in enumerate(spans):
                for right in spans[index + 1 :]:
                    if left[0] < right[1] and right[0] < left[1]:
                        overlaps.append((doc_id, side, left, right))
        row_counts.append(len(rows))
        group_counts.append(len(groups))
    print(
        f"alignment\tdocs={len(row_counts)}\trows={sum(row_counts)}\tchar_failures={len(char_failures)}\t"
        f"byte_failures={len(byte_failures)}\toverlaps={len(overlaps)}"
    )
    print(
        f"per_doc\trows_median={statistics.median(row_counts):g}\trows_max={max(row_counts)}\t"
        f"groups_median={statistics.median(group_counts):g}\tgroups_max={max(group_counts)}"
    )
    if char_failures:
        print(f"first_char_failure={char_failures[0]!r}")
    if byte_failures:
        print(f"first_byte_failure={byte_failures[0]!r}")
    if overlaps:
        print(f"first_overlap={overlaps[0]!r}")


if __name__ == "__main__":
    main()
