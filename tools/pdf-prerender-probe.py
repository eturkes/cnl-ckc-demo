#!/usr/bin/env python3
import argparse
import hashlib
import statistics
import subprocess
import tempfile
from pathlib import Path


def render(pdf: Path, page: int, kind: str, output: Path) -> Path:
    if kind == "png":
        command = ["pdftocairo", "-png", "-r", "144", "-f", str(page), "-l", str(page), "-singlefile", str(pdf), str(output)]
        result = output.with_suffix(".png")
    else:
        command = ["pdftocairo", "-svg", "-f", str(page), "-l", str(page), str(pdf), str(output.with_suffix(".svg"))]
        result = output.with_suffix(".svg")
    subprocess.run(command, check=True, capture_output=True)
    return result


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--first", type=int, default=3)
    parser.add_argument("--last", type=int, default=62)
    args = parser.parse_args()
    pdf = args.pdf.resolve()

    version = subprocess.run(["pdftocairo", "-v"], capture_output=True, text=True).stderr.splitlines()[0]
    print(f"tool\t{version}")
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        for kind in ("png", "svg"):
            sizes = []
            for page in range(args.first, args.last + 1):
                path = render(pdf, page, kind, root / f"{kind}-{page}")
                sizes.append(path.stat().st_size)
            first = render(pdf, 19, kind, root / f"{kind}-repeat-a")
            second = render(pdf, 19, kind, root / f"{kind}-repeat-b")
            print(
                f"{kind}\tpages={len(sizes)}\tmin={min(sizes)}\tmedian={statistics.median(sizes):g}\t"
                f"max={max(sizes)}\ttotal={sum(sizes)}\tpage19={first.stat().st_size}\t"
                f"repeat_equal={digest(first) == digest(second)}\tsha256={digest(first)}"
            )


if __name__ == "__main__":
    main()
