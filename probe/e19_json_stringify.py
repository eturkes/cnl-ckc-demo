from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
path = root / "src/engine/session.ts"
source = path.read_text()
before = "    const result = decodeOnce(engine.prolog.query(goal).once());\n"
after = (
    "    const raw = engine.prolog.query(goal).once();\n"
    "    void JSON.stringify(raw);\n"
    "    const result = decodeOnce(raw);\n"
)
if source.count(before) != 1:
    raise SystemExit("E19 mutation anchor changed")
try:
    path.write_text(source.replace(before, after))
    run = subprocess.run(["pnpm", "gate"], cwd=root, capture_output=True, text=True)
    if run.returncode == 0:
        raise SystemExit("RED E19: pnpm gate accepted JSON.stringify over a native engine value")
    print(f"E19 mutation rejected by pnpm gate (rc {run.returncode})")
finally:
    path.write_text(source)
