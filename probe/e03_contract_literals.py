from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
literal = re.compile(r"(['\"])[^'\"\n]*\b(?:337|schema\s+1)\b[^'\"\n]*\1", re.IGNORECASE)
hits = []
for path in sorted((root / "src").rglob("*")):
    if path.suffix not in {".ts", ".svelte"}:
        continue
    for line_no, line in enumerate(path.read_text().splitlines(), 1):
        if literal.search(line):
            hits.append(f"{path.relative_to(root)}:{line_no}")
if hits:
    raise SystemExit(f"RED E03: production contract literals at {', '.join(hits)}")
print("E03 production contract literals absent")
