from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
path = root / "src/engine/session.ts"
source = path.read_text()
anchor = "  consult(source: string): void {\n"
if source.count(anchor) != 1:
    raise SystemExit("E23 mutation anchor changed")
try:
    path.write_text(source.replace(anchor, anchor + "    if (source.length >= 0) return;\n"))
    run = subprocess.run(
        [
            "pnpm",
            "exec",
            "vitest",
            "run",
            "tests/questions-live.test.ts",
            "-t",
            "tracks an injected overlay",
        ],
        cwd=root,
        text=True,
    )
    if run.returncode == 0:
        raise SystemExit("RED E23: overlay test passed with runtime consult stubbed out")
    print("E23 overlay test rejected the no-op consult mutant")
finally:
    path.write_text(source)
