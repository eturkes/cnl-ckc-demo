from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
terms_path = root / "src/engine/terms.ts"
serialize_path = root / "src/questions/serialize.ts"
terms = terms_path.read_text()
serialize = serialize_path.read_text()
try:
    terms_path.write_text(
        terms.replace(
            "  | { kind: 'atom'; value: string }\n",
            "  | { kind: 'atom'; value: string }\n  | { kind: 'sentinel'; value: string }\n",
        )
    )
    serialize_path.write_text(serialize.replace("  dict: 5,\n", "  dict: 5,\n  sentinel: 6,\n"))
    run = subprocess.run(["pnpm", "check"], cwd=root, capture_output=True, text=True)
    output = run.stdout + run.stderr
    if run.returncode == 0:
        raise SystemExit("RED E11: pnpm check accepted an unhandled PlTerm variant")
    if "never" not in output.lower():
        raise SystemExit("RED E11: check failed without a never-exhaustiveness error")
    print("E11 caught by a never-exhaustiveness error")
finally:
    terms_path.write_text(terms)
    serialize_path.write_text(serialize)
