from pathlib import Path

root = Path(__file__).resolve().parent.parent
client = (root / "src/engine/client.ts").read_text()
worker = (root / "src/engine/worker.ts").read_text()
checks = {
    "parent error": "worker.addEventListener('error'" in client,
    "parent messageerror": "worker.addEventListener('messageerror'" in client,
    "worker unhandledrejection": "self.addEventListener('unhandledrejection'" in worker,
}
missing = [name for name, present in checks.items() if not present]
if missing:
    raise SystemExit(f"RED E10: missing failure channel(s): {', '.join(missing)}")
print("E10 worker failure channels complete")
