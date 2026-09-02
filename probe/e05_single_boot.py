from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
test = root / "tests/review-e05-single-boot.test.ts"
source = """import { expect, it } from 'vitest';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';

it('E05 single-flights concurrent boot requests', async () => {
  let loads = 0;
  let release = (): void => undefined;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const engine = {
    prolog: {
      query: (goal: string) => ({
        once: () => goal.includes('schema_version')
          ? { $tag: 'bindings', success: true, S: 1 }
          : { $tag: 'bindings', success: true, N: 337 },
      }),
    },
  } as unknown as Engine;
  const loadImage: ImageLoader = async () => {
    loads += 1;
    await wait;
    return engine;
  };
  const session = new EngineSession({ loadImage, expected: { schemaVersion: 1, documents: 337 } });
  const first = session.boot(new Uint8Array());
  const second = session.boot(new Uint8Array());
  const observed = loads;
  release();
  await Promise.all([first, second]);
  expect(observed).toBe(1);
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
