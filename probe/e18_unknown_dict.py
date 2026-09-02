from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
test = root / "tests/review-e18-unknown-dict.test.ts"
source = """import { expect, it } from 'vitest';
import { decodeTerm, DecodeError } from '../src/engine/terms.js';

it('E18 fails closed on unknown wrapper tags and unsupported dicts', () => {
  expect(() => decodeTerm({ $t: 'unknown' })).toThrow(DecodeError);
  expect(() => decodeTerm({ $tag: 'unsupported', field: 1 })).toThrow(DecodeError);
});
"""
try:
    test.write_text(source)
    run = subprocess.run(
        ["pnpm", "exec", "vitest", "run", str(test.relative_to(root))], cwd=root, text=True
    )
    raise SystemExit(run.returncode)
finally:
    test.unlink(missing_ok=True)
