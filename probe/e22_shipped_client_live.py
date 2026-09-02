from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
matches = []
for path in sorted((root / "tests").glob("*.test.ts")):
    source = path.read_text()
    direct = re.search(
        r"client\.query\(CATEGORY_A_GOAL[\s\S]{0,1200}toHaveLength\(7\)", source
    )
    if direct:
        matches.append(str(path.relative_to(root)))
if not matches:
    raise SystemExit(
        "RED E22: no committed test proves seven category-A solutions through EngineClient.query"
    )
print(f"E22 shipped-client live proof: {', '.join(matches)}")
