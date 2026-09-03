#!/usr/bin/env python3
import argparse
import gzip
import re
import statistics
import subprocess
from pathlib import Path


def packed_bytes(paths: list[Path], root: Path) -> bytes:
    parts = []
    for path in sorted(paths):
        rel = path.relative_to(root).as_posix().encode()
        data = path.read_bytes()
        parts.extend((len(rel).to_bytes(4, "big"), rel, len(data).to_bytes(8, "big"), data))
    return b"".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kb", type=Path)
    args = parser.parse_args()
    root = args.kb.resolve() / "data/guidelines/cdc-2022-opioid"

    groups = {
        "ace": list((root / "ace").glob("*")),
        "align": list((root / "align").glob("*")),
        "coverage.tsv": [root / "coverage.tsv"],
        "audit/projection-notes.tsv": [root / "audit/projection-notes.tsv"],
        "source/*.txt": list((root / "source").glob("*.txt")),
    }
    for name, paths in groups.items():
        raw = sum(path.stat().st_size for path in paths)
        packed = packed_bytes(paths, root)
        one_gzip = len(gzip.compress(packed, compresslevel=9, mtime=0))
        per_file_gzip = sum(len(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0)) for path in paths)
        print(f"asset\t{name}\tfiles={len(paths)}\traw={raw}\tone_gzip={one_gzip}\tper_file_gzip={per_file_gzip}")

    marker = re.compile(rb"^\[[^\]\n]+ \| p\d+ \| [^\]\n]+\]\n", re.MULTILINE)
    payload_sizes = []
    for path in sorted((root / "source").glob("*.txt")):
        data = path.read_bytes()
        if path.name == "box3-extraction.txt":
            body = data.split(b"HTML Box 3 decoded character range: [630335, 638736)\n", 1)[1]
            payload_sizes.extend(len(re.sub(rb"^\d+\. ", b"", line)) for line in body.splitlines() if line)
            continue
        for match in marker.finditer(data):
            start = match.end()
            end = data.find(b"\n", start)
            payload_sizes.append((end if end >= 0 else len(data)) - start)
    print(
        "regions\t"
        f"count={len(payload_sizes)}\tmedian_bytes={statistics.median(payload_sizes):g}\t"
        f"max_bytes={max(payload_sizes)}\ttotal_bytes={sum(payload_sizes)}"
    )

    coverage = (root / "coverage.tsv").read_text().splitlines()
    pages = [int(fields[2][1:]) for line in coverage if line and not line.startswith("#") for fields in [line.split("\t")]]
    print(f"coverage\trows={len(pages)}\tpage_min={min(pages)}\tpage_max={max(pages)}\tdistinct_pages={len(set(pages))}")

    pdf = root / "source/rr7103a1-H.pdf"
    info = subprocess.run(["pdfinfo", str(pdf)], check=True, capture_output=True, text=True).stdout
    for key in ("Pages", "Page size", "PDF version"):
        value = next(line.split(":", 1)[1].strip() for line in info.splitlines() if line.startswith(f"{key}:") )
        print(f"pdf\t{key}={value}")
    for page in (1, min(pages), max(pages)):
        text = subprocess.run(
            ["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(pdf), "-"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        nonempty = [line.strip() for line in text.splitlines() if line.strip()]
        print(f"pdf_page\tphysical={page}\tfirst={nonempty[0][:100]!r}\tlast={nonempty[-1][:100]!r}")


if __name__ == "__main__":
    main()
