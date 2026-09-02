from pathlib import Path

root = Path(__file__).resolve().parent.parent
polish = (root / ".agent/polish.md").read_text()
entry = "**u2 browser smokes**"
if entry in polish:
    raise SystemExit(
        "RED E26: P6.2 remains open; no committed real-browser proof reads 337 from both dev and built output"
    )
print("E26 dev-and-built browser evidence is closed")
