from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
test = root / "tests/review-e16-shared-roundtrip.test.ts"
source = """import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { createEncoder, decodeOnce } from '../src/engine/terms.js';
import type { Engine } from '../src/engine/session.js';

it('E16 preserves a variable shared across two arguments on re-query', async () => {
  const require = createRequire(import.meta.url);
  const bytes = new Uint8Array(readFileSync(new URL('../kb/generated/kb.pvm', import.meta.url)));
  const factory = require('swipl-wasm/dist/loadImageDefault.js') as
    | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
    | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
  const engine = await (typeof factory === 'function' ? factory : factory.default)(bytes)({});
  const first = decodeOnce(engine.prolog.query('X = f(A,A).').once());
  if (first.kind !== 'bindings' || first.bindings.X === undefined) throw new Error('decode failed');
  const second = decodeOnce(
    engine.prolog
      .query('Output = Input.', { Input: createEncoder(engine.prolog)(first.bindings.X) })
      .once(),
  );
  if (second.kind !== 'bindings' || second.bindings.Output?.kind !== 'compound') {
    throw new Error('re-query failed');
  }
  expect(second.bindings.Output.args[0]?.kind).toBe('variable');
  expect(second.bindings.Output.args[1]).toEqual(second.bindings.Output.args[0]);
}, 120_000);
"""
try:
    test.write_text(source)
    run = subprocess.run(
        ["pnpm", "exec", "vitest", "run", str(test.relative_to(root))], cwd=root, text=True
    )
    raise SystemExit(run.returncode)
finally:
    test.unlink(missing_ok=True)
